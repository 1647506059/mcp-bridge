import * as fs from "fs";
import * as path from "path";
import { validateAssetUrl, isAssetRoot } from "../utils/AssetUrl";
import { readBounded } from "../utils/AtomicFile";

/** 只检查序列化的 __uuid__ 引用，避免把普通字符串误判成资源依赖。 */
export async function inspectAssetDependencies(args, assetdb) {
    const limit = args.limit ?? 500;
    if (!Number.isInteger(limit) || limit < 1 || limit > 2000) throw new Error("limit 必须为 1–2000");
    let url = args.target;
    if (typeof url !== "string" || !url) throw new Error("target 必须为资源 UUID 或 db://assets/ URL");
    if (!url.startsWith("db://")) url = assetdb.uuidToUrl(url);
    validateAssetUrl(url);
    if (isAssetRoot(url) || !/\.(prefab|fire|anim|mtl|json)$/i.test(url)) throw new Error("请选择具体的序列化 JSON 资源");
    const root = fs.realpathSync(assetdb.urlToFspath("db://assets"));
    const file = fs.realpathSync(assetdb.urlToFspath(url));
    const relative = path.relative(root, file);
    if (!relative || relative.startsWith(".." + path.sep) || path.isAbsolute(relative)) throw new Error("资源文件超出当前 assets 目录");
    const source = JSON.parse((await readBounded(file, 8 * 1024 * 1024)).toString("utf8"));
    const refs = new Map<string, string[]>();
    let scanned = 0, truncated = false;
    const visit = (value, location, depth) => {
        if (++scanned > 100000 || depth > 64) throw new Error("资源结构超出检查预算");
        if (!value || typeof value !== "object") return;
        if (typeof value.__uuid__ === "string" && value.__uuid__) {
            if (!refs.has(value.__uuid__)) {
                if (refs.size >= limit) { truncated = true; return; }
                refs.set(value.__uuid__, []);
            }
            const locations = refs.get(value.__uuid__);
            if (locations.length < 10) locations.push(location);
        }
        for (const key of Object.keys(value)) visit(value[key], `${location}.${key}`, depth + 1);
    };
    visit(source, "$", 0);
    const dependencies = [];
    for (const [uuid, locations] of refs) {
        let targetUrl = null, error = null, sourceExists = false, type = null;
        try {
            targetUrl = assetdb.uuidToUrl(uuid) || null;
            if (targetUrl) {
                type = assetdb.assetInfoByUuid?.(uuid)?.type || null;
                const sourcePath = assetdb.uuidToFspath(uuid);
                const paths = assetdb.isSubAssetByUuid(uuid) ? [sourcePath, path.dirname(sourcePath)] : [sourcePath];
                for (const file of paths) {
                    try { if ((await fs.promises.stat(file)).isFile()) { sourceExists = true; break; } }
                    catch (e) { if (e.code !== "ENOENT" && e.code !== "ENOTDIR") throw e; }
                }
            }
        } catch (e) { error = String(e.message || e); }
        dependencies.push({ uuid, url: targetUrl, type, resolved: !!targetUrl, exists: sourceExists, locations, ...(error ? { error } : {}) });
    }
    const missing = dependencies.filter(ref => !ref.exists);
    return { target: url, uuid: assetdb.urlToUuid(url), ok: missing.length === 0 && !truncated,
        complete: !truncated, truncated, referenceCount: refs.size, missingCount: missing.length,
        dependencies, missing, scope: "serialized-uuid-references" };
}
