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
exports.editorCapabilityDefinitions = editorCapabilityDefinitions;
exports.isEditorCapability = isEditorCapability;
exports.editorCapabilityReadOnly = editorCapabilityReadOnly;
exports.executeEditorCapability = executeEditorCapability;
const fs = __importStar(require("fs"));
const AtomicFile_1 = require("../utils/AtomicFile");
const SerializedValidation_1 = require("../utils/SerializedValidation");
const AssetUrl_1 = require("../utils/AssetUrl");
const specs = [
    ["get_tool_catalog", "project", true, "列出全部工具的分类、预设层级、开放状态和可用操作。"],
    ["get_editor_state", "project", true, "读取工程身份、编辑器队列与选择状态。"],
    ["list_editor_windows", "project", true, "列出本 Creator 进程的 Electron 窗口。"],
    ["list_assets", "assets", true, "查询 AssetDB 资源，最多返回500条。", { pattern: { type: "string" }, type: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 500 } }],
    ["list_scenes", "assets", true, "列出工程中的 Creator 2.4 .fire 场景。"],
    ["list_prefabs", "prefabs", true, "列出工程中的预制体资源。"],
    ["duplicate_prefab", "prefabs", false, "复制预制体内容，由 AssetDB 生成新 UUID，不复制 meta。", { path: { type: "string" }, targetPath: { type: "string" } }, ["path", "targetPath"]],
];
function editorCapabilityDefinitions() {
    return specs.map(([name, category, readOnly, description, properties = {}, required = []]) => ({ name, category, profile: readOnly ? "core" : "full", description,
        annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, idempotentHint: readOnly, openWorldHint: false }, inputSchema: { type: "object", properties, required } }));
}
function isEditorCapability(name) { return specs.some(item => item[0] === name); }
function editorCapabilityReadOnly(name) { var _a; return (_a = specs.find(item => item[0] === name)) === null || _a === void 0 ? void 0 : _a[2]; }
async function executeEditorCapability(name, args, editor) {
    var _a, _b;
    if (name === "list_editor_windows") {
        let windows = [(_b = (_a = editor.Window) === null || _a === void 0 ? void 0 : _a.main) === null || _b === void 0 ? void 0 : _b.nativeWin].filter(Boolean);
        try {
            windows = require("electron").BrowserWindow.getAllWindows();
        }
        catch (_) { /* 部分 Creator 仅通过 Editor.Window 暴露主窗口。 */ }
        return windows.map(win => ({ id: win.id, title: win.getTitle(), visible: win.isVisible(), focused: win.isFocused(), bounds: win.getBounds() }));
    }
    if (name === "duplicate_prefab") {
        (0, AssetUrl_1.validateAssetUrl)(args.path);
        (0, AssetUrl_1.validateAssetUrl)(args.targetPath);
        const source = editor.assetdb.urlToFspath(args.path), target = editor.assetdb.urlToFspath(args.targetPath);
        if (!source || !target || !args.path.endsWith(".prefab") || !args.targetPath.endsWith(".prefab"))
            throw new Error("需要有效的预制体源路径与目标路径");
        if (fs.existsSync(target))
            throw new Error("目标预制体已存在");
        const content = (await (0, AtomicFile_1.readBounded)(source, 8 * 1024 * 1024)).toString("utf8");
        (0, SerializedValidation_1.assertSerializedAsset)(JSON.parse(content));
        return new Promise((resolve, reject) => editor.assetdb.create(args.targetPath, content, (err, result) => err ? reject(err) : resolve(result)));
    }
    const pattern = name === "list_scenes" ? "db://assets/**/*.fire" : name === "list_prefabs" ? "db://assets/**/*.prefab" : args.pattern || "db://assets/**";
    if (!pattern.startsWith("db://assets/") || pattern.includes(".."))
        throw new Error("资源查询范围必须位于 db://assets 下");
    return new Promise((resolve, reject) => editor.assetdb.queryAssets(pattern, args.type || null, (err, items) => {
        if (err)
            return reject(err);
        const limit = args.limit || 500;
        resolve({ items: (items || []).slice(0, limit).map(item => ({ uuid: item.uuid, url: item.url, type: item.type })), total: (items || []).length, truncated: (items || []).length > limit });
    }));
}
