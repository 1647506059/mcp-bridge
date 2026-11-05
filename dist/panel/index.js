"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// src/panel/index.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));

// src/tools/ToolCapabilities.ts
var TOOL_CATEGORIES = {
  project: "\u5DE5\u7A0B\u4E0E\u76EE\u5F55",
  scene: "\u8282\u70B9\u4E0E\u573A\u666F",
  components: "\u7EC4\u4EF6",
  ui: "UI \u521B\u5EFA",
  prefabs: "\u9884\u5236\u4F53",
  assets: "\u8D44\u6E90",
  events: "\u4E8B\u4EF6",
  execution: "\u811A\u672C\u6267\u884C",
  animation: "\u52A8\u753B",
  camera: "\u6444\u50CF\u673A",
  runtime: "\u8FD0\u884C\u72B6\u6001",
  files: "\u6587\u4EF6",
  diagnostics: "\u8BCA\u65AD\u4E0E\u9A8C\u8BC1",
  logs: "\u65E5\u5FD7",
  input: "\u539F\u751F\u8F93\u5165",
  screenshots: "\u622A\u56FE",
  build: "\u6784\u5EFA",
  selection: "\u7F16\u8F91\u5668\u9009\u62E9",
  materials: "\u6750\u8D28\u4E0E\u7EB9\u7406",
  undo: "\u64A4\u9500\u4E0E\u91CD\u505A",
  compatibility: "\u517C\u5BB9\u5165\u53E3"
};
var aliases = [];
function alias(name, target, action, category, readOnly, description, defaults = {}, required, extra = {}) {
  aliases.push({ name, target, action, category, readOnly, description, defaults, required, extra });
}
alias("get_hierarchy", "get_scene_hierarchy", null, "scene", true, "\u8BFB\u53D6\u5F53\u524D\u573A\u666F\u6216\u6307\u5B9A\u8282\u70B9\u7684\u5C42\u7EA7\u3002");
alias("find_nodes", "find_gameobjects", null, "scene", true, "\u6309\u540D\u79F0\u3001\u8DEF\u5F84\u6216\u7EC4\u4EF6\u67E5\u627E\u573A\u666F\u8282\u70B9\u3002");
alias("set_node_transform", "update_node_transform", null, "scene", false, "\u4FEE\u6539\u8282\u70B9\u5750\u6807\u3001\u5C3A\u5BF8\u3001\u951A\u70B9\u3001\u65CB\u8F6C\u548C\u7F29\u653E\u3002");
alias("save_current_scene", "save_scene", null, "scene", false, "\u4FDD\u5B58\u5F53\u524D\u7F16\u8F91\u573A\u666F\u3002");
for (const [name, type, label] of [["create_canvas", "canvas", "Canvas"], ["create_label", "label", "Label"], ["create_button", "button", "Button"], ["create_sprite", "sprite", "Sprite"], ["create_camera", "camera", "Camera"]]) {
  alias(name, "create_node", null, type === "camera" ? "camera" : "ui", false, `\u521B\u5EFA ${label} \u8282\u70B9\uFF0C\u91C7\u7528 Creator 2.4 \u7EC4\u4EF6\u3002`, { type, name: label, returnDetails: true }, []);
}
alias("list_components", "manage_components", "get", "components", true, "\u5217\u51FA\u8282\u70B9\u7EC4\u4EF6\uFF0C\u53EF\u9009\u62E9\u8FD4\u56DE\u5B57\u6BB5\u548C\u5F15\u7528\u683C\u5F0F\u3002", {}, ["nodeId"]);
alias("inspect_component", "manage_components", "get", "components", true, "\u8BFB\u53D6\u6307\u5B9A\u7EC4\u4EF6\u5C5E\u6027\u3002", {}, ["nodeId", "componentType"]);
alias("add_component", "manage_components", "add", "components", false, "\u6DFB\u52A0\u7EC4\u4EF6\u5E76\u8BBE\u7F6E\u521D\u59CB\u5C5E\u6027\uFF1B\u8D44\u6E90\u5F15\u7528\u4F7F\u7528 UUID\u3002", {}, ["nodeId", "componentType"]);
alias("remove_component", "manage_components", "remove", "components", false, "\u79FB\u9664\u6307\u5B9A\u7EC4\u4EF6\u3002", {}, ["nodeId"]);
alias("set_component_properties", "manage_components", "update", "components", false, "\u8BBE\u7F6E\u7EC4\u4EF6\u7684\u4E00\u7EC4\u5DF2\u5B58\u5728\u5C5E\u6027\u3002", {}, ["nodeId", "properties"]);
alias("set_component_property", "manage_components", "update", "components", false, "\u8BBE\u7F6E\u7EC4\u4EF6\u7684\u5355\u4E2A\u5DF2\u5B58\u5728\u5C5E\u6027\uFF1B\u8D44\u6E90\u5F15\u7528\u4F7F\u7528 UUID\u3002", {}, ["nodeId", "propertyName", "value"], { propertyName: { type: "string" }, value: {} });
alias("set_camera_properties", "manage_components", "update", "camera", false, "\u8BBE\u7F6E cc.Camera \u7684\u5DF2\u5B58\u5728\u5C5E\u6027\u3002", { componentType: "cc.Camera" }, ["nodeId", "properties"]);
alias("list_button_click_events", "button_events", "list", "events", true, "\u5217\u51FA cc.Button \u70B9\u51FB\u56DE\u8C03\u5E76\u9A8C\u8BC1\u76EE\u6807\u65B9\u6CD5\u3002", {}, ["nodeId"]);
alias("bind_button_click_event", "button_events", "bind", "events", false, "\u7ED1\u5B9A cc.Button \u70B9\u51FB\u56DE\u8C03\u3002", {}, ["nodeId", "targetId", "componentName", "handler"]);
alias("get_selection", "manage_editor", "get_selection", "selection", true, "\u8BFB\u53D6\u7F16\u8F91\u5668\u9009\u62E9\u3002");
alias("get_editor_selection", "manage_editor", "get_selection", "selection", true, "\u8BFB\u53D6\u7F16\u8F91\u5668\u9009\u62E9\uFF0C\u517C\u5BB9 3.8 \u5DE5\u5177\u540D\u3002");
alias("set_selection", "manage_editor", "set_selection", "selection", false, "\u8BBE\u7F6E\u7F16\u8F91\u5668\u9009\u62E9\u3002");
alias("refresh_assets", "manage_editor", "refresh_editor", "assets", false, "\u5237\u65B0\u6307\u5B9A\u8D44\u6E90\u8DEF\u5F84\uFF0C\u7981\u6B62\u5168\u5C40\u5237\u65B0\u3002", {}, ["path"], { path: { type: "string" } });
alias("get_recent_logs", "read_console", null, "logs", true, "\u5206\u9875\u8BFB\u53D6\u6700\u8FD1 MCP \u65E5\u5FD7\u3002");
alias("search_files", "search_project", null, "files", true, "\u5728\u8D44\u6E90\u76EE\u5F55\u4E2D\u641C\u7D22\u6587\u4EF6\u6216\u5185\u5BB9\uFF0C\u652F\u6301\u5206\u9875\u3002");
alias("validate_prefab_references", "validate_prefab", null, "diagnostics", true, "\u9A8C\u8BC1\u5DF2\u4FDD\u5B58\u7684 2.4 \u9884\u5236\u4F53\u7ED3\u6784\u4E0E\u8D44\u6E90\u5F15\u7528\u3002");
alias("validate_asset_dependencies", "inspect_asset_dependencies", null, "diagnostics", true, "\u68C0\u67E5\u5DF2\u4FDD\u5B58\u8D44\u6E90\u7684 UUID \u4F9D\u8D56\u548C\u7F3A\u5931\u9879\u3002");
alias("inspect_prefab", "prefab_management", "get_info", "prefabs", true, "\u8BFB\u53D6\u9884\u5236\u4F53\u8D44\u6E90\u4FE1\u606F\u3002");
alias("create_prefab_from_node", "create_prefab", null, "prefabs", false, "\u4ECE\u573A\u666F\u8282\u70B9\u521B\u5EFA\u9884\u5236\u4F53\uFF0C\u4F7F\u7528 prefabName \u6307\u5B9A\u8D44\u6E90\u8DEF\u5F84\u3002");
alias("create_prefab_instance", "prefab_management", "instantiate", "prefabs", false, "\u5B9E\u4F8B\u5316\u9884\u5236\u4F53\u5230\u573A\u666F\u3002");
alias("instantiate_prefab", "prefab_management", "instantiate", "prefabs", false, "\u5B9E\u4F8B\u5316\u9884\u5236\u4F53\u5230\u573A\u666F\uFF0C\u517C\u5BB9 3.8 \u5DE5\u5177\u540D\u3002");
alias("apply_prefab_instance", "prefab_management", "update", "prefabs", false, "\u5C06\u5B9E\u4F8B\u5E94\u7528\u56DE\u5176\u9884\u5236\u4F53\u8D44\u6E90\u3002");
for (const [target, category, entries] of [
  ["manage_asset", "assets", [["create_asset", "create", false], ["delete_asset", "delete", false], ["move_asset", "move", false], ["inspect_asset", "get_info", true]]],
  ["manage_script", "files", [["create_script", "create", false], ["delete_script", "delete", false], ["read_script", "read", true], ["write_script", "write", false]]],
  ["manage_animation", "animation", [["list_animations", "get_list", true], ["inspect_animation", "get_info", true], ["play_animation", "play", false], ["stop_animation", "stop", false], ["pause_animation", "pause", false], ["resume_animation", "resume", false]]],
  ["manage_material", "materials", [["create_material", "create", false], ["delete_material", "delete", false], ["inspect_material", "get_info", true], ["set_material_properties", "update", false]]],
  ["manage_texture", "materials", [["create_texture", "create", false], ["delete_texture", "delete", false], ["inspect_texture", "get_info", true], ["set_texture_properties", "update", false]]],
  ["manage_shader", "materials", [["create_shader", "create", false], ["delete_shader", "delete", false], ["read_shader", "read", true], ["write_shader", "write", false], ["inspect_shader", "get_info", true]]],
  ["manage_undo", "undo", [["undo", "undo", false], ["redo", "redo", false], ["begin_undo_group", "begin_group", false], ["end_undo_group", "end_group", false], ["cancel_undo_group", "cancel_group", false]]]
]) for (const [name, action, readOnly] of entries) alias(name, target, action, category, readOnly, `${name}\uFF1A${target} \u7684 ${action} \u72EC\u7ACB\u5165\u53E3\u3002`, {}, target === "manage_asset" ? ["path"] : void 0);
alias(
  "delete_assets",
  "manage_asset",
  "delete",
  "assets",
  false,
  "\u6279\u91CF\u5220\u9664\u8D44\u6E90\u3002\u6682\u505C\u540E\u53F0\u76D1\u542C\u540E\u4E00\u6B21\u63D0\u4EA4 AssetDB\uFF0C\u7B49\u5F85\u6570\u636E\u5E93\u3001\u6587\u4EF6\u3001meta \u5220\u9664\u53CA\u539F\u76D1\u542C\u6062\u590D\uFF1B\u5408\u5E76\u91CD\u590D\u548C\u7236\u5B50\u8DEF\u5F84\u3002\u7ED3\u679C\u672A\u77E5\u65F6\u7981\u6B62\u91CD\u8BD5\u3002",
  {},
  ["paths"],
  { paths: { type: "array", minItems: 1, maxItems: 500, items: { type: "string" }, description: "db://assets/ \u4E0B\u7684\u8D44\u6E90 URL\uFF0C\u4E0D\u5141\u8BB8\u8D44\u6E90\u6839\u76EE\u5F55\uFF1B\u4E0D\u8981\u518D\u4F20\u5355\u4E2A path" } }
);
function toolAlias(name) {
  const item = aliases.find((item2) => item2.name === name);
  if (!item) return null;
  const nodeKey = ["manage_components", "manage_animation", "button_events", "create_prefab"].includes(item.target) || item.target === "prefab_management" && item.action === "update" ? "nodeId" : item.target === "update_node_transform" ? "id" : null;
  return { ...item, nodeKey };
}
var READ_ONLY = /* @__PURE__ */ new Set(["get_selected_node", "get_scene_hierarchy", "find_gameobjects", "read_console", "validate_script", "run_script_diagnostics", "check_asset_ready", "validate_prefab", "search_project", "get_sha", "resolve_capture_coordinates", "inspect_asset_dependencies", "find_references", "get_project_info", "inspect_builder_targets", "get_active_instances"]);
var CATEGORY_NAMES = {
  project: ["get_project_info", "get_active_instances", "set_active_instance", "get_tool_catalog", "get_editor_state"],
  scene: ["get_selected_node", "get_scene_hierarchy", "find_gameobjects", "find_references", "set_node_name", "update_node_transform", "create_node", "create_scene", "open_scene", "save_scene", "scene_management"],
  prefabs: ["create_prefab", "open_prefab", "save_prefab", "close_prefab", "prefab_management", "modify_prefab_offline", "modify_scene_offline"],
  diagnostics: ["validate_prefab", "validate_script", "run_script_diagnostics", "inspect_asset_dependencies", "inspect_builder_targets"],
  assets: ["manage_asset", "check_asset_ready"],
  files: ["manage_script", "apply_text_edits", "get_sha", "search_project"],
  screenshots: ["capture_editor_screenshot", "resolve_capture_coordinates"],
  input: ["simulate_mouse_drag", "simulate_mouse_click"],
  logs: ["read_console"],
  components: ["manage_components"],
  events: ["button_events"],
  build: ["build_project"],
  materials: ["manage_material", "manage_texture", "manage_shader"],
  animation: ["manage_animation"],
  ui: ["manage_vfx"],
  undo: ["manage_undo"],
  selection: ["manage_editor", "execute_menu_item"]
};
function capabilityMetadata(tool) {
  var _a, _b;
  const category = tool.category || Object.keys(CATEGORY_NAMES).find((key) => CATEGORY_NAMES[key].includes(tool.name)) || "project";
  const readOnly = (_b = (_a = tool.annotations) == null ? void 0 : _a.readOnlyHint) != null ? _b : READ_ONLY.has(tool.name);
  const compatibility = tool.name.startsWith("manage_") || ["button_events", "scene_management", "prefab_management", "execute_editor_script", "execute_scene_script"].includes(tool.name);
  return {
    ...tool,
    category,
    profile: tool.profile || (readOnly ? "core" : "full"),
    compatibility,
    annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, idempotentHint: readOnly, openWorldHint: false, ...tool.annotations }
  };
}

