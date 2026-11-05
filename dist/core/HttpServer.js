"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpServer = void 0;
const http = __importStar(require("http"));
const net_1 = require("net");
const Logger_1 = require("./Logger");
const HttpTransport_1 = require("../utils/HttpTransport");
class HttpServer {
    /**
     * 启动 HTTP 服务器
     */
    static start(port, requestHandler, onListening, host = HttpServer.config.host) {
        host = HttpServer.validateHost(host);
        HttpServer.stop();
        HttpServer.config.host = host;
        HttpServer.config.startError = null;
        const generation = HttpServer.generation;
        HttpServer.config.state = "starting";
        const tryStart = (currentPort, retries) => {
            if (generation !== HttpServer.generation)
                return;
            if (retries <= 0) {
                HttpServer.config.state = "stopped";
                HttpServer.config.startError = "无法找到可用端口";
                Logger_1.Logger.error(`Failed to find an available port after multiple attempts.`);
                return;
            }
            try {
                const server = http.createServer((req, res) => {
                    HttpServer.handleRawRequest(req, res, requestHandler);
                });
                HttpServer.mcpServer = server;
                server.on("error", (e) => {
                    if (generation !== HttpServer.generation || HttpServer.mcpServer !== server)
                        return;
                    if (e.code === "EADDRINUSE" || e.code === "EACCES") {
                        Logger_1.Logger.warn(`Port ${currentPort} is ${e.code === "EACCES" ? "access denied (possibly in excluded range)" : "in use"}, trying ${currentPort + 1}...`);
                        try {
                            server.close();
                        }
                        catch (err) { }
                        HttpServer.mcpServer = null;
                        HttpServer.retryTimer = setTimeout(() => {
                            HttpServer.retryTimer = null;
                            tryStart(currentPort + 1, retries - 1);
                        }, 100);
                    }
                    else {
                        HttpServer.config.state = "stopped";
                        HttpServer.config.active = false;
                        HttpServer.config.startError = e.message;
                        Logger_1.Logger.error(`Server Error: ${e.message}`);
                    }
                });
                server.listen(currentPort, host, () => {
                    var _a, _b;
                    if (generation !== HttpServer.generation || HttpServer.mcpServer !== server) {
                        server.close();
                        return;
                    }
                    HttpServer.config.state = "listening";
                    HttpServer.config.active = true;
                    const actualPort = ((_b = (_a = server.address) === null || _a === void 0 ? void 0 : _a.call(server)) === null || _b === void 0 ? void 0 : _b.port) || currentPort;
                    HttpServer.config.port = actualPort;
                    try {
                        if (onListening)
                            onListening(actualPort);
                    }
                    catch (err) {
                        Logger_1.Logger.warn(`监听已成功，但端口保存失败: ${err.message}`);
                    }
                    Logger_1.Logger.success(`MCP Server running at http://${host}:${actualPort}`);
                    if (Editor && Editor.Ipc) {
                        try {
                            Editor.Ipc.sendToPanel("mcp-bridge", "mcp-bridge:state-changed", HttpServer.config);
                        }
                        catch (_e) { /* 面板未打开 */ }
                    }
                });
            }
            catch (e) {
                HttpServer.config.state = "stopped";
                HttpServer.config.active = false;
                HttpServer.config.startError = e.message;
                Logger_1.Logger.error(`Failed to start server: ${e.message}`);
            }
        };
        tryStart(port, 10);
    }
    /** 先校验再停现有服务，地址不可用时保留原始启动错误供面板修复。 */
    static validateHost(value) {
        if (typeof value !== "string" || value !== value.trim() || !value || value.length > 253
            || !((0, net_1.isIP)(value) || value.split(".").every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))))
            throw new Error("Host 必须是 IP 地址或主机名，不可填写 URL/端口");
        return value;
    }
    /**
     * 拦截并校验请求体大小，然后传递给业务 Router
     */
    static handleRawRequest(req, res, handler) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Access-Control-Allow-Origin", "*");
        (0, HttpTransport_1.readUtf8Body)(req, HttpTransport_1.MAX_REQUEST_BYTES, (err, body) => {
            if (err) {
                Logger_1.Logger.error(`[HTTP] ${err.message}`);
                if (!res.destroyed) {
                    res.writeHead(err.code === "ETOOBIG" ? 413 : 400);
                    res.end(JSON.stringify({ error: err.message }));
                }
                return;
            }
            // 附加 body 至 req，方便传递
            req.bodyString = body;
            handler(req, res);
        });
    }
    /**
     * 关闭 HTTP 服务器
     */
    static stop() {
        HttpServer.generation++;
        clearTimeout(HttpServer.retryTimer);
        HttpServer.retryTimer = null;
        HttpServer.config.active = false;
        HttpServer.config.state = "stopped";
        if (HttpServer.mcpServer) {
            HttpServer.mcpServer.close();
            HttpServer.mcpServer = null;
            HttpServer.config.active = false;
            Logger_1.Logger.warn("MCP Server stopped");
            if (Editor && Editor.Ipc) {
                try {
                    Editor.Ipc.sendToPanel("mcp-bridge", "mcp-bridge:state-changed", HttpServer.config);
                }
                catch (_e) { /* 面板未打开 */ }
            }
        }
    }
}
exports.HttpServer = HttpServer;
HttpServer.generation = 0;
HttpServer.retryTimer = null;
HttpServer.mcpServer = null;
HttpServer.config = {
    host: "127.0.0.1",
    startError: null,
    port: 8200,
    active: false,
    state: "stopped",
};
