const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { loadSource } = require('./sourceHarness');

function sceneFixture() {
  let sequence = 0, now = Date.now();
  const nodes = new Map(), notifications = [], timers = [];
  class Component { constructor() { this.uuid = 'component-' + ++sequence; this.enabled = true; } }
  class Node {
    constructor(name) { this.uuid = 'node-' + ++sequence; this.name = name; this._components = []; this.children = []; this.x = this.y = 0; nodes.set(this.uuid, this); }
    set parent(node) { this._parent = node; node.children.push(this); }
    get parent() { return this._parent; }
    getComponent(C) { return this._components.find(c => c instanceof C); }
    addComponent(C) { const component = new C(); component.node = this; this._components.push(component); return component; }
    destroy() { nodes.delete(this.uuid); }
    get childrenCount() { return this.children.length; }
  }
  const root = new Node('Scene');
  const cc = { Node, Component, Asset: class {}, ValueType: class {}, Canvas: class {},
    director: { getScene: () => root }, engine: { getInstanceById: id => nodes.get(id) },
    js: { getClassName: () => 'cc.Component', getClassByName: () => Component, isChildClassOf: () => true },
    Class: { Attr: { getClassAttrs: () => ({}) } }, isValid: () => true };
  const Editor = { Ipc: { sendToMain: (...a) => notifications.push(a), sendToAll: (...a) => notifications.push(a) } };
  const api = loadSource('scene-script.ts', { cc, Editor,
    Date: class extends Date { static now() { return now; } },
    setTimeout(fn, ms) { const t = { fn, ms }; timers.push(t); return t; }, clearTimeout(t) { t.cleared = true; } });
  const run = args => new Promise(resolve => api['execute-scene-batch']({ reply: (error, result) => resolve({ error, result }) }, args));
  return { root, nodes, cc, api, notifications, timers, run, expire() { now += 15000; timers.filter(t => t.ms >= 10000 && !t.cleared).forEach(t => t.fn()); } };
}

test('场景内创建→$ref→组件→变换保持顺序，重复变换只发一次dirty及每节点changed', async () => {
  const s = sceneFixture();
  const r = await s.run({ operations: [
    { id: 'parent', tool: 'create_node', params: { name: 'Parent', returnDetails: true } },
    { tool: 'manage_components', params: { action: 'add', nodeId: { $ref: 'parent.uuid' }, componentType: 'Custom', properties: { enabled: false } } },
    ...[10, 20].map(x => ({ tool: 'update_node_transform', params: { id: { $ref: 'parent.uuid' }, x } })),
    { tool: 'manage_components', params: { action: 'get', nodeId: { $ref: 'parent.uuid' }, fields: ['enabled'] } }
  ] });
  assert.equal(r.error, null); assert.equal(r.result.length, 5);
  assert.equal(s.nodes.get(r.result[0].result.uuid).x, 20);
  assert.equal(r.result[4].result[0].properties.enabled, false);
  assert.equal(s.notifications.filter(a => a[0] === 'scene:dirty').length, 1);
  assert.equal(s.notifications.filter(a => a[0] === 'scene:node-changed').length, 1);
});

test('场景批处理整批预检、失败停止/继续和已执行结果保持原有语义', async () => {
  for (const stopOnError of [true, false]) {
    const s = sceneFixture();
    const r = await s.run({ stopOnError, operations: [
      { tool: 'update_node_transform', params: { id: s.root.uuid, x: 1 } },
      { tool: 'update_node_transform', params: { id: 'missing', x: 2 } },
      { tool: 'update_node_transform', params: { id: s.root.uuid, x: 3 } }
    ] });
    assert.ok(r.error); assert.equal(s.root.x, stopOnError ? 1 : 3); assert.equal(r.result.length, stopOnError ? 2 : 3);
    assert.equal(s.notifications.filter(a => a[0] === 'scene:dirty').length, 1);
  }
  const s = sceneFixture();
  const r = await s.run({ operations: [
    { tool: 'update_node_transform', params: { id: s.root.uuid, x: 1 } },
    { tool: 'manage_components', params: { action: 'add', nodeId: s.root.uuid } }
  ] });
  assert.match(r.error, /预检/); assert.equal(s.root.x, 0); assert.equal(s.notifications.length, 0);
});

