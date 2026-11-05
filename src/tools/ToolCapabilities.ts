/** 工具外观与能力元数据；组合工具和独立入口共用现有执行实现。 */
export const TOOL_CATEGORIES = {
    project: "工程与目录", scene: "节点与场景", components: "组件", ui: "UI 创建", prefabs: "预制体",
    assets: "资源", events: "事件", execution: "脚本执行", animation: "动画", camera: "摄像机",
    runtime: "运行状态", files: "文件", diagnostics: "诊断与验证", logs: "日志", input: "原生输入",
    screenshots: "截图", build: "构建", selection: "编辑器选择", materials: "材质与纹理", undo: "撤销与重做", compatibility: "兼容入口",
};

const aliases: any[] = [];
function alias(name, target, action, category, readOnly, description, defaults = {}, required?: string[], extra = {}) {
    aliases.push({ name, target, action, category, readOnly, description, defaults, required, extra });
}
alias("get_hierarchy", "get_scene_hierarchy", null, "scene", true, "读取当前场景或指定节点的层级。");
alias("find_nodes", "find_gameobjects", null, "scene", true, "按名称、路径或组件查找场景节点。");
alias("set_node_transform", "update_node_transform", null, "scene", false, "修改节点坐标、尺寸、锚点、旋转和缩放。");
alias("save_current_scene", "save_scene", null, "scene", false, "保存当前编辑场景。");
for (const [name, type, label] of [["create_canvas", "canvas", "Canvas"], ["create_label", "label", "Label"], ["create_button", "button", "Button"], ["create_sprite", "sprite", "Sprite"], ["create_camera", "camera", "Camera"]]) {
    alias(name, "create_node", null, type === "camera" ? "camera" : "ui", false, `创建 ${label} 节点，采用 Creator 2.4 组件。`, { type, name: label, returnDetails: true }, []);
}
alias("list_components", "manage_components", "get", "components", true, "列出节点组件，可选择返回字段和引用格式。", {}, ["nodeId"]);
alias("inspect_component", "manage_components", "get", "components", true, "读取指定组件属性。", {}, ["nodeId", "componentType"]);
alias("add_component", "manage_components", "add", "components", false, "添加组件并设置初始属性；资源引用使用 UUID。", {}, ["nodeId", "componentType"]);
alias("remove_component", "manage_components", "remove", "components", false, "移除指定组件。", {}, ["nodeId"]);
alias("set_component_properties", "manage_components", "update", "components", false, "设置组件的一组已存在属性。", {}, ["nodeId", "properties"]);
alias("set_component_property", "manage_components", "update", "components", false, "设置组件的单个已存在属性；资源引用使用 UUID。", {}, ["nodeId", "propertyName", "value"], { propertyName: { type: "string" }, value: {} });
alias("set_camera_properties", "manage_components", "update", "camera", false, "设置 cc.Camera 的已存在属性。", { componentType: "cc.Camera" }, ["nodeId", "properties"]);
alias("list_button_click_events", "button_events", "list", "events", true, "列出 cc.Button 点击回调并验证目标方法。", {}, ["nodeId"]);
alias("bind_button_click_event", "button_events", "bind", "events", false, "绑定 cc.Button 点击回调。", {}, ["nodeId", "targetId", "componentName", "handler"]);
alias("get_selection", "manage_editor", "get_selection", "selection", true, "读取编辑器选择。");
alias("get_editor_selection", "manage_editor", "get_selection", "selection", true, "读取编辑器选择，兼容 3.8 工具名。");
alias("set_selection", "manage_editor", "set_selection", "selection", false, "设置编辑器选择。");
alias("refresh_assets", "manage_editor", "refresh_editor", "assets", false, "刷新指定资源路径，禁止全局刷新。", {}, ["path"], { path: { type: "string" } });
alias("get_recent_logs", "read_console", null, "logs", true, "分页读取最近 MCP 日志。");
alias("search_files", "search_project", null, "files", true, "在资源目录中搜索文件或内容，支持分页。");
alias("validate_prefab_references", "validate_prefab", null, "diagnostics", true, "验证已保存的 2.4 预制体结构与资源引用。");
alias("validate_asset_dependencies", "inspect_asset_dependencies", null, "diagnostics", true, "检查已保存资源的 UUID 依赖和缺失项。");
alias("inspect_prefab", "prefab_management", "get_info", "prefabs", true, "读取预制体资源信息。");
alias("create_prefab_from_node", "create_prefab", null, "prefabs", false, "从场景节点创建预制体，使用 prefabName 指定资源路径。");
alias("create_prefab_instance", "prefab_management", "instantiate", "prefabs", false, "实例化预制体到场景。");
alias("instantiate_prefab", "prefab_management", "instantiate", "prefabs", false, "实例化预制体到场景，兼容 3.8 工具名。");
alias("apply_prefab_instance", "prefab_management", "update", "prefabs", false, "将实例应用回其预制体资源。");
for (const [target, category, entries] of [
    ["manage_asset", "assets", [["create_asset", "create", false], ["delete_asset", "delete", false], ["move_asset", "move", false], ["inspect_asset", "get_info", true]]],
    ["manage_script", "files", [["create_script", "create", false], ["delete_script", "delete", false], ["read_script", "read", true], ["write_script", "write", false]]],
    ["manage_animation", "animation", [["list_animations", "get_list", true], ["inspect_animation", "get_info", true], ["play_animation", "play", false], ["stop_animation", "stop", false], ["pause_animation", "pause", false], ["resume_animation", "resume", false]]],
    ["manage_material", "materials", [["create_material", "create", false], ["delete_material", "delete", false], ["inspect_material", "get_info", true], ["set_material_properties", "update", false]]],
    ["manage_texture", "materials", [["create_texture", "create", false], ["delete_texture", "delete", false], ["inspect_texture", "get_info", true], ["set_texture_properties", "update", false]]],
    ["manage_shader", "materials", [["create_shader", "create", false], ["delete_shader", "delete", false], ["read_shader", "read", true], ["write_shader", "write", false], ["inspect_shader", "get_info", true]]],
    ["manage_undo", "undo", [["undo", "undo", false], ["redo", "redo", false], ["begin_undo_group", "begin_group", false], ["end_undo_group", "end_group", false], ["cancel_undo_group", "cancel_group", false]]],
] as any[]) for (const [name, action, readOnly] of entries) alias(name, target, action, category, readOnly, `${name}：${target} 的 ${action} 独立入口。`);

