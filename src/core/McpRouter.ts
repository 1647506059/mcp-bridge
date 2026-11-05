import { Logger } from "./Logger";
import { CommandQueue } from "./CommandQueue";
import { getToolsList } from "../tools/ToolRegistry";
import { ToolDispatcher } from "../tools/ToolDispatcher";
import { McpWrappers } from "./McpWrappers";
import { HttpServer } from "./HttpServer";
import { IpcManager } from "../IpcManager";
import { getRuntimeInfo, composeDiagnostics } from "./BuildInfo";
import { formatLogPreview } from "../utils/LogPreview";
import { CallActivity } from "./CallActivity";
import { getProjectContext, contextError, projectEndpoint } from "./ProjectContext";
import { prepareMcpRequest } from "./McpHttpGateway";
import { configuredTools } from "../tools/ToolPresetStore";
function exposedTools() { return configuredTools(getProjectContext().project_path, getToolsList()); }
export class McpRouter {
	public static handleRequest(req: any, res: any) {
		const prepared = prepareMcpRequest(req, res, exposedTools);
		if (!prepared) return;
		req = prepared.req; res = prepared.res;
		const url = req.url;
		const body = req.bodyString; // 附加在请求上的 body 字符串

		if (url === "/list-tools") {
            try { const tools = exposedTools(); Logger.info(`AI Client requested tool list`); res.writeHead(200); return res.end(JSON.stringify({ tools })); }
            catch (err) { res.writeHead(500); return res.end(JSON.stringify({ error: "工具预设读取失败: " + err.message })); }
		}

		if (url === "/mcp-status") {
			try {
				const projectPath = (global as any).Editor ? (global as any).Editor.Project.path : process.cwd();
				res.writeHead(200);
				res.end(JSON.stringify({ 
					port: HttpServer.config.port, 
					projectName: require('path').basename(projectPath), 
					projectPath: projectPath,
                    projectContext: getProjectContext(), endpoint: projectEndpoint(),
                    mcp: getRuntimeInfo("editor", __filename)
				}));
			} catch (e) {
				res.writeHead(500);
				res.end(JSON.stringify({ error: String(e) }));
			}
			return;
		}

		if (url === "/mcp-diagnostics") {
            res.writeHead(200);
            return res.end(JSON.stringify({ editor: getRuntimeInfo("editor", __filename), queue: CommandQueue.snapshot() }));
        }

        if (url === "/list-resources") {
			const resources = McpWrappers.getResourcesList();
			Logger.info(`AI Client requested resource list`);
			res.writeHead(200);
			return res.end(JSON.stringify({ resources: resources }));
		}

		if (url === "/read-resource") {
			try {
				const { uri } = JSON.parse(body || "{}");
				Logger.mcp(`READ -> [${uri}]`);
				McpWrappers.handleReadResource(uri, (err: any, content: any) => {
					if (err) {
						Logger.error(`读取失败: ${err}`);
						res.writeHead(500);
						return res.end(JSON.stringify({ error: err }));
					}
					Logger.success(`读取成功: ${uri}`);
					res.writeHead(200);
					res.end(
						JSON.stringify({
							contents: [
								{
									uri: uri,
									mimeType: "application/json",
									text: typeof content === "string" ? content : JSON.stringify(content),
								},
							],
						}),
					);
				});
			} catch (e: any) {
				res.writeHead(500);
				res.end(JSON.stringify({ error: e.message }));
			}
			return;
		}

		if (url === "/call-tool") {
			try {
				const params = JSON.parse(body || "{}");
                const { name, arguments: args = {} } = params;
                const error = contextError(params, !!req.projectScoped);
                if (error) { res.writeHead(409); return res.end(JSON.stringify({ error, projectContext: getProjectContext() })); }
                const activity = new CallActivity(name, args);
                if ((name === "build_project" && args.action === "status") || (["simulate_mouse_drag", "simulate_mouse_click"].includes(name) && ["status", "cancel"].includes(args.action))) {
                    activity.start();
                    ToolDispatcher.handleMcpCall(name, args, (err, result) => {
                        res.writeHead(200); res.end(JSON.stringify({ projectContext: getProjectContext(), isError: !!err, structuredContent: activity.finish(err, result), content: [{ type: "text", text: JSON.stringify(result || { error: String(err) }) }] }));
                    }); return;
                }
                if (name === "get_project_info" && args.includeMcpDiagnostics && (CommandQueue.snapshot().processing || CommandQueue.getBlockedReason())) {
                    const queue = CommandQueue.snapshot();
                    res.writeHead(200);
                    return res.end(JSON.stringify({ structuredContent: activity.finish(null, null), content: [{ type: "text", text: JSON.stringify({ path: Editor.Project.path, queue,
                        mcpDiagnostics: composeDiagnostics(getRuntimeInfo("editor", __filename), null, null, "队列忙或阻塞，未查询可变场景") }) }] }));
                }
                const receivedAt = Date.now();
				let argsPreview = "";
				if (args) {
					try {
						argsPreview = formatLogPreview(args);
					} catch (e) {
						argsPreview = "[无法序列化的参数]";
					}
				}
				Logger.mcp(`[${activity.callId}] REQ -> [${name}] (队列长度: ${CommandQueue.getLength()}) 参数: ${argsPreview}`);

				let responseSent = false;
				CommandQueue.enqueue((done) => {
                    // HTTP 客户端已超时/断开时，尚未开始的操作不再迟到执行。
                    if (res.destroyed) { done(); return; }
					const startTime = Date.now();
                    activity.start();
					try { ToolDispatcher.handleMcpCall(name, args, (err: any, result: any) => {
						if (responseSent) { done(); return; } // 迟到回调仅释放执行锁，不重复响应
						responseSent = true;
						const duration = Date.now() - startTime;
						let resultText;
                        try { resultText = typeof result === "object" ? JSON.stringify(result) : String(result ?? ""); }
                        catch (failure) { err = `操作已返回，但结果无法序列化，禁止直接重放: ${failure.message}`; resultText = ""; result = undefined; }
						
						const response: any = {
                            projectContext: getProjectContext(),
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
                        if (err && result !== undefined) response.content.push({ type: "text", text: typeof resultText === "string" ? resultText : JSON.stringify(result) });
						if (err) {
                            if (typeof CommandQueue.recordError === "function") CommandQueue.recordError(name, err);
							Logger.error(`[${activity.callId}] RES <- [${name}] 失败 (耗时 ${duration}ms): ${err}`);
						} else {
							let preview = "";
                            preview = formatLogPreview(result);
							
							const logText = `[${activity.callId}] RES <- [${name}] 成功 (耗时 ${duration}ms) : ${preview.substring(0, 200)}${preview.length > 200 ? "..." : ""}`;
							if (duration > 1000) {
								Logger.warn(`[慢操作告警] ${logText}`);
							} else {
								Logger.success(logText);
							}
						}
						if (!err && name === "capture_editor_screenshot" && args.responseMode !== "text") {
                            const image = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(typeof result === "string" ? result : result?.dataUrl || "");
                            if (image) {
                                response.content = [{ type: "image", mimeType: image[1], data: image[2] }];
                                if (result && typeof result === "object") {
                                    const { dataUrl, ...metadata } = result;
                                    response.content.push({ type: "text", text: JSON.stringify(metadata) });
                                }
                            }
                        }
                        try {
                            if (!res.destroyed) { res.writeHead(200); res.end(JSON.stringify(response)); }
                        } finally { done(); }
					}); } catch (err) {
                        if (!responseSent) { responseSent = true; res.writeHead(200); res.end(JSON.stringify({ isError: true, structuredContent: activity.finish(err, null), content: [{ type: "text", text: String(err.message || err) }] })); }
                        done();
                    }
				}, () => {
					// 超时清理：关闭 HTTP 连接，防止连接悬挂
					if (!responseSent) {
						responseSent = true;
						try {
							res.writeHead(504);
							res.end(JSON.stringify({ error: `操作超时: ${name} (60s)`, structuredContent: activity.finish("操作超时，后台完成状态未知，禁止直接重放", null) }));
						} catch (_e) {}
					}
				}, name).catch((rejectReason: any) => {
					if (!responseSent) {
						responseSent = true;
						res.writeHead(429);
						res.end(JSON.stringify({ error: String(rejectReason), structuredContent: activity.finish(rejectReason, null) }));
					}
				});
			} catch (e: any) {
				if (e instanceof SyntaxError) {
					Logger.error(`JSON Parse Error: ${e.message}`);
					res.writeHead(400);
					res.end(JSON.stringify({ error: "Invalid JSON" }));
				} else {
					Logger.error(`Internal Server Error: ${e.message}`);
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
