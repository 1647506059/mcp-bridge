const assert = require('node:assert/strict');
const { test } = require('node:test');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('esbuild');
const { fakeClock } = require('./sourceHarness');
const { loadSource } = require('./sourceHarness');
const { projectIdentity } = loadSource('core/ProjectContext.ts');

test('绑定编辑器重载后拒绝旧实例，项目配置不会自动选择其他工程', async () => {
  const p = setup();
  const context = { project_id: projectIdentity(p.rootA), project_path: p.rootA, instance_id: 'session1', expected_context: projectIdentity(p.rootA) + ':session1' };
  p.contexts.set(8200, context);
  const conflict = await p.rpc('tools/call', { name: 'create_node', arguments: { name: 'N', expected_context: 'a' }, _meta: { expected_context: 'b' } });
  assert.match(conflict.error.message, /PROJECT_CONTEXT_MISMATCH/); assert.equal(p.forwarded.length, 0);
  await p.call('set_active_instance', { port: 8200, projectPath: p.rootA });
  await p.call('create_node', { name: 'Node' });
  assert.equal(p.forwardedPayloads.at(-1).arguments.expected_context, context.expected_context);
  p.contexts.set(8200, { ...context, instance_id: 'session2', expected_context: context.project_id + ':session2' });
  const rejected = await p.call('create_node', { name: 'Node' });
  assert.match(rejected.error.message, /EDITOR_INSTANCE_CHANGED/); assert.equal(p.forwarded.length, 1);
  await p.call('set_active_instance', { port: 8200 });
  await p.call('get_project_info'); assert.equal(p.forwarded.length, 2); p.close();
  const pinned = setup({ MCP_BRIDGE_PROJECT_PATH: path.resolve('fixture-A') });
  pinned.instances.delete(8200);
  assert.match((await pinned.call('get_project_info')).error.message, /PROJECT_CONTEXT_MISMATCH/);
  assert.ok((await pinned.call('set_active_instance', { port: 8201 })).error); pinned.close();
});

function setup(env = {}, toolResult, preset) {
  const rootA = path.resolve('fixture-A'), rootB = path.resolve('fixture-B');
  const instances = new Map([[8200, rootA], [8201, rootB]]);
  const contexts = new Map(), forwardedPayloads = [];
  const probes = [], forwarded = [], writes = [], notifications = [], input = new PassThrough(), replies = new Map();
  const clock = fakeClock();
  const source = esbuild.buildSync({ entryPoints: [path.join(__dirname, '../src/mcp-proxy.ts')], bundle: true, platform: 'node', write: false,
    define: { __MCP_BRIDGE_BUILD__: JSON.stringify({ version: '1.3.4', buildId: 'a'.repeat(64), builtAt: '2026-10-16T00:00:00.000Z' }) } }).outputFiles[0].text;
  const pendingWrites = new Map();
  const fakeFs = {
    existsSync: p => !String(p).endsWith('mcp-tool-presets.json') || !!preset, statSync: () => ({ size: 128 }),
    readFileSync: p => String(p).endsWith('mcp-tool-presets.json') ? JSON.stringify(preset) : String(p).endsWith('mcp-bridge.json') ? '{"last-port":3456}' : '[{"__type__":"cc.Prefab","data":{"__id__":1}},{"__type__":"cc.Node","_name":"Root","_children":[],"_components":[]}]',
    copyFileSync() {}, unlinkSync() {}, mkdirSync() {}, appendFileSync() {},
    writeFileSync: (p, content) => pendingWrites.set(p, content),
    renameSync: (a, b) => { pendingWrites.delete(a); writes.push(b); },
  };
  const fakeHttp = { request(options, callback) {
    if (options.path === '/mcp-status') probes.push(options.port);
    let body = ''; const request = new EventEmitter(); request.write = chunk => { body += chunk; };
    request.destroy = () => {};
    request.end = () => queueMicrotask(() => {
      if (options.path === '/call-tool' && toolResult instanceof Error) { request.emit('error', toolResult); return; }
      const response = new EventEmitter(); response.statusCode = 200; callback(response);
      let result;
      if (options.path === '/mcp-status') result = instances.has(options.port) ? { port: options.port, projectPath: instances.get(options.port), projectContext: contexts.get(options.port) } : {};
      else if (options.path === '/list-tools') result = { tools: [{ name: 'get_project_info' }] };
      else { forwarded.push(options.port); forwardedPayloads.push(body ? JSON.parse(body) : null); result = toolResult || { content: [{ type: 'text', text: 'ok' }] }; }
      response.emit('data', JSON.stringify(result)); response.emit('end');
    });
    return request;
  } };
  const nativeRequire = require;
  vm.runInNewContext(source, {
    require: n => n === 'http' ? fakeHttp : n === 'fs' ? fakeFs : nativeRequire(n),
    __dirname: path.join(rootA, 'packages/mcp-bridge/dist'), __filename: path.join(rootA, 'packages/mcp-bridge/dist/mcp-proxy.js'), module: { exports: {} }, exports: {}, Buffer, console, setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    process: { pid: 12345, argv: ['node', 'proxy'], env, stdin: input, stderr: { write() {} }, stdout: { write(line) {
      const r = JSON.parse(line);
      if (!Object.hasOwn(r, 'id')) { notifications.push(r); return; }
      replies.get(r.id)(r); replies.delete(r.id);
    } } },
  });
  let next = 0;
  function rpc(method, params) { const id = ++next; return new Promise(resolve => { replies.set(id, resolve); input.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); }); }
  return { rootA, rootB, instances, contexts, forwardedPayloads, probes, forwarded, writes, notifications, rpc,
    notify: method => input.write(JSON.stringify({ jsonrpc: '2.0', method }) + '\n'),
    close: () => input.end(),
    advance: async ms => { do { const step = Math.min(50, ms); clock.tick(step); ms -= step; await new Promise(setImmediate); } while (ms > 0); },
    call: (name, args = {}) => rpc('tools/call', { name, arguments: args }) };
}

