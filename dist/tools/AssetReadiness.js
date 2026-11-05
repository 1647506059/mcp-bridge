"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAssetReady = checkAssetReady;
/** Creator 2.4 只验证资源库记录的稳定身份，不声称导入队列/编译/运行时已完成。 */
async function checkAssetReady(assetdb, options = {}) {
    const target = options.target;
    if (typeof target !== "string" || !target || target.length > 512 || /[\0*?#\\]/.test(target)
        || (target.startsWith("db://") ? !/^db:\/\/(assets|internal)\/.+/.test(target) || target.slice(5).split("/").some(part => !part || part === "." || part === "..")
            : !/^[A-Za-z0-9_+/@-]+$/.test(target)))
        throw new Error("target 需要精确 db:// 资源 URL 或 UUID");
    const waitMs = options.waitMs === undefined ? 1500 : options.waitMs;
    if (!Number.isInteger(waitMs) || waitMs < 0 || waitMs > 10000)
        throw new Error("waitMs 需要 0–10000");
    const started = Date.now(), deadline = started + (waitMs || 1000);
    let previous = "", stableObservations = 0, attempts = 0, status = "missing", asset = null, error = "";
    while (attempts++ < 102) {
        try {
            const uuid = target.startsWith("db://") ? assetdb.urlToUuid(target) : target;
            const url = uuid && assetdb.uuidToUrl(uuid);
            if (!url || assetdb.urlToUuid(url) !== uuid || (target.startsWith("db://") && url !== target)) {
                status = "missing_or_mismatched";
                asset = null;
            }
            else {
                // 2.4 主进程使用同步 AssetDB；queryInfoByUuid 只在部分上下文提供。
                let info;
                if (typeof assetdb.assetInfoByUuid === "function")
                    info = assetdb.assetInfoByUuid(uuid);
                else if (typeof assetdb.queryInfoByUuid === "function")
                    info = await new Promise((resolve, reject) => {
                        const timer = setTimeout(() => reject(new Error("资源信息查询超时")), Math.max(1, Math.min(1000, deadline - Date.now())));
                        try {
                            assetdb.queryInfoByUuid(uuid, (err, value) => { clearTimeout(timer); err ? reject(err) : resolve(value); });
                        }
                        catch (err) {
                            clearTimeout(timer);
                            reject(err);
                        }
                    });
                else
                    throw new Error("当前 AssetDB 不支持资源信息查询");
                if (!info || info.uuid !== uuid || info.url !== url || assetdb.uuidToUrl(uuid) !== url || assetdb.urlToUuid(url) !== uuid) {
                    status = "identity_mismatch";
                    asset = null;
                }
                else {
                    status = "observed";
                    asset = { uuid, url, type: info.type || null };
                }
            }
        }
        catch (err) {
            status = "unavailable";
            asset = null;
            error = String(err.message || err).slice(0, 500);
        }
        const identity = asset ? JSON.stringify(asset) : "";
        stableObservations = identity ? identity === previous ? stableObservations + 1 : 1 : 0;
        previous = identity;
        if (stableObservations >= 2 || !waitMs || Date.now() >= deadline || status === "unavailable")
            break;
        await new Promise(resolve => setTimeout(resolve, Math.min(100, Math.max(0, deadline - Date.now()))));
    }
    const ready = stableObservations >= 2;
    return { ready, status: ready ? "ready" : status === "observed" ? "unconfirmed" : status, target, asset,
        scope: "asset_db_record", stableObservations, attempts, elapsedMs: Date.now() - started,
        timedOut: !ready && Date.now() >= deadline, error,
        boundaries: { importQueueVerified: false, sourceBytesVerified: false, scriptCompilationVerified: false, runtimeLoadedVerified: false } };
}
