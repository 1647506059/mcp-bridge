const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource } = require('./sourceHarness');
const { fakeClock } = require('./sourceHarness');
const { executeBatch } = loadSource('tools/BatchOperations.ts');
const { getToolsList } = loadSource('tools/ToolRegistry.ts');
const op = (name = 'a') => ({ tool: 'create_node', params: { name, returnDetails: true } });
const run = (args, dispatch) => new Promise(resolve => executeBatch(args, getToolsList(), dispatch, (error, result) => resolve({ error, result })));

test('整批预检拦住后续参数错误、未知工具、嵌套批处理和非法引用，之前操作也不执行', async () => {
  for (const invalid of [
    { tool: 'create_node', params: {} }, { tool: 'create_node', params: { name: 3 } },
    { tool: 'create_node', params: { name: 'b', type: 'bad' } },
    { tool: 'unknown', params: {} }, { tool: 'batch_execute', params: { operations: [op()] } },
    { tool: 'create_node', params: { name: 'b', parentId: { $ref: 'future.uuid' } } },
    { tool: 'manage_components', params: { action: 'add', nodeId: 'a' } },
    { tool: 'manage_components', params: { action: 'get', nodeIds: [] } },
  ]) {
    let calls = 0;
    const r = await run({ operations: [op(), invalid] }, () => calls++);
    assert.match(r.error, /预检失败/); assert.equal(calls, 0);
  }
  for (const operations of [null, {}, [], Array(101).fill(op())]) {
    const r = await run({ operations }, () => assert.fail('must not run')); assert.match(r.error, /预检失败/);
  }
});

test('引用已完成操作的结构化返回值，保留顺序且不修改输入', async () => {
  const args = { operations: [{ ...op('parent'), id: 'parent' },
    { ...op('child'), params: { name: 'child', parentId: { $ref: 'parent.uuid' } } }] };
  const seen = [];
  const r = await run(args, (tool, params, cb) => { seen.push(params); cb(null, { uuid: params.name + '-uuid' }); });
  assert.equal(r.error, null); assert.equal(seen[1].parentId, 'parent-uuid');
  assert.equal(args.operations[1].params.parentId.$ref, 'parent.uuid'); assert.equal(r.result.length, 2);
});

test('默认失败停止并保留已执行结果；显式继续仍返回整体失败，失败引用不会执行', async () => {
  for (const stopOnError of [undefined, false]) {
    let calls = 0;
    const r = await run({ stopOnError, operations: [{ ...op(), id: 'failed' },
      { tool: 'set_node_name', params: { id: { $ref: 'failed.uuid' }, newName: 'never' } }, op('independent')] },
      (tool, params, cb) => { calls++; cb(calls === 1 ? new Error('broken') : null, { uuid: 'ok' }); });
    assert.ok(r.error); assert.equal(calls, stopOnError === false ? 2 : 1);
    assert.equal(r.result.length, stopOnError === false ? 3 : 1);
    assert.match(r.result[0].error, /broken/);
    if (stopOnError === false) assert.match(r.result[1].error, /未成功/);
  }
});

test('资源根目录只允许只读查询，写入类操作在预检阶段被拒', () => {
  const { validateConditional } = loadSource('tools/BatchOperations.ts');
  const { validateAssetUrl } = loadSource('utils/AssetUrl.ts');
  for (const url of ['db://assets', 'db://assets/scene/load.fire']) assert.equal(validateAssetUrl(url), url);
  for (const url of ['db://assets/../x', 'db://other/x', 'assets/x']) assert.throws(() => validateAssetUrl(url));
  for (const action of ['get_info', 'read']) assert.doesNotThrow(() => validateConditional('manage_asset', { action, path: 'db://assets' }));
  for (const [tool, params] of [
    ['manage_asset', { action: 'delete', path: 'db://assets' }],
    ['manage_asset', { action: 'create', path: 'db://assets' }],
    ['manage_asset', { action: 'move', path: 'db://assets/scene/load.fire', targetPath: 'db://assets' }],
    ['scene_management', { action: 'delete', path: 'db://assets' }],
  ]) assert.throws(() => validateConditional(tool, params), /资源根目录/);
});

