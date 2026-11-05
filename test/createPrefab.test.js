const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource } = require('./sourceHarness');

function setup(serialize) {
  const parent = { children: [] };
  const before = {}, after = {};
  let currentParent = parent;
  const node = {
    name: 'Source',
    get parent() { return currentParent; },
    set parent(value) {
      if (currentParent) currentParent.children.splice(currentParent.children.indexOf(this), 1);
      currentParent = value;
      if (value) value.children.push(this);
    },
    getSiblingIndex() { return currentParent.children.indexOf(this); },
    setSiblingIndex(index) { const siblings = currentParent.children; siblings.splice(siblings.indexOf(this), 1); siblings.splice(index, 0, this); },
  };
  parent.children.push(before, node, after);
  const scene = loadSource('scene-script.ts', {
    cc: { engine: { getInstanceById: id => id === 'source' ? node : null } },
    Editor: { serialize: () => serialize(node) },
  });
  const replies = [];
  scene['create-prefab']({ reply: (...args) => replies.push(args) }, { nodeId: 'source', nodeName: 'Exported' });
  assert.equal(node.parent, parent); assert.equal(node.name, 'Source');
  assert.deepEqual(parent.children, [before, node, after], '导出不能改变源节点顺序');
  assert.equal(replies.length, 1);
  return replies[0];
}

test('空节点的单对象序列化结果可创建标准预制体，源节点保持原状', () => {
  const [err, content] = setup(node => {
    assert.equal(node.parent, null); assert.equal(node.name, 'Exported');
    return JSON.stringify({ __type__: 'cc.Node', _name: node.name, _parent: null, _children: [], _id: 'source' });
  });
  assert.equal(err, null);
  const data = JSON.parse(content), root = data[data[0].data.__id__];
  assert.equal(data[0].__type__, 'cc.Prefab'); assert.equal(root._name, 'Exported');
  assert.equal(root._parent, null); assert.equal(root._id, '');
  assert.equal(data[root._prefab.__id__].__type__, 'cc.PrefabInfo');
});

test('数组序列化保留子节点、组件、内部与外部资源引用', () => {
  const [err, content] = setup(() => JSON.stringify([
    { __type__: 'cc.Node', _name: 'Exported', _parent: { __id__: 1 }, _children: [{ __id__: 2 }], _components: [{ __id__: 3 }] },
    { __type__: 'cc.Scene', _children: [{ __id__: 0 }] },
    { __type__: 'cc.Node', _name: 'Child', _parent: { __id__: 0 }, _children: [], _components: [] },
    { __type__: 'cc.Widget', node: { __id__: 0 }, target: { __id__: 2 }, asset: { __uuid__: 'asset-uuid' } },
  ]));
  assert.equal(err, null);
  const data = JSON.parse(content), rootIndex = data[0].data.__id__, root = data[rootIndex];
  const child = data[root._children[0].__id__], component = data[root._components[0].__id__];
  assert.equal(child._name, 'Child'); assert.equal(child._parent.__id__, rootIndex);
  assert.equal(component.node.__id__, rootIndex); assert.equal(data[component.target.__id__], child);
  assert.equal(component.asset.__uuid__, 'asset-uuid'); assert.equal(root._parent, null);
  assert.equal(data.some(item => item.__type__ === 'cc.Scene'), false);
  for (const item of [root, child]) {
    const info = data[item._prefab.__id__];
    assert.equal(info.__type__, 'cc.PrefabInfo'); assert.equal(info.root.__id__, rootIndex); assert.equal(info.asset.__id__, 0);
  }
});

test('序列化抛错或无有效节点时返回错误并恢复源节点', () => {
  const [err] = setup(() => { throw new Error('serializer failed'); });
  assert.match(err.message, /serializer failed/);
  for (const raw of ['null', '[]', '{}', '[{"__type__":"cc.Scene"}]']) {
    const [error, content] = setup(() => raw);
    assert.ok(error, raw); assert.equal(content, undefined);
  }
});
