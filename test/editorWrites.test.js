const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource, fakeClock } = require('./sourceHarness');

test('独立重命名也等待存在确认与名称读回，保留Undo消息并传播失败', () => {
  let readReply, pending = 0, blocked = ''; const sent = [], replies = [], clock = fakeClock();
  const { EditorWriteTools } = loadSource('tools/EditorWriteTools.ts', {
    ...clock, Editor: { Ipc: { sendToPanel: (...args) => sent.push(args) } },
  }, { '../core/CommandQueue': { CommandQueue: { getBlockedReason: () => blocked,
    blockPending: reason => blocked = reason, trackEditorOperation: () => { pending++; return () => pending--; },
    callSceneScriptWithTimeout(pkg, method, args, cb) { assert.equal(method, 'get-node-name'); readReply = cb; } } } });
  const rename = id => EditorWriteTools.rename({ id, newName: 'confirmed' }, (...r) => replies.push(r));
  rename('node'); assert.equal(sent.length, 0); assert.equal(replies.length, 0);
  readReply(null, { name: 'before' }); assert.equal(sent[0][1], 'scene:set-property'); assert.equal(replies.length, 0);
  readReply(null, { name: 'confirmed' }); assert.equal(replies[0][0], null);
  rename('missing'); readReply(new Error('node missing')); assert.match(String(replies[1][0]), /node missing/); assert.equal(sent.length, 1);
  rename('node'); readReply(null, { name: 'before' }); readReply(null, { name: 'unchanged' });
  assert.equal(replies.length, 2); clock.tick(100); readReply(null, { name: 'confirmed' });
  assert.equal(replies[2][0], null); assert.equal(pending, 0);
  rename('slow'); readReply(null, { name: 'before' }); clock.tick(15000);
  assert.match(String(replies[3][0]), /尚未确认/); assert.ok(blocked); assert.equal(pending, 1);
  readReply(null, { name: 'confirmed' }); assert.equal(replies.length, 4); assert.equal(pending, 0);
});

test('重命名预查期间队列超时后不再发出写入消息', () => {
  let readReply, blocked = '', wrote = false, error;
  const { EditorWriteTools } = loadSource('tools/EditorWriteTools.ts', {
    Editor: { Ipc: { sendToPanel() { wrote = true; } } },
  }, { '../core/CommandQueue': { CommandQueue: { getBlockedReason: () => blocked,
    callSceneScriptWithTimeout(pkg, method, args, cb) { readReply = cb; } } } });
  EditorWriteTools.rename({ id: 'node', newName: 'x' }, err => error = err);
  blocked = 'operation timed out'; readReply(null, { name: 'before' });
  assert.equal(wrote, false); assert.equal(error, blocked);
});

test('离线落盘后的刷新等待真实回执，失败不报同步成功，重复回执只完成一次', () => {
  for (const fail of [false, true]) {
    let refreshReply, finished = 0; const replies = [];
    const { EditorWriteTools } = loadSource('tools/EditorWriteTools.ts', {
      Editor: { assetdb: { refresh(url, cb) { refreshReply = cb; } } },
    }, { '../core/CommandQueue': { CommandQueue: { trackEditorOperation: () => () => finished++ } } });
    EditorWriteTools.refreshAfterWrite('db://assets/test.prefab', (...r) => replies.push(r));
    assert.equal(replies.length, 0); assert.equal(finished, 0);
    refreshReply(fail ? new Error('refresh failed') : null); refreshReply(null);
    assert.equal(replies.length, 1); assert.equal(finished, 1);
    if (fail) assert.match(replies[0][0], /已落盘.*同步失败.*refresh failed/);
    else { assert.equal(replies[0][0], null); assert.match(replies[0][1], /AssetDB 已同步/); }
  }
});

