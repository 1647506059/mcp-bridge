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
exports.collectScanPorts = collectScanPorts;
exports.readLastPortFromSettings = readLastPortFromSettings;
exports.resolveProjectRootFromProxyDir = resolveProjectRootFromProxyDir;
const fs = __importStar(require("fs"));
const pathModule = __importStar(require("path"));
/**
 * 判断是否为可探测的 TCP 端口。
 */
function isValidPort(port) {
    return typeof port === "number" && Number.isInteger(port) && port > 0 && port < 65536;
}
/**
 * 收集代理要探测的 HTTP 端口：默认范围 + 项目/环境额外端口（去重）。
 * 项目级代理必须扫到 settings 里的 last-port（例如旧默认 3456），
 * 否则 tools/list 会误判为未激活，只露出 get_active_instances。
 */
function collectScanPorts(start, end, extraPorts) {
    const seen = new Set();
    const ports = [];
    const add = (p) => {
        if (!isValidPort(p) || seen.has(p))
            return;
        seen.add(p);
        ports.push(p);
    };
    for (let p = start; p <= end; p++) {
        add(p);
    }
    if (extraPorts) {
        for (const p of extraPorts) {
            add(p);
        }
    }
    return ports;
}
/**
 * 从 settings/mcp-bridge.json 文本读取 last-port。
 * 兼容被 Object.assign(string) 拆成字符键的损坏文件。
 */
function readLastPortFromSettings(raw) {
    try {
        const data = JSON.parse(raw);
        if (!data || typeof data !== "object")
            return null;
        const port = Number(data["last-port"]);
        return isValidPort(port) ? port : null;
    }
    catch (_a) {
        return null;
    }
}
/**
 * 从 mcp-proxy 所在 dist 目录回溯到含 settings/mcp-bridge.json 的工程根。
 * dist → mcp-bridge → packages → 工程根。
 */
function resolveProjectRootFromProxyDir(proxyDir) {
    const projectRoot = pathModule.resolve(proxyDir, "..", "..", "..");
    const settingsFile = pathModule.join(projectRoot, "settings", "mcp-bridge.json");
    if (fs.existsSync(settingsFile))
        return projectRoot;
    return null;
}
