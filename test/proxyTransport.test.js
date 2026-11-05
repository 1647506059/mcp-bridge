const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { setTimeout: delay } = require('node:timers/promises');
const { test } = require('node:test');
const http = require('node:http');

function startProxy(t, env = {}) {
  const child = spawn(process.execPath, [path.join(__dirname, '../dist/mcp-proxy.js')], { stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env, ...env } });
  const pending = new Map();
  const notifications = [];
  const lines = createInterface({ input: child.stdout });
  lines.on('line', (line) => {
    const response = JSON.parse(line);
    if (!Object.hasOwn(response, 'id')) { notifications.push(response); return; }
    const waiter = pending.get(response.id);
    if (waiter) {
      pending.delete(response.id);
      clearTimeout(waiter.timer);
      waiter.resolve(response);
    }
  });
  child.stderr.resume();
  t.after(async () => {
    for (const waiter of pending.values()) {
      clearTimeout(waiter.timer);
      waiter.reject(new Error('代理已关闭'));
    }
    if (child.exitCode === null) {
      const closed = new Promise((resolve) => child.once('close', resolve));
      child.kill();
      await closed;
    }
    lines.close();
  });
  return {
    child,
    notifications,
    wait(id) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`请求 ${id} 未收到 JSON-RPC 响应`));
        }, 2000);
        pending.set(id, { resolve, reject, timer });
      });
    },
  };
}

test('stdio 握手和同一数据块中的多条请求', async (t) => {
  const proxy = startProxy(t);
  const first = proxy.wait(1);
  const second = proxy.wait(2);
  proxy.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }) + '\n' +
    JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'ping' }) + '\n');
  assert.equal((await first).result.serverInfo.name, 'cocos-bridge');
  assert.deepEqual((await second).result, {});
});

test('实际 dist 离线目录零 HTTP 依赖；旧管理入口诊断和连接变化通知可用', async t => {
  const build = require('../dist/build-info.json'), root = path.resolve(__dirname, '..');
  let online = true, requests = 0;
  const server = http.createServer((req, res) => {
    requests++;
    if (req.url === '/mcp-status') return res.end(JSON.stringify(online ? { projectPath: root, mcp: build } : {}));
    res.end(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ path: root,
      mcpDiagnostics: { editor: build, scene: build } }) }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const proxy = startProxy(t, { MCP_BRIDGE_PORT: String(server.address().port) });
  let id = 0;
  async function rpc(method, params) {
    const requestId = ++id, result = proxy.wait(requestId);
    proxy.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) + '\n');
    return result;
  }
  assert.equal((await rpc('initialize')).result.capabilities.tools.listChanged, true);
  const first = (await rpc('tools/list')).result.tools;
  assert.ok(first.length > 40); assert.equal(requests, 0);
  await rpc('tools/call', { name: 'set_active_instance', arguments: { port: server.address().port } });
  proxy.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  // 等待初始化监测完成；后续诊断观察到状态变化时通知与响应同批输出。
  await delay(250);
  proxy.notifications.length = 0;
  const info = JSON.parse((await rpc('tools/call', { name: 'get_active_instances', arguments: { includeMcpDiagnostics: true } })).result.content[0].text);
  assert.equal(info.mcpDiagnostics.status, 'matched'); assert.equal(info.mcpDiagnostics.proxy.buildId, build.buildId);
  const beforeOffline = proxy.notifications.length;
  online = false;
  const offline = JSON.parse((await rpc('tools/call', { name: 'get_project_info', arguments: { includeMcpDiagnostics: true } })).result.content[0].text);
  assert.equal(offline.mcpDiagnostics.status, 'incomplete'); assert.ok(offline.connectionError);
  assert.equal(proxy.notifications.length, beforeOffline + 1);
  assert.deepEqual(proxy.notifications.at(-1), { jsonrpc: '2.0', method: 'notifications/tools/list_changed' });
  const beforeList = requests;
  assert.deepEqual((await rpc('tools/list')).result.tools, first); assert.equal(requests, beforeList);
  online = true;
  const recovered = JSON.parse((await rpc('tools/call', { name: 'get_project_info', arguments: { includeMcpDiagnostics: true } })).result.content[0].text);
  assert.equal(recovered.mcpDiagnostics.status, 'matched'); assert.equal(proxy.notifications.length, beforeOffline + 2);
});