export function toolAlias(name) {
    const item = aliases.find(item => item.name === name);
    if (!item) return null;
    const nodeKey = ["manage_components", "manage_animation", "button_events", "create_prefab"].includes(item.target) || (item.target === "prefab_management" && item.action === "update") ? "nodeId" : item.target === "update_node_transform" ? "id" : null;
    return { ...item, nodeKey };
}
export function resolveToolAlias(name, args = {}) {
    const item = toolAlias(name);
    if (!item) return { name, args };
    const normalized: any = { ...item.defaults, ...args };
    if (item.action) normalized.action = item.action;
    if (item.defaults.type) normalized.type = item.defaults.type;
    if (item.defaults.componentType) normalized.componentType = item.defaults.componentType;
    if (item.nodeKey && !normalized[item.nodeKey]) normalized[item.nodeKey] = normalized.uuid || normalized.nodeId || normalized.id;
    if (!normalized.componentType && normalized.componentName) normalized.componentType = normalized.componentName;
    if (name === "set_component_property") normalized.properties = { [normalized.propertyName]: normalized.value };
    if (name === "refresh_assets") normalized.properties = { path: normalized.path };
    return { name: item.target, args: normalized };
}
export function granularTools(base) {
    return aliases.map(item => {
        const alias = toolAlias(item.name);
        const parent = base.find(tool => tool.name === item.target);
        const properties = { ...parent.inputSchema.properties, ...item.extra };
        delete properties.action;
        for (const key of Object.keys(item.defaults)) {
            if (["type", "componentType"].includes(key)) delete properties[key];
            else if (properties[key]) properties[key] = { ...properties[key], default: item.defaults[key] };
        }
        if (alias.nodeKey) Object.assign(properties, { nodeId: { type: "string" }, uuid: { type: "string" }, path: { type: "string", description: "场景节点路径，与 UUID 二选一。" }, name: { type: "string", description: "精确节点名；存在重名时拒绝。" } });
        if (properties.componentType) properties.componentName = { type: "string", description: "组件类名，与 componentType 等价。" };
        if (item.target === "create_node") properties.parentPath = { type: "string", description: "父节点路径，与 parentId 二选一。" };
        const required = (item.required || (parent.inputSchema.required || []).filter(key => key !== "action" && !(key in item.defaults))).filter(key => key !== alias.nodeKey);
        return { name: item.name, description: item.description, category: item.category, profile: "full", aliasFor: item.target,
            annotations: { readOnlyHint: item.readOnly, destructiveHint: !item.readOnly, idempotentHint: item.readOnly, openWorldHint: false },
            inputSchema: { type: "object", properties, required } };
    });
}

const READ_ONLY = new Set(["get_selected_node", "get_scene_hierarchy", "find_gameobjects", "read_console", "validate_script", "run_script_diagnostics", "check_asset_ready", "validate_prefab", "search_project", "get_sha", "resolve_capture_coordinates", "inspect_asset_dependencies", "find_references", "get_project_info", "inspect_builder_targets", "get_active_instances"]);
const CATEGORY_NAMES = {
    project: ["get_project_info", "get_active_instances", "set_active_instance", "get_tool_catalog", "get_editor_state"],
    scene: ["get_selected_node", "get_scene_hierarchy", "find_gameobjects", "find_references", "set_node_name", "update_node_transform", "create_node", "create_scene", "open_scene", "save_scene", "scene_management"],
    prefabs: ["create_prefab", "open_prefab", "save_prefab", "close_prefab", "prefab_management", "modify_prefab_offline", "modify_scene_offline"],
    diagnostics: ["validate_prefab", "validate_script", "run_script_diagnostics", "inspect_asset_dependencies", "inspect_builder_targets"],
    assets: ["manage_asset", "check_asset_ready"], files: ["manage_script", "apply_text_edits", "get_sha", "search_project"],
    screenshots: ["capture_editor_screenshot", "resolve_capture_coordinates"], input: ["simulate_mouse_drag", "simulate_mouse_click"],
    logs: ["read_console"], components: ["manage_components"], events: ["button_events"],
    build: ["build_project"], materials: ["manage_material", "manage_texture", "manage_shader"],
    animation: ["manage_animation"], ui: ["manage_vfx"], undo: ["manage_undo"], selection: ["manage_editor", "execute_menu_item"],
};
export function capabilityMetadata(tool) {
    const category = tool.category || Object.keys(CATEGORY_NAMES).find(key => CATEGORY_NAMES[key].includes(tool.name)) || "project";
    const readOnly = tool.annotations?.readOnlyHint ?? READ_ONLY.has(tool.name);
    const compatibility = tool.name.startsWith("manage_") || ["button_events", "scene_management", "prefab_management", "execute_editor_script", "execute_scene_script"].includes(tool.name);
    return { ...tool, category, profile: tool.profile || (readOnly ? "core" : "full"), compatibility,
        annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, idempotentHint: readOnly, openWorldHint: false, ...tool.annotations } };
}
