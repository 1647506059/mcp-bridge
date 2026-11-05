const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadSource } = require('./sourceHarness');
const { runScriptDiagnostics } = loadSource('tools/ScriptDiagnostics.ts', { process });
const { checkAssetReady } = loadSource('tools/AssetReadiness.ts');

test('TS诊断包含文件行列片段，缺失编译器及进程启动失败不能假通过', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-diagnostics-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'tsconfig.json'), '{}'); fs.writeFileSync(path.join(root, 'a.ts'), 'const a: number = "x";');
  assert.equal((await runScriptDiagnostics(root)).status, 'unavailable');
  const result = await runScriptDiagnostics(root, {}, { compiler: 'tsc', execFile(exe, args, options, cb) {
    assert.ok(args.includes('--noEmit')); assert.equal(options.windowsHide, true); assert.equal(options.timeout, 30000);
    cb({ code: 2, message: 'failed' }, 'a.ts(1,7): error TS2322: wrong type', '');
  } });
  assert.equal(result.ok, false); assert.equal(result.diagnostics[0].column, 7); assert.match(result.diagnostics[0].snippet, /const a/);
  assert.equal(result.boundaries.creatorCompilationVerified, false);
  const spawnFailure = await runScriptDiagnostics(root, {}, { compiler: 'tsc', execFile(a,b,c,cb) { cb({ code: 'ENOENT', message: 'missing exe' }, '', ''); } });
  assert.equal(spawnFailure.ok, false); assert.equal(spawnFailure.exitCode, null);
  await assert.rejects(runScriptDiagnostics(root, { tsconfigPath: '../tsconfig.json' }), /当前工程/);
});

test('真实 tsc 能区分类型错误和通过，检查不产生输出文件', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-tsc-real-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { skipLibCheck: true, types: [] }, files: ['a.ts'] }));
  const file = path.join(root, 'a.ts'); fs.writeFileSync(file, 'const x: number = "bad";');
  const runtime = { compiler: require.resolve('typescript/bin/tsc') };
  const bad = await runScriptDiagnostics(root, {}, runtime); assert.equal(bad.ok, false); assert.equal(bad.diagnostics[0].code, 'TS2322');
  fs.writeFileSync(file, 'const x: number = 1;'); assert.equal((await runScriptDiagnostics(root, {}, runtime)).ok, true);
  assert.deepEqual(fs.readdirSync(root).sort(), ['a.ts', 'tsconfig.json']);
});

function db() { return { urlToUuid: () => 'id1', uuidToUrl: () => 'db://assets/a.png', queryInfoByUuid(id, cb) { cb(null, { uuid: id, url: 'db://assets/a.png', type: 'texture' }); } }; }
test('Creator 2.4 主进程仅提供同步 assetInfoByUuid 时也能确认资源身份', async () => {
  const mainDb = db(); delete mainDb.queryInfoByUuid;
  mainDb.assetInfoByUuid = id => ({ uuid: id, url: 'db://assets/a.png', type: 'texture' });
  const ready = await checkAssetReady(mainDb, { target: 'id1' });
  assert.equal(ready.ready, true); assert.equal(ready.stableObservations, 2);
  mainDb.assetInfoByUuid = id => ({ uuid: id, url: 'db://assets/other.png' });
  assert.equal((await checkAssetReady(mainDb, { target: 'id1', waitMs: 0 })).status, 'identity_mismatch');
  delete mainDb.assetInfoByUuid;
  assert.equal((await checkAssetReady(mainDb, { target: 'id1' })).status, 'unavailable');
});
test('资源需要两次稳定观察，零等待/缺失/错误不冒充ready', async () => {
  assert.equal((await checkAssetReady(db(), { target: 'id1' })).ready, true);
  const once = await checkAssetReady(db(), { target: 'id1', waitMs: 0 }); assert.equal(once.ready, false); assert.equal(once.status, 'unconfirmed');
  const missing = db(); missing.urlToUuid = () => null; assert.equal((await checkAssetReady(missing, { target: 'id1', waitMs: 0 })).ready, false);
  const bad = db(); bad.queryInfoByUuid = (id, cb) => cb(new Error('busy')); assert.equal((await checkAssetReady(bad, { target: 'id1' })).status, 'unavailable');
  await assert.rejects(checkAssetReady(db(), { target: 'db://assets/../a.png' }), /target/);
});
test('资源URL在查询期间发生变化不能通过', async () => {
  const changed = db(); changed.queryInfoByUuid = (id, cb) => { changed.uuidToUrl = () => 'db://assets/b.png'; cb(null, { uuid: id, url: 'db://assets/a.png' }); };
  assert.equal((await checkAssetReady(changed, { target: 'id1', waitMs: 0 })).status, 'identity_mismatch');
});
