const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource, fakeClock } = require('./sourceHarness');

function fixture() {
  let seq = 0;
  class Component {}
  class Asset {}
  class SpriteFrame extends Asset {}
  class Texture2D extends Asset {}
  class ParticleAsset extends Asset {}
  class Sprite extends Component { constructor() { super(); this.spriteFrame = null; } }
  Sprite.SizeMode = { CUSTOM: 1 };
  class ParticleSystem extends Component { resetSystem() {} }
  class Node {
    constructor(name) { this.name = name; this.uuid = 'fake-' + ++seq; this._components = []; this.children = []; }
    destroy() { clock.setTimeout(() => { this.destroyed = true; }, 20); }
    addComponent(C) { const c = new C(); this._components.push(c); return c; }
    get childrenCount() { return this.children.length; }
    getComponent(C) { return this._components.find(c => c instanceof C) || null; }
  }
  const scene = new Node('Scene'), node = new Node('Target'), comp = new Component();
  comp.target = null; comp.string = ''; comp.uuid = 'component'; node._components.push(comp);
  const particle = node.addComponent(ParticleSystem); particle.texture = null; particle.file = null;
  const loads = [], replies = [], clock = fakeClock();
  const cc = { Node, Component, Asset, Sprite, SpriteFrame, Texture2D, ParticleAsset, ParticleSystem, Canvas: class {}, String: 'String',
    Class: { Attr: { getClassAttrs: () => ({ 'target$_$ctor': Node }) } },
    isValid: value => !value.destroyed, director: { getScene: () => scene }, engine: { getInstanceById: id => id === 'parent' || id === scene.uuid ? scene : id === 'target' || id === node.uuid ? node : null },
    assetManager: { loadAny(id, callback) { loads.push(callback); } }, js: { getClassByName: () => Component, getClassName: () => "cc.Component" } };
  const mode = { name: "prefab" };
  const editMode = { curMode: () => mode, pop() { clock.setTimeout(() => { mode.name = "scene"; }, 100); } };
  const Editor = { require: () => editMode, Utils: { UuidUtils: { isUuid: s => typeof s === 'string' && s.length > 20, decompressUuid: s => s } },
    Ipc: { sendToMain() {}, sendToAll() {} }, warn() {}, log() {}, error() {} };
  return { scene, api: loadSource('scene-script.ts', { cc, Editor, ...clock }), cc, node, comp, particle, loads, replies, clock,
    event: { reply: (...args) => replies.push(args) } };
}

test('创建默认精灵等待加载，失败只报告一次且无提前成功', async () => {
  const s = fixture();
  s.api['create-node'](s.event, { type: 'sprite', name: 'Probe', parentId: 'parent', defaultSpriteUuid: 'uuid', returnDetails: true });
  assert.equal(s.replies.length, 0); assert.equal(s.loads.length, 1);
  s.loads[0](new Error('load failed')); await new Promise(setImmediate);
  assert.equal(s.replies.length, 1); assert.match(s.replies[0][0].message, /load failed/);
  s.loads[0](null, new s.cc.SpriteFrame()); await new Promise(setImmediate); assert.equal(s.replies.length, 1);
});

test('特效资源成功加载后才返回完成，失败不覆盖原资源', async () => {
  const s = fixture(), original = new s.cc.ParticleAsset(); s.particle.file = original;
  s.api['manage-vfx'](s.event, { action: 'update', nodeId: 'target', properties: { file: 'uuid' } });
  assert.equal(s.replies.length, 0);
  s.loads[0](new Error('vfx failed')); await new Promise(setImmediate);
  assert.equal(s.particle.file, original); assert.match(s.replies[0][0].message, /vfx failed/);
});

test('拼错字段与无法解析的节点引用明确失败，保留原值', async () => {
  for (const properties of [{ missingProperty: 123 }, { target: '00000000-0000-0000-0000-000000000099' }]) {
    const s = fixture();
    await s.api['manage-components'](s.event, { nodeId: 'target', action: 'update', componentId: 'component', properties });
    assert.ok(s.replies[0][0]); assert.equal(s.comp.target, null); assert.equal(s.comp.missingProperty, undefined);
  }
});

