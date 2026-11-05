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
exports.mergeOwnedEntry = mergeOwnedEntry;
exports.updateJsonClient = updateJsonClient;
exports.updateTomlClient = updateTomlClient;
exports.updateDshPatch = updateDshPatch;
const Jsonc_1 = require("./Jsonc");
const path = __importStar(require("path"));
function samePath(a, b) {
    if (typeof a !== "string" || typeof b !== "string")
        return false;
    const left = path.resolve(a), right = path.resolve(b);
    return path.sep === "\\" ? left.toLowerCase() === right.toLowerCase() : left === right;
}
/** 只接管当前项目的明确条目；保留额外字段，拒绝已禁用、手动改向或归属不明的配置。 */
function mergeOwnedEntry(existing, desired) {
    var _a;
    if (existing === undefined)
        return desired;
    if (!existing || typeof existing !== "object" || Array.isArray(existing) || existing.disabled || existing.enabled === false
        || existing.url || existing.command !== desired.command || !Array.isArray(existing.args) || existing.args.length !== 1
        || !samePath(existing.args[0], desired.args[0]))
        throw new Error("当前条目被禁用、手动改向或属于其他项目，保留原配置");
    if (existing.env !== undefined && (!existing.env || typeof existing.env !== "object" || Array.isArray(existing.env)))
        throw new Error("env 格式不明确，保留原配置");
    for (const key of Object.keys(desired.env || {})) {
        const prior = (_a = existing.env) === null || _a === void 0 ? void 0 : _a[key], expected = desired.env[key];
        if (prior !== undefined && (key.endsWith("PROJECT_PATH") ? !samePath(prior, expected) : prior !== expected))
            throw new Error("项目路径或 Host 已被手动修改，保留原配置");
    }
    return { ...existing, ...desired, env: { ...existing.env, ...desired.env } };
}
function updateJsonClient(source, rootKey, name, desired) {
    const document = (0, Jsonc_1.parseJsonc)(source);
    if (!document || typeof document !== "object" || Array.isArray(document))
        throw new Error("配置根必须是对象");
    const entries = document[rootKey];
    if (entries !== undefined && (!entries || typeof entries !== "object" || Array.isArray(entries)))
        throw new Error("MCP 配置段不是对象，保留原配置");
    const next = { ...document, [rootKey]: { ...entries, [name]: mergeOwnedEntry(entries === null || entries === void 0 ? void 0 : entries[name], desired) } };
    return (0, Jsonc_1.updateJsonc)(source, next);
}
function updateTomlClient(source, name, desired) {
    // 不猜测复杂 TOML 的范围，防止把字符串内部看似表头的文本当成配置段。
    if (/"""|'''|^\s*mcp_servers\s*=/m.test(source))
        throw new Error("TOML 使用多行字符串或内联 MCP 表，需手工配置");
    const headers = [...source.matchAll(/^[ \t]*\[([^\]\r\n]+)\][ \t]*(?:#[^\r\n]*)?\r?$/gm)];
    const find = (key) => {
        var _a, _b, _c, _d;
        const normalized = value => value.trim().replace(/\s*\.\s*/g, ".").replace(/(^|\.)(?:"([\w-]+)"|'([\w-]+)')(?=\.|$)/g, "$1$2$3");
        const matches = headers.filter(header => normalized(header[1]) === key);
        if (matches.length > 1)
            throw new Error("重复的 MCP TOML 表，保留原配置");
        const header = matches[0];
        if (!header)
            return null;
        const index = headers.indexOf(header);
        return { start: header.index, end: (_b = (_a = headers[index + 1]) === null || _a === void 0 ? void 0 : _a.index) !== null && _b !== void 0 ? _b : source.length, text: source.slice(header.index, (_d = (_c = headers[index + 1]) === null || _c === void 0 ? void 0 : _c.index) !== null && _d !== void 0 ? _d : source.length) };
    };
    const sectionName = "mcp_servers." + name, section = find(sectionName), envSection = find(sectionName + ".env");
    const line = (block, key) => {
        var _a;
        const matches = [...(block || "").matchAll(new RegExp("^[ \\t]*" + key + "[ \\t]*=[ \\t]*(.*)$", "gm"))];
        if (matches.length > 1)
            throw new Error("重复的 TOML 配置键，保留原配置");
        const value = (_a = matches[0]) === null || _a === void 0 ? void 0 : _a[1].trim();
        if (value === undefined)
            return undefined;
        // 只处理本工具生成的 JSON 兼容 TOML 字符串和数组，其他语法保持保护。
        try {
            return JSON.parse(value);
        }
        catch (_) {
            throw new Error("已有 MCP TOML 字段格式无法可靠识别，保留原配置");
        }
    };
    const newline = source.includes("\r\n") ? "\r\n" : "\n";
    const envLines = Object.entries(desired.env || {}).map(([key, value]) => key + " = " + JSON.stringify(value));
    if (!section) {
        if (envSection)
            throw new Error("MCP env 表缺少主表，保留原配置");
        return source + (source.endsWith("\n") || !source ? "" : newline) + (source ? newline : "")
            + "[" + sectionName + "]" + newline + "command = " + JSON.stringify(desired.command) + newline
            + "args = " + JSON.stringify(desired.args) + newline
            + (envLines.length ? newline + "[" + sectionName + ".env]" + newline + envLines.join(newline) + newline : "");
    }
    if (/^\s*(url|env)\s*=/m.test(section.text))
        throw new Error("已有 MCP 表包含 URL 或内联 env，保留原配置");
    const env = {};
    for (const key of Object.keys(desired.env || {})) {
        const value = line(envSection === null || envSection === void 0 ? void 0 : envSection.text, key);
        if (value !== undefined)
            env[key] = value;
    }
    mergeOwnedEntry({ command: line(section.text, "command"), args: line(section.text, "args"),
        disabled: line(section.text, "disabled"), enabled: line(section.text, "enabled"), env }, desired);
    const missing = Object.keys(desired.env || {}).filter(key => env[key] === undefined);
    if (!missing.length)
        return source;
    const added = missing.map(key => key + " = " + JSON.stringify(desired.env[key])).join(newline) + newline;
    if (!envSection)
        return source + (source.endsWith("\n") ? newline : newline + newline) + "[" + sectionName + ".env]" + newline + added;
    return source.slice(0, envSection.end) + (source.slice(0, envSection.end).endsWith("\n") ? "" : newline) + added + source.slice(envSection.end);
}
function updateDshPatch(source, serverName, url) {
    var _a, _b, _c, _d, _e;
    const config = { serverName, transport: "streamable-http", url };
    if (!source)
        return JSON.stringify([{ insert: [{ id: serverName, name: "@deepseek-ai/dsh-mcp-client", config }] }], null, 2) + "\n";
    JSON.parse(source);
    const patches = (0, Jsonc_1.parseJsonc)(source), entry = (_b = (_a = patches === null || patches === void 0 ? void 0 : patches[0]) === null || _a === void 0 ? void 0 : _a.insert) === null || _b === void 0 ? void 0 : _b[0];
    if (!Array.isArray(patches) || patches.length !== 1 || !patches[0] || Object.keys(patches[0]).join() !== "insert" || !Array.isArray(patches[0].insert) || patches[0].insert.length !== 1
        || !entry || Object.keys(entry).some(key => !["id", "name", "config", "disabled"].includes(key))
        || entry.id !== serverName || entry.name !== "@deepseek-ai/dsh-mcp-client" || entry.disabled
        || ((_c = entry.config) === null || _c === void 0 ? void 0 : _c.serverName) !== serverName || ((_d = entry.config) === null || _d === void 0 ? void 0 : _d.transport) !== config.transport || ((_e = entry.config) === null || _e === void 0 ? void 0 : _e.url) !== url)
        throw new Error("DSH overlay 含其他条目、被禁用或已手动改向，保留原配置");
    return source;
}
