'use strict';
// 本地发布包：先 pack/plan，再 apply；只管理插件文件，不复制工程设置或 node_modules。
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const directories = ['src', 'dist', 'panel', 'scripts', 'test', 'docs'];
const rootFiles = ['package.json', 'package-lock.json', 'tsconfig.json', 'README.md', 'LICENSE', 'UPDATE_LOG.md'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const inside = (root, file) => { const rel = path.relative(root, file); return rel && rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel); };
function safe(root, relative) {
  if (typeof relative !== 'string' || relative.includes('\\') || relative.split('/').some(x => !x || x === '.' || x === '..')
      || !(rootFiles.includes(relative) || directories.includes(relative.split('/')[0]))) throw new Error('非法发布路径: ' + relative);
  const target = path.resolve(root, relative);
  if (!inside(root, target)) throw new Error('发布路径越界');
  for (let cursor = target; cursor !== root; cursor = path.dirname(cursor)) if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw new Error('不支持符号链接: ' + cursor);
  return target;
}
function files(root, relative) {
  const target = safe(root, relative);
  if (!fs.existsSync(target)) return [];
  return fs.statSync(target).isDirectory() ? fs.readdirSync(target).sort().flatMap(name => files(root, relative + '/' + name)) : [relative];
}
function digest(file) { return fs.existsSync(file) ? hash(fs.readFileSync(file)) : null; }
function write(file, bytes) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes); }
function replace(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.mcp-release-' + crypto.randomBytes(6).toString('hex');
  try { fs.writeFileSync(temp, bytes, { flag: 'wx' }); fs.renameSync(temp, file); }
  finally { if (fs.existsSync(temp)) fs.unlinkSync(temp); }
}
function readRelease(directory) {
  const root = fs.realpathSync(directory);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'release.json'), 'utf8'));
  if (manifest.schema !== 1 || manifest.name !== 'mcp-bridge' || !Array.isArray(manifest.files) || manifest.files.length > 2000) throw new Error('发布清单无效');
  const seen = new Set();
  for (const entry of manifest.files) {
    const file = safe(root, entry.path);
    if (seen.has(entry.path) || !/^[a-f0-9]{64}$/.test(entry.sha256) || digest(file) !== entry.sha256) throw new Error('发布文件校验失败: ' + entry.path);
    seen.add(entry.path);
  }
  for (const required of ['package.json', 'dist/main.js', 'dist/scene-script.js', 'dist/mcp-proxy.js', 'dist/build-info.json']) if (!seen.has(required)) throw new Error('发布文件缺失: ' + required);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const build = JSON.parse(fs.readFileSync(path.join(root, 'dist/build-info.json'), 'utf8'));
  if (pkg.name !== manifest.name || pkg.version !== manifest.version || build.version !== manifest.version || build.buildId !== manifest.buildId) throw new Error('发布版本或构建身份不一致');
  return { root, manifest };
}
function pack(source, output) {
  const root = fs.realpathSync(source), target = path.resolve(output);
  if (target === root || inside(root, target)) throw new Error('发布目录必须在源插件之外');
  if (fs.existsSync(target)) throw new Error('发布目录已存在，未覆盖');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const build = JSON.parse(fs.readFileSync(path.join(root, 'dist/build-info.json'), 'utf8'));
  const expected = require(path.join(root, 'scripts/build.js')).createBuildInfo(root);
  if (build.buildId !== expected.buildId || build.version !== pkg.version) throw new Error('dist 与当前源码不一致，请先构建插件');
  const manifest = { schema: 1, name: pkg.name, version: pkg.version, buildId: build.buildId, files: [] };
  const snapshots = [...rootFiles, ...directories].flatMap(name => files(root, name)).map(relative => ({ relative, bytes: fs.readFileSync(safe(root, relative)) }));
  fs.mkdirSync(target, { recursive: false });
  for (const { relative, bytes } of snapshots) { write(safe(target, relative), bytes); manifest.files.push({ path: relative, sha256: hash(bytes), bytes: bytes.length }); }
  fs.writeFileSync(path.join(target, 'release.json'), JSON.stringify(manifest, null, 2));
  readRelease(target);
  return { release: target, version: manifest.version, buildId: manifest.buildId, files: manifest.files.length };
}
function plan(release, project) {
  const { root, manifest } = readRelease(release);
  const projectRoot = fs.realpathSync(project);
  const metadata = JSON.parse(fs.readFileSync(path.join(projectRoot, 'project.json'), 'utf8'));
  if (metadata.version !== '2.4.15') throw new Error('仅支持 Cocos Creator 2.4.15 工程');
  const plugin = path.join(projectRoot, 'packages', 'mcp-bridge');
  if (!fs.existsSync(plugin) || fs.realpathSync(plugin) !== plugin) throw new Error('需要工程内已有的普通 mcp-bridge 目录');
  const pkg = JSON.parse(fs.readFileSync(path.join(plugin, 'package.json'), 'utf8'));
  if (pkg.name !== 'mcp-bridge') throw new Error('目标插件身份不匹配');
  const changes = manifest.files.map(entry => ({ path: entry.path, before: digest(safe(plugin, entry.path)), after: entry.sha256 })).filter(entry => entry.before !== entry.after);
  return { schema: 1, release: root, project: projectRoot, plugin, version: manifest.version, buildId: manifest.buildId,
    manifestHash: digest(path.join(root, 'release.json')), changes, preserves: ['settings', 'local', '.codex', '.mcp.json', 'node_modules', 'assets'] };
}
function applyPlan(input, hooks = {}) {
  const current = plan(input.release, input.project);
  if (JSON.stringify(current) !== JSON.stringify(input)) throw new Error('发布包或目标文件在预览后发生变化，请重新生成计划');
  if (!current.changes.length) return { changed: 0, buildId: current.buildId };
  const backupRoot = path.join(current.project, 'local', 'mcp-release-backups');
  for (const dir of [path.join(current.project, 'local'), backupRoot]) if (fs.existsSync(dir) && fs.lstatSync(dir).isSymbolicLink()) throw new Error('备份目录不能是符号链接');
  fs.mkdirSync(backupRoot, { recursive: true });
  const backup = fs.mkdtempSync(path.join(backupRoot, 'release-'));
  const recovery = { ...current, backup, applied: [], status: 'preparing' };
  const journal = path.join(backup, 'recovery.json');
  const save = () => replace(journal, JSON.stringify(recovery, null, 2));
  for (const entry of current.changes) if (entry.before !== null) write(safe(backup, entry.path), fs.readFileSync(safe(current.plugin, entry.path)));
  recovery.status = 'applying'; save();
  try {
    for (const entry of current.changes) {
      const target = safe(current.plugin, entry.path);
      if (digest(target) !== entry.before) throw new Error('目标文件在更新时发生变化: ' + entry.path);
      const bytes = fs.readFileSync(safe(current.release, entry.path));
      if (hash(bytes) !== entry.after) throw new Error('发布文件在更新时发生变化: ' + entry.path);
      // 先记录再写；即使进程被终止，也能用恢复清单定位可能变更的文件。
      recovery.applied.push(entry.path); save();
      replace(target, bytes);
      if (hooks.afterWrite) hooks.afterWrite(entry.path);
    }
    if (plan(current.release, current.project).changes.length) throw new Error('安装后文件校验失败');
    recovery.status = 'installed'; save();
    return { changed: current.changes.length, backup, buildId: current.buildId, loadedBuildVerified: false, reloadRequired: true };
  } catch (error) {
    recovery.status = 'failed'; recovery.error = error.message; save();
    try { restore(backup); } catch (restoreError) { error.message += '; 恢复未完成: ' + restoreError.message + '; 清单: ' + journal; }
    throw error;
  }
}
function restore(directory) {
  const backup = fs.realpathSync(directory), journal = path.join(backup, 'recovery.json');
  const recovery = JSON.parse(fs.readFileSync(journal, 'utf8'));
  const expected = path.join(fs.realpathSync(recovery.project), 'packages', 'mcp-bridge');
  if (recovery.plugin !== expected || fs.realpathSync(expected) !== expected || !inside(path.join(recovery.project, 'local/mcp-release-backups'), backup)) throw new Error('恢复路径校验失败');
  const applied = new Set(recovery.applied), entries = recovery.changes.filter(entry => applied.has(entry.path));
  // 全部预检后再恢复；不覆盖更新后用户的新改动。
  for (const entry of entries) {
    const now = digest(safe(expected, entry.path));
    if (now !== entry.after && now !== entry.before) throw new Error('文件有后续改动，未恢复: ' + entry.path);
    if (entry.before !== null && digest(safe(backup, entry.path)) !== entry.before) throw new Error('备份校验失败: ' + entry.path);
  }
  for (const entry of entries.reverse()) {
    const target = safe(expected, entry.path);
    if (digest(target) === entry.before) continue;
    if (entry.before === null) fs.unlinkSync(target);
    else replace(target, fs.readFileSync(safe(backup, entry.path)));
  }
  recovery.status = 'restored'; replace(journal, JSON.stringify(recovery, null, 2));
  return { restored: entries.length, project: recovery.project };
}
if (require.main === module) {
  try {
    const [command, a, b] = process.argv.slice(2); let result;
    if (command === 'pack' && a) result = pack(path.resolve(__dirname, '..'), a);
    else if (command === 'plan' && a && b) result = plan(a, b);
    else if (command === 'apply' && a) result = applyPlan(JSON.parse(fs.readFileSync(a, 'utf8').replace(/^\uFEFF/, '')));
    else if (command === 'restore' && a) result = restore(a);
    else throw new Error('用法: pack <新发布目录> | plan <发布目录> <工程目录> | apply <计划JSON文件> | restore <备份目录>');
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { pack, plan, applyPlan, restore, readRelease };