test('项目预设裁剪列表和直接调用及batch，环境变量能覆盖模式', async () => {
  const preset = { version: 1, active: '只读', presets: [{ name: '只读', profile: 'custom', enabled: ['get_project_info', 'batch_execute'], disabled: [] }] };
  const p = setup({}, undefined, preset);
  const list = (await p.rpc('tools/list')).result.tools;
  assert.ok(!list.some(tool => tool.name === 'create_node'));
  assert.ok((await p.call('create_node', {})).error);
  assert.ok((await p.call('batch_execute', { operations: [{ tool: 'create_node', params: { name: 'N' } }] })).error);
  assert.equal(p.forwarded.length, 0); p.close();
  const full = setup({ MCP_BRIDGE_TOOL_PROFILE: 'full' }, undefined, preset);
  assert.ok((await full.rpc('tools/list')).result.tools.some(tool => tool.name === 'create_node')); full.close();
});

test('stdio预设改变后刷新目录并通知，操作白名单阻止直接调用及批处理别名', async () => {
  const preset = { version: 1, active: '自选', presets: [{ name: '自选', profile: 'custom', enabled: ['get_project_info', 'batch_execute', 'manage_components', 'add_component'], disabled: [], actions: { manage_components: ['get'] } }] };
  const p = setup({}, undefined, preset);
  assert.ok(!(await p.rpc('tools/list')).result.tools.some(tool => tool.name === 'add_component'));
  assert.ok((await p.call('manage_components', { nodeId: 'n', action: 'remove', componentType: 'cc.Label' })).error);
  assert.ok((await p.call('batch_execute', { operations: [{ tool: 'add_component', params: { nodeId: 'n', componentType: 'cc.Label' } }] })).error);
  p.notify('notifications/initialized'); await p.advance(0); p.notifications.length = 0;
  preset.presets[0].enabled.push('execute_javascript');
  assert.ok((await p.rpc('tools/list')).result.tools.some(tool => tool.name === 'execute_javascript'));
  assert.equal(p.notifications.filter(item => item.method === 'notifications/tools/list_changed').length, 1);
  await p.rpc('tools/list'); assert.equal(p.notifications.length, 1);
  assert.equal(p.forwarded.length, 0); p.close();
});

test('多实例未绑定时普通和离线操作均拒绝，工具列表不选任意工程', async () => {
  const p = setup();
  for (const name of ['get_project_info', 'modify_prefab_offline', 'modify_scene_offline']) {
    const r = await p.call(name, { prefabUrl: 'db://assets/test.prefab', sceneUrl: 'db://assets/test.fire', operations: [] });
    assert.equal(r.error?.code, -32600, name);
  }
  const list = await p.rpc('tools/list'); assert.ok(list.result.tools.some(t => t.name === 'get_project_info'));
  assert.deepEqual(p.forwarded, []); assert.deepEqual(p.writes, []);
});

test('绑定校验端口及在线身份，失败不破坏已有绑定', async () => {
  const p = setup(); await p.call('set_active_instance', { port: 8201 });
  for (const port of [-1, 0, 65536, 1.5, '8200', 9999]) assert.ok((await p.call('set_active_instance', { port })).error, String(port));
  await p.call('get_project_info'); assert.deepEqual(p.forwarded, [8201]);
});

