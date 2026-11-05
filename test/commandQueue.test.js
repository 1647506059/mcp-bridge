const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource, fakeClock } = require('./sourceHarness');

function setup(Editor = {}) {
  const clock = fakeClock();
  const { CommandQueue } = loadSource('core/CommandQueue.ts', { ...clock, Editor }, {
    './Logger': { Logger: { warn() {}, error() {} } },
  });
  return { Q: CommandQueue, clock };
}

test('排队时间不计入执行超时，重复 done 不会提前启动后续指令', async () => {
  const { Q, clock } = setup(); const events = []; let firstDone, secondDone;
  const first = Q.enqueue(done => { events.push(1); firstDone = done; });
  clock.tick(30000);
  const second = Q.enqueue(done => { events.push(2); secondDone = done; });
  clock.tick(20000); firstDone(); await first;
  clock.tick(10001);
  assert.equal(Q.isProcessingCommand, true);
  const third = Q.enqueue(done => { events.push(3); done(); });
  firstDone(); assert.deepEqual(events, [1, 2]);
  secondDone(); await Promise.all([second, third]); assert.deepEqual(events, [1, 2, 3]);
});

test('执行超时拒绝等待与新增指令，真实完成后才恢复队列', async () => {
  const { Q, clock } = setup(); let finish; const events = [];
  const active = Q.enqueue(done => { events.push(1); finish = done; }, () => events.push('timeout'));
  const waiting = Q.enqueue(done => { events.push(2); done(); }).then(() => null, e => String(e));
  clock.tick(60000); await active;
  assert.match(await waiting, /超时/);
  await assert.rejects(Q.enqueue(done => done()), /超时/);
  assert.deepEqual(events, [1, 'timeout']);
  finish(); finish(); await Q.enqueue(done => { events.push(3); done(); });
  assert.deepEqual(events, [1, 'timeout', 3]);
});

test('scene IPC 自身超时后也不能越过仍在执行的场景操作', async () => {
  let editorReply; const { Q, clock } = setup({ Scene: { callSceneScript(...args) { editorReply = args.at(-1); } } });
  let result; const events = [];
  const active = Q.enqueue(done => {
    Q.callSceneScriptWithTimeout('mcp-bridge', 'save-scene', {}, err => { result = err; done(); });
  });
  const waiting = Q.enqueue(done => { events.push('unsafe'); done(); }).then(() => null, e => String(e));
  clock.tick(15000); await active;
  assert.match(result, /超时/); assert.match(await waiting, /超时/);
  await assert.rejects(Q.enqueue(done => done()), /超时/); assert.deepEqual(events, []);
  editorReply(null, 'late success');
  await Q.enqueue(done => { events.push('recovered'); done(); });
  assert.deepEqual(events, ['recovered']);
});
