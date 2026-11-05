const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { collectScanPorts, readLastPortFromSettings, resolveProjectRootFromProxyDir } = require('../dist/utils/proxyDiscovery');
const { resolveBuildPlatform, alignWithKnownTargets, resolveBuildDest } = require('../dist/utils/resolveBuildPlatform');

test('扫描新端口范围并保留项目旧端口，过滤重复及非法端口', () => {
  assert.deepEqual(collectScanPorts(8200, 8210, [3456, 8200, 3456, 0, -1, 65536, NaN, 1.5, null]),
    [8200, 8201, 8202, 8203, 8204, 8205, 8206, 8207, 8208, 8209, 8210, 3456]);
});

test('读取现有项目配置，包括历史字符键及字符串端口', () => {
  assert.equal(readLastPortFromSettings('{"0":"m","1":"c","last-port":3456}'), 3456);
  assert.equal(readLastPortFromSettings('{"last-port":"8201"}'), 8201);
});

test('损坏配置或非法端口不会进入扫描列表', () => {
  for (const raw of ['{', 'null', '"mcp-bridge"', '{}', '{"last-port":0}', '{"last-port":65536}', '{"last-port":1.5}']) {
    assert.equal(readLastPortFromSettings(raw), null, raw);
  }
});

test('从插件 dist 定位含 settings 的项目根，无配置时返回 null', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dmx-mcp-discovery-'));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    fs.rmSync(root, { recursive: true, force: true });
  });
  const proxyDir = path.join(root, 'packages', 'mcp-bridge', 'dist');
  assert.equal(resolveProjectRootFromProxyDir(proxyDir), null);
  fs.mkdirSync(path.join(root, 'settings'));
  fs.writeFileSync(path.join(root, 'settings', 'mcp-bridge.json'), '{}');
  assert.equal(resolveProjectRootFromProxyDir(proxyDir), root);
});

test('保留微信和抖音构建平台的项目定制映射', () => {
  assert.deepEqual(resolveBuildPlatform('wechat', null), { platform: 'wechatgame', actualPlatform: 'wechatgame' });
  assert.deepEqual(resolveBuildPlatform('wechatgame', null), { platform: 'mini-game', actualPlatform: 'wechatgame' });
  assert.deepEqual(resolveBuildPlatform('bytedance', null), { platform: 'mini-game', actualPlatform: 'bytedance' });
  assert.deepEqual(alignWithKnownTargets({ platform: 'mini-game', actualPlatform: 'bytedance' }, { 'mini-game': {} }),
    { platform: 'mini-game', actualPlatform: 'bytedance' });
});

test('保留构建器可用平台校验和产物目录解析', () => {
  const known = { 'web-mobile': {} };
  assert.equal(alignWithKnownTargets({ platform: 'invalid', actualPlatform: 'invalid' }, known).error.includes('未知构建平台'), true);
  const root = path.resolve('fixture-project');
  assert.equal(resolveBuildDest(root, './build', 'wechatgame'), path.join(root, 'build', 'wechatgame'));
  assert.equal(resolveBuildDest(root, path.join(root, 'custom'), 'bytedance'), path.join(root, 'custom', 'bytedance'));
});
