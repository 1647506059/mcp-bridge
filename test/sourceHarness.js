const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const ts = require('typescript');

function loadSource(relative, globals = {}, mocks = {}) {
  const filename = path.join(__dirname, '..', 'src', relative);
  const module = { exports: {} };
  const nativeRequire = createRequire(filename);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2018, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, {
    module, exports: module.exports, Buffer, console, setTimeout, clearTimeout, setInterval, clearInterval,
    __dirname: path.dirname(filename), __filename: filename,
    require: (name) => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      const source = path.resolve(path.dirname(filename), name + '.ts');
      if (name.startsWith('.') && fs.existsSync(source)) return loadSource(path.relative(path.join(__dirname, '..', 'src'), source), globals, mocks);
      return nativeRequire(name);
    },
    ...globals,
  }, { filename });
  return module.exports;
}

function fakeClock() {
  let now = 0;
  const timers = new Set();
  return {
    setTimeout(fn, ms) { const timer = { fn, at: now + ms }; timers.add(timer); return timer; },
    clearTimeout(timer) { timers.delete(timer); },
    tick(ms) {
      const end = now + ms;
      for (;;) {
        const next = [...timers].filter(t => t.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        timers.delete(next); now = next.at; next.fn();
      }
      now = end;
    },
  };
}

module.exports = { loadSource, fakeClock };
