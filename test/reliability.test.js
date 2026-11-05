const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { EventEmitter } = require('node:events');
const { test } = require('node:test');
const { loadSource, fakeClock } = require('./sourceHarness');
const quiet = { info() {}, warn() {}, error() {}, success() {}, mcp() {} };
function temporary(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-reliability-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root;
}

test('端口重试可取消，旧代 error/listen 回调不能停止或复活新服务', () => {
  const clock = fakeClock(), servers = [], listening = [];
  const { HttpServer: H } = loadSource('core/HttpServer.ts', { ...clock, Editor: {} }, {
    './Logger': { Logger: quiet }, http: { createServer() {
      const server = new EventEmitter(); server.closeCount = 0;
      server.close = () => server.closeCount++;
      server.listen = (port, host, cb) => { server.port = port; server.ready = cb; };
      servers.push(server); return server;
    } },
  });
  H.start(3456, () => {}, port => listening.push(port));
  servers[0].emit('error', { code: 'EADDRINUSE' }); H.stop(); clock.tick(1000);
  assert.equal(servers.length, 1); assert.equal(H.config.active, false);
  H.start(3456, () => {}, port => listening.push(port));
  servers[1].emit('error', { code: 'EADDRINUSE' }); clock.tick(100);
  assert.equal(servers[2].port, 3457); servers[2].ready();
  assert.deepEqual(listening, [3457]); assert.equal(H.config.port, 3457);
  servers[1].emit('error', { code: 'EADDRINUSE' }); servers[1].ready();
  assert.equal(servers[2].closeCount, 0); assert.equal(H.config.active, true);
});

test('插件 unload 取消自动启动，监听成功持久化真实 fallback 端口', () => {
  const clock = fakeClock(), saved = [], calls = []; let listening;
  const main = loadSource('main.ts', { ...clock, Editor: { Profile: { load: () => ({ get: key => key === 'auto-start' ? true : 3456, set: (key, value) => saved.push([key, value]), save() {} }) } } }, {
    './core/HttpServer': { HttpServer: { config: {}, start(port, handler, cb) { calls.push(port); listening = cb; }, stop() {} } },
    './core/Logger': { Logger: { ...quiet, flush: async () => {} } }, './core/McpRouter': { McpRouter: { handleRequest() {} } }, './IpcManager': {},
  });
  main.load(); main.unload(); clock.tick(1000); assert.equal(calls.length, 0);
  main.startServer(3456); listening(3457); assert.deepEqual(saved, [['last-port', 3457]]);
});

test('资源创建拒绝非法路径且无目录死循环，超时保留锁与临时源直到真实回执', () => {
  const clock = fakeClock(), replies = []; let importReply, imports = 0, pending = 0, blocked = '', removed = 0;
  const { AssetPatcher: A } = loadSource('utils/AssetPatcher.ts', {
    ...clock, Editor: { assetdb: { exists: url => url === 'db://assets', import(files, url, cb) { imports++; importReply = cb; } } },
  }, {
    '../core/Logger': { Logger: quiet }, '../core/CommandQueue': { CommandQueue: {
      trackEditorOperation() { pending++; return () => pending--; }, blockPending(reason) { blocked = reason; },
    } }, fs: { mkdirSync() {}, writeFileSync() {}, rmdirSync() { removed++; } },
  });
  for (const url of ['x', 'db://assets/../x', 'db://internal/x', 'db://assets/%2e%2e/x', 'db://assets/a\\b']) A.safeCreateAsset(url, '', (...r) => replies.push(r));
  assert.equal(imports, 0); assert.equal(replies.length, 5);
  replies.length = 0; A.safeCreateAsset('db://assets/a/b.txt', 'ok', (...r) => replies.push(r));
  assert.equal(pending, 1); clock.tick(30000); assert.equal(replies.length, 1); assert.ok(blocked); assert.equal(pending, 1); assert.equal(removed, 0);
  importReply(null, []); importReply(null, []);
  assert.equal(pending, 0); assert.equal(removed, 1); assert.equal(replies.length, 1);
});

