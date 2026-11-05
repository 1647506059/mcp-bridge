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
exports.SCRIPT_TOOLS = exports.SCRIPT_PACKET = void 0;
exports.scriptToolDefinitions = scriptToolDefinitions;
exports.validateJavascript = validateJavascript;
exports.startJavascript = startJavascript;
const vm = __importStar(require("vm"));
const BoundedValue_1 = require("../utils/BoundedValue");
exports.SCRIPT_PACKET = "mcp-bridge.script.v1";
exports.SCRIPT_TOOLS = ["execute_javascript", "execute_editor_script", "execute_scene_script"];
function scriptToolDefinitions() {
    return exports.SCRIPT_TOOLS.map(name => ({ name, category: "execution", profile: name === "execute_javascript" ? "core" : "full",
        description: "执行通用 JavaScript；支持 return、await、run(env)、module.exports 函数。editor 可访问 Editor/require/fs/path，scene 可访问 cc/scene/director。拥有编辑器进程权限，非安全沙箱；超时不代表取消副作用。",
        inputSchema: { type: "object", properties: {
                code: { type: "string", description: "JavaScript 源码，最多 256KiB。" },
                ...(name === "execute_javascript" ? { context: { type: "string", enum: ["editor", "scene"] } } : {}),
                args: { type: "object", description: "传入脚本的 JSON 参数。" },
                timeoutMs: { type: "integer", minimum: 100, maximum: 10000, description: "默认 5000ms；异步超时后仍等待真实完成才释放执行队列。" },
                safety_checks: { type: "boolean", description: "默认检查常见删除和子进程调用；false 跳过静态检查，该检查不是权限隔离。" },
            }, required: name === "execute_javascript" ? ["code", "context"] : ["code"] } }));
}
/** 静态检查仅防止常见误操作，不能替代进程权限隔离。 */
function validateJavascript(args) {
    if (typeof args.code !== "string" || !args.code.trim() || Buffer.byteLength(args.code) > 256 * 1024)
        throw new Error("脚本不能为空或超过256KiB");
    if (args.safety_checks !== false && /\b(?:require\s*\(\s*['"](?:node:)?child_process['"]|process\s*\.\s*(?:exit|kill)\s*\(|fs\s*\.\s*(?:promises\s*\.\s*)?(?:rm|rmdir|unlink|truncate)(?:Sync)?\s*\()/.test(args.code)) {
        throw new Error("脚本静态检查拒绝删除文件、退出进程或启动子进程；确认脚本内容后可传 safety_checks:false。此检查不是安全沙箱");
    }
}
/** vm 的同步截止保护与外部异步超时分别处理；实际 completion 始终保留。 */
function startJavascript(args, environment) {
    var _a;
    validateJavascript(args);
    const timeout = (_a = args.timeoutMs) !== null && _a !== void 0 ? _a : 5000, started = Date.now();
    const logs = [];
    let omitted = 0, active = true, characters = 0;
    const execution = () => ({ context: environment.context, durationMs: Date.now() - started, logs: logs.slice(), logsOmitted: omitted });
    const scriptConsole = {};
    for (const level of ["log", "info", "warn", "error", "debug"])
        scriptConsole[level] = (...values) => {
            if (!active)
                return;
            if (logs.length >= 50 || characters >= 20000) {
                omitted++;
                return;
            }
            const message = values.slice(0, 20).map(value => typeof value === "string" ? value.slice(0, 1000) : JSON.stringify((0, BoundedValue_1.boundedValue)(value, 1000, 4).value)).join(" ").slice(0, Math.min(1000, 20000 - characters));
            characters += message.length;
            logs.push({ level: level === "log" ? "info" : level, message });
        };
    const env = { ...environment, args: args.args || {}, console: scriptConsole };
    const sandbox = { ...env, env, Buffer, setTimeout, clearTimeout, setInterval, clearInterval };
    const source = `(async function () { "use strict"; const module = { exports: {} }; const exports = module.exports;
${args.code}
; if (typeof run === "function") return await run(env);
if (typeof module.exports === "function") return await module.exports(env);
if (module.exports && typeof module.exports.run === "function") return await module.exports.run(env);
return module.exports == null ? null : (typeof module.exports !== "object" || Object.keys(module.exports).length ? module.exports : null);
})()`;
    let result;
    try {
        result = new vm.Script(source, { filename: "mcp-" + environment.context + "-script.js" }).runInNewContext(sandbox, { timeout });
    }
    catch (err) {
        result = Promise.reject(err);
    }
    const completion = Promise.resolve(result).then(value => {
        const safe = (0, BoundedValue_1.boundedValue)(value === undefined ? null : value, 1024 * 1024, 12);
        return { kind: exports.SCRIPT_PACKET, data: safe.value, truncated: safe.truncated, execution: execution() };
    }, error => ({ kind: exports.SCRIPT_PACKET, data: null, error: { message: String((error === null || error === void 0 ? void 0 : error.message) || error).slice(0, 4000) }, execution: execution() }))
        .then(packet => { active = false; return packet; });
    return { completion, timeout, snapshot: execution };
}
