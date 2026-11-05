const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource } = require('./sourceHarness');

function profileFixture(initial = {}) {
  const data = { ...initial }, loaded = [];
  let saves = 0, disk = { ...initial };
  const profile = { get: key => data[key], set: (key, value) => { data[key] = value; },
    save() { saves++; disk = JSON.parse(JSON.stringify(data)); } };
  const Editor = { Profile: { load(url, defaults) {
    loaded.push({ url, defaults });
    // Creator 的默认值合并会枚举字符串字符，从而重现数字键污染。
    for (const key of Object.keys(defaults || {})) if (data[key] === undefined) data[key] = defaults[key];
    return profile;
  } } };
  return { data, loaded, Editor, saves: () => saves, disk: () => disk };
}

test('主进程配置加载传递默认对象，不再把包名字符串展开为数字键', () => {
  const s = profileFixture({ 'auto-start': true, 'last-port': 3457 });
  const main = loadSource('main.ts', { Editor: s.Editor });
  main.getProfile();
  assert.equal(typeof s.loaded[0].defaults, 'object');
  assert.equal(s.data[0], undefined); assert.equal(s.data['last-port'], 3457); assert.equal(s.data['auto-start'], true);
});

test('迁移数字字符键时保留端口、关闭状态、零节流和自定义配置，重复加载不重复保存', () => {
  const initial = { ...'mcp-bridge', 'auto-start': false, 'last-port': 3457, 'screenshot-max-width': 640,
    'screenshot-throttle': 0, custom: { enabled: true } };
  const s = profileFixture(initial);
  const { loadProjectProfile } = loadSource('core/ProjectProfile.ts', { Editor: s.Editor });
  loadProjectProfile();
  assert.equal(s.saves(), 1);
  assert.deepEqual(s.disk(), { 'auto-start': false, 'last-port': 3457, 'screenshot-max-width': 640, 'screenshot-throttle': 0, host: '127.0.0.1', custom: { enabled: true } });
  loadProjectProfile(); assert.equal(s.saves(), 1); assert.equal(s.data[0], undefined);
});

test('没有完整旧污染签名时不删除其他数字配置，也不强制保存', () => {
  const s = profileFixture({ '0': 'custom', '1': 'c', 'auto-start': true });
  loadSource('core/ProjectProfile.ts', { Editor: s.Editor }).loadProjectProfile();
  assert.equal(s.data[0], 'custom'); assert.equal(s.saves(), 0);
});

test('截图入口也使用相同默认对象和清理逻辑，不再污染配置', async () => {
  const s = profileFixture({ ...'mcp-bridge', 'last-port': 3456 });
  s.Editor.Window = { main: { nativeWin: { isVisible: () => true, isMinimized: () => false,
    webContents: { capturePage(reply) { reply({ getSize: () => ({ width: 800, height: 600 }), toPNG: () => Buffer.from('png') }); } } } } };
  const { EditorScreenshot } = loadSource('tools/EditorScreenshot.ts', { Editor: s.Editor });
  const result = await new Promise(resolve => EditorScreenshot.capture({}, (error, data) => resolve({ error, data })));
  assert.equal(result.error, null); assert.match(result.data, /^data:image\/png;base64,/);
  assert.equal(typeof s.loaded[0].defaults, 'object'); assert.equal(s.disk()[0], undefined); assert.equal(s.disk()['last-port'], 3456);
});
