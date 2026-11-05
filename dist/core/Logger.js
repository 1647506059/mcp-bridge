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
exports.Logger = void 0;
const fs = __importStar(require("fs"));
const pathModule = __importStar(require("path"));
const LogPreview_1 = require("../utils/LogPreview");
class Logger {
    static page(args) {
        var _a, _b;
        let after = 0;
        if (args.cursor) {
            const parts = args.cursor.split(":");
            if (parts[0] !== this.epoch || !/^\d+$/.test(parts[1]))
                throw new Error("日志游标已失效，请重新读取");
            after = Number(parts[1]);
        }
        const first = ((_a = this.logBuffer[0]) === null || _a === void 0 ? void 0 : _a.sequence) || this.sequence + 1;
        const source = this.logBuffer.filter(item => item.sequence > after && (!args.type || item.type === (args.type === "log" ? "info" : args.type)));
        const limit = (_b = args.limit) !== null && _b !== void 0 ? _b : 200;
        if (!Number.isInteger(limit) || limit < 1 || limit > 2000)
            throw new Error("limit 必须为1–2000");
        const entries = source.slice(0, limit);
        const last = entries.length ? entries[entries.length - 1].sequence : this.sequence;
        return { entries, nextCursor: this.epoch + ":" + last, truncated: source.length > entries.length, lostEntries: after > 0 && after < first - 1 };
    }
    /** 异步串行批量写盘；显式 flush 用于卸载和验证。 */
    static async flush() {
        clearTimeout(Logger.flushTimer);
        Logger.flushTimer = null;
        if (Logger.flushing) {
            await Logger.flushing;
            if (Logger.pendingLines.length)
                await Logger.flush();
            return;
        }
        if (!Logger.pendingLines.length)
            return;
        const lines = Logger.pendingLines;
        Logger.pendingLines = [];
        Logger.pendingBytes = 0;
        const dropped = Logger.droppedLines;
        Logger.droppedLines = 0;
        let failed = false;
        Logger.flushing = (async () => {
            try {
                const file = Logger.getLogFilePath();
                if (!file)
                    throw new Error("日志路径尚未就绪");
                const text = (dropped ? `[warn] 日志积压，省略 ${dropped} 条文件日志\n` : "") + lines.join("");
                let bytes = 0;
                try {
                    bytes = (await fs.promises.stat(file)).size;
                }
                catch (e) {
                    if (e.code !== "ENOENT")
                        throw e;
                }
                if (bytes && bytes + Buffer.byteLength(text) > Logger.MAX_BYTES) {
                    try {
                        await fs.promises.unlink(file + ".old");
                    }
                    catch (e) {
                        if (e.code !== "ENOENT")
                            throw e;
                    }
                    await fs.promises.rename(file, file + ".old");
                }
                await fs.promises.appendFile(file, text, "utf8");
                Logger.retries = 0;
            }
            catch (e) {
                failed = true;
                Logger.pendingLines = lines.concat(Logger.pendingLines);
                Logger.pendingBytes += lines.reduce((sum, line) => sum + Buffer.byteLength(line), 0);
                Logger.droppedLines += dropped;
                Logger.limitPending();
                Logger.remember({ time: Logger.formatLocalTimeWithOffset(), type: "warn", content: `日志文件写入失败: ${(0, LogPreview_1.truncateLogText)(String(e.message || e), 200)}` });
                if (++Logger.retries <= 3) {
                    Logger.flushTimer = setTimeout(() => { void Logger.flush(); }, 250);
                    if (Logger.flushTimer.unref)
                        Logger.flushTimer.unref();
                }
            }
        })();
        await Logger.flushing;
        Logger.flushing = null;
        if (!failed && Logger.pendingLines.length)
            await Logger.flush();
    }
    static limitPending() {
        while (Logger.pendingBytes > 512 * 1024) {
            Logger.pendingBytes -= Buffer.byteLength(Logger.pendingLines.shift());
            Logger.droppedLines++;
        }
    }
    static remember(entry) {
        entry = { ...entry, sequence: ++Logger.sequence };
        Logger.logBuffer.push(entry);
        Logger.bufferBytes += Buffer.byteLength(entry.content) + 100;
        while (Logger.logBuffer.length > 2000 || Logger.bufferBytes > Logger.MAX_BYTES) {
            const removed = Logger.logBuffer.shift();
            Logger.bufferBytes -= Buffer.byteLength(removed.content) + 100;
        }
    }
    /**
     * 获取日志文件路径
     */
    static getLogFilePath() {
        if (Logger._logFilePath)
            return Logger._logFilePath;
        try {
            if (typeof Editor === "undefined" || !Editor || !Editor.assetdb)
                return null;
            const assetsPath = Editor.assetdb.urlToFspath("db://assets");
            if (assetsPath) {
                const projectRoot = pathModule.dirname(assetsPath);
                const settingsDir = pathModule.join(projectRoot, "settings");
                if (!fs.existsSync(settingsDir)) {
                    fs.mkdirSync(settingsDir, { recursive: true });
                }
                Logger._logFilePath = pathModule.join(settingsDir, "mcp-bridge.log");
                return Logger._logFilePath;
            }
        }
        catch (e) {
            // 静默失败
        }
        return null;
    }
    /**
     * 格式化 Date 为本地时间 + 时区偏移量字符串
     * @param date 目标 Date 对象，默认为当前时间
     * @returns 格式如 "2026-07-24 10:59:07.123 +08:00"
     */
    static formatLocalTimeWithOffset(date = new Date()) {
        const pad = (num, len = 2) => String(num).padStart(len, "0");
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1);
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());
        const ms = pad(date.getMilliseconds(), 3);
        const offsetMinutes = date.getTimezoneOffset();
        const sign = offsetMinutes <= 0 ? "+" : "-";
        const absOffset = Math.abs(offsetMinutes);
        const offsetHours = pad(Math.floor(absOffset / 60));
        const offsetMins = pad(absOffset % 60);
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms} ${sign}${offsetHours}:${offsetMins}`;
    }
    /**
     * 记录日志并同步至面板和文件
     */
    static log(type, message) {
        message = (0, LogPreview_1.truncateLogText)(String(message));
        const logEntry = {
            time: Logger.formatLocalTimeWithOffset(),
            type: type,
            content: message,
        };
        Logger.remember(logEntry);
        if (typeof Editor !== "undefined" && Editor && Editor.Ipc) {
            try {
                Editor.Ipc.sendToPanel("mcp-bridge", "mcp-bridge:on-log", logEntry);
            }
            catch (_e) {
                // 面板未打开时忽略此错误
            }
        }
        if (type === "error" && typeof Editor !== "undefined" && Editor) {
            try {
                Editor.error(`[MCP] ${message}`);
            }
            catch (_e) {
                // 主进程部分环境下 Editor.error 会访问未初始化对象，不能阻断队列
            }
        }
        else if (type === "warn" && typeof Editor !== "undefined" && Editor) {
            try {
                Editor.warn(`[MCP] ${message}`);
            }
            catch (_e) { }
        }
        const line = `[${logEntry.time}] [${type}] ${message}\n`;
        Logger.pendingLines.push(line);
        Logger.pendingBytes += Buffer.byteLength(line);
        Logger.limitPending();
        if (!Logger.flushTimer) {
            Logger.flushTimer = setTimeout(() => { void Logger.flush(); }, 100);
        }
    }
    static info(message) { Logger.log("info", message); }
    static success(message) { Logger.log("success", message); }
    static warn(message) { Logger.log("warn", message); }
    static error(message) { Logger.log("error", message); }
    static mcp(message) { Logger.log("mcp", message); }
    static getLogContent() {
        return Logger.logBuffer.map(entry => `[${entry.time}] [${entry.type}] ${entry.content}`).join("\n");
    }
    static getLogs() {
        return Logger.logBuffer;
    }
    static clearLogs() {
        Logger.logBuffer = [];
        Logger.bufferBytes = 0;
        Logger.info("日志已清理");
    }
}
exports.Logger = Logger;
Logger.sequence = 0;
Logger.epoch = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
Logger.logBuffer = [];
Logger._logFilePath = null;
Logger.bufferBytes = 0;
Logger.pendingLines = [];
Logger.pendingBytes = 0;
Logger.droppedLines = 0;
Logger.flushing = null;
Logger.retries = 0;
Logger.MAX_BYTES = 2 * 1024 * 1024;
