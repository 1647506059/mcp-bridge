import * as fs from "fs";
import * as path from "path";
import { atomicWrite, readBounded } from "../utils/AtomicFile";

const fileSpecs: any[] = [
    ["read_file", true, "读取工程内 UTF-8 文件，默认最多1MiB。"],
    ["get_file_snippet", true, "读取指定行附近的工程文件片段。", { line: { type: "integer", minimum: 1 }, radius: { type: "integer", minimum: 0, maximum: 100 } }],
    ["write_file", false, "原子写入工程内文本文件；场景、预制体与 meta 使用专用工具。", { content: { type: "string" }, overwrite: { type: "boolean" } }, ["path", "content"]],
    ["replace_in_file", false, "对工程文本文件做字面量替换并校验匹配次数。", { search: { type: "string" }, replacement: { type: "string" }, expectedCount: { type: "integer", minimum: 1, maximum: 10000 } }, ["path", "search", "replacement"]],
    ["list_directory", true, "列出工程目录的直接子项，最多500项。"],
    ["exists", true, "检查工程文件或目录是否存在。"],
];
export function projectFileDefinitions() {
    return fileSpecs.map(([name, readOnly, description, extra = {}, required = ["path"]]) => ({ name, category: "files", profile: "full", description,
        annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, idempotentHint: readOnly, openWorldHint: false },
        inputSchema: { type: "object", properties: { path: { type: "string", description: "工程相对路径或 db://assets 路径。" }, ...extra }, required } }));
}
export function isProjectFileTool(name) { return fileSpecs.some(item => item[0] === name); }
export function projectFileReadOnly(name) { return fileSpecs.find(item => item[0] === name)?.[1]; }

export function resolveProjectFile(project, value) {
    if (typeof value !== "string" || !value || value.includes("\0")) throw new Error("需要有效的工程内路径");
    const root = path.resolve(project);
    const target = path.resolve(root, value.startsWith("db://assets") ? "assets" + value.slice(11) : value);
    const inside = (base, file) => { const relative = path.relative(base, file); return !relative || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative)); };
    if (!inside(root, target)) throw new Error("文件路径超出当前工程");
    let existing = target;
    while (!fs.existsSync(existing) && existing !== path.dirname(existing)) existing = path.dirname(existing);
    if (!inside(fs.realpathSync(root), fs.realpathSync(existing))) throw new Error("文件路径通过符号链接指向工程外");
    return target;
}
export async function executeProjectFile(name, args, project) {
    const file = resolveProjectFile(project, args.path);
    if (name === "exists") return { path: args.path, exists: fs.existsSync(file), isDirectory: fs.existsSync(file) && fs.statSync(file).isDirectory() };
    if (name === "list_directory") {
        const entries = await fs.promises.readdir(file, { withFileTypes: true });
        return { path: args.path, entries: entries.slice(0, 500).map(item => ({ name: item.name, directory: item.isDirectory(), symlink: item.isSymbolicLink() })), total: entries.length, truncated: entries.length > 500 };
    }
    const writing = !projectFileReadOnly(name);
    if (writing && /\.(?:fire|prefab|meta)$/i.test(file)) throw new Error("场景、预制体和 meta 请使用专用资源工具");
    if (writing && file === path.resolve(project)) throw new Error("不能写入工程根目录");
    if (name === "write_file") {
        if (Buffer.byteLength(args.content) > 1024 * 1024) throw new Error("文本超过1MiB");
        const previous = fs.existsSync(file) ? await readBounded(file, 1024 * 1024) : undefined;
        if (previous && !args.overwrite) throw new Error("文件已存在；覆盖需传 overwrite:true");
        await fs.promises.mkdir(path.dirname(file), { recursive: true });
        atomicWrite(file, args.content, previous);
        return { path: args.path, bytes: Buffer.byteLength(args.content), assetDbRefreshed: false };
    }
    const previous = await readBounded(file, name === "get_file_snippet" ? 8 * 1024 * 1024 : 1024 * 1024);
    const content = previous.toString("utf8");
    if (name === "read_file") return { path: args.path, content, bytes: previous.length };
    if (name === "get_file_snippet") {
        const lines = content.split(/\r?\n/), line = args.line || 1, radius = args.radius ?? 10;
        if (line > lines.length) throw new Error("行号超出文件范围");
        const start = Math.max(1, line - radius), end = Math.min(lines.length, line + radius);
        const snippet = lines.slice(start - 1, end).map((text, i) => ({ line: start + i, text: text.slice(0, 4000), truncated: text.length > 4000 }));
        return { path: args.path, startLine: start, endLine: end, totalLines: lines.length, lines: snippet };
    }
    if (!args.search) throw new Error("search 不能为空");
    const pieces = content.split(args.search), count = pieces.length - 1;
    if (!count || count > 10000 || (args.expectedCount !== undefined && count !== args.expectedCount)) throw new Error("替换匹配次数不符合预期: " + count);
    const result = pieces.join(args.replacement);
    if (Buffer.byteLength(result) > 1024 * 1024) throw new Error("替换后文本超过1MiB");
    atomicWrite(file, result, previous);
    return { path: args.path, replacements: count, assetDbRefreshed: false };
}
