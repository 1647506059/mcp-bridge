const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const esbuild = require('esbuild');

const root = path.resolve(__dirname, '..');
const entries = [
  ['main', ['ws', '@modelcontextprotocol/sdk', 'vue']],
  ['scene-script', []], ['panel/index', ['electron']], ['mcp-proxy', []],
];

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(file) : file.endsWith('.ts') ? [file] : [];
  });
}

// 同一份源码的标识保持稳定；构建时间单独记录，不能用磁盘上的新清单冒充已加载代码。
function createBuildInfo(projectRoot = root) {
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify({ esbuild: esbuild.version, typescript: require('typescript').version }) + '\0');
  const files = [...sourceFiles(path.join(projectRoot, 'src')), path.join(projectRoot, 'panel/index.html'), path.join(projectRoot, 'panel/index.css'), path.join(projectRoot, 'package.json'), ...['build.js', 'release-sync.js'].map(file => path.join(projectRoot, 'scripts', file)).filter(file => fs.existsSync(file))].sort();
  for (const file of files) {
    hash.update(path.relative(projectRoot, file).replace(/\\/g, '/') + '\0');
    hash.update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n') + '\0');
  }
  return { version: JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8')).version,
    buildId: hash.digest('hex'), builtAt: new Date().toISOString() };
}

function buildOptions(entry, external, info) {
  return { absWorkingDir: root, entryPoints: ['src/' + entry + '.ts'], bundle: true, platform: 'node', target: 'es2018',
    external, outfile: 'dist/' + entry + '.js', define: { __MCP_BRIDGE_BUILD__: JSON.stringify(info) } };
}

async function build(options = {}) {
  const info = createBuildInfo();
  const staging = path.join(root, '.dist-stage-' + crypto.randomBytes(8).toString('hex'));
  const previous = path.join(root, '.dist-previous-' + crypto.randomBytes(8).toString('hex'));
  const target = path.join(root, 'dist');
  fs.mkdirSync(staging);
  let moved = false, published = false;
  try {
    // 类型检查不可省略；检查通过后独立转译，避免整体 emit 再次跨模块推导。
    const typecheck = require('child_process').spawnSync(process.execPath,
      [require.resolve('typescript/bin/tsc'), '--noEmit'], { cwd: root, encoding: 'utf8' });
    if (typecheck.status !== 0) throw new Error(typecheck.stdout + typecheck.stderr);
    // 动态 require 的兼容模块也先生成在隔离目录，最终目录始终只含一个构建。
    const ts = require('typescript');
    for (const file of sourceFiles(path.join(root, 'src')).filter(file => !file.endsWith('.d.ts'))) {
      const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), { fileName: file, reportDiagnostics: true,
        compilerOptions: { target: ts.ScriptTarget.ES2018, module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
      if (output.diagnostics?.length) throw new Error(ts.formatDiagnosticsWithColorAndContext(output.diagnostics, {
        getCanonicalFileName: value => value, getCurrentDirectory: () => root, getNewLine: () => '\n' }));
      const destination = path.join(staging, path.relative(path.join(root, 'src'), file).replace(/\.ts$/, '.js'));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, output.outputText);
    }
    for (const [entry, external] of entries) {
      await (options.bundle || esbuild.build)({ ...buildOptions(entry, external, info), outfile: path.join(staging, entry + '.js') });
    }
    fs.writeFileSync(path.join(staging, 'build-info.json'), JSON.stringify(info, null, 2) + '\n');
    if (fs.existsSync(target)) { fs.renameSync(target, previous); moved = true; }
    try { fs.renameSync(staging, target); published = true; }
    catch (err) { if (moved) { fs.renameSync(previous, target); moved = false; } throw err; }
    process.stdout.write('MCP ' + info.version + ' build ' + info.buildId + '\n');
  } finally {
    if (!published && fs.existsSync(staging)) fs.rmSync(staging, { recursive: true, force: true });
    if (published && moved) fs.rmSync(previous, { recursive: true, force: true });
  }
  return info;
}

if (require.main === module) build().catch(error => { console.error(error); process.exitCode = 1; });
module.exports = { entries, createBuildInfo, buildOptions, build };
