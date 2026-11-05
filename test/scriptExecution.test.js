const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource, fakeClock } = require('./sourceHarness');
const { startJavascript, validateJavascript } = loadSource('tools/ScriptExecution.ts');

for (const code of ['return args.value + 1;', 'async function run(env) { await Promise.resolve(); return env.args.value + 1; }', 'module.exports = async ({args}) => args.value + 1;', 'exports.run = ({args}) => args.value + 1;']) {
  test('通用脚本支持返回与异步导出：' + code.slice(0, 30), async () => {
    const packet = await startJavascript({ code, args: { value: 4 } }, { context: 'editor' }).completion;
    assert.equal(packet.data, 5); assert.equal(packet.error, undefined); assert.equal(packet.execution.context, 'editor');
  });
}

test('脚本日志独立限量，错误携带日志且不污染宿主控制台', async () => {
  const packet = await startJavascript({ code: 'for (let i=0;i<60;i++) console.log("消息", i); throw new Error("失败");' }, { context: 'scene' }).completion;
  assert.equal(packet.error.message, '失败'); assert.equal(packet.execution.logs.length, 50); assert.equal(packet.execution.logsOmitted, 10);
});

test('循环引用和getter安全裁剪，同步死循环在截止后返回错误', async () => {
  const packet = await startJavascript({ code: 'const a={}; a.self=a; Object.defineProperty(a,"bad",{enumerable:true,get(){throw Error("不应访问");}}); return a;' }, { context: 'editor' }).completion;
  assert.equal(packet.data.self, '[Circular]'); assert.equal(packet.data.bad, '[Accessor]'); assert.equal(packet.truncated, true);
  const timeout = await startJavascript({ code: 'while(true) {}', timeoutMs: 100 }, { context: 'editor' }).completion;
  assert.match(timeout.error.message, /timed out/);
});

test('静态检查可明确覆盖，空脚本与大脚本仍拒绝', () => {
  assert.throws(() => validateJavascript({ code: 'require("child_process")' }), /静态检查/);
  assert.doesNotThrow(() => validateJavascript({ code: 'return require("child_process");', safety_checks: false }));
  assert.throws(() => validateJavascript({ code: '' })); assert.throws(() => validateJavascript({ code: '中'.repeat(100000) }));
});

test('editor脚本异步超时不释放执行锁，真实结束后仅释放一次且不重复回复', async () => {
  const clock = fakeClock(); let finish, released = 0, tracked = 0, blocked = '', replies = [];
  const completion = new Promise(resolve => finish = resolve);
  const { ToolDispatcher } = loadSource('tools/ToolDispatcher.ts', { Editor: { Project: { path: process.cwd() } }, ...clock }, {
    './ScriptExecution': { SCRIPT_TOOLS: ['execute_javascript'], validateJavascript() {}, startJavascript: () => ({ timeout: 100, completion, snapshot: () => ({ context: 'editor', logs: [] }) }) },
    '../core/CommandQueue': { CommandQueue: { trackEditorOperation() { tracked++; return () => released++; }, blockPending(reason) { blocked = reason; } } },
  });
  ToolDispatcher.executeJavascript('execute_javascript', { context: 'editor', code: 'await pending;' }, (error, result) => replies.push({ error, result }));
  assert.equal(tracked, 1); clock.tick(100); assert.equal(replies.length, 1); assert.equal(released, 0); assert.ok(blocked); assert.equal(replies[0].result.pending, true);
  finish({ data: 123 }); await new Promise(setImmediate); assert.equal(released, 1); assert.equal(replies.length, 1);
});

test('scene脚本通过场景IPC执行并传播脚本错误', async () => {
  let called;
  const { ToolDispatcher } = loadSource('tools/ToolDispatcher.ts', { Editor: {} }, {
    '../core/CommandQueue': { CommandQueue: { callSceneScriptWithTimeout(plugin, method, args, done, timeout) { called = { plugin, method, timeout }; done(null, { error: { message: '场景失败' }, execution: { logs: [] } }); } } },
  });
  const result = await new Promise(resolve => ToolDispatcher.executeJavascript('execute_scene_script', { code: 'throw Error("场景失败");', timeoutMs: 100 }, (error, packet) => resolve({ error, packet })));
  assert.equal(called.method, 'execute-javascript'); assert.equal(called.timeout, 350); assert.equal(result.error, '场景失败');
});
