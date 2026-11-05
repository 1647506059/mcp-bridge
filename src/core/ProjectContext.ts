import * as path from "path";
import { createHash, randomBytes } from "crypto";
import { resolveToolAlias } from "../tools/ToolCapabilities";
import { sceneCapabilityReadOnly } from "../tools/SceneCapabilities";
import { editorCapabilityReadOnly } from "../tools/EditorCapabilities";
import { projectFileReadOnly } from "../tools/ProjectFiles";

// 标识只用于避免串工程；重载扩展后旧实例凭证失效，不充当身份认证。
const instanceId = randomBytes(16).toString("hex");
export function normalizeProjectPath(value: string) {
    const resolved = path.resolve(value);
    return path.sep === "\\" ? resolved.toLowerCase() : resolved;
}
export function projectIdentity(projectPath: string) {
    return createHash("sha256").update(normalizeProjectPath(projectPath)).digest("hex").slice(0, 24);
}
export function getProjectContext() {
    const projectPath = typeof Editor !== "undefined" && Editor.Project?.path ? path.resolve(Editor.Project.path) : path.resolve(".");
    const id = projectIdentity(projectPath);
    return { project_id: id, project_path: projectPath, instance_id: instanceId, expected_context: id + ":" + instanceId };
}
export function projectEndpoint(context = getProjectContext()) { return "/mcp/project/" + context.project_id + "/"; }
export function projectRoute(url: string, context = getProjectContext()) {
    if (!url.startsWith("/mcp/project/")) return { path: url, scoped: false };
    const match = /^\/mcp\/project\/([^/]+)(?:\/(.*))?$/.exec(url);
    let id;
    try { id = match && decodeURIComponent(match[1]); } catch (_) { /* 非法编码按未知入口拒绝 */ }
    if (!id || id !== context.project_id) return { error: "PROJECT_CONTEXT_MISMATCH", status: 409 };
    return { path: "/" + (match[2] || ""), scoped: true };
}

export function mutatesProject(name: string, args: any = {}): boolean {
    const alias = resolveToolAlias(name, args);
    if (alias.name !== name) return mutatesProject(alias.name, alias.args);
    for (const readOnly of [sceneCapabilityReadOnly(name), editorCapabilityReadOnly(name), projectFileReadOnly(name)]) if (readOnly !== undefined) return !readOnly;
    if (["simulate_mouse_drag", "simulate_mouse_click"].includes(name)) return !["status", "cancel"].includes(args.action);
    if (name === "batch_execute") return !Array.isArray(args.operations) || args.operations.some(op => mutatesProject(op.tool, op.params));
    if (name === "build_project") return args.action !== "status";
    if (name === "capture_editor_screenshot") return !!args.centerViewport;
    if (["get_selected_node", "get_scene_hierarchy", "find_gameobjects", "read_console", "validate_script", "run_script_diagnostics", "check_asset_ready", "validate_prefab", "search_project", "get_sha", "resolve_capture_coordinates", "inspect_asset_dependencies", "find_references", "get_project_info", "inspect_builder_targets"].includes(name)) return false;
    if (name === "button_events") return args.action !== "list";
    if (["manage_components", "manage_asset", "manage_script", "scene_management", "prefab_management", "manage_editor", "manage_animation", "manage_material", "manage_texture", "manage_shader", "manage_undo", "manage_vfx"].includes(name)) {
        return !["get", "read", "get_info", "get_list", "get_selection", "get_state"].includes(args.action);
    }
    return true;
}
export function contextError(params: any, scoped: boolean, context = getProjectContext()) {
    const argumentPin = params.arguments?.expected_context, metaPin = params._meta?.expected_context;
    if (argumentPin !== undefined && metaPin !== undefined && argumentPin !== metaPin) return "PROJECT_CONTEXT_MISMATCH";
    const pin = argumentPin === undefined ? metaPin : argumentPin;
    if (pin !== undefined && pin !== context.expected_context) return typeof pin === "string" && pin.split(":")[0] === context.project_id ? "EDITOR_INSTANCE_CHANGED" : "PROJECT_CONTEXT_MISMATCH";
    return !scoped && mutatesProject(params.name, params.arguments) && !pin ? "PROJECT_CONTEXT_REQUIRED" : null;
}
