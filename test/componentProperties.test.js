const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource } = require('./sourceHarness');

const uuid = 'a23235d1-15db-4b95-8439-a2e005bfff91';
const compressedUuid = 'bcK7huHZFA6YkC995MYRRs';

function setup(attrs = {}, loadAsset, assetdb, fileSystem) {
  class Asset {}
  class Prefab extends Asset {}
  class SpriteFrame extends Asset {}
  class Texture2D extends Asset {}
  class Component {}
  class Node {}
  class TestComponent extends Component {}
  const component = new TestComponent();
  Object.assign(component, {
    string: '', richText: '', fontFamily: '', dataText: '', literalUuid: '', typedEmpty: null,
    unknown: null, target: null, linkedComponent: null, prefab: null, spriteFrame: null, materials: [],
  });
  const linkedComponent = new Component();
  const target = new Node(); target.getComponent = () => linkedComponent;
  const node = { uuid: 'source', _components: [component], getComponent: () => component, addComponent: () => component };
  const sent = [], loaded = [], lookups = [], replies = [];
  const asset = new Prefab(), spriteFrame = new SpriteFrame();
  const cc = {
    Asset, Prefab, SpriteFrame, Texture2D, Component, Node, TestComponent,
    String: { name: 'String' },
    Class: { Attr: { getClassAttrs: () => typeof attrs === 'function' ? attrs(cc) : attrs } },
    js: { isChildClassOf: () => true },
    engine: { getInstanceById(id) { lookups.push(id); return id === 'source' ? node : id === compressedUuid ? target : null; } },
    AssetLibrary: { loadAsset(id, callback) { loaded.push(id); if (loadAsset) loadAsset(id, callback); else callback(null, id === uuid ? spriteFrame : asset); } },
  };
  const Editor = {
    assetdb,
    Utils: { UuidUtils: {
      isUuid: value => value === uuid || value === compressedUuid,
      decompressUuid: value => value,
    } },
    Ipc: { sendToPanel: (...args) => sent.push(args), sendToMain() {}, sendToAll() {} },
    warn() {}, log() {},
  };
  const scene = loadSource('scene-script.ts', { cc, Editor }, fileSystem ? { fs: fileSystem } : {});
  function update(properties, action = 'update') {
    return new Promise((resolve, reject) => {
      scene['manage-components']({ reply: (...args) => { replies.push(args); args[0] ? reject(args[0]) : resolve(args[1]); } }, {
        nodeId: 'source', action, componentType: 'cc.TestComponent', properties,
      });
    });
  }
  return { component, sent, loaded, lookups, replies, update, target, linkedComponent, asset, spriteFrame, cc };
}

test('长文本、Unicode、多行和含资源关键词的字符串字段按原文赋值', async () => {
  const s = setup();
  const values = {
    string: '中文第一行\n第二行：引号 " 与 emoji 🧶，超过二十字符后仍需完整保留。'.repeat(8),
    richText: '<color=#ff00ff>Rich text longer than twenty characters</color>',
    fontFamily: 'A very long font family name with spaces',
    dataText: JSON.stringify({ description: 'Long text data must remain a string', value: 42 }),
  };
  await s.update(values);
  for (const [key, value] of Object.entries(values)) assert.equal(s.component[key], value, key);
  assert.deepEqual(s.sent, []); assert.deepEqual(s.loaded, []);
  assert.deepEqual(s.lookups, ['source'], '文本不能触发节点查找');
});

test('UUID 外形的字符串仍按字段类型保留，空值字符串声明同样生效', async () => {
  for (const value of [uuid, compressedUuid]) {
    const s = setup({ 'typedEmpty$_$type': 'String' });
    await s.update({ literalUuid: value, typedEmpty: value });
    assert.equal(s.component.literalUuid, value); assert.equal(s.component.typedEmpty, value);
    assert.deepEqual(s.sent, []); assert.deepEqual(s.loaded, []); assert.deepEqual(s.lookups, ['source']);
  }
});

test('未声明类型的长文本不再走 UUID 引用兜底', async () => {
  const s = setup(); const value = 'Unclassified long text must not become an asset reference';
  await s.update({ unknown: value }); assert.equal(s.component.unknown, value);
  assert.deepEqual(s.sent, []); assert.deepEqual(s.loaded, []); assert.deepEqual(s.lookups, ['source']);
});