test('AssetDB迟到回执前保持队列锁，60秒超时不让后续写操作越过', async () => {
  const clock = fakeClock(); let refreshReply, completed = false;
  const { CommandQueue } = loadSource('core/CommandQueue.ts', clock, { './Logger': { Logger: { error() {}, warn() {} } } });
  const { EditorWriteTools } = loadSource('tools/EditorWriteTools.ts', {
    ...clock, Editor: { assetdb: { refresh(url, cb) { refreshReply = cb; } } },
  }, { '../core/CommandQueue': { CommandQueue } });
  const active = CommandQueue.enqueue(done => EditorWriteTools.refreshAfterWrite('db://assets/test.prefab', () => { completed = true; done(); }));
  const waiting = CommandQueue.enqueue(() => assert.fail('must not run')).catch(err => err);
  clock.tick(60000); await active; assert.equal(completed, false); assert.ok(await waiting);
  await assert.rejects(CommandQueue.enqueue(() => assert.fail()), /超时/);
  refreshReply(null); assert.equal(completed, true);
  await CommandQueue.enqueue(done => done());
});

function prefabHarness(mode = 'scene') {
  const clock = fakeClock(), calls = [], replies = [];
  let sceneReply, refreshReply, content = '[{"__type__":"cc.Prefab"}]', stamp = 1, pending = 0, blocked = '';
  const queue = {
    getBlockedReason: () => blocked,
    blockPending(reason) { blocked = reason; },
    trackEditorOperation() { pending++; return () => pending--; },
    callSceneScriptWithTimeout(pkg, method, args, cb) { calls.push(method); sceneReply = cb; },
  };
  const { EditorWriteTools } = loadSource('tools/EditorWriteTools.ts', {
    ...clock, Editor: {
      Ipc: { sendToPanel: (...args) => calls.push(args) },
      assetdb: { urlToUuid: () => 'asset', urlToFspath: () => 'test.prefab', refresh(url, cb) { refreshReply = cb; } },
    },
  }, {
    '../core/CommandQueue': { CommandQueue: queue },
    fs: { readFileSync: () => content, statSync: () => ({ mtimeMs: stamp, size: content.length }) },
  });
  return {
    clock, calls, replies, queue, pending: () => pending,
    start: () => EditorWriteTools.updatePrefab({ path: 'db://assets/test.prefab', nodeId: 'root' }, (...r) => replies.push(r)),
    state: (overrides = {}) => sceneReply(null, { rootId: 'root', assetUuid: 'asset', mode, activePrefabUuid: 'asset', ...overrides }),
    sceneDone: err => sceneReply(err), refresh: err => refreshReply(err),
    write(value) { content = value; stamp++; },
  };
}

test('预制体更新拒绝错误主体，预制体模式等待保存与AssetDB双回执', () => {
  for (const mismatch of [{ rootId: 'child' }, { assetUuid: 'other' }, { activePrefabUuid: 'other' }]) {
    const h = prefabHarness('prefab'); h.start(); h.state(mismatch);
    assert.equal(h.replies.length, 1); assert.ok(h.replies[0][0]); assert.equal(h.calls.length, 1);
  }
  const h = prefabHarness('prefab'); h.start(); h.state();
  assert.equal(h.calls[1], 'save-prefab'); assert.equal(h.replies.length, 0);
  h.sceneDone(null); assert.equal(h.replies.length, 0); assert.equal(h.pending(), 1);
  h.refresh(null); assert.equal(h.replies[0][0], null); assert.equal(h.pending(), 0);
});

test('场景实例使用标准apply消息，完整文件稳定且刷新完成后才返回', () => {
  const h = prefabHarness(); h.start(); h.state();
  assert.equal(JSON.stringify(h.calls[1]), JSON.stringify(['scene', 'scene:apply-prefab', 'root']));
  h.clock.tick(200); assert.equal(h.replies.length, 0);
  h.write('[{"__type__":'); h.clock.tick(200); assert.equal(h.replies.length, 0);
  h.write('[{"__type__":"cc.Prefab","value":2}]'); h.clock.tick(200);
  assert.equal(h.replies.length, 0); h.clock.tick(200);
  assert.equal(h.pending(), 2); assert.equal(h.replies.length, 0);
  h.refresh(null); assert.equal(h.replies.length, 1); assert.equal(h.replies[0][0], null); assert.equal(h.pending(), 0);
});

