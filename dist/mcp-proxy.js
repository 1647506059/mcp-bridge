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

// <define:__MCP_BRIDGE_BUILD__>
var define_MCP_BRIDGE_BUILD_default = { version: "1.7.0", buildId: "cace32e492364744e663a268d6cb42f5f96540a2b83df1f3afa16c149bcc9152", builtAt: "2026-11-05T09:16:27.063Z" };

// src/utils/AssetUrl.ts
function isAssetRoot(url) {
  return url === "db://assets" || url === "db://internal";
}
function validateAssetUrl(url, allowInternal = false) {
  const roots = allowInternal ? /^db:\/\/(assets|internal)$/ : /^db:\/\/assets$/;
  const nested = allowInternal ? /^db:\/\/(assets|internal)\/.+/ : /^db:\/\/assets\/.+/;
  if (typeof url !== "string" || !roots.test(url) && !nested.test(url)) {
    throw new Error("\u9700\u8981 db://assets/ \u4E0B\u7684\u8D44\u6E90 URL\uFF08\u53EA\u8BFB\u64CD\u4F5C\u53EF\u4F20\u6839\u76EE\u5F55 db://assets\uFF09");
  }
  const parts = url.slice(5).split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /[\\\x00-\x1f%?#:]/.test(part))) {
    throw new Error("\u8D44\u6E90 URL \u542B\u975E\u6CD5\u8DEF\u5F84\u6216\u76EE\u5F55\u7A7F\u8D8A");
  }
  return url;
}

// src/tools/BatchOperations.ts
var forbiddenKeys = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
function validate(value, schema, location, allowRef = false) {
  var _a;
  if (allowRef && value && typeof value === "object" && Object.hasOwnProperty.call(value, "$ref")) return;
  const type = schema.type;
  const valid = !type || (type === "array" ? Array.isArray(value) : type === "object" ? value !== null && typeof value === "object" && !Array.isArray(value) : type === "integer" ? Number.isInteger(value) : type === "number" ? typeof value === "number" && Number.isFinite(value) : typeof value === type);
  if (!valid) throw new Error(`${location} \u5FC5\u987B\u4E3A ${type}`);
  if (type === "object") {
    for (const key of Object.keys(value)) if (forbiddenKeys.has(key)) throw new Error(`\u4E0D\u5141\u8BB8\u7684\u53C2\u6570\u5B57\u6BB5: ${key}`);
  }
  if (schema.enum && !schema.enum.includes(value)) throw new Error(`${location} \u4E0D\u5728\u5141\u8BB8\u503C\u4E2D`);
  if (type === "object") {
    for (const key of schema.required || []) if (!Object.prototype.hasOwnProperty.call(value, key)) throw new Error(`${location}.${key} \u7F3A\u5C11\u5FC5\u586B\u53C2\u6570`);
    for (const key of Object.keys(value)) if ((_a = schema.properties) == null ? void 0 : _a[key]) validate(value[key], schema.properties[key], `${location}.${key}`, allowRef);
  }
  if (type === "array" && schema.items) value.forEach((item, i) => validate(item, schema.items, `${location}[${i}]`, allowRef));
  if (schema.minimum !== void 0 && value < schema.minimum || schema.maximum !== void 0 && value > schema.maximum) throw new Error(`${location} \u8D85\u51FA\u5141\u8BB8\u8303\u56F4`);
  if (schema.minItems !== void 0 && value.length < schema.minItems || schema.maxItems !== void 0 && value.length > schema.maxItems) throw new Error(`${location} \u6570\u91CF\u8D85\u51FA\u5141\u8BB8\u8303\u56F4`);
}
function validateConditional(tool, params) {
  var _a;
  if (tool === "delete_assets" || tool === "manage_asset" && params.action === "delete" && params.paths !== void 0) {
    if (params.path !== void 0) throw new Error("\u6279\u91CF\u5220\u9664 paths \u4E0E\u5355\u4E2A path \u4E0D\u80FD\u540C\u65F6\u63D0\u4F9B");
    for (const url of params.paths || []) {
      validateAssetUrl(url);
      if (isAssetRoot(url)) throw new Error("delete_assets \u4E0D\u5141\u8BB8\u5220\u9664\u8D44\u6E90\u6839\u76EE\u5F55");
    }
  }
  if (tool === "manage_components") {
    if (params.action !== "get" && !params.nodeId) throw new Error("manage_components \u5199\u64CD\u4F5C\u5FC5\u987B\u63D0\u4F9B nodeId");
    if (params.action === "get" && !params.nodeId && !params.nodeIds) throw new Error("manage_components(get) \u5FC5\u987B\u63D0\u4F9B nodeId \u6216 nodeIds");
    if (params.nodeId && params.nodeIds) throw new Error("nodeId \u4E0E nodeIds \u4E0D\u80FD\u540C\u65F6\u63D0\u4F9B");
    if (params.action === "add" && !params.componentType) throw new Error("\u6DFB\u52A0\u7EC4\u4EF6\u5FC5\u987B\u63D0\u4F9B componentType");
    if (["remove", "update"].includes(params.action) && !params.componentType && !params.componentId) throw new Error("\u5FC5\u987B\u63D0\u4F9B componentType \u6216 componentId");
    if (params.action !== "get" && params.nodeIds !== void 0) throw new Error("nodeIds \u4EC5\u9002\u7528\u4E8E get");
  }
  const requireFields = (keys) => {
    for (const key of keys) if (params[key] === void 0 || params[key] === "") throw new Error(`${tool}.${key} \u7F3A\u5C11\u64CD\u4F5C\u5FC5\u586B\u53C2\u6570`);
  };
  if (tool === "manage_asset") {
    if (params.paths !== void 0 && params.action !== "delete") throw new Error("paths \u4EC5\u7528\u4E8E\u6279\u91CF delete");
    if (!(params.action === "delete" && params.paths !== void 0)) requireFields(["path"]);
  }
  if (tool === "manage_asset" && params.action === "move") requireFields(["targetPath"]);
  if (tool === "scene_management" && params.action === "duplicate") requireFields(["targetPath"]);
  if (tool === "prefab_management" && ["create", "update"].includes(params.action)) requireFields(["nodeId"]);
  if (tool === "button_events" && params.action === "bind") requireFields(["targetId", "componentName", "handler"]);
  if (["manage_script", "manage_shader"].includes(tool) && ["write", "save"].includes(params.action)) requireFields(["content"]);
  if (tool === "capture_editor_screenshot") {
    if (params.crop && (!["x", "y", "width", "height"].every((k) => Number.isInteger(params.crop[k])) || params.crop.x < 0 || params.crop.y < 0 || params.crop.width < 1 || params.crop.height < 1)) throw new Error("crop \u9700\u8981\u5408\u6CD5\u77E9\u5F62");
  }
  if (tool === "build_project") requireFields(params.action === "status" ? ["jobId"] : ["platform"]);
  if (tool === "manage_editor" && params.action === "refresh_editor") {
    if (!((_a = params.properties) == null ? void 0 : _a.path)) throw new Error("refresh_editor \u9700\u8981 properties.path");
    validateAssetUrl(params.properties.path);
  }
  if (["manage_script", "manage_asset", "scene_management", "prefab_management", "manage_material", "manage_texture", "manage_shader", "apply_text_edits", "validate_script", "get_sha", "modify_prefab_offline", "modify_scene_offline", "open_scene", "open_prefab"].includes(tool)) {
    const readOnly = ["read", "get_info", "get_selection", "get_state"].includes(params.action);
    for (const key of ["path", "targetPath", "filePath", "prefabUrl", "sceneUrl", "url"]) {
      if (typeof params[key] !== "string") continue;
      validateAssetUrl(params[key], readOnly);
      if (isAssetRoot(params[key]) && !readOnly) throw new Error(`${tool} \u4E0D\u5141\u8BB8\u5BF9\u8D44\u6E90\u6839\u76EE\u5F55 ${params[key]} \u6267\u884C ${params.action} \u64CD\u4F5C`);
    }
  }
  if (tool === "create_scene" && typeof params.sceneName === "string") validateAssetUrl(`db://assets/${params.sceneName}.fire`);
  if (tool === "create_prefab" && typeof params.prefabName === "string") validateAssetUrl(params.prefabName.startsWith("db://") ? params.prefabName : `db://assets/${params.prefabName}.prefab`);
}

// src/tools/ToolCapabilities.ts
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
function resolveToolAlias(name, args = {}) {
  const item = toolAlias(name);
  if (!item) return { name, args };
  const normalized = { ...item.defaults, ...args };
  if (item.action) normalized.action = item.action;
  if (item.defaults.type) normalized.type = item.defaults.type;
  if (item.defaults.componentType) normalized.componentType = item.defaults.componentType;
  if (item.nodeKey && !normalized[item.nodeKey]) normalized[item.nodeKey] = normalized.uuid || normalized.nodeId || normalized.id;
  if (!normalized.componentType && normalized.componentName) normalized.componentType = normalized.componentName;
  if (name === "set_component_property") normalized.properties = { [normalized.propertyName]: normalized.value };
  if (name === "refresh_assets") normalized.properties = { path: normalized.path };
  return { name: item.target, args: normalized };
}
function granularTools(base) {
  return aliases.map((item) => {
    const alias2 = toolAlias(item.name);
    const parent = base.find((tool) => tool.name === item.target);
    const properties = { ...parent.inputSchema.properties, ...item.extra };
    delete properties.action;
    for (const key of Object.keys(item.defaults)) {
      if (["type", "componentType"].includes(key)) delete properties[key];
      else if (properties[key]) properties[key] = { ...properties[key], default: item.defaults[key] };
    }
    if (alias2.nodeKey) Object.assign(properties, { nodeId: { type: "string" }, uuid: { type: "string" }, path: { type: "string", description: "\u573A\u666F\u8282\u70B9\u8DEF\u5F84\uFF0C\u4E0E UUID \u4E8C\u9009\u4E00\u3002" }, name: { type: "string", description: "\u7CBE\u786E\u8282\u70B9\u540D\uFF1B\u5B58\u5728\u91CD\u540D\u65F6\u62D2\u7EDD\u3002" } });
    if (properties.componentType) properties.componentName = { type: "string", description: "\u7EC4\u4EF6\u7C7B\u540D\uFF0C\u4E0E componentType \u7B49\u4EF7\u3002" };
    if (item.target === "create_node") properties.parentPath = { type: "string", description: "\u7236\u8282\u70B9\u8DEF\u5F84\uFF0C\u4E0E parentId \u4E8C\u9009\u4E00\u3002" };
    const required = (item.required || (parent.inputSchema.required || []).filter((key) => key !== "action" && !(key in item.defaults))).filter((key) => key !== alias2.nodeKey);
    return {
      name: item.name,
      description: item.description,
      category: item.category,
      profile: "full",
      aliasFor: item.target,
      annotations: { readOnlyHint: item.readOnly, destructiveHint: !item.readOnly, idempotentHint: item.readOnly, openWorldHint: false },
      inputSchema: { type: "object", properties, required }
    };
  });
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

// src/tools/ToolValidation.ts
function validateToolCall(name, args, tools) {
  const tool = tools.find((tool2) => tool2.name === name);
  if (!tool) throw new Error(`\u672A\u77E5\u5DE5\u5177: ${name}`);
  const descriptor = toolAlias(name);
  const validationArgs = descriptor && args.componentName && !args.componentType ? { ...args, componentType: args.componentName } : args;
  validate(validationArgs, tool.inputSchema, name);
  validateConditional(name, args);
  const alias2 = resolveToolAlias(name, args);
  if (alias2.name !== name && !(descriptor.nodeKey && !alias2.args[descriptor.nodeKey] && (args.path || args.name))) validateConditional(alias2.name, alias2.args);
}
function validateExposedCall(name, args, tools) {
  var _a, _b;
  validateToolCall(name, args, tools);
  if (name !== "batch_execute") return;
  for (const operation of args.operations || []) {
    const tool = tools.find((item) => item.name === operation.tool);
    if (!tool) throw new Error("\u5F53\u524D\u5DE5\u5177\u96C6\u672A\u5F00\u653E: " + operation.tool);
    const choices = (_a = tool.inputSchema.properties.action) == null ? void 0 : _a.enum, action = (_b = operation.params) == null ? void 0 : _b.action;
    if (choices && typeof action === "string" && !choices.includes(action)) throw new Error("\u5F53\u524D\u5DE5\u5177\u96C6\u672A\u5F00\u653E\u64CD\u4F5C: " + operation.tool + "." + action);
  }
}

// src/core/ProjectContext.ts
var path = __toESM(require("path"));
var import_crypto = require("crypto");

// src/tools/SceneCapabilities.ts
var selector = { nodeId: { type: "string" }, uuid: { type: "string" }, path: { type: "string", description: "\u573A\u666F\u8282\u70B9\u5C42\u7EA7\u8DEF\u5F84\u3002" }, name: { type: "string", description: "\u7CBE\u786E\u540D\u79F0\uFF1B\u91CD\u540D\u65F6\u62D2\u7EDD\u5E76\u8981\u6C42 UUID \u6216\u8DEF\u5F84\u3002" } };
var specs = [
  ["resolve_node", "scene", true, "\u5C06 UUID\u3001\u8DEF\u5F84\u6216\u7CBE\u786E\u540D\u79F0\u89E3\u6790\u4E3A\u552F\u4E00\u573A\u666F\u8282\u70B9\u3002"],
  ["get_scene_info", "scene", true, "\u8BFB\u53D6\u5F53\u524D\u7F16\u8F91\u573A\u666F\u4FE1\u606F\u3002"],
  ["inspect_node", "scene", true, "\u8BFB\u53D6\u8282\u70B9\u53D8\u6362\u3001\u7EC4\u4EF6\u4E0E\u7236\u5B50\u4FE1\u606F\u3002"],
  ["delete_node", "scene", false, "\u9500\u6BC1\u6307\u5B9A\u8282\u70B9\uFF0C\u7981\u6B62\u5220\u9664\u573A\u666F\u6839\u3002"],
  ["emit_node_event", "events", false, "\u5411\u8282\u70B9\u53D1\u9001\u81EA\u5B9A\u4E49\u4E8B\u4EF6\u53CA JSON \u6570\u636E\u3002", { eventName: { type: "string" }, payload: {} }, ["eventName"]],
  ["simulate_button_click", "events", false, "\u89E6\u53D1 cc.Button \u56DE\u8C03\u548C click \u4E8B\u4EF6\uFF1B\u4E0D\u8BC1\u660E\u771F\u5B9E\u9F20\u6807\u547D\u4E2D\u6216\u73A9\u6CD5\u63A5\u53D7\u3002"],
  ["invoke_component_method", "components", false, "\u8C03\u7528\u6307\u5B9A\u7EC4\u4EF6\u65B9\u6CD5\uFF0C\u652F\u6301\u5F02\u6B65\u7ED3\u679C\u3002", { componentName: { type: "string" }, componentType: { type: "string" }, methodName: { type: "string" }, args: { type: "array", maxItems: 100, items: {} } }, ["methodName"]],
  ["list_cameras", "camera", true, "\u5217\u51FA\u5F53\u524D\u7F16\u8F91\u573A\u666F\u7684 cc.Camera\u3002"],
  ["inspect_prefab_instance", "prefabs", true, "\u8BFB\u53D6\u8282\u70B9\u5173\u8054\u7684 2.4 \u9884\u5236\u4F53 UUID\u3001\u6839\u8282\u70B9\u548C\u6587\u4EF6\u6807\u8BC6\u3002"],
  ["get_runtime_state", "runtime", true, "\u8BFB\u53D6\u7F16\u8F91\u573A\u666F director \u72B6\u6001\uFF0C\u4E0D\u4EE3\u8868\u5916\u90E8\u6E38\u620F\u9884\u89C8\u72B6\u6001\u3002"],
  ["pause_runtime", "runtime", false, "\u6682\u505C\u5F53\u524D\u7F16\u8F91\u573A\u666F director\u3002"],
  ["resume_runtime", "runtime", false, "\u6062\u590D\u5F53\u524D\u7F16\u8F91\u573A\u666F director\u3002"],
  ["set_time_scale", "runtime", false, "\u8BBE\u7F6E\u5F53\u524D\u7F16\u8F91\u573A\u666F scheduler \u65F6\u95F4\u500D\u7387\u3002", { timeScale: { type: "number", minimum: 0, maximum: 100 } }, ["timeScale"]],
  ["get_performance_snapshot", "diagnostics", true, "\u8BFB\u53D6\u7F16\u8F91\u573A\u666F\u8282\u70B9\u3001\u7EC4\u4EF6\u3001\u6DF1\u5EA6\u4E0E UI \u6570\u91CF\u3002"],
  ["add_animation_clip", "animation", false, "\u5C06\u8D44\u6E90 UUID \u5BF9\u5E94\u7684 AnimationClip \u52A0\u5165\u8282\u70B9 Animation \u7EC4\u4EF6\u3002", { clipUuid: { type: "string" }, clipName: { type: "string" } }, ["clipUuid"]]
];
function sceneCapabilityDefinitions() {
  return specs.map(([name, category, readOnly, description, extra = {}, required = []]) => ({
    name,
    category,
    profile: readOnly ? "core" : "full",
    description,
    annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, idempotentHint: readOnly, openWorldHint: false },
    inputSchema: { type: "object", properties: { ...selector, ...extra }, required }
  }));
}
function sceneCapabilityReadOnly(name) {
  var _a;
  return (_a = specs.find((item) => item[0] === name)) == null ? void 0 : _a[2];
}

// src/utils/SerializedValidation.ts
function validateSerializedAsset(data) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
  const errors = [];
  let errorCount = 0, visited = 0;
  const fail = (text) => {
    errorCount++;
    if (errors.length < 50) errors.push(text);
  };
  if (!Array.isArray(data) || !["cc.Prefab", "cc.SceneAsset"].includes((_a = data[0]) == null ? void 0 : _a.__type__)) {
    return { ok: false, complete: true, errors: ["\u4E0D\u662F 2.4 Prefab/SceneAsset \u5BF9\u8C61\u8868"], errorCount: 1 };
  }
  const object = (ref, label) => {
    if (!ref || !Number.isInteger(ref.__id__) || ref.__id__ < 0 || !data[ref.__id__]) {
      fail(`${label}: \u65E0\u6548 __id__`);
      return null;
    }
    return data[ref.__id__];
  };
  const rootRef = data[0].__type__ === "cc.Prefab" ? data[0].data : data[0].scene;
  const root = object(rootRef, "\u8D44\u6E90\u6839");
  if (root && root.__type__ !== (data[0].__type__ === "cc.Prefab" ? "cc.Node" : "cc.Scene")) fail("\u8D44\u6E90\u6839\u7C7B\u578B\u9519\u8BEF");
  if (root == null ? void 0 : root._parent) fail("\u8D44\u6E90\u6839\u8282\u70B9\u4ECD\u6709\u7236\u8282\u70B9");
  const scan = (value, location, depth) => {
    if (++visited > 2e5 || depth > 128) throw new Error("\u6821\u9A8C\u8D85\u51FA\u5BF9\u8C61/\u6DF1\u5EA6\u9884\u7B97");
    if (!value || typeof value !== "object") return;
    if (Object.prototype.hasOwnProperty.call(value, "__id__")) object(value, location);
    for (const key of Object.keys(value)) scan(value[key], `${location}.${key}`, depth + 1);
  };
  try {
    scan(data, "$", 0);
  } catch (err) {
    fail(err.message);
    return { ok: false, complete: false, errors, errorCount };
  }
  const ids = /* @__PURE__ */ new Set();
  for (let i = 0; i < data.length; i++) {
    const node = data[i];
    if (!["cc.Node", "cc.Scene"].includes(node == null ? void 0 : node.__type__)) continue;
    for (const key of ["_children", "_components"]) if (node[key] !== void 0 && !Array.isArray(node[key])) fail(`${i}.${key}: \u9700\u8981\u6570\u7EC4`);
    const children = Array.isArray(node._children) ? node._children : [];
    const seen = /* @__PURE__ */ new Set();
    for (const ref of children) {
      const child = object(ref, `${i}._children`);
      if (seen.has(ref == null ? void 0 : ref.__id__)) fail(`${i}: \u5B50\u8282\u70B9\u91CD\u590D`);
      seen.add(ref == null ? void 0 : ref.__id__);
      if (child && (child.__type__ !== "cc.Node" || ((_b = child._parent) == null ? void 0 : _b.__id__) !== i)) fail(`${i}: \u5B50\u8282\u70B9\u7C7B\u578B\u6216\u7236\u5B50\u5F15\u7528\u4E0D\u4E00\u81F4`);
    }
    if (node !== root && node._parent) {
      const parent = object(node._parent, `${i}._parent`);
      if (parent && !((_c = parent._children) == null ? void 0 : _c.some((ref) => ref.__id__ === i))) fail(`${i}: \u7236\u8282\u70B9\u672A\u5F15\u7528\u8BE5\u8282\u70B9`);
    }
    for (const ref of Array.isArray(node._components) ? node._components : []) {
      const component = object(ref, `${i}._components`);
      if (component && ((_d = component.node) == null ? void 0 : _d.__id__) !== i) fail(`${i}: \u7EC4\u4EF6 node \u5F15\u7528\u4E0D\u4E00\u81F4`);
    }
    if (node._prefab) {
      const info = object(node._prefab, `${i}._prefab`);
      if (info && info.__type__ !== "cc.PrefabInfo") fail(`${i}: \u9884\u5236\u4F53\u5173\u8054\u7C7B\u578B\u9519\u8BEF`);
      if (info && ((_e = object(info.root, `${i}.PrefabInfo.root`)) == null ? void 0 : _e.__type__) !== "cc.Node") fail(`${i}: PrefabInfo.root \u7C7B\u578B\u9519\u8BEF`);
      if ((info == null ? void 0 : info.asset) && Object.prototype.hasOwnProperty.call(info.asset, "__id__") && ((_f = object(info.asset, `${i}.PrefabInfo.asset`)) == null ? void 0 : _f.__type__) !== "cc.Prefab") fail(`${i}: PrefabInfo.asset \u7C7B\u578B\u9519\u8BEF`);
      if (data[0].__type__ === "cc.Prefab" && ((_g = info == null ? void 0 : info.asset) == null ? void 0 : _g.__id__) === 0 && ((_h = info.root) == null ? void 0 : _h.__id__) !== (rootRef == null ? void 0 : rootRef.__id__)) fail(`${i}: \u672C\u8D44\u6E90 PrefabInfo.root \u6307\u5411\u9519\u8BEF`);
      if (info == null ? void 0 : info.fileId) {
        const key = JSON.stringify([info.root, info.asset, info.fileId]);
        if (ids.has(key)) fail(`${i}: \u91CD\u590D Prefab fileId`);
        ids.add(key);
      }
    }
  }
  if (root) {
    const pending = [rootRef.__id__], reached = /* @__PURE__ */ new Set();
    while (pending.length) {
      const id = pending.pop();
      if (reached.has(id)) {
        fail(`\u5C42\u7EA7\u5FAA\u73AF\u6216\u91CD\u590D\u8282\u70B9: ${id}`);
        continue;
      }
      reached.add(id);
      const children = (_i = data[id]) == null ? void 0 : _i._children;
      if (Array.isArray(children)) {
        for (const ref of children) if (Number.isInteger(ref == null ? void 0 : ref.__id__) && ((_j = data[ref.__id__]) == null ? void 0 : _j.__type__) === "cc.Node") pending.push(ref.__id__);
      }
    }
    data.forEach((item, id) => {
      if ((item == null ? void 0 : item.__type__) === "cc.Node" && !reached.has(id)) fail(`\u8282\u70B9\u4E0D\u5C5E\u4E8E\u8D44\u6E90\u6839: ${id}`);
    });
  }
  return { ok: errorCount === 0, complete: true, errors, errorCount, objectCount: data.length, scope: "serialized-structure" };
}
function assertSerializedAsset(data) {
  const result = validateSerializedAsset(data);
  if (!result.ok) throw new Error("\u5E8F\u5217\u5316\u7ED3\u6784\u6821\u9A8C\u5931\u8D25: " + result.errors.join("; "));
  return result;
}

