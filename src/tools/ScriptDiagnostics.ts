import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";

/** 独立静态检查：不刷新 AssetDB，不把 tsc 结果冒充 Creator 编译结果。 */
export async function runScriptDiagnostics(project: string, options: any = {}, runtime: any = {}) {
    const root = fs.realpathSync(project);
    const config = path.resolve(root, options.tsconfigPath || "tsconfig.json");
    const inside = file => { const relative = path.relative(root, file); return relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative); };
    if (!inside(config) || !fs.existsSync(config) || !inside(fs.realpathSync(config))) throw new Error("tsconfig 必须是当前工程内存在的文件");
    const candidates = [path.join(root, "node_modules/typescript/bin/tsc"),
        path.join(root, "packages/mcp-bridge/node_modules/typescript/bin/tsc")];
    const compiler = runtime.compiler || candidates.find(file => fs.existsSync(file));
    const boundaries = { creatorCompilationVerified: false, runtimeLoadedVerified: false };
    if (!compiler) return { ok: false, status: "unavailable", scope: "typescript_no_emit", diagnostics: [], boundaries,
        summary: "工程与 MCP 插件均未安装 TypeScript 编译器，未执行检查" };
    const limit = options.limit === undefined ? 30 : options.limit;
    const contextLines = options.contextLines === undefined ? 2 : options.contextLines;
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(contextLines) || contextLines < 0 || contextLines > 10) throw new Error("limit 需要 1–100，contextLines 需要 0–10");
    const execute = runtime.execFile || execFile;
    const started = Date.now();
    const result: any = await new Promise(resolve => execute(runtime.execPath || process.execPath,
        [compiler, "--noEmit", "--incremental", "false", "--pretty", "false", "-p", config],
        { cwd: root, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, timeout: 30000, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
        (error, stdout, stderr) => resolve({ error, stdout: String(stdout || ""), stderr: String(stderr || "") })));
    const output = result.stdout + "\n" + result.stderr;
    const diagnostics: any[] = [];
    for (const line of output.split(/\r?\n/)) {
        const match = /^(?:(.+)\((\d+),(\d+)\):\s*)?error\s+(TS\d+):\s*(.*)$/.exec(line);
        if (!match) continue;
        const file = match[1] ? path.resolve(root, match[1]) : null;
        const row = Number(match[2]) || null;
        const diagnostic: any = { file, line: row, column: Number(match[3]) || null, code: match[4], message: match[5] };
        if (diagnostics.length < limit && file && row && inside(file)) {
            try {
                if (inside(fs.realpathSync(file)) && fs.statSync(file).size <= 1024 * 1024) {
                    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
                    const from = Math.max(0, row - 1 - contextLines), to = Math.min(lines.length, row + contextLines);
                    diagnostic.snippet = lines.slice(from, to).map((text, i) => `${from + i + 1}: ${text.slice(0, 500)}`).join("\n");
                }
            } catch (_) { diagnostic.snippet = "源码不可读取"; }
        }
        diagnostics.push(diagnostic);
    }
    const ok = !result.error && diagnostics.length === 0;
    return { ok, status: ok ? "passed" : result.error?.killed ? "timeout" : "failed", scope: "typescript_no_emit",
        compiler, tsconfigPath: config, exitCode: result.error ? (typeof result.error.code === "number" ? result.error.code : null) : 0,
        elapsedMs: Date.now() - started, diagnostics: diagnostics.slice(0, limit), totalDiagnostics: diagnostics.length,
        truncated: diagnostics.length > limit || output.length > 12000,
        output: output.slice(0, 12000), error: result.error ? String(result.error.message).slice(0, 2000) : null, boundaries };
}
