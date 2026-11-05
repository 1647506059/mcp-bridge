const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource, fakeClock } = require('./sourceHarness');

function setup() {
  const clock = fakeClock(); const requests = []; let blocked = '', pending = 0;
  const Editor = { assetdb: { urlToUuid: () => 'target' }, Ipc: { sendToMain() {}, sendToAll() {} },
    Scene: { callSceneScript(pkg, method, args, callback) { requests.push(callback); } } };
  const Q = { trackEditorOperation() { pending++; let done = false; return () => { if (!done) pending--; done = true; }; }, blockPending(reason) { blocked = reason; } };
  const { EditorSceneTools } = loadSource('tools/EditorSceneTools.ts', { ...clock, Editor }, { '../core/CommandQueue': { CommandQueue: Q } });
  return { clock, requests, Editor, open: EditorSceneTools.open, get blocked() { return blocked; }, get pending() { return pending; } };
}

test('打开超过两秒仍等待目标资源身份，匹配后才完成', () => {
  for (const prefab of [false, true]) {
    const s = setup(); const replies = []; let settled = false;
    s.open('db://assets/test', prefab, (...args) => replies.push(args), () => { settled = true; });
    s.requests.shift()(null, { mode: prefab ? 'prefab' : 'scene', sceneUuid: 'old', prefabUuid: 'old' });
    s.clock.tick(2500); assert.equal(replies.length, 0); assert.equal(settled, false);
    s.requests.at(-1)(null, { mode: prefab ? 'prefab' : 'scene', sceneUuid: 'target', prefabUuid: 'target' });
    assert.equal(replies.length, 1); assert.equal(replies[0][0], null); assert.equal(replies[0][1].ready, true);
    assert.equal(settled, true); assert.equal(s.pending, 0);
  }
});

test('打开超时不报成功、不放行写入，迟到完成后释放等待', () => {
  const s = setup(); const replies = []; let settled = false;
  s.open('db://assets/test', true, (...args) => replies.push(args), () => { settled = true; });
  s.clock.tick(30000); assert.equal(replies.length, 1); assert.match(replies[0][0], /超时/);
  assert.match(s.blocked, /超时/); assert.equal(settled, false); assert.equal(s.pending, 1);
  s.clock.tick(1601); s.requests.at(-1)(null, { mode: 'prefab', prefabUuid: 'target' });
  assert.equal(settled, true); assert.equal(s.pending, 0); assert.equal(replies.length, 1);
});

test('资源查询失败时返回错误并清除 busy，不创建悬挂操作', () => {
  const s = setup(); let settled = false; let error;
  s.Editor.assetdb.urlToUuid = () => { throw new Error('invalid URL'); };
  s.open('invalid', false, err => { error = err; }, () => { settled = true; });
  assert.match(error.message, /invalid URL/); assert.equal(settled, true); assert.equal(s.pending, 0);
});

test('场景保存等待真实完成回调，错误原样返回且拒绝错误编辑模式', () => {
  let saveReply; let mode = 'scene'; const replies = [];
  const scene = loadSource('scene-script.ts', { Editor: { require: () => ({ curMode: () => ({ name: mode }), save: cb => { saveReply = cb; } }) } });
  scene['save-scene']({ reply: (...args) => replies.push(args) }, {});
  assert.equal(replies.length, 0); saveReply(null); assert.equal(replies.length, 1); assert.equal(replies[0][0], null);
  scene['save-scene']({ reply: (...args) => replies.push(args) }, {}); saveReply(new Error('disk failed'));
  assert.match(replies[1][0].message, /disk failed/);
  mode = 'prefab'; scene['save-scene']({ reply: (...args) => replies.push(args) }, {});
  assert.match(replies[2][0].message, /save_prefab/);
});

test('save_scene 分发不再发出保存消息后立即报告成功', () => {
  let ipcReply; const replies = []; const sent = [];
  const mocks = {
    '../core/Logger': {}, '../utils/AssetPatcher': {}, '../utils/OfflinePrefabEditor': {}, '../core/McpWrappers': {}, './EditorSceneTools': {},
    '../core/CommandQueue': { CommandQueue: { getBlockedReason: () => '', callSceneScriptWithTimeout(pkg, method, args, cb) { assert.equal(method, 'save-scene'); ipcReply = cb; } } },
  };
  const { ToolDispatcher } = loadSource('tools/ToolDispatcher.ts', { Editor: { Ipc: { sendToPanel: (...args) => sent.push(args) } } }, mocks);
  ToolDispatcher.handleMcpCall('save_scene', {}, (...args) => replies.push(args));
  assert.equal(replies.length, 0); assert.equal(ToolDispatcher.isSceneBusy, true); assert.equal(sent.length, 0);
  ipcReply(null, 'saved'); assert.equal(replies.length, 1); assert.equal(ToolDispatcher.isSceneBusy, false);
});
