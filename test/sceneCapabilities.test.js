const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./sourceHarness');
const { executeSceneCapability, resolveSceneNode } = loadSource('tools/SceneCapabilities.ts');

function fixture() {
  let sequence = 0, paused = false, timeScale = 1;
  const all = new Map(), notifications = [], clicks = [];
  class Component {}
  Component.EventHandler = { emitEvents(events, button) { for (const event of events) event(button); } };
  class Node {
    constructor(name, parent) { this.uuid = 'node-' + ++sequence; this.name = name; this.parent = parent || null; this.children = []; this._components = []; this.activeInHierarchy = true; if (parent) parent.children.push(this); all.set(this.uuid, this); }
    getComponent(type) { return this._components.find(component => typeof type === 'string' ? component.type === type : component instanceof type); }
    getComponents(type) { return this._components.filter(component => component instanceof type); }
    emit(...args) { clicks.push(args); }
    destroy() { this.destroyRequested = true; }
  }
  class Button extends Component { constructor() { super(); this.enabled = true; this.interactable = true; this.clickEvents = []; } }
  class Camera extends Component {}
  class Animation extends Component { addClip(clip, name) { this.lastClip = { clip, name }; } }
  class AnimationClip {}
  const root = new Node('Scene'), canvas = new Node('Canvas', root), target = new Node('Button', canvas);
  const engine = { Node, Component, Button, Camera, Animation, AnimationClip, Label: class {}, Sprite: class {},
    director: { getScene: () => root, isPaused: () => paused, pause() { paused = true; }, resume() { paused = false; }, getScheduler: () => ({ getTimeScale: () => timeScale, setTimeScale(value) { timeScale = value; } }) } };
  return { engine, root, canvas, target, all, clicks, notifications, byId: id => all.get(id),
    run: (name, args = {}, load = async () => null) => executeSceneCapability(name, args, engine, id => all.get(id), load, id => notifications.push(id)) };
}

test('节点定位支持UUID、路径和唯一名称，拒绝重名与其他场景节点', () => {
  const s = fixture();
  assert.equal(resolveSceneNode({ uuid: s.target.uuid }, s.root, s.engine, s.byId), s.target);
  assert.equal(resolveSceneNode({ path: 'Scene/Canvas/Button' }, s.root, s.engine, s.byId), s.target);
  new s.engine.Node('Button', s.canvas);
  assert.throws(() => resolveSceneNode({ name: 'Button' }, s.root, s.engine, s.byId), /唯一/);
  const foreign = new s.engine.Node('Foreign');
  assert.throws(() => resolveSceneNode({ uuid: foreign.uuid }, s.root, s.engine, s.byId), /当前编辑场景/);
});

test('按钮模拟调用真实EventHandler并区分事件发送与业务成功', async () => {
  const s = fixture(), button = new s.engine.Button(); let count = 0;
  button.clickEvents.push(value => { assert.equal(value, button); count++; }); s.target._components.push(button);
  const result = await s.run('simulate_button_click', { uuid: s.target.uuid });
  assert.equal(count, 1); assert.equal(s.clicks[0][0], 'click'); assert.equal(result.businessOutcomeVerified, false);
  button.interactable = false; await assert.rejects(s.run('simulate_button_click', { uuid: s.target.uuid }), /可交互/);
});

test('场景状态工具调用director与scheduler，销毁禁止场景根并发送变更通知', async () => {
  const s = fixture();
  assert.equal((await s.run('pause_runtime')).paused, true); assert.equal((await s.run('resume_runtime')).paused, false);
  assert.equal((await s.run('set_time_scale', { timeScale: 0.5 })).timeScale, 0.5);
  await assert.rejects(s.run('delete_node', { uuid: s.root.uuid }), /场景根/);
  await s.run('delete_node', { uuid: s.target.uuid }); assert.equal(s.target.destroyRequested, true); assert.deepEqual(s.notifications, [s.target.uuid]);
});

test('组件方法支持异步结果，动画资源在场景变化时拒绝挂载', async () => {
  const s = fixture(); s.target._components.push({ type: 'Custom', async count(value) { return value + 1; } });
  const result = await s.run('invoke_component_method', { uuid: s.target.uuid, componentName: 'Custom', methodName: 'count', args: [4] });
  assert.equal(result.data, 5); assert.equal(s.notifications.length, 1);
  const animation = new s.engine.Animation(); s.target._components.push(animation);
  await assert.rejects(s.run('add_animation_clip', { uuid: s.target.uuid, clipUuid: 'clip' }, async () => { s.engine.director.getScene = () => null; return new s.engine.AnimationClip(); }), /场景已变化/);
  assert.equal(animation.lastClip, undefined);
});
