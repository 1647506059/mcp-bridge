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