test('异步写入严格串行，重复回调不重复执行后续操作', async () => {
  let firstReply, active = 0, count = 0;
  const pending = run({ operations: [op(), op()] }, (tool, params, cb) => {
    assert.equal(active++, 0); count++;
    if (count === 1) firstReply = () => { active--; cb(null, 'first'); cb(null, 'duplicate'); };
    else { active--; cb(null, 'second'); }
  });
  assert.equal(count, 1); firstReply();
  const r = await pending; assert.equal(count, 2); assert.equal(r.result.length, 2); assert.equal(r.error, null);
});

test('引用结果再次校验类型和路径，拒绝原型路径及重复 id', async () => {
  for (const result of [{}, { uuid: 123 }]) {
    let count = 0;
    const r = await run({ operations: [{ ...op(), id: 'root' },
      { tool: 'set_node_name', params: { id: { $ref: 'root.uuid' }, newName: 'child' } }] },
      (tool, params, cb) => { count++; cb(null, result); });
    assert.ok(r.error); assert.equal(count, 1);
  }
  for (const operations of [[{ ...op(), id: 'same' }, { ...op(), id: 'same' }],
    [{ ...op(), id: 'root' }, { tool: 'set_node_name', params: { id: { $ref: 'root.__proto__.uuid' }, newName: 'x' } }]]) {
    assert.match((await run({ operations }, () => assert.fail())).error, /预检失败/);
  }
});

test('整批超过 60 秒后迟到回调不会启动后续写入，即使允许继续', async () => {
  const clock = fakeClock();
  let lateReply, writes = 0, completed;
  const mocks = {
    './Logger': { Logger: { error() {}, warn() {} } },
    '../core/Logger': {}, '../utils/AssetPatcher': {}, '../utils/OfflinePrefabEditor': {},
    '../core/McpWrappers': {}, './EditorSceneTools': {},
  };
  const { CommandQueue } = loadSource('core/CommandQueue.ts', clock, mocks);
  mocks['../core/CommandQueue'] = { CommandQueue };
  const { ToolDispatcher } = loadSource('tools/ToolDispatcher.ts', {
    Editor: { Ipc: { sendToPanel() { writes++; } } }, ...clock,
  }, mocks);
  ToolDispatcher.manageAsset = (args, cb) => { writes++; lateReply = cb; };
  await CommandQueue.enqueue(done => {
    ToolDispatcher.batchExecute({ stopOnError: false, operations: [
      { tool: 'manage_asset', params: { action: 'create', path: 'db://assets/slow.txt' } }, op('blocked'),
    ] }, (error, result) => { completed = { error, result }; done(); });
    clock.tick(60000);
  });
  assert.equal(writes, 1); lateReply(null, 'late');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(writes, 1); assert.ok(completed.error); assert.match(completed.result[1].error, /超时/);
});

test('批内重命名保留 Undo 消息路径，但等待节点存在及名称读回确认', async () => {
  let readReply; const sent = [], reads = [];
  const { ToolDispatcher } = loadSource('tools/ToolDispatcher.ts', {
    Editor: { Ipc: { sendToPanel: (...args) => sent.push(args) } },
  }, {
    '../core/Logger': {}, '../utils/AssetPatcher': {}, '../utils/OfflinePrefabEditor': {},
    '../core/McpWrappers': {}, './EditorSceneTools': {},
    '../core/CommandQueue': { CommandQueue: { getBlockedReason: () => '', trackEditorOperation: () => () => {}, callSceneScriptWithTimeout(pkg, method, args, cb) { reads.push(args.id); readReply = cb; } } },
  });
  let reply;
  ToolDispatcher.batchExecute({ operations: [{ tool: 'set_node_name', params: { id: 'real', newName: 'new' } }] }, (err, result) => { reply = { err, result }; });
  assert.equal(sent.length, 0); readReply(null, { name: 'old' });
  assert.equal(sent[0][1], 'scene:set-property'); assert.equal(reply, undefined);
  readReply(null, { name: 'new' }); await new Promise(resolve => setImmediate(resolve));
  assert.equal(reply.err, null); assert.equal(reads.length, 2);
  reply = undefined;
  ToolDispatcher.batchExecute({ operations: [{ tool: 'set_node_name', params: { id: 'missing', newName: 'no' } }, op()] }, (err, result) => { reply = { err, result }; });
  readReply(new Error('找不到节点')); assert.ok(reply.err); assert.equal(sent.length, 1); assert.equal(reply.result.length, 1);
});
