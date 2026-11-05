const assert = require('node:assert/strict');
const { test } = require('node:test');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { loadSource } = require('./sourceHarness');
const logger = { error() {}, warn() {}, success() {}, info() {} };

test('真实 HTTP 专属地址支持 MCP 初始化、读写与错误实例拒绝，坏 Host 不停止健康服务', async t => {
    const globals = { Editor: { Project: { path: path.resolve('fixture-http') }, Ipc: { sendToPanel() {} } } };
    const context = loadSource('core/ProjectContext.ts', globals);
    const { prepareMcpRequest } = loadSource('core/McpHttpGateway.ts', globals, { './ProjectContext': context });
    const { HttpServer } = loadSource('core/HttpServer.ts', globals, { './Logger': { Logger: logger } });
    let writes = 0;
    const handler = (req, res) => {
        const prepared = prepareMcpRequest(req, res, () => []); if (!prepared) return;
        const params = JSON.parse(prepared.req.bodyString);
        const error = context.contextError(params, prepared.req.projectScoped);
        prepared.res.writeHead(error ? 409 : 200);
        if (!error) writes++;
        prepared.res.end(JSON.stringify(error ? { error } : { content: [{ type: 'text', text: 'ok' }] }));
    };
    const port = await new Promise(resolve => HttpServer.start(0, handler, resolve));
    t.after(() => HttpServer.stop());
    async function request(route, body) {
        const response = await fetch('http://127.0.0.1:' + port + route, { method: 'POST', headers: { 'content-type': 'application/json', Connection: 'close' }, body: JSON.stringify(body) });
        return { status: response.status, body: await response.json() };
    }
    const root = context.projectEndpoint();
    const init = await request(root, { jsonrpc: '2.0', id: 1, method: 'initialize' });
    const pin = init.body.result.mcpBridge.context.expected_context;
    assert.equal(init.body.result.mcpBridge.context.project_path, globals.Editor.Project.path);
    assert.equal((await request('/mcp/project/foreign/', { jsonrpc: '2.0', id: 2, method: 'initialize' })).status, 409);
    assert.equal((await request('/call-tool', { name: 'create_node' })).body.error, 'PROJECT_CONTEXT_REQUIRED');
    assert.equal((await request('/call-tool', { name: 'create_node', arguments: { expected_context: pin } })).status, 200);
    const result = await request(root, { jsonrpc: '2.0', id: 'write', method: 'tools/call', params: { name: 'create_node' } });
    assert.equal(result.body.id, 'write'); assert.equal(result.body.result.content[0].text, 'ok');
    const stale = await request(root, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'create_node', arguments: { expected_context: context.getProjectContext().project_id + ':old' } } });
    assert.match(stale.body.error.message, /EDITOR_INSTANCE_CHANGED/); assert.equal(writes, 2);
    assert.throws(() => HttpServer.start(port, handler, undefined, 'http://bad/'), /Host/);
    assert.equal(HttpServer.config.active, true);
    assert.equal((await request(root, { jsonrpc: '2.0', id: 5, method: 'ping' })).body.id, 5);
});

test('Host 不存在时保留原始错误，不切换地址或抛出插件加载异常', () => {
    const server = new EventEmitter(); server.close = () => {}; server.listen = () => server.emit('error', { code: 'EADDRNOTAVAIL', message: 'host unavailable' });
    const { HttpServer } = loadSource('core/HttpServer.ts', {}, { './Logger': { Logger: logger }, http: { createServer: () => server } });
    assert.doesNotThrow(() => HttpServer.start(8200, () => {}, undefined, '192.0.2.123'));
    assert.equal(HttpServer.config.active, false); assert.equal(HttpServer.config.startError, 'host unavailable');
    assert.equal(HttpServer.config.host, '192.0.2.123');
});