// src/tools/EditorCapabilities.ts
var specs2 = [
  ["get_tool_catalog", "project", true, "\u5217\u51FA\u5168\u90E8\u5DE5\u5177\u7684\u5206\u7C7B\u3001\u9884\u8BBE\u5C42\u7EA7\u3001\u5F00\u653E\u72B6\u6001\u548C\u53EF\u7528\u64CD\u4F5C\u3002"],
  ["get_editor_state", "project", true, "\u8BFB\u53D6\u5DE5\u7A0B\u8EAB\u4EFD\u3001\u7F16\u8F91\u5668\u961F\u5217\u4E0E\u9009\u62E9\u72B6\u6001\u3002"],
  ["list_editor_windows", "project", true, "\u5217\u51FA\u672C Creator \u8FDB\u7A0B\u7684 Electron \u7A97\u53E3\u3002"],
  ["list_assets", "assets", true, "\u67E5\u8BE2 AssetDB \u8D44\u6E90\uFF0C\u6700\u591A\u8FD4\u56DE500\u6761\u3002", { pattern: { type: "string" }, type: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 500 } }],
  ["list_scenes", "assets", true, "\u5217\u51FA\u5DE5\u7A0B\u4E2D\u7684 Creator 2.4 .fire \u573A\u666F\u3002"],
  ["list_prefabs", "prefabs", true, "\u5217\u51FA\u5DE5\u7A0B\u4E2D\u7684\u9884\u5236\u4F53\u8D44\u6E90\u3002"],
  ["duplicate_prefab", "prefabs", false, "\u590D\u5236\u9884\u5236\u4F53\u5185\u5BB9\uFF0C\u7531 AssetDB \u751F\u6210\u65B0 UUID\uFF0C\u4E0D\u590D\u5236 meta\u3002", { path: { type: "string" }, targetPath: { type: "string" } }, ["path", "targetPath"]]
];
function editorCapabilityDefinitions() {
  return specs2.map(([name, category, readOnly, description, properties = {}, required = []]) => ({
    name,
    category,
    profile: readOnly ? "core" : "full",
    description,
    annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, idempotentHint: readOnly, openWorldHint: false },
    inputSchema: { type: "object", properties, required }
  }));
}
function editorCapabilityReadOnly(name) {
  var _a;
  return (_a = specs2.find((item) => item[0] === name)) == null ? void 0 : _a[2];
}

// src/tools/ProjectFiles.ts
var fileSpecs = [
  ["read_file", true, "\u8BFB\u53D6\u5DE5\u7A0B\u5185 UTF-8 \u6587\u4EF6\uFF0C\u9ED8\u8BA4\u6700\u591A1MiB\u3002"],
  ["get_file_snippet", true, "\u8BFB\u53D6\u6307\u5B9A\u884C\u9644\u8FD1\u7684\u5DE5\u7A0B\u6587\u4EF6\u7247\u6BB5\u3002", { line: { type: "integer", minimum: 1 }, radius: { type: "integer", minimum: 0, maximum: 100 } }],
  ["write_file", false, "\u539F\u5B50\u5199\u5165\u5DE5\u7A0B\u5185\u6587\u672C\u6587\u4EF6\uFF1B\u573A\u666F\u3001\u9884\u5236\u4F53\u4E0E meta \u4F7F\u7528\u4E13\u7528\u5DE5\u5177\u3002", { content: { type: "string" }, overwrite: { type: "boolean" } }, ["path", "content"]],
  ["replace_in_file", false, "\u5BF9\u5DE5\u7A0B\u6587\u672C\u6587\u4EF6\u505A\u5B57\u9762\u91CF\u66FF\u6362\u5E76\u6821\u9A8C\u5339\u914D\u6B21\u6570\u3002", { search: { type: "string" }, replacement: { type: "string" }, expectedCount: { type: "integer", minimum: 1, maximum: 1e4 } }, ["path", "search", "replacement"]],
  ["list_directory", true, "\u5217\u51FA\u5DE5\u7A0B\u76EE\u5F55\u7684\u76F4\u63A5\u5B50\u9879\uFF0C\u6700\u591A500\u9879\u3002"],
  ["exists", true, "\u68C0\u67E5\u5DE5\u7A0B\u6587\u4EF6\u6216\u76EE\u5F55\u662F\u5426\u5B58\u5728\u3002"]
];
function projectFileDefinitions() {
  return fileSpecs.map(([name, readOnly, description, extra = {}, required = ["path"]]) => ({
    name,
    category: "files",
    profile: "full",
    description,
    annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, idempotentHint: readOnly, openWorldHint: false },
    inputSchema: { type: "object", properties: { path: { type: "string", description: "\u5DE5\u7A0B\u76F8\u5BF9\u8DEF\u5F84\u6216 db://assets \u8DEF\u5F84\u3002" }, ...extra }, required }
  }));
}
function projectFileReadOnly(name) {
  var _a;
  return (_a = fileSpecs.find((item) => item[0] === name)) == null ? void 0 : _a[1];
}

// src/core/ProjectContext.ts
var instanceId = (0, import_crypto.randomBytes)(16).toString("hex");
function normalizeProjectPath(value) {
  const resolved = path.resolve(value);
  return path.sep === "\\" ? resolved.toLowerCase() : resolved;
}
function projectIdentity(projectPath) {
  return (0, import_crypto.createHash)("sha256").update(normalizeProjectPath(projectPath)).digest("hex").slice(0, 24);
}
function mutatesProject(name, args = {}) {
  const alias2 = resolveToolAlias(name, args);
  if (alias2.name !== name) return mutatesProject(alias2.name, alias2.args);
  for (const readOnly of [sceneCapabilityReadOnly(name), editorCapabilityReadOnly(name), projectFileReadOnly(name)]) if (readOnly !== void 0) return !readOnly;
  if (["simulate_mouse_drag", "simulate_mouse_click"].includes(name)) return !["status", "cancel"].includes(args.action);
  if (name === "batch_execute") return !Array.isArray(args.operations) || args.operations.some((op) => mutatesProject(op.tool, op.params));
  if (name === "build_project") return args.action !== "status";
  if (name === "capture_editor_screenshot") return !!args.centerViewport;
  if (["get_selected_node", "get_scene_hierarchy", "find_gameobjects", "read_console", "validate_script", "run_script_diagnostics", "check_asset_ready", "validate_prefab", "search_project", "get_sha", "resolve_capture_coordinates", "inspect_asset_dependencies", "find_references", "get_project_info", "inspect_builder_targets"].includes(name)) return false;
  if (name === "button_events") return args.action !== "list";
  if (["manage_components", "manage_asset", "manage_script", "scene_management", "prefab_management", "manage_editor", "manage_animation", "manage_material", "manage_texture", "manage_shader", "manage_undo", "manage_vfx"].includes(name)) {
    return !["get", "read", "get_info", "get_list", "get_selection", "get_state"].includes(args.action);
  }
  return true;
}

// src/mcp-proxy.ts
var pathModule3 = __toESM(require("path"));
var fs6 = __toESM(require("fs"));
var readline = __toESM(require("readline"));

// src/utils/OfflinePrefabEditor.ts
var fs3 = __toESM(require("fs"));
var crypto2 = __toESM(require("crypto"));

// src/core/Logger.ts
var fs = __toESM(require("fs"));
var pathModule = __toESM(require("path"));

// src/utils/LogPreview.ts
function truncateLogText(text, limit = 4096) {
  if (text.length <= limit) return text;
  let end = limit;
  if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
  return text.slice(0, end) + `...[length:${text.length}]`;
}

