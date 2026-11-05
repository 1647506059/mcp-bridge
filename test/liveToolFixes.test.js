const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource, fakeClock } = require('./sourceHarness');

test('删除回执早于磁盘删除时保持锁，文件和meta都消失后才成功', () => {
  const clock = fakeClock(); let exists = true, metadata = true, released = 0, reply = 0;
  const { EditorWriteTools } = loadSource('tools/EditorWriteTools.ts', { ...clock, Editor: { assetdb: { urlToFspath: () => '/asset.png', exists: () => false, delete(urls, done) { done(null); } } } }, {
    fs: { existsSync: file => file.endsWith('.meta') ? metadata : exists },
    '../core/CommandQueue': { CommandQueue: { trackEditorOperation: () => () => released++, blockPending() {} } },
  });
  EditorWriteTools.deleteAsset('db://assets/asset.png', error => { assert.equal(error, null); reply++; });
  assert.equal(reply, 0); assert.equal(released, 0); exists = false; clock.tick(30); assert.equal(reply, 0);
  metadata = false; clock.tick(30); assert.equal(reply, 1); assert.equal(released, 1);
});

test('内置Web平台不受仅列出小游戏的simpleBuildTargets限制，未知平台仍拒绝', () => {
  const { alignWithKnownTargets } = loadSource('utils/resolveBuildPlatform.ts');
  assert.equal(alignWithKnownTargets({ platform: 'web-mobile', actualPlatform: 'web-mobile' }, { wechatgame: {} }).error, undefined);
  assert.ok(alignWithKnownTargets({ platform: 'unknown', actualPlatform: 'unknown' }, { wechatgame: {} }).error);
});

test('跨请求撤销组提交合并，取消回退全部修改并拒绝跨场景操作', () => {
  const { UndoGroups } = loadSource('tools/UndoGroups.ts'); const groups = new UndoGroups(); const scene = {};
  let value = '原始'; const undo = { _undo: { _position: -1, collapseTo(position) { this._position = position; }, _clearRedo() {} }, recordNode() {}, commit() {}, cancel() {}, undo() { this._undo._position--; value = '原始'; } };
  groups.execute('begin_group', { id: 'node' }, scene, () => ({}), undo); value = '修改'; undo._undo._position = 1;
  assert.equal(groups.execute('cancel_group', {}, scene, () => ({}), undo).reverted, 2); assert.equal(value, '原始');
  groups.execute('begin_group', {}, scene, () => ({}), undo); undo._undo._position = 1;
  groups.execute('end_group', {}, scene, () => ({}), undo); assert.equal(undo._undo._position, 0);
  groups.execute('begin_group', {}, scene, () => ({}), undo); assert.throws(() => groups.execute('cancel_group', {}, {}, () => ({}), undo), /场景已变化/);
});
