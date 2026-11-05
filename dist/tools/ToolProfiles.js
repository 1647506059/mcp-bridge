"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TOOL_PROFILES = void 0;
exports.toolAnnotations = toolAnnotations;
exports.selectToolProfile = selectToolProfile;
const ToolCapabilities_1 = require("./ToolCapabilities");
const UI_TOOLS = new Set([
    "simulate_mouse_drag", "simulate_mouse_click",
    "get_selected_node", "set_node_name", "save_scene", "save_prefab", "close_prefab", "get_scene_hierarchy",
    "update_node_transform", "create_scene", "create_prefab", "open_scene", "open_prefab", "create_node", "manage_components", "manage_undo",
    "batch_execute", "manage_editor", "find_gameobjects", "find_references", "get_project_info", "read_console",
    "capture_editor_screenshot", "resolve_capture_coordinates", "inspect_asset_dependencies", "manage_asset", "check_asset_ready", "button_events", "validate_prefab", "run_script_diagnostics"
]);
const CONNECTION_TOOLS = new Set(["get_active_instances", "set_active_instance"]);
function toolAnnotations(name) {
    return (0, ToolCapabilities_1.capabilityMetadata)({ name }).annotations;
}
exports.TOOL_PROFILES = { full: "全部", core: "核心", readonly: "只读检查", ui: "UI 编辑", assets: "资源管理", prefabs: "预制体", debug: "调试", custom: "自定义" };
/** 工具目录与调用校验使用同一份裁剪结果，默认 full 保持兼容。 */
function selectToolProfile(tools, env = typeof process === "undefined" ? {} : process.env) {
    var _a, _b, _c, _d;
    const profile = env.MCP_BRIDGE_TOOL_PROFILE || "full";
    if (!Object.prototype.hasOwnProperty.call(exports.TOOL_PROFILES, profile))
        throw new Error("MCP_BRIDGE_TOOL_PROFILE 无效");
    const names = value => new Set((value || "").split(",").map(s => s.trim()).filter(Boolean));
    const enabled = names(env.MCP_BRIDGE_ENABLED_TOOLS), disabled = names(env.MCP_BRIDGE_DISABLED_TOOLS);
    for (const name of [...enabled, ...disabled])
        if (!tools.some(tool => tool.name === name))
            throw new Error(`工具配置包含未知名称: ${name}`);
    if (profile === "custom" && !enabled.size)
        throw new Error("custom 工具集需要 MCP_BRIDGE_ENABLED_TOOLS");
    const actions = env.MCP_BRIDGE_TOOL_ACTIONS ? JSON.parse(env.MCP_BRIDGE_TOOL_ACTIONS) : {};
    if (!actions || typeof actions !== "object" || Array.isArray(actions))
        throw new Error("工具操作白名单需要 JSON 对象");
    for (const name of Object.keys(actions)) {
        const choices = (_d = (_c = (_b = (_a = tools.find(tool => tool.name === name)) === null || _a === void 0 ? void 0 : _a.inputSchema) === null || _b === void 0 ? void 0 : _b.properties) === null || _c === void 0 ? void 0 : _c.action) === null || _d === void 0 ? void 0 : _d.enum;
        if (!choices || !Array.isArray(actions[name]) || !actions[name].length || actions[name].some(value => !choices.includes(value)))
            throw new Error("工具操作白名单无效: " + name);
    }
    return tools.filter(tool => {
        var _a;
        if (CONNECTION_TOOLS.has(tool.name))
            return true;
        const metadata = (0, ToolCapabilities_1.capabilityMetadata)(tool), alias = (0, ToolCapabilities_1.toolAlias)(tool.name);
        if ((alias === null || alias === void 0 ? void 0 : alias.action) && actions[alias.target] && !actions[alias.target].includes(alias.action))
            return false;
        const categories = { ui: ["scene", "components", "ui", "events", "camera", "selection", "screenshots", "undo"], assets: ["assets", "materials", "files", "diagnostics"], prefabs: ["prefabs", "scene", "components", "diagnostics"], debug: ["runtime", "execution", "logs", "diagnostics", "events", "screenshots", "input"] };
        const chosen = profile === "full" || (profile === "core" && metadata.profile === "core")
            || (profile === "readonly" && (metadata.annotations.readOnlyHint || tool.name === "batch_execute"))
            || (profile === "ui" && UI_TOOLS.has(tool.name)) || (((_a = categories[profile]) === null || _a === void 0 ? void 0 : _a.includes(metadata.category)) && !metadata.compatibility)
            || (profile !== "readonly" && enabled.has(tool.name));
        return !disabled.has(tool.name) && chosen;
    }).map(tool => actions[tool.name] ? { ...tool, inputSchema: { ...tool.inputSchema, properties: { ...tool.inputSchema.properties, action: { ...tool.inputSchema.properties.action, enum: actions[tool.name] } } } } : tool);
}
