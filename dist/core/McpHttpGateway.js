"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prepareMcpRequest = prepareMcpRequest;
const ProjectContext_1 = require("./ProjectContext");
const BuildInfo_1 = require("./BuildInfo");
/** 在原有 HTTP 接口外适配标准 MCP JSON-RPC，保留 stdio 代理的接口。 */
function prepareMcpRequest(req, res, tools) {
    const context = (0, ProjectContext_1.getProjectContext)(), route = (0, ProjectContext_1.projectRoute)(req.url || "/", context);
    if (route.error) {
        res.writeHead(route.status);
        res.end(JSON.stringify({ error: route.error, projectContext: context }));
        return null;
    }
    req.projectScoped = route.scoped;
    req.url = route.path;
    if (!["/", "/mcp", "/mcp/"].includes(req.url))
        return { req, res };
    if (req.method && req.method !== "POST") {
        res.writeHead(405);
        res.end(JSON.stringify({ error: "使用 POST 调用 MCP" }));
        return null;
    }
    let rpc;
    try {
        rpc = JSON.parse(req.bodyString || "{}");
    }
    catch (_) {
        res.writeHead(400);
        res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON" } }));
        return null;
    }
    const reply = (result, error) => { var _a; res.writeHead(200); res.end(JSON.stringify({ jsonrpc: "2.0", id: (_a = rpc === null || rpc === void 0 ? void 0 : rpc.id) !== null && _a !== void 0 ? _a : null, ...(error ? { error } : { result }) })); };
    if (!rpc || typeof rpc !== "object" || Array.isArray(rpc) || rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string"
        || (rpc.id !== undefined && rpc.id !== null && !["string", "number"].includes(typeof rpc.id))
        || (rpc.method === "tools/call" && rpc.id === undefined)) {
        reply(undefined, { code: -32600, message: "Invalid Request" });
        return null;
    }
    if (rpc.method === "initialize") {
        reply({ protocolVersion: "2024-11-05", serverInfo: { name: "cocos-bridge", version: BuildInfo_1.BUILD_INFO.version }, capabilities: { tools: {} },
            mcpBridge: { context, endpoint: (0, ProjectContext_1.projectEndpoint)(context) },
            instructions: "写入前独立核对 mcpBridge.context.project_path 与 project_id。旧 HTTP 入口写入需 expected_context；显式凭证会检测编辑器重载。拖拽回执不代表游戏接受输入。" });
        return null;
    }
    if (rpc.id === undefined && rpc.method.startsWith("notifications/")) {
        res.writeHead(202);
        res.end();
        return null;
    }
    if (rpc.method === "ping") {
        reply({});
        return null;
    }
    if (rpc.method === "tools/list") {
        try {
            reply({ tools: tools() });
        }
        catch (err) {
            reply(undefined, { code: -32603, message: "工具预设读取失败: " + err.message });
        }
        return null;
    }
    if (rpc.method !== "tools/call") {
        reply(undefined, { code: -32601, message: "Method not found" });
        return null;
    }
    if (!rpc.params || typeof rpc.params.name !== "string" || (rpc.params.arguments !== undefined && (!rpc.params.arguments || typeof rpc.params.arguments !== "object" || Array.isArray(rpc.params.arguments)))) {
        reply(undefined, { code: -32602, message: "Invalid tool arguments" });
        return null;
    }
    req.url = "/call-tool";
    req.bodyString = JSON.stringify(rpc.params);
    let status = 200;
    return { req, res: {
            get destroyed() { return res.destroyed; },
            writeHead(value) { status = value; },
            end(body) {
                let value;
                try {
                    value = JSON.parse(body);
                }
                catch (_) {
                    value = { error: String(body) };
                }
                if (status !== 200)
                    reply(undefined, { code: -32000, message: value.error || "HTTP " + status, data: value });
                else
                    reply({ ...value, projectContext: context });
            },
        } };
}
