const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource } = require('./sourceHarness');
function setup() {
  class ValueType {} class Asset {} class Component {} class Node {}
  const cc = { ValueType, Asset, Component, Node, js: { getClassName: c => c.type },
    engine: { getInstanceById: id => nodes[id] } };
  const text = '长文本🧶\n"保留原文"'.repeat(60);
  const label = Object.assign(new Component(), { uuid: 'label', type: 'cc.Label', string: text, enabled: true, _private: 'hidden' });
  const sprite = Object.assign(new Component(), { uuid: 'sprite', type: 'cc.Sprite', enabled: false });
  let reads = 0;
  Object.defineProperty(label, 'unrelated', { enumerable: true, get() { reads++; throw new Error('getter'); } });
  Object.defineProperty(label, 'inheritedText', { get() { return 'non-enumerable property'; } });
  const nodes = { first: { _components: [label, sprite] }, second: { _components: [sprite] } };
  const scene = loadSource('scene-script.ts', { cc });
  const get = args => new Promise((resolve, reject) => scene['manage-components']({ reply: (err, value) => err ? reject(err) : resolve(value) }, { action: 'get', ...args }));
  return { text, label, sprite, get, reads: () => reads };
}
test('默认输出保留组件列表、长文本摘要和安全 getter 错误', async () => {
  const s = setup(), result = await s.get({ nodeId: 'first' });
  assert.equal(result.length, 2); assert.match(result[0].properties.string, /Truncated/);
  assert.equal(result[0].properties.unrelated, '[Serialization Error]'); assert.equal(result[0].properties._private, undefined);
});
test('组件类型及 ID 过滤与字段过滤，跳过无关 getter，按需读完整 Unicode 文本', async () => {
  const s = setup(), r = await s.get({ nodeId: 'first', componentType: 'cc.Label', componentId: 'label', fields: ['string', 'enabled', 'inheritedText'], includeFullText: true });
  assert.equal(r.length, 1); assert.equal(r[0].properties.string, s.text); assert.equal(r[0].properties.inheritedText, 'non-enumerable property');
  assert.equal(Object.keys(r[0].properties).length, 3); assert.equal(s.reads(), 0);
  assert.equal((await s.get({ nodeId: 'first', componentId: 'missing' })).length, 0);
});
test('批量节点返回逐节点结果，缺失节点不影响其他节点，不触发写操作', async () => {
  const s = setup(), r = await s.get({ nodeIds: ['first', 'missing', 'second'], fields: ['enabled'] });
  assert.equal(r.length, 3); assert.equal(r[0].components.length, 2); assert.equal(r[1].error, '找不到节点');
  assert.equal(r[2].components[0].properties.enabled, false); assert.equal(s.reads(), 0);
});
test('无效查询参数和多节点写入直接拒绝', async () => {
  const s = setup();
  for (const args of [{ nodeId: 'first', nodeIds: ['second'] }, { nodeIds: [] }, { nodeIds: [''] },
    { nodeId: 'first', fields: [4] }, { nodeIds: Array(101).fill('first') }, { nodeId: 'first', includeFullText: 'yes' },
    { action: 'update', nodeId: 'first', nodeIds: ['second'] }]) await assert.rejects(s.get(args));
});
