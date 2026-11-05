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
exports.AssetPatcher = void 0;
const CommandQueue_1 = require("../core/CommandQueue");
const AssetUrl_1 = require("./AssetUrl");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const pathMod = __importStar(require("path"));
const crypto = __importStar(require("crypto"));
const Logger_1 = require("../core/Logger");
class AssetPatcher {
    /** 内存修复与文件入口共用；已有 fileId 不重新生成。 */
    static fixPrefabRootFileIdData(data) {
        var _a, _b;
        const entry = data[0];
        if ((entry === null || entry === void 0 ? void 0 : entry.__type__) !== "cc.Prefab")
            return false;
        const root = data[(_a = entry.data) === null || _a === void 0 ? void 0 : _a.__id__];
        const info = root && data[(_b = root._prefab) === null || _b === void 0 ? void 0 : _b.__id__];
        if ((info === null || info === void 0 ? void 0 : info.__type__) !== "cc.PrefabInfo" || info.fileId)
            return false;
        info.fileId = AssetPatcher.generateFileId();
        return true;
    }
    /**
     * 生成 22 位 Base64 URL-safe 随机字符串，用作预制体 fileId
     */
    static generateFileId() {
        return crypto.randomBytes(16).toString("base64").replace(/\+/g, "/").replace(/=/g, "").substring(0, 22);
    }
    /**
     * 修复预制体文件中根节点的空 fileId 问题
     */
    static fixPrefabRootFileId(prefabFspath) {
        try {
            if (!fs.existsSync(prefabFspath)) {
                Logger_1.Logger.warn(`[fixPrefabRootFileId] 预制体文件不存在: ${prefabFspath}`);
                return false;
            }
            const content = fs.readFileSync(prefabFspath, "utf8");
            const data = JSON.parse(content);
            if (!Array.isArray(data) || data.length === 0) {
                Logger_1.Logger.warn(`[fixPrefabRootFileId] 预制体内容格式异常`);
                return false;
            }
            const prefabEntry = data[0];
            if (!prefabEntry || prefabEntry.__type__ !== "cc.Prefab" || !prefabEntry.data) {
                Logger_1.Logger.warn(`[fixPrefabRootFileId] 找不到 cc.Prefab 入口`);
                return false;
            }
            const rootNodeIndex = prefabEntry.data.__id__;
            const rootNode = data[rootNodeIndex];
            if (!rootNode || !rootNode._prefab) {
                Logger_1.Logger.warn(`[fixPrefabRootFileId] 根节点没有 _prefab 引用`);
                return false;
            }
            const prefabInfoIndex = rootNode._prefab.__id__;
            const prefabInfo = data[prefabInfoIndex];
            if (!prefabInfo || prefabInfo.__type__ !== "cc.PrefabInfo") {
                Logger_1.Logger.warn(`[fixPrefabRootFileId] 根节点 _prefab 指向的不是 cc.PrefabInfo`);
                return false;
            }
            if (AssetPatcher.fixPrefabRootFileIdData(data)) {
                fs.writeFileSync(prefabFspath, JSON.stringify(data, null, 2), "utf8");
                Logger_1.Logger.success(`[fixPrefabRootFileId] 已修复根节点 fileId: ${prefabInfo.fileId}`);
                return true;
            }
            return false;
        }
        catch (e) {
            Logger_1.Logger.error(`[fixPrefabRootFileId] 修复失败: ${e.message}`);
            return false;
        }
    }
    /**
     * 安全创建资源 (V8 完美原子级联方案)
     */
    static safeCreateAsset(path, content, originalCallback, postCreateModifier = null) {
        try {
            (0, AssetUrl_1.validateAssetUrl)(path);
        }
        catch (err) {
            originalCallback(err);
            return;
        }
        const fileName = path.substring(path.lastIndexOf("/") + 1);
        let currentUrl = path.substring(0, path.lastIndexOf("/"));
        let missingDirs = [];
        while (currentUrl !== "db://assets" && currentUrl !== "db://internal" && currentUrl !== "db://") {
            if (Editor.assetdb.exists(currentUrl)) {
                break;
            }
            missingDirs.unshift(currentUrl.substring(currentUrl.lastIndexOf("/") + 1));
            currentUrl = currentUrl.substring(0, currentUrl.lastIndexOf("/"));
        }
        if (!Editor.assetdb.exists(currentUrl)) {
            return originalCallback(`致命错误：最终回退的根目录都不存在： ${currentUrl}`);
        }
        const tempBase = pathMod.join(os.tmpdir(), "mcp_v8_" + crypto.randomBytes(12).toString("hex"));
        let deepTempPath = tempBase;
        for (let i = 0; i < missingDirs.length; i++) {
            deepTempPath = pathMod.join(deepTempPath, missingDirs[i]);
        }
        try {
            fs.mkdirSync(deepTempPath, { recursive: true });
            const fileTempPath = pathMod.join(deepTempPath, fileName);
            fs.writeFileSync(fileTempPath, content);
        }
        catch (e) {
            try {
                fs.rmdirSync(tempBase, { recursive: true });
            }
            catch (_) { }
            return originalCallback(`在临时隔离区写入文件失败: ${e.message}`);
        }
        const topImportTarget = missingDirs.length > 0 ? pathMod.join(tempBase, missingDirs[0]) : pathMod.join(tempBase, fileName);
        const release = CommandQueue_1.CommandQueue.trackEditorOperation();
        let finished = false, reported = false, imported = false;
        const deadline = setTimeout(() => {
            if (finished)
                return;
            reported = true;
            CommandQueue_1.CommandQueue.blockPending(`资源导入尚未确认: ${path}，禁止直接重试`);
            originalCallback(`资源导入超时，结果未知，后续操作已暂停: ${path}`);
        }, 30000);
        const doneCreate = (err, msg) => {
            if (finished)
                return;
            finished = true;
            clearTimeout(deadline);
            try {
                fs.rmdirSync(tempBase, { recursive: true });
            }
            catch (e) { }
            try {
                if (!reported)
                    originalCallback(err || null, msg);
            }
            finally {
                release();
            }
        };
        try {
            Editor.assetdb.import([topImportTarget], currentUrl, (impErr, results) => {
                if (imported || finished)
                    return;
                imported = true;
                if (impErr)
                    return doneCreate(`原生导入操作失败: ${impErr.message || impErr}`);
                if (postCreateModifier) {
                    try {
                        postCreateModifier(doneCreate);
                    }
                    catch (err) {
                        doneCreate(err);
                    }
                }
                else {
                    doneCreate(null, `资源已安全原生导入: ${path}`);
                }
            });
        }
        catch (err) {
            doneCreate(err);
        }
    }
}
exports.AssetPatcher = AssetPatcher;