// src/core/Logger.ts
var _Logger = class _Logger {
  static page(args) {
    var _a, _b;
    let after = 0;
    if (args.cursor) {
      const parts = args.cursor.split(":");
      if (parts[0] !== this.epoch || !/^\d+$/.test(parts[1])) throw new Error("\u65E5\u5FD7\u6E38\u6807\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u8BFB\u53D6");
      after = Number(parts[1]);
    }
    const first = ((_a = this.logBuffer[0]) == null ? void 0 : _a.sequence) || this.sequence + 1;
    const source = this.logBuffer.filter((item) => item.sequence > after && (!args.type || item.type === (args.type === "log" ? "info" : args.type)));
    const limit = (_b = args.limit) != null ? _b : 200;
    if (!Number.isInteger(limit) || limit < 1 || limit > 2e3) throw new Error("limit \u5FC5\u987B\u4E3A1\u20132000");
    const entries = source.slice(0, limit);
    const last = entries.length ? entries[entries.length - 1].sequence : this.sequence;
    return { entries, nextCursor: this.epoch + ":" + last, truncated: source.length > entries.length, lostEntries: after > 0 && after < first - 1 };
  }
  /** 异步串行批量写盘；显式 flush 用于卸载和验证。 */
  static async flush() {
    clearTimeout(_Logger.flushTimer);
    _Logger.flushTimer = null;
    if (_Logger.flushing) {
      await _Logger.flushing;
      if (_Logger.pendingLines.length) await _Logger.flush();
      return;
    }
    if (!_Logger.pendingLines.length) return;
    const lines = _Logger.pendingLines;
    _Logger.pendingLines = [];
    _Logger.pendingBytes = 0;
    const dropped = _Logger.droppedLines;
    _Logger.droppedLines = 0;
    let failed = false;
    _Logger.flushing = (async () => {
      try {
        const file = _Logger.getLogFilePath();
        if (!file) throw new Error("\u65E5\u5FD7\u8DEF\u5F84\u5C1A\u672A\u5C31\u7EEA");
        const text = (dropped ? `[warn] \u65E5\u5FD7\u79EF\u538B\uFF0C\u7701\u7565 ${dropped} \u6761\u6587\u4EF6\u65E5\u5FD7
` : "") + lines.join("");
        let bytes = 0;
        try {
          bytes = (await fs.promises.stat(file)).size;
        } catch (e) {
          if (e.code !== "ENOENT") throw e;
        }
        if (bytes && bytes + Buffer.byteLength(text) > _Logger.MAX_BYTES) {
          try {
            await fs.promises.unlink(file + ".old");
          } catch (e) {
            if (e.code !== "ENOENT") throw e;
          }
          await fs.promises.rename(file, file + ".old");
        }
        await fs.promises.appendFile(file, text, "utf8");
        _Logger.retries = 0;
      } catch (e) {
        failed = true;
        _Logger.pendingLines = lines.concat(_Logger.pendingLines);
        _Logger.pendingBytes += lines.reduce((sum, line) => sum + Buffer.byteLength(line), 0);
        _Logger.droppedLines += dropped;
        _Logger.limitPending();
        _Logger.remember({ time: _Logger.formatLocalTimeWithOffset(), type: "warn", content: `\u65E5\u5FD7\u6587\u4EF6\u5199\u5165\u5931\u8D25: ${truncateLogText(String(e.message || e), 200)}` });
        if (++_Logger.retries <= 3) {
          _Logger.flushTimer = setTimeout(() => {
            void _Logger.flush();
          }, 250);
          if (_Logger.flushTimer.unref) _Logger.flushTimer.unref();
        }
      }
    })();
    await _Logger.flushing;
    _Logger.flushing = null;
    if (!failed && _Logger.pendingLines.length) await _Logger.flush();
  }
  static limitPending() {
    while (_Logger.pendingBytes > 512 * 1024) {
      _Logger.pendingBytes -= Buffer.byteLength(_Logger.pendingLines.shift());
      _Logger.droppedLines++;
    }
  }
  static remember(entry) {
    entry = { ...entry, sequence: ++_Logger.sequence };
    _Logger.logBuffer.push(entry);
    _Logger.bufferBytes += Buffer.byteLength(entry.content) + 100;
    while (_Logger.logBuffer.length > 2e3 || _Logger.bufferBytes > _Logger.MAX_BYTES) {
      const removed = _Logger.logBuffer.shift();
      _Logger.bufferBytes -= Buffer.byteLength(removed.content) + 100;
    }
  }
  /**
   * 获取日志文件路径
   */
  static getLogFilePath() {
    if (_Logger._logFilePath) return _Logger._logFilePath;
    try {
      if (typeof Editor === "undefined" || !Editor || !Editor.assetdb) return null;
      const assetsPath = Editor.assetdb.urlToFspath("db://assets");
      if (assetsPath) {
        const projectRoot = pathModule.dirname(assetsPath);
        const settingsDir = pathModule.join(projectRoot, "settings");
        if (!fs.existsSync(settingsDir)) {
          fs.mkdirSync(settingsDir, { recursive: true });
        }
        _Logger._logFilePath = pathModule.join(settingsDir, "mcp-bridge.log");
        return _Logger._logFilePath;
      }
    } catch (e) {
    }
    return null;
  }
  /**
   * 格式化 Date 为本地时间 + 时区偏移量字符串
   * @param date 目标 Date 对象，默认为当前时间
   * @returns 格式如 "2026-07-24 10:59:07.123 +08:00"
   */
  static formatLocalTimeWithOffset(date = /* @__PURE__ */ new Date()) {
    const pad = (num, len = 2) => String(num).padStart(len, "0");
    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    const ms = pad(date.getMilliseconds(), 3);
    const offsetMinutes = date.getTimezoneOffset();
    const sign = offsetMinutes <= 0 ? "+" : "-";
    const absOffset = Math.abs(offsetMinutes);
    const offsetHours = pad(Math.floor(absOffset / 60));
    const offsetMins = pad(absOffset % 60);
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${ms} ${sign}${offsetHours}:${offsetMins}`;
  }
  /**
   * 记录日志并同步至面板和文件
   */
  static log(type, message) {
    message = truncateLogText(String(message));
    const logEntry = {
      time: _Logger.formatLocalTimeWithOffset(),
      type,
      content: message
    };
    _Logger.remember(logEntry);
    if (typeof Editor !== "undefined" && Editor && Editor.Ipc) {
      try {
        Editor.Ipc.sendToPanel("mcp-bridge", "mcp-bridge:on-log", logEntry);
      } catch (_e) {
      }
    }
    if (type === "error" && typeof Editor !== "undefined" && Editor) {
      try {
        Editor.error(`[MCP] ${message}`);
      } catch (_e) {
      }
    } else if (type === "warn" && typeof Editor !== "undefined" && Editor) {
      try {
        Editor.warn(`[MCP] ${message}`);
      } catch (_e) {
      }
    }
    const line = `[${logEntry.time}] [${type}] ${message}
`;
    _Logger.pendingLines.push(line);
    _Logger.pendingBytes += Buffer.byteLength(line);
    _Logger.limitPending();
    if (!_Logger.flushTimer) {
      _Logger.flushTimer = setTimeout(() => {
        void _Logger.flush();
      }, 100);
    }
  }
  static info(message) {
    _Logger.log("info", message);
  }
  static success(message) {
    _Logger.log("success", message);
  }
  static warn(message) {
    _Logger.log("warn", message);
  }
  static error(message) {
    _Logger.log("error", message);
  }
  static mcp(message) {
    _Logger.log("mcp", message);
  }
  static getLogContent() {
    return _Logger.logBuffer.map((entry) => `[${entry.time}] [${entry.type}] ${entry.content}`).join("\n");
  }
  static getLogs() {
    return _Logger.logBuffer;
  }
  static clearLogs() {
    _Logger.logBuffer = [];
    _Logger.bufferBytes = 0;
    _Logger.info("\u65E5\u5FD7\u5DF2\u6E05\u7406");
  }
};
_Logger.sequence = 0;
_Logger.epoch = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
_Logger.logBuffer = [];
_Logger._logFilePath = null;
_Logger.bufferBytes = 0;
_Logger.pendingLines = [];
_Logger.pendingBytes = 0;
_Logger.droppedLines = 0;
_Logger.flushing = null;
_Logger.retries = 0;
_Logger.MAX_BYTES = 2 * 1024 * 1024;
var Logger = _Logger;

// src/utils/OfflinePrefabEditor.ts
var path2 = __toESM(require("path"));

// src/core/CommandQueue.ts
var _CommandQueue = class _CommandQueue {
  static recordError(tool, error) {
    this.lastError = { tool, message: String(error.message || error), at: Date.now() };
  }
  static snapshot() {
    const now = Date.now();
    return {
      processing: this.isProcessingCommand,
      pending: this.pendingSceneCalls,
      blockedReason: this.blockedReason,
      waiting: this.commandQueue.length,
      oldestQueueAgeMs: this.commandQueue.length ? now - this.commandQueue[0].queuedAt : 0,
      current: this.current ? { ...this.current, executionMs: now - this.current.startedAt } : null,
      last: this.last,
      lastError: this.lastError
    };
  }
  static blockPending(reason) {
    var _a;
    _CommandQueue.blockedReason = reason;
    _CommandQueue.recordError(((_a = _CommandQueue.current) == null ? void 0 : _a.tool) || "pending", reason);
    const waiting = _CommandQueue.commandQueue.splice(0);
    waiting.forEach((item) => item.reject(new Error(reason + "\uFF1B\u7B49\u5F85\u4E2D\u7684\u6307\u4EE4\u672A\u6267\u884C")));
  }
  static getBlockedReason() {
    return _CommandQueue.blockedReason;
  }
  /** 跟踪没有 IPC 完成回执的编辑器操作，完成确认前不释放队列。 */
  static trackEditorOperation() {
    _CommandQueue.pendingSceneCalls++;
    let finished = false;
    return () => {
      if (finished) return;
      finished = true;
      _CommandQueue.pendingSceneCalls--;
      if (_CommandQueue.deferredDone) _CommandQueue.deferredDone();
    };
  }
  /**
   * 将一个异步操作加入队列，保证串行执行
   * @param {Function} fn 接受 done 回调的函数，fn(done) 中操作完成后必须调用 done()
   * @returns {Promise} 操作完成后 resolve
   */
  static enqueue(fn, onTimeout, tool = "unknown") {
    if (_CommandQueue.blockedReason) return Promise.reject(new Error(_CommandQueue.blockedReason));
    if (_CommandQueue.commandQueue.length >= _CommandQueue.MAX_QUEUE_LENGTH) {
      Logger.warn(`[CommandQueue] \u6307\u4EE4\u961F\u5217\u5DF2\u6EE1\uFF08${_CommandQueue.MAX_QUEUE_LENGTH}\uFF09\uFF0C\u62D2\u7EDD\u65B0\u8BF7\u6C42`);
      return Promise.reject("\u961F\u5217\u5DF2\u6EE1\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5");
    }
    return new Promise((resolve4, reject) => {
      _CommandQueue.commandQueue.push({ fn, resolve: resolve4, reject, onTimeout, tool, queuedAt: Date.now() });
      _CommandQueue.processNext();
    });
  }
  static processNext() {
    if (_CommandQueue.isProcessingCommand || _CommandQueue.commandQueue.length === 0) return;
    _CommandQueue.isProcessingCommand = true;
    const { fn, resolve: resolve4, onTimeout, tool, queuedAt } = _CommandQueue.commandQueue.shift();
    _CommandQueue.current = { tool, queuedAt, startedAt: Date.now(), queueWaitMs: Date.now() - queuedAt };
    let completed = false;
    const timeoutId = setTimeout(() => {
      _CommandQueue.blockPending("\u524D\u5E8F\u6307\u4EE4\u6267\u884C\u8D85\u65F6\u4E14\u5C1A\u672A\u7ED3\u675F\uFF0C\u8BF7\u7B49\u5F85\u5176\u5B8C\u6210\u6216\u91CD\u8F7D\u63D2\u4EF6");
      Logger.error("[CommandQueue] \u6307\u4EE4\u6267\u884C\u8D85\u65F6(60s)\uFF0C\u5DF2\u6682\u505C\u540E\u7EED\u6307\u4EE4");
      try {
        if (onTimeout) onTimeout();
      } finally {
        resolve4();
      }
    }, 6e4);
    const done = () => {
      if (completed) return;
      if (_CommandQueue.pendingSceneCalls > 0) {
        _CommandQueue.deferredDone = done;
        resolve4();
        return;
      }
      completed = true;
      _CommandQueue.last = { ..._CommandQueue.current, completedAt: Date.now() };
      _CommandQueue.current = null;
      clearTimeout(timeoutId);
      _CommandQueue.deferredDone = null;
      _CommandQueue.blockedReason = "";
      _CommandQueue.isProcessingCommand = false;
      resolve4();
      _CommandQueue.processNext();
    };
    try {
      fn(done);
    } catch (e) {
      clearTimeout(timeoutId);
      try {
        Logger.error(`[CommandQueue] \u6307\u4EE4\u6267\u884C\u5F02\u5E38: ${e && e.stack ? e.stack : e}`);
      } catch (_logErr) {
      }
      done();
    }
  }
  /**
   * 获取当前队列长度
   */
  static getLength() {
    return _CommandQueue.commandQueue.length;
  }
  /**
   * 带超时保护的 callSceneScript 包装
   */
  static callSceneScriptWithTimeout(pluginName, method, args, callback, timeout = 15e3) {
    let settled = false;
    let replied = false;
    _CommandQueue.pendingSceneCalls++;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        _CommandQueue.blockPending(`\u573A\u666F\u64CD\u4F5C\u8D85\u65F6\u4E14\u5C1A\u672A\u7ED3\u675F: ${method}\uFF0C\u8BF7\u7B49\u5F85\u5176\u5B8C\u6210\u6216\u91CD\u8F7D\u63D2\u4EF6`);
        Logger.error(`[\u8D85\u65F6] callSceneScript "${method}" \u8D85\u8FC7 ${timeout}ms \u672A\u54CD\u5E94`);
        callback(`\u64CD\u4F5C\u8D85\u65F6: ${method} (${timeout}ms)`);
      }
    }, timeout);
    const wrappedCallback = (err, result) => {
      if (replied) return;
      replied = true;
      _CommandQueue.pendingSceneCalls--;
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        if (err && typeof err === "object" && err.message && err.message.includes("panel not found")) {
          const friendlyMsg = `\u573A\u666F\u9762\u677F\u5C1A\u672A\u5C31\u7EEA\uFF08\u53EF\u80FD\u6B63\u5728\u91CD\u8F7D\u63D2\u4EF6\u6216\u5207\u6362\u573A\u666F\uFF09\uFF0C\u8BF7\u7B49\u5F85\u51E0\u79D2\u540E\u91CD\u8BD5\u3002\u539F\u59CB\u4FE1\u606F: ${err.message}`;
          Logger.warn(`[scene-script] ${friendlyMsg}`);
          callback(friendlyMsg);
        } else if (err && typeof err === "string" && err.includes("panel not found")) {
          const friendlyMsg = `\u573A\u666F\u9762\u677F\u5C1A\u672A\u5C31\u7EEA\uFF08\u53EF\u80FD\u6B63\u5728\u91CD\u8F7D\u63D2\u4EF6\u6216\u5207\u6362\u573A\u666F\uFF09\uFF0C\u8BF7\u7B49\u5F85\u51E0\u79D2\u540E\u91CD\u8BD5\u3002\u539F\u59CB\u4FE1\u606F: ${err}`;
          Logger.warn(`[scene-script] ${friendlyMsg}`);
          callback(friendlyMsg);
        } else {
          callback(err, result);
        }
      } else if (_CommandQueue.deferredDone) {
        _CommandQueue.deferredDone();
      }
    };
    try {
      if (args === null || args === void 0) {
        Editor.Scene.callSceneScript(pluginName, method, wrappedCallback);
      } else {
        Editor.Scene.callSceneScript(pluginName, method, args, wrappedCallback);
      }
    } catch (err) {
      wrappedCallback(err, null);
    }
  }
};
_CommandQueue.current = null;
_CommandQueue.last = null;
_CommandQueue.lastError = null;
_CommandQueue.MAX_QUEUE_LENGTH = 100;
_CommandQueue.commandQueue = [];
_CommandQueue.isProcessingCommand = false;
_CommandQueue.blockedReason = "";
_CommandQueue.pendingSceneCalls = 0;
_CommandQueue.deferredDone = null;
var CommandQueue = _CommandQueue;

// src/utils/AssetPatcher.ts
var fs2 = __toESM(require("fs"));
var os = __toESM(require("os"));
var pathMod = __toESM(require("path"));
var crypto = __toESM(require("crypto"));
var AssetPatcher = class _AssetPatcher {
  /** 内存修复与文件入口共用；已有 fileId 不重新生成。 */
  static fixPrefabRootFileIdData(data) {
    var _a, _b;
    const entry = data[0];
    if ((entry == null ? void 0 : entry.__type__) !== "cc.Prefab") return false;
    const root = data[(_a = entry.data) == null ? void 0 : _a.__id__];
    const info = root && data[(_b = root._prefab) == null ? void 0 : _b.__id__];
    if ((info == null ? void 0 : info.__type__) !== "cc.PrefabInfo" || info.fileId) return false;
    info.fileId = _AssetPatcher.generateFileId();
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
      if (!fs2.existsSync(prefabFspath)) {
        Logger.warn(`[fixPrefabRootFileId] \u9884\u5236\u4F53\u6587\u4EF6\u4E0D\u5B58\u5728: ${prefabFspath}`);
        return false;
      }
      const content = fs2.readFileSync(prefabFspath, "utf8");
      const data = JSON.parse(content);
      if (!Array.isArray(data) || data.length === 0) {
        Logger.warn(`[fixPrefabRootFileId] \u9884\u5236\u4F53\u5185\u5BB9\u683C\u5F0F\u5F02\u5E38`);
        return false;
      }
      const prefabEntry = data[0];
      if (!prefabEntry || prefabEntry.__type__ !== "cc.Prefab" || !prefabEntry.data) {
        Logger.warn(`[fixPrefabRootFileId] \u627E\u4E0D\u5230 cc.Prefab \u5165\u53E3`);
        return false;
      }
      const rootNodeIndex = prefabEntry.data.__id__;
      const rootNode = data[rootNodeIndex];
      if (!rootNode || !rootNode._prefab) {
        Logger.warn(`[fixPrefabRootFileId] \u6839\u8282\u70B9\u6CA1\u6709 _prefab \u5F15\u7528`);
        return false;
      }
      const prefabInfoIndex = rootNode._prefab.__id__;
      const prefabInfo = data[prefabInfoIndex];
      if (!prefabInfo || prefabInfo.__type__ !== "cc.PrefabInfo") {
        Logger.warn(`[fixPrefabRootFileId] \u6839\u8282\u70B9 _prefab \u6307\u5411\u7684\u4E0D\u662F cc.PrefabInfo`);
        return false;
      }
      if (_AssetPatcher.fixPrefabRootFileIdData(data)) {
        fs2.writeFileSync(prefabFspath, JSON.stringify(data, null, 2), "utf8");
        Logger.success(`[fixPrefabRootFileId] \u5DF2\u4FEE\u590D\u6839\u8282\u70B9 fileId: ${prefabInfo.fileId}`);
        return true;
      }
      return false;
    } catch (e) {
      Logger.error(`[fixPrefabRootFileId] \u4FEE\u590D\u5931\u8D25: ${e.message}`);
      return false;
    }
  }
  /**
   * 安全创建资源 (V8 完美原子级联方案)
   */
  static safeCreateAsset(path4, content, originalCallback, postCreateModifier = null) {
    try {
      validateAssetUrl(path4);
    } catch (err) {
      originalCallback(err);
      return;
    }
    const fileName = path4.substring(path4.lastIndexOf("/") + 1);
    let currentUrl = path4.substring(0, path4.lastIndexOf("/"));
    let missingDirs = [];
    while (currentUrl !== "db://assets" && currentUrl !== "db://internal" && currentUrl !== "db://") {
      if (Editor.assetdb.exists(currentUrl)) {
        break;
      }
      missingDirs.unshift(currentUrl.substring(currentUrl.lastIndexOf("/") + 1));
      currentUrl = currentUrl.substring(0, currentUrl.lastIndexOf("/"));
    }
    if (!Editor.assetdb.exists(currentUrl)) {
      return originalCallback(`\u81F4\u547D\u9519\u8BEF\uFF1A\u6700\u7EC8\u56DE\u9000\u7684\u6839\u76EE\u5F55\u90FD\u4E0D\u5B58\u5728\uFF1A ${currentUrl}`);
    }
    const tempBase = pathMod.join(os.tmpdir(), "mcp_v8_" + crypto.randomBytes(12).toString("hex"));
    let deepTempPath = tempBase;
    for (let i = 0; i < missingDirs.length; i++) {
      deepTempPath = pathMod.join(deepTempPath, missingDirs[i]);
    }
    try {
      fs2.mkdirSync(deepTempPath, { recursive: true });
      const fileTempPath = pathMod.join(deepTempPath, fileName);
      fs2.writeFileSync(fileTempPath, content);
    } catch (e) {
      try {
        fs2.rmdirSync(tempBase, { recursive: true });
      } catch (_) {
      }
      return originalCallback(`\u5728\u4E34\u65F6\u9694\u79BB\u533A\u5199\u5165\u6587\u4EF6\u5931\u8D25: ${e.message}`);
    }
    const topImportTarget = missingDirs.length > 0 ? pathMod.join(tempBase, missingDirs[0]) : pathMod.join(tempBase, fileName);
    const release = CommandQueue.trackEditorOperation();
    let finished = false, reported = false, imported = false;
    const deadline = setTimeout(() => {
      if (finished) return;
      reported = true;
      CommandQueue.blockPending(`\u8D44\u6E90\u5BFC\u5165\u5C1A\u672A\u786E\u8BA4: ${path4}\uFF0C\u7981\u6B62\u76F4\u63A5\u91CD\u8BD5`);
      originalCallback(`\u8D44\u6E90\u5BFC\u5165\u8D85\u65F6\uFF0C\u7ED3\u679C\u672A\u77E5\uFF0C\u540E\u7EED\u64CD\u4F5C\u5DF2\u6682\u505C: ${path4}`);
    }, 3e4);
    const doneCreate = (err, msg) => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      try {
        fs2.rmdirSync(tempBase, { recursive: true });
      } catch (e) {
      }
      try {
        if (!reported) originalCallback(err || null, msg);
      } finally {
        release();
      }
    };
    try {
      Editor.assetdb.import([topImportTarget], currentUrl, (impErr, results) => {
        if (imported || finished) return;
        imported = true;
        if (impErr) return doneCreate(`\u539F\u751F\u5BFC\u5165\u64CD\u4F5C\u5931\u8D25: ${impErr.message || impErr}`);
        if (postCreateModifier) {
          try {
            postCreateModifier(doneCreate);
          } catch (err) {
            doneCreate(err);
          }
        } else {
          doneCreate(null, `\u8D44\u6E90\u5DF2\u5B89\u5168\u539F\u751F\u5BFC\u5165: ${path4}`);
        }
      });
    } catch (err) {
      doneCreate(err);
    }
  }
};

// src/utils/OfflinePrefabEditor.ts
var OfflinePrefabEditor = class {
  /**
   * 生成 22 位 Base64 URL-safe 随机字符串，用作预制体 fileId
   */
  static generateFileId() {
    return crypto2.randomBytes(16).toString("base64").replace(/\+/g, "/").replace(/=/g, "").substring(0, 22);
  }
  /**
   * 判断平铺 JSON 数组是否为场景文件格式（而非预制体）
   * @param data 平铺 of JSON 数组
   * @returns 如果首元素为 cc.SceneAsset 则返回 true
   */
  static isSceneData(data) {
    return data[0] && data[0].__type__ === "cc.SceneAsset";
  }
  /**
   * 离线修改预制体主入口
   * @param prefabFsPath 预制体文件的绝对物理路径
   * @param operations 待执行的操作列表
   * @returns 返回操作结果及可能出现的错误
   */
  static modify(prefabFsPath, operations, createMode) {
    let tempPath;
    const createdDirs = [];
    try {
      if (!Array.isArray(operations) || operations.length > 1e3) throw new Error("operations \u5FC5\u987B\u4E3A\u6700\u591A1000\u9879\u6570\u7EC4");
      const existed = fs3.existsSync(prefabFsPath);
      if (existed && fs3.statSync(prefabFsPath).size > 32 * 1024 * 1024) throw new Error("\u79BB\u7EBF\u8D44\u6E90\u8D85\u8FC732MiB\u4E0A\u9650\uFF0C\u8BF7\u62C6\u5206\u5904\u7406");
      const content = existed ? fs3.readFileSync(prefabFsPath, "utf8") : null;
      const first = operations[0];
      if (!existed && (!createMode || (first == null ? void 0 : first.action) !== "add_node" || first.targetPath && first.targetPath !== "/")) {
        throw new Error("\u6587\u4EF6\u4E0D\u5B58\u5728\uFF0C\u4E14\u4E0D\u6EE1\u8DB3\u81EA\u52A8\u65B0\u5EFA\u6761\u4EF6\uFF08\u9996\u9879\u9700\u4E3A add_node \u4E14 targetPath \u4E3A\u7A7A/\u6839\uFF09");
      }
      const data = existed ? JSON.parse(content) : this.makeEmptyData(createMode, first.nodeName);
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("\u683C\u5F0F\u9519\u8BEF\u7684\u8D44\u6E90 JSON \u6587\u4EF6\uFF0C\u671F\u5F85\u5E73\u94FA\u6570\u7EC4");
      }
      const pending = !existed && createMode === "prefab-root" ? operations.slice(1) : operations;
      for (const op of pending) {
        this.applyOperation(data, op);
      }
      AssetPatcher.fixPrefabRootFileIdData(data);
      const validation = assertSerializedAsset(data);
      const output = JSON.stringify(data, null, 2);
      if (Buffer.byteLength(output) > 32 * 1024 * 1024) throw new Error("\u4FEE\u6539\u7ED3\u679C\u8D85\u8FC732MiB\u4E0A\u9650\uFF0C\u672A\u63D0\u4EA4");
      let parent = path2.dirname(prefabFsPath);
      const missing = [];
      while (!fs3.existsSync(parent)) {
        missing.unshift(parent);
        parent = path2.dirname(parent);
      }
      for (const dir of missing) {
        fs3.mkdirSync(dir);
        createdDirs.push(dir);
      }
      tempPath = path2.join(path2.dirname(prefabFsPath), ".mcp-" + path2.basename(prefabFsPath) + "-" + crypto2.randomBytes(8).toString("hex") + ".tmp");
      fs3.writeFileSync(tempPath, output, { encoding: "utf8", flag: "wx" });
      if (existed) {
        if (fs3.readFileSync(prefabFsPath, "utf8") !== content) throw new Error("\u63D0\u4EA4\u524D\u8D44\u6E90\u5DF2\u88AB\u5916\u90E8\u4FEE\u6539\uFF0C\u672A\u8986\u76D6\u76EE\u6807");
        fs3.renameSync(tempPath, prefabFsPath);
      } else {
        fs3.linkSync(tempPath, prefabFsPath);
      }
      return { success: true, validation };
    } catch (e) {
      Logger.error(`[OfflineEditor] \u4FEE\u6539\u672A\u63D0\u4EA4: ${e.message}`);
      return { success: false, error: e.message };
    } finally {
      try {
        if (tempPath && fs3.existsSync(tempPath)) fs3.unlinkSync(tempPath);
      } catch (e) {
        Logger.warn(`[OfflineEditor] \u4E34\u65F6\u6587\u4EF6\u6E05\u7406\u5931\u8D25: ${tempPath}: ${e.message}`);
      }
      for (const dir of createdDirs.reverse()) {
        try {
          fs3.rmdirSync(dir);
        } catch (_) {
        }
      }
    }
  }
  static makeEmptyData(mode, nodeName) {
    const scene = mode === "scene";
    const root = {
      __type__: scene ? "cc.Scene" : "cc.Node",
      _name: scene ? "" : mode === "prefab-root" ? nodeName || "NewPrefab" : "Root",
      _objFlags: 0,
      _parent: null,
      _children: [],
      _components: [],
      _active: true,
      _prefab: scene ? null : { __id__: 2 },
      _opacity: 255,
      _color: { __type__: "cc.Color", r: 255, g: 255, b: 255, a: 255 },
      _contentSize: { __type__: "cc.Size", width: scene ? 0 : 100, height: scene ? 0 : 100 },
      _anchorPoint: { __type__: "cc.Vec2", x: scene ? 0 : 0.5, y: scene ? 0 : 0.5 },
      _trs: { __type__: "TypedArray", ctor: "Float64Array", array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
      _is3DNode: scene,
      _groupIndex: 0,
      groupIndex: 0,
      _id: ""
    };
    if (scene) {
      root.autoReleaseAssets = false;
      return [{ __type__: "cc.SceneAsset", _name: "", _objFlags: 0, _native: "", scene: { __id__: 1 } }, root];
    }
    Object.assign(root, { _eulerAngles: { __type__: "cc.Vec3", x: 0, y: 0, z: 0 }, _skewX: 0, _skewY: 0 });
    const entry = { __type__: "cc.Prefab", _name: "", _objFlags: 0, _native: "", data: { __id__: 1 } };
    if (mode === "prefab-root") Object.assign(entry, { optimizationPolicy: 0, asyncLoadAssets: false, readonly: false });
    return [entry, root, { __type__: "cc.PrefabInfo", root: { __id__: 1 }, asset: { __id__: 0 }, fileId: this.generateFileId(), sync: false }];
  }
  static isUuid(str) {
    const s = /^[0-9a-fA-F-]{36}$/;
    const o = /^[0-9a-fA-F]{32}$/;
    const u = /^[0-9a-zA-Z+/]{22,23}$/;
    return s.test(str) || o.test(str) || u.test(str);
  }
  static compressUuid(uuid) {
    const s = /^[0-9a-fA-F-]{36}$/;
    const o = /^[0-9a-fA-F]{32}$/;
    let cleanUuid = uuid;
    if (s.test(uuid)) {
      cleanUuid = uuid.replace(/-/g, "");
    } else if (!o.test(uuid)) {
      return uuid;
    }
    const r = 5;
    const prefix = cleanUuid.slice(0, r);
    const chars = [];
    let i = r;
    while (i < cleanUuid.length) {
      const left = this.HexMap[cleanUuid[i]];
      const mid = this.HexMap[cleanUuid[i + 1]];
      const right = this.HexMap[cleanUuid[i + 2]];
      chars.push(this.BASE64_KEYS[left << 2 | mid >> 2]);
      chars.push(this.BASE64_KEYS[(mid & 3) << 4 | right]);
      i += 3;
    }
    return prefix + chars.join("");
  }
  /**
   * 解析嵌套属性路径，支持数组索引语法 "clickEvents[0].target"。
   * 当路径中存在数组访问且元素不存在时，可根据 elementType 自动创建。
   * @returns { target: 最终属性所在的对象, prop: 最终属性名 }
   */
  static resolveNestedProperty(targetObj, propertyName, data, elementType) {
    const arrayMatch = propertyName.match(/^(\w+)\[(\d+)\]\.(.+)$/);
    if (!arrayMatch) {
      return { target: targetObj, prop: propertyName };
    }
    const [, arrayField, indexStr, subField] = arrayMatch;
    const index = parseInt(indexStr, 10);
    let arr = targetObj[arrayField];
    if (arr === void 0 || arr === null) {
      arr = targetObj["_N$" + arrayField];
    }
    if (!Array.isArray(arr)) {
      if (!elementType) {
        throw new Error(
          `\u5C5E\u6027 "${propertyName}" \u5BFB\u5740\u5931\u8D25\uFF1A\u7EC4\u4EF6\u4E0A\u4E0D\u5B58\u5728\u6570\u7EC4\u5C5E\u6027 "${arrayField}"\u3002\u8BF7\u63D0\u4F9B elementType \u53C2\u6570\u6765\u81EA\u52A8\u521B\u5EFA\u6570\u7EC4\u5143\u7D20\uFF08\u5982 "cc.ClickEvent"\uFF09\u3002`
        );
      }
      arr = [];
      targetObj[arrayField] = arr;
      targetObj["_N$" + arrayField] = arr;
    }
    let elementRef = arr[index];
    if (!elementRef || elementRef === null) {
      if (!elementType) {
        throw new Error(
          `\u5C5E\u6027 "${propertyName}" \u5BFB\u5740\u5931\u8D25\uFF1A\u6570\u7EC4 "${arrayField}" \u7D22\u5F15 ${index} \u4E0D\u5B58\u5728\u3002\u8BF7\u63D0\u4F9B elementType \u53C2\u6570\u6765\u81EA\u52A8\u521B\u5EFA\uFF08\u5982 "cc.ClickEvent"\uFF09\u3002`
        );
      }
      const newElement = { __type__: elementType };
      if (elementType === "cc.ClickEvent") {
        newElement.target = null;
        newElement.component = "";
        newElement.handler = "";
      }
      const newIdx = data.length;
      data.push(newElement);
      while (arr.length <= index) {
        arr.push(null);
      }
      arr[index] = { __id__: newIdx };
      elementRef = arr[index];
    }
    let element = elementRef;
    if (element && typeof element === "object" && element.__id__ !== void 0) {
      element = data[element.__id__];
    }
    return { target: element, prop: subField };
  }
  static liftObject(data, obj) {
    if (!obj || typeof obj !== "object") {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.liftObject(data, item));
    }
    if (obj.__type__ !== void 0) {
      const inlineTypes = ["cc.Vec2", "cc.Vec3", "cc.Vec4", "cc.Size", "cc.Rect", "cc.Color", "cc.Quat", "cc.Mat4", "TypedArray"];
      if (!inlineTypes.includes(obj.__type__)) {
        const newIdx = data.length;
        data.push(null);
        if (obj.__type__ === "cc.ClickEvent") {
          let scriptUuid = "";
          if (obj.target && obj.target.__id__ !== void 0) {
            const targetNode = data[obj.target.__id__];
            if (targetNode && targetNode._components) {
              for (const compRef of targetNode._components) {
                const comp = data[compRef.__id__];
                if (comp && comp.__type__) {
                  const rawType = comp.__type__;
                  if (this.isUuid(rawType)) {
                    scriptUuid = rawType;
                    break;
                  }
                }
              }
            }
          }
          if (scriptUuid) {
            obj._componentId = this.compressUuid(scriptUuid);
            obj.component = "";
          } else if (obj.component) {
            if (this.isUuid(obj.component)) {
              obj._componentId = this.compressUuid(obj.component);
              obj.component = "";
            }
          }
        }
        const processedObj = {};
        for (const [k, v] of Object.entries(obj)) {
          processedObj[k] = this.liftObject(data, v);
        }
        data[newIdx] = processedObj;
        return { __id__: newIdx };
      }
    }
    const result = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = this.liftObject(data, v);
    }
    return result;
  }
  /**
   * 根据相对路径检索节点对象在数组中的索引位置
   * @param data 平铺的 JSON 数组
   * @param path 相对根节点的检索路径，如 "RootNode/Body/Label"
   * @returns 目标节点在 data 数组中的索引值
   */
  static findNodeByPath(data, path4) {
    const rootEntry = data[0];
    if (!rootEntry) {
      throw new Error("\u683C\u5F0F\u9519\u8BEF\uFF1A\u6570\u7EC4\u9996\u4F4D\u672A\u627E\u5230\u6709\u6548\u58F0\u660E\u5165\u53E3");
    }
    let currentNodeIdx = -1;
    const isScene = this.isSceneData(data);
    if (rootEntry.__type__ === "cc.Prefab" && rootEntry.data) {
      currentNodeIdx = rootEntry.data.__id__;
    } else if (rootEntry.__type__ === "cc.SceneAsset" && rootEntry.scene) {
      currentNodeIdx = rootEntry.scene.__id__;
    } else {
      throw new Error(`\u4E0D\u652F\u6301\u7684\u79BB\u7EBF\u7F16\u8F91\u8D44\u6E90\u7C7B\u578B: ${rootEntry.__type__}`);
    }
    if (!path4 || path4 === "" || path4 === "/") {
      return currentNodeIdx;
    }
    let segments = path4.split("/").filter((s) => s !== "");
    const rootNode = data[currentNodeIdx];
    if (!isScene && rootNode && segments[0] === rootNode._name) {
      let hasSameNameChild = false;
      if (rootNode._children) {
        for (const childRef of rootNode._children) {
          const childNode = data[childRef.__id__];
          if (childNode && childNode._name === segments[0]) {
            hasSameNameChild = true;
            break;
          }
        }
      }
      if (!hasSameNameChild) {
        segments.shift();
      }
    }
    for (const segment of segments) {
      const node = data[currentNodeIdx];
      if (!node) {
        throw new Error(`\u5F15\u7528\u9519\u8BEF\uFF1A\u627E\u4E0D\u5230\u7D22\u5F15\u4E3A ${currentNodeIdx} \u7684\u8282\u70B9\u5BF9\u8C61`);
      }
      if (!node._children) {
        throw new Error(`\u8282\u70B9\u67E5\u627E\u5931\u8D25\uFF1A\u8282\u70B9 ${node._name || "Scene"} (\u7D22\u5F15 ${currentNodeIdx}) \u6CA1\u6709\u5B50\u8282\u70B9`);
      }
      let foundIdx = -1;
      for (const childRef of node._children) {
        const childNode = data[childRef.__id__];
        if (childNode && childNode._name === segment) {
          foundIdx = childRef.__id__;
          break;
        }
      }
      if (foundIdx === -1) {
        throw new Error(`\u68C0\u7D22\u8DEF\u5F84\u4E2D\u672A\u627E\u5230\u5339\u914D\u540D\u79F0\u4E3A "${segment}" \u7684\u5B50\u8282\u70B9`);
      }
      currentNodeIdx = foundIdx;
    }
    return currentNodeIdx;
  }
  /**
   * 单个操作的具体执行
   * @param data 平铺的 JSON 数组
   * @param op 声明式操作项
   */
  static applyOperation(data, op) {
    const nodeIdx = this.findNodeByPath(data, op.targetPath || "");
    const node = data[nodeIdx];
    if (!node) {
      throw new Error(`\u627E\u4E0D\u5230\u8DEF\u5F84\u4E3A "${op.targetPath}" \u7684\u76EE\u6807\u8282\u70B9`);
    }
    const propMap = {
      name: "_name",
      active: "_active",
      opacity: "_opacity",
      color: "_color",
      string: "_string",
      spriteFrame: "_spriteFrame",
      enabled: "_enabled"
    };
    if (op.action === "update_property") {
      if (op.componentType) {
        const compTypeToFind = this.isUuid(op.componentType) ? this.compressUuid(op.componentType) : op.componentType;
        let foundCompIdx = -1;
        const components = node._components || [];
        for (const compRef of components) {
          const comp = data[compRef.__id__];
          if (comp && comp.__type__ === compTypeToFind) {
            foundCompIdx = compRef.__id__;
            break;
          }
        }
        if (foundCompIdx === -1) {
          throw new Error(`\u8282\u70B9 "${op.targetPath}" \u4E0A\u672A\u6302\u8F7D\u7EC4\u4EF6: "${op.componentType}"`);
        }
        const component = data[foundCompIdx];
        for (const [key, val] of Object.entries(op.properties || {})) {
          const { target: propTarget, prop: resolvedProp } = this.resolveNestedProperty(
            component,
            key,
            data,
            op.elementType
          );
          const finalKey = propMap[resolvedProp] || resolvedProp;
          const lifted = this.liftObject(data, val);
          propTarget[finalKey] = lifted;
          if (!resolvedProp.startsWith("_N$") && !resolvedProp.startsWith("_")) {
            propTarget["_N$" + resolvedProp] = lifted;
          }
        }
      } else {
        for (const [key, val] of Object.entries(op.properties || {})) {
          const finalKey = propMap[key] || key;
          node[finalKey] = this.liftObject(data, val);
        }
      }
    } else if (op.action === "add_component") {
      if (!op.componentType) {
        throw new Error("\u65B0\u589E\u7EC4\u4EF6\u5931\u8D25\uFF1A\u7EC4\u4EF6\u7C7B\u578B componentType \u7F3A\u5931");
      }
      const compTypeToUse = this.isUuid(op.componentType) ? this.compressUuid(op.componentType) : op.componentType;
      const newCompIdx = data.length;
      const defaultProps = {};
      if (compTypeToUse === "cc.Label") {
        defaultProps._string = "Label";
        defaultProps._N$string = "Label";
      } else if (compTypeToUse === "cc.Sprite") {
        defaultProps._spriteFrame = null;
      }
      const newComp = {
        __type__: compTypeToUse,
        _name: "",
        _objFlags: 0,
        node: { __id__: nodeIdx },
        _enabled: true,
        ...defaultProps
      };
      for (const [key, val] of Object.entries(op.properties || {})) {
        const finalKey = propMap[key] || key;
        const lifted = this.liftObject(data, val);
        newComp[finalKey] = lifted;
        if (!key.startsWith("_N$") && !key.startsWith("_")) {
          newComp["_N$" + key] = lifted;
        }
      }
      data.push(newComp);
      if (!node._components) {
        node._components = [];
      }
      node._components.push({ __id__: newCompIdx });
    } else if (op.action === "remove_component") {
      if (!op.componentType) {
        throw new Error("\u79FB\u9664\u7EC4\u4EF6\u5931\u8D25\uFF1A\u7EC4\u4EF6\u7C7B\u578B componentType \u7F3A\u5931");
      }
      const compTypeToFind = this.isUuid(op.componentType) ? this.compressUuid(op.componentType) : op.componentType;
      let foundCompIdx = -1;
      const components = node._components || [];
      for (const compRef of components) {
        const comp = data[compRef.__id__];
        if (comp && comp.__type__ === compTypeToFind) {
          foundCompIdx = compRef.__id__;
          break;
        }
      }
      if (foundCompIdx === -1) {
        throw new Error(`\u8282\u70B9 "${op.targetPath}" \u4E0A\u672A\u6302\u8F7D\u7EC4\u4EF6: "${op.componentType}"\uFF0C\u65E0\u6CD5\u79FB\u9664`);
      }
      node._components = components.filter((ref) => ref.__id__ !== foundCompIdx);
      this.physicalEraseAndRealign(data, [foundCompIdx]);
    } else if (op.action === "add_node") {
      const isScene = this.isSceneData(data);
      const newNodeIdx = data.length;
      const newNode = {
        __type__: "cc.Node",
        _name: op.nodeName || "New Node",
        _objFlags: 0,
        _parent: { __id__: nodeIdx },
        _children: [],
        _components: [],
        _active: true,
        _prefab: null,
        _opacity: 255,
        _color: { __type__: "cc.Color", "r": 255, "g": 255, "b": 255, "a": 255 },
        _contentSize: { __type__: "cc.Size", "width": 100, "height": 100 },
        _anchorPoint: { __type__: "cc.Vec2", "x": 0.5, "y": 0.5 },
        _trs: {
          __type__: "TypedArray",
          ctor: "Float64Array",
          array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]
        },
        _eulerAngles: { __type__: "cc.Vec3", "x": 0, "y": 0, "z": 0 },
        _skewX: 0,
        _skewY: 0,
        _is3DNode: false,
        _groupIndex: 0,
        groupIndex: 0,
        _id: ""
      };
      data.push(newNode);
      if (!isScene) {
        const prefabInfoIdx = data.length;
        const newPrefabInfo = {
          __type__: "cc.PrefabInfo",
          root: { __id__: data[0].data.__id__ },
          asset: { __id__: 0 },
          fileId: this.generateFileId(),
          sync: false
        };
        data.push(newPrefabInfo);
        newNode._prefab = { __id__: prefabInfoIdx };
      }
      if (!node._children) {
        node._children = [];
      }
      node._children.push({ __id__: newNodeIdx });
    } else if (op.action === "remove_node") {
      if (node._parent) {
        const parentNode = data[node._parent.__id__];
        if (parentNode && parentNode._children) {
          parentNode._children = parentNode._children.filter(
            (ref) => ref.__id__ !== nodeIdx
          );
        }
      }
      const eraseList = [];
      const collectNodeAndDeps = (idx) => {
        const n = data[idx];
        if (!n) return;
        eraseList.push(idx);
        for (const compRef of n._components || []) {
          eraseList.push(compRef.__id__);
        }
        for (const childRef of n._children || []) {
          collectNodeAndDeps(childRef.__id__);
        }
        if (n._prefab) {
          eraseList.push(n._prefab.__id__);
        }
      };
      collectNodeAndDeps(nodeIdx);
      this.physicalEraseAndRealign(data, eraseList);
    } else if (op.action === "clone_node") {
      const destParentIdx = op.newParentPath ? this.findNodeByPath(data, op.newParentPath) : node._parent.__id__;
      const destParentNode = data[destParentIdx];
      if (!destParentNode) {
        throw new Error("\u514B\u9686\u5931\u8D25\uFF1A\u76EE\u6807\u6302\u8F7D\u7236\u8282\u70B9\u4E0D\u5B58\u5728");
      }
      const sourceSubtreeIndices = [];
      const collectSubtree = (idx) => {
        const n = data[idx];
        if (!n) return;
        sourceSubtreeIndices.push(idx);
        for (const compRef of n._components || []) {
          sourceSubtreeIndices.push(compRef.__id__);
        }
        if (n._prefab) {
          sourceSubtreeIndices.push(n._prefab.__id__);
        }
        for (const childRef of n._children || []) {
          collectSubtree(childRef.__id__);
        }
      };
      collectSubtree(nodeIdx);
      const indexMap = /* @__PURE__ */ new Map();
      const cloneStartOffset = data.length;
      sourceSubtreeIndices.forEach((oldIdx, i) => {
        indexMap.set(oldIdx, cloneStartOffset + i);
        data.push(JSON.parse(JSON.stringify(data[oldIdx])));
      });
      for (let i = cloneStartOffset; i < data.length; i++) {
        const obj = data[i];
        if (!obj) continue;
        if (obj.__type__ === "cc.Node") {
          obj._name = i === cloneStartOffset && op.nodeName ? op.nodeName : obj._name;
          if (i === cloneStartOffset) {
            obj._parent = { __id__: destParentIdx };
          } else if (obj._parent && indexMap.has(obj._parent.__id__)) {
            obj._parent = { __id__: indexMap.get(obj._parent.__id__) };
          }
          if (obj._prefab && indexMap.has(obj._prefab.__id__)) {
            obj._prefab = { __id__: indexMap.get(obj._prefab.__id__) };
          }
          if (obj._children) {
            obj._children = obj._children.map(
              (ref) => indexMap.has(ref.__id__) ? { __id__: indexMap.get(ref.__id__) } : ref
            );
          }
          if (obj._components) {
            obj._components = obj._components.map(
              (ref) => indexMap.has(ref.__id__) ? { __id__: indexMap.get(ref.__id__) } : ref
            );
          }
        } else if (obj.__type__ === "cc.PrefabInfo") {
          if (obj.root && indexMap.has(obj.root.__id__)) {
            obj.root = { __id__: indexMap.get(obj.root.__id__) };
          }
          obj.fileId = this.generateFileId();
        } else {
          if (obj.node && indexMap.has(obj.node.__id__)) {
            obj.node = { __id__: indexMap.get(obj.node.__id__) };
          }
          for (const [key, val] of Object.entries(obj)) {
            if (val && typeof val === "object" && val.__id__ !== void 0) {
              const oldTarget = val.__id__;
              if (indexMap.has(oldTarget)) {
                obj[key] = { __id__: indexMap.get(oldTarget) };
              }
            }
          }
        }
      }
      if (!destParentNode._children) {
        destParentNode._children = [];
      }
      destParentNode._children.push({ __id__: cloneStartOffset });
    } else if (op.action === "reorder_child") {
      if (!op.childOrder || op.childOrder.length === 0) {
        throw new Error("\u5B50\u8282\u70B9\u91CD\u65B0\u6392\u5E8F\u5931\u8D25\uFF1A\u5B50\u8282\u70B9\u6E32\u67D3\u5217\u8868 childOrder \u4E3A\u7A7A");
      }
      const parentChildren = node._children || [];
      const nameToIdxMap = /* @__PURE__ */ new Map();
      parentChildren.forEach((ref) => {
        const child = data[ref.__id__];
        if (child) {
          nameToIdxMap.set(child._name, ref.__id__);
        }
      });
      const newChildren = [];
      op.childOrder.forEach((name) => {
        if (nameToIdxMap.has(name)) {
          newChildren.push({ __id__: nameToIdxMap.get(name) });
          nameToIdxMap.delete(name);
        }
      });
      nameToIdxMap.forEach((id) => {
        newChildren.push({ __id__: id });
      });
      node._children = newChildren;
    } else if (op.action === "set_reference") {
      if (!op.propertyName || !op.referenceValue) {
        throw new Error("\u5F15\u7528\u5C5E\u6027\u7ED1\u5B9A\u5931\u8D25\uFF1A\u5C5E\u6027\u540D\u79F0 propertyName \u6216\u76EE\u6807\u5F15\u7528 referenceValue \u4E3A\u7A7A");
      }
      let targetObj = node;
      if (op.componentType) {
        const compTypeToFind = this.isUuid(op.componentType) ? this.compressUuid(op.componentType) : op.componentType;
        let foundCompIdx = -1;
        for (const compRef of node._components || []) {
          const comp = data[compRef.__id__];
          if (comp && comp.__type__ === compTypeToFind) {
            foundCompIdx = compRef.__id__;
            break;
          }
        }
        if (foundCompIdx === -1) {
          throw new Error(`\u76EE\u6807\u8282\u70B9 "${op.targetPath}" \u4E0A\u627E\u4E0D\u5230\u7EC4\u4EF6 "${op.componentType}"`);
        }
        targetObj = data[foundCompIdx];
      }
      const { target: propTarget, prop: resolvedProp } = this.resolveNestedProperty(
        targetObj,
        op.propertyName,
        data,
        op.elementType
      );
      const ref = op.referenceValue;
      if (ref.uuid) {
        propTarget[resolvedProp] = { __uuid__: ref.uuid };
        if (!resolvedProp.startsWith("_N$") && !resolvedProp.startsWith("_")) {
          propTarget["_N$" + resolvedProp] = { __uuid__: ref.uuid };
        }
      } else if (ref.path) {
        const refNodeIdx = this.findNodeByPath(data, ref.path);
        if (ref.componentType) {
          const refCompTypeToFind = this.isUuid(ref.componentType) ? this.compressUuid(ref.componentType) : ref.componentType;
          let refCompIdx = -1;
          const refNode = data[refNodeIdx];
          for (const cRef of refNode._components || []) {
            const c = data[cRef.__id__];
            if (c && c.__type__ === refCompTypeToFind) {
              refCompIdx = cRef.__id__;
              break;
            }
          }
          if (refCompIdx === -1) {
            throw new Error(`\u8FDE\u7EBF\u5931\u8D25\uFF1A\u5F15\u7528\u7684\u76EE\u6807\u8282\u70B9\u4E0B\u672A\u5305\u542B\u7EC4\u4EF6 "${ref.componentType}"`);
          }
          propTarget[resolvedProp] = { __id__: refCompIdx };
        } else {
          propTarget[resolvedProp] = { __id__: refNodeIdx };
        }
      }
    }
  }
  /**
   * 深度递归重算对象/数组中所有引用的 __id__ 值，防止物理 splice 后产生错位与悬空引用
   */
  static remapAllIdRefs(obj, mapping, structural = false) {
    if (!obj || typeof obj !== "object") return obj;
    if (Array.isArray(obj)) {
      const values = obj.map((item) => this.remapAllIdRefs(item, mapping));
      return structural ? values.filter((item) => item !== null) : values;
    }
    if (Number.isInteger(obj.__id__)) {
      const next = mapping[obj.__id__];
      if (next === void 0 || next < 0) return null;
      obj.__id__ = next;
      return obj;
    }
    for (const key of Object.keys(obj)) {
      obj[key] = this.remapAllIdRefs(obj[key], mapping, key === "_children" || key === "_components");
    }
    return obj;
  }
  static physicalEraseAndRealign(data, indicesToErase) {
    const deleted = new Set(indicesToErase.filter((i) => Number.isInteger(i) && i >= 0 && i < data.length));
    if (!deleted.size) return;
    let shift = 0;
    const mapping = data.map((_, i) => deleted.has(i) ? (shift++, -1) : i - shift);
    for (let i = 0; i < data.length; i++) data[i] = this.remapAllIdRefs(data[i], mapping);
    for (const i of Array.from(deleted).sort((a, b) => b - a)) data.splice(i, 1);
  }
};
OfflinePrefabEditor.BASE64_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
OfflinePrefabEditor.HexMap = (() => {
  const map = {};
  for (let i = 0; i < 16; i++) {
    map[i.toString(16)] = i;
    map[i.toString(16).toUpperCase()] = i;
  }
  return map;
})();

// src/core/BuildInfo.ts
var BUILD_INFO = Object.freeze(typeof define_MCP_BRIDGE_BUILD_default === "undefined" ? { version: "unbundled", buildId: "unbundled", builtAt: null } : define_MCP_BRIDGE_BUILD_default);
var loadedAt = (/* @__PURE__ */ new Date()).toISOString();
function getRuntimeInfo(role, entryPath) {
  return { ...BUILD_INFO, role, pid: process.pid, loadedAt, entryPath };
}
function composeDiagnostics(editor, scene, proxy, sceneError) {
  const runtimes = { editor: editor || null, scene: scene || null, proxy: proxy || null };
  const issues = [];
  for (const role of Object.keys(runtimes)) {
    if (!runtimes[role]) issues.push(`${role}: runtime information unavailable`);
    else if (!runtimes[role].buildId || runtimes[role].buildId === "unbundled") issues.push(`${role}: no embedded build identity`);
  }
  if (sceneError) issues.push(`scene: ${sceneError}`);
  const identified = Object.keys(runtimes).filter((role) => {
    var _a;
    return ((_a = runtimes[role]) == null ? void 0 : _a.buildId) && runtimes[role].buildId !== "unbundled";
  });
  const mismatch = new Set(identified.map((role) => runtimes[role].buildId)).size > 1;
  if (mismatch) issues.push("Loaded builds differ; restart the proxy and reload the Creator plugin/scene script");
  return { ...runtimes, status: mismatch ? "mismatch" : issues.length ? "incomplete" : "matched", issues };
}

// src/utils/HttpTransport.ts
var http = __toESM(require("http"));
var import_string_decoder = require("string_decoder");
var MAX_REQUEST_BYTES = 5 * 1024 * 1024;
var MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
var FORWARD_TIMEOUT_MS = 9e4;
function readUtf8Body(stream, maxBytes, callback) {
  const decoder = new import_string_decoder.StringDecoder("utf8");
  let parts = [], size = 0, settled = false;
  const finish = (err) => {
    if (settled) return;
    settled = true;
    const body = err ? void 0 : parts.join("") + decoder.end();
    parts = [];
    callback(err, body);
  };
  stream.on("data", (chunk) => {
    if (settled) return;
    const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += bytes.length;
    if (size > maxBytes) {
      const err = new Error(`HTTP \u6D88\u606F\u8D85\u8FC7 ${maxBytes} \u5B57\u8282\u4E0A\u9650`);
      err.code = "ETOOBIG";
      finish(err);
    } else parts.push(decoder.write(bytes));
  });
  stream.on("end", () => finish(null));
  stream.on("error", (err) => finish(err));
  stream.on("aborted", () => finish(new Error("HTTP \u6D88\u606F\u63A5\u6536\u4E2D\u65AD")));
  stream.on("close", () => {
    if (!settled) finish(new Error("HTTP \u8FDE\u63A5\u5728\u6D88\u606F\u5B8C\u6210\u524D\u5173\u95ED"));
  });
  return () => {
    settled = true;
    parts = [];
  };
}
function requestJson(options, payload, callback) {
  let settled = false, cancelRead;
  let request2;
  const finish = (err, result) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (cancelRead) cancelRead();
    callback(err, result);
  };
  const timeout = () => {
    if (settled) return;
    finish(new Error("Cocos HTTP \u8BF7\u6C42\u8D85\u65F6\uFF0C\u64CD\u4F5C\u7ED3\u679C\u672A\u786E\u8BA4\uFF1B\u5982\u6D89\u53CA\u5199\u5165\uFF0C\u8BF7\u5148\u8BFB\u56DE\u7ED3\u679C\uFF0C\u4E0D\u8981\u76F4\u63A5\u91CD\u8BD5"));
    if (request2) request2.destroy();
  };
  const timer = setTimeout(timeout, options.timeout || FORWARD_TIMEOUT_MS);
  try {
    request2 = http.request(options, (res) => {
      cancelRead = readUtf8Body(res, MAX_RESPONSE_BYTES, (err, body) => {
        if (err) {
          finish(err);
          if (request2) request2.destroy();
          return;
        }
        let parsed;
        try {
          parsed = JSON.parse(body);
        } catch (e) {
          finish(new Error(`Cocos \u8FD4\u56DE\u975E JSON \u6570\u636E (HTTP ${res.statusCode})`));
          return;
        }
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          finish(new Error("Cocos HTTP \u54CD\u5E94\u5FC5\u987B\u662F JSON \u5BF9\u8C61"));
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          finish(new Error(`Cocos HTTP ${res.statusCode}: ${parsed.error || parsed.message || "\u8BF7\u6C42\u5931\u8D25"}`));
        } else finish(null, parsed);
      });
    });
    request2.on("error", (err) => finish(err));
    request2.on("timeout", timeout);
    if (payload) request2.write(payload);
    request2.end();
  } catch (err) {
    finish(err);
    if (request2) request2.destroy();
  }
}

// src/tools/ScriptExecution.ts
var SCRIPT_TOOLS = ["execute_javascript", "execute_editor_script", "execute_scene_script"];
function scriptToolDefinitions() {
  return SCRIPT_TOOLS.map((name) => ({
    name,
    category: "execution",
    profile: name === "execute_javascript" ? "core" : "full",
    description: "\u6267\u884C\u901A\u7528 JavaScript\uFF1B\u652F\u6301 return\u3001await\u3001run(env)\u3001module.exports \u51FD\u6570\u3002editor \u53EF\u8BBF\u95EE Editor/require/fs/path\uFF0Cscene \u53EF\u8BBF\u95EE cc/scene/director\u3002\u62E5\u6709\u7F16\u8F91\u5668\u8FDB\u7A0B\u6743\u9650\uFF0C\u975E\u5B89\u5168\u6C99\u7BB1\uFF1B\u8D85\u65F6\u4E0D\u4EE3\u8868\u53D6\u6D88\u526F\u4F5C\u7528\u3002",
    inputSchema: { type: "object", properties: {
      code: { type: "string", description: "JavaScript \u6E90\u7801\uFF0C\u6700\u591A 256KiB\u3002" },
      ...name === "execute_javascript" ? { context: { type: "string", enum: ["editor", "scene"] } } : {},
      args: { type: "object", description: "\u4F20\u5165\u811A\u672C\u7684 JSON \u53C2\u6570\u3002" },
      timeoutMs: { type: "integer", minimum: 100, maximum: 1e4, description: "\u9ED8\u8BA4 5000ms\uFF1B\u5F02\u6B65\u8D85\u65F6\u540E\u4ECD\u7B49\u5F85\u771F\u5B9E\u5B8C\u6210\u624D\u91CA\u653E\u6267\u884C\u961F\u5217\u3002" },
      safety_checks: { type: "boolean", description: "\u9ED8\u8BA4\u68C0\u67E5\u5E38\u89C1\u5220\u9664\u548C\u5B50\u8FDB\u7A0B\u8C03\u7528\uFF1Bfalse \u8DF3\u8FC7\u9759\u6001\u68C0\u67E5\uFF0C\u8BE5\u68C0\u67E5\u4E0D\u662F\u6743\u9650\u9694\u79BB\u3002" }
    }, required: name === "execute_javascript" ? ["code", "context"] : ["code"] }
  }));
}

// src/tools/ToolRegistry.ts
var getToolsList = () => {
  const globalPrecautions = "\u3010AI \u5B89\u5168\u5B88\u5219\u3011: 1. \u6267\u884C\u4EFB\u4F55\u5199\u64CD\u4F5C\u524D\u5FC5\u987B\u5148\u901A\u8FC7 get_scene_hierarchy \u6216 manage_components(get) \u9A8C\u8BC1\u4E3B\u4F53\u5B58\u5728\u3002 2. \u4E25\u7981\u57FA\u4E8E\u5047\u8BBE\u76F2\u76EE\u731C\u6D4B\u5C5E\u6027\u540D\u3002 3. \u8D44\u6E90\u5C5E\u6027\uFF08\u5982 cc.Prefab\uFF09\u5FC5\u987B\u901A\u8FC7 UUID \u8FDB\u884C\u8D4B\u503C\u3002 4. \u4E25\u7981\u9891\u7E41\u5237\u65B0\u5168\u5C40\u8D44\u6E90 (refresh_editor)\uFF0C\u5FC5\u987B\u901A\u8FC7 properties.path \u6307\u5B9A\u5177\u4F53\u4FEE\u6539\u7684\u6587\u4EF6\u6216\u76EE\u5F55\u4EE5\u9632\u6B62\u7F16\u8F91\u5668\u957F\u671F\u5361\u6B7B\u3002";
  const base = [
    ...["simulate_mouse_drag", "simulate_mouse_click"].map((name) => ({
      name,
      description: "\u57FA\u4E8E\u622A\u56FE\u50CF\u7D20\u5750\u6807\u5411\u7F16\u8F91\u5668\u4E3B\u7A97\u53E3\u53D1\u9001\u539F\u751F\u9F20\u6807\u8F93\u5165\uFF1B\u6309 renderer \u5E27\u63A8\u8FDB\u3002\u56DE\u6267\u4E0D\u8BC1\u660E\u6E38\u620F\u63A5\u53D7\u8F93\u5165\u3002start \u9700\u65B0\u622A\u56FE\u548C\u552F\u4E00 requestKey\uFF1Bstatus/cancel \u5FC5\u987B\u4F7F\u7528\u539F\u5DE5\u5177\u548C\u539F key/jobId\uFF0C\u7981\u6B62\u56DE\u6267\u4E22\u5931\u540E\u81EA\u52A8\u91CD\u653E\u3002",
      inputSchema: { type: "object", properties: {
        action: { type: "string", enum: ["start", "status", "cancel"] },
        captureId: { type: "string" },
        requestKey: { type: "string", maxLength: 128 },
        jobId: { type: "string" },
        start: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
        end: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
        durationMs: { type: "number", minimum: 50, maximum: 1e4 },
        pressHoldMs: { type: "number", minimum: 0, maximum: 2e3 },
        endHoldMs: { type: "number", minimum: 0, maximum: 2e3 },
        waitMs: { type: "number", minimum: 0, maximum: 2e3 }
      } }
    })),
    {
      name: "get_selected_node",
      description: `\u83B7\u53D6\u5F53\u524D\u7F16\u8F91\u5668\u4E2D\u9009\u4E2D\u7684\u8282\u70B9 ID\u3002\u5EFA\u8BAE\u83B7\u53D6\u540E\u7ACB\u5373\u8C03\u7528 get_scene_hierarchy \u786E\u8BA4\u8BE5\u8282\u70B9\u662F\u5426\u4ECD\u5B58\u5728\u4E8E\u5F53\u524D\u573A\u666F\u4E2D\u3002`,
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "set_node_name",
      description: `${globalPrecautions} \u4FEE\u6539\u6307\u5B9A\u8282\u70B9\u7684\u540D\u79F0`,
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "\u8282\u70B9\u7684 UUID" },
          newName: { type: "string", description: "\u65B0\u7684\u8282\u70B9\u540D\u79F0" }
        },
        required: ["id", "newName"]
      }
    },
    {
      name: "save_scene",
      description: `\u4FDD\u5B58\u5F53\u524D\u573A\u666F\u7684\u4FEE\u6539`,
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "save_prefab",
      description: `\u4FDD\u5B58\u5F53\u524D\u6B63\u5728\u7F16\u8F91\u7684\u9884\u5236\u4F53\u7684\u4FEE\u6539\uFF08\u4EC5\u5728 open_prefab \u8FDB\u5165\u9884\u5236\u4F53\u7F16\u8F91\u6A21\u5F0F\u540E\u4F7F\u7528\uFF09`,
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "close_prefab",
      description: `\u9000\u51FA\u9884\u5236\u4F53\u7F16\u8F91\u6A21\u5F0F\uFF0C\u8FD4\u56DE\u666E\u901A\u573A\u666F\u7F16\u8F91\u72B6\u6001`,
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "get_scene_hierarchy",
      description: `\u83B7\u53D6\u5F53\u524D\u573A\u666F\u7684\u8282\u70B9\u6811\u7ED3\u6784\uFF08\u5305\u542B UUID\u3001\u540D\u79F0\u3001\u5B50\u8282\u70B9\u6570\uFF09\u3002\u82E5\u8981\u67E5\u8BE2\u8282\u70B9\u7EC4\u4EF6\u8BE6\u60C5\u7B49\uFF0C\u8BF7\u4F7F\u7528 manage_components\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          childOffset: { type: "integer", minimum: 0 },
          childPageSize: { type: "integer", minimum: 1, maximum: 100 },
          childVersion: { type: "string" },
          nodeId: { type: "string", description: "\u6307\u5B9A\u7684\u6839\u8282\u70B9 UUID\u3002\u5982\u679C\u4E0D\u4F20\u5219\u83B7\u53D6\u6574\u4E2A\u573A\u666F\u7684\u6839\u3002" },
          depth: {
            type: "integer",
            minimum: 0,
            maximum: 10,
            description: "\u904D\u5386\u7684\u6DF1\u5EA6\u9650\u5236\uFF0C\u9ED8\u8BA4\u4E3A 2\u3002\u7528\u6765\u9632\u6B62\u8FC7\u5927\u573A\u666F\u5BFC\u81F4\u8FD4\u56DE\u6570\u636E\u8D85\u957F\u3002"
          },
          includeDetails: { type: "boolean", description: "\u662F\u5426\u5305\u542B\u5750\u6807\u3001\u7F29\u653E\u7B49\u6742\u9879\u8BE6\u60C5\uFF0C\u9ED8\u8BA4\u4E3A false\u3002" }
        }
      }
    },
    {
      name: "update_node_transform",
      description: `${globalPrecautions} \u4FEE\u6539\u8282\u70B9\u7684\u5750\u6807\u3001\u7F29\u653E\u3001\u989C\u8272\u6216\u663E\u9690\u72B6\u6001\u3002\u6267\u884C\u524D\u5FC5\u987B\u8C03\u7528 get_scene_hierarchy \u786E\u4FDD node ID \u6709\u6548\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "\u8282\u70B9 UUID" },
          active: { type: "boolean", description: "\u8282\u70B9\u7684\u6FC0\u6D3B\u72B6\u6001 (\u663E\u9690)" },
          x: { type: "number" },
          y: { type: "number" },
          rotation: { type: "number", description: "\u65CB\u8F6C\u89D2\u5EA6" },
          width: { type: "number" },
          height: { type: "number" },
          scaleX: { type: "number" },
          scaleY: { type: "number" },
          anchorX: { type: "number", description: "\u951A\u70B9 X (0~1)" },
          anchorY: { type: "number", description: "\u951A\u70B9 Y (0~1)" },
          color: { type: "string", description: "HEX \u989C\u8272\u4EE3\u7801\u5982 #FF0000" },
          opacity: { type: "number", description: "\u900F\u660E\u5EA6 (0~255)" },
          skewX: { type: "number", description: "\u503E\u659C X" },
          skewY: { type: "number", description: "\u503E\u659C Y" }
        },
        required: ["id"]
      }
    },
    {
      name: "create_scene",
      description: `\u5728 assets \u76EE\u5F55\u4E0B\u521B\u5EFA\u4E00\u4E2A\u65B0\u7684\u573A\u666F\u6587\u4EF6\u3002\u521B\u5EFA\u5E76\u901A\u8FC7 open_scene \u6253\u5F00\u540E\uFF0C\u8BF7\u52A1\u5FC5\u521D\u59CB\u5316\u57FA\u7840\u8282\u70B9\uFF08\u5982 Canvas \u548C Camera\uFF09\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          sceneName: { type: "string", description: "\u573A\u666F\u540D\u79F0" }
        },
        required: ["sceneName"]
      }
    },
    {
      name: "create_prefab",
      description: `${globalPrecautions} \u5C06\u573A\u666F\u4E2D\u7684\u67D0\u4E2A\u8282\u70B9\u4FDD\u5B58\u4E3A\u9884\u5236\u4F53\u8D44\u6E90`,
      inputSchema: {
        type: "object",
        properties: {
          nodeId: { type: "string", description: "\u8282\u70B9 UUID" },
          prefabName: { type: "string", description: "\u9884\u5236\u4F53\u540D\u79F0\u6216\u5305\u542B\u5B8C\u6574\u8DEF\u5F84\u7684\u540D\u79F0\uFF08\u5982 MyPrefab \u6216 db://assets/prefabs/MyPrefab.prefab\uFF09" }
        },
        required: ["nodeId", "prefabName"]
      }
    },
    {
      name: "open_scene",
      description: `\u6253\u5F00\u573A\u666F\u6587\u4EF6\u3002\u6CE8\u610F\uFF1A\u8FD9\u662F\u4E00\u4E2A\u5F02\u6B65\u4E14\u8017\u65F6\u7684\u64CD\u4F5C\uFF0C\u6253\u5F00\u540E\u8BF7\u7B49\u5F85\u51E0\u79D2\u3002\u91CD\u8981\uFF1A\u5982\u679C\u662F\u65B0\u521B\u5EFA\u6216\u7A7A\u7684\u573A\u666F\uFF0C\u8BF7\u52A1\u5FC5\u5148\u521B\u5EFA\u5E76\u521D\u59CB\u5316\u57FA\u7840\u8282\u70B9\uFF08Canvas/Camera\uFF09\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "\u573A\u666F\u8D44\u6E90\u8DEF\u5F84\uFF0C\u5982 db://assets/NewScene.fire"
          }
        },
        required: ["url"]
      }
    },
    {
      name: "open_prefab",
      description: `\u5728\u7F16\u8F91\u5668\u4E2D\u6253\u5F00\u9884\u5236\u4F53\u6587\u4EF6\u8FDB\u5165\u7F16\u8F91\u6A21\u5F0F\u3002\u6CE8\u610F\uFF1A\u8FD9\u662F\u4E00\u4E2A\u5F02\u6B65\u64CD\u4F5C\uFF0C\u6253\u5F00\u540E\u8BF7\u7B49\u5F85\u51E0\u79D2\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "\u9884\u5236\u4F53\u8D44\u6E90\u8DEF\u5F84\uFF0C\u5982 db://assets/prefabs/Test.prefab"
          }
        },
        required: ["url"]
      }
    },
    {
      name: "create_node",
      description: `${globalPrecautions} \u5728\u5F53\u524D\u573A\u666F\u4E2D\u521B\u5EFA\u4E00\u4E2A\u65B0\u8282\u70B9\u3002\u91CD\u8981\u63D0\u793A\uFF1A1. \u5982\u679C\u6307\u5B9A parentId\uFF0C\u5FC5\u987B\u5148\u901A\u8FC7 get_scene_hierarchy \u786E\u4FDD\u8BE5\u7236\u8282\u70B9\u771F\u5B9E\u5B58\u5728\u4E14\u672A\u88AB\u5220\u9664\u30022. \u7C7B\u578B\u8BF4\u660E\uFF1A'sprite' (100x100 \u5C3A\u5BF8 + \u9ED8\u8BA4\u8D34\u56FE), 'button' (150x50 \u5C3A\u5BF8 + \u6DF1\u8272\u5E95\u56FE + Button\u7EC4\u4EF6), 'label' (120x40 \u5C3A\u5BF8 + Label\u7EC4\u4EF6), 'empty' (\u7EAF\u7A7A\u8282\u70B9)\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          returnDetails: { type: "boolean", description: "\u8FD4\u56DE\u5305\u542B uuid/name/parentId \u7684\u5BF9\u8C61\uFF0C\u4F9B\u6279\u5904\u7406 $ref \u5F15\u7528\uFF1B\u9ED8\u8BA4\u4ECD\u8FD4\u56DE\u6587\u672C" },
          width: { type: "number", minimum: 0 },
          height: { type: "number", minimum: 0 },
          text: { type: "string" },
          fontSize: { type: "number", minimum: 1 },
          spriteFrameUuid: { type: "string", description: "Sprite \u6216 Button \u4F7F\u7528\u7684 SpriteFrame / Texture UUID\u3002" },
          name: { type: "string", description: "\u8282\u70B9\u540D\u79F0" },
          parentId: {
            type: "string",
            description: "\u7236\u8282\u70B9 UUID (\u53EF\u9009\uFF0C\u4E0D\u4F20\u5219\u6302\u5728\u573A\u666F\u6839\u90E8)"
          },
          type: {
            type: "string",
            enum: ["empty", "sprite", "label", "button", "canvas", "camera"],
            description: "\u8282\u70B9\u9884\u8BBE\u7C7B\u578B"
          },
          layout: {
            type: "string",
            enum: [
              "center",
              "top",
              "bottom",
              "left",
              "right",
              "top-left",
              "top-right",
              "bottom-left",
              "bottom-right",
              "full"
            ],
            description: "\u81EA\u52A8\u6302\u8F7D cc.Widget \u5E76\u8FDB\u884C\u5FEB\u6377\u6392\u7248\u9002\u914D\u3002\u63A8\u8350\u7EDD\u5927\u591A\u6570 UI \u5143\u7D20\u5728\u521B\u5EFA\u65F6\u4F7F\u7528\u6B64\u53C2\u6570\u66FF\u4EE3\u624B\u52A8\u6307\u5B9A\u5750\u6807\u3002"
          }
        },
        required: ["name"]
      }
    },
    {
      name: "manage_components",
      description: `${globalPrecautions} \u7BA1\u7406\u8282\u70B9\u7EC4\u4EF6\u3002\u91CD\u8981\u63D0\u793A\uFF1A1. \u64CD\u4F5C\u524D\u5FC5\u987B\u8C03\u7528 get_scene_hierarchy \u786E\u8BA4 nodeId \u5BF9\u5E94\u7684\u8282\u70B9\u4ECD\u7136\u5B58\u5728\u30022. \u6DFB\u52A0\u524D\u5148\u7528 'get' \u68C0\u67E5\u662F\u5426\u5DF2\u5B58\u5728\u30023. \u6DFB\u52A0 cc.Sprite \u540E\u5FC5\u987B\u8BBE\u7F6E spriteFrame \u5C5E\u6027\uFF0C\u5426\u5219\u8282\u70B9\u4E0D\u663E\u793A\u30024. \u521B\u5EFA\u6309\u94AE\u65F6\uFF0C\u8BF7\u786E\u4FDD\u76EE\u6807\u8282\u70B9\u6709\u8DB3\u591F\u7684 width \u548C height \u4F5C\u4E3A\u70B9\u51FB\u533A\u57DF\u30025. \u8D4B\u503C\u6216\u66F4\u65B0\u5C5E\u6027\u524D\uFF0C\u5FC5\u987B\u786E\u4FDD\u76EE\u6807\u5C5E\u6027\u5728\u7EC4\u4EF6\u4E0A\u771F\u5B9E\u5B58\u5728\uFF0C\u4E25\u7981\u76F2\u76EE\u64CD\u4F5C\u4E0D\u5B58\u5728\u7684\u5C5E\u6027\u30026. \u5BF9\u4E8E\u8D44\u6E90\u7C7B\u5C5E\u6027\uFF08\u5982 cc.Prefab, sp.SkeletonData\uFF09\uFF0C\u4F20\u9012\u8D44\u6E90\u7684 UUID\u3002\u63D2\u4EF6\u4F1A\u81EA\u52A8\u8FDB\u884C\u5F02\u6B65\u52A0\u8F7D\u5E76\u6B63\u786E\u5E8F\u5217\u5316\uFF0C\u907F\u514D Inspector \u51FA\u73B0 Type Error\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          nodeIds: { type: "array", minItems: 1, maxItems: 100, items: { type: "string" }, description: "\u4EC5 get\uFF1A\u6279\u91CF\u8282\u70B9 UUID\uFF0C\u8FD4\u56DE\u6BCF\u4E2A\u8282\u70B9\u7684 components \u6216 error\uFF1B\u4E0E nodeId \u4E92\u65A5" },
          fields: { type: "array", maxItems: 100, items: { type: "string" }, description: "\u4EC5 get\uFF1A\u53EA\u8BFB\u53D6\u6307\u5B9A\u5C5E\u6027\uFF1B\u4E0D\u4F20\u4ECD\u8FD4\u56DE\u6240\u6709\u516C\u5F00\u5C5E\u6027" },
          includeFullText: { type: "boolean", description: "\u4EC5 get\uFF1A\u5B8C\u6574\u8FD4\u56DE\u5B57\u7B26\u4E32\uFF1B\u9ED8\u8BA4\u4FDD\u7559\u957F\u6587\u672C\u6458\u8981" },
          referenceMode: { type: "string", enum: ["summary", "structured"], description: "\u4EC5 get\uFF1Astructured \u8FD4\u56DE\u8D44\u6E90/\u8282\u70B9/\u7EC4\u4EF6\u5F15\u7528\u7684 UUID \u548C\u7C7B\u578B\uFF0C\u9ED8\u8BA4\u4FDD\u7559\u540D\u79F0\u6458\u8981" },
          nodeId: { type: "string", description: "\u8282\u70B9 UUID" },
          action: {
            type: "string",
            enum: ["add", "remove", "update", "get"],
            description: "\u64CD\u4F5C\u7C7B\u578B (add: \u6DFB\u52A0\u7EC4\u4EF6, remove: \u79FB\u9664\u7EC4\u4EF6, update: \u66F4\u65B0\u7EC4\u4EF6\u5C5E\u6027, get: \u83B7\u53D6\u7EC4\u4EF6\u5217\u8868)"
          },
          componentType: { type: "string", description: "\u7EC4\u4EF6\u7C7B\u578B\uFF0C\u5982 cc.Sprite (add/update \u64CD\u4F5C\u9700\u8981)" },
          componentId: { type: "string", description: "\u7EC4\u4EF6 ID (remove/update \u64CD\u4F5C\u53EF\u9009)" },
          properties: {
            type: "object",
            description: "\u7EC4\u4EF6\u5C5E\u6027 (add/update \u64CD\u4F5C\u4F7F\u7528). \u652F\u6301\u667A\u80FD\u89E3\u6790: \u5982\u679C\u5C5E\u6027\u7C7B\u578B\u662F\u7EC4\u4EF6\u4F46\u63D0\u4F9B\u4E86\u8282\u70B9UUID\uFF0C\u4F1A\u81EA\u52A8\u67E5\u627E\u5BF9\u5E94\u7EC4\u4EF6\u3002"
          }
        },
        required: ["action"]
      }
    },
    {
      name: "manage_script",
      description: `${globalPrecautions} \u7BA1\u7406\u811A\u672C\u6587\u4EF6\u3002\u6CE8\u610F\uFF1A\u521B\u5EFA\u6216\u4FEE\u6539\u811A\u672C\u9700\u65F6\u95F4\u7F16\u8BD1\u3002\u521B\u5EFA\u540E\u5FC5\u987B\u8C03\u7528 refresh_editor (\u52A1\u5FC5\u6307\u5B9A path) \u751F\u6210 meta \u6587\u4EF6\uFF0C\u5426\u5219\u65E0\u6CD5\u4F5C\u4E3A\u7EC4\u4EF6\u6DFB\u52A0\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "delete", "read", "write", "save"], description: "\u64CD\u4F5C\u7C7B\u578B" },
          path: { type: "string", description: "\u811A\u672C\u8DEF\u5F84\uFF0C\u5982 db://assets/scripts/NewScript.js" },
          content: { type: "string", description: "\u811A\u672C\u5185\u5BB9 (\u7528\u4E8E create \u548C write \u64CD\u4F5C)" },
          name: { type: "string", description: "\u811A\u672C\u540D\u79F0 (\u7528\u4E8E create \u64CD\u4F5C)" }
        },
        required: ["action", "path"]
      }
    },
    {
      name: "batch_execute",
      description: `${globalPrecautions} \u4E32\u884C\u6267\u884C\u591A\u4E2A\u64CD\u4F5C\u3002\u6574\u6279\u53C2\u6570\u5148\u9884\u68C0\uFF1B\u9ED8\u8BA4\u9047\u9519\u505C\u6B62\u5E76\u8FD4\u56DE\u5DF2\u6267\u884C\u7ED3\u679C\uFF0C\u4E0D\u81EA\u52A8\u56DE\u6EDA\u3002params \u4E2D\u53EF\u7528 {"$ref":"\u524D\u5E8F\u64CD\u4F5Cid.\u7ED3\u679C\u5B57\u6BB5"} \u5F15\u7528\u8FD4\u56DE\u503C\uFF1Bcreate_node \u914D\u5408 returnDetails:true \u83B7\u53D6 uuid\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          outputMode: { type: "string", enum: ["full", "summary"] },
          executionMode: { type: "string", enum: ["auto", "serial", "scene"], description: "\u9ED8\u8BA4 auto\uFF1A\u6574\u6279\u4E3A\u8282\u70B9/\u7EC4\u4EF6/\u573A\u666F\u67E5\u8BE2\u65F6\u5355\u6B21\u573A\u666F IPC \u6267\u884C\uFF0814\u79D2\u622A\u6B62\uFF09\uFF1Bserial \u4FDD\u7559\u9010\u9879\u901A\u4FE1\uFF1Bscene \u9047\u4E0D\u652F\u6301\u7684\u5DE5\u5177\u76F4\u63A5\u62D2\u7EDD\u3002\u5931\u8D25\u4E0D\u4F1A\u56DE\u6EDA\u3002" },
          maxResultBytes: { type: "integer", minimum: 1024, maximum: 4194304 },
          resultFields: { type: "array", items: { type: "string" }, maxItems: 100 },
          stopOnError: { type: "boolean", description: "\u9ED8\u8BA4 true\uFF1A\u5931\u8D25\u7ACB\u5373\u505C\u6B62\uFF1Bfalse \u7EE7\u7EED\u72EC\u7ACB\u64CD\u4F5C\uFF0C\u6700\u7EC8\u4ECD\u6807\u8BB0\u5931\u8D25" },
          operations: {
            type: "array",
            minItems: 1,
            maxItems: 100,
            items: {
              type: "object",
              properties: {
                id: { type: "string", description: "\u53EF\u9009\u552F\u4E00\u540D\u79F0\uFF0C\u4EE5\u5B57\u6BCD\u5F00\u5934\uFF0C\u53EA\u542B\u5B57\u6BCD\u6570\u5B57\u4E0B\u5212\u7EBF\u6216\u77ED\u6A2A\u7EBF\uFF0C\u4F9B\u540E\u7EED\u5F15\u7528" },
                tool: { type: "string", description: "\u5DE5\u5177\u540D\u79F0" },
                params: { type: "object", description: "\u5DE5\u5177\u53C2\u6570" }
              },
              required: ["tool", "params"]
            },
            description: "\u64CD\u4F5C\u5217\u8868"
          }
        },
        required: ["operations"]
      }
    },
    {
      name: "manage_asset",
      description: `${globalPrecautions} \u7BA1\u7406\u8D44\u6E90`,
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["create", "delete", "move", "get_info"], description: "\u64CD\u4F5C\u7C7B\u578B" },
          path: { type: "string", description: "\u8D44\u6E90\u8DEF\u5F84\uFF0C\u5982 db://assets/textures\uFF1B\u6839\u76EE\u5F55 db://assets \u4EC5\u5141\u8BB8 get_info\uFF0C\u5199\u64CD\u4F5C\u4F1A\u88AB\u62D2\u7EDD" },
          paths: { type: "array", minItems: 1, maxItems: 500, items: { type: "string" }, description: "\u4EC5 delete \u53EF\u7528\uFF1A\u6279\u91CF\u8D44\u6E90 URL\uFF0C\u4E0E path \u4E8C\u9009\u4E00" },
          targetPath: { type: "string", description: "\u76EE\u6807\u8DEF\u5F84 (\u7528\u4E8E move \u64CD\u4F5C)" },
          content: { type: "string", description: "\u8D44\u6E90\u5185\u5BB9 (\u7528\u4E8E create \u64CD\u4F5C)" }
        },
        required: ["action"]
      }
    },
    {
      name: "scene_management",
      description: `${globalPrecautions} \u573A\u666F\u7BA1\u7406`,
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "delete", "duplicate", "get_info"],
            description: "\u64CD\u4F5C\u7C7B\u578B"
          },
          path: { type: "string", description: "\u573A\u666F\u8DEF\u5F84\uFF0C\u5982 db://assets/scenes/NewScene.fire" },
          targetPath: { type: "string", description: "\u76EE\u6807\u8DEF\u5F84 (\u7528\u4E8E duplicate \u64CD\u4F5C)" },
          name: { type: "string", description: "\u573A\u666F\u540D\u79F0 (\u7528\u4E8E create \u64CD\u4F5C)" }
        },
        required: ["action", "path"]
      }
    },
    {
      name: "prefab_management",
      description: `${globalPrecautions} \u9884\u5236\u4F53\u7BA1\u7406\u3002update \u53EA\u63A5\u53D7\u76EE\u6807\u8D44\u6E90\u7684\u6839\u5B9E\u4F8B\uFF1B\u5728\u5BF9\u5E94\u9884\u5236\u4F53\u7F16\u8F91\u6A21\u5F0F\u7B49\u5F85\u4FDD\u5B58\u56DE\u6267\uFF0C\u573A\u666F\u5B9E\u4F8B\u4F7F\u7528 Creator apply \u6D88\u606F\u5E76\u7B49\u5F85\u843D\u76D8/AssetDB\u540C\u6B65\u3002\u672A\u786E\u8BA4\u5B8C\u6210\u4E0D\u62A5\u544A\u6210\u529F\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "update", "instantiate", "get_info"],
            description: "\u64CD\u4F5C\u7C7B\u578B"
          },
          path: { type: "string", description: "\u9884\u5236\u4F53\u8DEF\u5F84\uFF0C\u5982 db://assets/prefabs/NewPrefab.prefab" },
          nodeId: { type: "string", description: "\u8282\u70B9 ID (\u7528\u4E8E create \u64CD\u4F5C)" },
          parentId: { type: "string", description: "\u7236\u8282\u70B9 ID (\u7528\u4E8E instantiate \u64CD\u4F5C)" }
        },
        required: ["action", "path"]
      }
    },
    {
      name: "manage_editor",
      description: `${globalPrecautions} \u7BA1\u7406\u7F16\u8F91\u5668`,
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["get_selection", "set_selection", "refresh_editor"],
            description: "\u64CD\u4F5C\u7C7B\u578B"
          },
          target: {
            type: "string",
            enum: ["node", "asset"],
            description: "\u76EE\u6807\u7C7B\u578B (\u7528\u4E8E set_selection \u64CD\u4F5C)"
          },
          properties: {
            type: "object",
            description: "\u64CD\u4F5C\u5C5E\u6027\u3002set_selection \u9700\u63D0\u4F9B properties.ids\uFF08\u8282\u70B9/\u8D44\u6E90 UUID \u6570\u7EC4\uFF0C\u4E5F\u63A5\u53D7 properties.uuid \u5355\u4E2A\u503C\uFF09\uFF1B\u672A\u771F\u6B63\u9009\u4E2D\u4F1A\u76F4\u63A5\u62A5\u9519\u3002refresh_editor \u9700\u63D0\u4F9B properties.path\uFF0C\u4E14\u4EC5\u63A5\u53D7\u5355\u6587\u4EF6\u8DEF\u5F84\uFF08\u5E26\u540E\u7F00\u540D\u5982 'db://assets/scripts/MyScript.ts'\uFF09\u3002\u76EE\u5F55\u8DEF\u5F84\u548C db://assets \u5168\u5C40\u8DEF\u5F84\u5DF2\u88AB\u4EE3\u7801\u5C42\u62D2\u7EDD\uFF0C\u4F20\u5165\u5C06\u76F4\u63A5\u62A5\u9519\u3002\u8FD9\u662F\u56E0\u4E3A\u76EE\u5F55\u7EA7\u5237\u65B0\u4F1A\u963B\u585E\u7F16\u8F91\u5668\u4E3B\u7EBF\u7A0B\u6570\u5206\u949F\u5E76\u89E6\u53D1\u7F16\u8BD1\u7EA7\u8054\u5361\u6B7B\u3002\u4FEE\u6539\u591A\u4E2A\u6587\u4EF6\u540E\u8BF7\u9010\u4E2A\u5237\u65B0\u3002"
          }
        },
        required: ["action"]
      }
    },
    {
      name: "find_gameobjects",
      description: `\u6309\u6761\u4EF6\u5728\u573A\u666F\u4E2D\u641C\u7D22\u6E38\u620F\u5BF9\u8C61\u3002\u8FD4\u56DE\u5339\u914D\u8282\u70B9\u7684\u8F7B\u91CF\u7EA7\u7ED3\u6784 (UUID, name, active, components \u7B49)\u3002\u82E5\u8981\u83B7\u53D6\u5B8C\u6574\u7684\u8BE6\u7EC6\u7EC4\u4EF6\u5C5E\u6027\uFF0C\u8BF7\u8FDB\u4E00\u6B65\u5BF9\u76EE\u6807\u4F7F\u7528 manage_components\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          scopeNodeId: { type: "string" },
          pageSize: { type: "integer", minimum: 1, maximum: 500 },
          cursor: { type: "string" },
          maxVisited: { type: "integer", minimum: 1, maximum: 5e4 },
          maxTimeMs: { type: "integer", minimum: 1, maximum: 3e3 },
          includeMetadata: { type: "boolean" },
          conditions: {
            type: "object",
            description: "\u67E5\u627E\u6761\u4EF6\u3002\u652F\u6301\u7684\u5C5E\u6027\uFF1Aname (\u8282\u70B9\u540D\u79F0\uFF0C\u652F\u6301\u6A21\u7CCA\u5339\u914D), component (\u5305\u542B\u7684\u7EC4\u4EF6\u7C7B\u540D\uFF0C\u5982 'cc.Sprite'), active (\u5E03\u5C14\u503C\uFF0C\u8282\u70B9\u7684\u6FC0\u6D3B\u72B6\u6001)\u3002"
          },
          recursive: { type: "boolean", default: true, description: "\u662F\u5426\u9012\u5F52\u67E5\u627E\u6240\u6709\u5B50\u8282\u70B9" }
        },
        required: ["conditions"]
      }
    },
    {
      name: "manage_material",
      description: `${globalPrecautions} \u7BA1\u7406\u6750\u8D28\u3002\u652F\u6301\u521B\u5EFA\u3001\u83B7\u53D6\u4FE1\u606F\u4EE5\u53CA\u66F4\u65B0 Shader\u3001Defines \u548C Uniforms \u53C2\u6570\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "delete", "get_info", "update"],
            description: "\u64CD\u4F5C\u7C7B\u578B"
          },
          path: { type: "string", description: "\u6750\u8D28\u8DEF\u5F84\uFF0C\u5982 db://assets/materials/NewMaterial.mat" },
          properties: {
            type: "object",
            description: "\u6750\u8D28\u5C5E\u6027 (add/update \u64CD\u4F5C\u4F7F\u7528)",
            properties: {
              shaderUuid: { type: "string", description: "\u5173\u8054\u7684 Shader (Effect) UUID" },
              defines: { type: "object", description: "\u9884\u7F16\u8BD1\u5B8F\u5B9A\u4E49" },
              uniforms: { type: "object", description: "Uniform \u53C2\u6570\u5217\u8868" }
            }
          }
        },
        required: ["action", "path"]
      }
    },
    {
      name: "manage_texture",
      description: `${globalPrecautions} \u7BA1\u7406\u7EB9\u7406`,
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "delete", "get_info", "update"],
            description: "\u64CD\u4F5C\u7C7B\u578B"
          },
          path: { type: "string", description: "\u7EB9\u7406\u8DEF\u5F84\uFF0C\u5982 db://assets/textures/NewTexture.png" },
          properties: { type: "object", description: "\u7EB9\u7406\u5C5E\u6027" }
        },
        required: ["action", "path"]
      }
    },
    {
      name: "manage_shader",
      description: `${globalPrecautions} \u7BA1\u7406\u7740\u8272\u5668 (Effect)\u3002\u652F\u6301\u521B\u5EFA\u3001\u8BFB\u53D6\u3001\u66F4\u65B0\u3001\u5220\u9664\u548C\u83B7\u53D6\u4FE1\u606F\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "delete", "read", "write", "get_info"],
            description: "\u64CD\u4F5C\u7C7B\u578B"
          },
          path: { type: "string", description: "\u7740\u8272\u5668\u8DEF\u5F84\uFF0C\u5982 db://assets/effects/NewEffect.effect" },
          content: { type: "string", description: "\u7740\u8272\u5668\u5185\u5BB9 (create/write)" }
        },
        required: ["action", "path"]
      }
    },
    {
      name: "execute_menu_item",
      description: `${globalPrecautions} \u6267\u884C\u83DC\u5355\u9879\u3002\u5BF9\u4E8E\u8282\u70B9\u5220\u9664\uFF0C\u8BF7\u4F7F\u7528 "delete-node:UUID" \u683C\u5F0F\u4EE5\u786E\u4FDD\u7CBE\u786E\u6267\u884C\u3002\u5BF9\u4E8E\u4FDD\u5B58\u3001\u64A4\u9500\u7B49\u64CD\u4F5C\uFF0C\u8BF7\u4F18\u5148\u4F7F\u7528\u4E13\u7528\u5DE5\u5177 (save_scene, manage_undo)\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          menuPath: {
            type: "string",
            description: "\u83DC\u5355\u9879\u8DEF\u5F84 (\u652F\u6301 'Project/Build' \u6216 'delete-node:UUID')"
          }
        },
        required: ["menuPath"]
      }
    },
    {
      name: "apply_text_edits",
      description: `${globalPrecautions} \u5BF9\u6587\u4EF6\u5E94\u7528\u6587\u672C\u7F16\u8F91\u3002**\u4E13\u7528\u4E8E\u4FEE\u6539\u811A\u672C\u6E90\u4EE3\u7801 (.js, .ts) \u6216\u6587\u672C\u6587\u4EF6**\u3002\u5982\u679C\u8981\u4FEE\u6539\u573A\u666F\u8282\u70B9\u5C5E\u6027\uFF0C\u8BF7\u4F7F\u7528 'manage_components'\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          expectedSha: { type: "string", description: "\u53EF\u9009\u539F\u6587\u4EF6 SHA-256\uFF08\u53EF\u7531 get_sha \u83B7\u5F97\uFF09\uFF0C\u4E0D\u4E00\u81F4\u5219\u6574\u6279\u62D2\u7EDD\u3002\u504F\u79FB\u57FA\u4E8E\u539F\u6587UTF-16\u7D22\u5F15\uFF0C\u4E0D\u5F97\u5207\u5F00emoji\u3001\u8D8A\u754C\u6216\u91CD\u53E0\u3002" },
          edits: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["insert", "delete", "replace"],
                  description: "\u64CD\u4F5C\u7C7B\u578B"
                },
                start: { type: "integer", minimum: 0, description: "\u539F\u6587UTF-16\u8D77\u59CB\u504F\u79FB\u91CF" },
                end: { type: "integer", minimum: 0, description: "\u539F\u6587UTF-16\u7ED3\u675F\u504F\u79FB\u91CF\uFF08\u4E0D\u542B\uFF09" },
                position: { type: "integer", minimum: 0, description: "\u539F\u6587UTF-16\u63D2\u5165\u4F4D\u7F6E" },
                text: { type: "string", description: "\u8981\u63D2\u5165\u6216\u66FF\u6362\u7684\u6587\u672C" }
              },
              required: ["type"]
            },
            description: "\u7F16\u8F91\u64CD\u4F5C\u5217\u8868\u3002\u8BF7\u4E25\u683C\u4F7F\u7528\u504F\u79FB\u91CF(offset)\u800C\u975E\u884C\u53F7\u3002"
          },
          filePath: { type: "string", description: "\u6587\u4EF6\u8DEF\u5F84 (db://...)" }
        },
        required: ["filePath", "edits"]
      }
    },
    {
      name: "read_console",
      description: `\u8BFB\u53D6\u63A7\u5236\u53F0`,
      inputSchema: {
        type: "object",
        properties: {
          cursor: { type: "string" },
          includeMetadata: { type: "boolean" },
          limit: { type: "number", description: "\u8F93\u51FA\u9650\u5236" },
          type: {
            type: "string",
            enum: ["info", "log", "warn", "error", "success", "mcp"],
            description: "\u8F93\u51FA\u7C7B\u578B (info, warn, error, success, mcp)"
          }
        }
      }
    },
    {
      name: "validate_script",
      description: `\u9A8C\u8BC1\u811A\u672C\uFF1AJS \u8FDB\u884C\u8BED\u6CD5\u68C0\u67E5\uFF1BTS \u6309\u6574\u4E2A\u5DE5\u7A0B tsconfig \u8FD0\u884C tsc --noEmit\uFF0C\u975E Creator \u7F16\u8BD1/\u9884\u89C8\u5B8C\u6210\u8BC1\u660E\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          filePath: { type: "string", description: "\u811A\u672C\u8DEF\u5F84" }
        },
        required: ["filePath"]
      }
    },
    {
      name: "button_events",
      description: "\u5217\u51FA\u6216\u7ED1\u5B9A 2.4 Button \u4E8B\u4EF6\uFF1B\u7ED1\u5B9A\u524D\u6838\u5BF9\u76EE\u6807\u8282\u70B9\u3001\u7EC4\u4EF6\u548C\u56DE\u8C03\u51FD\u6570\uFF0C\u9632\u6B62\u540C\u4E00\u4E8B\u4EF6\u91CD\u590D\u7ED1\u5B9A\uFF1B\u7ED3\u679C\u4E0D\u4EE3\u8868\u771F\u5B9E\u70B9\u51FB\u547D\u4E2D\u6216\u5DF2\u4FDD\u5B58\u3002",
      inputSchema: { type: "object", properties: { action: { type: "string", enum: ["list", "bind"] }, nodeId: { type: "string" }, targetId: { type: "string" }, componentName: { type: "string" }, handler: { type: "string" }, customEventData: { type: "string" }, replace: { type: "boolean" } }, required: ["action", "nodeId"] }
    },
    {
      name: "validate_prefab",
      description: "\u53EA\u8BFB\u9A8C\u8BC1\u5DF2\u4FDD\u5B58\u7684 2.4 Prefab/SceneAsset \u5BF9\u8C61\u8868\u3001\u7236\u5B50/\u7EC4\u4EF6\u5F15\u7528\u4EE5\u53CA\u5E8F\u5217\u5316\u8D44\u6E90 UUID\uFF1B\u4E0D\u8BC1\u660E\u8FD0\u884C\u65F6\u52A0\u8F7D\u3002",
      inputSchema: { type: "object", properties: { target: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 2e3 } }, required: ["target"] }
    },
    {
      name: "run_script_diagnostics",
      description: "\u8FD0\u884C\u5DE5\u7A0B TypeScript noEmit \u9759\u6001\u68C0\u67E5\uFF0C\u8FD4\u56DE\u6587\u4EF6/\u884C\u5217/\u9519\u8BEF\u7801\u548C\u6E90\u7801\u7247\u6BB5\u3002\u9650\u65F630\u79D2\uFF1B\u7F16\u8BD1\u5668\u7F3A\u5931\u660E\u786E\u62A5\u672A\u68C0\u67E5\uFF0C\u4E0D\u8BC1\u660E Creator \u7F16\u8BD1\u6216\u8FD0\u884C\u65F6\u52A0\u8F7D\u3002",
      inputSchema: { type: "object", properties: { tsconfigPath: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 100 }, contextLines: { type: "integer", minimum: 0, maximum: 10 } } }
    },
    {
      name: "check_asset_ready",
      description: "\u53EA\u8BFB\u67E5\u8BE2\u7CBE\u786E\u8D44\u6E90\u7684 UUID/URL/\u7C7B\u578B\u8BB0\u5F55\uFF0C\u8FDE\u7EED\u4E24\u6B21\u4E00\u81F4\u624D\u62A5\u544A ready\uFF1B\u4E0D\u5237\u65B0\u3001\u4E0D\u91CD\u653E\u5199\u5165\uFF0C\u4E0D\u8BC1\u660E\u5BFC\u5165\u961F\u5217\u3001\u6E90\u6587\u4EF6\u5B57\u8282\u3001\u811A\u672C\u7F16\u8BD1\u6216\u8FD0\u884C\u65F6\u5DF2\u5B8C\u6210\u3002",
      inputSchema: { type: "object", properties: { target: { type: "string" }, waitMs: { type: "integer", minimum: 0, maximum: 1e4 } }, required: ["target"] }
    },
    {
      name: "search_project",
      description: `\u5206\u6279\u641C\u7D22\u9879\u76EE\u6587\u4EF6\uFF0C\u652F\u6301 content/file_name/dir_name \u4E0E\u6B63\u5219\u3002\u65E7\u8C03\u7528\u4ECD\u8FD4\u56DE\u6700\u591A500\u6761\u6570\u7EC4\uFF1B\u6307\u5B9A pageSize\u3001cursor \u6216 includeMetadata:true \u65F6\u8FD4\u56DE results/nextCursor/truncated \u548C\u8DF3\u8FC7\u7EDF\u8BA1\u3002\u9ED8\u8BA4\u5185\u5BB9\u6587\u4EF6\u4E0A\u96504MiB\u3001\u884C\u6458\u8981500\u5B57\u7B26\u3001\u626B\u63CF\u9884\u7B9720\u79D2\uFF1B\u65E7\u8C03\u7528\u53D1\u751F\u8DF3\u8FC7\u6216\u8D85\u65F6\u4F1A\u660E\u786E\u62A5\u641C\u7D22\u4E0D\u5B8C\u6574\u3002\u9700\u8981\u5B8C\u6574\u5185\u5BB9\u65F6\u4F7F\u7528\u6587\u4EF6\u8BFB\u53D6\u5DE5\u5177\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "\u641C\u7D22\u5173\u952E\u8BCD\u6216\u6B63\u5219\u8868\u8FBE\u5F0F\u6A21\u5F0F" },
          useRegex: {
            type: "boolean",
            description: "\u662F\u5426\u5C06 query \u89C6\u4E3A\u6B63\u5219\u8868\u8FBE\u5F0F (\u4EC5\u5728 matchType \u4E3A 'content', 'file_name' \u6216 'dir_name' \u65F6\u751F\u6548)"
          },
          path: {
            type: "string",
            description: "\u641C\u7D22\u8D77\u70B9\u8DEF\u5F84\uFF0C\u4F8B\u5982 'db://assets/scripts'\u3002\u9ED8\u8BA4\u4E3A 'db://assets'"
          },
          matchType: {
            type: "string",
            enum: ["content", "file_name", "dir_name"],
            description: "\u5339\u914D\u6A21\u5F0F\uFF1A'content' (\u5185\u5BB9\u5173\u952E\u8BCD/\u6B63\u5219), 'file_name' (\u641C\u7D22\u6587\u4EF6\u540D), 'dir_name' (\u641C\u7D22\u6587\u4EF6\u5939\u540D)"
          },
          extensions: {
            type: "array",
            items: { type: "string" },
            description: "\u9650\u5B9A\u6587\u4EF6\u540E\u7F00 (\u5982 ['.js', '.ts'])\u3002\u4EC5\u5728 matchType \u4E3A 'content' \u6216 'file_name' \u65F6\u6709\u6548\u3002",
            default: [".js", ".ts", ".json", ".fire", ".prefab", ".xml", ".txt", ".md"]
          },
          includeSubpackages: { type: "boolean", default: true, description: "\u662F\u5426\u9012\u5F52\u641C\u7D22\u5B50\u76EE\u5F55" },
          pageSize: { type: "integer", minimum: 1, maximum: 500, description: "\u6BCF\u9875\u7ED3\u679C\u6570\uFF1B\u8BBE\u7F6E\u540E\u8FD4\u56DE\u5305\u542B\u6E38\u6807\u7684\u5BF9\u8C61" },
          cursor: { type: "string", description: "\u4E0A\u4E00\u9875\u7684 nextCursor\uFF1B\u67E5\u8BE2\u6761\u4EF6\u9700\u76F8\u540C\uFF0C\u6587\u4EF6\u53D8\u5316\u540E\u5E94\u91CD\u65B0\u641C\u7D22" },
          includeMetadata: { type: "boolean", description: "\u8FD4\u56DE\u5206\u9875\u3001\u622A\u65AD\u3001\u8D85\u65F6\u4E0E\u8DF3\u8FC7\u6587\u4EF6\u7EDF\u8BA1\uFF1B\u9ED8\u8BA4\u4ECD\u517C\u5BB9\u6570\u7EC4" },
          maxFileBytes: { type: "integer", minimum: 1, maximum: 33554432, description: "\u5185\u5BB9\u641C\u7D22\u7684\u5355\u6587\u4EF6\u5B57\u8282\u4E0A\u9650\uFF0C\u9ED8\u8BA44194304" },
          maxPreviewLength: { type: "integer", minimum: 1, maximum: 1e4, description: "\u5339\u914D\u884C\u7684\u6458\u8981\u5B57\u7B26\u4E0A\u9650\uFF0C\u9ED8\u8BA4500" }
        },
        required: ["query"]
      }
    },
    {
      name: "manage_undo",
      description: `${globalPrecautions} \u7BA1\u7406\u7F16\u8F91\u5668\u7684\u64A4\u9500\u548C\u91CD\u505A\u5386\u53F2`,
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["undo", "redo", "begin_group", "end_group", "cancel_group"],
            description: "\u64CD\u4F5C\u7C7B\u578B"
          },
          description: { type: "string", description: "\u64A4\u9500\u7EC4\u7684\u63CF\u8FF0 (\u7528\u4E8E begin_group)" },
          id: { type: "string", description: "\u5F00\u59CB\u64A4\u9500\u7EC4\u65F6\u53EF\u9009\u7684\u76EE\u6807\u8282\u70B9 UUID\u3002" }
        },
        required: ["action"]
      }
    },
    {
      name: "manage_vfx",
      description: `${globalPrecautions} \u7BA1\u7406\u5168\u573A\u666F\u7279\u6548 (\u7C92\u5B50\u7CFB\u7EDF)\u3002\u91CD\u8981\u63D0\u793A\uFF1A\u5728\u521B\u5EFA\u6216\u66F4\u65B0\u524D\uFF0C\u5FC5\u987B\u901A\u8FC7 get_scene_hierarchy \u6216 manage_components \u786E\u8BA4\u7236\u8282\u70B9\u6216\u76EE\u6807\u8282\u70B9\u7684\u6709\u6548\u6027\u3002\u4E25\u7981\u5BF9\u4E0D\u5B58\u5728\u7684\u5BF9\u8C61\u8FDB\u884C\u64CD\u4F5C\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["create", "update", "get_info"],
            description: "\u64CD\u4F5C\u7C7B\u578B"
          },
          nodeId: { type: "string", description: "\u8282\u70B9 UUID (\u7528\u4E8E update/get_info)" },
          properties: {
            type: "object",
            description: "\u7C92\u5B50\u7CFB\u7EDF\u5C5E\u6027 (\u7528\u4E8E create/update)",
            properties: {
              duration: { type: "number", description: "\u53D1\u5C04\u65F6\u957F" },
              emissionRate: { type: "number", description: "\u53D1\u5C04\u901F\u7387" },
              life: { type: "number", description: "\u751F\u547D\u5468\u671F" },
              lifeVar: { type: "number", description: "\u751F\u547D\u5468\u671F\u53D8\u5316" },
              startColor: { type: "string", description: "\u8D77\u59CB\u989C\u8272 (Hex)" },
              endColor: { type: "string", description: "\u7ED3\u675F\u989C\u8272 (Hex)" },
              startSize: { type: "number", description: "\u8D77\u59CB\u5927\u5C0F" },
              endSize: { type: "number", description: "\u7ED3\u675F\u5927\u5C0F" },
              speed: { type: "number", description: "\u901F\u5EA6" },
              angle: { type: "number", description: "\u89D2\u5EA6" },
              gravity: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } },
              file: { type: "string", description: "\u7C92\u5B50\u6587\u4EF6\u8DEF\u5F84 (plist) \u6216 texture \u8DEF\u5F84" }
            }
          },
          name: { type: "string", description: "\u8282\u70B9\u540D\u79F0 (\u7528\u4E8E create)" },
          parentId: { type: "string", description: "\u7236\u8282\u70B9 ID (\u7528\u4E8E create)" }
        },
        required: ["action"]
      }
    },
    {
      name: "get_sha",
      description: `\u83B7\u53D6\u6307\u5B9A\u6587\u4EF6\u7684 SHA-256 \u54C8\u5E0C\u503C`,
      inputSchema: {
        type: "object",
        properties: {
          path: { type: "string", description: "\u6587\u4EF6\u8DEF\u5F84\uFF0C\u5982 db://assets/scripts/Test.ts" }
        },
        required: ["path"]
      }
    },
    {
      name: "manage_animation",
      description: `${globalPrecautions} \u7BA1\u7406\u8282\u70B9\u7684\u52A8\u753B\u7EC4\u4EF6\u3002\u91CD\u8981\u63D0\u793A\uFF1A\u5728\u6267\u884C play/pause \u7B49\u64CD\u4F5C\u524D\uFF0C\u5FC5\u987B\u5148\u786E\u8BA4\u8282\u70B9\u53CA\u5176 Animation \u7EC4\u4EF6\u5B58\u5728\u3002\u4E25\u7981\u64CD\u4F5C\u7A7A\u5F15\u7528\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          action: {
            type: "string",
            enum: ["get_list", "get_info", "play", "stop", "pause", "resume"],
            description: "\u64CD\u4F5C\u7C7B\u578B"
          },
          nodeId: { type: "string", description: "\u8282\u70B9 UUID" },
          clipName: { type: "string", description: "\u52A8\u753B\u526A\u8F91\u540D\u79F0 (\u7528\u4E8E play)" }
        },
        required: ["action", "nodeId"]
      }
    },
    {
      name: "capture_editor_screenshot",
      description: `\u6355\u83B7\u5F53\u524D\u7F16\u8F91\u5668\u7A97\u53E3\u548C\u573A\u666F\u89C6\u56FE\u7684\u622A\u56FE\u3002\u9ED8\u8BA4\u8FD4\u56DE MCP image\uFF08PNG/JPEG\uFF09\uFF0CresponseMode=text \u517C\u5BB9 DataURL\u3002\u9ED8\u8BA4\u4FDD\u6301\u5F53\u524D\u89C6\u53E3\uFF0C\u6309\u9700\u5C45\u4E2D\u3002\u7528\u4E8E\u5728\u9700\u8981\u5BF9\u573A\u666F\u60C5\u51B5\u6709\u89C6\u89C9\u638C\u63E1\u65F6\u4F7F\u7528\u3002\u7F16\u8F91\u5668\u7A97\u53E3\u6700\u5C0F\u5316\u65F6 capturePage \u53EA\u80FD\u8FD4\u56DE\u8FC7\u671F\u753B\u9762\uFF0C\u56E0\u6B64\u9ED8\u8BA4\u4F1A\u81EA\u52A8\u6062\u590D\u7A97\u53E3\u540E\u518D\u622A\u56FE\uFF1B\u4F20 restoreWindow: false \u5219\u4E0D\u6539\u52A8\u7A97\u53E3\u72B6\u6001\u3001\u76F4\u63A5\u62A5\u9519\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          forceFresh: { type: "boolean" },
          centerViewport: { type: "boolean" },
          includeMetadata: { type: "boolean", description: "\u540C\u65F6\u8FD4\u56DE captureId\u3001\u6355\u83B7\u65F6\u95F4\u3001\u7F13\u5B58\u5E74\u9F84\u53CA\u5750\u6807\u51E0\u4F55\uFF1B\u914D\u5408 forceFresh:true \u6821\u9A8C\u5F53\u524D\u753B\u9762\u3002\u5750\u6807\u662F\u7F16\u8F91\u5668\u7A97\u53E3\u5750\u6807\uFF0C\u4E0D\u662F Cocos \u4E16\u754C\u5750\u6807\u3002" },
          maxWidth: { type: "integer", minimum: 64, maximum: 4096 },
          format: { type: "string", enum: ["png", "jpeg"] },
          quality: { type: "integer", minimum: 1, maximum: 100 },
          crop: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" }, width: { type: "integer" }, height: { type: "integer" } }, required: ["x", "y", "width", "height"] },
          restoreWindow: { type: "boolean", description: "\u7A97\u53E3\u6700\u5C0F\u5316\u65F6\u662F\u5426\u81EA\u52A8\u6062\u590D\u540E\u518D\u622A\u56FE\uFF0C\u9ED8\u8BA4 true\uFF1Bfalse \u8868\u793A\u4FDD\u6301\u7A97\u53E3\u72B6\u6001\u5E76\u8FD4\u56DE\u9519\u8BEF\uFF0C\u907F\u514D\u62FF\u5230\u8FC7\u671F\u753B\u9762" },
          responseMode: { type: "string", enum: ["image", "text"] }
        }
      }
    },
    {
      name: "resolve_capture_coordinates",
      description: "\u628A\u6307\u5B9A\u65B0\u622A\u56FE\u4E2D\u7684\u50CF\u7D20\u5750\u6807\u6620\u5C04\u5230 Electron \u7A97\u53E3\u5185\u5BB9\u5750\u6807\u3002\u5148\u622A\u56FE includeMetadata:true \u83B7\u53D6 captureId\uFF1B\u7A97\u53E3/\u7F29\u653E\u53D8\u5316\u3001MCP\u5199\u5165\u6216\u8D85\u8FC760\u79D2\u5C06\u62D2\u7EDD\u3002\u53EA\u505A\u5750\u6807\u8BA1\u7B97\uFF0C\u4E0D\u70B9\u51FB\uFF0C\u4E5F\u4E0D\u4FDD\u8BC1\u573A\u666F\u5185\u5BB9\u672A\u53D8\u5316\u3002",
      inputSchema: { type: "object", properties: {
        captureId: { type: "string" },
        points: {
          type: "array",
          minItems: 1,
          maxItems: 100,
          items: { type: "object", properties: { x: { type: "number", minimum: 0 }, y: { type: "number", minimum: 0 } }, required: ["x", "y"] }
        }
      }, required: ["captureId", "points"] }
    },
    {
      name: "inspect_asset_dependencies",
      description: "\u53EA\u8BFB\u68C0\u67E5\u5F53\u524D assets \u4E2D prefab/fire/anim/mtl/json \u7684\u5E8F\u5217\u5316 __uuid__ \u4F9D\u8D56\uFF0C\u8FD4\u56DE\u5F15\u7528\u4F4D\u7F6E\u3001UUID\u3001AssetDB URL \u548C\u7F3A\u5931\u9879\uFF1Bcomplete:false \u4E0D\u80FD\u4F5C\u4E3A\u6821\u9A8C\u901A\u8FC7\uFF0C\u4E0D\u9A8C\u8BC1\u8FD0\u884C\u65F6\u52A8\u6001\u52A0\u8F7D\u6216\u8D44\u6E90\u5206\u5305\u89C4\u5219\u3002",
      inputSchema: { type: "object", properties: {
        target: { type: "string", description: "\u8D44\u6E90 UUID \u6216 db://assets/ \u6587\u4EF6 URL" },
        limit: { type: "integer", minimum: 1, maximum: 2e3, description: "\u68C0\u67E5\u4E0D\u540C\u4F9D\u8D56\u7684\u4E0A\u9650\uFF0C\u9ED8\u8BA4500" }
      }, required: ["target"] }
    },
    {
      name: "find_references",
      description: `\u67E5\u627E\u5F53\u524D\u573A\u666F\u4E2D\u5F15\u7528\u4E86\u6307\u5B9A\u8282\u70B9\u6216\u8D44\u6E90\u7684\u6240\u6709\u4F4D\u7F6E\u3002\u8FD4\u56DE\u5F15\u7528\u6240\u5728\u8282\u70B9\u3001\u7EC4\u4EF6\u7C7B\u578B\u3001\u5C5E\u6027\u540D\u7B49\u8BE6\u7EC6\u4FE1\u606F\u3002\u652F\u6301\u67E5\u627E\u8282\u70B9\u5F15\u7528\uFF08cc.Node\uFF09\u548C\u8D44\u6E90\u5F15\u7528\uFF08cc.Prefab, cc.SpriteFrame, sp.SkeletonData \u7B49\uFF09\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          scopeNodeId: { type: "string" },
          pageSize: { type: "integer", minimum: 1, maximum: 500 },
          cursor: { type: "string" },
          maxVisited: { type: "integer", minimum: 1, maximum: 5e4 },
          maxTimeMs: { type: "integer", minimum: 1, maximum: 3e3 },
          includeMetadata: { type: "boolean" },
          targetId: { type: "string", description: "\u8981\u67E5\u627E\u5F15\u7528\u7684\u76EE\u6807 UUID\uFF08\u8282\u70B9 UUID \u6216\u8D44\u6E90 UUID\uFF09" },
          targetType: {
            type: "string",
            enum: ["node", "asset", "auto"],
            description: "\u76EE\u6807\u7C7B\u578B\u3002'node' \u67E5\u627E\u8282\u70B9\u5F15\u7528\uFF0C'asset' \u67E5\u627E\u8D44\u6E90\u5F15\u7528\uFF0C'auto' (\u9ED8\u8BA4) \u81EA\u52A8\u68C0\u6D4B"
          }
        },
        required: ["targetId"]
      }
    },
    {
      name: "build_project",
      description: `${globalPrecautions} \u6784\u5EFA\u5E76\u5BFC\u51FA Cocos \u9879\u76EE\uFF0C\u901A\u8FC7 Editor.Builder.build \u7684\u7EC8\u6001\u56DE\u8C03\u8DDF\u8E2A\u7ED3\u679C\u3002platform \u4F7F\u7528\u5177\u4F53\u6E20\u9053\u540D\uFF08bytedance\u3001wechatgame\u3001taobao-minigame\u3001web-mobile\uFF09\uFF0C\u5185\u90E8\u9002\u914D Creator 2.4 \u5206\u7EC4\u53C2\u6570\u3002start \u8FD4\u56DE building \u53EA\u8868\u793A\u8BF7\u6C42\u5DF2\u63A5\u53D7\uFF0C\u9700\u7528 status \u67E5\u8BE2\u5B8C\u6210\u72B6\u6001\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["start", "status"] },
          jobId: { type: "string", description: "action=status \u67E5\u8BE2\u4EFB\u52A1\u7EC8\u6001\uFF0Cbuilding \u4EC5\u4EE3\u8868\u5DF2\u63A5\u53D7\uFF0C\u4E0D\u80FD\u5F53\u4F5C\u5B8C\u6210" },
          platform: { type: "string", description: "\u6784\u5EFA\u5E73\u53F0\u30022.4 \u4E00\u7EA7\u5E73\u53F0\u5982 web-mobile / wechatgame / bytedance\uFF1B\u52FF\u4F20 mini-game\uFF08\u4F1A\u88AB\u6298\u53E0\u4E3A\u5177\u4F53\u5E73\u53F0\uFF09" },
          debug: { type: "boolean", description: "\u662F\u5426\u6784\u5EFA\u8C03\u8BD5\u7248" }
        },
        required: []
      }
    },
    {
      name: "get_project_info",
      description: `\u83B7\u53D6\u5F53\u524D\u9879\u76EE\u7684\u5B8F\u89C2\u4FE1\u606F\uFF0C\u4F8B\u5982\u5F15\u64CE\u7248\u672C\u3001\u6839\u76EE\u5F55\u3001\u5F53\u524D\u6253\u5F00\u7684\u573A\u666F\u7B49\u3002`,
      inputSchema: { type: "object", properties: {
        includeEditState: { type: "boolean", description: "\u8BFB\u53D6\u5F53\u524D\u7F16\u8F91\u6A21\u5F0F\u548C\u8D44\u6E90\u8EAB\u4EFD" },
        includeMcpDiagnostics: { type: "boolean", description: "\u53EA\u8BFB\u8BCA\u65AD\uFF1A\u8FD4\u56DE\u4EE3\u7406\u3001\u7F16\u8F91\u5668\u63D2\u4EF6\u3001\u573A\u666F\u811A\u672C\u5B9E\u9645\u52A0\u8F7D\u7684\u7248\u672C\u3001\u6784\u5EFAID\u3001\u8FDB\u7A0B\u548C\u8DEF\u7531\u8BA1\u6570\uFF0C\u5E76\u62A5\u544A\u4E0D\u4E00\u81F4\u6216\u7F3A\u5931\u3002\u7F16\u8F91\u5668\u79BB\u7EBF\u6216\u5DE5\u7A0B\u672A\u552F\u4E00\u786E\u5B9A\u65F6\uFF0C\u4EE3\u7406\u4ECD\u8FD4\u56DE\u81EA\u8EAB\u8BCA\u65AD\u53CA\u8FDE\u63A5\u539F\u56E0\u3002\u9ED8\u8BA4\u4E0D\u589E\u52A0\u8BCA\u65AD\u5B57\u6BB5\u3002" }
      } }
    },
    {
      name: "inspect_builder_targets",
      description: `${globalPrecautions}\u3010\u53EA\u8BFB\u8BCA\u65AD\u3011\u68C0\u67E5\u7F16\u8F91\u5668\u8FD0\u884C\u65F6\u5F15\u64CE\u6784\u5EFA\u5668\uFF08Editor.Builder\uFF09\u652F\u6301\u7684\u6784\u5EFA\u5E73\u53F0\u5217\u8868\u53CA\u7ED3\u6784\u3002\u8FD4\u56DE simpleBuildTargets \u7684\u952E\u3001Editor.Builder \u66B4\u9732\u7684\u5C5E\u6027\u540D\u3001build/buildProject \u662F\u5426\u5B58\u5728\uFF0C\u4EE5\u53CA builder:query-build-options \u8FD4\u56DE\u7684 platform/actualPlatform\u3002\u7528\u4E8E\u6392\u67E5 builder:start-task \u62A5 isNative of undefined \u7684\u95EE\u9898\u3002`,
      inputSchema: { type: "object", properties: {} }
    },
    {
      name: "modify_prefab_offline",
      description: `\u3010\u79BB\u7EBF\u9AD8\u6548\u9884\u5236\u4F53\u4FEE\u6539\u3011\u5728\u4E0D\u6253\u5F00\u7F16\u8F91\u5668\u9884\u5236\u4F53\u7A97\u53E3\u7684\u60C5\u51B5\u4E0B\uFF0C\u76F4\u63A5\u901A\u8FC7\u5E95\u5C42\u7684 JSON \u7ED3\u6784\u4FEE\u6539\u9884\u5236\u4F53\u6570\u636E\uFF0C\u5E76\u5237\u65B0 AssetDB\u3002\u652F\u6301 update_property, add_component, remove_component, add_node, remove_node, clone_node, reorder_child, set_reference \u64CD\u4F5C\u3002\u5982\u679C\u9884\u5236\u4F53\u6587\u4EF6\u672C\u8EAB\u4E0D\u5B58\u5728\u4E14\u7B2C\u4E00\u4E2A\u57FA\u52A8\u4F5C\u4E3A add_node \u4E14 targetPath \u4E3A\u7A7A\uFF0C\u5219\u5DE5\u5177\u5C06\u65E0\u4E2D\u751F\u6709\u81EA\u52A8\u521D\u59CB\u5316\u7A7A\u9884\u5236\u4F53\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          prefabUrl: { type: "string", description: "\u9884\u5236\u4F53\u5728\u9879\u76EE\u4E2D\u7684\u76F8\u5BF9\u8DEF\u5F84\uFF0C\u5982 db://assets/prefabs/MyPrefab.prefab" },
          operations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: { type: "string", enum: ["update_property", "add_component", "remove_component", "add_node", "remove_node", "clone_node", "reorder_child", "set_reference"] },
                targetPath: { type: "string", description: "\u8282\u70B9\u76F8\u5BF9\u6839\u8282\u70B9\u7684\u67E5\u627E\u8DEF\u5F84\uFF0C\u7528 '/' \u5206\u5272\uFF0C\u5982 'Root/Body/Label'\u3002\u5BF9\u4E8E add_node \u8FD9\u662F\u7236\u8282\u70B9\u7684\u8DEF\u5F84\u3002" },
                componentType: { type: "string", description: "\u7EC4\u4EF6\u7C7B\u540D\uFF0C\u5728\u589E\u5220\u6539\u67E5\u7EC4\u4EF6\u65F6\u4F20\u5165\uFF0C\u5982 'cc.Label'\u3002\u4FEE\u6539\u8282\u70B9\u81EA\u8EAB\u5C5E\u6027\u65F6\u4E0D\u4F20\u3002" },
                properties: { type: "object", description: "\u5C5E\u6027\u952E\u503C\u5BF9 (update_property/add_component \u5C5E\u6027\u503C)" },
                nodeName: { type: "string", description: "\u65B0\u8282\u70B9\u6216\u514B\u9686\u540E\u8282\u70B9\u7684\u540D\u79F0 (add_node/clone_node \u4F7F\u7528)" },
                newParentPath: { type: "string", description: "\u514B\u9686\u8282\u70B9\u8981\u6302\u8F7D\u7684\u7236\u8282\u70B9\u76F8\u5BF9\u8DEF\u5F84\uFF0C\u4E0D\u4F20\u9ED8\u8BA4\u6302\u5728\u540C\u7EA7 (clone_node \u4F7F\u7528)" },
                childOrder: { type: "array", items: { type: "string" }, description: "\u5B50\u8282\u70B9\u540D\u79F0\u6392\u5E8F\u6570\u7EC4 (reorder_child \u4F7F\u7528)" },
                propertyName: { type: "string", description: "\u8981\u7ED1\u5B9A\u5F15\u7528\u7684\u7EC4\u4EF6\u5C5E\u6027\u540D (set_reference \u4F7F\u7528)" },
                referenceValue: {
                  type: "object",
                  description: "\u7ED1\u5B9A\u7684\u5F15\u7528\u7684\u76EE\u6807\u503C (set_reference \u4F7F\u7528)",
                  properties: {
                    uuid: { type: "string", description: "\u5916\u90E8\u8D44\u6E90\u7684 UUID" },
                    path: { type: "string", description: "\u8981\u5173\u8054\u5F15\u7528\u7684\u9884\u5236\u4F53\u5185\u90E8\u8282\u70B9\u7684\u8DEF\u5F84" },
                    componentType: { type: "string", description: "\u8981\u5173\u8054\u5F15\u7528\u7684\u7279\u5B9A\u7EC4\u4EF6\u7C7B\u540D\uFF0C\u82E5\u7ED1\u5B9A\u8282\u70B9\u672C\u8EAB\u5219\u7559\u7A7A" }
                  }
                }
              },
              required: ["action"]
            }
          }
        },
        required: ["prefabUrl", "operations"]
      }
    },
    {
      name: "modify_scene_offline",
      description: `\u3010\u79BB\u7EBF\u9AD8\u6548\u573A\u666F\u4FEE\u6539\u3011\u5728\u4E0D\u6253\u5F00\u7F16\u8F91\u5668\u573A\u666F\u7A97\u53E3\u7684\u60C5\u51B5\u4E0B\uFF0C\u76F4\u63A5\u901A\u8FC7\u5E95\u5C42\u7684 JSON \u7ED3\u6784\u4FEE\u6539\u573A\u666F\u6570\u636E\uFF0C\u5E76\u5237\u65B0 AssetDB\u3002\u652F\u6301 update_property, add_component, remove_component, add_node, remove_node, clone_node, reorder_child, set_reference \u64CD\u4F5C\u3002\u4E0E modify_prefab_offline \u5171\u4EAB\u5B8C\u5168\u76F8\u540C\u7684 operations \u53C2\u6570\u7ED3\u6784\u3002\u5982\u679C\u573A\u666F\u6587\u4EF6\u4E0D\u5B58\u5728\u4E14\u7B2C\u4E00\u4E2A\u64CD\u4F5C\u4E3A add_node \u4E14 targetPath \u4E3A\u7A7A\uFF0C\u5219\u81EA\u52A8\u521B\u5EFA\u7A7A\u573A\u666F\u3002\u6CE8\u610F\uFF1A\u573A\u666F\u4E2D\u65B0\u589E\u7684\u8282\u70B9\u4E0D\u4F1A\u643A\u5E26 PrefabInfo\u3002`,
      inputSchema: {
        type: "object",
        properties: {
          sceneUrl: { type: "string", description: "\u573A\u666F\u5728\u9879\u76EE\u4E2D\u7684\u76F8\u5BF9\u8DEF\u5F84\uFF0C\u5982 db://assets/scenes/MyScene.fire" },
          operations: {
            type: "array",
            items: {
              type: "object",
              properties: {
                action: { type: "string", enum: ["update_property", "add_component", "remove_component", "add_node", "remove_node", "clone_node", "reorder_child", "set_reference"] },
                targetPath: { type: "string", description: "\u8282\u70B9\u76F8\u5BF9\u6839\u8282\u70B9\u7684\u67E5\u627E\u8DEF\u5F84\uFF0C\u7528 '/' \u5206\u5272\uFF0C\u5982 'Canvas/Body/Label'\u3002\u573A\u666F\u4E2D\u5BFB\u8DEF\u8D77\u70B9\u4E3A cc.Scene \u865A\u62DF\u8282\u70B9\uFF0C\u76F4\u63A5\u4F20 'Canvas' \u5373\u53EF\u5B9A\u4F4D\u5230 Canvas \u8282\u70B9\u3002" },
                componentType: { type: "string", description: "\u7EC4\u4EF6\u7C7B\u540D\uFF0C\u5982 'cc.Label'" },
                properties: { type: "object", description: "\u5C5E\u6027\u952E\u503C\u5BF9" },
                nodeName: { type: "string", description: "\u65B0\u8282\u70B9\u6216\u514B\u9686\u540E\u8282\u70B9\u7684\u540D\u79F0" },
                newParentPath: { type: "string", description: "\u514B\u9686\u8282\u70B9\u8981\u6302\u8F7D\u7684\u7236\u8282\u70B9\u8DEF\u5F84" },
                childOrder: { type: "array", items: { type: "string" }, description: "\u5B50\u8282\u70B9\u540D\u79F0\u6392\u5E8F\u6570\u7EC4" },
                propertyName: { type: "string", description: "\u8981\u7ED1\u5B9A\u5F15\u7528\u7684\u7EC4\u4EF6\u5C5E\u6027\u540D" },
                referenceValue: {
                  type: "object",
                  description: "\u7ED1\u5B9A\u7684\u5F15\u7528\u76EE\u6807\u503C",
                  properties: {
                    uuid: { type: "string", description: "\u5916\u90E8\u8D44\u6E90\u7684 UUID" },
                    path: { type: "string", description: "\u5185\u90E8\u8282\u70B9\u8DEF\u5F84" },
                    componentType: { type: "string", description: "\u7279\u5B9A\u7EC4\u4EF6\u7C7B\u540D" }
                  }
                }
              },
              required: ["action"]
            }
          }
        },
        required: ["sceneUrl", "operations"]
      }
    }
  ];
  return [...base, ...granularTools(base), ...scriptToolDefinitions(), ...sceneCapabilityDefinitions(), ...projectFileDefinitions(), ...editorCapabilityDefinitions()].map((tool) => capabilityMetadata({ ...tool, inputSchema: {
    ...tool.inputSchema,
    properties: { ...tool.inputSchema.properties, expected_context: { type: "string", description: "\u72EC\u7ACB\u6838\u5BF9\u9879\u76EE\u540E\u53D6\u5F97\u7684\u5B9E\u4F8B\u51ED\u8BC1\uFF1B\u7F16\u8F91\u5668\u91CD\u8F7D\u540E\u987B\u91CD\u65B0\u7ED1\u5B9A" } }
  } }));
};

