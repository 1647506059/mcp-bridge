const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource } = require('./sourceHarness');

function setup({ minimized = false } = {}) {
  const calls = [];
  const image = { getSize: () => ({ width: 800, height: 600 }), resize: () => image, toPNG: () => Buffer.from('png'), toJPEG: () => Buffer.from('jpg') };
  const win = {
    isMinimized: () => minimized,
    isVisible: () => true,
    showInactive() { calls.push('showInactive'); minimized = false; },
    restore() { calls.push('restore'); minimized = false; },
    webContents: { capturePage(reply) { calls.push('capture'); reply(image); } },
  };
  const Editor = { Profile: { load: () => ({ get: () => undefined }) }, Window: { main: { nativeWin: win } }, Ipc: {} };
  const { EditorScreenshot } = loadSource('tools/EditorScreenshot.ts', { Editor });
  return { calls, capture: args => new Promise(resolve => EditorScreenshot.capture(args, (err, data) => resolve({ err, data }))) };
}

test('窗口最小化时自动恢复后再截图，不返回过期画面', async () => {
  const s = setup({ minimized: true });
  const r = await s.capture({ forceFresh: true, format: 'png' });
  assert.equal(r.err, null);
  assert.match(r.data, /^data:image\/png;base64,/);
  assert.deepEqual(s.calls, ['showInactive', 'capture']);
});

test('restoreWindow=false 时最小化窗口直接报错，不改动窗口状态', async () => {
  const s = setup({ minimized: true });
  const r = await s.capture({ forceFresh: true, format: 'png', restoreWindow: false });
  assert.match(r.err, /最小化/);
  assert.equal(r.data, undefined);
  assert.deepEqual(s.calls, []);
});

test('窗口正常时直接截图，不触碰窗口状态', async () => {
  const s = setup({ minimized: false });
  const r = await s.capture({ forceFresh: true, format: 'png' });
  assert.equal(r.err, null);
  assert.deepEqual(s.calls, ['capture']);
});