// src/tools/ToolProfiles.ts
var UI_TOOLS = /* @__PURE__ */ new Set([
  "simulate_mouse_drag",
  "simulate_mouse_click",
  "get_selected_node",
  "set_node_name",
  "save_scene",
  "save_prefab",
  "close_prefab",
  "get_scene_hierarchy",
  "update_node_transform",
  "create_scene",
  "create_prefab",
  "open_scene",
  "open_prefab",
  "create_node",
  "manage_components",
  "manage_undo",
  "batch_execute",
  "manage_editor",
  "find_gameobjects",
  "find_references",
  "get_project_info",
  "read_console",
  "capture_editor_screenshot",
  "resolve_capture_coordinates",
  "inspect_asset_dependencies",
  "manage_asset",
  "check_asset_ready",
  "button_events",
  "validate_prefab",
  "run_script_diagnostics"
]);
var CONNECTION_TOOLS = /* @__PURE__ */ new Set(["get_active_instances", "set_active_instance"]);
var TOOL_PROFILES = { full: "\u5168\u90E8", core: "\u6838\u5FC3", readonly: "\u53EA\u8BFB\u68C0\u67E5", ui: "UI \u7F16\u8F91", assets: "\u8D44\u6E90\u7BA1\u7406", prefabs: "\u9884\u5236\u4F53", debug: "\u8C03\u8BD5", custom: "\u81EA\u5B9A\u4E49" };
function selectToolProfile(tools, env = typeof process === "undefined" ? {} : process.env) {
  var _a, _b, _c, _d;
  const profile = env.MCP_BRIDGE_TOOL_PROFILE || "full";
  if (!Object.prototype.hasOwnProperty.call(TOOL_PROFILES, profile)) throw new Error("MCP_BRIDGE_TOOL_PROFILE \u65E0\u6548");
  const names = (value) => new Set((value || "").split(",").map((s) => s.trim()).filter(Boolean));
  const enabled = names(env.MCP_BRIDGE_ENABLED_TOOLS), disabled = names(env.MCP_BRIDGE_DISABLED_TOOLS);
  for (const name of [...enabled, ...disabled]) if (!tools.some((tool) => tool.name === name)) throw new Error(`\u5DE5\u5177\u914D\u7F6E\u5305\u542B\u672A\u77E5\u540D\u79F0: ${name}`);
  if (profile === "custom" && !enabled.size) throw new Error("custom \u5DE5\u5177\u96C6\u9700\u8981 MCP_BRIDGE_ENABLED_TOOLS");
  const actions = env.MCP_BRIDGE_TOOL_ACTIONS ? JSON.parse(env.MCP_BRIDGE_TOOL_ACTIONS) : {};
  if (!actions || typeof actions !== "object" || Array.isArray(actions)) throw new Error("\u5DE5\u5177\u64CD\u4F5C\u767D\u540D\u5355\u9700\u8981 JSON \u5BF9\u8C61");
  for (const name of Object.keys(actions)) {
    const choices = (_d = (_c = (_b = (_a = tools.find((tool) => tool.name === name)) == null ? void 0 : _a.inputSchema) == null ? void 0 : _b.properties) == null ? void 0 : _c.action) == null ? void 0 : _d.enum;
    if (!choices || !Array.isArray(actions[name]) || !actions[name].length || actions[name].some((value) => !choices.includes(value))) throw new Error("\u5DE5\u5177\u64CD\u4F5C\u767D\u540D\u5355\u65E0\u6548: " + name);
  }
  return tools.filter((tool) => {
    var _a2;
    if (CONNECTION_TOOLS.has(tool.name)) return true;
    const metadata = capabilityMetadata(tool), alias2 = toolAlias(tool.name);
    if ((alias2 == null ? void 0 : alias2.action) && actions[alias2.target] && !actions[alias2.target].includes(alias2.action)) return false;
    const categories = { ui: ["scene", "components", "ui", "events", "camera", "selection", "screenshots", "undo"], assets: ["assets", "materials", "files", "diagnostics"], prefabs: ["prefabs", "scene", "components", "diagnostics"], debug: ["runtime", "execution", "logs", "diagnostics", "events", "screenshots", "input"] };
    const chosen = profile === "full" || profile === "core" && metadata.profile === "core" || profile === "readonly" && (metadata.annotations.readOnlyHint || tool.name === "batch_execute") || profile === "ui" && UI_TOOLS.has(tool.name) || ((_a2 = categories[profile]) == null ? void 0 : _a2.includes(metadata.category)) && !metadata.compatibility || profile !== "readonly" && enabled.has(tool.name);
    return !disabled.has(tool.name) && chosen;
  }).map((tool) => actions[tool.name] ? { ...tool, inputSchema: { ...tool.inputSchema, properties: { ...tool.inputSchema.properties, action: { ...tool.inputSchema.properties.action, enum: actions[tool.name] } } } } : tool);
}

