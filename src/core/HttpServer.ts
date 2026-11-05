import * as http from "http";
import { isIP } from "net";
import { Logger } from "./Logger";
import { MAX_REQUEST_BYTES, readUtf8Body } from "../utils/HttpTransport";

export class HttpServer {
	private static generation = 0;
	private static retryTimer: any = null;
	private static mcpServer: http.Server | null = null;
	public static config = {
		host: "127.0.0.1",
		startError: null as string | null,
		port: 8200,
		active: false,
        state: "stopped",
	};

	/**
	 * 启动 HTTP 服务器
	 */
	public static start(port: number, requestHandler: (req: http.IncomingMessage, res: http.ServerResponse) => void, onListening?: (port: number) => void, host = HttpServer.config.host) {
        host = HttpServer.validateHost(host);
		HttpServer.stop();
        HttpServer.config.host = host;
        HttpServer.config.startError = null;
        const generation = HttpServer.generation;
        HttpServer.config.state = "starting";

		const tryStart = (currentPort: number, retries: number) => {
			if (generation !== HttpServer.generation) return;
            if (retries <= 0) {
                HttpServer.config.state = "stopped";
				HttpServer.config.startError = "无法找到可用端口";
				Logger.error(`Failed to find an available port after multiple attempts.`);
				return;
			}

			try {
				const server = http.createServer((req, res) => {
					HttpServer.handleRawRequest(req, res, requestHandler);
				});

				HttpServer.mcpServer = server;
                server.on("error", (e: any) => {
                    if (generation !== HttpServer.generation || HttpServer.mcpServer !== server) return;
					if (e.code === "EADDRINUSE" || e.code === "EACCES") {
						Logger.warn(`Port ${currentPort} is ${e.code === "EACCES" ? "access denied (possibly in excluded range)" : "in use"}, trying ${currentPort + 1}...`);
						try {
							server.close();
						} catch (err) {}
						HttpServer.mcpServer = null;
						HttpServer.retryTimer = setTimeout(() => {
                            HttpServer.retryTimer = null;
							tryStart(currentPort + 1, retries - 1);
						}, 100);
					} else {
						HttpServer.config.state = "stopped";
                        HttpServer.config.active = false;
                        HttpServer.config.startError = e.message;
                        Logger.error(`Server Error: ${e.message}`);
					}
				});

				server.listen(currentPort, host, () => {
                    if (generation !== HttpServer.generation || HttpServer.mcpServer !== server) { server.close(); return; }
                    HttpServer.config.state = "listening";
					HttpServer.config.active = true;
					const actualPort = (server.address?.() as any)?.port || currentPort;
					HttpServer.config.port = actualPort;
					try { if (onListening) onListening(actualPort); } catch (err) { Logger.warn(`监听已成功，但端口保存失败: ${err.message}`); }
                    Logger.success(`MCP Server running at http://${host}:${actualPort}`);
					if (Editor && Editor.Ipc) {
						try {
							Editor.Ipc.sendToPanel("mcp-bridge", "mcp-bridge:state-changed", HttpServer.config);
						} catch (_e) { /* 面板未打开 */ }
					}
				});
			} catch (e) {
				HttpServer.config.state = "stopped";
                HttpServer.config.active = false;
                HttpServer.config.startError = e.message;
                Logger.error(`Failed to start server: ${e.message}`);
			}
		};

		tryStart(port, 10);
	}

    /** 先校验再停现有服务，地址不可用时保留原始启动错误供面板修复。 */
    public static validateHost(value: string) {
        if (typeof value !== "string" || value !== value.trim() || !value || value.length > 253
            || !(isIP(value) || value.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)))) throw new Error("Host 必须是 IP 地址或主机名，不可填写 URL/端口");
        return value;
    }

	/**
	 * 拦截并校验请求体大小，然后传递给业务 Router
	 */
	private static handleRawRequest(req: http.IncomingMessage, res: http.ServerResponse, handler: Function) {
		res.setHeader("Content-Type", "application/json; charset=utf-8");
		res.setHeader("Access-Control-Allow-Origin", "*");

        readUtf8Body(req, MAX_REQUEST_BYTES, (err: any, body) => {
            if (err) {
                Logger.error(`[HTTP] ${err.message}`);
                if (!res.destroyed) {
                    res.writeHead(err.code === "ETOOBIG" ? 413 : 400);
                    res.end(JSON.stringify({ error: err.message }));
                }
                return;
            }
			// 附加 body 至 req，方便传递
			(req as any).bodyString = body;
			handler(req, res);
		});
	}

	/**
	 * 关闭 HTTP 服务器
	 */
	public static stop() {
        HttpServer.generation++;
        clearTimeout(HttpServer.retryTimer); HttpServer.retryTimer = null;
        HttpServer.config.active = false;
        HttpServer.config.state = "stopped";
		if (HttpServer.mcpServer) {
			HttpServer.mcpServer.close();
			HttpServer.mcpServer = null;
			HttpServer.config.active = false;
			Logger.warn("MCP Server stopped");
			if (Editor && Editor.Ipc) {
				try {
					Editor.Ipc.sendToPanel("mcp-bridge", "mcp-bridge:state-changed", HttpServer.config);
				} catch (_e) { /* 面板未打开 */ }
			}
		}
	}
}