test('场景批处理中加载超时先flush通知、保留完成锁，迟到后不执行下一步且普通通知不会被吞', async () => {
  const s = sceneFixture(); let reply;
  const original = s.api['manage-components'];
  s.api['manage-components'] = event => { reply = event.reply; };
  const pending = s.run({ stopOnError: false, operations: [
    { tool: 'update_node_transform', params: { id: s.root.uuid, x: 1 } },
    { tool: 'manage_components', params: { action: 'get', nodeId: s.root.uuid } },
    { tool: 'update_node_transform', params: { id: s.root.uuid, x: 9 } }
  ] });
  await new Promise(setImmediate); s.expire();
  assert.equal(s.notifications.filter(a => a[0] === 'scene:dirty').length, 1);
  s.api['update-node-transform']({ reply() {} }, { id: s.root.uuid, x: 2 });
  assert.equal(s.notifications.filter(a => a[0] === 'scene:dirty').length, 2);
  assert.ok((await s.run({ operations: [] })).error);
  reply(null, []); const result = await pending;
  assert.match(result.error, /超时/); assert.equal(result.result.executedCount, 2); assert.equal(s.root.x, 2);
  s.api['manage-components'] = original;
  assert.equal((await s.run({ operations: [{ tool: 'update_node_transform', params: { id: s.root.uuid, x: 3 } }] })).error, null);
});

test('主进程auto将100次节点变换合为一次scene IPC，serial仍逐项派发', async () => {
  for (const mode of ['auto', 'serial']) {
    const s = sceneFixture(); let calls = 0;
    const { ToolDispatcher } = loadSource('tools/ToolDispatcher.ts', { Editor: {} }, {
      '../core/CommandQueue': { CommandQueue: { getBlockedReason: () => '', callSceneScriptWithTimeout(pkg, method, args, cb) { calls++; s.api[method]({ reply: cb }, args); } } }
    });
    const result = await new Promise(resolve => ToolDispatcher.batchExecute({ executionMode: mode, operations: Array.from({ length: 100 }, (_, x) => ({ tool: 'update_node_transform', params: { id: s.root.uuid, x } })) }, (error, result) => resolve({ error, result })));
    assert.equal(result.error, null); assert.equal(s.root.x, 99); assert.equal(calls, mode === 'auto' ? 1 : 100);
  }
});

test('结构化组件引用区分同名异UUID，嵌套引用有界且默认摘要保持兼容', () => {
  const { queryComponents } = loadSource('tools/ComponentQuery.ts');
  class Asset {} class Node {} class Component {} class ValueType {}
  const cc = { Asset, Node, Component, ValueType, js: { getClassName: v => v instanceof Asset ? 'cc.SpriteFrame' : 'Custom' } };
  const a = Object.assign(new Asset(), { name: 'same', _uuid: 'asset-a' }), b = Object.assign(new Asset(), { name: 'same', _uuid: 'asset-b' });
  const component = Object.assign(new Component(), { uuid: 'comp', first: a, second: b, nested: [a, { other: b }] });
  const node = { _components: [component] };
  const legacy = queryComponents(node, {}, cc)[0].properties;
  assert.equal(legacy.first, legacy.second);
  const result = queryComponents(node, { referenceMode: 'structured' }, cc)[0].properties;
  assert.equal(result.first.uuid, 'asset-a'); assert.equal(result.second.uuid, 'asset-b'); assert.equal(result.nested[1].other.uuid, 'asset-b');
});