test('应用相同内容时也接受编辑器实际重写后的稳定回执，不要求内容哈希变化', () => {
  const h = prefabHarness(); h.start(); h.state();
  h.write('[{"__type__":"cc.Prefab"}]'); h.clock.tick(400); h.refresh(null);
  assert.equal(h.replies.length, 1); assert.equal(h.replies[0][0], null); assert.equal(h.pending(), 0);
});

test('预制体落盘超时不重放，保留锁直到迟到的真实完成且仅回复一次', () => {
  const h = prefabHarness(); h.start(); h.state(); h.clock.tick(30000);
  assert.match(h.replies[0][0], /超时.*未确认/); assert.ok(h.queue.getBlockedReason()); assert.equal(h.pending(), 1);
  h.write('[{"__type__":"cc.Prefab","late":true}]'); h.clock.tick(2000); h.refresh(null);
  assert.equal(h.replies.length, 1); assert.equal(h.pending(), 0);
  assert.equal(h.calls.filter(Array.isArray).length, 1);
});


function assetDeletionFixture(initial = 'watch-on', requested = ['db://assets/probe.txt']) {
  const clock = fakeClock(), calls = [], replies = [], disk = new Set();
  const registered = new Set(requested);
  let state = initial, released = 0, blocked = '', deleteReply, autoReply = true, failed = null;
  const file = url => '/project/assets/' + url.slice('db://assets/'.length);
  for (const url of requested) { disk.add(file(url)); disk.add(file(url) + '.meta'); }
  const db = {
    exists: url => registered.has(url), urlToFspath: file,
    getWatchState: () => state,
    watchOFF() { calls.push('pause'); state = 'watch-stopping'; clock.setTimeout(() => state = 'watch-off', 40); },
    watchON() { calls.push('resume'); state = 'watch-starting'; clock.setTimeout(() => state = 'watch-on', 20); },
    delete(urls, callback) {
      calls.push({ urls: [...urls], state });
      deleteReply = error => {
        if (!error) for (const url of [...registered]) if (urls.some(root => url === root || url.startsWith(root + '/'))) registered.delete(url);
        callback(error);
      };
      if (autoReply) deleteReply(failed);
    },
  };
  const { EditorWriteTools } = loadSource('tools/EditorWriteTools.ts', { ...clock, Editor: { assetdb: db } }, {
    fs: { existsSync: name => disk.has(name) },
    '../core/CommandQueue': { CommandQueue: { trackEditorOperation: () => () => released++, blockPending: reason => blocked = reason } },
  });
  return { clock, calls, replies, disk, file, db, requested, EditorWriteTools,
    start: () => EditorWriteTools.deleteAssets(requested, (...args) => replies.push(args)),
    single: () => EditorWriteTools.deleteAsset(requested[0], (...args) => replies.push(args)),
    removed: () => disk.clear(), released: () => released, blocked: () => blocked,
    holdReply: () => autoReply = false, reply: error => deleteReply(error), fail: error => failed = error,
    state: value => state = value,
  };
}

test('后台监听先暂停再删除，磁盘和meta完成后恢复快照，最后才释放执行锁', () => {
  const f = assetDeletionFixture(); f.single();
  assert.deepEqual(f.calls, ['pause']); // 旧实现会在 watch-on 时立即删除，留下过期快照。
  f.clock.tick(60);
  assert.deepEqual(f.calls[1], { urls: f.requested, state: 'watch-off' });
  assert.equal(f.replies.length, 0); assert.equal(f.released(), 0);
  f.disk.delete(f.file(f.requested[0])); f.clock.tick(30);
  assert.equal(f.calls.includes('resume'), false); // .meta 尚未移出。
  f.removed(); f.clock.tick(30);
  assert.equal(f.calls.at(-1), 'resume'); assert.equal(f.replies.length, 0);
  f.clock.tick(30);
  assert.equal(f.replies.length, 1); assert.equal(f.replies[0][0], null); assert.equal(f.released(), 1);
});