test('构建任务区分 building 与终态，失败可查询，重复完成和并发提交被保护', () => {
  const { BuildJobs: J } = loadSource('core/BuildJobs.ts');
  const job = J.begin({ platform: 'bytedance' }); assert.equal(job.completed, false); assert.ok(job.jobId);
  assert.throws(() => J.begin({}), /运行中/);
  J.finish(job.jobId, new Error('builder failed')); J.finish(job.jobId, null, 'duplicate');
  assert.equal(J.get(job.jobId).status, 'failed'); assert.match(J.get(job.jobId).error, /builder failed/);
  assert.equal(J.begin({}).status, 'building'); assert.throws(() => J.get('unknown'), /未知/);
});

test('单调用与批处理共用条件参数/路径校验，保留定制平台和 UUID 外形文本', () => {
  const { validateToolCall } = loadSource('tools/ToolValidation.ts');
  const tools = loadSource('tools/ToolRegistry.ts').getToolsList();
  for (const [name, args] of [['manage_asset', { action: 'move', path: 'db://assets/a.txt' }], ['open_prefab', { url: 'db://assets/../a.prefab' }],
    ['manage_components', { action: 'update', nodeId: 'n' }], ['build_project', { action: 'status' }]]) assert.throws(() => validateToolCall(name, args, tools));
  validateToolCall('build_project', { platform: 'project-custom-platform' }, tools);
  validateToolCall('manage_components', { action: 'update', nodeId: 'n', componentId: 'c', properties: { string: '00000000-0000-0000-0000-000000000099' } }, tools);
});

test('同目录原子替换在提交失败/版本变化时保留旧文件并清临时文件', async t => {
  const root = temporary(t), file = path.join(root, 'config.json'); fs.writeFileSync(file, 'old');
  const { atomicWrite, readBounded } = loadSource('utils/AtomicFile.ts');
  assert.throws(() => atomicWrite(file, 'new', 'stale'), /已变化/); assert.equal(fs.readFileSync(file, 'utf8'), 'old');
  const failed = loadSource('utils/AtomicFile.ts', {}, { fs: { ...fs, renameSync() { throw new Error('locked'); } } });
  assert.throws(() => failed.atomicWrite(file, 'new'), /locked/); assert.equal(fs.readFileSync(file, 'utf8'), 'old');
  assert.deepEqual(fs.readdirSync(root), ['config.json']); atomicWrite(file, 'new', 'old');
  assert.equal((await readBounded(file)).toString(), 'new'); await assert.rejects(readBounded(file, 2), /上限/);
});

test('配置备份失败不改原文件，新备份不覆盖历史副本', t => {
  const root = temporary(t), file = path.join(root, 'config.json'); fs.writeFileSync(file, '{"custom":true}');
  const fixture = loadSource('McpConfigurator.ts', { process }, { fs: { ...fs, copyFileSync() { throw new Error('backup denied'); } } });
  fixture.targetPaths.splice(0, fixture.targetPaths.length, { name: 'fixture', file });
  assert.match(fixture.injectMcpConfig(0), /备份失败/); assert.equal(fs.readFileSync(file, 'utf8'), '{"custom":true}');
  const good = loadSource('McpConfigurator.ts', { process }); good.targetPaths.splice(0, good.targetPaths.length, { name: 'fixture', file });
  good.injectMcpConfig(0); good.injectMcpConfig(0);
  assert.equal(fs.readdirSync(root).filter(name => name.endsWith('.bak')).length, 2); assert.equal(JSON.parse(fs.readFileSync(file)).custom, true);
});

test('构建失败在 staging 内收敛，现有 dist 与清单保持原字节', async () => {
  const { build } = require('../scripts/build');
  const root = path.join(__dirname, '../dist'), before = new Map();
  const walk = dir => { for (const name of fs.readdirSync(dir)) { const file = path.join(dir, name); fs.statSync(file).isDirectory() ? walk(file) : before.set(file, fs.readFileSync(file)); } };
  walk(root); let calls = 0;
  await assert.rejects(build({ bundle: async () => { if (++calls === 2) throw new Error('injected bundle failure'); } }), /injected bundle failure/);
  assert.equal(calls, 2); for (const [file, content] of before) assert.ok(fs.readFileSync(file).equals(content), file);
});

