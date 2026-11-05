const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource } = require('./sourceHarness');
const scopedToolUrl = '/mcp/project/' + loadSource('core/ProjectContext.ts').projectIdentity(process.cwd()) + '/call-tool';

test('队列被阻塞时，原生输入的状态与取消仍能直接处理', () => {
  let result, calls = 0;
  const { McpRouter } = loadSource('core/McpRouter.ts', {}, {
    './Logger': { Logger: {} },
    './CommandQueue': { CommandQueue: { enqueue() { throw Error('控制请求不应进入阻塞队列'); } } },
    '../tools/ToolDispatcher': { ToolDispatcher: { handleMcpCall(name, args, done) { calls++; done(null, { state: args.action === 'cancel' ? 'cancelled' : 'running' }); } } },
    '../tools/ToolRegistry': {}, './McpWrappers': {}, './HttpServer': {}, '../IpcManager': {},
  });
  for (const action of ['status', 'cancel']) {
    McpRouter.handleRequest({ url: scopedToolUrl, bodyString: JSON.stringify({ name: 'simulate_mouse_drag', arguments: { action, requestKey: 'owned' } }) }, {
      writeHead() {}, end(text) { result = JSON.parse(text); },
    });
    assert.equal(result.isError, false); assert.ok(result.projectContext.expected_context);
  }
  assert.equal(calls, 2);
});

for (const failed of [false, true]) {
  test(`工具${failed ? '失败' : '成功'}通过 MCP isError 标记准确传给客户端`, () => {
    let result, completed = 0;
    const { McpRouter } = loadSource('core/McpRouter.ts', {}, {
      './Logger': { Logger: { mcp() {}, error() {}, success() {}, warn() {} } },
      './CommandQueue': { CommandQueue: { getLength: () => 0, enqueue(fn) { fn(() => completed++); return Promise.resolve(); } } },
      '../tools/ToolDispatcher': { ToolDispatcher: { handleMcpCall(name, args, cb) { cb(failed ? new Error('resource unavailable') : null, { saved: true }); } } },
      '../tools/ToolRegistry': {}, './McpWrappers': {}, './HttpServer': {}, '../IpcManager': {},
    });
    McpRouter.handleRequest({ url: scopedToolUrl, bodyString: JSON.stringify({ name: 'manage_components', arguments: {} }) }, {
      writeHead() {}, end: content => { result = JSON.parse(content); },
    });
    assert.equal(result.isError, failed); assert.equal(completed, 1);
    if (failed) assert.match(result.content[0].text, /resource unavailable/);
    else assert.equal(JSON.parse(result.content[0].text).saved, true);
  });
}

test('客户端在排队期间断开后，未开始的编辑器操作不再迟到执行', () => {
  let queued, writes = 0, doneCount = 0;
  const { McpRouter } = loadSource('core/McpRouter.ts', {}, {
    './Logger': { Logger: { mcp() {} } },
    './CommandQueue': { CommandQueue: { getLength: () => 1, enqueue(fn) { queued = fn; return Promise.resolve(); } } },
    '../tools/ToolDispatcher': { ToolDispatcher: { handleMcpCall() { writes++; } } },
    '../tools/ToolRegistry': {}, './McpWrappers': {}, './HttpServer': {}, '../IpcManager': {},
  });
  const res = { destroyed: false, writeHead() {}, end() { assert.fail('disconnected'); } };
  McpRouter.handleRequest({ url: scopedToolUrl, bodyString: '{"name":"set_node_name","arguments":{}}' }, res);
  res.destroyed = true; queued(() => doneCount++);
  assert.equal(writes, 0); assert.equal(doneCount, 1);
});

test('参数日志有界，大结果只序列化一次且完整返回', () => {
  let serialized = 0, response, log;
  const result = { toJSON() { serialized++; return { text: '中'.repeat(10000) }; } };
  const { McpRouter } = loadSource('core/McpRouter.ts', {}, {
    './Logger': { Logger: { mcp: s => log = s, success() {} } },
    './CommandQueue': { CommandQueue: { getLength: () => 0, enqueue(fn) { fn(() => {}); return Promise.resolve(); } } },
    '../tools/ToolDispatcher': { ToolDispatcher: { handleMcpCall(n, a, cb) { cb(null, result); } } },
    '../tools/ToolRegistry': {}, './McpWrappers': {}, './HttpServer': {}, '../IpcManager': {},
  });
  McpRouter.handleRequest({ url: scopedToolUrl, bodyString: JSON.stringify({ name: 'manage_components', arguments: { properties: { string: '中'.repeat(1024 * 1024) } } }) }, {
    destroyed: false, writeHead() {}, end: text => response = JSON.parse(text),
  });
  assert.equal(serialized, 1); assert.ok(Buffer.byteLength(log) < 8000);
  assert.equal(JSON.parse(response.content[0].text).text.length, 10000);
});

test('带截图凭证的响应仍以MCP图片返回，metadata不重复携带base64', () => {
  let response;
  const { McpRouter } = loadSource('core/McpRouter.ts', {}, {
    './Logger': { Logger: { mcp() {}, success() {} } },
    './CommandQueue': { CommandQueue: { getLength: () => 0, enqueue(fn) { fn(() => {}); return Promise.resolve(); } } },
    '../tools/ToolDispatcher': { ToolDispatcher: { handleMcpCall(n, a, cb) { cb(null, { dataUrl: 'data:image/png;base64,YWJj', captureId: 'capture-test', cached: false }); } } },
    '../tools/ToolRegistry': {}, './McpWrappers': {}, './HttpServer': {}, '../IpcManager': {},
  });
  McpRouter.handleRequest({ url: scopedToolUrl, bodyString: '{"name":"capture_editor_screenshot","arguments":{"includeMetadata":true}}' }, {
    writeHead() {}, end: text => response = JSON.parse(text),
  });
  assert.equal(response.content[0].type, 'image'); assert.equal(response.content[0].data, 'YWJj');
  assert.equal(JSON.parse(response.content[1].text).captureId, 'capture-test');
  assert.equal(JSON.parse(response.content[1].text).dataUrl, undefined);
  assert.equal(response.structuredContent.ok, true); assert.match(response.structuredContent.callId, /^call_/);
});

test('批处理失败保留原错误及部分结果，调用记录使用相同callId且报告继续位置', () => {
  let response; const logs = [];
  const { McpRouter } = loadSource('core/McpRouter.ts', {}, {
    './Logger': { Logger: { mcp: s => logs.push(s), error: s => logs.push(s) } },
    './CommandQueue': { CommandQueue: { getLength: () => 0, enqueue(fn) { fn(() => {}); return Promise.resolve(); } } },
    '../tools/ToolDispatcher': { ToolDispatcher: { handleMcpCall(n, a, cb) { cb('budget', { results: [{ tool: 'create_node', result: 'created' }], executedCount: 1, nextOperationIndex: 1 }); } } },
    '../tools/ToolRegistry': {}, './McpWrappers': {}, './HttpServer': {}, '../IpcManager': {},
  });
  McpRouter.handleRequest({ url: scopedToolUrl, bodyString: '{"name":"batch_execute","arguments":{}}' }, {
    writeHead() {}, end: text => response = JSON.parse(text),
  });
  assert.equal(response.isError, true); assert.match(response.content[0].text, /budget/);
  assert.equal(JSON.parse(response.content[1].text).executedCount, 1);
  assert.equal(response.structuredContent.nextOperationIndex, 1);
  assert.ok(logs.every(log => log.includes(response.structuredContent.callId)));
});