test('真实节点、组件、资源、SpriteFrame 和资源数组引用继续工作', async () => {
  const s = setup(cc => ({
    'target$_$ctor': cc.Node, 'linkedComponent$_$ctor': cc.Component,
    'prefab$_$ctor': cc.Prefab, 'spriteFrame$_$ctor': cc.SpriteFrame,
  }));
  await s.update({ target: compressedUuid, linkedComponent: compressedUuid, prefab: compressedUuid,
    spriteFrame: uuid, materials: [uuid], string: 'A long literal next to real asset references' });
  assert.equal(s.component.target, s.target); assert.equal(s.component.linkedComponent, s.linkedComponent);
  assert.equal(s.component.prefab, s.asset); assert.equal(s.component.spriteFrame, s.spriteFrame);
  assert.equal(s.component.materials[0], s.spriteFrame);
  assert.equal(s.component.string, 'A long literal next to real asset references');
  assert.deepEqual(s.loaded, [compressedUuid, uuid, uuid]);
  const fallback = setup(); await fallback.update({ unknown: uuid });
  assert.equal(fallback.component.unknown, fallback.spriteFrame);
});

test('更新和添加组件都等待资源完成，重复加载回调不会重复回复', async () => {
  for (const action of ['update', 'add']) {
    let finish;
    const s = setup(cc => ({ 'prefab$_$ctor': cc.Prefab }), (id, cb) => { finish = cb; });
    const pending = s.update({ prefab: compressedUuid, string: 'after loading' }, action);
    assert.equal(s.replies.length, 0); assert.equal(s.component.prefab, null);
    finish(null, s.asset); await pending;
    assert.equal(s.component.prefab, s.asset); assert.equal(s.component.string, 'after loading');
    finish(null, s.spriteFrame); assert.equal(s.replies.length, 1); assert.equal(s.component.prefab, s.asset);
  }
});

test('资源加载失败向调用方返回错误，并保留原引用', async () => {
  let finish;
  const s = setup(cc => ({ 'prefab$_$ctor': cc.Prefab }), (id, cb) => { finish = cb; });
  s.component.prefab = s.asset;
  const pending = s.update({ prefab: uuid });
  finish(new Error('asset unavailable'), null);
  await assert.rejects(pending, /asset unavailable/);
  assert.equal(s.component.prefab, s.asset); assert.equal(s.replies.length, 1);
});

test('清空单资源及空数组后仍处理后续属性', async () => {
  const s = setup(cc => ({ 'prefab$_$ctor': cc.Prefab }));
  s.component.prefab = s.asset; s.component.materials = [s.spriteFrame];
  await s.update({ prefab: null, materials: [], string: 'after clearing' });
  assert.equal(s.component.prefab, null); assert.equal(s.component.materials.length, 0);
  assert.equal(s.component.string, 'after clearing'); assert.deepEqual(s.loaded, []);
});

test('资源数组保留空槽和顺序，任何元素失败都不替换原数组', async () => {
  const pendingLoads = [];
  const s = setup({}, (id, cb) => pendingLoads.push([id, cb]));
  const pending = s.update({ materials: [uuid, null, compressedUuid] });
  assert.equal(s.replies.length, 0); assert.equal(pendingLoads.length, 2);
  pendingLoads[1][1](null, s.asset); pendingLoads[0][1](null, s.spriteFrame); await pending;
  assert.equal(s.component.materials.length, 3); assert.equal(s.component.materials[0], s.spriteFrame);
  assert.equal(s.component.materials[1], null); assert.equal(s.component.materials[2], s.asset);
  const previous = s.component.materials;
  const failed = s.update({ materials: [uuid, compressedUuid] });
  pendingLoads[2][1](new Error('missing array asset'), null); pendingLoads[3][1](null, s.asset);
  await assert.rejects(failed, /missing array asset/); assert.equal(s.component.materials, previous);
  await assert.rejects(s.update({ materials: [uuid, 'invalid'] }), /UUID/);
  assert.equal(s.component.materials, previous);
});

test('拒绝给 SpriteFrame 字段赋 Texture2D，不再仅警告后报告成功', async () => {
  const s = setup(cc => ({ 'spriteFrame$_$ctor': cc.SpriteFrame }), (id, cb) => cb(null, new s.cc.Texture2D()));
  await assert.rejects(s.update({ spriteFrame: uuid }), /Texture2D/); assert.equal(s.component.spriteFrame, null);
});

test('保留项目 Texture UUID 经 meta 转换为 SpriteFrame UUID 的定制', async () => {
  const paths = [];
  const s = setup(cc => ({ 'spriteFrame$_$ctor': cc.SpriteFrame }), null,
    { remote: { uuidToFspath: id => { assert.equal(id, compressedUuid); return '/fixture.png'; } } },
    { existsSync: path => { paths.push(path); return true; }, readFileSync: () => JSON.stringify({ subMetas: { sprite: { uuid } } }) });
  await s.update({ spriteFrame: compressedUuid });
  assert.deepEqual(paths, ['/fixture.png.meta']); assert.deepEqual(s.loaded, [uuid]);
  assert.equal(s.component.spriteFrame, s.spriteFrame);
});
