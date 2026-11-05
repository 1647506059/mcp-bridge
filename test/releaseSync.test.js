const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const api = require('../scripts/release-sync');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-release-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const release = path.join(root, 'release'), project = path.join(root, 'project'), plugin = path.join(project, 'packages/mcp-bridge');
  const payload = { 'package.json': JSON.stringify({ name: 'mcp-bridge', version: '1.5.0' }), 'tsconfig.json': '{}',
    'dist/main.js': 'new main', 'dist/scene-script.js': 'scene', 'dist/mcp-proxy.js': 'proxy',
    'dist/build-info.json': JSON.stringify({ version: '1.5.0', buildId: 'test-build' }) };
  for (const [file, bytes] of Object.entries(payload)) { const to = path.join(release, file); fs.mkdirSync(path.dirname(to), { recursive: true }); fs.writeFileSync(to, bytes); }
  fs.writeFileSync(path.join(release, 'release.json'), JSON.stringify({ schema: 1, name: 'mcp-bridge', version: '1.5.0', buildId: 'test-build',
    files: Object.entries(payload).map(([file, bytes]) => ({ path: file, sha256: crypto.createHash('sha256').update(bytes).digest('hex') })) }));
  fs.mkdirSync(path.join(plugin, 'dist'), { recursive: true });
  fs.writeFileSync(path.join(project, 'project.json'), JSON.stringify({ version: '2.4.15' }));
  fs.writeFileSync(path.join(plugin, 'package.json'), JSON.stringify({ name: 'mcp-bridge', version: '1.4.1' }));
  fs.writeFileSync(path.join(plugin, 'dist/main.js'), 'old main');
  fs.mkdirSync(path.join(project, 'settings')); fs.writeFileSync(path.join(project, 'settings/mcp-bridge.json'), '{"last-port":3457}');
  return { root, release, project, plugin };
}
test('更新校验全部发布文件，保留工程设置，明确磁盘更新与实际加载的区别，可恢复', t => {
  const f = fixture(t), plan = api.plan(f.release, f.project);
  const result = api.applyPlan(plan); assert.ok(result.changed > 0); assert.equal(result.loadedBuildVerified, false);
  assert.equal(fs.readFileSync(path.join(f.plugin, 'dist/main.js'), 'utf8'), 'new main');
  assert.equal(fs.readFileSync(path.join(f.project, 'settings/mcp-bridge.json'), 'utf8'), '{"last-port":3457}');
  assert.equal(api.plan(f.release, f.project).changes.length, 0);
  api.restore(result.backup); assert.equal(fs.readFileSync(path.join(f.plugin, 'dist/main.js'), 'utf8'), 'old main');
  assert.equal(fs.existsSync(path.join(f.plugin, 'dist/scene-script.js')), false);
});
test('损坏发布包、预览后目标变化、路径穿越均拒绝写入', t => {
  const f = fixture(t), plan = api.plan(f.release, f.project);
  fs.writeFileSync(path.join(f.plugin, 'dist/main.js'), 'user edit'); assert.throws(() => api.applyPlan(plan), /发生变化/);
  fs.writeFileSync(path.join(f.release, 'dist/main.js'), 'tampered'); assert.throws(() => api.plan(f.release, f.project), /校验失败/);
  assert.equal(fs.readFileSync(path.join(f.plugin, 'dist/main.js'), 'utf8'), 'user edit');
  const manifest = JSON.parse(fs.readFileSync(path.join(f.release, 'release.json'))); manifest.files[0].path = '../outside';
  fs.writeFileSync(path.join(f.release, 'release.json'), JSON.stringify(manifest)); assert.throws(() => api.plan(f.release, f.project), /非法发布路径/);
});
test('中途失败自动恢复已替换文件，恢复不覆盖用户后续改动', t => {
  const f = fixture(t), plan = api.plan(f.release, f.project); let written = 0;
  assert.throws(() => api.applyPlan(plan, { afterWrite() { if (++written === 4) throw new Error('injected'); } }), /injected/);
  assert.equal(fs.readFileSync(path.join(f.plugin, 'dist/main.js'), 'utf8'), 'old main');
  const result = api.applyPlan(api.plan(f.release, f.project));
  fs.writeFileSync(path.join(f.plugin, 'dist/main.js'), 'later edit');
  assert.throws(() => api.restore(result.backup), /后续改动/);
  assert.equal(fs.readFileSync(path.join(f.plugin, 'dist/main.js'), 'utf8'), 'later edit');
});