test('批量路径去重并合并父子目录，只进行一次原生删除与监听切换', () => {
  const f = assetDeletionFixture('watch-on', ['db://assets/folder/child.txt', 'db://assets/folder', 'db://assets/other.txt', 'db://assets/other.txt']);
  f.start(); f.clock.tick(60); f.removed(); f.clock.tick(100);
  const native = f.calls.filter(x => typeof x === 'object');
  assert.equal(native.length, 1);
  assert.deepEqual(native[0].urls, ['db://assets/folder', 'db://assets/other.txt']);
  assert.equal(f.calls.filter(x => x === 'pause').length, 1);
  assert.equal(f.calls.filter(x => x === 'resume').length, 1);
});

test('原监听已关闭时维持关闭，原生失败也恢复原先开启的监听', () => {
  const off = assetDeletionFixture('watch-off'); off.start(); off.removed(); off.clock.tick(30);
  assert.equal(off.calls.filter(x => typeof x === 'string').length, 0);
  assert.equal(off.replies[0][0], null);
  const on = assetDeletionFixture(); on.fail(new Error('delete failed')); on.start(); on.clock.tick(100);
  assert.equal(on.replies.length, 1); assert.match(String(on.replies[0][0]), /delete failed/);
  assert.equal(on.calls.at(-1), 'resume'); assert.equal(on.released(), 1);
});

test('暂停监听期间超时，迟到的暂停回执不能继续执行删除', () => {
  const f = assetDeletionFixture(); f.db.watchOFF = () => f.state('watch-stopping'); f.start(); f.clock.tick(30000);
  assert.equal(f.replies.length, 1); assert.ok(f.blocked()); assert.equal(f.released(), 0);
  f.state('watch-off'); f.clock.tick(1000);
  assert.equal(f.calls.filter(x => typeof x === 'object').length, 0);
  assert.equal(f.replies.length, 1); assert.equal(f.released(), 1);
});

test('删除回执迟到时保留锁，真实完成和监听恢复后释放且不重复回复', () => {
  const f = assetDeletionFixture(); f.holdReply(); f.start(); f.clock.tick(30000);
  assert.equal(f.replies.length, 1); assert.equal(f.released(), 0);
  f.removed(); f.reply(null); f.clock.tick(1000);
  assert.equal(f.replies.length, 1); assert.equal(f.released(), 1); assert.equal(f.calls.at(-1), 'resume');
});

test('整个批次预检失败时不暂停监听，也不部分删除', () => {
  for (const bad of ['db://assets', 'db://assets/../secret', 'db://assets/missing.txt']) {
    const f = assetDeletionFixture('watch-on', ['db://assets/probe.txt']);
    f.EditorWriteTools.deleteAssets([f.requested[0], bad], error => f.replies.push([error]));
    assert.equal(f.calls.length, 0); assert.ok(f.replies[0][0]); assert.equal(f.released(), 0);
  }
});

test('批量删除入口保持项目凭证、路径校验和数量边界', () => {
  const { getToolsList } = loadSource('tools/ToolRegistry.ts');
  const { validateToolCall } = loadSource('tools/ToolValidation.ts');
  const { selectToolProfile } = loadSource('tools/ToolProfiles.ts');
  const tools = getToolsList(), tool = tools.find(item => item.name === 'delete_assets');
  assert.equal(tool.category, 'assets'); assert.equal(tool.annotations.readOnlyHint, false);
  assert.ok(tool.inputSchema.properties.expected_context);
  assert.equal(tool.aliasFor, 'manage_asset');
  assert.ok(!selectToolProfile(tools, { MCP_BRIDGE_TOOL_ACTIONS: JSON.stringify({ manage_asset: ['get_info'] }) }).some(item => item.name === 'delete_assets'));
  validateToolCall('delete_assets', { paths: ['db://assets/probe.txt'] }, tools);
  validateToolCall('manage_asset', { action: 'delete', paths: ['db://assets/probe.txt'] }, tools);
  assert.ok(tools.find(item => item.name === 'create_asset').inputSchema.required.includes('path'));
  assert.throws(() => validateToolCall('manage_asset', { action: 'create' }, tools));
  assert.throws(() => validateToolCall('manage_asset', { action: 'create', paths: ['db://assets/probe.txt'] }, tools));
  for (const paths of [[], ['db://assets'], ['db://assets/../secret'], Array(501).fill('db://assets/probe.txt')]) {
    assert.throws(() => validateToolCall('delete_assets', { paths }, tools));
  }
});
