import * as vm from "vm";
import { boundedValue } from "../utils/BoundedValue";

export const SCRIPT_PACKET = "mcp-bridge.script.v1";
export const SCRIPT_TOOLS = ["execute_javascript", "execute_editor_script", "execute_scene_script"];
export function scriptToolDefinitions() {
    return SCRIPT_TOOLS.map(name => ({ name, category: "execution", profile: name === "execute_javascript" ? "core" : "full",
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
export function validateJavascript(args) {
    if (typeof args.code !== "string" || !args.code.trim() || Buffer.byteLength(args.code) > 256 * 1024) throw new Error("脚本不能为空或超过256KiB");
    if (args.safety_checks !== false && /\b(?:require\s*\(\s*['"](?:node:)?child_process['"]|process\s*\.\s*(?:exit|kill)\s*\(|fs\s*\.\s*(?:promises\s*\.\s*)?(?:rm|rmdir|unlink|truncate)(?:Sync)?\s*\()/.test(args.code)) {
        throw new Error("脚本静态检查拒绝删除文件、退出进程或启动子进程；确认脚本内容后可传 safety_checks:false。此检查不是安全沙箱");
    }
}

/** vm 的同步截止保护与外部异步超时分别处理；实际 completion 始终保留。 */
export function startJavascript(args, environment) {
    validateJavascript(args);
    const timeout = args.timeoutMs ?? 5000, started = Date.now();
    const logs = []; let omitted = 0, active = true, characters = 0;
    const execution = () => ({ context: environment.context, durationMs: Date.now() - started, logs: logs.slice(), logsOmitted: omitted });
    const scriptConsole: any = {};
    for (const level of ["log", "info", "warn", "error", "debug"]) scriptConsole[level] = (...values) => {
        if (!active) return;
        if (logs.length >= 50 || characters >= 20000) { omitted++; return; }
        const message = values.slice(0, 20).map(value => typeof value === "string" ? value.slice(0, 1000) : JSON.stringify(boundedValue(value, 1000, 4).value)).join(" ").slice(0, Math.min(1000, 20000 - characters));
        characters += message.length; logs.push({ level: level === "log" ? "info" : level, message });
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
    try { result = new vm.Script(source, { filename: "mcp-" + environment.context + "-script.js" }).runInNewContext(sandbox, { timeout }); }
    catch (err) { result = Promise.reject(err); }
    const completion = Promise.resolve(result).then(value => {
        const safe = boundedValue(value === undefined ? null : value, 1024 * 1024, 12);
        return { kind: SCRIPT_PACKET, data: safe.value, truncated: safe.truncated, execution: execution() };
    }, error => ({ kind: SCRIPT_PACKET, data: null, error: { message: String(error?.message || error).slice(0, 4000) }, execution: execution() }))
        .then(packet => { active = false; return packet; });
    return { completion, timeout, snapshot: execution };
}