test('忙队列诊断绕过排队，报告 incomplete 和执行阶段而非虚报 matched', () => {
  let result, enqueued = 0;
  const { McpRouter: R } = loadSource('core/McpRouter.ts', { process, Editor: { Project: { path: '/fixture' } } }, {
    './CommandQueue': { CommandQueue: { snapshot: () => ({ processing: true, pending: 1, current: { tool: 'save_prefab', executionMs: 100 } }), getBlockedReason: () => 'pending', enqueue() { enqueued++; } } },
    './Logger': {}, '../tools/ToolRegistry': {}, '../tools/ToolDispatcher': {}, './McpWrappers': {}, './HttpServer': {}, '../IpcManager': {},
  });
  R.handleRequest({ url: '/call-tool', bodyString: '{"name":"get_project_info","arguments":{"includeMcpDiagnostics":true}}' }, { writeHead() {}, end(text) { result = JSON.parse(JSON.parse(text).content[0].text); } });
  assert.equal(enqueued, 0); assert.equal(result.mcpDiagnostics.status, 'incomplete'); assert.equal(result.queue.current.tool, 'save_prefab');
});

test('截图缓存按参数区分、强制刷新；超时迟到图片不污染缓存；读操作不使缓存失效', () => {
  const clock = fakeClock(); let count = 0, late; const replies = [];
  const image = { getSize: () => ({ width: 100, height: 100 }), toPNG: () => Buffer.from('png'), toJPEG: () => Buffer.from('jpeg') };
  const { EditorScreenshot: S, isMutatingCall } = loadSource('tools/EditorScreenshot.ts', { ...clock, Editor: {
    Profile: { load: () => ({ get: () => undefined }) }, Window: { main: { nativeWin: { isVisible: () => true, webContents: { capturePage(cb) { count++; late = cb; } } } } },
  } });
  S.capture({}, (...r) => replies.push(r)); late(image); S.capture({}, (...r) => replies.push(r)); assert.equal(count, 1);
  assert.match(replies[0][1], /^data:image\/png;base64,/);
  S.capture({ forceFresh: true }, (...r) => replies.push(r)); clock.tick(5000); const timedOut = late; timedOut(image);
  S.invalidate(); S.capture({}, (...r) => replies.push(r)); assert.equal(count, 3); late(image);
  S.capture({ format: 'jpeg' }, (...r) => replies.push(r)); assert.equal(count, 4); late(image); assert.match(replies.at(-1)[1], /^data:image\/jpeg/);
  assert.equal(isMutatingCall('manage_components', { action: 'get' }), false); assert.equal(isMutatingCall('manage_asset', { action: 'get_info' }), false);
  assert.equal(isMutatingCall('manage_components', { action: 'update' }), true);
});

test('截图经 HTTP 返回真正 MCP image，保留 text 兼容参数', () => {
  for (const responseMode of ['image', 'text']) {
    let result;
    const { McpRouter: R } = loadSource('core/McpRouter.ts', {}, {
      './Logger': { Logger: quiet }, './CommandQueue': { CommandQueue: { getLength: () => 0, enqueue(fn) { fn(() => {}); return Promise.resolve(); } } },
      '../tools/ToolDispatcher': { ToolDispatcher: { handleMcpCall(n, a, cb) { cb(null, 'data:image/png;base64,cG5n'); } } }, '../tools/ToolRegistry': {}, './McpWrappers': {}, './HttpServer': {}, '../IpcManager': {},
    });
    R.handleRequest({ url: '/call-tool', bodyString: JSON.stringify({ name: 'capture_editor_screenshot', arguments: { responseMode } }) }, { writeHead() {}, end(text) { result = JSON.parse(text); } });
    assert.equal(result.content[0].type, responseMode); if (responseMode === 'image') assert.equal(result.content[0].mimeType, 'image/png');
  }
});

