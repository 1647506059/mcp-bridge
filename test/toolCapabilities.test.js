const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { loadSource } = require('./sourceHarness');
const { getToolsList } = loadSource('tools/ToolRegistry.ts');
const { selectToolProfile } = loadSource('tools/ToolProfiles.ts');
const { resolveToolAlias } = loadSource('tools/ToolCapabilities.ts');
const { validateToolCall, validateExposedCall } = loadSource('tools/ToolValidation.ts');
const tools = getToolsList();

test('工具目录没有重复且所有必填字段都有schema，分类和脚本入口完整', () => {
  assert.equal(new Set(tools.map(tool => tool.name)).size, tools.length);
  for (const tool of tools) { assert.ok(tool.category); for (const key of tool.inputSchema.required || []) assert.ok(tool.inputSchema.properties[key], tool.name + '.' + key); }
  for (const name of ['add_component', 'remove_component', 'set_component_property', 'create_canvas', 'create_button', 'emit_node_event', 'simulate_button_click', 'read_file', 'get_tool_catalog', 'execute_javascript', 'execute_editor_script', 'execute_scene_script']) assert.ok(tools.some(tool => tool.name === name));
});

test('独立入口固定操作与类型，保留必要参数校验', () => {
  const alias = resolveToolAlias('set_component_property', { nodeId: 'n', componentType: 'cc.Label', propertyName: 'string', value: '文字', action: 'remove' });
  assert.equal(alias.name, 'manage_components'); assert.equal(alias.args.action, 'update'); assert.equal(alias.args.properties.string, '文字');
  assert.equal(resolveToolAlias('create_label', { type: 'button' }).args.type, 'label');
  assert.doesNotThrow(() => validateToolCall('add_component', { uuid: 'n', componentName: 'cc.Label' }, tools));
  assert.doesNotThrow(() => validateToolCall('inspect_component', { path: 'Canvas/Label', componentName: 'cc.Label' }, tools));
  assert.throws(() => validateToolCall('remove_component', { nodeId: 'n' }, tools), /componentType|componentId/);
  assert.throws(() => validateToolCall('write_script', { path: 'db://assets/a.js' }, tools), /content/);
});

test('操作白名单同步约束组合入口、独立别名与批处理', () => {
  const list = selectToolProfile(tools, { MCP_BRIDGE_TOOL_PROFILE: 'full', MCP_BRIDGE_TOOL_ACTIONS: JSON.stringify({ manage_components: ['get'] }) });
  assert.ok(list.some(tool => tool.name === 'list_components')); assert.ok(!list.some(tool => tool.name === 'add_component'));
  assert.throws(() => validateToolCall('manage_components', { nodeId: 'n', action: 'remove', componentType: 'cc.Label' }, list), /允许值/);
  assert.throws(() => validateExposedCall('batch_execute', { operations: [{ tool: 'manage_components', params: { nodeId: 'n', action: 'remove' } }] }, list), /未开放操作/);
  const readonly = selectToolProfile(tools, { MCP_BRIDGE_TOOL_PROFILE: 'readonly', MCP_BRIDGE_ENABLED_TOOLS: 'execute_javascript' });
  assert.ok(!readonly.some(tool => tool.name === 'execute_javascript')); assert.ok(readonly.some(tool => tool.name === 'batch_execute'));
});

test('工程预设在HTTP列表和直接调用中一致生效，修改后无需重启', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-exposure-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const Editor = { Project: { path: root } };
  const store = loadSource('tools/ToolPresetStore.ts');
  store.saveToolPresets(root, { version: 1, active: '只读', presets: [{ name: '只读', profile: 'custom', enabled: ['get_tool_catalog', 'manage_components', 'batch_execute'], disabled: [], actions: { manage_components: ['get'] } }] }, tools);
  const { McpRouter } = loadSource('core/McpRouter.ts', { Editor });
  const context = loadSource('core/ProjectContext.ts', { Editor });
  let response;
  McpRouter.handleRequest({ url: context.projectEndpoint(), method: 'POST', bodyString: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) }, { writeHead() {}, end(text) { response = JSON.parse(text); } });
  assert.equal(response.result.tools.length, 3);
  const { ToolDispatcher } = loadSource('tools/ToolDispatcher.ts', { Editor });
  let error;
  ToolDispatcher.handleMcpCall('execute_javascript', { context: 'editor', code: 'return 1;' }, failure => error = failure);
  assert.match(error, /未知工具/);
  ToolDispatcher.handleMcpCall('batch_execute', { operations: [{ tool: 'manage_components', params: { action: 'remove', nodeId: 'n' } }] }, failure => error = failure);
  assert.match(error, /未开放操作/);
  store.saveToolPresets(root, { version: 1, active: '全部', presets: [{ name: '全部', profile: 'full', enabled: [], disabled: [] }] }, tools);
  McpRouter.handleRequest({ url: '/list-tools', bodyString: '' }, { writeHead() {}, end(text) { response = JSON.parse(text); } });
  assert.equal(response.tools.length, tools.length);
});

test('文件工具拒绝跨工程路径和序列化资源文本写入，替换遵守预期次数', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-files-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const { executeProjectFile } = loadSource('tools/ProjectFiles.ts');
  await assert.rejects(executeProjectFile('read_file', { path: '../other.txt' }, root), /工程/);
  await assert.rejects(executeProjectFile('write_file', { path: 'assets/a.prefab', content: '[]' }, root), /专用/);
  await executeProjectFile('write_file', { path: 'docs/a.txt', content: '旧文字\n旧文字' }, root);
  await assert.rejects(executeProjectFile('replace_in_file', { path: 'docs/a.txt', search: '旧', replacement: '新', expectedCount: 1 }, root), /次数/);
  assert.equal(fs.readFileSync(path.join(root, 'docs/a.txt'), 'utf8'), '旧文字\n旧文字');
  const result = await executeProjectFile('replace_in_file', { path: 'docs/a.txt', search: '旧', replacement: '新', expectedCount: 2 }, root);
  assert.equal(result.replacements, 2);
});
