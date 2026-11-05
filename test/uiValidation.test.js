const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadSource } = require('./sourceHarness');
const { buttonEvents } = loadSource('tools/ButtonEvents.ts');
const { validateSerializedAsset } = loadSource('utils/SerializedValidation.ts');
const { OfflinePrefabEditor } = loadSource('utils/OfflinePrefabEditor.ts', {}, { '../core/Logger': { Logger: { error() {}, warn() {} } } });

test('按钮绑定检查目标/方法，重复幂等，替换只触及同一事件，列表只读', () => {
  const button = { clickEvents: [] }, component = { submit() {} };
  const nodes = { button: { uuid: 'button', getComponent: () => button }, target: { uuid: 'target', getComponent: name => name === 'View' ? component : null } };
  const engine = { Button: function(){}, Component: { EventHandler: class {} } };
  const run = args => buttonEvents(args, id => nodes[id], engine);
  const args = { action: 'bind', nodeId: 'button', targetId: 'target', componentName: 'View', handler: 'submit' };
  assert.throws(() => run({ ...args, handler: 'missing' }), /回调不存在/); assert.equal(button.clickEvents.length, 0);
  assert.throws(() => run({ ...args, targetId: 'missing' }));
  assert.equal(run(args).bound, true); assert.equal(run(args).duplicate, true); assert.equal(button.clickEvents.length, 1);
  assert.equal(run({ ...args, replace: true }).bound, true); assert.equal(button.clickEvents.length, 1);
  const listed = run({ action: 'list', nodeId: 'button' }); assert.equal(listed.events[0].valid, true); assert.equal(listed.events[0].targetUuid, 'target');
  delete component.submit; assert.equal(run({ action: 'list', nodeId: 'button' }).events[0].valid, false);
});

test('Prefab断引用、父子不一致、组件归属及错误Prefab根在落盘前拒绝', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-graph-')); t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'test.prefab');
  assert.equal(OfflinePrefabEditor.modify(file, [{ action: 'add_node', nodeName: 'Root' }, { action: 'add_node', targetPath: '', nodeName: 'Child' }], 'prefab-root').success, true);
  const original = fs.readFileSync(file, 'utf8'), valid = JSON.parse(original);
  assert.equal(validateSerializedAsset(valid).ok, true);
  for (const mutate of [data => data[0].data.__id__ = 999, data => data[1]._children.push({ __id__: 1 }), data => data[1]._components.push({ __id__: 2 }), data => data[2].root = { __id__: 0 }]) {
    const broken = JSON.parse(original); mutate(broken); assert.equal(validateSerializedAsset(broken).ok, false);
  }
  const result = OfflinePrefabEditor.modify(file, [{ action: 'update_property', targetPath: '', properties: { _parent: { __id__: 999 } } }]);
  assert.equal(result.success, false); assert.equal(fs.readFileSync(file, 'utf8'), original); assert.deepEqual(fs.readdirSync(dir), ['test.prefab']);
});