test('100 个大结果受预算约束，明确执行进度；summary 模式仍保留后续 $ref', async () => {
  const { executeBatch } = loadSource('tools/BatchOperations.ts');
  const tools = [{ name: 'probe', inputSchema: { type: 'object', properties: {} } }];
  let executed = 0;
  const r = await new Promise(resolve => executeBatch({ operations: Array.from({ length: 100 }, () => ({ tool: 'probe', params: {} })) }, tools,
    (name, args, cb) => { executed++; cb(null, '中'.repeat(400 * 1024)); }, (error, result) => resolve({ error, result })));
  assert.ok(r.error); assert.ok(executed < 100); assert.equal(r.result.executedCount, executed); assert.ok(JSON.stringify(r).length < 3 * 1024 * 1024);
  const summary = await new Promise(resolve => executeBatch({ outputMode: 'summary', operations: [{ id: 'a', tool: 'probe', params: {} }, { tool: 'probe', params: { value: { $ref: 'a.uuid' } } }] }, tools,
    (name, args, cb) => { if (args.value) assert.equal(args.value, 'retained'); cb(null, { uuid: 'retained' }); }, (err, result) => resolve({ err, result })));
  assert.equal(summary.err, null); assert.equal(summary.result.length, 2);
});

test('场景分页保持旧数组，游标在结果/状态变化后拒绝，扫描超预算明确失败', () => {
  const { sceneQuery } = loadSource('tools/SceneQuery.ts');
  const root = { uuid: 'root', name: 'Root', children: [], _components: [] };
  const query = args => { const q = sceneQuery(args, root, 'nodes'); q.check(root); q.results.push({ uuid: '1' }, { uuid: '2' }); return q.finish(); };
  assert.equal(query({}).length, 2);
  const a = query({ pageSize: 1 }), b = query({ pageSize: 1, cursor: a.nextCursor }); assert.equal(b.results[0].uuid, '2');
  root.name = 'Changed'; assert.throws(() => query({ pageSize: 1, cursor: a.nextCursor }), /变化/);
  const q = sceneQuery({ maxVisited: 1 }, root, 'nodes'); q.check(root); q.check(root); assert.throws(() => q.finish(), /预算/);
  const huge = sceneQuery({}, root, "nodes"); huge.add({ name: "x".repeat(1000000) }); assert.throws(() => huge.finish(), /预算/);
});

test('复杂对象摘要不调用 getter/toJSON，循环与巨量字段有界', () => {
  const { boundedValue } = loadSource('utils/BoundedValue.ts'); let calls = 0;
  const object = { text: '中'.repeat(1000000), get dangerous() { calls++; return 'bad'; }, toJSON() { calls++; throw new Error('bad'); } }; object.loop = object;
  const r = boundedValue(object, 500); assert.equal(calls, 0); assert.equal(r.truncated, true); assert.ok(JSON.stringify(r.value).length < 600);
  const sparse = []; sparse[100000000] = 'last';
  const bounded = boundedValue(sparse, 1024); assert.equal(bounded.truncated, true); assert.ok(JSON.stringify(bounded.value).length < 1024);
  const key = { ['x'.repeat(1000000)]: 'value' }; assert.equal(boundedValue(key, 1024).truncated, true);
});

test('病态正则被硬超时中断，目录分页复用元数据且文件内容仍重新读取', async t => {
  const root = temporary(t); fs.writeFileSync(path.join(root, 'a.txt'), 'a'.repeat(30000) + '!');
  let directories = 0;
  const { searchProject } = loadSource('tools/ProjectSearch.ts', {}, { fs: { ...fs, promises: { ...fs.promises, readdir(...args) { directories++; return fs.promises.readdir(...args); } } } });
  const started = Date.now(); await assert.rejects(searchProject({ query: '(a+)+$', useRegex: true }, root, root), /正则表达式执行超时/); assert.ok(Date.now() - started < 1500);
  fs.writeFileSync(path.join(root, 'a.txt'), 'hit\nhit\nhit');
  const first = await searchProject({ query: 'hit', pageSize: 1 }, root, root); const count = directories;
  const second = await searchProject({ query: 'hit', pageSize: 1, cursor: first.nextCursor }, root, root);
  assert.equal(second.results[0].line, 2); assert.equal(directories, count);
});