test('依赖检查识别缺失、数据库残留及子资源；截断不会误报通过', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-dependencies-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, 'view.prefab'), texture = path.join(root, 'icon.png');
  fs.writeFileSync(texture, 'image');
  fs.writeFileSync(file, JSON.stringify([{ icon: { __uuid__: 'valid' }, stale: { __uuid__: 'stale' }, missing: { __uuid__: 'missing' } }]));
  const db = { urlToFspath: url => url === 'db://assets' ? root : file, urlToUuid: () => 'view',
    uuidToUrl: id => id === 'missing' ? null : 'db://assets/' + id, uuidToFspath: id => id === 'valid' ? texture + '/frame' : path.join(root, 'deleted.png'),
    isSubAssetByUuid: id => id === 'valid' };
  const { inspectAssetDependencies } = loadSource('tools/AssetDependencies.ts');
  const result = await inspectAssetDependencies({ target: 'db://assets/view.prefab' }, db);
  assert.equal(result.complete, true); assert.equal(result.ok, false); assert.equal(result.missingCount, 2);
  assert.equal(result.dependencies[0].exists, true); assert.equal(result.dependencies[1].resolved, true); assert.equal(result.dependencies[1].exists, false);
  const partial = await inspectAssetDependencies({ target: 'db://assets/view.prefab', limit: 1 }, db);
  assert.equal(partial.truncated, true); assert.equal(partial.ok, false);
  await assert.rejects(inspectAssetDependencies({ target: 'db://assets/../secret.prefab' }, db));
});

test('工具集默认完整，UI裁剪，custom可扩展且连接工具始终可见', () => {
  const { selectToolProfile } = loadSource('tools/ToolProfiles.ts');
  const tools = ['get_project_info', 'create_node', 'manage_script', 'get_active_instances', 'set_active_instance'].map(name => ({ name }));
  assert.equal(selectToolProfile(tools, {}).length, 5);
  assert.equal(selectToolProfile(tools, { MCP_BRIDGE_TOOL_PROFILE: 'ui' }).length, 4);
  assert.equal(selectToolProfile(tools, { MCP_BRIDGE_TOOL_PROFILE: 'custom', MCP_BRIDGE_ENABLED_TOOLS: 'create_node' }).length, 3);
  assert.throws(() => selectToolProfile(tools, { MCP_BRIDGE_TOOL_PROFILE: 'custom' }));
  assert.throws(() => selectToolProfile(tools, { MCP_BRIDGE_ENABLED_TOOLS: 'typo' }));
});

test('调用记录有独立callId，批处理日志有界且保留恢复位置', () => {
  const { CallActivity } = loadSource('core/CallActivity.ts');
  const call = new CallActivity('batch_execute'); call.start();
  const result = call.finish('failed', { results: Array.from({ length: 100 }, () => ({ tool: 'create_node', error: 'x'.repeat(10000) })), executedCount: 100, nextOperationIndex: null });
  assert.equal(result.ok, false); assert.equal(result.logs.length, 50); assert.equal(result.logsOmitted, 52);
  assert.equal(result.executedCount, 100); assert.ok(result.timings.executionMs >= 0);
  assert.notEqual(result.callId, new CallActivity('get_project_info').callId);
});

function screenshotFixture(promiseApi = false) {
  let captures = 0, minimized = false;
  const png = (width, height) => { const bytes = Buffer.alloc(24); Buffer.from([137,80,78,71,13,10,26,10]).copy(bytes); bytes.writeUInt32BE(width, 16); bytes.writeUInt32BE(height, 20); return bytes; };
  const image = (width, height) => ({ getSize: () => ({ width, height }), crop: r => image(r.width, r.height),
    resize: s => image(s.width, s.height), toPNG: () => png(width, height) });
  const bounds = { x: 0, y: 0, width: 500, height: 400 };
  const win = { id: 1, getContentBounds: () => ({ ...bounds }), isVisible: () => true, isMinimized: () => minimized,
    webContents: { id: 2, getZoomFactor: () => 1, getURL: () => 'editor://main' } };
  win.webContents.capturePage = promiseApi ? (() => { captures++; return Promise.resolve(image(1000, 800)); })
    : (reply => { captures++; reply(image(1000, 800)); });
  const Editor = { Window: { main: { nativeWin: win } }, Profile: { load: () => ({ get: () => undefined }) } };
  const { EditorScreenshot: api } = loadSource('tools/EditorScreenshot.ts', { Editor });
  const capture = args => new Promise(resolve => api.capture({ format: 'png', ...args }, (error, result) => resolve({ error, result })));
  return { api, capture, Editor, win, bounds, captures: () => captures, minimize() { minimized = true; } };
}