// src/tools/ToolPresetStore.ts
var fs4 = __toESM(require("fs"));
var path3 = __toESM(require("path"));

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

// src/tools/ToolPresetStore.ts
var filename = "mcp-tool-presets.json";
function validateToolPresets(value, tools) {
  if (!value || value.version !== 1 || !Array.isArray(value.presets) || !value.presets.length || value.presets.length > 20) throw new Error("\u9700\u8981 version=1 \u548C 1\u201320 \u4E2A\u5DE5\u5177\u9884\u8BBE");
  const names = /* @__PURE__ */ new Set();
  const presets = value.presets.map((item) => {
    if (!item || typeof item.name !== "string" || !item.name.trim() || item.name.length > 48 || /[\x00-\x1f]/.test(item.name) || names.has(item.name)) throw new Error("\u9884\u8BBE\u540D\u79F0\u9700\u8981\u552F\u4E00\u4E14\u4E0D\u8D85\u8FC748\u5B57");
    names.add(item.name);
    for (const key of ["enabled", "disabled"]) if (!Array.isArray(item[key]) || item[key].length > 200 || item[key].some((name) => typeof name !== "string" || !tools.some((tool) => tool.name === name))) throw new Error(`${item.name}: \u5DE5\u5177\u540D\u79F0\u65E0\u6548`);
    const preset = { name: item.name, profile: item.profile, enabled: [...new Set(item.enabled)], disabled: [...new Set(item.disabled)], ...item.actions !== void 0 ? { actions: item.actions } : {} };
    selectToolProfile(tools, presetEnvironment(preset));
    return preset;
  });
  if (!names.has(value.active)) throw new Error("\u5F53\u524D\u9884\u8BBE\u4E0D\u5B58\u5728");
  return { version: 1, active: value.active, presets };
}
function presetEnvironment(item) {
  return { MCP_BRIDGE_TOOL_PROFILE: item.profile, MCP_BRIDGE_ENABLED_TOOLS: item.enabled.join(","), MCP_BRIDGE_DISABLED_TOOLS: item.disabled.join(","), MCP_BRIDGE_TOOL_ACTIONS: JSON.stringify(item.actions || {}) };
}
function readToolPresets(project, tools) {
  const file = project && path3.join(project, "settings", filename);
  if (!file || !fs4.existsSync(file)) return { version: 1, active: "\u5168\u90E8", presets: [
    { name: "\u5168\u90E8", profile: "full", enabled: [], disabled: [] },
    { name: "UI", profile: "ui", enabled: [], disabled: [] }
  ] };
  if (fs4.statSync(file).size > 128 * 1024) throw new Error("\u5DE5\u5177\u9884\u8BBE\u6587\u4EF6\u8D85\u8FC7128KiB");
  return validateToolPresets(JSON.parse(fs4.readFileSync(file, "utf8")), tools);
}
function configuredTools(project, tools, env = typeof process === "undefined" ? {} : process.env || {}) {
  const state = readToolPresets(project, tools);
  const merged = presetEnvironment(state.presets.find((item) => item.name === state.active));
  for (const key of Object.keys(merged)) if (env[key] !== void 0) merged[key] = env[key];
  return selectToolProfile(tools, merged);
}