test('绑定目标离线时不转发其他工程，离线落盘使用绑定工程路径', async () => {
  const p = setup(); await p.call('set_active_instance', { port: 8201 }); p.instances.delete(8201);
  assert.ok((await p.rpc('tools/list')).result.tools.some(t => t.name === 'get_project_info'));
  const r = await p.call('modify_prefab_offline', { prefabUrl: 'db://assets/test.prefab', operations: [] });
  assert.equal(r.error, undefined); assert.deepEqual(p.forwarded, []);
  assert.deepEqual(p.writes, [path.join(p.rootB, 'assets/test.prefab')]);
  assert.ok((await p.call('get_project_info')).error);
});

test('端口被其他项目复用时拒绝写入，并拒绝跨项目离线路径', async () => {
  const p = setup(); await p.call('set_active_instance', { port: 8201 });
  p.instances.set(8201, p.rootA);
  assert.ok((await p.call('modify_prefab_offline', { prefabUrl: 'db://assets/test.prefab', operations: [] })).error);
  p.instances.delete(8201);
  assert.ok((await p.call('modify_prefab_offline', { prefabUrl: path.join(p.rootA, 'assets/test.prefab'), operations: [] })).error);
  assert.deepEqual(p.forwarded, []); assert.deepEqual(p.writes, []);
});

test('无在线实例时仅显式配置的工程允许离线启动，工具列表保留离线能力', async () => {
  const rootB = path.resolve('fixture-B');
  const p = setup({ MCP_BRIDGE_PROJECT_PATH: rootB }); p.instances.clear();
  const list = await p.rpc('tools/list'); assert.ok(list.result.tools.some(t => t.name === 'get_project_info'));
  assert.equal((await p.call('modify_prefab_offline', { prefabUrl: 'db://assets/test.prefab', operations: [] })).error, undefined);
  assert.deepEqual(p.writes, [path.join(rootB, 'assets/test.prefab')]);
  assert.ok((await p.call('get_project_info')).error);
  const unconfigured = setup(); unconfigured.instances.clear();
  assert.ok((await unconfigured.call('modify_prefab_offline', { prefabUrl: 'db://assets/test.prefab', operations: [] })).error);
  assert.deepEqual(unconfigured.writes, []);
});


test('绑定后普通调用仅探测目标端口，工具列表零探测，显式发现仍扫描全部', async () => {
  const p = setup(); await p.call('set_active_instance', { port: 8201 }); p.probes.length = 0;
  await p.call('get_project_info'); assert.deepEqual(p.probes, [8201]);
  p.probes.length = 0; await p.rpc('tools/list'); assert.deepEqual(p.probes, []);
  p.probes.length = 0; await p.call('get_active_instances'); assert.ok(p.probes.length >= 12);
  assert.ok(p.probes.includes(3456));
});

test('离线首次握手也有完整且唯一的工具目录，恢复、绑定和多实例均不改变目录', async () => {
  const p = setup(); p.instances.clear();
  const init = await p.rpc('initialize');
  assert.equal(init.result.capabilities.tools.listChanged, true);
  const first = (await p.rpc('tools/list')).result.tools;
  const names = first.map(t => t.name);
  assert.ok(names.length > 40); assert.equal(new Set(names).size, names.length);
  for (const name of ['get_project_info', 'batch_execute', 'modify_prefab_offline', 'modify_scene_offline', 'get_active_instances', 'set_active_instance']) assert.ok(names.includes(name), name);
  assert.ok(first.find(t => t.name === 'get_project_info').inputSchema.properties.includeMcpDiagnostics);
  assert.deepEqual(p.probes, []);
  p.instances.set(8201, p.rootB);
  await p.call('set_active_instance', { port: 8201 });
  p.instances.set(8200, p.rootA);
  assert.deepEqual((await p.rpc('tools/list')).result.tools, first);
});

