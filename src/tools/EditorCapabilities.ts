import * as fs from "fs";
import { readBounded } from "../utils/AtomicFile";
import { assertSerializedAsset } from "../utils/SerializedValidation";
import { validateAssetUrl } from "../utils/AssetUrl";

const specs: any[] = [
    ["get_tool_catalog", "project", true, "列出全部工具的分类、预设层级、开放状态和可用操作。"],
    ["get_editor_state", "project", true, "读取工程身份、编辑器队列与选择状态。"],
    ["list_editor_windows", "project", true, "列出本 Creator 进程的 Electron 窗口。"],
    ["list_assets", "assets", true, "查询 AssetDB 资源，最多返回500条。", { pattern: { type: "string" }, type: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 500 } }],
    ["list_scenes", "assets", true, "列出工程中的 Creator 2.4 .fire 场景。"],
    ["list_prefabs", "prefabs", true, "列出工程中的预制体资源。"],
    ["duplicate_prefab", "prefabs", false, "复制预制体内容，由 AssetDB 生成新 UUID，不复制 meta。", { path: { type: "string" }, targetPath: { type: "string" } }, ["path", "targetPath"]],
];
export function editorCapabilityDefinitions() {
    return specs.map(([name, category, readOnly, description, properties = {}, required = []]) => ({ name, category, profile: readOnly ? "core" : "full", description,
        annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, idempotentHint: readOnly, openWorldHint: false }, inputSchema: { type: "object", properties, required } }));
}
export function isEditorCapability(name) { return specs.some(item => item[0] === name); }
export function editorCapabilityReadOnly(name) { return specs.find(item => item[0] === name)?.[2]; }
export async function executeEditorCapability(name, args, editor) {
    if (name === "list_editor_windows") {
        let windows = [editor.Window?.main?.nativeWin].filter(Boolean);
        try { windows = require("electron").BrowserWindow.getAllWindows(); } catch (_) { /* 部分 Creator 仅通过 Editor.Window 暴露主窗口。 */ }
        return windows.map(win => ({ id: win.id, title: win.getTitle(), visible: win.isVisible(), focused: win.isFocused(), bounds: win.getBounds() }));
    }
    if (name === "duplicate_prefab") {
        validateAssetUrl(args.path); validateAssetUrl(args.targetPath);
        const source = editor.assetdb.urlToFspath(args.path), target = editor.assetdb.urlToFspath(args.targetPath);
        if (!source || !target || !args.path.endsWith(".prefab") || !args.targetPath.endsWith(".prefab")) throw new Error("需要有效的预制体源路径与目标路径");
        if (fs.existsSync(target)) throw new Error("目标预制体已存在");
        const content = (await readBounded(source, 8 * 1024 * 1024)).toString("utf8");
        assertSerializedAsset(JSON.parse(content));
        return new Promise((resolve, reject) => editor.assetdb.create(args.targetPath, content, (err, result) => err ? reject(err) : resolve(result)));
    }
    const pattern = name === "list_scenes" ? "db://assets/**/*.fire" : name === "list_prefabs" ? "db://assets/**/*.prefab" : args.pattern || "db://assets/**";
    if (!pattern.startsWith("db://assets/") || pattern.includes("..")) throw new Error("资源查询范围必须位于 db://assets 下");
    return new Promise((resolve, reject) => editor.assetdb.queryAssets(pattern, args.type || null, (err, items) => {
        if (err) return reject(err);
        const limit = args.limit || 500;
        resolve({ items: (items || []).slice(0, limit).map(item => ({ uuid: item.uuid, url: item.url, type: item.type })), total: (items || []).length, truncated: (items || []).length > limit });
    }));
}