// src/panel/MenuActions.ts
var PANEL_MENU_ACTIONS = {
  "server": { page: "main", target: "btnToggle", invoke: "click", waitFor: "server" },
  "restart": { page: "main", target: "btnRestart", invoke: "click" },
  "copy-endpoint": { page: "main", target: "btnCopyEndpoint", invoke: "click", waitFor: "dashboard" },
  "copy-cli": { page: "main", target: "btnCopyCli", invoke: "click", waitFor: "dashboard" },
  "refresh-status": { page: "main", target: "btnRefreshStatus", invoke: "click" },
  "open-project": { page: "main", target: "btnOpenProject", invoke: "click", waitFor: "dashboard" },
  "call-history": { page: "main", target: "callHistory" },
  "clear-calls": { page: "main", target: "btnClearCalls", invoke: "click" },
  "logs": { page: "main", target: "logConsole" },
  "copy-logs": { page: "main", target: "btnCopy", invoke: "click", waitFor: "server" },
  "clear-logs": { page: "main", target: "btnClear", invoke: "click" },
  "toolchain": { page: "config", target: "toolchainSettings", waitFor: "clients" },
  "client": { page: "config", target: "mcpClientSelect", waitFor: "clients" },
  "scan-clients": { page: "config", target: "btnRefreshMcp", invoke: "click" },
  "configure-client": { page: "config", target: "btnInjectMcp", invoke: "click", waitFor: "clients" },
  "configure-all": { page: "config", target: "btnInjectAll", invoke: "click", waitFor: "clients" },
  "connection": { page: "main", target: "serverSettings" },
  "port": { page: "main", target: "portInput", waitFor: "server" },
  "host": { page: "main", target: "hostInput", waitFor: "server" },
  "apply-host": { page: "main", target: "btnApplyHost", invoke: "click", waitFor: "server" },
  "auto-start": { page: "main", target: "autoStartCheck", invoke: "toggle", waitFor: "server" },
  "tools": { page: "config", target: "toolExposureSettings" },
  "preset": { page: "config", target: "toolPresetSelect", waitFor: "tools" },
  "preset-name": { page: "config", target: "toolPresetName", waitFor: "tools" },
  "tool-mode": { page: "config", target: "toolProfileMode", waitFor: "tools" },
  "search-tools": { page: "config", target: "toolSearch" },
  "hide-compat": { page: "config", target: "hideCompatTools", invoke: "toggle", waitFor: "tools" },
  "reload-presets": { page: "config", target: "btnLoadPresets", invoke: "click" },
  "select-tools": { page: "config", target: "btnSelectAllTools", invoke: "click", waitFor: "tools" },
  "clear-tools": { page: "config", target: "btnClearTools", invoke: "click", waitFor: "tools" },
  "reset-tools": { page: "config", target: "btnResetTools", invoke: "click", waitFor: "tools" },
  "save-preset": { page: "config", target: "btnSavePreset", invoke: "click", waitFor: "tools" },
  "export-presets": { page: "config", target: "btnExportPresets", invoke: "click", waitFor: "tools" },
  "import-presets": { page: "config", target: "btnImportPresets", invoke: "click", waitFor: "tools" },
  "screenshots": { page: "config", target: "screenshotSettings" },
  "screenshot-width": { page: "config", target: "screenshotWidthInput", waitFor: "server" },
  "screenshot-throttle": { page: "config", target: "screenshotThrottleInput", waitFor: "server" },
  "save-screenshots": { page: "config", target: "btnSaveScreenshotSettings", invoke: "click", waitFor: "server" }
};
async function runPanelMenu(panel, name) {
  if (!Object.prototype.hasOwnProperty.call(PANEL_MENU_ACTIONS, name)) throw new Error("\u672A\u77E5\u7684 MCP \u83DC\u5355\u64CD\u4F5C\uFF1A" + name);
  const action = PANEL_MENU_ACTIONS[name], els = panel.menuElements;
  panel.switchMenuTab(
    action.page === "config" ? els.tabConfig : els.tabMain,
    action.page === "config" ? els.panelConfig : els.panelMain
  );
  await (action.page === "config" ? panel.menuToolsReady : Promise.all([panel.menuServerReady, panel.menuDashboardReady]));
  let ready = true;
  if (action.waitFor === "clients") {
    ready = await panel.fetchMcpClients(els);
  } else if (action.waitFor) {
    const pending = { server: panel.menuServerReady, dashboard: panel.menuDashboardReady, tools: panel.menuToolsReady };
    ready = action.waitFor === "dashboard" && !!panel.dashboardData || await pending[action.waitFor];
  }
  if (panel.dashboardClosed) return;
  if (!ready) throw new Error("\u9762\u677F\u6570\u636E\u8BFB\u53D6\u5931\u8D25\uFF0C\u8BF7\u91CD\u65B0\u8BFB\u53D6\u540E\u64CD\u4F5C");
  const target = panel.shadowRoot.querySelector("#" + action.target);
  if (!target) throw new Error("\u627E\u4E0D\u5230\u83DC\u5355\u5BF9\u5E94\u7684\u9762\u677F\u9009\u9879\uFF1A" + action.target);
  if (target.disabled) throw new Error("\u5F53\u524D\u72B6\u6001\u4E0B\u8BE5\u64CD\u4F5C\u4E0D\u53EF\u7528\uFF0C\u8BF7\u5148\u68C0\u67E5\u9762\u677F\u72B6\u6001");
  for (let parent = target.parentElement; parent; parent = parent.parentElement) {
    if (parent.tagName === "DETAILS") parent.open = true;
  }
  target.scrollIntoView({ block: "center" });
  target.focus();
  if (action.invoke === "toggle") {
    if (target.tagName === "UI-CHECKBOX") target.value = !target.value;
    else target.checked = !target.checked;
    target.dispatchEvent(new Event("change", { bubbles: true }));
  } else if (action.invoke === "click") target.click();
}

