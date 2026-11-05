const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { loadSource } = require('./sourceHarness');

test('项目专属入口拒绝其他项目，旧入口写入要求匹配的实例凭证', () => {
    const project = loadSource('core/ProjectContext.ts', { Editor: { Project: { path: path.resolve('fixture-A') } } });
    const context = project.getProjectContext();
    assert.equal(project.projectRoute(project.projectEndpoint() + 'call-tool').scoped, true);
    assert.equal(project.projectRoute('/mcp/project/wrong/call-tool').status, 409);
    assert.equal(project.contextError({ name: 'get_project_info' }, false), null);
    assert.equal(project.contextError({ name: 'create_node' }, false), 'PROJECT_CONTEXT_REQUIRED');
    assert.equal(project.contextError({ name: 'create_node', arguments: { expected_context: context.expected_context } }, false), null);
    assert.equal(project.contextError({ name: 'create_node', arguments: { expected_context: context.project_id + ':old' } }, true), 'EDITOR_INSTANCE_CHANGED');
    assert.equal(project.contextError({ name: 'create_node', arguments: { expected_context: 'other:old' } }, true), 'PROJECT_CONTEXT_MISMATCH');
    assert.equal(project.contextError({ name: 'create_node' }, true), null);
    assert.ok(project.mutatesProject('batch_execute', { operations: [{ tool: 'create_node' }] }));
    assert.equal(project.mutatesProject('batch_execute', { operations: [{ tool: 'get_scene_hierarchy' }] }), false);
    assert.equal(project.contextError({ name: 'get_project_info', arguments: { expected_context: 'x' }, _meta: { expected_context: 'y' } }, false), 'PROJECT_CONTEXT_MISMATCH');
});

test('标准 HTTP MCP 初始化返回项目证据，工具调用保留 JSON-RPC id 与图像内容', () => {
    const { prepareMcpRequest } = loadSource('core/McpHttpGateway.ts');
    function call(body, url = '/') {
        const result = {};
        const req = { url, method: 'POST', bodyString: JSON.stringify(body) };
        const res = { writeHead(status) { result.status = status; }, end(text) { result.body = text && JSON.parse(text); } };
        const next = prepareMcpRequest(req, res, () => [{ name: 'probe' }]);
        return { result, next };
    }
    const init = call({ jsonrpc: '2.0', id: 3, method: 'initialize' }).result;
    assert.equal(init.body.id, 3); assert.ok(init.body.result.mcpBridge.context.expected_context);
    const tools = call({ jsonrpc: '2.0', id: 4, method: 'tools/list' }).result;
    assert.equal(tools.body.result.tools[0].name, 'probe');
    const request = call({ jsonrpc: '2.0', id: 'image', method: 'tools/call', params: { name: 'capture_editor_screenshot' } });
    assert.equal(request.next.req.url, '/call-tool');
    request.next.res.writeHead(200);
    request.next.res.end(JSON.stringify({ content: [{ type: 'image', mimeType: 'image/png', data: 'abc' }] }));
    assert.equal(request.result.body.id, 'image'); assert.equal(request.result.body.result.content[0].type, 'image');
    assert.ok(request.result.body.result.projectContext.expected_context);
    const conflict = call({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'probe' } });
    conflict.next.res.writeHead(409); conflict.next.res.end('{"error":"PROJECT_CONTEXT_REQUIRED"}');
    assert.match(conflict.result.body.error.message, /PROJECT_CONTEXT_REQUIRED/);
    assert.equal(call(null).result.body.error.code, -32600);
    assert.equal(call({ jsonrpc: '2.0', method: 'tools/call', params: { name: 'create_node' } }).result.body.error.code, -32600);
    assert.equal(call({ jsonrpc: '2.0', id: {}, method: 'tools/list' }).result.body.error.code, -32600);
    assert.equal(call({ jsonrpc: '2.0', method: 'notifications/initialized' }).result.status, 202);
});