test('离线删除只清理层级集合，保留普通数组空槽、删除引用的占位及其顺序', () => {
  const { OfflinePrefabEditor: O } = loadSource('utils/OfflinePrefabEditor.ts');
  const graph = [{ __type__: 'cc.Prefab', data: { __id__: 1 } },
    { __type__: 'cc.Node', _children: [{ __id__: 2 }, { __id__: 3 }], _components: [] },
    { __type__: 'cc.Node', _children: [], _components: [] },
    { __type__: 'cc.Node', _children: [], _components: [{ __id__: 4 }] },
    { __type__: 'CustomComponent', slots: [{ __uuid__: 'A' }, null, { __uuid__: 'B' }, { __id__: 2 }] }];
  O.physicalEraseAndRealign(graph, [2, 2]);
  assert.equal(graph.length, 4); assert.equal(graph[1]._children.length, 1);
  assert.equal(graph[1]._children[0].__id__, 2); assert.equal(graph[2]._components[0].__id__, 3);
  assert.equal(graph[3].slots.length, 4); assert.equal(graph[3].slots[1], null); assert.equal(graph[3].slots[3], null);
});


test('删除节点与退出预制体等待实际状态变化后才回复', () => {
  const a = fixture(); a.api['delete-node'](a.event, { uuid: 'target' });
  assert.equal(a.replies.length, 0); a.clock.tick(16); assert.equal(a.replies.length, 0);
  a.clock.tick(32); assert.equal(a.replies.length, 1); assert.equal(a.replies[0][0], null);
  const b = fixture(); b.api['close-prefab'](b.event, {});
  b.clock.tick(50); assert.equal(b.replies.length, 0); b.clock.tick(50);
  assert.equal(b.replies.length, 1); assert.equal(b.replies[0][0], null);
});

test('整组字段预检在无效引用前不提前改写文本', async () => {
  const s = fixture(); s.comp.string = 'before';
  await s.api['manage-components'](s.event, { action: 'update', nodeId: 'target', componentId: 'component', properties: { string: 'after', target: 'missing' } });
  assert.ok(s.replies[0][0]); assert.equal(s.comp.string, 'before');
});


test('引用搜索实际出口分页不重漏，预算耗尽返回错误，旧响应 wrapper 保持兼容', () => {
  const s = fixture(), asset = new s.cc.Asset(); asset._uuid = 'asset'; s.scene.children.push(s.node);
  s.comp.first = asset; s.comp.second = asset; s.comp.third = asset;
  const query = args => { let reply; s.api['find-references']({ reply: (...r) => reply = r }, { targetId: 'asset', targetType: 'asset', ...args }); return reply; };
  const legacy = query({}); assert.equal(legacy[0], null); assert.equal(legacy[1].referenceCount, 3); assert.equal(legacy[1].references.length, 3);
  const first = query({ pageSize: 1 }); assert.equal(first[1].references.length, 1); assert.equal(first[1].truncated, true);
  const second = query({ pageSize: 2, cursor: first[1].nextCursor });
  assert.equal(second[1].references.length, 2); assert.equal(second[1].nextCursor, null);
  assert.equal(new Set([...first[1].references, ...second[1].references].map(r => r.propertyName)).size, 3);
  assert.ok(query({ maxVisited: 1 })[0]); s.comp.second = null;
  assert.match(query({ pageSize: 1, cursor: first[1].nextCursor })[0].message, /变化/);
});

test('层级截断提供可继续的 child query，子节点变化后拒绝旧版本', () => {
  const s = fixture(); s.scene.children.push(new s.cc.Node('A'), new s.cc.Node('B'), new s.cc.Node('C'));
  const get = args => { let reply; s.api['get-hierarchy']({ reply: (...r) => reply = r }, { nodeId: 'parent', depth: 1, childPageSize: 1, ...args }); return reply; };
  const first = get({}); assert.equal(first[1].children[0].name, 'A');
  const next = get(first[1].nextChildrenQuery); assert.equal(next[1].children[0].name, 'B');
  s.scene.children.pop(); assert.match(get(first[1].nextChildrenQuery)[0].message, /变化/);
});