// src/panel/index.ts
Editor.Panel.extend({
  /**
   * 面板 CSS 样式
   */
  style: fs.readFileSync(Editor.url("packages://mcp-bridge/panel/index.css"), "utf-8"),
  /**
   * 面板 HTML 模板
   */
  template: fs.readFileSync(Editor.url("packages://mcp-bridge/panel/index.html"), "utf-8"),
  /**
   * 监听来自主进程的消息
   */
  messages: {
    /**
     * 接收并渲染日志
     * @param {Object} event IPC 事件对象
     * @param {Object} log 日志数据
     */
    "mcp-bridge:on-log"(event, log) {
      this.renderLog(log);
    },
    /**
     * 服务器状态变更通知
     * @param {Object} event IPC 事件对象
     * @param {Object} config 服务器配置
     */
    "mcp-bridge:state-changed"(event, config) {
      Editor.Ipc.sendToMain("mcp-bridge:get-server-state", (err, data) => {
        if (data) {
          const portInput = this.shadowRoot.querySelector("#portInput");
          if (portInput) portInput.value = data.config.port;
          this.updateUI(data.config.active);
          const activePortDisplay = this.shadowRoot.querySelector(
            "#activePortDisplay"
          );
          if (data.config.active && activePortDisplay) {
            activePortDisplay.style.display = "inline";
            const actPort = parseInt(data.config.port);
            activePortDisplay.textContent = `(\u5F53\u524D\u751F\u6548: ${actPort})`;
            activePortDisplay.style.color = "#888";
          } else {
            if (activePortDisplay) activePortDisplay.style.display = "none";
          }
        }
      });
    }
  },
  async run(argv) {
    if (!(argv == null ? void 0 : argv.menuAction)) return;
    try {
      await runPanelMenu(this, argv.menuAction);
    } catch (err) {
      Editor.warn("MCP \u83DC\u5355\u64CD\u4F5C\u5931\u8D25\uFF1A" + String(err.message || err));
    }
  },
  /**
   * 面板就绪回调，进行 DOM 绑定与事件初始化
   */
  ready() {
    this.dashboardClosed = false;
    this.dashboardPending = false;
    this.dashboardGeneration = (this.dashboardGeneration || 0) + 1;
    this.menuDashboardReady = new Promise((resolve) => {
      this.resolveMenuDashboardReady = resolve;
    });
    clearInterval(this.dashboardTimer);
    const root = this.shadowRoot;
    root.querySelector("#btnApplyHost").addEventListener("click", () => {
      const button = root.querySelector("#btnApplyHost");
      button.disabled = true;
      Editor.Ipc.sendToMain("mcp-bridge:apply-host", root.querySelector("#hostInput").value, (err, config) => {
        button.disabled = false;
        root.querySelector("#hostNotice").textContent = err ? String(err) : "Host \u5DF2\u4FDD\u5B58\uFF1B\u8FDE\u63A5\u5730\u5740\u6539\u53D8\u540E\u8BF7\u91CD\u65B0\u914D\u7F6E\u5BA2\u6237\u7AEF\u3002";
        this.refreshDashboard();
      });
    });
    this.setupToolPresets(root);
    const notice = (message, error = false) => {
      const el = root.querySelector("#dashboardNotice");
      el.textContent = message;
      el.classList.toggle("error", error);
    };
    root.querySelector("#btnRefreshStatus").addEventListener("click", () => this.refreshDashboard(true));
    root.querySelector("#btnClearCalls").addEventListener("click", () => {
      Editor.Ipc.sendToMain("mcp-bridge:clear-call-history", (err) => {
        if (err) notice(String(err), true);
        else this.refreshDashboard();
      });
    });
    root.querySelector("#btnCopyEndpoint").addEventListener("click", () => {
      var _a;
      if (!((_a = this.dashboardData) == null ? void 0 : _a.endpoint)) return;
      require("electron").clipboard.writeText(this.dashboardData.endpoint);
      notice("\u7AEF\u70B9\u5DF2\u590D\u5236");
    });
    root.querySelector("#btnCopyCli").addEventListener("click", () => {
      if (!this.dashboardData) return;
      require("electron").clipboard.writeText(this.dashboardData.cli);
      notice("stdio \u4EE3\u7406\u547D\u4EE4\u5DF2\u590D\u5236");
    });
    root.querySelector("#btnOpenProject").addEventListener("click", async () => {
      var _a;
      const button = root.querySelector("#btnOpenProject");
      button.disabled = true;
      try {
        if (!((_a = this.dashboardData) == null ? void 0 : _a.projectPath)) throw new Error("\u5DE5\u7A0B\u4FE1\u606F\u5C1A\u672A\u8BFB\u53D6\uFF0C\u8BF7\u5148\u5237\u65B0\u72B6\u6001");
        const projectPath = path.normalize(this.dashboardData.projectPath);
        const error = await require("electron").shell.openPath(projectPath);
        if (error) throw new Error(error);
        notice("\u5DF2\u6253\u5F00\u5DE5\u7A0B\u76EE\u5F55\uFF1A" + projectPath);
      } catch (err) {
        notice("\u6253\u5F00\u5DE5\u7A0B\u76EE\u5F55\u5931\u8D25\uFF1A" + String(err.message || err), true);
      } finally {
        button.disabled = false;
      }
    });
    root.querySelector("#btnRestart").addEventListener("click", () => {
      const button = root.querySelector("#btnRestart");
      button.disabled = true;
      notice("\u6B63\u5728\u91CD\u542F\u670D\u52A1\u2026");
      Editor.Ipc.sendToMain("mcp-bridge:restart-server", (err) => {
        button.disabled = false;
        notice(err ? String(err.message || err) : "\u5DF2\u63D0\u4EA4\u91CD\u542F\uFF0C\u670D\u52A1\u72B6\u6001\u4EE5\u6982\u89C8\u4E3A\u51C6", !!err);
        this.refreshDashboard();
      });
    });
    this.refreshDashboard();
    this.dashboardTimer = setInterval(() => this.refreshDashboard(), 1e4);
    const els = {
      port: root.querySelector("#portInput"),
      btnToggle: root.querySelector("#btnToggle"),
      autoStart: root.querySelector("#autoStartCheck"),
      logView: root.querySelector("#logConsole"),
      tabMain: root.querySelector("#tabMain"),
      tabConfig: root.querySelector("#tabConfig"),
      panelMain: root.querySelector("#panelMain"),
      panelConfig: root.querySelector("#panelConfig"),
      mcpClientSelect: root.querySelector("#mcpClientSelect"),
      mcpConfigStatus: root.querySelector("#mcpConfigStatus"),
      btnRefreshMcp: root.querySelector("#btnRefreshMcp"),
      btnInjectMcp: root.querySelector("#btnInjectMcp"),
      btnInjectAll: root.querySelector("#btnInjectAll")
    };
    this.menuElements = els;
    this.menuServerReady = new Promise((resolve) => {
      Editor.Ipc.sendToMain("mcp-bridge:get-server-state", (err, data) => {
        if (data) {
          els.port.value = data.config.port;
          root.querySelector("#hostInput").value = data.config.host || "127.0.0.1";
          root.querySelector("#hostNotice").textContent = data.config.startError || "\u9ED8\u8BA4\u4EC5\u672C\u673A\u8BBF\u95EE\uFF1B\u6539\u4E3A\u5C40\u57DF\u7F51\u5730\u5740\u540E\uFF0C\u4EC5\u5411\u53EF\u4FE1\u7F51\u7EDC\u5F00\u653E\u3002";
          els.autoStart.value = data.autoStart;
          this.updateUI(data.config.active);
          const activePortDisplay = root.querySelector("#activePortDisplay");
          if (data.config.active && activePortDisplay) {
            activePortDisplay.style.display = "inline";
            const actPort = parseInt(data.config.port);
            activePortDisplay.textContent = `(\u5F53\u524D\u751F\u6548: ${actPort})`;
            activePortDisplay.style.color = "#888";
          } else {
            if (activePortDisplay) activePortDisplay.style.display = "none";
          }
          const widthInput = root.querySelector("#screenshotWidthInput");
          const throttleInput = root.querySelector("#screenshotThrottleInput");
          if (widthInput) widthInput.value = data.screenshotMaxWidth !== void 0 ? data.screenshotMaxWidth : 1280;
          if (throttleInput) throttleInput.value = data.screenshotThrottle !== void 0 ? data.screenshotThrottle : 1500;
          els.logView.innerHTML = "";
          data.logs.forEach((l) => this.renderLog(l));
        }
        resolve(!!data && !err);
      });
    });
    const switchTab = (activeTab, activePanel) => {
      [els.tabMain, els.tabConfig].forEach((t) => {
        if (t) t.classList.remove("active");
      });
      [els.panelMain, els.panelConfig].forEach((p) => {
        if (p) p.classList.remove("active");
      });
      if (activeTab) activeTab.classList.add("active");
      if (activePanel) activePanel.classList.add("active");
    };
    this.switchMenuTab = switchTab;
    if (els.tabMain) els.tabMain.addEventListener("click", () => switchTab(els.tabMain, els.panelMain));
    if (els.tabConfig) {
      els.tabConfig.addEventListener("click", () => {
        switchTab(els.tabConfig, els.panelConfig);
        this.fetchMcpClients(els);
      });
    }
    els.btnToggle.addEventListener("click", () => {
      const port = Number(els.port.value);
      if (!Number.isInteger(port) || port < 1 || port > 65535) {
        notice("\u7AEF\u53E3\u5FC5\u987B\u4E3A 1\u201365535 \u7684\u6574\u6570", true);
        return;
      }
      Editor.Ipc.sendToMain("mcp-bridge:toggle-server", port);
    });
    root.querySelector("#btnClear").addEventListener("click", () => {
      els.logView.innerHTML = "";
      Editor.Ipc.sendToMain("mcp-bridge:clear-logs");
    });
    root.querySelector("#btnCopy").addEventListener("click", () => {
      require("electron").clipboard.writeText(els.logView.innerText);
      Editor.success("\u65E5\u5FD7\u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F");
    });
    els.autoStart.addEventListener("change", (e) => {
      Editor.Ipc.sendToMain("mcp-bridge:set-auto-start", e.target.value);
    });
    if (els.btnRefreshMcp) els.btnRefreshMcp.addEventListener("click", () => this.fetchMcpClients(els));
    if (els.btnInjectMcp) {
      els.btnInjectMcp.addEventListener("click", () => {
        const clientId = parseInt(els.mcpClientSelect.value);
        if (!isNaN(clientId)) this.injectMcpConfig(clientId, els);
      });
    }
    if (els.btnInjectAll) {
      els.btnInjectAll.addEventListener("click", () => {
        this.injectMcpConfig(-1, els);
      });
    }
    if (els.mcpClientSelect) {
      els.mcpClientSelect.addEventListener("change", () => {
        this.renderMcpClientStatus(els);
      });
    }
    const btnSaveScreenshotSettings = root.querySelector("#btnSaveScreenshotSettings");
    if (btnSaveScreenshotSettings) {
      btnSaveScreenshotSettings.addEventListener("click", () => {
        const widthInput = root.querySelector("#screenshotWidthInput");
        const throttleInput = root.querySelector("#screenshotThrottleInput");
        const maxWidth = parseInt(widthInput.value);
        const throttle = parseInt(throttleInput.value);
        if (isNaN(maxWidth) || maxWidth < 100) {
          Editor.warn("\u6700\u5927\u5BBD\u5EA6\u5FC5\u987B\u662F\u5927\u4E8E\u7B49\u4E8E 100 \u7684\u6570\u5B57");
          return;
        }
        if (isNaN(throttle) || throttle < 0) {
          Editor.warn("\u8282\u6D41\u65F6\u95F4\u5FC5\u987B\u662F\u5927\u4E8E\u7B49\u4E8E 0 \u7684\u6570\u5B57");
          return;
        }
        Editor.Ipc.sendToMain("mcp-bridge:set-screenshot-settings", { maxWidth, throttle }, (err) => {
          if (err) {
            Editor.error("\u4FDD\u5B58\u8BBE\u7F6E\u5931\u8D25: " + err);
          } else {
            Editor.success("\u622A\u56FE\u4F18\u5316\u8BBE\u7F6E\u5DF2\u6210\u529F\u4FDD\u5B58\uFF01");
          }
        });
      });
    }
  },
  close() {
    clearInterval(this.dashboardTimer);
    clearTimeout(this.dashboardTimeout);
    this.dashboardClosed = true;
    this.dashboardGeneration++;
    if (this.resolveMenuDashboardReady) this.resolveMenuDashboardReady(false);
    this.resolveMenuDashboardReady = null;
  },
  refreshDashboard(manual = false) {
    if (this.dashboardPending || this.dashboardClosed) return;
    this.dashboardPending = true;
    const generation = this.dashboardGeneration;
    const root = this.shadowRoot;
    const button = root.querySelector("#btnRefreshStatus");
    const notice = root.querySelector("#dashboardNotice");
    button.disabled = true;
    if (manual) {
      button.textContent = "\u5237\u65B0\u4E2D\u2026";
      notice.textContent = "\u6B63\u5728\u8BFB\u53D6\u6700\u65B0\u72B6\u6001\u2026";
      notice.classList.remove("error");
    }
    let finished = false;
    const finish = (err, data) => {
      if (finished || generation !== this.dashboardGeneration) return;
      finished = true;
      clearTimeout(this.dashboardTimeout);
      this.dashboardPending = false;
      if (this.dashboardClosed) return;
      if (this.resolveMenuDashboardReady) {
        this.resolveMenuDashboardReady(!err && !!data);
        this.resolveMenuDashboardReady = null;
      }
      button.disabled = false;
      button.textContent = "\u5237\u65B0\u72B6\u6001";
      if (err || !data) {
        notice.textContent = "\u72B6\u6001\u8BFB\u53D6\u5931\u8D25\uFF1A" + String((err == null ? void 0 : err.message) || err || "\u65E0\u6570\u636E");
        notice.classList.add("error");
        root.querySelector("#serverState").textContent = "\u72B6\u6001\u672A\u77E5";
        root.querySelector("#serverDot").classList.remove("online");
        root.querySelector("#btnCopyEndpoint").disabled = true;
        return;
      }
      this.dashboardData = data;
      if (data.config.startError) root.querySelector("#hostNotice").textContent = data.config.startError;
      if (data.calls) this.renderCalls(data.calls);
      const set = (id, value) => {
        const el = root.querySelector("#" + id);
        el.textContent = String(value);
        el.title = String(value);
      };
      set("serverState", data.config.active ? "\u8FD0\u884C\u4E2D" : data.config.state === "starting" ? "\u542F\u52A8\u4E2D" : "\u5DF2\u505C\u6B62");
      root.querySelector("#serverDot").classList.toggle("online", data.config.active);
      set("endpoint", data.endpoint || "\u670D\u52A1\u672A\u542F\u52A8");
      root.querySelector("#btnCopyEndpoint").disabled = !data.endpoint;
      set("toolCount", `Tools ${data.tools} / ${data.resources} res`);
      set("requestCount", `\u5DE5\u5177\u8C03\u7528 ${data.requests}`);
      set("projectPath", data.projectPath);
      set("engineVersion", "Creator " + data.engineVersion);
      set("gitBranch", data.branch);
      set("gitHead", data.head);
      set("editorPid", data.editorPid);
      set("buildInfo", data.runtime.version + " / " + data.runtime.buildId.slice(0, 8));
      set("queueInfo", data.queue.blockedReason ? "\u5DF2\u963B\u585E\uFF1A" + data.queue.blockedReason : data.queue.current ? data.queue.current.tool + " \xB7 \u7B49\u5F85 " + data.queue.waiting : "\u7A7A\u95F2");
      set("infoUpdated", new Date(data.updatedAt).toLocaleTimeString());
      this.updateUI(data.config.active);
      if (manual || notice.classList.contains("error")) {
        notice.textContent = "\u72B6\u6001\u5DF2\u5237\u65B0\uFF08" + new Date(data.updatedAt).toLocaleTimeString() + "\uFF09";
        notice.classList.remove("error");
      }
    };
    this.dashboardTimeout = setTimeout(() => finish(new Error("\u7F16\u8F91\u5668\u54CD\u5E94\u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5")), 5e3);
    try {
      Editor.Ipc.sendToMain("mcp-bridge:get-panel-status", finish);
    } catch (err) {
      finish(err);
    }
  },
  setupToolPresets(root) {
    for (const value of Object.keys(TOOL_PROFILES)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = TOOL_PROFILES[value];
      root.querySelector("#toolProfileMode").appendChild(option);
    }
    let pending = false;
    const message = (text, error = false) => {
      const el = root.querySelector("#toolPresetNotice");
      el.textContent = text;
      el.classList.toggle("error", error);
    };
    const send = (method, value, done) => new Promise((resolve) => {
      if (pending) {
        message("\u6B63\u5728\u5904\u7406\u9884\u8BBE\uFF0C\u8BF7\u7A0D\u5019");
        resolve(false);
        return;
      }
      pending = true;
      const generation = this.dashboardGeneration;
      let finished = false;
      const finish = (err, result) => {
        if (finished) return;
        finished = true;
        pending = false;
        clearTimeout(timer);
        if (this.dashboardClosed || generation !== this.dashboardGeneration) {
          resolve(false);
          return;
        }
        if (err) message(String(err.message || err), true);
        else done(result);
        resolve(!err);
      };
      const timer = setTimeout(() => finish("\u64CD\u4F5C\u8D85\u65F6\uFF0C\u8BF7\u91CD\u65B0\u8BFB\u53D6\u9884\u8BBE\u786E\u8BA4\u7ED3\u679C"), 5e3);
      try {
        if (value === void 0) Editor.Ipc.sendToMain("mcp-bridge:" + method, finish);
        else Editor.Ipc.sendToMain("mcp-bridge:" + method, value, finish);
      } catch (err) {
        finish(err);
      }
    });
    const checklist = (preset) => {
      var _a, _b, _c, _d;
      const container = root.querySelector("#toolChecklist");
      container.textContent = "";
      const chosen = new Set(selectToolProfile(this.presetTools, { MCP_BRIDGE_TOOL_PROFILE: preset.profile, MCP_BRIDGE_ENABLED_TOOLS: preset.enabled.join(","), MCP_BRIDGE_DISABLED_TOOLS: preset.disabled.join(","), MCP_BRIDGE_TOOL_ACTIONS: JSON.stringify(preset.actions || {}) }).map((tool) => tool.name));
      for (const category of Object.keys(TOOL_CATEGORIES)) {
        const tools = this.presetTools.filter((tool) => tool.category === category);
        if (!tools.length) continue;
        const group = document.createElement("details"), summary = document.createElement("summary"), buttons = document.createElement("div");
        group.className = "tool-group";
        group.open = true;
        summary.dataset.title = TOOL_CATEGORIES[category];
        group.appendChild(summary);
        buttons.className = "tool-group-actions";
        for (const [title, checked] of [["\u9009\u62E9", true], ["\u6E05\u9664", false]]) {
          const button = document.createElement("button");
          button.textContent = title;
          button.addEventListener("click", () => {
            group.querySelectorAll("input[data-tool]").forEach((input) => {
              if (!input.disabled) input.checked = checked;
            });
            updateCounts();
          });
          buttons.appendChild(button);
        }
        group.appendChild(buttons);
        for (const tool of tools) {
          const row = document.createElement("div"), title = document.createElement("label"), input = document.createElement("input"), label = document.createElement("span"), badge = document.createElement("span"), description = document.createElement("small");
          row.className = "tool-row";
          row.dataset.search = (tool.name + " " + tool.description + " " + category + " " + TOOL_CATEGORIES[category]).toLowerCase();
          row.dataset.compatibility = String(!!tool.compatibility);
          input.type = "checkbox";
          input.dataset.tool = tool.name;
          input.checked = chosen.has(tool.name);
          input.disabled = preset.profile === "readonly" && !((_a = tool.annotations) == null ? void 0 : _a.readOnlyHint) && tool.name !== "batch_execute";
          input.addEventListener("change", updateCounts);
          const precautionsEnd = "\u4EE5\u9632\u6B62\u7F16\u8F91\u5668\u957F\u671F\u5361\u6B7B\u3002", precautionsIndex = tool.description.indexOf(precautionsEnd);
          row.title = tool.description;
          label.textContent = tool.name;
          badge.className = "tool-badge";
          badge.textContent = (tool.compatibility ? "\u517C\u5BB9 \xB7 " : "") + (((_b = tool.annotations) == null ? void 0 : _b.readOnlyHint) ? "\u53EA\u8BFB" : "\u53EF\u64CD\u4F5C");
          description.textContent = precautionsIndex < 0 ? tool.description : tool.description.slice(precautionsIndex + precautionsEnd.length).trim();
          title.appendChild(input);
          title.appendChild(label);
          title.appendChild(badge);
          row.appendChild(title);
          row.appendChild(description);
          const choices = (_c = tool.inputSchema.properties.action) == null ? void 0 : _c.enum;
          if (choices) {
            const details = document.createElement("details"), heading = document.createElement("summary"), items = document.createElement("div");
            details.className = "tool-actions";
            heading.textContent = "\u5F00\u653E\u64CD\u4F5C";
            details.appendChild(heading);
            for (const action of choices) {
              const item = document.createElement("label"), checkbox = document.createElement("input");
              checkbox.type = "checkbox";
              checkbox.disabled = input.disabled;
              checkbox.dataset.owner = tool.name;
              checkbox.dataset.action = action;
              checkbox.checked = !((_d = preset.actions) == null ? void 0 : _d[tool.name]) || preset.actions[tool.name].includes(action);
              checkbox.addEventListener("change", () => {
                input.checked = Array.from(items.querySelectorAll("input")).some((value) => value.checked);
                updateCounts();
              });
              item.appendChild(checkbox);
              item.appendChild(document.createTextNode(action));
              items.appendChild(item);
            }
            details.appendChild(items);
            row.appendChild(details);
          }
          group.appendChild(row);
        }
        container.appendChild(group);
      }
      updateCounts();
      filterTools();
    };
    const updateCounts = () => {
      const total = root.querySelectorAll("#toolChecklist input[data-tool]");
      total.forEach((input) => {
        const actions = Array.from(root.querySelectorAll('input[data-owner="' + input.dataset.tool + '"]'));
        if (input.checked && actions.length && !actions.some((action) => action.checked)) actions.forEach((action) => action.checked = true);
      });
      root.querySelector("#toolExposureCount").textContent = Array.from(total).filter((input) => input.checked).length + " / " + total.length + " \u4E2A\u5DE5\u5177";
      root.querySelectorAll(".tool-group").forEach((group) => {
        const inputs = Array.from(group.querySelectorAll("input[data-tool]"));
        const summary = group.querySelector("summary");
        summary.textContent = summary.dataset.title + "\uFF08" + inputs.filter((input) => input.checked).length + "/" + inputs.length + "\uFF09";
      });
    };
    const filterTools = () => {
      const query = root.querySelector("#toolSearch").value.trim().toLowerCase(), hideCompat = root.querySelector("#hideCompatTools").checked;
      root.querySelectorAll(".tool-row").forEach((row) => row.hidden = !row.dataset.search.includes(query) || hideCompat && row.dataset.compatibility === "true");
      root.querySelectorAll(".tool-group").forEach((group) => group.hidden = !Array.from(group.querySelectorAll(".tool-row")).some((row) => !row.hidden));
    };
    root.querySelector("#toolSearch").addEventListener("input", filterTools);
    root.querySelector("#hideCompatTools").addEventListener("change", filterTools);
    for (const [id, checked] of [["btnSelectAllTools", true], ["btnClearTools", false]]) root.querySelector("#" + id).addEventListener("click", () => {
      root.querySelectorAll("#toolChecklist input[data-tool]").forEach((input) => {
        if (!input.disabled) input.checked = checked;
      });
      updateCounts();
    });
    root.querySelector("#btnResetTools").addEventListener("click", () => {
      if (this.presetTools) checklist({ profile: root.querySelector("#toolProfileMode").value === "custom" ? "core" : root.querySelector("#toolProfileMode").value, enabled: [], disabled: [] });
    });
    const show = (name) => {
      const preset = this.presetState.presets.find((item) => item.name === name);
      root.querySelector("#toolPresetName").value = preset.name;
      root.querySelector("#toolProfileMode").value = preset.profile;
      checklist(preset);
    };
    const render = (state) => {
      this.presetState = state;
      const select = root.querySelector("#toolPresetSelect");
      select.textContent = "";
      for (const preset of state.presets) {
        const option = document.createElement("option");
        option.value = preset.name;
        option.textContent = preset.name + (state.active === preset.name ? "\uFF08\u542F\u7528\uFF09" : "");
        select.appendChild(option);
      }
      select.value = state.active;
      show(state.active);
    };
    const load = () => this.menuToolsReady = send("get-tool-presets", void 0, (data) => {
      this.presetTools = data.tools;
      render(data.state);
      message("\u9884\u8BBE\u5DF2\u8BFB\u53D6");
    });
    root.querySelector("#btnLoadPresets").addEventListener("click", load);
    root.querySelector("#toolPresetSelect").addEventListener("change", (event) => {
      if (this.presetState) show(event.target.value);
    });
    root.querySelector("#toolProfileMode").addEventListener("change", (event) => {
      if (!this.presetTools || event.target.value === "custom") return;
      checklist({ profile: event.target.value, enabled: [], disabled: [] });
    });
    root.querySelector("#btnSavePreset").addEventListener("click", () => {
      if (!this.presetState) return message("\u8BF7\u5148\u8BFB\u53D6\u9884\u8BBE", true);
      const name = root.querySelector("#toolPresetName").value.trim(), profile = root.querySelector("#toolProfileMode").value;
      const enabled = [], disabled = [], actions = {};
      root.querySelectorAll("#toolChecklist input[data-tool]").forEach((input) => (input.checked ? enabled : disabled).push(input.dataset.tool));
      for (const tool of this.presetTools) {
        const inputs = Array.from(root.querySelectorAll('#toolChecklist input[data-owner="' + tool.name + '"]'));
        const selected = inputs.filter((input) => input.checked).map((input) => input.dataset.action);
        if (inputs.length && selected.length && selected.length !== inputs.length) actions[tool.name] = selected;
      }
      const preset = { name, profile, enabled, disabled, actions };
      const state = { version: 1, active: name, presets: this.presetState.presets.filter((item) => item.name !== name).concat(preset) };
      send("save-tool-presets", state, (result) => {
        render(result);
        message("\u5DF2\u4FDD\u5B58\u5E76\u542F\u7528\uFF1BHTTP \u5373\u65F6\u751F\u6548\uFF0Cstdio \u5237\u65B0\u5DE5\u5177\u76EE\u5F55\u3002\u672A\u81EA\u52A8\u66F4\u65B0\u7684\u5BA2\u6237\u7AEF\u8BF7\u91CD\u65B0\u8FDE\u63A5");
      });
    });
    root.querySelector("#btnExportPresets").addEventListener("click", () => {
      if (this.presetState) {
        require("electron").clipboard.writeText(JSON.stringify(this.presetState, null, 2));
        message("\u9884\u8BBE JSON \u5DF2\u590D\u5236");
      }
    });
    root.querySelector("#btnImportPresets").addEventListener("click", () => {
      if (!this.presetTools) return message("\u8BF7\u5148\u8BFB\u53D6\u9884\u8BBE", true);
      try {
        const raw = require("electron").clipboard.readText();
        if (raw.length > 128 * 1024) throw new Error("\u9884\u8BBE\u8D85\u8FC7128KiB");
        send("save-tool-presets", JSON.parse(raw), (result) => {
          render(result);
          message("\u5DF2\u5BFC\u5165\u5E76\u542F\u7528\uFF1B\u672A\u81EA\u52A8\u66F4\u65B0\u7684\u5BA2\u6237\u7AEF\u8BF7\u91CD\u65B0\u8FDE\u63A5");
        });
      } catch (err) {
        message("\u5BFC\u5165\u5931\u8D25\uFF1A" + err.message, true);
      }
    });
    load();
  },
  renderCalls(calls) {
    const container = this.shadowRoot.querySelector("#callHistory");
    const opened = new Set(Array.from(container.querySelectorAll("details[open]")).map((el) => el.dataset.callId));
    container.textContent = calls.length ? "" : "\u6682\u65E0\u8C03\u7528";
    for (const call of calls) {
      const row = document.createElement("details"), title = document.createElement("summary"), body = document.createElement("pre");
      row.dataset.callId = call.callId;
      row.open = opened.has(call.callId);
      title.textContent = `${call.ok ? "\u2713" : "\u2717"} ${call.tool} \xB7 ${call.timings.totalMs}ms \xB7 ${new Date(call.at).toLocaleTimeString()}`;
      title.className = call.ok ? "" : "error";
      body.textContent = JSON.stringify(call, null, 2);
      row.appendChild(title);
      row.appendChild(body);
      container.appendChild(row);
    }
  },
  fetchMcpClients(els) {
    if (!els.mcpClientSelect) return Promise.resolve(false);
    if (this.clientScanPending) return this.clientScanPending;
    els.mcpConfigStatus.innerHTML = "<span style='color:#ffb74d'>\u6B63\u5728\u626B\u63CF\u7CFB\u7EDF\u914D\u7F6E...</span>";
    this.clientScanPending = new Promise((resolve) => {
      Editor.Ipc.sendToMain("mcp-bridge:mcp-scan-clients", (err, clients) => {
        if (err) {
          els.mcpConfigStatus.innerHTML = `<span style='color:#f44336'>\u626B\u63CF\u5931\u8D25: ${err.message}</span>`;
          resolve(false);
          return;
        }
        this.mcpClientsData = clients;
        const previousSelection = els.mcpClientSelect.value;
        els.mcpClientSelect.innerHTML = "";
        clients.forEach((client) => {
          const opt = document.createElement("option");
          opt.value = client.id;
          opt.textContent = client.name;
          els.mcpClientSelect.appendChild(opt);
        });
        const selected = clients.find((client) => String(client.id) === previousSelection) || clients.find((client) => client.name === "Codex") || clients[0];
        if (selected) els.mcpClientSelect.value = String(selected.id);
        this.renderMcpClientStatus(els);
        resolve(clients.length > 0);
      });
    }).then((result) => {
      this.clientScanPending = null;
      return result;
    });
    return this.clientScanPending;
  },
  renderMcpClientStatus(els) {
    if (!this.mcpClientsData || !els.mcpClientSelect.value) return;
    const clientId = parseInt(els.mcpClientSelect.value);
    const client = this.mcpClientsData.find((c) => c.id === clientId);
    if (!client) return;
    let statusHtml = `<div style="word-break: break-all;">\u50A8\u5B58\u8DEF\u5F84: <span style="color:#aaa">${client.path || "\u672A\u77E5"}</span></div>`;
    if (client.isError) {
      statusHtml += `<div style="color:#f44336; margin-top:5px; font-weight:bold;">\u{1F534} \u914D\u7F6E\u6587\u4EF6\u635F\u574F</div>`;
    } else if (!client.isInstalled) {
      statusHtml += `<div style="color:#f44336; margin-top:5px; font-weight:bold;">\u{1F534} \u672A\u5B89\u88C5\u6B64\u5BA2\u6237\u7AEF\u6216\u627E\u4E0D\u5230\u914D\u7F6E\u6587\u4EF6</div>`;
    } else if (client.isConfigured) {
      statusHtml += `<div style="color:#4caf50; margin-top:5px; font-weight:bold;">\u{1F7E2} \u5F53\u524D\u5DF2\u8FDE\u901A (MCP\u5DF2\u914D\u7F6E)</div>`;
    } else {
      statusHtml += `<div style="color:#ff9800; margin-top:5px; font-weight:bold;">\u{1F7E1} \u53D1\u73B0\u914D\u7F6E\u76EE\u5F55\uFF0C\u4F46\u5C1A\u672A\u8BBE\u7F6E MCP \u670D\u52A1</div>`;
    }
    els.mcpConfigStatus.innerHTML = statusHtml;
  },
  injectMcpConfig(clientId, els) {
    els.mcpConfigStatus.innerHTML += "<br><span style='color:#1976d2'>\u6B63\u5728\u6CE8\u5165\u914D\u7F6E...</span>";
    Editor.Ipc.sendToMain("mcp-bridge:mcp-inject-client", clientId, (err, log) => {
      if (err) {
        this.renderLog({
          type: "error",
          time: (/* @__PURE__ */ new Date()).toLocaleTimeString(),
          content: "\u914D\u7F6E\u5931\u8D25: " + err.message
        });
      } else {
        this.renderLog({
          type: "success",
          time: (/* @__PURE__ */ new Date()).toLocaleTimeString(),
          content: "MCP \u914D\u7F6E\u7ED3\u679C:\n" + log
        });
      }
      if (els.tabMain) {
        els.tabMain.dispatchEvent(new Event("click"));
      }
      setTimeout(() => this.fetchMcpClients(els), 500);
    });
  },
  /**
   * 将日志条目渲染至面板控制台
   * @param {Object} log 日志对象
   */
  renderLog(log) {
    const view = this.shadowRoot.querySelector("#logConsole");
    if (!view) return;
    while (view.childNodes.length > 1e3) {
      view.removeChild(view.firstChild);
    }
    const atBottom = view.scrollHeight - view.scrollTop <= view.clientHeight + 50;
    const el = document.createElement("div");
    el.className = `log-item ${log.type}`;
    const timeSpan = document.createElement("span");
    timeSpan.className = "time";
    timeSpan.textContent = log.time;
    const msgSpan = document.createElement("span");
    msgSpan.className = "msg";
    msgSpan.textContent = log.content;
    el.appendChild(timeSpan);
    el.appendChild(msgSpan);
    view.appendChild(el);
    if (atBottom) view.scrollTop = view.scrollHeight;
  },
  /**
   * 根据服务器运行状态更新 UI 按钮文字与样式
   * @param {boolean} active 服务器是否处于激活状态
   */
  updateUI(active) {
    const btn = this.shadowRoot.querySelector("#btnToggle");
    if (!btn) return;
    btn.innerText = active ? "\u505C\u6B62" : "\u542F\u52A8";
    btn.style.backgroundColor = "";
    if (active) {
      btn.classList.add("running");
      btn.classList.remove("green");
    } else {
      btn.classList.remove("running");
      btn.classList.add("green");
    }
  }
});
