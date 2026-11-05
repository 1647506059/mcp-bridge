const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { test } = require('node:test');
const { loadSource } = require('./sourceHarness');

const build = { version: '1.3.4', buildId: 'a'.repeat(64), builtAt: '2026-10-16T00:00:00.000Z' };
const globals = { __MCP_BRIDGE_BUILD__: { ...build }, process: { pid: 456 } };
const { composeDiagnostics } = loadSource('core/BuildInfo.ts', globals);

test('运行时身份固定在加载时，不能被后续文件或元数据改动冒充', () => {
  let diskManifest = { ...build }, diskReads = 0;
  const runtime = loadSource('core/BuildInfo.ts', globals, {
    fs: { existsSync: () => true, readFileSync() { diskReads++; return JSON.stringify(diskManifest); } },
  });
  const a = runtime.getRuntimeInfo('proxy', '/loaded/proxy.js');
  diskManifest = { ...build, buildId: 'replacement-on-disk' };
  assert.equal(Object.isFrozen(globals.__MCP_BRIDGE_BUILD__), true);
  assert.equal(Reflect.set(globals.__MCP_BRIDGE_BUILD__, 'buildId', 'changed'), false);
  assert.equal(runtime.getRuntimeInfo('proxy', '/loaded/proxy.js').buildId, build.buildId);
  assert.equal(diskReads, 0, '运行时不能重新读取后来替换的磁盘清单');
  assert.equal(a.pid, 456); assert.equal(a.entryPath, '/loaded/proxy.js'); assert.ok(a.loadedAt);
  const unbundled = loadSource('core/BuildInfo.ts', { process: { pid: 1 } }).getRuntimeInfo('scene', '/source');
  assert.equal(unbundled.buildId, 'unbundled');
});

test('同版本不同构建不能误报一致，缺失信息也不能当成通过', () => {
  assert.equal(composeDiagnostics(build, build, build).status, 'matched');
  assert.equal(composeDiagnostics(build, { ...build, buildId: 'b'.repeat(64) }, build).status, 'mismatch');
  assert.equal(composeDiagnostics(build, build, null).status, 'incomplete');
  assert.equal(composeDiagnostics(build, { buildId: 'unbundled' }, build).status, 'incomplete');
  assert.ok(composeDiagnostics(build, null, build, 'scene not ready').issues.some(s => s.includes('scene not ready')));
});

test('场景脚本和 HTTP 状态报告各自已加载的身份', () => {
  const scene = loadSource('scene-script.ts', { __MCP_BRIDGE_BUILD__: build, process: { pid: 10 } });
  let result;
  scene['get-mcp-runtime-info']({ reply(err, value) { assert.equal(err, null); result = value; } });
  assert.equal(result.role, 'scene'); assert.equal(result.buildId, build.buildId); assert.equal(result.pid, 10);
  const { McpRouter } = loadSource('core/McpRouter.ts', { __MCP_BRIDGE_BUILD__: build, process: { pid: 20 }, global: { Editor: { Project: { path: '/project' } } } }, {
    './Logger': {}, './CommandQueue': {}, '../tools/ToolRegistry': {}, '../tools/ToolDispatcher': {},
    './McpWrappers': {}, './HttpServer': { HttpServer: { config: { port: 3456 } } }, '../IpcManager': {},
  });
  McpRouter.handleRequest({ url: '/mcp-status' }, { writeHead() {}, end(text) { result = JSON.parse(text); } });
  assert.equal(result.projectPath, '/project'); assert.equal(result.port, 3456); assert.equal(result.mcp.role, 'editor');
  assert.equal(result.mcp.buildId, build.buildId); assert.equal(result.mcp.pid, 20);
});

test('默认项目查询不增加 IPC，诊断等待场景回执并准确报告缺失', () => {
  let sceneReply, result; const calls = [];
  const { ToolDispatcher } = loadSource('tools/ToolDispatcher.ts', {
    __MCP_BRIDGE_BUILD__: build, process: { pid: 30 },
    Editor: { Ipc: { sendToMain(channel, args, cb) { cb(null, { path: '/project', version: '2.4.15' }); } } },
  }, {
    '../core/Logger': {}, '../utils/AssetPatcher': {}, '../utils/OfflinePrefabEditor': {}, '../core/McpWrappers': {}, './EditorSceneTools': {},
    '../core/CommandQueue': { CommandQueue: { getBlockedReason: () => '', callSceneScriptWithTimeout(pkg, method, args, cb) { calls.push(method); sceneReply = cb; } } },
  });
  const callback = (err, value) => { assert.equal(err, null); result = value; };
  ToolDispatcher.handleMcpCall('get_project_info', {}, callback);
  assert.deepEqual(result, { path: '/project', version: '2.4.15' }); assert.equal(calls.length, 0);
  result = undefined;
  ToolDispatcher.handleMcpCall('get_project_info', { includeMcpDiagnostics: true }, callback);
  assert.equal(result, undefined); assert.equal(calls[0], 'get-mcp-runtime-info');
  sceneReply(new Error('scene not ready'));
  assert.equal(result.mcpDiagnostics.status, 'incomplete'); assert.equal(result.mcpDiagnostics.editor.buildId, build.buildId);
  assert.ok(result.mcpDiagnostics.issues.some(s => s.includes('scene not ready')));
});

test('构建 ID 可复现且随源码变化，CRLF/LF 与构建时间不改变源码身份', t => {
  const { createBuildInfo } = require('../scripts/build');
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-build-identity-'));
  t.after(() => {
    assert.equal(path.dirname(fixture), path.resolve(os.tmpdir()));
    assert.ok(path.basename(fixture).startsWith('mcp-build-identity-'));
    fs.rmSync(fixture, { recursive: true, force: true });
  });
  fs.mkdirSync(path.join(fixture, 'src')); fs.mkdirSync(path.join(fixture, 'scripts')); fs.mkdirSync(path.join(fixture, 'panel'));
  const template = path.join(fixture, 'panel/index.html'); fs.writeFileSync(template, '<div>overview</div>\n');
  const style = path.join(fixture, 'panel/index.css'); fs.writeFileSync(style, ':host { color: white; }\n');
  fs.writeFileSync(path.join(fixture, 'package.json'), '{"version":"1.3.4"}');
  fs.writeFileSync(path.join(fixture, 'scripts/build.js'), 'builder\n');
  const source = path.join(fixture, 'src/main.ts'); fs.writeFileSync(source, 'const x = 1;\n');
  const first = createBuildInfo(fixture);
  assert.match(first.buildId, /^[a-f0-9]{64}$/); assert.equal(createBuildInfo(fixture).buildId, first.buildId);
  fs.writeFileSync(source, 'const x = 1;\r\n'); assert.equal(createBuildInfo(fixture).buildId, first.buildId);
  fs.writeFileSync(source, 'const x = 2;\n'); assert.notEqual(createBuildInfo(fixture).buildId, first.buildId);
  const changed = createBuildInfo(fixture).buildId;
  fs.writeFileSync(template, '<div>settings</div>\n'); assert.notEqual(createBuildInfo(fixture).buildId, changed);
  const changedTemplate = createBuildInfo(fixture).buildId;
  fs.writeFileSync(style, ':host { color: gray; }\n'); assert.notEqual(createBuildInfo(fixture).buildId, changedTemplate);
});
