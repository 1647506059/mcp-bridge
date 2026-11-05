const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { loadSource } = require('./sourceHarness');

function editor(overrides = {}) {
  return loadSource('utils/OfflinePrefabEditor.ts', {}, {
    '../core/Logger': { Logger: { error() {}, warn() {}, success() {} } }, ...overrides,
  }).OfflinePrefabEditor;
}
function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-transaction-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const create = { action: 'add_node', targetPath: '', nodeName: 'Card"中文🙂' };

test('新建操作失败不留下骨架、备份或目录，也不改变调用参数', t => {
  const dir = fixture(t), Editor = editor();
  for (const kind of ['prefab-root', 'prefab-child', 'scene']) {
    const file = path.join(dir, kind, 'new.prefab'), ops = [create, { action: 'remove_node', targetPath: 'Missing' }];
    const before = JSON.stringify(ops);
    const result = Editor.modify(file, ops, kind);
    assert.equal(result.success, false); assert.equal(fs.existsSync(file), false);
    assert.equal(fs.existsSync(path.dirname(file)), false); assert.equal(JSON.stringify(ops), before);
  }
});

test('共享提交保留在线单根、纯离线Root子节点和场景无PrefabInfo的约定', t => {
  const dir = fixture(t), Editor = editor();
  for (const kind of ['prefab-root', 'prefab-child', 'scene']) {
    const file = path.join(dir, kind, 'new.prefab'), ops = [create];
    assert.equal(Editor.modify(file, ops, kind).success, true);
    assert.equal(ops.length, 1);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const root = data[1], child = root._children[0] && data[root._children[0].__id__];
    if (kind === 'prefab-root') { assert.equal(root._name, create.nodeName); assert.equal(child, undefined); }
    else { assert.equal(child._name, create.nodeName); if (kind === 'prefab-child') assert.equal(root._name, 'Root'); }
    if (kind === 'scene') assert.equal(data.some(x => x.__type__ === 'cc.PrefabInfo'), false);
    else assert.ok(data[root._prefab.__id__].fileId);
    assert.deepEqual(fs.readdirSync(path.dirname(file)), ['new.prefab']);
  }
});

test('已有资源验证失败、提交失败均保留原字节，临时文件清理且已有fileId不变', t => {
  const dir = fixture(t), file = path.join(dir, 'old.prefab'), Editor = editor();
  assert.equal(Editor.modify(file, [create], 'prefab-root').success, true);
  const original = fs.readFileSync(file), id = JSON.parse(original)[2].fileId;
  assert.equal(Editor.modify(file, [{ action: 'remove_node', targetPath: 'Missing' }]).success, false);
  assert.deepEqual(fs.readFileSync(file), original);
  const broken = editor({ fs: { ...fs, renameSync() { throw new Error('commit denied'); } } });
  assert.equal(broken.modify(file, [{ action: 'update_property', properties: { name: 'changed' } }]).success, false);
  assert.deepEqual(fs.readFileSync(file), original); assert.deepEqual(fs.readdirSync(dir), ['old.prefab']);
  assert.equal(Editor.modify(file, [{ action: 'update_property', properties: { name: 'changed' } }]).success, true);
  assert.equal(JSON.parse(fs.readFileSync(file))[2].fileId, id);
});

test('在线入口失败不提前落盘、不刷新，纯离线入口保留同一事务语义', t => {
  const dir = fixture(t), file = path.join(dir, 'new.prefab'); let reply, refreshed = 0;
  const { ToolDispatcher } = loadSource('tools/ToolDispatcher.ts', { Editor: { assetdb: { urlToFspath: () => file, refresh() { refreshed++; } } } }, {
    '../core/Logger': { Logger: { error() {}, warn() {}, info() {} } },
    '../core/CommandQueue': { CommandQueue: { getBlockedReason: () => '' } },
    '../core/McpWrappers': {}, './EditorSceneTools': {},
  });
  const args = { prefabUrl: 'db://assets/new.prefab', operations: [create, { action: 'remove_node', targetPath: 'Missing' }] };
  ToolDispatcher.handleMcpCall('modify_prefab_offline', args, err => reply = err);
  assert.match(reply, /离线修改预制体失败/); assert.equal(fs.existsSync(file), false); assert.equal(args.operations.length, 2); assert.equal(refreshed, 0);
});

test('排他新建不覆盖并发出现的文件，提交前检测已有文件变化', t => {
  const dir = fixture(t), file = path.join(dir, 'new.prefab');
  const race = editor({ fs: { ...fs, linkSync(a, b) { fs.writeFileSync(b, 'external'); return fs.linkSync(a, b); } } });
  assert.equal(race.modify(file, [create], 'prefab-root').success, false);
  assert.equal(fs.readFileSync(file, 'utf8'), 'external'); assert.deepEqual(fs.readdirSync(dir), ['new.prefab']);
});
