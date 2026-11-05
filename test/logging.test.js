const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const { loadSource } = require('./sourceHarness');

test('大参数摘要按字段限量，不执行getter，不修改输入且保留Unicode', () => {
  const { formatLogPreview } = loadSource('utils/LogPreview.ts');
  const input = { string: '中🙂'.repeat(400000), many: Array(100000).fill('test') };
  Object.defineProperty(input, 'getter', { enumerable: true, get() { assert.fail('getter'); } });
  const result = formatLogPreview(input);
  assert.ok(Buffer.byteLength(result) < 8000); assert.match(result, /length:/);
  assert.equal(input.many.length, 100000); assert.doesNotMatch(result, /\ud83d(?!\ude42)/u);
});

test('日志立即展示而文件异步合并写入，运行中轮转且flush排空', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-logs-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const panel = []; let appends = 0;
  const { Logger } = loadSource('core/Logger.ts', { Editor: { assetdb: { urlToFspath: () => path.join(root, 'assets') }, Ipc: { sendToPanel: (...r) => panel.push(r) } } }, {
    fs: { ...fs, appendFileSync() { assert.fail('hot-path synchronous append'); },
      promises: { ...fs.promises, appendFile: (...args) => { appends++; return fs.promises.appendFile(...args); } } },
  });
  for (let i = 0; i < 50; i++) Logger.info('message-' + i);
  assert.equal(panel.length, 50); assert.equal(appends, 0);
  await Logger.flush(); assert.equal(appends, 1);
  const log = path.join(root, 'settings/mcp-bridge.log');
  assert.match(fs.readFileSync(log, 'utf8'), /message-49/);
  fs.writeFileSync(log, 'x'.repeat(2 * 1024 * 1024));
  Logger.info('after rotation'); await Logger.flush();
  assert.equal(fs.existsSync(log + '.old'), true); assert.match(fs.readFileSync(log, 'utf8'), /after rotation/);
});

test('单条日志与内存缓存有字节边界，文件失败不影响调用并明确记入缓存', async () => {
  const { Logger } = loadSource('core/Logger.ts', { Editor: { assetdb: { urlToFspath: () => '/virtual/assets' } } }, {
    fs: { existsSync: () => true, promises: { stat: async () => { throw new Error('denied'); } } },
  });
  for (let i = 0; i < 700; i++) Logger.info('中'.repeat(10000));
  assert.ok(Buffer.byteLength(Logger.getLogContent()) < 2.2 * 1024 * 1024);
  await Logger.flush(); assert.match(Logger.getLogContent(), /日志文件写入失败/);
});

test('路径未就绪或短暂写盘失败保留批次，恢复后按顺序落盘', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-log-retry-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  let ready = false, fail = true;
  const { Logger } = loadSource('core/Logger.ts', { Editor: { assetdb: { urlToFspath: () => ready ? path.join(root, 'assets') : null } } }, {
    fs: { ...fs, promises: { ...fs.promises, appendFile: async (...args) => { if (fail) throw new Error('busy'); return fs.promises.appendFile(...args); } } },
  });
  Logger.info('first'); await Logger.flush(); ready = true;
  Logger.info('second'); await Logger.flush(); fail = false;
  await Logger.flush(); const text = fs.readFileSync(path.join(root, 'settings/mcp-bridge.log'), 'utf8');
  assert.match(text, /first[\s\S]*second/); assert.equal(text.split('first').length - 1, 1);
});
