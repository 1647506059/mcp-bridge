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
exports.normalizeProjectPath = normalizeProjectPath;
exports.projectIdentity = projectIdentity;
exports.getProjectContext = getProjectContext;
exports.projectEndpoint = projectEndpoint;
exports.projectRoute = projectRoute;
exports.mutatesProject = mutatesProject;
exports.contextError = contextError;
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
const ToolCapabilities_1 = require("../tools/ToolCapabilities");
const SceneCapabilities_1 = require("../tools/SceneCapabilities");
const EditorCapabilities_1 = require("../tools/EditorCapabilities");
const ProjectFiles_1 = require("../tools/ProjectFiles");
// 标识只用于避免串工程；重载扩展后旧实例凭证失效，不充当身份认证。
const instanceId = (0, crypto_1.randomBytes)(16).toString("hex");
function normalizeProjectPath(value) {
    const resolved = path.resolve(value);
    return path.sep === "\\" ? resolved.toLowerCase() : resolved;
}
function projectIdentity(projectPath) {
    return (0, crypto_1.createHash)("sha256").update(normalizeProjectPath(projectPath)).digest("hex").slice(0, 24);
}
function getProjectContext() {
    var _a;
    const projectPath = typeof Editor !== "undefined" && ((_a = Editor.Project) === null || _a === void 0 ? void 0 : _a.path) ? path.resolve(Editor.Project.path) : path.resolve(".");
    const id = projectIdentity(projectPath);
    return { project_id: id, project_path: projectPath, instance_id: instanceId, expected_context: id + ":" + instanceId };
}
function projectEndpoint(context = getProjectContext()) { return "/mcp/project/" + context.project_id + "/"; }
function projectRoute(url, context = getProjectContext()) {
    if (!url.startsWith("/mcp/project/"))
        return { path: url, scoped: false };
    const match = /^\/mcp\/project\/([^/]+)(?:\/(.*))?$/.exec(url);
    let id;
    try {
        id = match && decodeURIComponent(match[1]);
    }
    catch (_) { /* 非法编码按未知入口拒绝 */ }
    if (!id || id !== context.project_id)
        return { error: "PROJECT_CONTEXT_MISMATCH", status: 409 };
    return { path: "/" + (match[2] || ""), scoped: true };
}
function mutatesProject(name, args = {}) {
    const alias = (0, ToolCapabilities_1.resolveToolAlias)(name, args);
    if (alias.name !== name)
        return mutatesProject(alias.name, alias.args);
    for (const readOnly of [(0, SceneCapabilities_1.sceneCapabilityReadOnly)(name), (0, EditorCapabilities_1.editorCapabilityReadOnly)(name), (0, ProjectFiles_1.projectFileReadOnly)(name)])
        if (readOnly !== undefined)
            return !readOnly;
    if (["simulate_mouse_drag", "simulate_mouse_click"].includes(name))
        return !["status", "cancel"].includes(args.action);
    if (name === "batch_execute")
        return !Array.isArray(args.operations) || args.operations.some(op => mutatesProject(op.tool, op.params));
    if (name === "build_project")
        return args.action !== "status";
    if (name === "capture_editor_screenshot")
        return !!args.centerViewport;
    if (["get_selected_node", "get_scene_hierarchy", "find_gameobjects", "read_console", "validate_script", "run_script_diagnostics", "check_asset_ready", "validate_prefab", "search_project", "get_sha", "resolve_capture_coordinates", "inspect_asset_dependencies", "find_references", "get_project_info", "inspect_builder_targets"].includes(name))
        return false;
    if (name === "button_events")
        return args.action !== "list";
    if (["manage_components", "manage_asset", "manage_script", "scene_management", "prefab_management", "manage_editor", "manage_animation", "manage_material", "manage_texture", "manage_shader", "manage_undo", "manage_vfx"].includes(name)) {
        return !["get", "read", "get_info", "get_list", "get_selection", "get_state"].includes(args.action);
    }
    return true;
}
function contextError(params, scoped, context = getProjectContext()) {
    var _a, _b;
    const argumentPin = (_a = params.arguments) === null || _a === void 0 ? void 0 : _a.expected_context, metaPin = (_b = params._meta) === null || _b === void 0 ? void 0 : _b.expected_context;
    if (argumentPin !== undefined && metaPin !== undefined && argumentPin !== metaPin)
        return "PROJECT_CONTEXT_MISMATCH";
    const pin = argumentPin === undefined ? metaPin : argumentPin;
    if (pin !== undefined && pin !== context.expected_context)
        return typeof pin === "string" && pin.split(":")[0] === context.project_id ? "EDITOR_INSTANCE_CHANGED" : "PROJECT_CONTEXT_MISMATCH";
    return !scoped && mutatesProject(params.name, params.arguments) && !pin ? "PROJECT_CONTEXT_REQUIRED" : null;
}
