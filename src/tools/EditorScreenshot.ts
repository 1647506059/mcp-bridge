declare const Editor: any;
import { CaptureReceipts, encodedSize, windowGeometry } from "./CaptureReceipt";
import { loadProjectProfile } from "../core/ProjectProfile";
import { resolveToolAlias } from "./ToolCapabilities";
import { sceneCapabilityReadOnly } from "./SceneCapabilities";
import { SCRIPT_TOOLS } from "./ScriptExecution";
import { projectFileReadOnly } from "./ProjectFiles";
import { editorCapabilityReadOnly } from "./EditorCapabilities";

export class EditorScreenshot {
    private static generation = 0;
    private static cached: any = null;
    private static receipts = new CaptureReceipts();
    static invalidate() { this.generation++; this.cached = null; this.receipts.clear(); }
    static resolveCoordinates(args) { return this.receipts.resolve(args, this.generation, Editor.Window.main.nativeWin); }
    static capture(args, callback) {
        const profile = loadProjectProfile();
        const maxWidth = args.maxWidth ?? Number(profile.get("screenshot-max-width") ?? 1280);
        const throttle = Number(profile.get("screenshot-throttle") ?? 1500);
        const format = args.format || "png", quality = args.quality ?? 80;
        const key = JSON.stringify([maxWidth, format, quality, args.crop, !!args.centerViewport]);
        const respond = (data, metadata, cached, time) => args.includeMetadata
            ? { dataUrl: data, ...metadata, cached, cacheAgeMs: Math.max(0, Date.now() - time) } : data;
        const generation = this.generation;
        let settled = false, restoreAttempts = 0;
        const finish = (err, data?) => {
            if (settled) return;
            settled = true; clearTimeout(deadline);
            callback(err, data);
        };
        const deadline = setTimeout(() => finish("Editor screenshot API timed out."), 5000);
        const capture = () => {
            if (settled) return;
            try {
                const win = Editor.Window.main.nativeWin;
                if (!win) return finish("未找到编辑器主窗口，无法截图");
                // 最小化窗口的 capturePage 只会返回最后一次合成画面（过期帧），必须识别出来。
                if (typeof win.isMinimized === "function" && win.isMinimized()) {
                    if (args.restoreWindow === false) return finish("编辑器窗口已最小化，capturePage 只会返回过期画面。传 restoreWindow: true（默认）自动恢复窗口，或手动恢复窗口后重试。");
                    if (restoreAttempts >= 3) return finish("编辑器窗口仍处于最小化状态，无法获取实时画面");
                    restoreAttempts++;
                    try { if (typeof win.showInactive === "function") win.showInactive(); } catch (_e) { /* 退化为 restore */ }
                    try { if (win.isMinimized() && typeof win.restore === "function") win.restore(); } catch (_e) { /* 下一轮重试或超时 */ }
                    return setTimeout(() => { if (!settled) capture(); }, 350);
                }
                if (typeof win.isVisible === "function" && !win.isVisible()) return finish("编辑器主窗口不可见，无法截图");
                const geometry = windowGeometry(win);
                const cached = this.cached;
                if (!args.forceFresh && cached?.key === key && cached.contents === win.webContents
                    && cached.signature === JSON.stringify(geometry) && Date.now() - cached.time < throttle) {
                    return finish(null, respond(cached.data, cached.metadata, true, cached.time));
                }
                const processImage = image => {
                    if (settled) return;
                    try {
                        const sourceSize = image.getSize();
                        const crop = args.crop || { x: 0, y: 0, width: sourceSize.width, height: sourceSize.height };
                        if (crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > sourceSize.width || crop.y + crop.height > sourceSize.height) throw new Error("裁剪区域超出截图范围");
                        let finalImage = args.crop ? image.crop(crop) : image;
                        const size = finalImage.getSize();
                        if (!size.width || !size.height) throw new Error("截图为空");
                        if (size.width > maxWidth) finalImage = finalImage.resize({ width: maxWidth, height: Math.max(1, Math.round(size.height * maxWidth / size.width)), quality: "better" });
                        const mime = format === "jpeg" ? "image/jpeg" : "image/png";
                        const bytes = format === "jpeg" ? finalImage.toJPEG(quality) : finalImage.toPNG();
                        const data = `data:${mime};base64,${bytes.toString("base64")}`;
                        const signature = JSON.stringify(geometry);
                        const stable = signature === JSON.stringify(windowGeometry(win)) && generation === this.generation;
                        const metadata = this.receipts.register(win, geometry, sourceSize, crop, encodedSize(bytes, format), generation, stable);
                        const time = Date.now();
                        if (stable) this.cached = { key, data, metadata, time, contents: win.webContents, signature };
                        finish(null, respond(data, metadata, false, time));
                    } catch (err) { finish(`处理截图失败: ${err.message}`); }
                };
                // Creator 2.4 内置 Electron 同时存在 Promise 与回调式 API。
                if (win.webContents.capturePage.length > 0) win.webContents.capturePage(processImage);
                else {
                    const pending = win.webContents.capturePage();
                    if (pending?.then) pending.then(processImage, err => finish(err.message));
                    else win.capturePage(processImage);
                }
            } catch (err) { finish(`截图失败: ${err.message}`); }
        };
        if (args.centerViewport) {
            Editor.Ipc.sendToPanel("scene", "scene:query-hierarchy", (err, id, hierarchy) => {
                if (settled) return;
                const child = !err && hierarchy?.children?.find(node => node.name === "Canvas");
                if (child) Editor.Ipc.sendToPanel("scene", "scene:center-nodes", [child.id]);
                setTimeout(capture, 500);
            });
        } else capture();
    }
}

export function isMutatingCall(name, args) {
    const alias = resolveToolAlias(name, args);
    if (alias.name !== name) return isMutatingCall(alias.name, alias.args);
    if (SCRIPT_TOOLS.includes(name)) return true;
    const readOnly = sceneCapabilityReadOnly(name);
    if (readOnly !== undefined) return !readOnly;
    for (const value of [projectFileReadOnly(name), editorCapabilityReadOnly(name)]) if (value !== undefined) return !value;
    if (name === "button_events") return args.action === "bind";
    if (["manage_components", "manage_asset", "manage_script", "scene_management", "prefab_management", "manage_editor", "manage_animation", "manage_material", "manage_texture", "manage_shader", "manage_undo", "manage_vfx"].includes(name)) {
        return !["get", "read", "get_info", "get_list", "get_selection", "get_state"].includes(args.action);
    }
    return ["set_node_name", "save_scene", "save_prefab", "close_prefab", "update_node_transform", "create_scene", "create_prefab", "open_scene", "open_prefab", "create_node", "execute_menu_item", "apply_text_edits", "modify_prefab_offline", "modify_scene_offline"].includes(name);
}