for (const promiseApi of [false, true]) test(`截图${promiseApi ? 'Promise' : '回调'}API保留图片响应，crop+resize按真实像素校准并拒绝越界`, async () => {
  const s = screenshotFixture(promiseApi);
  const r = await s.capture({ includeMetadata: true, maxWidth: 200, crop: { x: 100, y: 50, width: 400, height: 200 } });
  assert.equal(r.error, null); assert.equal(r.result.imageSize.width, 200); assert.equal(r.result.imageSize.height, 100);
  const mapped = s.api.resolveCoordinates({ captureId: r.result.captureId, points: [{ x: 100, y: 50 }] });
  assert.equal(mapped.points[0].capture.x, 300); assert.equal(mapped.points[0].windowContent.x, 150); assert.equal(mapped.points[0].windowContent.y, 75);
  assert.throws(() => s.api.resolveCoordinates({ captureId: r.result.captureId, points: [{ x: 200, y: 50 }] }));
  assert.match((await s.capture({})).result, /^data:image\/png;base64,/);
  assert.ok((await s.capture({ crop: { x: 900, y: 0, width: 200, height: 100 } })).error);
});

test('截图缓存可辨认，forceFresh产生新ID，写入/窗口替换/窗口变化/最小化使坐标或缓存失效', async () => {
  const s = screenshotFixture(), first = (await s.capture({ includeMetadata: true })).result;
  const cached = (await s.capture({ includeMetadata: true })).result;
  assert.equal(cached.captureId, first.captureId); assert.equal(cached.cached, true); assert.ok(cached.cacheAgeMs >= 0); assert.equal(s.captures(), 1);
  const fresh = (await s.capture({ includeMetadata: true, forceFresh: true })).result;
  assert.notEqual(fresh.captureId, first.captureId); assert.equal(s.captures(), 2);
  const query = { captureId: fresh.captureId, points: [{ x: 1, y: 1 }] };
  s.Editor.Window.main.nativeWin = { ...s.win };
  assert.throws(() => s.api.resolveCoordinates(query), /窗口/); s.Editor.Window.main.nativeWin = s.win;
  s.bounds.width++;
  assert.throws(() => s.api.resolveCoordinates(query), /变化/);
  const resized = (await s.capture({ includeMetadata: true })).result;
  assert.notEqual(resized.captureId, fresh.captureId);
  s.api.invalidate(); assert.throws(() => s.api.resolveCoordinates({ ...query, captureId: resized.captureId }), /失效/);
  await s.capture({}); s.minimize(); assert.ok((await s.capture({ restoreWindow: false })).error);
});

test('截图缺失有效窗口尺寸不承诺坐标可用，60秒后回执过期', async () => {
  const s = screenshotFixture(); s.bounds.width = NaN;
  const r = (await s.capture({ includeMetadata: true })).result;
  assert.equal(r.coordinateMappingAvailable, false);
  assert.throws(() => s.api.resolveCoordinates({ captureId: r.captureId, points: [{ x: 0, y: 0 }] }));
  let now = 0;
  const { CaptureReceipts } = loadSource('tools/CaptureReceipt.ts', { Date: class extends Date { static now() { return now; } } });
  const receipts = new CaptureReceipts();
  const geometry = { windowId: 1, webContentsId: 2, bounds: { width: 500, height: 400 }, zoomFactor: 1, url: 'editor://main' };
  const metadata = receipts.register(s.win, geometry, { width: 1000, height: 800 }, { x: 0, y: 0, width: 1000, height: 800 }, { width: 1000, height: 800 }, 0, true);
  now = 60001;
  assert.throws(() => receipts.resolve({ captureId: metadata.captureId, points: [{ x: 0, y: 0 }] }, 0, s.win), /失效/);
});
