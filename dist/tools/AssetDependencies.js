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
exports.inspectAssetDependencies = inspectAssetDependencies;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const AssetUrl_1 = require("../utils/AssetUrl");
const AtomicFile_1 = require("../utils/AtomicFile");
/** 只检查序列化的 __uuid__ 引用，避免把普通字符串误判成资源依赖。 */
async function inspectAssetDependencies(args, assetdb) {
    var _a, _b, _c;
    const limit = (_a = args.limit) !== null && _a !== void 0 ? _a : 500;
    if (!Number.isInteger(limit) || limit < 1 || limit > 2000)
        throw new Error("limit 必须为 1–2000");
    let url = args.target;
    if (typeof url !== "string" || !url)
        throw new Error("target 必须为资源 UUID 或 db://assets/ URL");
    if (!url.startsWith("db://"))
        url = assetdb.uuidToUrl(url);
    (0, AssetUrl_1.validateAssetUrl)(url);
    if ((0, AssetUrl_1.isAssetRoot)(url) || !/\.(prefab|fire|anim|mtl|json)$/i.test(url))
        throw new Error("请选择具体的序列化 JSON 资源");
    const root = fs.realpathSync(assetdb.urlToFspath("db://assets"));
    const file = fs.realpathSync(assetdb.urlToFspath(url));
    const relative = path.relative(root, file);
    if (!relative || relative.startsWith(".." + path.sep) || path.isAbsolute(relative))
        throw new Error("资源文件超出当前 assets 目录");
    const source = JSON.parse((await (0, AtomicFile_1.readBounded)(file, 8 * 1024 * 1024)).toString("utf8"));
    const refs = new Map();
    let scanned = 0, truncated = false;
    const visit = (value, location, depth) => {
        if (++scanned > 100000 || depth > 64)
            throw new Error("资源结构超出检查预算");
        if (!value || typeof value !== "object")
            return;
        if (typeof value.__uuid__ === "string" && value.__uuid__) {
            if (!refs.has(value.__uuid__)) {
                if (refs.size >= limit) {
                    truncated = true;
                    return;
                }
                refs.set(value.__uuid__, []);
            }
            const locations = refs.get(value.__uuid__);
            if (locations.length < 10)
                locations.push(location);
        }
        for (const key of Object.keys(value))
            visit(value[key], `${location}.${key}`, depth + 1);
    };
    visit(source, "$", 0);
    const dependencies = [];
    for (const [uuid, locations] of refs) {
        let targetUrl = null, error = null, sourceExists = false, type = null;
        try {
            targetUrl = assetdb.uuidToUrl(uuid) || null;
            if (targetUrl) {
                type = ((_c = (_b = assetdb.assetInfoByUuid) === null || _b === void 0 ? void 0 : _b.call(assetdb, uuid)) === null || _c === void 0 ? void 0 : _c.type) || null;
                const sourcePath = assetdb.uuidToFspath(uuid);
                const paths = assetdb.isSubAssetByUuid(uuid) ? [sourcePath, path.dirname(sourcePath)] : [sourcePath];
                for (const file of paths) {
                    try {
                        if ((await fs.promises.stat(file)).isFile()) {
                            sourceExists = true;
                            break;
                        }
                    }
                    catch (e) {
                        if (e.code !== "ENOENT" && e.code !== "ENOTDIR")
                            throw e;
                    }
                }
            }
        }
        catch (e) {
            error = String(e.message || e);
        }
        dependencies.push({ uuid, url: targetUrl, type, resolved: !!targetUrl, exists: sourceExists, locations, ...(error ? { error } : {}) });
    }
    const missing = dependencies.filter(ref => !ref.exists);
    return { target: url, uuid: assetdb.urlToUuid(url), ok: missing.length === 0 && !truncated,
        complete: !truncated, truncated, referenceCount: refs.size, missingCount: missing.length,
        dependencies, missing, scope: "serialized-uuid-references" };
}