test('离线、歧义和端口身份变化仍能读取代理诊断，不转发其他工程或虚报 matched', async () => {
  const p = setup();
  async function diagnostic() {
    const r = await p.call('get_project_info', { includeMcpDiagnostics: true });
    assert.equal(r.error, undefined);
    const info = JSON.parse(r.result.content[0].text);
    assert.equal(info.mcpDiagnostics.status, 'incomplete');
    assert.equal(info.mcpDiagnostics.proxy.pid, 12345);
    assert.equal(info.mcpDiagnostics.editor, null); assert.equal(info.mcpDiagnostics.scene, null);
    assert.ok(info.mcpDiagnostics.issues.some(i => i.startsWith('connection:')));
    assert.deepEqual(p.forwarded, []); assert.deepEqual(p.writes, []);
    return info;
  }
  assert.match((await diagnostic()).connectionError, /Multiple Cocos/);
  p.instances.clear(); assert.ok((await diagnostic()).connectionError);
  assert.ok((await p.call('get_project_info')).error);
  p.instances.set(8201, p.rootB); await p.call('set_active_instance', { port: 8201 });
  p.instances.set(8201, p.rootA); assert.match((await diagnostic()).connectionError, /身份已变化/);
  p.instances.delete(8201); assert.match((await diagnostic()).connectionError, /离线/);
});

test('旧客户端已有的实例发现工具可选三侧诊断，默认数组兼容，歧义和离线仍安全', async () => {
  const runtime = { buildId: 'a'.repeat(64) };
  const p = setup({}, { content: [{ type: 'text', text: JSON.stringify({ mcpDiagnostics: { editor: runtime, scene: runtime } }) }] });
  const plain = JSON.parse((await p.call('get_active_instances')).result.content[0].text);
  assert.equal(Array.isArray(plain), true); assert.equal(plain.length, 2);
  const ambiguous = JSON.parse((await p.call('get_active_instances', { includeMcpDiagnostics: true })).result.content[0].text);
  assert.equal(ambiguous.instances.length, 2); assert.equal(ambiguous.mcpDiagnostics.status, 'incomplete');
  assert.deepEqual(p.forwarded, []);
  await p.call('set_active_instance', { port: 8201 });
  const bound = JSON.parse((await p.call('get_active_instances', { includeMcpDiagnostics: true })).result.content[0].text);
  assert.equal(bound.mcpDiagnostics.status, 'matched'); assert.equal(bound.instances.length, 2);
  assert.deepEqual(p.forwarded, [8201]);
  p.instances.delete(8201);
  const offline = JSON.parse((await p.call('get_active_instances', { includeMcpDiagnostics: true })).result.content[0].text);
  assert.equal(offline.mcpDiagnostics.status, 'incomplete'); assert.equal(offline.mcpDiagnostics.proxy.pid, 12345);
  assert.deepEqual(p.forwarded, [8201]);
});

test('状态探测后 HTTP 连接失败，诊断仍可用，普通工具继续报告原始错误', async () => {
  const p = setup({}, new Error('connection reset'));
  await p.call('set_active_instance', { port: 8201 });
  for (const name of ['get_project_info', 'get_active_instances']) {
    const r = await p.call(name, { includeMcpDiagnostics: true });
    assert.equal(r.error, undefined);
    const info = JSON.parse(r.result.content[0].text);
    assert.match(info.connectionError, /connection reset/);
    assert.equal(info.mcpDiagnostics.status, 'incomplete');
    assert.equal(info.mcpDiagnostics.proxy.pid, 12345);
  }
  assert.match((await p.call('get_project_info')).error.message, /connection reset/);
});

test('完成初始化后通知连接、绑定、断线和恢复；稳定连接不重复通知，绑定监测不全扫', async () => {
  const p = setup(); p.instances.clear();
  await p.rpc('initialize'); await p.advance(5000);
  assert.deepEqual(p.probes, []); assert.deepEqual(p.notifications, []);
  p.notify('notifications/initialized'); p.notify('notifications/initialized'); await p.advance(0);
  p.probes.length = 0;
  p.instances.set(3456, p.rootA); await p.advance(10000);
  assert.equal(p.notifications.length, 1);
  assert.deepEqual(p.notifications[0], { jsonrpc: '2.0', method: 'notifications/tools/list_changed' });
  await p.call('set_active_instance', { port: 3456 }); assert.equal(p.notifications.length, 2);
  p.probes.length = 0; await p.advance(5000);
  assert.deepEqual(p.probes, [3456]); assert.equal(p.notifications.length, 2);
  p.instances.delete(3456); await p.advance(5000); assert.equal(p.notifications.length, 3);
  await p.advance(5000); assert.equal(p.notifications.length, 3);
  p.instances.set(3456, p.rootB); await p.advance(10000); assert.equal(p.notifications.length, 4);
  assert.ok((await p.call('get_project_info')).error); assert.deepEqual(p.forwarded, []);
  p.instances.set(3456, p.rootA); await p.advance(5000); assert.equal(p.notifications.length, 5);
  await p.call('get_project_info'); assert.deepEqual(p.forwarded, [3456]);
  p.close(); await p.advance(0); p.probes.length = 0;
  await p.advance(10000); assert.deepEqual(p.probes, []);
});

