const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource } = require('./sourceHarness');
const crypto = require('node:crypto');

function editFixture(source = 'abcdef') {
  const writes = [], refreshes = [], replies = [];
  const { ToolDispatcher } = loadSource('tools/ToolDispatcher.ts', {
    Editor: { assetdb: { urlToFspath: () => '/memory.txt', refresh: (p, cb) => { refreshes.push(p); cb(null); } } },
  }, {
    fs: { existsSync: () => true },
    '../utils/AtomicFile': { readBounded: async () => Buffer.from(source), atomicWrite: (p, text) => writes.push(text) },
    '../core/Logger': {}, '../utils/AssetPatcher': {}, '../utils/OfflinePrefabEditor': {},
    '../core/CommandQueue': {}, '../core/McpWrappers': {}, './EditorSceneTools': {},
  });
  return { writes, refreshes, replies, async apply(edits, extra = {}) {
    await ToolDispatcher.applyTextEdits({ filePath: 'db://assets/probe.txt', edits, ...extra }, (...r) => replies.push(r));
  } };
}

test('无效偏移、范围、类型及重叠编辑整批拒绝，不落盘也不刷新', async () => {
  for (const edits of [[], [{ type: 'insert', position: -1, text: 'x' }],
    [{ type: 'replace', start: 0, end: 7, text: 'x' }], [{ type: 'delete', start: 4, end: 2 }],
    [{ type: 'insert', position: 1.5, text: 'x' }], [{ type: 'insert', position: 2 }],
    [{ type: 'unknown' }], [{ type: 'delete', start: 0, end: 3 }, { type: 'insert', position: 1, text: 'x' }],
    [{ type: 'replace', start: 0, end: 3, text: 'x' }, { type: 'delete', start: 2, end: 5 }],
    [{ type: 'insert', position: 1, text: 'x' }, { type: 'insert', position: 1, text: 'y' }],
  ]) {
    const s = editFixture(); await s.apply(edits); assert.ok(s.replies[0][0], JSON.stringify(edits));
    assert.deepEqual(s.writes, []); assert.deepEqual(s.refreshes, []);
  }
});

test('SHA 不一致或格式错误拒绝写入；匹配时按原始偏移同时编辑', async () => {
  const sha = crypto.createHash('sha256').update('abcdef').digest('hex');
  for (const expectedSha of ['0'.repeat(64), 'invalid']) {
    const s = editFixture(); await s.apply([{ type: 'insert', position: 6, text: '!' }], { expectedSha });
    assert.ok(s.replies[0][0]); assert.deepEqual(s.writes, []);
  }
  const s = editFixture(); await s.apply([{ type: 'delete', start: 0, end: 1 }, { type: 'replace', start: 1, end: 2, text: 'B' },
    { type: 'insert', position: 6, text: '!' }], { expectedSha: sha });
  assert.equal(s.replies[0][0], null); assert.deepEqual(s.writes, ['Bcdef!']);
});

test('不能在 emoji 代理对中间切开，也不能以文本工具编辑预制体/场景', async () => {
  const s = editFixture('a🧶b'); await s.apply([{ type: 'insert', position: 2, text: 'x' }]);
  assert.ok(s.replies[0][0]); assert.deepEqual(s.writes, []);
  for (const filePath of ['db://assets/a.prefab', 'db://assets/a.fire', 'db://assets/a.prefab.meta']) {
    const f = editFixture(); await f.apply([{ type: 'insert', position: 0, text: 'x' }], { filePath });
    assert.ok(f.replies[0][0]); assert.deepEqual(f.writes, []);
  }
});

for (const method of ['applyTextEdits', 'manageScript']) {
  for (const fail of [false, true]) {
    test(`${method} 等待刷新并准确返回${fail ? '失败' : '成功'}`, async () => {
      let refreshReply; const writes = [], replies = [];
      const mocks = {
        fs: { existsSync: () => true },
        '../utils/AtomicFile': { readBounded: async () => Buffer.from('abc'), atomicWrite: (...args) => writes.push(args) },
        '../core/Logger': {}, '../utils/AssetPatcher': {}, '../utils/OfflinePrefabEditor': {},
        '../core/CommandQueue': {}, '../core/McpWrappers': {}, './EditorSceneTools': {},
      };
      const { ToolDispatcher } = loadSource('tools/ToolDispatcher.ts', {
        Editor: { assetdb: { urlToFspath: () => '/memory.txt', refresh: (url, cb) => { refreshReply = cb; } } },
      }, mocks);
      const args = method === 'applyTextEdits'
        ? { filePath: 'db://assets/probe.txt', edits: [{ type: 'insert', position: 3, text: 'd' }] }
        : { action: 'write', path: 'db://assets/probe.js', content: 'abcd' };
      await ToolDispatcher[method](args, (...args) => replies.push(args));
      assert.equal(writes[0][1], 'abcd'); assert.equal(replies.length, 0);
      refreshReply(fail ? new Error('refresh unavailable') : null);
      assert.equal(replies.length, 1);
      if (fail) assert.match(String(replies[0][0]), /refresh unavailable/);
      else assert.equal(replies[0][0], null);
    });
  }
}

test('长 Unicode 文本按字符偏移执行多处编辑，完整写入后等待刷新', async () => {
  const source = '开头🧶\n' + '需要完整保留的长文本。'.repeat(32) + '\nEND';
  const expected = '前缀：' + source.slice(0, -3) + '结束';
  let written, refreshReply, replyCount = 0;
  const { ToolDispatcher } = loadSource('tools/ToolDispatcher.ts', {
    Editor: { assetdb: { urlToFspath: () => '/memory.txt', refresh: (url, cb) => { refreshReply = cb; } } },
  }, {
    fs: { existsSync: () => true },
    '../utils/AtomicFile': { readBounded: async () => Buffer.from(source), atomicWrite: (p, text) => { written = text; } },
    '../core/Logger': {}, '../utils/AssetPatcher': {}, '../utils/OfflinePrefabEditor': {},
    '../core/CommandQueue': {}, '../core/McpWrappers': {}, './EditorSceneTools': {},
  });
  await ToolDispatcher.applyTextEdits({ filePath: 'db://assets/probe.txt', edits: [
    { type: 'insert', position: 0, text: '前缀：' },
    { type: 'replace', start: source.length - 3, end: source.length, text: '结束' },
  ] }, err => { assert.equal(err, null); replyCount++; });
  assert.equal(written, expected); assert.equal(replyCount, 0);
  refreshReply(null); assert.equal(replyCount, 1);
});
