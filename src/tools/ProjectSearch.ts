import * as vm from "vm";
import * as fs from "fs";
import * as path from "path";
import { createHash } from "crypto";

const directoryCache = new Map<string, any>();
async function directoryEntries(dir: string) {
    const stat = await fs.promises.stat(dir);
    const identity = String(stat.dev) + ':' + stat.ino + ':' + stat.mtimeMs + ':' + stat.ctimeMs;
    const cached = directoryCache.get(dir);
    if (cached?.identity === identity && Date.now() - cached.time < 2000) return cached.entries;
    const entries = (await fs.promises.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    if (directoryCache.size >= 128) directoryCache.delete(directoryCache.keys().next().value);
    directoryCache.set(dir, { identity, time: Date.now(), entries });
    return entries;
}

async function* readLines(file: string, start: number, maxBytes: number) {
    const stream = fs.createReadStream(file, { start, end: maxBytes - 1 });
    let parts: Buffer[] = [], position = start;
    try {
        for await (const raw of stream) {
            const chunk = raw as Buffer;
            let from = 0, end;
            while ((end = chunk.indexOf(10, from)) !== -1) {
                parts.push(chunk.subarray(from, end)); position += end - from + 1;
                yield { text: Buffer.concat(parts).toString("utf8").replace(/\r$/, ""), offset: position, finished: false };
                parts = []; from = end + 1;
            }
            parts.push(chunk.subarray(from)); position += chunk.length - from;
        }
        yield { text: Buffer.concat(parts).toString("utf8").replace(/\r$/, ""), offset: position, finished: true };
    } finally { stream.destroy(); }
}

/** 分批读取；游标只保存最后一个位置，不缓存可能过期的资源内容。 */
export async function searchProject(args, root: string, assetsRoot: string) {
    if (typeof args.query !== "string") throw new Error("query 必须为字符串");
    const mode = args.matchType || "content", limit = args.pageSize ?? 500;
    const maxBytes = args.maxFileBytes ?? 4 * 1024 * 1024, previewLength = args.maxPreviewLength ?? 500;
    if (!["content", "file_name", "dir_name"].includes(mode)) throw new Error("无效搜索模式");
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("pageSize 必须为 1–500");
    if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 32 * 1024 * 1024) throw new Error("maxFileBytes 必须为 1–33554432");
    if (!Number.isInteger(previewLength) || previewLength < 1 || previewLength > 10000) throw new Error("maxPreviewLength 必须为 1–10000");
    const extensions = args.extensions || [".js", ".ts", ".json", ".fire", ".prefab", ".xml", ".txt", ".md"];
    if (!Array.isArray(extensions) || extensions.some(x => typeof x !== "string")) throw new Error("extensions 必须为字符串数组");
    const regex = args.useRegex ? new RegExp(args.query) : null;
    if (args.query.length > 2048) throw new Error("query 超过2048字符上限");
    const context = regex ? vm.createContext({ regex, text: "" }) : null;
    const evaluate = regex ? new vm.Script("regex.test(text)") : null;
    const matches = text => {
        if (!regex) return text.includes(args.query);
        context.text = text;
        try { return evaluate.runInContext(context, { timeout: 250 }); }
        catch (cause) { const err: any = new Error("正则表达式执行超时或失败，请简化表达式: " + cause.message); err.searchCursor = true; throw err; }
        finally { context.text = ""; }
    };
    const signature = createHash("sha256").update(JSON.stringify([2, root, args.query, !!args.useRegex, mode, extensions, args.includeSubpackages !== false, maxBytes])).digest("hex");
    let cursor: any = null;
    if (args.cursor !== undefined) {
        try { cursor = JSON.parse(Buffer.from(args.cursor, "base64").toString("utf8")); } catch (_) { throw new Error("搜索游标无效"); }
        if (cursor?.signature !== signature || typeof cursor.file !== "string" || !Number.isInteger(cursor.line) || cursor.line < 0
            || !Number.isInteger(cursor.offset) || cursor.offset < 0 || cursor.offset > maxBytes) throw new Error("搜索游标与本次条件不一致");
    }
    const results = [], positions = [], stats = { scannedFiles: 0, skippedLargeFiles: 0, skippedUnreadable: 0, skippedSymlinks: 0 };
    let resumed = !cursor, more = false, work = 0, timedOut = false, progress: any = null;
    const deadline = Date.now() + 20000;
    const pause = async () => { if (++work % 128 === 0) await new Promise(resolve => setTimeout(resolve, 0)); };
    const stopped = () => more || (timedOut = Date.now() > deadline);
    const dbUrl = file => "db://assets/" + path.relative(assetsRoot, file).split(path.sep).join("/");
    const add = (result, stamp, offset = 0, finished = false) => {
        if (results.length === limit) { more = true; return; }
        results.push(result); positions.push({ file: result.filePath, line: result.line || 0, stamp, offset, finished });
    };
    const walk = async dir => {
        const entries = await directoryEntries(dir);
        for (const entry of entries) {
            if (stopped()) return;
            await pause();
            const name = entry.name;
            if (name.startsWith(".") || ["node_modules", "bin", "local", "library", "temp"].includes(name)) continue;
            if (entry.isSymbolicLink()) { stats.skippedSymlinks++; continue; }
            const file = path.join(dir, name), url = dbUrl(file);
            let resumeLine = -1;
            if (!resumed && url === cursor.file) { resumed = true; resumeLine = cursor.line; }
            if (resumed) progress = { file: url, line: 0, stamp: null, offset: 0 };
            if (entry.isDirectory()) {
                if (!resumed && !cursor.file.startsWith(url + "/")) continue;
                if (resumed && mode === "dir_name" && resumeLine < 0 && matches(name)) add({ filePath: url, type: "directory", name }, null);
                if (!stopped() && args.includeSubpackages !== false) {
                    try { await walk(file); } catch (e) { if (e.searchCursor) throw e; stats.skippedUnreadable++; }
                }
                continue;
            }
            if (!resumed || !extensions.includes(path.extname(name).toLowerCase())) continue;
            stats.scannedFiles++;
            if (mode === "file_name") { if (resumeLine < 0 && matches(name)) add({ filePath: url, type: "file", name }, null); continue; }
            if (mode !== "content") continue;
            try {
                const stat = await fs.promises.stat(file), stamp = `${stat.mtimeMs}:${stat.size}`;
                if (resumeLine >= 0 && cursor.stamp !== null && cursor.stamp !== stamp) { const err: any = new Error("游标所在文件已变化，请重新搜索"); err.searchCursor = true; throw err; }
                if (resumeLine >= 0 && cursor.finished) continue;
                progress = { file: url, line: Math.max(0, resumeLine), stamp, offset: resumeLine >= 0 ? cursor.offset : 0 };
                if (stat.size > maxBytes) { stats.skippedLargeFiles++; continue; }
                let lineNumber = Math.max(0, resumeLine);
                for await (const item of readLines(file, progress.offset, maxBytes)) {
                    await pause();
                    if (stopped()) break;
                    lineNumber++;
                    progress = { file: url, line: lineNumber, stamp, offset: item.offset, finished: item.finished };
                    const line = item.text;
                    if (!matches(line)) continue;
                    const text = line.trim();
                    let end = previewLength;
                    if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
                    add({ filePath: url, line: lineNumber, content: text.slice(0, end),
                        ...(text.length > previewLength ? { contentTruncated: true, contentLength: text.length } : {}) }, stamp, item.offset, item.finished);
                    if (more) break;
                }
            } catch (e) { if (e.searchCursor) throw e; stats.skippedUnreadable++; }
        }
    };
    if (!(await fs.promises.stat(root)).isDirectory()) throw new Error("搜索起点必须是目录");
    await walk(root);
    if (!resumed) throw new Error("游标位置已不存在，请重新搜索");
    const next = more ? positions[positions.length - 1] : timedOut ? progress : null;
    const nextCursor = next ? Buffer.from(JSON.stringify({ signature, ...next })).toString("base64") : null;
    const metadata = args.includeMetadata || args.pageSize !== undefined || args.cursor !== undefined;
    if (!metadata && (timedOut || stats.skippedUnreadable || stats.skippedLargeFiles || stats.skippedSymlinks)) {
        throw new Error(`搜索不完整（超时:${timedOut}，不可读:${stats.skippedUnreadable}，过大:${stats.skippedLargeFiles}，链接:${stats.skippedSymlinks}），请指定 includeMetadata:true 查看部分结果与继续游标`);
    }
    return metadata
        ? { results, nextCursor, truncated: more || timedOut, timedOut, ...stats }
        : results;
}
