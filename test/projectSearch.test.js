const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { loadSource } = require('./sourceHarness');
const { searchProject } = loadSource('tools/ProjectSearch.ts');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-search-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true })); return root;
}

test('旧调用返回数组；新分页无重漏，中文CRLF和长行摘要正确', async t => {
  const root = fixture(t);
  fs.writeFileSync(path.join(root, 'a.txt'), '命中一\r\n命中🙂二\r\n命中三\n');
  fs.writeFileSync(path.join(root, 'b.txt'), '命中' + '中'.repeat(2000));
  const legacy = await searchProject({ query: '命中' }, root, root);
  assert.ok(Array.isArray(legacy)); assert.equal(legacy.length, 4); assert.equal(legacy[1].content, '命中🙂二');
  assert.equal(legacy[3].contentTruncated, true); assert.equal(legacy[3].contentLength, 2002);
  const first = await searchProject({ query: '命中', pageSize: 2 }, root, root);
  assert.equal(first.results.length, 2); assert.equal(first.truncated, true); assert.ok(first.nextCursor);
  const second = await searchProject({ query: '命中', pageSize: 2, cursor: first.nextCursor }, root, root);
  assert.equal(second.results.length, 2); assert.equal(second.nextCursor, null);
  assert.equal(JSON.stringify([...first.results, ...second.results]), JSON.stringify(legacy));
  await assert.rejects(searchProject({ query: '不同', cursor: first.nextCursor }, root, root), /条件不一致/);
  fs.appendFileSync(path.join(root, 'a.txt'), 'changed');
  await assert.rejects(searchProject({ query: '命中', cursor: first.nextCursor }, root, root), /已变化/);
});

test('递归开关、扩展名、正则、大小限制和隐藏目录保留过滤语义', async t => {
  const root = fixture(t); fs.mkdirSync(path.join(root, 'sub')); fs.mkdirSync(path.join(root, '.hidden'));
  fs.writeFileSync(path.join(root, 'small.txt'), 'yes'); fs.writeFileSync(path.join(root, 'large.txt'), 'yes'.repeat(100));
  fs.writeFileSync(path.join(root, 'sub/child.txt'), 'yes'); fs.writeFileSync(path.join(root, '.hidden/h.txt'), 'yes');
  const result = await searchProject({ query: '^yes$', useRegex: true, maxFileBytes: 10, includeMetadata: true, includeSubpackages: false }, root, root);
  assert.equal(result.results.length, 1); assert.equal(result.skippedLargeFiles, 1);
  assert.equal((await searchProject({ query: 'sub', matchType: 'dir_name' }, root, root)).length, 1);
  assert.equal((await searchProject({ query: '.txt', matchType: 'file_name', extensions: ['.ts'] }, root, root)).length, 0);
});

test('大量命中会让出事件循环且分页提前停止，不扫描后面的文件', async t => {
  const root = fixture(t); fs.writeFileSync(path.join(root, 'a.txt'), 'hit\n'.repeat(2000)); fs.writeFileSync(path.join(root, 'z.txt'), 'hit');
  let ticked = false; setTimeout(() => ticked = true, 0);
  const result = await searchProject({ query: 'hit', pageSize: 500 }, root, root);
  assert.equal(ticked, true); assert.equal(result.results.length, 500); assert.equal(result.scannedFiles, 1);
  assert.equal(result.truncated, true);
});

test('空行和无末尾换行跨文件分页无重漏，游标从字节位置继续读取', async t => {
  const root = fixture(t); fs.writeFileSync(path.join(root, 'a.txt'), '一\r\n二'); fs.writeFileSync(path.join(root, 'b.txt'), '三\n');
  let cursor, contents = [], iterations = 0;
  do {
    const r = await searchProject({ query: '', pageSize: 1, ...(cursor ? { cursor } : {}) }, root, root);
    contents.push(...r.results.map(x => x.content)); cursor = r.nextCursor;
    assert.ok(++iterations < 10);
  } while (cursor);
  assert.deepEqual(contents, ['一', '二', '三', '']);
});

test('超时游标按已扫描位置推进，即使当前页没有匹配也能继续', async t => {
  const root = fixture(t); fs.writeFileSync(path.join(root, 'a.txt'), 'no\n'.repeat(400) + 'hit');
  let time = 0, checks = 0;
  const { searchProject: slowSearch } = loadSource('tools/ProjectSearch.ts', { Date: { now: () => ++checks > 145 ? time = 21000 : time } });
  const first = await slowSearch({ query: 'hit', pageSize: 1 }, root, root);
  assert.equal(first.timedOut, true); assert.equal(first.results.length, 0); assert.ok(first.nextCursor);
  const pos = JSON.parse(Buffer.from(first.nextCursor, 'base64').toString()); assert.ok(pos.line > 0); assert.ok(pos.offset > 0);
  const second = await searchProject({ query: 'hit', pageSize: 1, cursor: first.nextCursor }, root, root);
  assert.equal(second.results[0].line, 401);
});

test('默认数组调用发生跳过时明确报不完整，元数据模式给出跳过统计', async t => {
  const root = fixture(t); fs.writeFileSync(path.join(root, 'big.txt'), 'hit'.repeat(30));
  await assert.rejects(searchProject({ query: 'hit', maxFileBytes: 1 }, root, root), /搜索不完整.*includeMetadata/);
});