test('绑定目标离线后回退扫描仍拒绝切换，恢复后重新使用快路径', async () => {
  const p = setup(); await p.call('set_active_instance', { port: 8201 }); p.instances.delete(8201); p.probes.length = 0;
  assert.ok((await p.call('get_project_info')).error); assert.ok(p.probes.length > 1); assert.deepEqual(p.forwarded, []);
  p.instances.set(8201, p.rootB); p.probes.length = 0;
  await p.call('get_project_info'); assert.deepEqual(p.probes, [8201]); assert.deepEqual(p.forwarded, [8201]);
});

test('握手版本来自构建信息；按需诊断返回三方身份和快路径计数，默认查询不改变响应', async () => {
  const runtime = { version: '1.3.4', buildId: 'a'.repeat(64) };
  const info = { path: '/project', mcpDiagnostics: { editor: runtime, scene: runtime, issues: ['proxy: runtime information unavailable'] } };
  const original = { content: [{ type: 'text', text: JSON.stringify(info) }] };
  const p = setup({}, original);
  assert.equal((await p.rpc('initialize')).result.serverInfo.version, '1.3.4');
  await p.call('set_active_instance', { port: 8201 });
  const first = JSON.parse((await p.call('get_project_info', { includeMcpDiagnostics: true })).result.content[0].text).mcpDiagnostics;
  assert.equal(first.status, 'matched'); assert.deepEqual(first.issues, []);
  assert.equal(first.proxy.pid, 12345); assert.equal(first.proxy.routing.boundPort, 8201);
  assert.equal(first.proxy.routing.lastRoute, 'bound'); assert.equal(first.proxy.routing.fullScans, 0);
  const second = JSON.parse((await p.call('get_project_info', { includeMcpDiagnostics: true })).result.content[0].text).mcpDiagnostics;
  assert.equal(second.proxy.routing.statusProbes - first.proxy.routing.statusProbes, 1);
  assert.equal(second.proxy.routing.fullScans, 0);
  const plain = await p.call('get_project_info'); assert.deepEqual(plain.result, original);
});

test('旧插件缺少诊断或两侧构建不同，必须显示 incomplete/mismatch；工具错误保留原样', async () => {
  for (const scenario of [
    [{ path: '/legacy' }, 'incomplete'],
    [{ mcpDiagnostics: { editor: { buildId: 'old' }, scene: { buildId: 'old' } } }, 'mismatch'],
  ]) {
    const p = setup({}, { content: [{ type: 'text', text: JSON.stringify(scenario[0]) }] });
    await p.call('set_active_instance', { port: 8201 });
    const diag = JSON.parse((await p.call('get_project_info', { includeMcpDiagnostics: true })).result.content[0].text).mcpDiagnostics;
    assert.equal(diag.status, scenario[1]); assert.ok(diag.issues.length);
  }
  const error = { isError: true, content: [{ type: 'text', text: 'Error: original failure' }] };
  const p = setup({}, error); await p.call('set_active_instance', { port: 8201 });
  assert.deepEqual((await p.call('get_project_info', { includeMcpDiagnostics: true })).result, error);
});


test('协议错误和缺少参数必须响应且零探测，并发同端口探测合并', async () => {
  const p = setup();
  assert.equal((await p.rpc('tools/call')).error.code, -32602);
  assert.equal((await p.rpc('tools/call', { name: 'unknown' })).error.code, -32602);
  assert.equal((await p.rpc('not-a-method')).error.code, -32601); assert.equal(p.probes.length, 0);
  await p.call('set_active_instance', { port: 8200 }); p.probes.length = 0;
  await Promise.all([p.call('get_project_info'), p.call('get_project_info')]);
  assert.deepEqual(p.probes, [8200]); assert.deepEqual(p.forwarded, [8200, 8200]);
});

test('离线监测退避，前台请求仍即时探测且关闭后不复活', async () => {
  const p = setup(); p.instances.clear(); p.notify('notifications/initialized'); await p.advance(0);
  const a = await p.call('get_project_info', { includeMcpDiagnostics: true });
  const first = JSON.parse(a.result.content[0].text).mcpDiagnostics.proxy.routing.monitorDelayMs;
  await p.advance(10000);
  const b = await p.call('get_project_info', { includeMcpDiagnostics: true });
  const second = JSON.parse(b.result.content[0].text).mcpDiagnostics.proxy.routing.monitorDelayMs;
  assert.ok(second > first); p.close(); await p.advance(0); p.probes.length = 0;
  await p.advance(60000); assert.equal(p.probes.length, 0);
});
