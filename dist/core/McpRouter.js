"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpRouter = void 0;
const Logger_1 = require("./Logger");
const CommandQueue_1 = require("./CommandQueue");
const ToolRegistry_1 = require("../tools/ToolRegistry");
const ToolDispatcher_1 = require("../tools/ToolDispatcher");
const McpWrappers_1 = require("./McpWrappers");
const HttpServer_1 = require("./HttpServer");
const BuildInfo_1 = require("./BuildInfo");
const LogPreview_1 = require("../utils/LogPreview");
const CallActivity_1 = require("./CallActivity");
const ProjectContext_1 = require("./ProjectContext");
const McpHttpGateway_1 = require("./McpHttpGateway");
const ToolPresetStore_1 = require("../tools/ToolPresetStore");
function exposedTools() { return (0, ToolPresetStore_1.configuredTools)((0, ProjectContext_1.getProjectContext)().project_path, (0, ToolRegistry_1.getToolsList)()); }
class McpRouter {
    static handleRequest(req, res) {
        const prepared = (0, McpHttpGateway_1.prepareMcpRequest)(req, res, exposedTools);
        if (!prepared)
            return;
        req = prepared.req;
        res = prepared.res;
        const url = req.url;
        const body = req.bodyString; // 附加在请求上的 body 字符串
        if (url === "/list-tools") {
            try {
                const tools = exposedTools();
                Logger_1.Logger.info(`AI Client requested tool list`);
                res.writeHead(200);
                return res.end(JSON.stringify({ tools }));
            }
            catch (err) {
                res.writeHead(500);
                return res.end(JSON.stringify({ error: "工具预设读取失败: " + err.message }));
            }
        }
        if (url === "/mcp-status") {
            try {
                const projectPath = global.Editor ? global.Editor.Project.path : process.cwd();
                res.writeHead(200);
                res.end(JSON.stringify({
                    port: HttpServer_1.HttpServer.config.port,
                    projectName: require('path').basename(projectPath),
                    projectPath: projectPath,
                    projectContext: (0, ProjectContext_1.getProjectContext)(), endpoint: (0, ProjectContext_1.projectEndpoint)(),
                    mcp: (0, BuildInfo_1.getRuntimeInfo)("editor", __filename)
                }));
            }
            catch (e) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: String(e) }));
            }
            return;
        }
        if (url === "/mcp-diagnostics") {
            res.writeHead(200);
            return res.end(JSON.stringify({ editor: (0, BuildInfo_1.getRuntimeInfo)("editor", __filename), queue: CommandQueue_1.CommandQueue.snapshot() }));
        }
        if (url === "/list-resources") {
            const resources = McpWrappers_1.McpWrappers.getResourcesList();
            Logger_1.Logger.info(`AI Client requested resource list`);
            res.writeHead(200);
            return res.end(JSON.stringify({ resources: resources }));
        }
        if (url === "/read-resource") {
            try {
                const { uri } = JSON.parse(body || "{}");
                Logger_1.Logger.mcp(`READ -> [${uri}]`);
                McpWrappers_1.McpWrappers.handleReadResource(uri, (err, content) => {
                    if (err) {
                        Logger_1.Logger.error(`读取失败: ${err}`);
                        res.writeHead(500);
                        return res.end(JSON.stringify({ error: err }));
                    }
                    Logger_1.Logger.success(`读取成功: ${uri}`);
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        contents: [
                            {
                                uri: uri,
                                mimeType: "application/json",
                                text: typeof content === "string" ? content : JSON.stringify(content),
                            },
                        ],
                    }));
                });
            }
            catch (e) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: e.message }));
            }
            return;
        }
        if (url === "/call-tool") {
            try {
                const params = JSON.parse(body || "{}");
                const { name, arguments: args = {} } = params;
                const error = (0, ProjectContext_1.contextError)(params, !!req.projectScoped);
                if (error) {
                    res.writeHead(409);
                    return res.end(JSON.stringify({ error, projectContext: (0, ProjectContext_1.getProjectContext)() }));
                }
                const activity = new CallActivity_1.CallActivity(name, args);
                if ((name === "build_project" && args.action === "status") || (["simulate_mouse_drag", "simulate_mouse_click"].includes(name) && ["status", "cancel"].includes(args.action))) {
                    activity.start();
                    ToolDispatcher_1.ToolDispatcher.handleMcpCall(name, args, (err, result) => {
                        res.writeHead(200);
                        res.end(JSON.stringify({ projectContext: (0, ProjectContext_1.getProjectContext)(), isError: !!err, structuredContent: activity.finish(err, result), content: [{ type: "text", text: JSON.stringify(result || { error: String(err) }) }] }));
                    });
                    return;
                }
                if (name === "get_project_info" && args.includeMcpDiagnostics && (CommandQueue_1.CommandQueue.snapshot().processing || CommandQueue_1.CommandQueue.getBlockedReason())) {
                    const queue = CommandQueue_1.CommandQueue.snapshot();
                    res.writeHead(200);
                    return res.end(JSON.stringify({ structuredContent: activity.finish(null, null), content: [{ type: "text", text: JSON.stringify({ path: Editor.Project.path, queue,
                                    mcpDiagnostics: (0, BuildInfo_1.composeDiagnostics)((0, BuildInfo_1.getRuntimeInfo)("editor", __filename), null, null, "队列忙或阻塞，未查询可变场景") }) }] }));
                }
                const receivedAt = Date.now();
                let argsPreview = "";
                if (args) {
                    try {
                        argsPreview = (0, LogPreview_1.formatLogPreview)(args);
                    }
                    catch (e) {
                        argsPreview = "[无法序列化的参数]";
                    }
                }
                Logger_1.Logger.mcp(`[${activity.callId}] REQ -> [${name}] (队列长度: ${CommandQueue_1.CommandQueue.getLength()}) 参数: ${argsPreview}`);
                let responseSent = false;
                CommandQueue_1.CommandQueue.enqueue((done) => {
                    // HTTP 客户端已超时/断开时，尚未开始的操作不再迟到执行。
                    if (res.destroyed) {
                        done();
                        return;
                    }
                    const startTime = Date.now();
                    activity.start();
                    try {
                        ToolDispatcher_1.ToolDispatcher.handleMcpCall(name, args, (err, result) => {
                            if (responseSent) {
                                done();
                                return;
                            } // 迟到回调仅释放执行锁，不重复响应
                            responseSent = true;
                            const duration = Date.now() - startTime;
                            let resultText;
                            try {
                                resultText = typeof result === "object" ? JSON.stringify(result) : String(result !== null && result !== void 0 ? result : "");
                            }
                            catch (failure) {
                                err = `操作已返回，但结果无法序列化，禁止直接重放: ${failure.message}`;
                                resultText = "";
                                result = undefined;
                            }
                            const response = {
                                projectContext: (0, ProjectContext_1.getProjectContext)(),
                                structuredContent: activity.finish(err, result),
                                timings: { queueWaitMs: startTime - receivedAt, executionMs: duration, totalMs: Date.now() - receivedAt },
                                isError: !!err,
                                content: [
                                    {
                                        type: "text",
                                        text: err
                                            ? `Error: ${err}`
                                            : resultText,
                                    },
                                ],
                            };
                            if (err && result !== undefined)
                                response.content.push({ type: "text", text: typeof resultText === "string" ? resultText : JSON.stringify(result) });
                            if (err) {
                                if (typeof CommandQueue_1.CommandQueue.recordError === "function")
                                    CommandQueue_1.CommandQueue.recordError(name, err);
                                Logger_1.Logger.error(`[${activity.callId}] RES <- [${name}] 失败 (耗时 ${duration}ms): ${err}`);
                            }
                            else {
                                let preview = "";
                                preview = (0, LogPreview_1.formatLogPreview)(result);
                                const logText = `[${activity.callId}] RES <- [${name}] 成功 (耗时 ${duration}ms) : ${preview.substring(0, 200)}${preview.length > 200 ? "..." : ""}`;
                                if (duration > 1000) {
                                    Logger_1.Logger.warn(`[慢操作告警] ${logText}`);
                                }
                                else {
                                    Logger_1.Logger.success(logText);
                                }
                            }
                            if (!err && name === "capture_editor_screenshot" && args.responseMode !== "text") {
                                const image = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(typeof result === "string" ? result : (result === null || result === void 0 ? void 0 : result.dataUrl) || "");
                                if (image) {
                                    response.content = [{ type: "image", mimeType: image[1], data: image[2] }];
                                    if (result && typeof result === "object") {
                                        const { dataUrl, ...metadata } = result;
                                        response.content.push({ type: "text", text: JSON.stringify(metadata) });
                                    }
                                }
                            }
                            try {
                                if (!res.destroyed) {
                                    res.writeHead(200);
                                    res.end(JSON.stringify(response));
                                }
                            }
                            finally {
                                done();
                            }
                        });
                    }
                    catch (err) {
                        if (!responseSent) {
                            responseSent = true;
                            res.writeHead(200);
                            res.end(JSON.stringify({ isError: true, structuredContent: activity.finish(err, null), content: [{ type: "text", text: String(err.message || err) }] }));
                        }
                        done();
                    }
                }, () => {
                    // 超时清理：关闭 HTTP 连接，防止连接悬挂
                    if (!responseSent) {
                        responseSent = true;
                        try {
                            res.writeHead(504);
                            res.end(JSON.stringify({ error: `操作超时: ${name} (60s)`, structuredContent: activity.finish("操作超时，后台完成状态未知，禁止直接重放", null) }));
                        }
                        catch (_e) { }
                    }
                }, name).catch((rejectReason) => {
                    if (!responseSent) {
                        responseSent = true;
                        res.writeHead(429);
                        res.end(JSON.stringify({ error: String(rejectReason), structuredContent: activity.finish(rejectReason, null) }));
                    }
                });
            }
            catch (e) {
                if (e instanceof SyntaxError) {
                    Logger_1.Logger.error(`JSON Parse Error: ${e.message}`);
                    res.writeHead(400);
                    res.end(JSON.stringify({ error: "Invalid JSON" }));
                }
                else {
                    Logger_1.Logger.error(`Internal Server Error: ${e.message}`);
                    res.writeHead(500);
                    res.end(JSON.stringify({ error: e.message }));
                }
            }
            return;
        }
        res.writeHead(404);
        res.end(JSON.stringify({ error: "Not Found", url: url }));
    }
}
exports.McpRouter = McpRouter;