// src/utils/proxyDiscovery.ts
var fs5 = __toESM(require("fs"));
var pathModule2 = __toESM(require("path"));
function isValidPort(port) {
  return typeof port === "number" && Number.isInteger(port) && port > 0 && port < 65536;
}
function collectScanPorts(start, end, extraPorts) {
  const seen = /* @__PURE__ */ new Set();
  const ports = [];
  const add = (p) => {
    if (!isValidPort(p) || seen.has(p)) return;
    seen.add(p);
    ports.push(p);
  };
  for (let p = start; p <= end; p++) {
    add(p);
  }
  if (extraPorts) {
    for (const p of extraPorts) {
      add(p);
    }
  }
  return ports;
}
function readLastPortFromSettings(raw) {
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    const port = Number(data["last-port"]);
    return isValidPort(port) ? port : null;
  } catch (e) {
    return null;
  }
}
function resolveProjectRootFromProxyDir(proxyDir) {
  const projectRoot = pathModule2.resolve(proxyDir, "..", "..", "..");
  const settingsFile = pathModule2.join(projectRoot, "settings", "mcp-bridge.json");
  if (fs5.existsSync(settingsFile)) return projectRoot;
  return null;
}

// src/mcp-proxy.ts
var COCOS_PORT = parseInt(process.env.MCP_BRIDGE_PORT || process.argv[2] || "8200", 10);
var globalActivePort = null;
var activeProjectPath = null;
var activeInstancePin = null;
var routingStats = { statusProbes: 0, fullScans: 0, monitorProbes: 0, coalescedProbes: 0, monitorDelayMs: 5e3, lastRoute: "unbound" };
var pendingProbes = /* @__PURE__ */ new Map();
var scanInFlight = null;
var lastActivity = Date.now();
var offlineRounds = 0;
var monitorRound = 0;
var START_PORT = 8200;
var END_PORT = 8210;
var configuredProjectPath = process.env.MCP_BRIDGE_PROJECT_PATH || null;
var COCOS_HOST = process.env.MCP_BRIDGE_HOST || "127.0.0.1";
var cachedProjectPath = configuredProjectPath;
var bundledProjectRoot = resolveProjectRootFromProxyDir(__dirname);
if (!cachedProjectPath && bundledProjectRoot) {
  cachedProjectPath = bundledProjectRoot;
}
function getScanPorts() {
  const extras = [];
  if (COCOS_PORT) extras.push(COCOS_PORT);
  if (globalActivePort) extras.push(globalActivePort);
  const projectRoot = bundledProjectRoot || cachedProjectPath;
  if (projectRoot) {
    try {
      const raw = fs6.readFileSync(pathModule3.join(projectRoot, "settings", "mcp-bridge.json"), "utf8");
      const lastPort = readLastPortFromSettings(raw);
      if (lastPort) extras.push(lastPort);
    } catch (e) {
    }
  }
  return collectScanPorts(START_PORT, END_PORT, extras);
}
var operationsSchema = {
  type: "array",
  items: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "update_property",
          "add_component",
          "remove_component",
          "add_node",
          "remove_node",
          "clone_node",
          "reorder_child",
          "set_reference"
        ]
      },
      targetPath: { type: "string", description: "\u8282\u70B9\u76F8\u5BF9\u6839\u8282\u70B9\u7684\u67E5\u627E\u8DEF\u5F84" },
      componentType: { type: "string", description: "\u7EC4\u4EF6\u7C7B\u540D\uFF0C\u5982 'cc.Label'" },
      properties: { type: "object", description: "\u5C5E\u6027\u952E\u503C\u5BF9" },
      nodeName: { type: "string", description: "\u65B0\u8282\u70B9\u6216\u514B\u9686\u540E\u8282\u70B9\u7684\u540D\u79F0" },
      newParentPath: { type: "string", description: "\u514B\u9686\u8282\u70B9\u8981\u6302\u8F7D\u7684\u7236\u8282\u70B9\u8DEF\u5F84" },
      childOrder: { type: "array", items: { type: "string" }, description: "\u5B50\u8282\u70B9\u540D\u79F0\u6392\u5E8F\u6570\u7EC4" },
      propertyName: { type: "string", description: "\u8981\u7ED1\u5B9A\u5F15\u7528\u7684\u7EC4\u4EF6\u5C5E\u6027\u540D\u3002\u652F\u6301\u6570\u7EC4\u7D22\u5F15\u8BED\u6CD5\u5982 clickEvents[0].target" },
      elementType: { type: "string", description: "\u6570\u7EC4\u5143\u7D20\u7C7B\u578B\uFF0C\u7528\u4E8E\u81EA\u52A8\u521B\u5EFA\u5D4C\u5957\u6570\u7EC4\u4E2D\u7684\u5F15\u7528\u5BF9\u8C61\uFF08\u5982 cc.ClickEvent\uFF09\u3002\u4E0E propertyName \u7684\u6570\u7EC4\u7D22\u5F15\u8BED\u6CD5\u914D\u5408\u4F7F\u7528" },
      referenceValue: {
        type: "object",
        description: "\u7ED1\u5B9A\u7684\u5F15\u7528\u7684\u76EE\u6807\u503C",
        properties: {
          uuid: { type: "string", description: "\u5916\u90E8\u8D44\u6E90\u7684 UUID" },
          path: { type: "string", description: "\u5185\u90E8\u8282\u70B9\u8DEF\u5F84" },
          componentType: { type: "string", description: "\u7279\u5B9A\u7EC4\u4EF6\u7C7B\u540D" }
        }
      }
    },
    required: ["action"]
  }
};
var OFFLINE_TOOLS = [
  {
    name: "modify_prefab_offline",
    description: `\u3010\u79BB\u7EBF\u9AD8\u6548\u9884\u5236\u4F53\u4FEE\u6539\u3011\u5728\u4E0D\u6253\u5F00\u7F16\u8F91\u5668\u9884\u5236\u4F53\u7A97\u53E3\u7684\u60C5\u51B5\u4E0B\uFF0C\u76F4\u63A5\u901A\u8FC7\u5E95\u5C42\u7684 JSON \u7ED3\u6784\u4FEE\u6539\u9884\u5236\u4F53\u6570\u636E\uFF0C\u5E76\u5237\u65B0 AssetDB\u3002\u652F\u6301 update_property, add_component, remove_component, add_node, remove_node, clone_node, reorder_child, set_reference \u64CD\u4F5C\u3002\u5982\u679C\u9884\u5236\u4F53\u6587\u4EF6\u672C\u8EAB\u4E0D\u5B58\u5728\u4E14\u7B2C\u4E00\u4E2A\u57FA\u52A8\u4F5C\u4E3A add_node \u4E14 targetPath \u4E3A\u7A7A\uFF0C\u5219\u5DE5\u5177\u5C06\u65E0\u4E2D\u751F\u6709\u81EA\u52A8\u521D\u59CB\u5316\u7A7A\u9884\u5236\u4F53\u3002`,
    inputSchema: {
      type: "object",
      properties: {
        prefabUrl: { type: "string", description: "\u9884\u5236\u4F53\u5728\u9879\u76EE\u4E2D\u7684\u76F8\u5BF9\u8DEF\u5F84\uFF0C\u5982 db://assets/prefabs/MyPrefab.prefab" },
        operations: operationsSchema
      },
      required: ["prefabUrl", "operations"]
    }
  },
  {
    name: "modify_scene_offline",
    description: `\u3010\u79BB\u7EBF\u9AD8\u6548\u573A\u666F\u4FEE\u6539\u3011\u5728\u4E0D\u6253\u5F00\u7F16\u8F91\u5668\u573A\u666F\u7A97\u53E3\u7684\u60C5\u51B5\u4E0B\uFF0C\u76F4\u63A5\u901A\u8FC7\u5E95\u5C42\u7684 JSON \u7ED3\u6784\u4FEE\u6539\u573A\u666F\u6570\u636E\uFF0C\u5E76\u5237\u65B0 AssetDB\u3002\u652F\u6301 update_property, add_component, remove_component, add_node, remove_node, clone_node, reorder_child, set_reference \u64CD\u4F5C\u3002\u4E0E modify_prefab_offline \u5171\u4EAB\u5B8C\u5168\u76F8\u540C\u7684 operations \u53C2\u6570\u7ED3\u6784\u3002\u5982\u679C\u573A\u666F\u6587\u4EF6\u4E0D\u5B58\u5728\u4E14\u7B2C\u4E00\u4E2A\u64CD\u4F5C\u4E3A add_node \u4E14 targetPath \u4E3A\u7A7A\uFF0C\u5219\u81EA\u52A8\u521B\u5EFA\u7A7A\u573A\u666F\u3002\u6CE8\u610F\uFF1A\u573A\u666F\u4E2D\u65B0\u589E\u7684\u8282\u70B9\u4E0D\u4F1A\u643A\u5E26 PrefabInfo\u3002`,
    inputSchema: {
      type: "object",
      properties: {
        sceneUrl: { type: "string", description: "\u573A\u666F\u5728\u9879\u76EE\u4E2D\u7684\u76F8\u5BF9\u8DEF\u5F84\uFF0C\u5982 db://assets/scenes/MyScene.fire" },
        operations: operationsSchema
      },
      required: ["sceneUrl", "operations"]
    }
  }
];
var OFFLINE_TOOL_NAMES = new Set(OFFLINE_TOOLS.map((t) => t.name));
var ALL_PROXY_TOOLS = [
  ...OFFLINE_TOOLS,
  ...getToolsList().filter((tool) => !OFFLINE_TOOL_NAMES.has(tool.name)),
  {
    name: "get_active_instances",
    description: "Scan local MCP Bridge ports (8200-8210 plus project last-port / MCP_BRIDGE_PORT) to find running Cocos Creator instances.",
    inputSchema: { type: "object", properties: {
      includeMcpDiagnostics: { type: "boolean", description: "\u540C\u65F6\u8FD4\u56DE\u5B9E\u4F8B\u5217\u8868\u548C\u4E09\u4FA7\u6784\u5EFA\u8BCA\u65AD\uFF1B\u79BB\u7EBF\u6216\u5DE5\u7A0B\u672A\u552F\u4E00\u786E\u5B9A\u65F6\u4ECD\u8FD4\u56DE\u4EE3\u7406\u8BCA\u65AD\u3002\u9ED8\u8BA4\u4FDD\u6301\u5B9E\u4F8B\u6570\u7EC4\u54CD\u5E94\u3002" }
    } }
  },
  {
    name: "set_active_instance",
    description: "Manually bind the MCP client to a specific Cocos Creator instance's port. Call this before using other tools when multiple instances are running.",
    inputSchema: { type: "object", properties: { port: { description: "The port number of the target instance to connect to.", type: "number" }, projectPath: { type: "string", description: "\u72EC\u7ACB\u786E\u8BA4\u7684\u5DE5\u7A0B\u7EDD\u5BF9\u8DEF\u5F84\uFF1B\u4E0D\u5339\u914D\u65F6\u62D2\u7EDD\u7ED1\u5B9A" } }, required: ["port"] }
  }
];
var PROXY_TOOLS = configuredTools(configuredProjectPath || bundledProjectRoot, ALL_PROXY_TOOLS);
function refreshProxyTools() {
  const next = configuredTools(configuredProjectPath || activeProjectPath || bundledProjectRoot, ALL_PROXY_TOOLS);
  const signature = (tools) => JSON.stringify(tools.map((tool) => {
    var _a, _b;
    return [tool.name, (_b = (_a = tool.inputSchema.properties) == null ? void 0 : _a.action) == null ? void 0 : _b.enum];
  }));
  if (signature(next) !== signature(PROXY_TOOLS)) {
    PROXY_TOOLS = next;
    if (clientReady && !connectionClosed) sendToAI({ jsonrpc: "2.0", method: "notifications/tools/list_changed" });
  }
}
function resolveDbUrl(url) {
  if (!cachedProjectPath) {
    throw new Error(
      `\u65E0\u6CD5\u89E3\u6790\u8DEF\u5F84 "${url}"\uFF0C\u56E0\u4E3A\u5C1A\u672A\u68C0\u6D4B\u5230 Cocos Creator \u9879\u76EE\u8DEF\u5F84\u3002
\u89E3\u51B3\u529E\u6CD5\uFF1A\u2460 \u542F\u52A8 Cocos Creator \u7F16\u8F91\u5668\u5E76\u786E\u4FDD MCP \u63D2\u4EF6\u7684 HTTP \u670D\u52A1\u5DF2\u5F00\u542F\uFF1B
\u2461 \u6216\u5728\u542F\u52A8\u4EE3\u7406\u524D\u8BBE\u7F6E\u73AF\u5883\u53D8\u91CF MCP_BRIDGE_PROJECT_PATH=C:/\u4F60\u7684\u9879\u76EE\u8DEF\u5F84\u3002`
    );
  }
  const target = url.startsWith("db://") ? pathModule3.resolve(cachedProjectPath, url.replace(/^db:\/\//, "")) : pathModule3.resolve(url);
  const relative2 = pathModule3.relative(pathModule3.join(cachedProjectPath, "assets"), target);
  if (!relative2 || relative2 === ".." || relative2.startsWith(".." + pathModule3.sep) || pathModule3.isAbsolute(relative2)) {
    throw new Error("\u79BB\u7EBF\u7F16\u8F91\u8DEF\u5F84\u5FC5\u987B\u4F4D\u4E8E\u7ED1\u5B9A\u5DE5\u7A0B\u7684 assets \u5185");
  }
  return target;
}
var observedInstances = /* @__PURE__ */ new Map();
var clientReady = false;
var connectionClosed = false;
var connectionState;
var connectionTimer;
function queryInstance(p, background = false) {
  if (pendingProbes.has(p)) {
    routingStats.coalescedProbes++;
    return pendingProbes.get(p);
  }
  if (background) routingStats.monitorProbes++;
  else routingStats.statusProbes++;
  const pending = new Promise((resolve4) => {
    const options = {
      hostname: COCOS_HOST,
      port: p,
      path: "/mcp-status",
      method: "GET",
      timeout: 200
    };
    requestJson(options, "", (err, info) => {
      const instance = !err && info && typeof info.projectPath === "string" && pathModule3.isAbsolute(info.projectPath) ? { ...info, port: p } : null;
      if (instance) observedInstances.set(p, instance);
      else observedInstances.delete(p);
      resolve4(instance);
    });
  });
  pendingProbes.set(p, pending);
  pending.then(() => {
    if (pendingProbes.get(p) === pending) pendingProbes.delete(p);
  });
  return pending;
}
async function scanActiveInstances() {
  if (scanInFlight) return scanInFlight;
  routingStats.fullScans++;
  scanInFlight = Promise.all(getScanPorts().map((port) => queryInstance(port))).then((results) => {
    publishConnectionChange();
    return results.filter((instance) => instance !== null);
  });
  try {
    return await scanInFlight;
  } finally {
    scanInFlight = null;
  }
}
function publishConnectionChange() {
  const state = JSON.stringify({
    port: globalActivePort,
    projectPath: activeProjectPath,
    instances: [...observedInstances.values()].sort((a, b) => a.port - b.port).map((instance) => {
      var _a, _b, _c;
      return [
        instance.port,
        pathModule3.resolve(instance.projectPath),
        (_a = instance.mcp) == null ? void 0 : _a.buildId,
        (_b = instance.mcp) == null ? void 0 : _b.pid,
        (_c = instance.mcp) == null ? void 0 : _c.loadedAt
      ];
    })
  });
  if (clientReady && connectionState !== void 0 && connectionState !== state) {
    sendToAI({ jsonrpc: "2.0", method: "notifications/tools/list_changed" });
  }
  connectionState = state;
}
async function monitorConnections() {
  var _a;
  const allPorts = getScanPorts();
  const hints = [.../* @__PURE__ */ new Set([...observedInstances.keys(), COCOS_PORT, ...allPorts.filter((port) => port < START_PORT || port > END_PORT)])];
  const ports = globalActivePort !== null ? [globalActivePort] : monitorRound++ % 4 === 0 ? allPorts : hints;
  const online = (await Promise.all(ports.map((port) => queryInstance(port, true)))).some(Boolean);
  offlineRounds = online ? 0 : offlineRounds + 1;
  routingStats.monitorDelayMs = online ? Date.now() - lastActivity < 3e4 ? 5e3 : 15e3 : Math.min(6e4, 5e3 * Math.pow(2, Math.min(offlineRounds, 4)));
  if (!clientReady || connectionClosed) return;
  publishConnectionChange();
  try {
    refreshProxyTools();
  } catch (err) {
    process.stderr.write("\u5DE5\u5177\u9884\u8BBE\u8BFB\u53D6\u5931\u8D25: " + err.message + "\n");
  }
  connectionTimer = setTimeout(() => {
    void monitorConnections();
  }, routingStats.monitorDelayMs);
  (_a = connectionTimer.unref) == null ? void 0 : _a.call(connectionTimer);
}
async function getRoutingInstances() {
  if (globalActivePort !== null) {
    const selected = await queryInstance(globalActivePort);
    if (selected) {
      routingStats.lastRoute = "bound";
      publishConnectionChange();
      return [selected];
    }
  }
  routingStats.lastRoute = globalActivePort === null ? "discovery" : "bound-fallback-scan";
  return scanActiveInstances();
}
function selectInstance(instances, allowOffline = false) {
  var _a;
  if (globalActivePort !== null) {
    const selected = instances.find((instance) => instance.port === globalActivePort);
    if (selected && pathModule3.resolve(selected.projectPath) !== activeProjectPath) {
      throw new Error("\u7ED1\u5B9A\u7AEF\u53E3\u7684\u5DE5\u7A0B\u8EAB\u4EFD\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0 set_active_instance \u540E\u518D\u64CD\u4F5C");
    }
    if (selected && activeInstancePin && ((_a = selected.projectContext) == null ? void 0 : _a.expected_context) !== activeInstancePin) throw new Error("EDITOR_INSTANCE_CHANGED\uFF1A\u7F16\u8F91\u5668\u5B9E\u4F8B\u5DF2\u91CD\u8F7D\uFF0C\u8BF7\u91CD\u65B0 set_active_instance");
    if (!selected && !allowOffline) throw new Error("\u7ED1\u5B9A\u7684 Cocos \u9879\u76EE\u5B9E\u4F8B\u5DF2\u79BB\u7EBF\uFF0C\u8BF7\u7B49\u5F85\u6062\u590D\u6216\u91CD\u65B0\u7ED1\u5B9A");
    cachedProjectPath = activeProjectPath;
    return selected || null;
  }
  if (instances.length > 1) throw new Error("Multiple Cocos instances detected\uFF0C\u8BF7\u5148 set_active_instance \u6307\u5B9A\u552F\u4E00\u5DE5\u7A0B");
  if (instances.length === 0) {
    if (allowOffline && configuredProjectPath && pathModule3.isAbsolute(configuredProjectPath) && fs6.existsSync(pathModule3.join(configuredProjectPath, "assets"))) {
      cachedProjectPath = pathModule3.resolve(configuredProjectPath);
      return null;
    }
    throw new Error("\u672A\u6FC0\u6D3B\u4EFB\u4F55 Cocos \u9879\u76EE\u5B9E\u4F8B\uFF0C\u8BF7\u5148 set_active_instance \u7ED1\u5B9A\u5728\u7EBF\u5DE5\u7A0B\uFF0C\u6216\u663E\u5F0F\u914D\u7F6E MCP_BRIDGE_PROJECT_PATH \u8FDB\u884C\u79BB\u7EBF\u7F16\u8F91");
  }
  if (configuredProjectPath && normalizeProjectPath(instances[0].projectPath) !== normalizeProjectPath(configuredProjectPath)) throw new Error("PROJECT_CONTEXT_MISMATCH\uFF1A\u5728\u7EBF\u5B9E\u4F8B\u4E0D\u662F\u914D\u7F6E\u7ED1\u5B9A\u7684\u5DE5\u7A0B");
  cachedProjectPath = instances[0].projectPath;
  return instances[0];
}
function debugLog(msg) {
  process.stderr.write(`[\u4EE3\u7406\u8C03\u8BD5] ${msg}
`);
}
function executeOfflineEdit(name, args, id) {
  try {
    const isPrefab = name === "modify_prefab_offline";
    const url = isPrefab ? args.prefabUrl : args.sceneUrl;
    if (!url) return sendError(id, -32602, `\u7F3A\u5C11\u53C2\u6570: ${isPrefab ? "prefabUrl" : "sceneUrl"}`);
    const fsPath = resolveDbUrl(url);
    const result = OfflinePrefabEditor.modify(fsPath, args.operations, isPrefab ? "prefab-child" : "scene");
    if (!result.success) {
      return sendError(id, -32603, `\u79BB\u7EBF\u4FEE\u6539${isPrefab ? "\u9884\u5236\u4F53" : "\u573A\u666F"}\u5931\u8D25: ${result.error}`);
    }
    sendToAI({
      jsonrpc: "2.0",
      id,
      result: {
        content: [{
          type: "text",
          text: `\u2705 \u6210\u529F\u79BB\u7EBF\u4FEE\u6539${isPrefab ? "\u9884\u5236\u4F53" : "\u573A\u666F"}: ${url}\uFF0C\u7269\u7406\u6570\u636E\u5DF2\u5B89\u5168\u843D\u76D8\u3002`
        }]
      }
    });
  } catch (e) {
    sendError(id, -32603, `\u79BB\u7EBF\u7F16\u8F91\u5F02\u5E38: ${e.message}`);
  }
}
readline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", (line) => {
  if (!line.trim()) return;
  try {
    const request2 = JSON.parse(line);
    handleRequest(request2);
  } catch (e) {
    sendError(null, -32700, "Parse error");
  }
}).on("close", () => {
  connectionClosed = true;
  clientReady = false;
  if (connectionTimer) clearTimeout(connectionTimer);
});
function proxyRuntime() {
  return {
    ...getRuntimeInfo("proxy", __filename),
    routing: { ...routingStats, boundPort: globalActivePort, projectPath: activeProjectPath }
  };
}
function sendLocalDiagnostics(id, reason, extra = {}) {
  const diagnostics = composeDiagnostics(null, null, proxyRuntime());
  diagnostics.issues.push(`connection: ${reason}`);
  sendToAI({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({
    path: activeProjectPath || configuredProjectPath || bundledProjectRoot,
    ...extra,
    connectionError: reason,
    mcpDiagnostics: diagnostics
  }) }] } });
}
function sendDiagnosedResult(cocosRes, id, extra = {}) {
  var _a, _b;
  if (!cocosRes.isError && ((_b = (_a = cocosRes.content) == null ? void 0 : _a[0]) == null ? void 0 : _b.type) === "text") {
    try {
      const info = JSON.parse(cocosRes.content[0].text);
      const prior = info.mcpDiagnostics;
      Object.assign(info, extra);
      info.mcpDiagnostics = composeDiagnostics(prior == null ? void 0 : prior.editor, prior == null ? void 0 : prior.scene, proxyRuntime());
      if (prior == null ? void 0 : prior.issues) info.mcpDiagnostics.issues.push(...prior.issues.filter((issue) => issue.startsWith("scene:") && !info.mcpDiagnostics.issues.includes(issue)));
      cocosRes.content[0].text = JSON.stringify(info);
    } catch (e) {
      debugLog(`\u65E0\u6CD5\u9644\u52A0 MCP \u8BCA\u65AD: ${e.message}`);
    }
  }
  sendToAI({ jsonrpc: "2.0", id, result: cocosRes });
}
function handleRequest(req) {
  var _a, _b, _c;
  if (!req || typeof req !== "object" || Array.isArray(req) || req.jsonrpc !== "2.0" || typeof req.method !== "string" || req.id !== void 0 && req.id !== null && !["string", "number"].includes(typeof req.id) || req.method === "tools/call" && req.id === void 0) {
    sendError((_a = req == null ? void 0 : req.id) != null ? _a : null, -32600, "Invalid Request");
    return;
  }
  const { method, id, params } = req;
  if (method === "initialize") {
    sendToAI({
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: { listChanged: true } },
        serverInfo: { name: "cocos-bridge", version: BUILD_INFO.version },
        mcpBridge: { expected_project_path: configuredProjectPath, project_id: configuredProjectPath ? projectIdentity(configuredProjectPath) : null },
        instructions: "\u5148\u6838\u5BF9 get_active_instances \u8FD4\u56DE\u7684\u5DE5\u7A0B\u8DEF\u5F84\u4E0E projectContext\uFF0C\u518D set_active_instance\u3002\u7ED1\u5B9A\u540E\u7F16\u8F91\u5668\u91CD\u8F7D\u9700\u91CD\u65B0\u7ED1\u5B9A\uFF0C\u4E0D\u80FD\u5C06\u4EFB\u610F\u54CD\u5E94\u670D\u52A1\u7684\u51ED\u8BC1\u7528\u4E8E\u5199\u5165\u3002"
      }
    });
    return;
  }
  if (method === "notifications/initialized") {
    if (!clientReady && !connectionClosed) {
      clientReady = true;
      publishConnectionChange();
      void monitorConnections();
    }
    return;
  }
  if (method === "tools/list") {
    try {
      refreshProxyTools();
    } catch (err) {
      sendError(id, -32602, err.message);
      return;
    }
    sendToAI({ jsonrpc: "2.0", id, result: { tools: PROXY_TOOLS } });
    return;
  }
  if (method === "tools/call") {
    lastActivity = Date.now();
    try {
      if (!params || typeof params !== "object") throw new Error("tools/call \u7F3A\u5C11 params");
      if (params.arguments === void 0) params.arguments = {};
      const argumentPin = (_b = params.arguments) == null ? void 0 : _b.expected_context, metaPin = (_c = params._meta) == null ? void 0 : _c.expected_context;
      if (argumentPin !== void 0 && metaPin !== void 0 && argumentPin !== metaPin) throw new Error("PROJECT_CONTEXT_MISMATCH\uFF1A\u53C2\u6570\u4E0E\u5143\u6570\u636E\u51ED\u8BC1\u51B2\u7A81");
      if ([argumentPin, metaPin].some((pin) => pin !== void 0 && (typeof pin !== "string" || !pin))) throw new Error("PROJECT_CONTEXT_MISMATCH\uFF1A\u5B9E\u4F8B\u51ED\u8BC1\u683C\u5F0F\u4E0D\u5408\u6CD5");
      refreshProxyTools();
      validateExposedCall(params.name, params.arguments, PROXY_TOOLS);
    } catch (err) {
      sendError(id, -32602, err.message);
      return;
    }
    if (params.name === "get_active_instances") {
      scanActiveInstances().then((list) => {
        var _a2;
        if ((_a2 = params.arguments) == null ? void 0 : _a2.includeMcpDiagnostics) {
          let selected;
          try {
            selected = selectInstance(list);
          } catch (e) {
            sendLocalDiagnostics(id, e.message, { instances: list });
            return;
          }
          forwardToCocos(
            "/call-tool",
            { name: "get_project_info", arguments: { includeMcpDiagnostics: true } },
            id,
            "POST",
            selected.port,
            (result) => sendDiagnosedResult(result, id, { instances: list }),
            (error) => sendLocalDiagnostics(id, error.message, { instances: list })
          );
          return;
        }
        sendToAI({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] } });
      });
      return;
    }
    if (params.name === "set_active_instance") {
      const p = params.arguments ? params.arguments.port : null;
      if (typeof p !== "number" || !Number.isInteger(p) || p < 1 || p > 65535) {
        sendError(id, -32602, "Invalid port parameter");
        return;
      }
      queryInstance(p).then((instance) => {
        var _a2;
        if (!instance) {
          sendError(id, -32e3, "\u76EE\u6807\u7AEF\u53E3\u4E0D\u662F\u5728\u7EBF Cocos \u9879\u76EE\uFF0C\u539F\u7ED1\u5B9A\u4FDD\u6301\u4E0D\u53D8");
          return;
        }
        const expectedPath = params.arguments.projectPath || configuredProjectPath;
        if (expectedPath && normalizeProjectPath(instance.projectPath) !== normalizeProjectPath(expectedPath)) {
          sendError(id, -32e3, "PROJECT_CONTEXT_MISMATCH\uFF1A\u7AEF\u53E3\u5BF9\u5E94\u5DE5\u7A0B\u4E0E\u9884\u671F\u8DEF\u5F84\u4E0D\u7B26");
          return;
        }
        globalActivePort = p;
        activeProjectPath = pathModule3.resolve(instance.projectPath);
        activeInstancePin = ((_a2 = instance.projectContext) == null ? void 0 : _a2.expected_context) || null;
        cachedProjectPath = activeProjectPath;
        publishConnectionChange();
        sendToAI({ jsonrpc: "2.0", id, result: { projectContext: instance.projectContext, content: [{ type: "text", text: `Active instance successfully set to port ${p}. Project: ${activeProjectPath}` }] } });
      });
      return;
    }
    getRoutingInstances().then((onlineEngines) => {
      var _a2, _b2;
      const offline = OFFLINE_TOOL_NAMES.has(params.name);
      const diagnostics = params.name === "get_project_info" && ((_a2 = params.arguments) == null ? void 0 : _a2.includeMcpDiagnostics);
      let selected;
      try {
        selected = selectInstance(onlineEngines, offline);
        if (selected == null ? void 0 : selected.projectContext) {
          const context = selected.projectContext;
          if (normalizeProjectPath(context.project_path) !== normalizeProjectPath(selected.projectPath) || context.project_id !== projectIdentity(selected.projectPath)) throw new Error("PROJECT_CONTEXT_MISMATCH\uFF1A\u670D\u52A1\u8EAB\u4EFD\u4E0E\u5DE5\u7A0B\u8DEF\u5F84\u4E0D\u4E00\u81F4");
          const pin = params.arguments.expected_context === void 0 ? (_b2 = params._meta) == null ? void 0 : _b2.expected_context : params.arguments.expected_context;
          if (pin && pin !== context.expected_context) throw new Error("EDITOR_INSTANCE_CHANGED\uFF1A\u51ED\u8BC1\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u6838\u5BF9\u5E76\u7ED1\u5B9A");
          if (mutatesProject(params.name, params.arguments) && globalActivePort === null && !configuredProjectPath && !pin) throw new Error("PROJECT_CONTEXT_REQUIRED\uFF1A\u5199\u5165\u524D\u8BF7\u6838\u5BF9\u5DE5\u7A0B\u5E76 set_active_instance");
          if (globalActivePort !== null || configuredProjectPath || pin) params.arguments.expected_context = context.expected_context;
        }
        if (offline) resolveDbUrl(params.name === "modify_prefab_offline" ? params.arguments.prefabUrl : params.arguments.sceneUrl);
      } catch (e) {
        if (diagnostics) {
          sendLocalDiagnostics(id, e.message);
          return;
        }
        sendError(id, e.message.includes("Multiple Cocos") ? -32600 : -32e3, e.message);
        return;
      }
      if (!selected) {
        executeOfflineEdit(params.name, params.arguments, id);
        return;
      }
      const finalPort = selected.port;
      forwardToCocos(
        "/call-tool",
        {
          name: params.name,
          arguments: params.arguments
        },
        id,
        "POST",
        finalPort,
        diagnostics ? (cocosRes) => sendDiagnosedResult(cocosRes, id) : void 0,
        diagnostics ? (error) => sendLocalDiagnostics(id, error.message) : void 0
      );
    });
    return;
  }
  if (method === "ping") {
    if (id !== void 0) sendToAI({ jsonrpc: "2.0", id, result: {} });
    return;
  }
  if (id !== void 0) sendError(id, -32601, `Method not found: ${method}`);
}
function forwardToCocos(path_, payload, id, method = "POST", overridePort, onSuccess, onError) {
  const postData = payload ? JSON.stringify(payload) : "";
  const targetPort = overridePort || COCOS_PORT;
  const options = {
    hostname: COCOS_HOST,
    port: targetPort,
    path: path_,
    method,
    headers: { "Content-Type": "application/json" },
    timeout: FORWARD_TIMEOUT_MS
  };
  if (postData && options.headers) {
    options.headers["Content-Length"] = Buffer.byteLength(postData);
  }
  requestJson(options, postData, (err, cocosRes) => {
    if (err) {
      debugLog(err.message);
      if (onError) onError(err);
      else sendError(id, -32e3, err.message);
      return;
    }
    if (onSuccess) {
      onSuccess(cocosRes);
    } else sendToAI({ jsonrpc: "2.0", id, result: cocosRes });
  });
}
function sendToAI(obj) {
  if (connectionClosed) return;
  process.stdout.write(JSON.stringify(obj) + "\n");
}
function sendError(id, code, message) {
  sendToAI({ jsonrpc: "2.0", id, error: { code, message } });
}