test('main 使用构建器终态回调，不等待无回执的 start-task IPC', () => {
  let doneBuild, response; const calls = [];
  const main = loadSource('main.ts', { Editor: { log() {}, warn() {}, error() {}, Project: { path: '/fixture' }, Builder: { simpleBuildTargets: { 'web-mobile': { isNative: false } }, build(options, cb) { calls.push('Builder.build'); assert.equal(options.startScene, 'scene'); doneBuild = cb; } }, Ipc: {
    sendToMain(name, ...args) { calls.push(name); const cb = args.at(-1); if (name === 'builder:query-build-options') cb(null, { platform: 'web-mobile', scenes: ['scene'], startScene: 'scene', buildPath: 'build' }); }
  } } });
  const event = { reply(err, value) { response = { err, value }; } };
  main.messages['build-project'](event, { platform: 'web-mobile', debug: true });
  assert.equal(response.err, null); assert.equal(response.value.status, 'building'); const id = response.value.jobId;
  assert.equal(response.value.actualPlatform, 'web-mobile'); assert.equal(response.value.completed, false);
  doneBuild(new Error('builder terminal failure')); main.messages['build-project'](event, { action: 'status', jobId: id });
  assert.equal(response.value.status, 'failed'); assert.equal(response.value.completed, true); assert.match(response.err.message, /builder terminal failure/);
  assert.equal(calls.filter(x => x === 'builder:start-task').length, 0);
  main.messages['build-project'](event, { platform: 'web-mobile', debug: false }); const successId = response.value.jobId;
  assert.equal(response.value.status, 'building'); doneBuild(null);
  main.messages['build-project'](event, { action: 'status', jobId: successId });
  assert.equal(response.err, null); assert.equal(response.value.status, 'succeeded'); assert.equal(response.value.completed, true);
  assert.equal(calls.filter(x => x === 'Builder.build').length, 2);
});

test('构建选项缺 scenes 时补齐未排除场景，起始场景缺失时不启动构建', () => {
  let response, built; const options = { platform: 'web-mobile', scenes: [], startScene: 'load', excludeScenes: ['test'], buildPath: 'build' };
  const main = loadSource('main.ts', { Editor: { log() {}, warn() {}, error() {}, Project: { path: '/fixture' },
    assetdb: { queryAssets(pattern, type, cb) { assert.equal(type, 'scene'); cb(null, ['load','game','test'].map(uuid=>({uuid}))); } },
    Builder: { simpleBuildTargets: { 'web-mobile': { isNative: false } }, build(value, cb) { built = value; cb(null); } },
    Ipc: { sendToMain(name, cb) { assert.equal(name, 'builder:query-build-options'); cb(null, options); } }
  } });
  const event = { reply(err, value) { response = { err, value }; } };
  main.messages['build-project'](event, { platform: 'web-mobile' });
  assert.equal(response.err, null); assert.deepEqual(JSON.parse(JSON.stringify(built.scenes)), ['load','game']);
  assert.equal(response.value.status, 'succeeded');
  options.startScene = 'missing'; built = null;
  main.messages['build-project'](event, { platform: 'web-mobile' });
  assert.equal(built, null); assert.match(response.err.message, /起始场景不在/);
});

test('控制台增量游标无重复，缓冲淘汰显式报告丢失', () => {
  const { Logger: L } = loadSource('core/Logger.ts');
  L.remember({ type: 'info', content: 'one' }); L.remember({ type: 'error', content: 'two' });
  const first = L.page({ limit: 1 }), second = L.page({ cursor: first.nextCursor, limit: 1 });
  assert.equal(first.entries[0].content, 'one'); assert.equal(second.entries[0].content, 'two');
  assert.equal(L.page({ cursor: second.nextCursor }).entries.length, 0);
  for (let i = 0; i < 2001; i++) L.remember({ type: 'info', content: 'next' });
  assert.equal(L.page({ cursor: first.nextCursor }).lostEntries, true);
});


test('异步读取遇到并发截短明确拒绝，避免以半文件做后续编辑依据', async () => {
  const { readBounded } = loadSource('utils/AtomicFile.ts', {}, { fs: {
    open(file, flag, cb) { cb(null, 1); }, fstat(fd, cb) { cb(null, { size: 4, mtimeMs: 1, ctimeMs: 1 }); },
    read(fd, data, start, length, offset, cb) { if (!offset) { data.write('ab'); cb(null, 2); } else cb(null, 0); }, close(fd, cb) { cb(); }
  } });
  await assert.rejects(readBounded('fixture'), /已变化/);
});