test('实际 dist 代理握手和诊断使用嵌入的构建身份，绑定调用保留快路径', async t => {
  const build = require('../dist/build-info.json');
  const root = path.resolve(__dirname, '..');
  const server = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/mcp-status') return res.end(JSON.stringify({ projectPath: root, mcp: build }));
    res.end(JSON.stringify({ content: [{ type: 'text', text: JSON.stringify({ path: root,
      mcpDiagnostics: { editor: build, scene: build, proxy: null, issues: [] } }) }] }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const proxy = startProxy(t);
  let id = 100;
  async function rpc(method, params) {
    const requestId = ++id, result = proxy.wait(requestId);
    proxy.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: requestId, method, params }) + '\n');
    return result;
  }
  assert.equal((await rpc('initialize')).result.serverInfo.version, build.version);
  await rpc('tools/call', { name: 'set_active_instance', arguments: { port: server.address().port } });
  async function diagnostics() {
    const r = await rpc('tools/call', { name: 'get_project_info', arguments: { includeMcpDiagnostics: true } });
    return JSON.parse(r.result.content[0].text).mcpDiagnostics;
  }
  const a = await diagnostics(), b = await diagnostics();
  assert.equal(a.status, 'matched'); assert.equal(a.proxy.buildId, build.buildId); assert.equal(a.proxy.builtAt, build.builtAt);
  assert.equal(a.proxy.entryPath, path.join(__dirname, '../dist/mcp-proxy.js'));
  assert.equal(b.proxy.routing.statusProbes - a.proxy.routing.statusProbes, 1); assert.equal(b.proxy.routing.fullScans, 0);
});

test('stdio 请求跨数据块及 UTF-8 字符边界时仍完整解析', async (t) => {
  const proxy = startProxy(t);
  const ready = proxy.wait(1);
  proxy.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }) + '\n');
  await ready;
  const response = proxy.wait('分块测试');
  // 立即安装拒绝处理，避免写入第二块之前出现未处理的超时拒绝。
  const outcome = response.then((value) => ({ value }), (error) => ({ error }));
  const request = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: '分块测试', method: 'ping' }) + '\n');
  const split = request.indexOf(Buffer.from('分')) + 1;
  proxy.child.stdin.write(request.subarray(0, split));
  await delay(100);
  proxy.child.stdin.write(request.subarray(split));
  const result = await outcome;
  if (result.error) throw result.error;
  assert.equal(result.value.id, '分块测试');
  assert.deepEqual(result.value.result, {});
});

test('实际dist代理完整转发Unicode请求并接收跨UTF8字符边界的HTTP响应', async t => {
  const root = path.resolve(__dirname, '..'), literal = '中文🙂换行\n原文';
  let received;
  const server = http.createServer((req, res) => {
    if (req.url === '/mcp-status') return res.end(JSON.stringify({ projectPath: root }));
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      received = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const body = Buffer.from(JSON.stringify({ content: [{ type: 'text', text: literal }] }));
      const split = body.indexOf(Buffer.from('中')) + 1;
      res.write(body.subarray(0, split));
      setTimeout(() => res.end(body.subarray(split)), 15);
    });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const proxy = startProxy(t);
  async function call(id, name, args) {
    const response = proxy.wait(id);
    proxy.child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }) + '\n');
    return response;
  }
  await call(1, 'set_active_instance', { port: server.address().port });
  const result = await call(2, 'set_node_name', { id: 'node', newName: literal });
  assert.equal(result.result.content[0].text, literal);
  assert.equal(received.arguments.newName, literal);
});
