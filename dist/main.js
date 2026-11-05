var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// <define:__MCP_BRIDGE_BUILD__>
var define_MCP_BRIDGE_BUILD_default;
var init_define_MCP_BRIDGE_BUILD = __esm({
  "<define:__MCP_BRIDGE_BUILD__>"() {
    define_MCP_BRIDGE_BUILD_default = { version: "1.7.0", buildId: "cace32e492364744e663a268d6cb42f5f96540a2b83df1f3afa16c149bcc9152", builtAt: "2026-11-05T09:16:27.063Z" };
  }
});

// src/tools/ToolCapabilities.ts
function alias(name, target, action, category, readOnly, description, defaults = {}, required, extra = {}) {
  aliases.push({ name, target, action, category, readOnly, description, defaults, required, extra });
}
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
var aliases, READ_ONLY, CATEGORY_NAMES;
var init_ToolCapabilities = __esm({
  "src/tools/ToolCapabilities.ts"() {
    init_define_MCP_BRIDGE_BUILD();
    aliases = [];
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
    READ_ONLY = /* @__PURE__ */ new Set(["get_selected_node", "get_scene_hierarchy", "find_gameobjects", "read_console", "validate_script", "run_script_diagnostics", "check_asset_ready", "validate_prefab", "search_project", "get_sha", "resolve_capture_coordinates", "inspect_asset_dependencies", "find_references", "get_project_info", "inspect_builder_targets", "get_active_instances"]);
    CATEGORY_NAMES = {
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
  }
});

// src/utils/BoundedValue.ts
function boundedValue(input, maxBytes = 4096, maxDepth = 6) {
  let remaining = maxBytes, truncated = false;
  const seen = /* @__PURE__ */ new Set();
  const visit = (value, depth) => {
    if (remaining < 32 || depth > maxDepth) {
      remaining -= 16;
      truncated = true;
      return "[Truncated]";
    }
    if (typeof value === "string") {
      let size = 2, end = 0;
      for (; end < value.length; end++) {
        const c = value.charCodeAt(end);
        let width = c < 32 ? 6 : c === 34 || c === 92 ? 2 : c < 128 ? 1 : c < 2048 ? 2 : 3;
        const paired = c >= 55296 && c <= 56319 && value.charCodeAt(end + 1) >= 56320 && value.charCodeAt(end + 1) <= 57343;
        if (paired) width = 4;
        else if (c >= 55296 && c <= 57343) width = 6;
        if (size + width + 16 > remaining) break;
        size += width;
        if (paired) end++;
      }
      remaining -= size;
      if (end < value.length) {
        remaining -= 16;
        truncated = true;
        return value.slice(0, end) + "[Truncated]";
      }
      return value;
    }
    if (!value || typeof value !== "object") {
      remaining -= 32;
      return typeof value === "function" || typeof value === "symbol" || typeof value === "bigint" ? String(typeof value) : value;
    }
    if (seen.has(value)) {
      remaining -= 16;
      truncated = true;
      return "[Circular]";
    }
    seen.add(value);
    remaining -= 4;
    const result = Array.isArray(value) ? [] : {};
    if (Array.isArray(value)) {
      for (let i = 0; i < Math.min(value.length, 1e3); i++) {
        if (remaining < 32) break;
        remaining -= 2;
        const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
        if (!descriptor) {
          remaining -= 4;
          result.push(null);
        } else if ("value" in descriptor) result.push(visit(descriptor.value, depth + 1));
        else {
          remaining -= 16;
          result.push("[Accessor]");
        }
      }
      if (result.length < value.length) truncated = true;
      seen.delete(value);
      return result;
    }
    let count = 0;
    for (const key in value) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      if (remaining < 32 || ++count > 1e3) {
        truncated = true;
        break;
      }
      if (["__proto__", "prototype", "constructor"].includes(key)) continue;
      if (key.length * 6 + 6 > remaining) {
        truncated = true;
        break;
      }
      remaining -= key.length * 6 + 6;
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor && "value" in descriptor) result[key] = visit(descriptor.value, depth + 1);
      else {
        remaining -= 16;
        result[key] = "[Accessor]";
      }
    }
    seen.delete(value);
    return result;
  };
  return { value: visit(input, 0), truncated };
}
var init_BoundedValue = __esm({
  "src/utils/BoundedValue.ts"() {
    init_define_MCP_BRIDGE_BUILD();
  }
});

// src/tools/ComponentQuery.ts
var init_ComponentQuery = __esm({
  "src/tools/ComponentQuery.ts"() {
    init_define_MCP_BRIDGE_BUILD();
    init_BoundedValue();
  }
});

// src/tools/SceneCapabilities.ts
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
function isSceneCapability(name) {
  return specs.some((item) => item[0] === name);
}
function sceneCapabilityReadOnly(name) {
  var _a;
  return (_a = specs.find((item) => item[0] === name)) == null ? void 0 : _a[2];
}
var selector, specs;
var init_SceneCapabilities = __esm({
  "src/tools/SceneCapabilities.ts"() {
    init_define_MCP_BRIDGE_BUILD();
    init_ComponentQuery();
    init_BoundedValue();
    selector = { nodeId: { type: "string" }, uuid: { type: "string" }, path: { type: "string", description: "\u573A\u666F\u8282\u70B9\u5C42\u7EA7\u8DEF\u5F84\u3002" }, name: { type: "string", description: "\u7CBE\u786E\u540D\u79F0\uFF1B\u91CD\u540D\u65F6\u62D2\u7EDD\u5E76\u8981\u6C42 UUID \u6216\u8DEF\u5F84\u3002" } };
    specs = [
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
  }
});

// src/utils/AtomicFile.ts
function atomicWrite(file, content, expected) {
  const temporary = path.join(path.dirname(file), "." + path.basename(file) + ".mcp-" + crypto2.randomBytes(8).toString("hex"));
  let published = false;
  try {
    fs.writeFileSync(temporary, content, { flag: "wx" });
    if (expected !== void 0 && !fs.readFileSync(file).equals(Buffer.from(expected))) throw new Error("\u6587\u4EF6\u5DF2\u53D8\u5316\uFF0C\u672A\u8986\u76D6\uFF0C\u8BF7\u91CD\u65B0\u8BFB\u53D6");
    fs.renameSync(temporary, file);
    published = true;
  } finally {
    if (!published && fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
}
function readBounded(file, maxBytes = 8 * 1024 * 1024) {
  return new Promise((resolve6, reject) => {
    fs.open(file, "r", (err, fd) => {
      if (err) return reject(err);
      fs.fstat(fd, (statErr, stat) => {
        if (statErr || stat.size > maxBytes) {
          fs.close(fd, () => reject(statErr || new Error(`\u6587\u4EF6\u8D85\u8FC7\u8BFB\u53D6\u4E0A\u9650 ${maxBytes} \u5B57\u8282`)));
          return;
        }
        const data = Buffer.alloc(stat.size + 1);
        let offset = 0;
        const read2 = () => fs.read(fd, data, offset, data.length - offset, offset, (readErr, count) => {
          if (readErr || !count || offset + count === data.length) {
            fs.fstat(fd, (verifyErr, after) => fs.close(fd, () => {
              if (readErr || verifyErr) return reject(readErr || verifyErr);
              if (offset + count !== stat.size || after.size !== stat.size || after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs) {
                return reject(new Error("\u8BFB\u53D6\u671F\u95F4\u6587\u4EF6\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u8BFB\u53D6"));
              }
              resolve6(data.slice(0, offset + count));
            }));
          } else {
            offset += count;
            read2();
          }
        });
        read2();
      });
    });
  });
}
var fs, path, crypto2;
var init_AtomicFile = __esm({
  "src/utils/AtomicFile.ts"() {
    init_define_MCP_BRIDGE_BUILD();
    fs = __toESM(require("fs"));
    path = __toESM(require("path"));
    crypto2 = __toESM(require("crypto"));
  }
});

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
var init_SerializedValidation = __esm({
  "src/utils/SerializedValidation.ts"() {
    init_define_MCP_BRIDGE_BUILD();
  }
});

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
var init_AssetUrl = __esm({
  "src/utils/AssetUrl.ts"() {
    init_define_MCP_BRIDGE_BUILD();
  }
});

// src/tools/EditorCapabilities.ts
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
function isEditorCapability(name) {
  return specs2.some((item) => item[0] === name);
}
function editorCapabilityReadOnly(name) {
  var _a;
  return (_a = specs2.find((item) => item[0] === name)) == null ? void 0 : _a[2];
}
async function executeEditorCapability(name, args, editor) {
  var _a, _b;
  if (name === "list_editor_windows") {
    let windows = [(_b = (_a = editor.Window) == null ? void 0 : _a.main) == null ? void 0 : _b.nativeWin].filter(Boolean);
    try {
      windows = require("electron").BrowserWindow.getAllWindows();
    } catch (_) {
    }
    return windows.map((win) => ({ id: win.id, title: win.getTitle(), visible: win.isVisible(), focused: win.isFocused(), bounds: win.getBounds() }));
  }
  if (name === "duplicate_prefab") {
    validateAssetUrl(args.path);
    validateAssetUrl(args.targetPath);
    const source = editor.assetdb.urlToFspath(args.path), target = editor.assetdb.urlToFspath(args.targetPath);
    if (!source || !target || !args.path.endsWith(".prefab") || !args.targetPath.endsWith(".prefab")) throw new Error("\u9700\u8981\u6709\u6548\u7684\u9884\u5236\u4F53\u6E90\u8DEF\u5F84\u4E0E\u76EE\u6807\u8DEF\u5F84");
    if (fs2.existsSync(target)) throw new Error("\u76EE\u6807\u9884\u5236\u4F53\u5DF2\u5B58\u5728");
    const content = (await readBounded(source, 8 * 1024 * 1024)).toString("utf8");
    assertSerializedAsset(JSON.parse(content));
    return new Promise((resolve6, reject) => editor.assetdb.create(args.targetPath, content, (err, result) => err ? reject(err) : resolve6(result)));
  }
  const pattern = name === "list_scenes" ? "db://assets/**/*.fire" : name === "list_prefabs" ? "db://assets/**/*.prefab" : args.pattern || "db://assets/**";
  if (!pattern.startsWith("db://assets/") || pattern.includes("..")) throw new Error("\u8D44\u6E90\u67E5\u8BE2\u8303\u56F4\u5FC5\u987B\u4F4D\u4E8E db://assets \u4E0B");
  return new Promise((resolve6, reject) => editor.assetdb.queryAssets(pattern, args.type || null, (err, items) => {
    if (err) return reject(err);
    const limit = args.limit || 500;
    resolve6({ items: (items || []).slice(0, limit).map((item) => ({ uuid: item.uuid, url: item.url, type: item.type })), total: (items || []).length, truncated: (items || []).length > limit });
  }));
}
var fs2, specs2;
var init_EditorCapabilities = __esm({
  "src/tools/EditorCapabilities.ts"() {
    init_define_MCP_BRIDGE_BUILD();
    fs2 = __toESM(require("fs"));
    init_AtomicFile();
    init_SerializedValidation();
    init_AssetUrl();
    specs2 = [
      ["get_tool_catalog", "project", true, "\u5217\u51FA\u5168\u90E8\u5DE5\u5177\u7684\u5206\u7C7B\u3001\u9884\u8BBE\u5C42\u7EA7\u3001\u5F00\u653E\u72B6\u6001\u548C\u53EF\u7528\u64CD\u4F5C\u3002"],
      ["get_editor_state", "project", true, "\u8BFB\u53D6\u5DE5\u7A0B\u8EAB\u4EFD\u3001\u7F16\u8F91\u5668\u961F\u5217\u4E0E\u9009\u62E9\u72B6\u6001\u3002"],
      ["list_editor_windows", "project", true, "\u5217\u51FA\u672C Creator \u8FDB\u7A0B\u7684 Electron \u7A97\u53E3\u3002"],
      ["list_assets", "assets", true, "\u67E5\u8BE2 AssetDB \u8D44\u6E90\uFF0C\u6700\u591A\u8FD4\u56DE500\u6761\u3002", { pattern: { type: "string" }, type: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 500 } }],
      ["list_scenes", "assets", true, "\u5217\u51FA\u5DE5\u7A0B\u4E2D\u7684 Creator 2.4 .fire \u573A\u666F\u3002"],
      ["list_prefabs", "prefabs", true, "\u5217\u51FA\u5DE5\u7A0B\u4E2D\u7684\u9884\u5236\u4F53\u8D44\u6E90\u3002"],
      ["duplicate_prefab", "prefabs", false, "\u590D\u5236\u9884\u5236\u4F53\u5185\u5BB9\uFF0C\u7531 AssetDB \u751F\u6210\u65B0 UUID\uFF0C\u4E0D\u590D\u5236 meta\u3002", { path: { type: "string" }, targetPath: { type: "string" } }, ["path", "targetPath"]]
    ];
  }
});

// src/tools/ProjectFiles.ts
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
function isProjectFileTool(name) {
  return fileSpecs.some((item) => item[0] === name);
}
function projectFileReadOnly(name) {
  var _a;
  return (_a = fileSpecs.find((item) => item[0] === name)) == null ? void 0 : _a[1];
}
function resolveProjectFile(project, value) {
  if (typeof value !== "string" || !value || value.includes("\0")) throw new Error("\u9700\u8981\u6709\u6548\u7684\u5DE5\u7A0B\u5185\u8DEF\u5F84");
  const root = path2.resolve(project);
  const target = path2.resolve(root, value.startsWith("db://assets") ? "assets" + value.slice(11) : value);
  const inside = (base, file) => {
    const relative5 = path2.relative(base, file);
    return !relative5 || !relative5.startsWith(".." + path2.sep) && relative5 !== ".." && !path2.isAbsolute(relative5);
  };
  if (!inside(root, target)) throw new Error("\u6587\u4EF6\u8DEF\u5F84\u8D85\u51FA\u5F53\u524D\u5DE5\u7A0B");
  let existing = target;
  while (!fs3.existsSync(existing) && existing !== path2.dirname(existing)) existing = path2.dirname(existing);
  if (!inside(fs3.realpathSync(root), fs3.realpathSync(existing))) throw new Error("\u6587\u4EF6\u8DEF\u5F84\u901A\u8FC7\u7B26\u53F7\u94FE\u63A5\u6307\u5411\u5DE5\u7A0B\u5916");
  return target;
}
async function executeProjectFile(name, args, project) {
  var _a;
  const file = resolveProjectFile(project, args.path);
  if (name === "exists") return { path: args.path, exists: fs3.existsSync(file), isDirectory: fs3.existsSync(file) && fs3.statSync(file).isDirectory() };
  if (name === "list_directory") {
    const entries = await fs3.promises.readdir(file, { withFileTypes: true });
    return { path: args.path, entries: entries.slice(0, 500).map((item) => ({ name: item.name, directory: item.isDirectory(), symlink: item.isSymbolicLink() })), total: entries.length, truncated: entries.length > 500 };
  }
  const writing = !projectFileReadOnly(name);
  if (writing && /\.(?:fire|prefab|meta)$/i.test(file)) throw new Error("\u573A\u666F\u3001\u9884\u5236\u4F53\u548C meta \u8BF7\u4F7F\u7528\u4E13\u7528\u8D44\u6E90\u5DE5\u5177");
  if (writing && file === path2.resolve(project)) throw new Error("\u4E0D\u80FD\u5199\u5165\u5DE5\u7A0B\u6839\u76EE\u5F55");
  if (name === "write_file") {
    if (Buffer.byteLength(args.content) > 1024 * 1024) throw new Error("\u6587\u672C\u8D85\u8FC71MiB");
    const previous2 = fs3.existsSync(file) ? await readBounded(file, 1024 * 1024) : void 0;
    if (previous2 && !args.overwrite) throw new Error("\u6587\u4EF6\u5DF2\u5B58\u5728\uFF1B\u8986\u76D6\u9700\u4F20 overwrite:true");
    await fs3.promises.mkdir(path2.dirname(file), { recursive: true });
    atomicWrite(file, args.content, previous2);
    return { path: args.path, bytes: Buffer.byteLength(args.content), assetDbRefreshed: false };
  }
  const previous = await readBounded(file, name === "get_file_snippet" ? 8 * 1024 * 1024 : 1024 * 1024);
  const content = previous.toString("utf8");
  if (name === "read_file") return { path: args.path, content, bytes: previous.length };
  if (name === "get_file_snippet") {
    const lines = content.split(/\r?\n/), line = args.line || 1, radius = (_a = args.radius) != null ? _a : 10;
    if (line > lines.length) throw new Error("\u884C\u53F7\u8D85\u51FA\u6587\u4EF6\u8303\u56F4");
    const start = Math.max(1, line - radius), end = Math.min(lines.length, line + radius);
    const snippet = lines.slice(start - 1, end).map((text, i) => ({ line: start + i, text: text.slice(0, 4e3), truncated: text.length > 4e3 }));
    return { path: args.path, startLine: start, endLine: end, totalLines: lines.length, lines: snippet };
  }
  if (!args.search) throw new Error("search \u4E0D\u80FD\u4E3A\u7A7A");
  const pieces = content.split(args.search), count = pieces.length - 1;
  if (!count || count > 1e4 || args.expectedCount !== void 0 && count !== args.expectedCount) throw new Error("\u66FF\u6362\u5339\u914D\u6B21\u6570\u4E0D\u7B26\u5408\u9884\u671F: " + count);
  const result = pieces.join(args.replacement);
  if (Buffer.byteLength(result) > 1024 * 1024) throw new Error("\u66FF\u6362\u540E\u6587\u672C\u8D85\u8FC71MiB");
  atomicWrite(file, result, previous);
  return { path: args.path, replacements: count, assetDbRefreshed: false };
}
var fs3, path2, fileSpecs;
var init_ProjectFiles = __esm({
  "src/tools/ProjectFiles.ts"() {
    init_define_MCP_BRIDGE_BUILD();
    fs3 = __toESM(require("fs"));
    path2 = __toESM(require("path"));
    init_AtomicFile();
    fileSpecs = [
      ["read_file", true, "\u8BFB\u53D6\u5DE5\u7A0B\u5185 UTF-8 \u6587\u4EF6\uFF0C\u9ED8\u8BA4\u6700\u591A1MiB\u3002"],
      ["get_file_snippet", true, "\u8BFB\u53D6\u6307\u5B9A\u884C\u9644\u8FD1\u7684\u5DE5\u7A0B\u6587\u4EF6\u7247\u6BB5\u3002", { line: { type: "integer", minimum: 1 }, radius: { type: "integer", minimum: 0, maximum: 100 } }],
      ["write_file", false, "\u539F\u5B50\u5199\u5165\u5DE5\u7A0B\u5185\u6587\u672C\u6587\u4EF6\uFF1B\u573A\u666F\u3001\u9884\u5236\u4F53\u4E0E meta \u4F7F\u7528\u4E13\u7528\u5DE5\u5177\u3002", { content: { type: "string" }, overwrite: { type: "boolean" } }, ["path", "content"]],
      ["replace_in_file", false, "\u5BF9\u5DE5\u7A0B\u6587\u672C\u6587\u4EF6\u505A\u5B57\u9762\u91CF\u66FF\u6362\u5E76\u6821\u9A8C\u5339\u914D\u6B21\u6570\u3002", { search: { type: "string" }, replacement: { type: "string" }, expectedCount: { type: "integer", minimum: 1, maximum: 1e4 } }, ["path", "search", "replacement"]],
      ["list_directory", true, "\u5217\u51FA\u5DE5\u7A0B\u76EE\u5F55\u7684\u76F4\u63A5\u5B50\u9879\uFF0C\u6700\u591A500\u9879\u3002"],
      ["exists", true, "\u68C0\u67E5\u5DE5\u7A0B\u6587\u4EF6\u6216\u76EE\u5F55\u662F\u5426\u5B58\u5728\u3002"]
    ];
  }
});

// src/core/ProjectContext.ts
function normalizeProjectPath(value) {
  const resolved = path3.resolve(value);
  return path3.sep === "\\" ? resolved.toLowerCase() : resolved;
}
function projectIdentity(projectPath) {
  return (0, import_crypto.createHash)("sha256").update(normalizeProjectPath(projectPath)).digest("hex").slice(0, 24);
}
function getProjectContext() {
  var _a;
  const projectPath = typeof Editor !== "undefined" && ((_a = Editor.Project) == null ? void 0 : _a.path) ? path3.resolve(Editor.Project.path) : path3.resolve(".");
  const id = projectIdentity(projectPath);
  return { project_id: id, project_path: projectPath, instance_id: instanceId, expected_context: id + ":" + instanceId };
}
function projectEndpoint(context = getProjectContext()) {
  return "/mcp/project/" + context.project_id + "/";
}
function projectRoute(url, context = getProjectContext()) {
  if (!url.startsWith("/mcp/project/")) return { path: url, scoped: false };
  const match = /^\/mcp\/project\/([^/]+)(?:\/(.*))?$/.exec(url);
  let id;
  try {
    id = match && decodeURIComponent(match[1]);
  } catch (_) {
  }
  if (!id || id !== context.project_id) return { error: "PROJECT_CONTEXT_MISMATCH", status: 409 };
  return { path: "/" + (match[2] || ""), scoped: true };
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
function contextError(params, scoped, context = getProjectContext()) {
  var _a, _b;
  const argumentPin = (_a = params.arguments) == null ? void 0 : _a.expected_context, metaPin = (_b = params._meta) == null ? void 0 : _b.expected_context;
  if (argumentPin !== void 0 && metaPin !== void 0 && argumentPin !== metaPin) return "PROJECT_CONTEXT_MISMATCH";
  const pin = argumentPin === void 0 ? metaPin : argumentPin;
  if (pin !== void 0 && pin !== context.expected_context) return typeof pin === "string" && pin.split(":")[0] === context.project_id ? "EDITOR_INSTANCE_CHANGED" : "PROJECT_CONTEXT_MISMATCH";
  return !scoped && mutatesProject(params.name, params.arguments) && !pin ? "PROJECT_CONTEXT_REQUIRED" : null;
}
var path3, import_crypto, instanceId;
var init_ProjectContext = __esm({
  "src/core/ProjectContext.ts"() {
    init_define_MCP_BRIDGE_BUILD();
    path3 = __toESM(require("path"));
    import_crypto = require("crypto");
    init_ToolCapabilities();
    init_SceneCapabilities();
    init_EditorCapabilities();
    init_ProjectFiles();
    instanceId = (0, import_crypto.randomBytes)(16).toString("hex");
  }
});

// src/utils/LogPreview.ts
function truncateLogText(text, limit = 4096) {
  if (text.length <= limit) return text;
  let end = limit;
  if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
  return text.slice(0, end) + `...[length:${text.length}]`;
}
function formatLogPreview(value) {
  const seen = /* @__PURE__ */ new Set();
  const sanitize = (text) => text.replace(/data:[^\s"']+/gi, "[omitted]").replace(/\bBearer\s+[^\s"',;]+/gi, "Bearer [redacted]").replace(/((?:password|secret|token|api[_-]?key|authorization)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^,\s;}]+)/gi, "$1[redacted]");
  const visit = (item, depth) => {
    if (typeof item === "string") return truncateLogText(sanitize(item), 256);
    if (typeof item === "function" || typeof item === "symbol") return void 0;
    if (item === null || typeof item !== "object") return typeof item === "bigint" ? String(item) : item;
    if (seen.has(item)) return "[Circular]";
    if (depth === 0) return Array.isArray(item) ? `[Array(${item.length})]` : "[Object]";
    seen.add(item);
    const result = Array.isArray(item) ? [] : /* @__PURE__ */ Object.create(null);
    if (Array.isArray(item)) for (let index = 0; index < Math.min(8, item.length); index++) {
      const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
      result.push(descriptor && "value" in descriptor ? visit(descriptor.value, depth - 1) : "[Getter]");
    }
    if (!Array.isArray(item)) {
      let count = 0;
      for (const key in item) {
        if (!Object.prototype.hasOwnProperty.call(item, key)) continue;
        if (count++ === 12) break;
        if (/password|secret|token|authorization|credential|cookie|api.?key/i.test(key)) {
          result[truncateLogText(key, 64)] = "[redacted]";
          continue;
        }
        if (/^(content|contents|code|script|source|stdout|stderr|base64|buffer|dataUrl)$/i.test(key)) {
          result[key] = "[omitted]";
          continue;
        }
        const descriptor = Object.getOwnPropertyDescriptor(item, key);
        result[truncateLogText(key, 64)] = descriptor && "value" in descriptor ? visit(descriptor.value, depth - 1) : "[Getter]";
      }
    } else if (item.length > 8) result.push(`[+${item.length - 8} items]`);
    return result;
  };
  try {
    return truncateLogText(JSON.stringify(visit(value, 3)) || String(value), 2048);
  } catch (_) {
    return "[\u65E0\u6CD5\u751F\u6210\u65E5\u5FD7\u6458\u8981]";
  }
}
var init_LogPreview = __esm({
  "src/utils/LogPreview.ts"() {
    init_define_MCP_BRIDGE_BUILD();
  }
});

// src/core/Logger.ts
var fs4, pathModule, _Logger, Logger;
var init_Logger = __esm({
  "src/core/Logger.ts"() {
    init_define_MCP_BRIDGE_BUILD();
    fs4 = __toESM(require("fs"));
    pathModule = __toESM(require("path"));
    init_LogPreview();
    _Logger = class _Logger {
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
              bytes = (await fs4.promises.stat(file)).size;
            } catch (e) {
              if (e.code !== "ENOENT") throw e;
            }
            if (bytes && bytes + Buffer.byteLength(text) > _Logger.MAX_BYTES) {
              try {
                await fs4.promises.unlink(file + ".old");
              } catch (e) {
                if (e.code !== "ENOENT") throw e;
              }
              await fs4.promises.rename(file, file + ".old");
            }
            await fs4.promises.appendFile(file, text, "utf8");
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
            if (!fs4.existsSync(settingsDir)) {
              fs4.mkdirSync(settingsDir, { recursive: true });
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
    Logger = _Logger;
  }
});

// src/utils/HttpTransport.ts
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
var import_string_decoder, MAX_REQUEST_BYTES, MAX_RESPONSE_BYTES;
var init_HttpTransport = __esm({
  "src/utils/HttpTransport.ts"() {
    init_define_MCP_BRIDGE_BUILD();
    import_string_decoder = require("string_decoder");
    MAX_REQUEST_BYTES = 5 * 1024 * 1024;
    MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
  }
});

// src/core/HttpServer.ts
var http, import_net, _HttpServer, HttpServer;
var init_HttpServer = __esm({
  "src/core/HttpServer.ts"() {
    init_define_MCP_BRIDGE_BUILD();
    http = __toESM(require("http"));
    import_net = require("net");
    init_Logger();
    init_HttpTransport();
    _HttpServer = class _HttpServer {
      /**
       * 启动 HTTP 服务器
       */
      static start(port, requestHandler, onListening, host = _HttpServer.config.host) {
        host = _HttpServer.validateHost(host);
        _HttpServer.stop();
        _HttpServer.config.host = host;
        _HttpServer.config.startError = null;
        const generation = _HttpServer.generation;
        _HttpServer.config.state = "starting";
        const tryStart = (currentPort, retries) => {
          if (generation !== _HttpServer.generation) return;
          if (retries <= 0) {
            _HttpServer.config.state = "stopped";
            _HttpServer.config.startError = "\u65E0\u6CD5\u627E\u5230\u53EF\u7528\u7AEF\u53E3";
            Logger.error(`Failed to find an available port after multiple attempts.`);
            return;
          }
          try {
            const server = http.createServer((req, res) => {
              _HttpServer.handleRawRequest(req, res, requestHandler);
            });
            _HttpServer.mcpServer = server;
            server.on("error", (e) => {
              if (generation !== _HttpServer.generation || _HttpServer.mcpServer !== server) return;
              if (e.code === "EADDRINUSE" || e.code === "EACCES") {
                Logger.warn(`Port ${currentPort} is ${e.code === "EACCES" ? "access denied (possibly in excluded range)" : "in use"}, trying ${currentPort + 1}...`);
                try {
                  server.close();
                } catch (err) {
                }
                _HttpServer.mcpServer = null;
                _HttpServer.retryTimer = setTimeout(() => {
                  _HttpServer.retryTimer = null;
                  tryStart(currentPort + 1, retries - 1);
                }, 100);
              } else {
                _HttpServer.config.state = "stopped";
                _HttpServer.config.active = false;
                _HttpServer.config.startError = e.message;
                Logger.error(`Server Error: ${e.message}`);
              }
            });
            server.listen(currentPort, host, () => {
              var _a, _b;
              if (generation !== _HttpServer.generation || _HttpServer.mcpServer !== server) {
                server.close();
                return;
              }
              _HttpServer.config.state = "listening";
              _HttpServer.config.active = true;
              const actualPort = ((_b = (_a = server.address) == null ? void 0 : _a.call(server)) == null ? void 0 : _b.port) || currentPort;
              _HttpServer.config.port = actualPort;
              try {
                if (onListening) onListening(actualPort);
              } catch (err) {
                Logger.warn(`\u76D1\u542C\u5DF2\u6210\u529F\uFF0C\u4F46\u7AEF\u53E3\u4FDD\u5B58\u5931\u8D25: ${err.message}`);
              }
              Logger.success(`MCP Server running at http://${host}:${actualPort}`);
              if (Editor && Editor.Ipc) {
                try {
                  Editor.Ipc.sendToPanel("mcp-bridge", "mcp-bridge:state-changed", _HttpServer.config);
                } catch (_e) {
                }
              }
            });
          } catch (e) {
            _HttpServer.config.state = "stopped";
            _HttpServer.config.active = false;
            _HttpServer.config.startError = e.message;
            Logger.error(`Failed to start server: ${e.message}`);
          }
        };
        tryStart(port, 10);
      }
      /** 先校验再停现有服务，地址不可用时保留原始启动错误供面板修复。 */
      static validateHost(value) {
        if (typeof value !== "string" || value !== value.trim() || !value || value.length > 253 || !((0, import_net.isIP)(value) || value.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)))) throw new Error("Host \u5FC5\u987B\u662F IP \u5730\u5740\u6216\u4E3B\u673A\u540D\uFF0C\u4E0D\u53EF\u586B\u5199 URL/\u7AEF\u53E3");
        return value;
      }
      /**
       * 拦截并校验请求体大小，然后传递给业务 Router
       */
      static handleRawRequest(req, res, handler) {
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.setHeader("Access-Control-Allow-Origin", "*");
        readUtf8Body(req, MAX_REQUEST_BYTES, (err, body) => {
          if (err) {
            Logger.error(`[HTTP] ${err.message}`);
            if (!res.destroyed) {
              res.writeHead(err.code === "ETOOBIG" ? 413 : 400);
              res.end(JSON.stringify({ error: err.message }));
            }
            return;
          }
          req.bodyString = body;
          handler(req, res);
        });
      }
      /**
       * 关闭 HTTP 服务器
       */
      static stop() {
        _HttpServer.generation++;
        clearTimeout(_HttpServer.retryTimer);
        _HttpServer.retryTimer = null;
        _HttpServer.config.active = false;
        _HttpServer.config.state = "stopped";
        if (_HttpServer.mcpServer) {
          _HttpServer.mcpServer.close();
          _HttpServer.mcpServer = null;
          _HttpServer.config.active = false;
          Logger.warn("MCP Server stopped");
          if (Editor && Editor.Ipc) {
            try {
              Editor.Ipc.sendToPanel("mcp-bridge", "mcp-bridge:state-changed", _HttpServer.config);
            } catch (_e) {
            }
          }
        }
      }
    };
    _HttpServer.generation = 0;
    _HttpServer.retryTimer = null;
    _HttpServer.mcpServer = null;
    _HttpServer.config = {
      host: "127.0.0.1",
      startError: null,
      port: 8200,
      active: false,
      state: "stopped"
    };
    HttpServer = _HttpServer;
  }
});

// src/utils/Jsonc.ts
function parseDocument(source) {
  let offset = source.charCodeAt(0) === 65279 ? 1 : 0;
  const fail = (message) => {
    throw new SyntaxError(`Invalid JSONC at offset ${offset}: ${message}. File was left unchanged.`);
  };
  function trivia() {
    while (offset < source.length) {
      if (/[ \t\r\n]/.test(source[offset])) {
        offset += 1;
        continue;
      }
      if (source.startsWith("//", offset)) {
        offset += 2;
        while (offset < source.length && !/[\r\n]/.test(source[offset])) offset += 1;
      } else if (source.startsWith("/*", offset)) {
        const end = source.indexOf("*/", offset + 2);
        if (end < 0) fail("unterminated comment");
        offset = end + 2;
      } else break;
    }
  }
  function string() {
    const start = offset++;
    while (offset < source.length) {
      const character = source[offset++];
      if (character === '"') {
        try {
          return { start, end: offset, value: JSON.parse(source.slice(start, offset)) };
        } catch (error) {
          fail("invalid string");
        }
      }
      if (character === "\\") offset += 1;
    }
    fail("unterminated string");
  }
  function value(depth = 0) {
    if (depth > 128) fail("configuration nesting is too deep");
    trivia();
    const start = offset;
    const character = source[offset];
    if (character === '"') return string();
    if (character !== "{" && character !== "[") {
      const literal = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(source.slice(offset));
      if (!literal) fail("expected a JSON value");
      offset += literal[0].length;
      return { start, end: offset, value: JSON.parse(literal[0]) };
    }
    const object = character === "{";
    const closing = object ? "}" : "]";
    const result = object ? {} : [];
    const properties = [];
    offset += 1;
    trivia();
    while (source[offset] !== closing) {
      let key;
      if (object) {
        if (source[offset] !== '"') fail("expected an object key");
        key = string();
        if (Object.prototype.hasOwnProperty.call(result, key.value)) fail("duplicate object key");
        trivia();
        if (source[offset++] !== ":") fail("expected a colon");
      }
      const child = value(depth + 1);
      const property = object ? { key: key.value, start: key.start, node: child, comma: null } : null;
      if (object) {
        Object.defineProperty(result, key.value, { value: child.value, enumerable: true, writable: true, configurable: true });
        properties.push(property);
      } else result.push(child.value);
      trivia();
      if (source[offset] === closing) break;
      if (source[offset] !== ",") fail("expected a comma or closing delimiter");
      if (property) property.comma = offset;
      offset += 1;
      trivia();
    }
    offset += 1;
    return { start, end: offset, value: result, properties: object ? properties : void 0 };
  }
  trivia();
  if (offset === source.length) return null;
  const root = value();
  trivia();
  if (offset !== source.length) fail("unexpected content after the root value");
  return root;
}
function parseJsonc(source) {
  const document = parseDocument(source);
  return document ? document.value : {};
}
function updateJsonc(source, desired) {
  desired = parseJsonc(JSON.stringify(desired));
  const root = parseDocument(source);
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const indent = (/\r?\n([ \t]+)"/.exec(source) || [null, "  "])[1];
  const lineIndent = (position) => /^[ \t]*/.exec(source.slice(source.lastIndexOf("\n", position - 1) + 1))[0];
  const serialize = (value, prefix) => JSON.stringify(value, null, indent).replace(/\n/g, newline + prefix);
  if (!root) {
    const separator = source && !/[\r\n]$/.test(source) ? newline : "";
    return source + separator + serialize(desired, "") + newline;
  }
  const edits = [];
  const edit = (start, end, text) => edits.push({ start, end, text, order: edits.length });
  function visit(node, next) {
    if (isDeepStrictEqual(node.value, next)) return;
    if (!node.properties || !next || typeof next !== "object" || Array.isArray(next)) {
      edit(node.start, node.end, serialize(next, lineIndent(node.start)));
      return;
    }
    const retained = [];
    const existing = /* @__PURE__ */ new Set();
    for (const property of node.properties) {
      existing.add(property.key);
      if (Object.prototype.hasOwnProperty.call(next, property.key)) {
        retained.push(property);
        visit(property.node, next[property.key]);
      } else {
        edit(property.start, property.node.end, "");
        if (property.comma !== null) edit(property.comma, property.comma + 1, "");
      }
    }
    const added = Object.keys(next).filter((key) => !existing.has(key));
    if (!added.length) return;
    const last = retained[retained.length - 1];
    if (last && last.comma === null) edit(last.node.end, last.node.end, ",");
    const base = lineIndent(node.start);
    const prefix = base + indent;
    const closing = node.end - 1;
    const closingLine = source.lastIndexOf("\n", closing - 1) + 1;
    const onOwnLine = /^[ \t]*$/.test(source.slice(closingLine, closing));
    const trailingComma = node.properties.length && node.properties[node.properties.length - 1].comma !== null;
    const fields = added.map((key) => `${prefix}${JSON.stringify(key)}: ${serialize(next[key], prefix)}`).join("," + newline);
    const text = (onOwnLine ? "" : newline) + fields + (trailingComma ? "," : "") + newline + (onOwnLine ? "" : base);
    edit(onOwnLine ? closingLine : closing, onOwnLine ? closingLine : closing, text);
  }
  visit(root, desired);
  let result = source;
  for (const change of edits.sort((a, b) => b.start - a.start || b.end - a.end || b.order - a.order)) {
    result = result.slice(0, change.start) + change.text + result.slice(change.end);
  }
  if (!isDeepStrictEqual(parseJsonc(result), desired)) throw new Error("JSONC edit could not be verified; the file was left unchanged.");
  return result;
}
var isDeepStrictEqual;
var init_Jsonc = __esm({
  "src/utils/Jsonc.ts"() {
    init_define_MCP_BRIDGE_BUILD();
    ({ isDeepStrictEqual } = require("util"));
  }
});

// src/utils/ClientConfigProtection.ts
function samePath(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const left = path10.resolve(a), right = path10.resolve(b);
  return path10.sep === "\\" ? left.toLowerCase() === right.toLowerCase() : left === right;
}
function mergeOwnedEntry(existing, desired) {
  var _a;
  if (existing === void 0) return desired;
  if (!existing || typeof existing !== "object" || Array.isArray(existing) || existing.disabled || existing.enabled === false || existing.url || existing.command !== desired.command || !Array.isArray(existing.args) || existing.args.length !== 1 || !samePath(existing.args[0], desired.args[0])) throw new Error("\u5F53\u524D\u6761\u76EE\u88AB\u7981\u7528\u3001\u624B\u52A8\u6539\u5411\u6216\u5C5E\u4E8E\u5176\u4ED6\u9879\u76EE\uFF0C\u4FDD\u7559\u539F\u914D\u7F6E");
  if (existing.env !== void 0 && (!existing.env || typeof existing.env !== "object" || Array.isArray(existing.env))) throw new Error("env \u683C\u5F0F\u4E0D\u660E\u786E\uFF0C\u4FDD\u7559\u539F\u914D\u7F6E");
  for (const key of Object.keys(desired.env || {})) {
    const prior = (_a = existing.env) == null ? void 0 : _a[key], expected = desired.env[key];
    if (prior !== void 0 && (key.endsWith("PROJECT_PATH") ? !samePath(prior, expected) : prior !== expected)) throw new Error("\u9879\u76EE\u8DEF\u5F84\u6216 Host \u5DF2\u88AB\u624B\u52A8\u4FEE\u6539\uFF0C\u4FDD\u7559\u539F\u914D\u7F6E");
  }
  return { ...existing, ...desired, env: { ...existing.env, ...desired.env } };
}
function updateJsonClient(source, rootKey, name, desired) {
  const document = parseJsonc(source);
  if (!document || typeof document !== "object" || Array.isArray(document)) throw new Error("\u914D\u7F6E\u6839\u5FC5\u987B\u662F\u5BF9\u8C61");
  const entries = document[rootKey];
  if (entries !== void 0 && (!entries || typeof entries !== "object" || Array.isArray(entries))) throw new Error("MCP \u914D\u7F6E\u6BB5\u4E0D\u662F\u5BF9\u8C61\uFF0C\u4FDD\u7559\u539F\u914D\u7F6E");
  const next = { ...document, [rootKey]: { ...entries, [name]: mergeOwnedEntry(entries == null ? void 0 : entries[name], desired) } };
  return updateJsonc(source, next);
}
function updateTomlClient(source, name, desired) {
  if (/"""|'''|^\s*mcp_servers\s*=/m.test(source)) throw new Error("TOML \u4F7F\u7528\u591A\u884C\u5B57\u7B26\u4E32\u6216\u5185\u8054 MCP \u8868\uFF0C\u9700\u624B\u5DE5\u914D\u7F6E");
  const headers = [...source.matchAll(/^[ \t]*\[([^\]\r\n]+)\][ \t]*(?:#[^\r\n]*)?\r?$/gm)];
  const find = (key) => {
    var _a, _b, _c, _d;
    const normalized = (value) => value.trim().replace(/\s*\.\s*/g, ".").replace(/(^|\.)(?:"([\w-]+)"|'([\w-]+)')(?=\.|$)/g, "$1$2$3");
    const matches = headers.filter((header2) => normalized(header2[1]) === key);
    if (matches.length > 1) throw new Error("\u91CD\u590D\u7684 MCP TOML \u8868\uFF0C\u4FDD\u7559\u539F\u914D\u7F6E");
    const header = matches[0];
    if (!header) return null;
    const index = headers.indexOf(header);
    return { start: header.index, end: (_b = (_a = headers[index + 1]) == null ? void 0 : _a.index) != null ? _b : source.length, text: source.slice(header.index, (_d = (_c = headers[index + 1]) == null ? void 0 : _c.index) != null ? _d : source.length) };
  };
  const sectionName = "mcp_servers." + name, section = find(sectionName), envSection = find(sectionName + ".env");
  const line = (block, key) => {
    var _a;
    const matches = [...(block || "").matchAll(new RegExp("^[ \\t]*" + key + "[ \\t]*=[ \\t]*(.*)$", "gm"))];
    if (matches.length > 1) throw new Error("\u91CD\u590D\u7684 TOML \u914D\u7F6E\u952E\uFF0C\u4FDD\u7559\u539F\u914D\u7F6E");
    const value = (_a = matches[0]) == null ? void 0 : _a[1].trim();
    if (value === void 0) return void 0;
    try {
      return JSON.parse(value);
    } catch (_) {
      throw new Error("\u5DF2\u6709 MCP TOML \u5B57\u6BB5\u683C\u5F0F\u65E0\u6CD5\u53EF\u9760\u8BC6\u522B\uFF0C\u4FDD\u7559\u539F\u914D\u7F6E");
    }
  };
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const envLines = Object.entries(desired.env || {}).map(([key, value]) => key + " = " + JSON.stringify(value));
  if (!section) {
    if (envSection) throw new Error("MCP env \u8868\u7F3A\u5C11\u4E3B\u8868\uFF0C\u4FDD\u7559\u539F\u914D\u7F6E");
    return source + (source.endsWith("\n") || !source ? "" : newline) + (source ? newline : "") + "[" + sectionName + "]" + newline + "command = " + JSON.stringify(desired.command) + newline + "args = " + JSON.stringify(desired.args) + newline + (envLines.length ? newline + "[" + sectionName + ".env]" + newline + envLines.join(newline) + newline : "");
  }
  if (/^\s*(url|env)\s*=/m.test(section.text)) throw new Error("\u5DF2\u6709 MCP \u8868\u5305\u542B URL \u6216\u5185\u8054 env\uFF0C\u4FDD\u7559\u539F\u914D\u7F6E");
  const env = {};
  for (const key of Object.keys(desired.env || {})) {
    const value = line(envSection == null ? void 0 : envSection.text, key);
    if (value !== void 0) env[key] = value;
  }
  mergeOwnedEntry({
    command: line(section.text, "command"),
    args: line(section.text, "args"),
    disabled: line(section.text, "disabled"),
    enabled: line(section.text, "enabled"),
    env
  }, desired);
  const missing = Object.keys(desired.env || {}).filter((key) => env[key] === void 0);
  if (!missing.length) return source;
  const added = missing.map((key) => key + " = " + JSON.stringify(desired.env[key])).join(newline) + newline;
  if (!envSection) return source + (source.endsWith("\n") ? newline : newline + newline) + "[" + sectionName + ".env]" + newline + added;
  return source.slice(0, envSection.end) + (source.slice(0, envSection.end).endsWith("\n") ? "" : newline) + added + source.slice(envSection.end);
}
function updateDshPatch(source, serverName, url) {
  var _a, _b, _c, _d, _e;
  const config = { serverName, transport: "streamable-http", url };
  if (!source) return JSON.stringify([{ insert: [{ id: serverName, name: "@deepseek-ai/dsh-mcp-client", config }] }], null, 2) + "\n";
  JSON.parse(source);
  const patches = parseJsonc(source), entry = (_b = (_a = patches == null ? void 0 : patches[0]) == null ? void 0 : _a.insert) == null ? void 0 : _b[0];
  if (!Array.isArray(patches) || patches.length !== 1 || !patches[0] || Object.keys(patches[0]).join() !== "insert" || !Array.isArray(patches[0].insert) || patches[0].insert.length !== 1 || !entry || Object.keys(entry).some((key) => !["id", "name", "config", "disabled"].includes(key)) || entry.id !== serverName || entry.name !== "@deepseek-ai/dsh-mcp-client" || entry.disabled || ((_c = entry.config) == null ? void 0 : _c.serverName) !== serverName || ((_d = entry.config) == null ? void 0 : _d.transport) !== config.transport || ((_e = entry.config) == null ? void 0 : _e.url) !== url) throw new Error("DSH overlay \u542B\u5176\u4ED6\u6761\u76EE\u3001\u88AB\u7981\u7528\u6216\u5DF2\u624B\u52A8\u6539\u5411\uFF0C\u4FDD\u7559\u539F\u914D\u7F6E");
  return source;
}
var path10;
var init_ClientConfigProtection = __esm({
  "src/utils/ClientConfigProtection.ts"() {
    init_define_MCP_BRIDGE_BUILD();
    init_Jsonc();
    path10 = __toESM(require("path"));
  }
});

// src/McpConfigurator.ts
var McpConfigurator_exports = {};
__export(McpConfigurator_exports, {
  getPayload: () => getPayload,
  injectMcpConfig: () => injectMcpConfig,
  processTomlInjection: () => processTomlInjection,
  projectConnection: () => projectConnection,
  scanMcpClients: () => scanMcpClients,
  targetPaths: () => targetPaths
});
function backupConfigFile(targetFile, clientName) {
  if (!fs15.existsSync(targetFile)) {
    return null;
  }
  const backupPath = `${targetFile}.${Date.now()}-${crypto8.randomBytes(4).toString("hex")}.bak`;
  try {
    fs15.copyFileSync(targetFile, backupPath, fs15.constants.COPYFILE_EXCL);
    return backupPath;
  } catch (e) {
    console.error(`[McpConfigurator] \u5907\u4EFD\u914D\u7F6E\u6587\u4EF6\u5931\u8D25 (${clientName}): ${e.message}`);
    return null;
  }
}
function processTomlInjection(content, command, args) {
  return updateTomlClient(content, "mcp-bridge", { command, args });
}
function projectConnection() {
  var _a;
  const root = typeof Editor !== "undefined" && ((_a = Editor.Project) == null ? void 0 : _a.path) ? path11.resolve(Editor.Project.path) : path11.resolve(__dirname, "../../..");
  const serverName = "mcp-bridge-" + projectIdentity(root).slice(0, 12);
  const host = HttpServer.config.host || "127.0.0.1";
  const authority = host.includes(":") ? "[" + host + "]" : host;
  return {
    root,
    serverName,
    url: "http://" + authority + ":" + HttpServer.config.port + "/mcp/project/" + projectIdentity(root) + "/",
    entry: { command: bridgeCommand, args: bridgeArgs, env: { MCP_BRIDGE_PROJECT_PATH: root.replace(/\\/g, "/"), MCP_BRIDGE_HOST: host } }
  };
}
function updatedClient(target, original) {
  const info = projectConnection();
  if (target.format === "dsh") return updateDshPatch(original, info.serverName, info.url);
  if (target.format === "toml") return updateTomlClient(original || "", info.serverName, info.entry);
  return updateJsonClient(original || "{}", target.mcpKey || "mcpServers", info.serverName, info.entry);
}
function scanMcpClients() {
  return targetPaths.map((target, id) => {
    const isInstalled = !!target.file && fs15.existsSync(path11.dirname(target.file));
    let isConfigured = false, isError = false, error = "";
    if (target.file && fs15.existsSync(target.file)) {
      try {
        const raw = fs15.readFileSync(target.file, "utf8");
        isConfigured = updatedClient(target, raw) === raw;
      } catch (failure) {
        isError = true;
        error = failure.message;
      }
    }
    return { id, name: target.name, path: target.file, isInstalled, isConfigured, isError, error };
  });
}
function getPayload() {
  const info = projectConnection();
  return JSON.stringify({ mcpServers: { [info.serverName]: info.entry } }, null, 2);
}
function injectMcpConfig(clientId) {
  let log = "", successCount = 0;
  const targets = targetPaths.map((target, id) => ({ ...target, id })).filter((target) => clientId === void 0 || clientId < 0 || target.id === clientId);
  for (const target of targets) {
    if (!target.file) continue;
    try {
      const existed = fs15.existsSync(target.file), original = existed ? fs15.readFileSync(target.file) : void 0;
      if (existed && !backupConfigFile(target.file, target.name)) {
        log += "\u5907\u4EFD\u5931\u8D25\uFF0C\u672A\u4FEE\u6539 " + target.name + "\n";
        continue;
      }
      const updated = updatedClient(target, original == null ? void 0 : original.toString("utf8"));
      fs15.mkdirSync(path11.dirname(target.file), { recursive: true });
      atomicWrite(target.file, updated, original);
      log += "\u2705 [" + target.name + "] \u5DF2\u5199\u5165\u672C\u9879\u76EE\u4E13\u5C5E\u914D\u7F6E\uFF0C\u5176\u4ED6\u9879\u76EE\u6761\u76EE\u4FDD\u6301\u539F\u6837\u3002\n";
      if (target.format === "dsh") {
        const quoted = process.platform === "win32" ? target.file.replace(/'/g, "''") : target.file.replace(/'/g, "'\\''");
        log += "\u5728\u5DE5\u7A0B\u76EE\u5F55\u624B\u52A8\u8FD0\u884C\uFF1Adsh web --patch '" + quoted + "'\uFF08\u4E0D\u4F1A\u81EA\u52A8\u542F\u52A8\u6216\u4FEE\u6539\u5168\u5C40 YAML\uFF09\n";
      }
      successCount++;
    } catch (error) {
      log += "\u274C [" + target.name + "] \u672A\u4FEE\u6539\u914D\u7F6E: " + error.message + "\n";
    }
  }
  return log || (successCount ? "\u914D\u7F6E\u5B8C\u6210" : "\u672A\u627E\u5230\u6240\u9009\u5BA2\u6237\u7AEF");
}
var crypto8, fs15, path11, bridgeCommand, bridgeArgs, isWin, isMac, getAppdataPath, getMacAppSupportPath, getUserProfilePath, getAppDataDir, targetPaths;
var init_McpConfigurator = __esm({
  "src/McpConfigurator.ts"() {
    init_define_MCP_BRIDGE_BUILD();
    init_AtomicFile();
    init_ClientConfigProtection();
    init_ProjectContext();
    init_HttpServer();
    crypto8 = __toESM(require("crypto"));
    fs15 = __toESM(require("fs"));
    path11 = __toESM(require("path"));
    bridgeCommand = "node";
    bridgeArgs = [path11.resolve(__dirname, "mcp-proxy.js").replace(/\\/g, "/")];
    isWin = process.platform === "win32";
    isMac = process.platform === "darwin";
    getAppdataPath = () => process.env.APPDATA || (isWin ? process.env.USERPROFILE + "\\AppData\\Roaming" : "");
    getMacAppSupportPath = () => process.env.HOME + "/Library/Application Support";
    getUserProfilePath = () => process.env.USERPROFILE || process.env.HOME || "";
    getAppDataDir = () => isWin ? getAppdataPath() : getMacAppSupportPath();
    targetPaths = [
      { name: "Antigravity", file: path11.join(getUserProfilePath(), ".gemini", "config", "mcp_config.json") },
      { name: "Cherry Studio", file: path11.join(getAppDataDir(), "cherry-studio", "mcp.json") },
      { name: "Claude Code", file: path11.join(getUserProfilePath(), ".claude.json") },
      { name: "Claude Desktop", file: path11.join(getAppDataDir(), "Claude", "claude_desktop_config.json") },
      { name: "Cline", file: path11.join(getAppDataDir(), "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json") },
      { name: "CodeBuddy CLI", file: path11.join(getUserProfilePath(), ".codebuddy", "mcp.json") },
      { name: "CodeWhale", file: path11.join(getUserProfilePath(), ".codewhale", "mcp.json") },
      { name: "Deepseek-TUI", file: path11.join(getUserProfilePath(), ".deepseek", "mcp.json") },
      { name: "Codex", file: path11.join(getUserProfilePath(), ".codex", "config.toml"), format: "toml" },
      { name: "Cursor", file: path11.join(getUserProfilePath(), ".cursor", "mcp.json") },
      { name: "Gemini CLI", file: path11.join(getUserProfilePath(), ".gemini", "mcp.json") },
      { name: "GitHub Copilot CLI", file: path11.join(getUserProfilePath(), ".config", "github-copilot", "mcp.json") },
      { name: "Kilo Code", file: path11.join(getUserProfilePath(), ".kilo", "mcp.json") },
      { name: "Kiro", file: path11.join(getUserProfilePath(), ".kiro", "mcp.json") },
      { name: "OpenCode", file: path11.join(getUserProfilePath(), ".opencode", "mcp.json") },
      { name: "Qwen Code", file: path11.join(getUserProfilePath(), ".qwen", "mcp.json") },
      { name: "Rider GitHub Copilot", file: path11.join(getAppDataDir(), "JetBrains", "Rider", "github-copilot", "mcp.json") },
      { name: "Roo Code", file: path11.join(getAppDataDir(), "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "cline_mcp_settings.json") },
      { name: "Trae", file: path11.join(getUserProfilePath(), ".trae", "mcp.json") },
      { name: "Trae CN", file: path11.join(getUserProfilePath(), ".trae-cn", "mcp.json") },
      { name: "VSCode GitHub Copilot", file: path11.join(getAppDataDir(), "Code", "User", "globalStorage", "github.copilot", "mcp.json") },
      { name: "VSCode Insiders GitHub Copilot", file: path11.join(getAppDataDir(), "Code - Insiders", "User", "globalStorage", "github.copilot", "mcp.json") },
      { name: "Windsurf", file: path11.join(getUserProfilePath(), ".codeium", "windsurf", "mcp_config.json") },
      {
        name: "Zed",
        file: isWin ? path11.join(getAppdataPath(), "Zed", "settings.json") : path11.join(getUserProfilePath(), ".config", "zed", "settings.json"),
        format: "json",
        mcpKey: "context_servers"
      }
    ];
    targetPaths.push({ name: "DeepSeek Harness (DSH)", file: path11.join(projectConnection().root, ".dsh", "mcp-bridge.patch.json"), format: "dsh" });
  }
});

// src/main.ts
init_define_MCP_BRIDGE_BUILD();

// src/core/BuildJobs.ts
init_define_MCP_BRIDGE_BUILD();
var crypto = __toESM(require("crypto"));
var BuildJobs = class {
  static begin(details) {
    if ([...this.jobs.values()].some((job2) => job2.status === "building")) throw new Error("\u5DF2\u6709\u6784\u5EFA\u8FD0\u884C\u4E2D\uFF0C\u8BF7\u67E5\u8BE2\u539F jobId\uFF0C\u4E0D\u80FD\u91CD\u590D\u63D0\u4EA4");
    while (this.jobs.size >= 32) this.jobs.delete(this.jobs.keys().next().value);
    const job = { jobId: crypto.randomBytes(12).toString("hex"), ...details, status: "building", completed: false, startedAt: (/* @__PURE__ */ new Date()).toISOString() };
    this.jobs.set(job.jobId, job);
    return { ...job };
  }
  static finish(id, err, result) {
    const job = this.jobs.get(id);
    if (!job || job.completed) return;
    Object.assign(job, {
      status: err ? "failed" : "succeeded",
      completed: true,
      error: err ? String(err.message || err) : null,
      result,
      finishedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  static get(id) {
    const job = this.jobs.get(id);
    if (!job) throw new Error("\u627E\u4E0D\u5230\u6784\u5EFA jobId\uFF1B\u4EFB\u52A1\u53EA\u5728\u5F53\u524D\u63D2\u4EF6\u8FDB\u7A0B\u4E2D\u4FDD\u7559\uFF0C\u63D2\u4EF6\u91CD\u8F7D\u540E\u7ED3\u679C\u672A\u77E5\uFF0C\u52FF\u81EA\u52A8\u91CD\u5EFA");
    return { ...job };
  }
};
BuildJobs.jobs = /* @__PURE__ */ new Map();

// src/tools/EditorInput.ts
init_define_MCP_BRIDGE_BUILD();
var import_crypto3 = require("crypto");
var import_perf_hooks = require("perf_hooks");

// src/tools/EditorScreenshot.ts
init_define_MCP_BRIDGE_BUILD();

// src/tools/CaptureReceipt.ts
init_define_MCP_BRIDGE_BUILD();
var import_crypto2 = require("crypto");
init_ProjectContext();
function windowGeometry(win) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const bounds = typeof win.getContentBounds === "function" ? win.getContentBounds() : null;
  return {
    windowId: (_a = win.id) != null ? _a : null,
    webContentsId: (_b = win.webContents.id) != null ? _b : null,
    bounds,
    zoomFactor: (_e = (_d = (_c = win.webContents).getZoomFactor) == null ? void 0 : _d.call(_c)) != null ? _e : null,
    url: (_h = (_g = (_f = win.webContents).getURL) == null ? void 0 : _g.call(_f)) != null ? _h : null
  };
}
function encodedSize(bytes, format) {
  if (format === "png" && bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  }
  if (format === "jpeg" && bytes[0] === 255 && bytes[1] === 216) {
    let offset = 2;
    while (offset + 8 < bytes.length && bytes[offset] === 255) {
      const marker = bytes[offset + 1], length = bytes.readUInt16BE(offset + 2);
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)) {
        return { width: bytes.readUInt16BE(offset + 7), height: bytes.readUInt16BE(offset + 5) };
      }
      if (length < 2) break;
      offset += 2 + length;
    }
  }
  return null;
}
var CaptureReceipts = class {
  constructor() {
    this.records = /* @__PURE__ */ new Map();
  }
  clear() {
    this.records.clear();
  }
  register(win, geometry, sourceSize, crop, imageSize, generation, stable) {
    var _a, _b;
    const capturedAt = Date.now();
    for (const [id, item] of this.records) if (capturedAt - item.time > 6e4) this.records.delete(id);
    while (this.records.size >= 16) this.records.delete(this.records.keys().next().value);
    const metadata = {
      captureId: "capture_" + (0, import_crypto2.randomBytes)(12).toString("hex"),
      capturedAt: new Date(capturedAt).toISOString(),
      coordinateSpace: "image-pixels",
      origin: "top-left",
      imageSize,
      sourceSize,
      crop,
      window: geometry,
      expiresAfterMs: 6e4,
      geometryStable: stable,
      coordinateMappingAvailable: !!imageSize && [
        imageSize.width,
        imageSize.height,
        sourceSize.width,
        sourceSize.height,
        (_a = geometry.bounds) == null ? void 0 : _a.width,
        (_b = geometry.bounds) == null ? void 0 : _b.height
      ].every((value) => Number.isFinite(value) && value > 0) && stable,
      projectContext: getProjectContext(),
      sceneContentVerified: false
    };
    this.records.set(metadata.captureId, { win, contents: win.webContents, metadata, time: capturedAt, generation });
    return metadata;
  }
  resolve(args, generation, currentWindow) {
    var _a, _b, _c;
    const record = this.records.get(args.captureId);
    if (!record || Date.now() - record.time > 6e4 || record.generation !== generation) throw new Error("\u622A\u56FE\u5DF2\u5931\u6548\uFF0C\u8BF7\u91CD\u65B0\u622A\u56FE");
    const { win, contents, metadata } = record;
    if (win !== currentWindow || win.webContents !== contents || ((_a = win.isDestroyed) == null ? void 0 : _a.call(win)) || ((_b = win.isMinimized) == null ? void 0 : _b.call(win)) || ((_c = win.isVisible) == null ? void 0 : _c.call(win)) === false || JSON.stringify(windowGeometry(win)) !== JSON.stringify(metadata.window)) throw new Error("\u7A97\u53E3\u6216\u7F29\u653E\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u622A\u56FE");
    if (!metadata.coordinateMappingAvailable) throw new Error("\u622A\u56FE\u7F3A\u5C11\u7A33\u5B9A\u7684\u7A97\u53E3\u51E0\u4F55\u4FE1\u606F\uFF0C\u65E0\u6CD5\u6821\u51C6\u5750\u6807");
    const image = metadata.imageSize, crop = metadata.crop, source = metadata.sourceSize, bounds = metadata.window.bounds;
    if (!Array.isArray(args.points) || !args.points.length || args.points.length > 100) throw new Error("points \u5FC5\u987B\u5305\u542B 1\u2013100 \u4E2A\u56FE\u50CF\u50CF\u7D20\u5750\u6807");
    const points = args.points.map((point) => {
      if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.y < 0 || point.x >= image.width || point.y >= image.height) throw new Error("\u5750\u6807\u5FC5\u987B\u4F4D\u4E8E\u8FD4\u56DE\u7684\u622A\u56FE\u50CF\u7D20\u8303\u56F4\u5185");
      const x = crop.x + point.x * crop.width / image.width, y = crop.y + point.y * crop.height / image.height;
      return { image: point, capture: { x, y }, windowContent: { x: x * bounds.width / source.width, y: y * bounds.height / source.height } };
    });
    return {
      captureId: args.captureId,
      points,
      windowId: metadata.window.windowId,
      coordinateSpace: "electron-content-dip",
      sceneContentVerified: false
    };
  }
};

// src/core/ProjectProfile.ts
init_define_MCP_BRIDGE_BUILD();
function loadProjectProfile() {
  const profile = Editor.Profile.load("profile://project/mcp-bridge.json", {
    "auto-start": false,
    "last-port": 8200,
    "host": "127.0.0.1",
    "screenshot-max-width": 1280,
    "screenshot-throttle": 1500
  });
  const legacy = "mcp-bridge";
  if (Array.from(legacy).every((char, index) => profile.get(String(index)) === char)) {
    for (let index = 0; index < legacy.length; index++) profile.set(String(index), void 0);
    profile.save();
  }
  return profile;
}

// src/tools/EditorScreenshot.ts
init_ToolCapabilities();
init_SceneCapabilities();

// src/tools/ScriptExecution.ts
init_define_MCP_BRIDGE_BUILD();
var vm = __toESM(require("vm"));
init_BoundedValue();
var SCRIPT_PACKET = "mcp-bridge.script.v1";
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
function validateJavascript(args) {
  if (typeof args.code !== "string" || !args.code.trim() || Buffer.byteLength(args.code) > 256 * 1024) throw new Error("\u811A\u672C\u4E0D\u80FD\u4E3A\u7A7A\u6216\u8D85\u8FC7256KiB");
  if (args.safety_checks !== false && /\b(?:require\s*\(\s*['"](?:node:)?child_process['"]|process\s*\.\s*(?:exit|kill)\s*\(|fs\s*\.\s*(?:promises\s*\.\s*)?(?:rm|rmdir|unlink|truncate)(?:Sync)?\s*\()/.test(args.code)) {
    throw new Error("\u811A\u672C\u9759\u6001\u68C0\u67E5\u62D2\u7EDD\u5220\u9664\u6587\u4EF6\u3001\u9000\u51FA\u8FDB\u7A0B\u6216\u542F\u52A8\u5B50\u8FDB\u7A0B\uFF1B\u786E\u8BA4\u811A\u672C\u5185\u5BB9\u540E\u53EF\u4F20 safety_checks:false\u3002\u6B64\u68C0\u67E5\u4E0D\u662F\u5B89\u5168\u6C99\u7BB1");
  }
}
function startJavascript(args, environment) {
  var _a;
  validateJavascript(args);
  const timeout = (_a = args.timeoutMs) != null ? _a : 5e3, started = Date.now();
  const logs = [];
  let omitted = 0, active = true, characters = 0;
  const execution = () => ({ context: environment.context, durationMs: Date.now() - started, logs: logs.slice(), logsOmitted: omitted });
  const scriptConsole = {};
  for (const level of ["log", "info", "warn", "error", "debug"]) scriptConsole[level] = (...values) => {
    if (!active) return;
    if (logs.length >= 50 || characters >= 2e4) {
      omitted++;
      return;
    }
    const message = values.slice(0, 20).map((value) => typeof value === "string" ? value.slice(0, 1e3) : JSON.stringify(boundedValue(value, 1e3, 4).value)).join(" ").slice(0, Math.min(1e3, 2e4 - characters));
    characters += message.length;
    logs.push({ level: level === "log" ? "info" : level, message });
  };
  const env = { ...environment, args: args.args || {}, console: scriptConsole };
  const sandbox = { ...env, env, Buffer, setTimeout, clearTimeout, setInterval, clearInterval };
  const source = `(async function () { "use strict"; const module = { exports: {} }; const exports = module.exports;
${args.code}
; if (typeof run === "function") return await run(env);
if (typeof module.exports === "function") return await module.exports(env);
if (module.exports && typeof module.exports.run === "function") return await module.exports.run(env);
return module.exports == null ? null : (typeof module.exports !== "object" || Object.keys(module.exports).length ? module.exports : null);
})()`;
  let result;
  try {
    result = new vm.Script(source, { filename: "mcp-" + environment.context + "-script.js" }).runInNewContext(sandbox, { timeout });
  } catch (err) {
    result = Promise.reject(err);
  }
  const completion = Promise.resolve(result).then((value) => {
    const safe = boundedValue(value === void 0 ? null : value, 1024 * 1024, 12);
    return { kind: SCRIPT_PACKET, data: safe.value, truncated: safe.truncated, execution: execution() };
  }, (error) => ({ kind: SCRIPT_PACKET, data: null, error: { message: String((error == null ? void 0 : error.message) || error).slice(0, 4e3) }, execution: execution() })).then((packet) => {
    active = false;
    return packet;
  });
  return { completion, timeout, snapshot: execution };
}

// src/tools/EditorScreenshot.ts
init_ProjectFiles();
init_EditorCapabilities();
var EditorScreenshot = class {
  static invalidate() {
    this.generation++;
    this.cached = null;
    this.receipts.clear();
  }
  static resolveCoordinates(args) {
    return this.receipts.resolve(args, this.generation, Editor.Window.main.nativeWin);
  }
  static capture(args, callback) {
    var _a, _b, _c, _d;
    const profile = loadProjectProfile();
    const maxWidth = (_b = args.maxWidth) != null ? _b : Number((_a = profile.get("screenshot-max-width")) != null ? _a : 1280);
    const throttle = Number((_c = profile.get("screenshot-throttle")) != null ? _c : 1500);
    const format = args.format || "png", quality = (_d = args.quality) != null ? _d : 80;
    const key = JSON.stringify([maxWidth, format, quality, args.crop, !!args.centerViewport]);
    const respond = (data, metadata, cached, time) => args.includeMetadata ? { dataUrl: data, ...metadata, cached, cacheAgeMs: Math.max(0, Date.now() - time) } : data;
    const generation = this.generation;
    let settled = false, restoreAttempts = 0;
    const finish = (err, data) => {
      if (settled) return;
      settled = true;
      clearTimeout(deadline);
      callback(err, data);
    };
    const deadline = setTimeout(() => finish("Editor screenshot API timed out."), 5e3);
    const capture = () => {
      if (settled) return;
      try {
        const win = Editor.Window.main.nativeWin;
        if (!win) return finish("\u672A\u627E\u5230\u7F16\u8F91\u5668\u4E3B\u7A97\u53E3\uFF0C\u65E0\u6CD5\u622A\u56FE");
        if (typeof win.isMinimized === "function" && win.isMinimized()) {
          if (args.restoreWindow === false) return finish("\u7F16\u8F91\u5668\u7A97\u53E3\u5DF2\u6700\u5C0F\u5316\uFF0CcapturePage \u53EA\u4F1A\u8FD4\u56DE\u8FC7\u671F\u753B\u9762\u3002\u4F20 restoreWindow: true\uFF08\u9ED8\u8BA4\uFF09\u81EA\u52A8\u6062\u590D\u7A97\u53E3\uFF0C\u6216\u624B\u52A8\u6062\u590D\u7A97\u53E3\u540E\u91CD\u8BD5\u3002");
          if (restoreAttempts >= 3) return finish("\u7F16\u8F91\u5668\u7A97\u53E3\u4ECD\u5904\u4E8E\u6700\u5C0F\u5316\u72B6\u6001\uFF0C\u65E0\u6CD5\u83B7\u53D6\u5B9E\u65F6\u753B\u9762");
          restoreAttempts++;
          try {
            if (typeof win.showInactive === "function") win.showInactive();
          } catch (_e) {
          }
          try {
            if (win.isMinimized() && typeof win.restore === "function") win.restore();
          } catch (_e) {
          }
          return setTimeout(() => {
            if (!settled) capture();
          }, 350);
        }
        if (typeof win.isVisible === "function" && !win.isVisible()) return finish("\u7F16\u8F91\u5668\u4E3B\u7A97\u53E3\u4E0D\u53EF\u89C1\uFF0C\u65E0\u6CD5\u622A\u56FE");
        const geometry = windowGeometry(win);
        const cached = this.cached;
        if (!args.forceFresh && (cached == null ? void 0 : cached.key) === key && cached.contents === win.webContents && cached.signature === JSON.stringify(geometry) && Date.now() - cached.time < throttle) {
          return finish(null, respond(cached.data, cached.metadata, true, cached.time));
        }
        const processImage = (image) => {
          if (settled) return;
          try {
            const sourceSize = image.getSize();
            const crop = args.crop || { x: 0, y: 0, width: sourceSize.width, height: sourceSize.height };
            if (crop.x < 0 || crop.y < 0 || crop.width <= 0 || crop.height <= 0 || crop.x + crop.width > sourceSize.width || crop.y + crop.height > sourceSize.height) throw new Error("\u88C1\u526A\u533A\u57DF\u8D85\u51FA\u622A\u56FE\u8303\u56F4");
            let finalImage = args.crop ? image.crop(crop) : image;
            const size = finalImage.getSize();
            if (!size.width || !size.height) throw new Error("\u622A\u56FE\u4E3A\u7A7A");
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
          } catch (err) {
            finish(`\u5904\u7406\u622A\u56FE\u5931\u8D25: ${err.message}`);
          }
        };
        if (win.webContents.capturePage.length > 0) win.webContents.capturePage(processImage);
        else {
          const pending = win.webContents.capturePage();
          if (pending == null ? void 0 : pending.then) pending.then(processImage, (err) => finish(err.message));
          else win.capturePage(processImage);
        }
      } catch (err) {
        finish(`\u622A\u56FE\u5931\u8D25: ${err.message}`);
      }
    };
    if (args.centerViewport) {
      Editor.Ipc.sendToPanel("scene", "scene:query-hierarchy", (err, id, hierarchy) => {
        var _a2;
        if (settled) return;
        const child = !err && ((_a2 = hierarchy == null ? void 0 : hierarchy.children) == null ? void 0 : _a2.find((node) => node.name === "Canvas"));
        if (child) Editor.Ipc.sendToPanel("scene", "scene:center-nodes", [child.id]);
        setTimeout(capture, 500);
      });
    } else capture();
  }
};
EditorScreenshot.generation = 0;
EditorScreenshot.cached = null;
EditorScreenshot.receipts = new CaptureReceipts();
function isMutatingCall(name, args) {
  const alias2 = resolveToolAlias(name, args);
  if (alias2.name !== name) return isMutatingCall(alias2.name, alias2.args);
  if (SCRIPT_TOOLS.includes(name)) return true;
  const readOnly = sceneCapabilityReadOnly(name);
  if (readOnly !== void 0) return !readOnly;
  for (const value of [projectFileReadOnly(name), editorCapabilityReadOnly(name)]) if (value !== void 0) return !value;
  if (name === "button_events") return args.action === "bind";
  if (["manage_components", "manage_asset", "manage_script", "scene_management", "prefab_management", "manage_editor", "manage_animation", "manage_material", "manage_texture", "manage_shader", "manage_undo", "manage_vfx"].includes(name)) {
    return !["get", "read", "get_info", "get_list", "get_selection", "get_state"].includes(args.action);
  }
  return ["set_node_name", "save_scene", "save_prefab", "close_prefab", "update_node_transform", "create_scene", "create_prefab", "open_scene", "open_prefab", "create_node", "execute_menu_item", "apply_text_edits", "modify_prefab_offline", "modify_scene_offline"].includes(name);
}

// src/tools/EditorInput.ts
init_ProjectContext();
var EditorInputController = class {
  constructor(env) {
    this.env = env;
    this.jobs = /* @__PURE__ */ new Map();
    this.active = null;
  }
  isBusy() {
    return !!this.active;
  }
  receipt(job) {
    return {
      jobId: job.id,
      requestKey: job.key,
      state: job.state,
      eventsSent: job.eventsSent,
      error: job.error || null,
      releasePending: !!job.held,
      target: "editor-main-window",
      nativeGameUpdateVerified: false,
      businessOutcomeVerified: false,
      projectContext: getProjectContext()
    };
  }
  release(job) {
    var _a, _b, _c, _d;
    if (!job.held) return;
    if (((_b = (_a = job.win).isDestroyed) == null ? void 0 : _b.call(_a)) || ((_d = (_c = job.win.webContents).isDestroyed) == null ? void 0 : _d.call(_c))) {
      job.held = false;
      job.error = job.error || "\u76EE\u6807\u7A97\u53E3\u5DF2\u9500\u6BC1\uFF0C\u65E7\u8F93\u5165\u5DF2\u7EC8\u6B62";
      return;
    }
    this.send(job, "mouseUp", job.last, false);
    job.held = false;
  }
  send(job, type, point, held) {
    const bounds = job.win.getContentBounds();
    job.win.webContents.sendInputEvent({
      type,
      x: Math.round(point.x),
      y: Math.round(point.y),
      globalX: Math.round(bounds.x + point.x),
      globalY: Math.round(bounds.y + point.y),
      button: "left",
      clickCount: 1,
      modifiers: held ? ["leftButtonDown"] : []
    });
    job.eventsSent++;
    job.last = point;
  }
  check(job) {
    var _a, _b, _c, _d, _e, _f;
    if (job.cancelled) throw new Error("\u8F93\u5165\u5DF2\u53D6\u6D88");
    if (((_b = (_a = job.win).isDestroyed) == null ? void 0 : _b.call(_a)) || ((_d = (_c = job.win.webContents).isDestroyed) == null ? void 0 : _d.call(_c)) || !((_f = (_e = job.win).isFocused) == null ? void 0 : _f.call(_e))) throw new Error("\u76EE\u6807\u7F16\u8F91\u5668\u7A97\u53E3\u672A\u5904\u4E8E\u524D\u53F0");
    this.env.resolve(job.coordinates);
  }
  async frame(job) {
    this.check(job);
    let timer;
    try {
      await Promise.race([this.env.frame(job.win), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("\u76EE\u6807\u6E32\u67D3\u5E27\u7B49\u5F85\u8D85\u65F6")), 1500);
      })]);
    } finally {
      clearTimeout(timer);
    }
    this.check(job);
  }
  async hold(job, ms) {
    const start = this.env.now();
    do {
      await this.frame(job);
    } while (this.env.now() - start < ms);
  }
  async run(job) {
    try {
      this.check(job);
      this.send(job, "mouseMove", job.start, false);
      job.held = true;
      this.send(job, "mouseDown", job.start, true);
      await this.hold(job, job.args.pressHoldMs);
      if (job.tool === "simulate_mouse_drag") {
        const start = this.env.now();
        let progress = 0;
        while (progress < 1) {
          await this.frame(job);
          progress = Math.min(1, (this.env.now() - start) / job.args.durationMs);
          this.send(job, "mouseMove", {
            x: job.start.x + (job.end.x - job.start.x) * progress,
            y: job.start.y + (job.end.y - job.start.y) * progress
          }, true);
        }
      }
      await this.hold(job, job.args.endHoldMs);
      this.release(job);
      job.state = "completed";
    } catch (err) {
      job.error = err.message;
      job.state = job.cancelled ? "cancelled" : "failed";
      try {
        this.release(job);
      } catch (releaseError) {
        job.error += "; \u677E\u952E\u5931\u8D25: " + releaseError.message;
      }
    } finally {
      job.finished = true;
      if (!job.held && this.active === job) this.active = null;
      this.env.invalidate();
    }
  }
  async execute(tool, args) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const action = args.action || "start";
    if (!["start", "status", "cancel"].includes(action)) throw new Error("action \u5FC5\u987B\u662F start/status/cancel");
    const existing = args.jobId ? [...this.jobs.values()].find((job2) => job2.id === args.jobId) : this.jobs.get(args.requestKey);
    if (existing && args.requestKey !== void 0 && args.requestKey !== existing.key) throw new Error("jobId \u4E0E requestKey \u4E0D\u5339\u914D");
    if (action !== "start") {
      if (!existing || existing.tool !== tool) throw new Error("\u8F93\u5165\u56DE\u6267\u4E0D\u5B58\u5728\u6216\u5C5E\u4E8E\u53E6\u4E00\u4E2A\u5DE5\u5177\uFF1B\u8BF7\u68C0\u67E5\u5B9E\u9645\u72B6\u6001\uFF0C\u4E0D\u8981\u81EA\u52A8\u91CD\u653E");
      if (args.requestKey !== void 0 && args.requestKey !== existing.key) throw new Error("jobId \u4E0E requestKey \u4E0D\u5339\u914D");
      if (action === "cancel") {
        existing.cancelled = true;
        try {
          this.release(existing);
        } catch (err) {
          existing.error = "\u677E\u952E\u5931\u8D25: " + err.message;
        }
        if (existing.finished && !existing.held && this.active === existing) {
          this.active = null;
          this.env.invalidate();
        }
        if (existing.state === "running") existing.state = "cancelled";
      }
      return this.receipt(existing);
    }
    if (typeof args.requestKey !== "string" || !args.requestKey || args.requestKey.length > 128) throw new Error("start \u9700\u8981 1\u2013128 \u5B57\u7B26\u7684\u552F\u4E00 requestKey");
    const normalized = {
      ...args,
      action: "start",
      durationMs: (_a = args.durationMs) != null ? _a : 600,
      pressHoldMs: (_b = args.pressHoldMs) != null ? _b : 100,
      endHoldMs: (_c = args.endHoldMs) != null ? _c : 100
    };
    const signature = JSON.stringify([tool, args.captureId, (_d = args.start) == null ? void 0 : _d.x, (_e = args.start) == null ? void 0 : _e.y, (_f = args.end) == null ? void 0 : _f.x, (_g = args.end) == null ? void 0 : _g.y, normalized.durationMs, normalized.pressHoldMs, normalized.endHoldMs]);
    if (existing) {
      if (existing.signature !== signature || existing.tool !== tool) throw new Error("requestKey \u5DF2\u7528\u4E8E\u4E0D\u540C\u7684\u8F93\u5165\u53C2\u6570");
      return this.receipt(existing);
    }
    for (const [name, min, max] of [["durationMs", 50, 1e4], ["pressHoldMs", 0, 2e3], ["endHoldMs", 0, 2e3], ["waitMs", 0, 2e3]]) {
      const value = name === "waitMs" ? (_h = args.waitMs) != null ? _h : 1200 : normalized[name];
      if (!Number.isFinite(value) || value < min || value > max) throw new Error(name + " \u8D85\u51FA\u5141\u8BB8\u8303\u56F4");
    }
    if (this.active) throw new Error("\u7A97\u53E3\u5B58\u5728\u5C1A\u672A\u7ED3\u675F\u6216\u672A\u91CA\u653E\u7684\u8F93\u5165\uFF1B\u8BF7\u5148\u67E5\u8BE2\u6216\u53D6\u6D88\u539F\u4EFB\u52A1");
    const coordinates = { captureId: args.captureId, points: [args.start, tool === "simulate_mouse_drag" ? args.end : args.start] };
    const points = this.env.resolve(coordinates).points;
    const win = this.env.window();
    if (typeof ((_i = win == null ? void 0 : win.webContents) == null ? void 0 : _i.sendInputEvent) !== "function" || typeof ((_j = win == null ? void 0 : win.webContents) == null ? void 0 : _j.executeJavaScript) !== "function") throw new Error("\u6B64 Creator \u7A97\u53E3\u4E0D\u652F\u6301\u539F\u751F\u8F93\u5165/\u6E32\u67D3\u5E27\u63A5\u53E3");
    const job = {
      id: "input_" + (0, import_crypto3.randomBytes)(12).toString("hex"),
      key: args.requestKey,
      signature,
      tool,
      args: normalized,
      coordinates,
      win,
      start: points[0].windowContent,
      end: points[1].windowContent,
      last: points[0].windowContent,
      state: "running",
      eventsSent: 0,
      held: false,
      cancelled: false
    };
    this.jobs.set(job.key, job);
    this.active = job;
    while (this.jobs.size > 32) {
      const oldest = [...this.jobs.values()].find((row) => row !== this.active && row.state !== "running");
      if (!oldest) break;
      this.jobs.delete(oldest.key);
    }
    const done = this.run(job);
    let timer;
    try {
      await Promise.race([done, new Promise((resolve6) => {
        var _a2;
        timer = setTimeout(resolve6, (_a2 = args.waitMs) != null ? _a2 : 1200);
      })]);
    } finally {
      clearTimeout(timer);
    }
    return this.receipt(job);
  }
  shutdown() {
    for (const job of this.jobs.values()) {
      if (job.state !== "running" && !job.held) continue;
      job.cancelled = true;
      job.state = "cancelled";
      try {
        this.release(job);
      } catch (err) {
        job.error = err.message;
      }
    }
  }
};
var EditorInput = new EditorInputController({
  window: () => Editor.Window.main.nativeWin,
  resolve: (args) => EditorScreenshot.resolveCoordinates(args),
  now: () => import_perf_hooks.performance.now(),
  frame: (win) => win.webContents.executeJavaScript("new Promise(resolve => requestAnimationFrame(() => resolve(performance.now())))", true),
  invalidate: () => EditorScreenshot.invalidate()
});

// src/main.ts
init_HttpServer();

// src/core/McpRouter.ts
init_define_MCP_BRIDGE_BUILD();
init_Logger();

// src/core/CommandQueue.ts
init_define_MCP_BRIDGE_BUILD();
init_Logger();
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
    return new Promise((resolve6, reject) => {
      _CommandQueue.commandQueue.push({ fn, resolve: resolve6, reject, onTimeout, tool, queuedAt: Date.now() });
      _CommandQueue.processNext();
    });
  }
  static processNext() {
    if (_CommandQueue.isProcessingCommand || _CommandQueue.commandQueue.length === 0) return;
    _CommandQueue.isProcessingCommand = true;
    const { fn, resolve: resolve6, onTimeout, tool, queuedAt } = _CommandQueue.commandQueue.shift();
    _CommandQueue.current = { tool, queuedAt, startedAt: Date.now(), queueWaitMs: Date.now() - queuedAt };
    let completed = false;
    const timeoutId = setTimeout(() => {
      _CommandQueue.blockPending("\u524D\u5E8F\u6307\u4EE4\u6267\u884C\u8D85\u65F6\u4E14\u5C1A\u672A\u7ED3\u675F\uFF0C\u8BF7\u7B49\u5F85\u5176\u5B8C\u6210\u6216\u91CD\u8F7D\u63D2\u4EF6");
      Logger.error("[CommandQueue] \u6307\u4EE4\u6267\u884C\u8D85\u65F6(60s)\uFF0C\u5DF2\u6682\u505C\u540E\u7EED\u6307\u4EE4");
      try {
        if (onTimeout) onTimeout();
      } finally {
        resolve6();
      }
    }, 6e4);
    const done = () => {
      if (completed) return;
      if (_CommandQueue.pendingSceneCalls > 0) {
        _CommandQueue.deferredDone = done;
        resolve6();
        return;
      }
      completed = true;
      _CommandQueue.last = { ..._CommandQueue.current, completedAt: Date.now() };
      _CommandQueue.current = null;
      clearTimeout(timeoutId);
      _CommandQueue.deferredDone = null;
      _CommandQueue.blockedReason = "";
      _CommandQueue.isProcessingCommand = false;
      resolve6();
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

// src/tools/ToolRegistry.ts
init_define_MCP_BRIDGE_BUILD();
init_ToolCapabilities();
init_SceneCapabilities();
init_ProjectFiles();
init_EditorCapabilities();
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

// src/tools/ToolDispatcher.ts
init_define_MCP_BRIDGE_BUILD();
init_ProjectContext();
init_AtomicFile();

// src/tools/ToolValidation.ts
init_define_MCP_BRIDGE_BUILD();

// src/tools/BatchOperations.ts
init_define_MCP_BRIDGE_BUILD();
init_AssetUrl();
init_BoundedValue();
var forbiddenKeys = /* @__PURE__ */ new Set(["__proto__", "prototype", "constructor"]);
function mapReferences(value, resolve6) {
  if (Array.isArray(value)) return value.map((item) => mapReferences(item, resolve6));
  if (value && typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "$ref")) {
      if (Object.keys(value).length !== 1 || typeof value.$ref !== "string") throw new Error("$ref \u5FC5\u987B\u662F\u5355\u72EC\u7684\u5B57\u7B26\u4E32\u5F15\u7528");
      return resolve6(value.$ref);
    }
    const result = {};
    for (const key of Object.keys(value)) {
      if (forbiddenKeys.has(key)) throw new Error(`\u4E0D\u5141\u8BB8\u7684\u53C2\u6570\u5B57\u6BB5: ${key}`);
      result[key] = mapReferences(value[key], resolve6);
    }
    return result;
  }
  return value;
}
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
var SCENE_BATCH_METHODS = {
  create_node: "create-node",
  update_node_transform: "update-node-transform",
  manage_components: "manage-components",
  get_scene_hierarchy: "get-hierarchy",
  find_gameobjects: "find-gameobjects"
};
function executeBatch(args, tools, dispatch, callback, options = {}) {
  const operations = args == null ? void 0 : args.operations;
  const schemas = new Map(tools.map((tool) => [tool.name, tool.inputSchema]));
  try {
    if (!Array.isArray(operations) || !operations.length || operations.length > 100) throw new Error("operations \u5FC5\u987B\u5305\u542B 1\u2013100 \u4E2A\u64CD\u4F5C");
    if (args.stopOnError !== void 0 && typeof args.stopOnError !== "boolean") throw new Error("stopOnError \u5FC5\u987B\u4E3A boolean");
    if (args.executionMode !== void 0 && !["auto", "serial", "scene"].includes(args.executionMode)) throw new Error("executionMode \u5FC5\u987B\u4E3A auto\u3001serial \u6216 scene");
    if (args.maxResultBytes !== void 0 && (!Number.isInteger(args.maxResultBytes) || args.maxResultBytes < 1024 || args.maxResultBytes > 4 * 1024 * 1024)) throw new Error("maxResultBytes \u5FC5\u987B\u4E3A 1024\u20134194304");
    if (args.outputMode && !["full", "summary"].includes(args.outputMode)) throw new Error("outputMode \u5FC5\u987B\u4E3A full \u6216 summary");
    if (args.resultFields && (!Array.isArray(args.resultFields) || args.resultFields.length > 100 || args.resultFields.some((k) => typeof k !== "string" || forbiddenKeys.has(k)))) throw new Error("resultFields \u65E0\u6548");
    const ids = /* @__PURE__ */ new Set();
    operations.forEach((op, i) => {
      if (!op || typeof op !== "object" || op.tool === "batch_execute" || !schemas.has(op.tool)) throw new Error(`\u64CD\u4F5C ${i}: \u672A\u77E5\u5DE5\u5177\u6216\u4E0D\u5141\u8BB8\u5D4C\u5957\u6279\u5904\u7406`);
      if (op.id !== void 0 && (typeof op.id !== "string" || !/^[A-Za-z][\w-]*$/.test(op.id) || ids.has(op.id) || forbiddenKeys.has(op.id))) throw new Error(`\u64CD\u4F5C ${i}: id \u65E0\u6548\u6216\u91CD\u590D`);
      mapReferences(op.params, (ref) => {
        const parts = ref.split(".");
        if (!ids.has(parts[0]) || parts.some((key) => !key || forbiddenKeys.has(key))) throw new Error(`\u64CD\u4F5C ${i}: \u5F15\u7528\u53EA\u80FD\u6307\u5411\u524D\u9762\u64CD\u4F5C\u7684 id: ${ref}`);
        return null;
      });
      validate(op.params, schemas.get(op.tool), `\u64CD\u4F5C ${i}.params`, true);
      validateConditional(op.tool, op.params);
      if (op.id) ids.add(op.id);
    });
  } catch (err) {
    callback(`\u6279\u5904\u7406\u9884\u68C0\u5931\u8D25: ${err.message}`);
    return;
  }
  const results = [], completed = /* @__PURE__ */ new Map();
  let index = 0, usedBytes = 0, retainedBytes = 0;
  const retainedSizes = /* @__PURE__ */ new Map();
  const budget = args.maxResultBytes || 2 * 1024 * 1024;
  const lastUse = /* @__PURE__ */ new Map();
  operations.forEach((op, i) => mapReferences(op.params, (ref) => {
    lastUse.set(ref.split(".")[0], i);
    return null;
  }));
  const next = () => {
    if (options.deadlineAt && Date.now() >= options.deadlineAt) {
      callback("\u573A\u666F\u6279\u5904\u7406\u5DF2\u8D85\u65F6\uFF1B\u5DF2\u6267\u884C\u6B65\u9AA4\u4E0D\u4F1A\u56DE\u6EDA\uFF0C\u7981\u6B62\u6574\u6279\u91CD\u653E", {
        results,
        executedCount: index,
        nextOperationIndex: index < operations.length ? index : null,
        remainingCount: operations.length - index,
        reason: "deadline"
      });
      return;
    }
    if (index === operations.length) {
      const failures = results.filter((item) => item.error).length;
      callback(failures ? `\u6279\u5904\u7406\u6709 ${failures} \u4E2A\u64CD\u4F5C\u5931\u8D25` : null, results);
      return;
    }
    const op = operations[index];
    let replied = false;
    const finish = (err, result) => {
      if (replied) return;
      replied = true;
      const error = err ? String(err.message || err) : null;
      const selected = args.resultFields && result && typeof result === "object" ? Object.fromEntries(args.resultFields.filter((key) => Object.prototype.hasOwnProperty.call(result, key)).map((key) => [key, result[key]])) : result;
      const limited = boundedValue(selected, Math.max(32, budget - usedBytes - 2048), 16);
      const entry = { tool: op.tool, error, result: args.outputMode === "summary" ? { completed: !error } : limited.value, ...op.id ? { id: op.id } : {} };
      results.push(entry);
      usedBytes += Buffer.byteLength(JSON.stringify(entry));
      let referenceOverflow = false;
      if (op.id && lastUse.has(op.id)) {
        const retained = boundedValue(result, 4 * 1024 * 1024 - retainedBytes, 24);
        referenceOverflow = retained.truncated;
        if (!referenceOverflow) {
          const size = Buffer.byteLength(JSON.stringify(retained.value) || "null");
          retainedBytes += size;
          retainedSizes.set(op.id, size);
          completed.set(op.id, { error, result });
        }
      }
      for (const [id, until] of lastUse) if (until <= index) {
        completed.delete(id);
        retainedBytes -= retainedSizes.get(id) || 0;
        retainedSizes.delete(id);
      }
      index++;
      if (referenceOverflow || usedBytes >= budget - 2048 || args.outputMode !== "summary" && limited.truncated) {
        callback("\u6279\u5904\u7406\u7ED3\u679C\u9884\u7B97\u5DF2\u8FBE\u4E0A\u9650\uFF1B\u5DF2\u6267\u884C\u6B65\u9AA4\u4E0D\u4F1A\u56DE\u6EDA\uFF0C\u7981\u6B62\u6574\u6279\u91CD\u653E\u3002\u8BF7\u4ECE\u672A\u6267\u884C\u7684\u6B65\u9AA4\u7EE7\u7EED", {
          results,
          executedCount: index,
          nextOperationIndex: index < operations.length ? index : null,
          remainingCount: operations.length - index,
          resultTruncated: true,
          reason: referenceOverflow ? "referenceBudget" : "outputBudget"
        });
        return;
      }
      if (error && args.stopOnError !== false) {
        callback(`\u6279\u5904\u7406\u5728\u64CD\u4F5C ${index - 1} (${op.tool}) \u5931\u8D25\uFF0C\u540E\u7EED\u672A\u6267\u884C: ${error}`, results);
      } else {
        Promise.resolve().then(next);
      }
    };
    try {
      const params = mapReferences(op.params, (ref) => {
        const [id, ...keys] = ref.split(".");
        const prior = completed.get(id);
        if (!prior || prior.error) throw new Error(`\u5F15\u7528\u7684\u64CD\u4F5C\u672A\u6210\u529F: ${ref}`);
        let value = prior.result;
        for (const key of keys) {
          if (value === null || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, key)) throw new Error(`\u7ED3\u679C\u4E2D\u4E0D\u5B58\u5728\u5F15\u7528: ${ref}`);
          value = value[key];
        }
        if (value === void 0) throw new Error(`\u7ED3\u679C\u5F15\u7528\u4E3A\u7A7A: ${ref}`);
        return mapReferences(value, () => {
          throw new Error("\u7ED3\u679C\u4E0D\u80FD\u5305\u542B\u5D4C\u5957 $ref");
        });
      });
      validate(params, schemas.get(op.tool), `\u64CD\u4F5C ${index}.params`);
      validateConditional(op.tool, params);
      dispatch(op.tool, params, finish);
    } catch (err) {
      finish(err);
    }
  };
  next();
}

// src/tools/ToolValidation.ts
init_ToolCapabilities();
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

// src/tools/ToolPresetStore.ts
init_define_MCP_BRIDGE_BUILD();
var fs5 = __toESM(require("fs"));
var path4 = __toESM(require("path"));
init_AtomicFile();

// src/tools/ToolProfiles.ts
init_define_MCP_BRIDGE_BUILD();
init_ToolCapabilities();
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
  const file = project && path4.join(project, "settings", filename);
  if (!file || !fs5.existsSync(file)) return { version: 1, active: "\u5168\u90E8", presets: [
    { name: "\u5168\u90E8", profile: "full", enabled: [], disabled: [] },
    { name: "UI", profile: "ui", enabled: [], disabled: [] }
  ] };
  if (fs5.statSync(file).size > 128 * 1024) throw new Error("\u5DE5\u5177\u9884\u8BBE\u6587\u4EF6\u8D85\u8FC7128KiB");
  return validateToolPresets(JSON.parse(fs5.readFileSync(file, "utf8")), tools);
}
function saveToolPresets(project, value, tools) {
  const state = validateToolPresets(value, tools);
  const dir = path4.join(project, "settings");
  fs5.mkdirSync(dir, { recursive: true });
  const file = path4.join(dir, filename), previous = fs5.existsSync(file) ? fs5.readFileSync(file) : void 0;
  atomicWrite(file, JSON.stringify(state, null, 2) + "\n", previous);
  return state;
}
function configuredTools(project, tools, env = typeof process === "undefined" ? {} : process.env || {}) {
  const state = readToolPresets(project, tools);
  const merged = presetEnvironment(state.presets.find((item) => item.name === state.active));
  for (const key of Object.keys(merged)) if (env[key] !== void 0) merged[key] = env[key];
  return selectToolProfile(tools, merged);
}

// src/tools/ToolDispatcher.ts
init_ToolCapabilities();
init_SceneCapabilities();
init_ProjectFiles();
init_EditorCapabilities();
init_ProjectContext();
var fs13 = __toESM(require("fs"));
var pathModule2 = __toESM(require("path"));
var crypto7 = __toESM(require("crypto"));
init_Logger();

// src/utils/AssetPatcher.ts
init_define_MCP_BRIDGE_BUILD();
init_AssetUrl();
var fs6 = __toESM(require("fs"));
var os = __toESM(require("os"));
var pathMod = __toESM(require("path"));
var crypto3 = __toESM(require("crypto"));
init_Logger();
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
    return crypto3.randomBytes(16).toString("base64").replace(/\+/g, "/").replace(/=/g, "").substring(0, 22);
  }
  /**
   * 修复预制体文件中根节点的空 fileId 问题
   */
  static fixPrefabRootFileId(prefabFspath) {
    try {
      if (!fs6.existsSync(prefabFspath)) {
        Logger.warn(`[fixPrefabRootFileId] \u9884\u5236\u4F53\u6587\u4EF6\u4E0D\u5B58\u5728: ${prefabFspath}`);
        return false;
      }
      const content = fs6.readFileSync(prefabFspath, "utf8");
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
        fs6.writeFileSync(prefabFspath, JSON.stringify(data, null, 2), "utf8");
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
  static safeCreateAsset(path12, content, originalCallback, postCreateModifier = null) {
    try {
      validateAssetUrl(path12);
    } catch (err) {
      originalCallback(err);
      return;
    }
    const fileName = path12.substring(path12.lastIndexOf("/") + 1);
    let currentUrl = path12.substring(0, path12.lastIndexOf("/"));
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
    const tempBase = pathMod.join(os.tmpdir(), "mcp_v8_" + crypto3.randomBytes(12).toString("hex"));
    let deepTempPath = tempBase;
    for (let i = 0; i < missingDirs.length; i++) {
      deepTempPath = pathMod.join(deepTempPath, missingDirs[i]);
    }
    try {
      fs6.mkdirSync(deepTempPath, { recursive: true });
      const fileTempPath = pathMod.join(deepTempPath, fileName);
      fs6.writeFileSync(fileTempPath, content);
    } catch (e) {
      try {
        fs6.rmdirSync(tempBase, { recursive: true });
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
      CommandQueue.blockPending(`\u8D44\u6E90\u5BFC\u5165\u5C1A\u672A\u786E\u8BA4: ${path12}\uFF0C\u7981\u6B62\u76F4\u63A5\u91CD\u8BD5`);
      originalCallback(`\u8D44\u6E90\u5BFC\u5165\u8D85\u65F6\uFF0C\u7ED3\u679C\u672A\u77E5\uFF0C\u540E\u7EED\u64CD\u4F5C\u5DF2\u6682\u505C: ${path12}`);
    }, 3e4);
    const doneCreate = (err, msg) => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      try {
        fs6.rmdirSync(tempBase, { recursive: true });
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
          doneCreate(null, `\u8D44\u6E90\u5DF2\u5B89\u5168\u539F\u751F\u5BFC\u5165: ${path12}`);
        }
      });
    } catch (err) {
      doneCreate(err);
    }
  }
};

// src/utils/OfflinePrefabEditor.ts
init_define_MCP_BRIDGE_BUILD();
var fs7 = __toESM(require("fs"));
var crypto4 = __toESM(require("crypto"));
init_Logger();
var path5 = __toESM(require("path"));
init_SerializedValidation();
var OfflinePrefabEditor = class {
  /**
   * 生成 22 位 Base64 URL-safe 随机字符串，用作预制体 fileId
   */
  static generateFileId() {
    return crypto4.randomBytes(16).toString("base64").replace(/\+/g, "/").replace(/=/g, "").substring(0, 22);
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
      const existed = fs7.existsSync(prefabFsPath);
      if (existed && fs7.statSync(prefabFsPath).size > 32 * 1024 * 1024) throw new Error("\u79BB\u7EBF\u8D44\u6E90\u8D85\u8FC732MiB\u4E0A\u9650\uFF0C\u8BF7\u62C6\u5206\u5904\u7406");
      const content = existed ? fs7.readFileSync(prefabFsPath, "utf8") : null;
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
      let parent = path5.dirname(prefabFsPath);
      const missing = [];
      while (!fs7.existsSync(parent)) {
        missing.unshift(parent);
        parent = path5.dirname(parent);
      }
      for (const dir of missing) {
        fs7.mkdirSync(dir);
        createdDirs.push(dir);
      }
      tempPath = path5.join(path5.dirname(prefabFsPath), ".mcp-" + path5.basename(prefabFsPath) + "-" + crypto4.randomBytes(8).toString("hex") + ".tmp");
      fs7.writeFileSync(tempPath, output, { encoding: "utf8", flag: "wx" });
      if (existed) {
        if (fs7.readFileSync(prefabFsPath, "utf8") !== content) throw new Error("\u63D0\u4EA4\u524D\u8D44\u6E90\u5DF2\u88AB\u5916\u90E8\u4FEE\u6539\uFF0C\u672A\u8986\u76D6\u76EE\u6807");
        fs7.renameSync(tempPath, prefabFsPath);
      } else {
        fs7.linkSync(tempPath, prefabFsPath);
      }
      return { success: true, validation };
    } catch (e) {
      Logger.error(`[OfflineEditor] \u4FEE\u6539\u672A\u63D0\u4EA4: ${e.message}`);
      return { success: false, error: e.message };
    } finally {
      try {
        if (tempPath && fs7.existsSync(tempPath)) fs7.unlinkSync(tempPath);
      } catch (e) {
        Logger.warn(`[OfflineEditor] \u4E34\u65F6\u6587\u4EF6\u6E05\u7406\u5931\u8D25: ${tempPath}: ${e.message}`);
      }
      for (const dir of createdDirs.reverse()) {
        try {
          fs7.rmdirSync(dir);
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
  static findNodeByPath(data, path12) {
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
    if (!path12 || path12 === "" || path12 === "/") {
      return currentNodeIdx;
    }
    let segments = path12.split("/").filter((s) => s !== "");
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

// src/core/McpWrappers.ts
init_define_MCP_BRIDGE_BUILD();
init_AtomicFile();
var fs9 = __toESM(require("fs"));
var crypto5 = __toESM(require("crypto"));
init_Logger();

// src/tools/ProjectSearch.ts
init_define_MCP_BRIDGE_BUILD();
var vm2 = __toESM(require("vm"));
var fs8 = __toESM(require("fs"));
var path6 = __toESM(require("path"));
var import_crypto4 = require("crypto");
var directoryCache = /* @__PURE__ */ new Map();
async function directoryEntries(dir) {
  const stat = await fs8.promises.stat(dir);
  const identity = String(stat.dev) + ":" + stat.ino + ":" + stat.mtimeMs + ":" + stat.ctimeMs;
  const cached = directoryCache.get(dir);
  if ((cached == null ? void 0 : cached.identity) === identity && Date.now() - cached.time < 2e3) return cached.entries;
  const entries = (await fs8.promises.readdir(dir, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  if (directoryCache.size >= 128) directoryCache.delete(directoryCache.keys().next().value);
  directoryCache.set(dir, { identity, time: Date.now(), entries });
  return entries;
}
async function* readLines(file, start, maxBytes) {
  const stream = fs8.createReadStream(file, { start, end: maxBytes - 1 });
  let parts = [], position = start;
  try {
    for await (const raw of stream) {
      const chunk = raw;
      let from = 0, end;
      while ((end = chunk.indexOf(10, from)) !== -1) {
        parts.push(chunk.subarray(from, end));
        position += end - from + 1;
        yield { text: Buffer.concat(parts).toString("utf8").replace(/\r$/, ""), offset: position, finished: false };
        parts = [];
        from = end + 1;
      }
      parts.push(chunk.subarray(from));
      position += chunk.length - from;
    }
    yield { text: Buffer.concat(parts).toString("utf8").replace(/\r$/, ""), offset: position, finished: true };
  } finally {
    stream.destroy();
  }
}
async function searchProject(args, root, assetsRoot) {
  var _a, _b, _c;
  if (typeof args.query !== "string") throw new Error("query \u5FC5\u987B\u4E3A\u5B57\u7B26\u4E32");
  const mode = args.matchType || "content", limit = (_a = args.pageSize) != null ? _a : 500;
  const maxBytes = (_b = args.maxFileBytes) != null ? _b : 4 * 1024 * 1024, previewLength = (_c = args.maxPreviewLength) != null ? _c : 500;
  if (!["content", "file_name", "dir_name"].includes(mode)) throw new Error("\u65E0\u6548\u641C\u7D22\u6A21\u5F0F");
  if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw new Error("pageSize \u5FC5\u987B\u4E3A 1\u2013500");
  if (!Number.isInteger(maxBytes) || maxBytes < 1 || maxBytes > 32 * 1024 * 1024) throw new Error("maxFileBytes \u5FC5\u987B\u4E3A 1\u201333554432");
  if (!Number.isInteger(previewLength) || previewLength < 1 || previewLength > 1e4) throw new Error("maxPreviewLength \u5FC5\u987B\u4E3A 1\u201310000");
  const extensions = args.extensions || [".js", ".ts", ".json", ".fire", ".prefab", ".xml", ".txt", ".md"];
  if (!Array.isArray(extensions) || extensions.some((x) => typeof x !== "string")) throw new Error("extensions \u5FC5\u987B\u4E3A\u5B57\u7B26\u4E32\u6570\u7EC4");
  const regex = args.useRegex ? new RegExp(args.query) : null;
  if (args.query.length > 2048) throw new Error("query \u8D85\u8FC72048\u5B57\u7B26\u4E0A\u9650");
  const context = regex ? vm2.createContext({ regex, text: "" }) : null;
  const evaluate = regex ? new vm2.Script("regex.test(text)") : null;
  const matches = (text) => {
    if (!regex) return text.includes(args.query);
    context.text = text;
    try {
      return evaluate.runInContext(context, { timeout: 250 });
    } catch (cause) {
      const err = new Error("\u6B63\u5219\u8868\u8FBE\u5F0F\u6267\u884C\u8D85\u65F6\u6216\u5931\u8D25\uFF0C\u8BF7\u7B80\u5316\u8868\u8FBE\u5F0F: " + cause.message);
      err.searchCursor = true;
      throw err;
    } finally {
      context.text = "";
    }
  };
  const signature = (0, import_crypto4.createHash)("sha256").update(JSON.stringify([2, root, args.query, !!args.useRegex, mode, extensions, args.includeSubpackages !== false, maxBytes])).digest("hex");
  let cursor = null;
  if (args.cursor !== void 0) {
    try {
      cursor = JSON.parse(Buffer.from(args.cursor, "base64").toString("utf8"));
    } catch (_) {
      throw new Error("\u641C\u7D22\u6E38\u6807\u65E0\u6548");
    }
    if ((cursor == null ? void 0 : cursor.signature) !== signature || typeof cursor.file !== "string" || !Number.isInteger(cursor.line) || cursor.line < 0 || !Number.isInteger(cursor.offset) || cursor.offset < 0 || cursor.offset > maxBytes) throw new Error("\u641C\u7D22\u6E38\u6807\u4E0E\u672C\u6B21\u6761\u4EF6\u4E0D\u4E00\u81F4");
  }
  const results = [], positions = [], stats = { scannedFiles: 0, skippedLargeFiles: 0, skippedUnreadable: 0, skippedSymlinks: 0 };
  let resumed = !cursor, more = false, work = 0, timedOut = false, progress = null;
  const deadline = Date.now() + 2e4;
  const pause = async () => {
    if (++work % 128 === 0) await new Promise((resolve6) => setTimeout(resolve6, 0));
  };
  const stopped = () => more || (timedOut = Date.now() > deadline);
  const dbUrl = (file) => "db://assets/" + path6.relative(assetsRoot, file).split(path6.sep).join("/");
  const add = (result, stamp, offset = 0, finished = false) => {
    if (results.length === limit) {
      more = true;
      return;
    }
    results.push(result);
    positions.push({ file: result.filePath, line: result.line || 0, stamp, offset, finished });
  };
  const walk = async (dir) => {
    const entries = await directoryEntries(dir);
    for (const entry of entries) {
      if (stopped()) return;
      await pause();
      const name = entry.name;
      if (name.startsWith(".") || ["node_modules", "bin", "local", "library", "temp"].includes(name)) continue;
      if (entry.isSymbolicLink()) {
        stats.skippedSymlinks++;
        continue;
      }
      const file = path6.join(dir, name), url = dbUrl(file);
      let resumeLine = -1;
      if (!resumed && url === cursor.file) {
        resumed = true;
        resumeLine = cursor.line;
      }
      if (resumed) progress = { file: url, line: 0, stamp: null, offset: 0 };
      if (entry.isDirectory()) {
        if (!resumed && !cursor.file.startsWith(url + "/")) continue;
        if (resumed && mode === "dir_name" && resumeLine < 0 && matches(name)) add({ filePath: url, type: "directory", name }, null);
        if (!stopped() && args.includeSubpackages !== false) {
          try {
            await walk(file);
          } catch (e) {
            if (e.searchCursor) throw e;
            stats.skippedUnreadable++;
          }
        }
        continue;
      }
      if (!resumed || !extensions.includes(path6.extname(name).toLowerCase())) continue;
      stats.scannedFiles++;
      if (mode === "file_name") {
        if (resumeLine < 0 && matches(name)) add({ filePath: url, type: "file", name }, null);
        continue;
      }
      if (mode !== "content") continue;
      try {
        const stat = await fs8.promises.stat(file), stamp = `${stat.mtimeMs}:${stat.size}`;
        if (resumeLine >= 0 && cursor.stamp !== null && cursor.stamp !== stamp) {
          const err = new Error("\u6E38\u6807\u6240\u5728\u6587\u4EF6\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u641C\u7D22");
          err.searchCursor = true;
          throw err;
        }
        if (resumeLine >= 0 && cursor.finished) continue;
        progress = { file: url, line: Math.max(0, resumeLine), stamp, offset: resumeLine >= 0 ? cursor.offset : 0 };
        if (stat.size > maxBytes) {
          stats.skippedLargeFiles++;
          continue;
        }
        let lineNumber = Math.max(0, resumeLine);
        for await (const item of readLines(file, progress.offset, maxBytes)) {
          await pause();
          if (stopped()) break;
          lineNumber++;
          progress = { file: url, line: lineNumber, stamp, offset: item.offset, finished: item.finished };
          const line = item.text;
          if (!matches(line)) continue;
          const text = line.trim();
          let end = previewLength;
          if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
          add({
            filePath: url,
            line: lineNumber,
            content: text.slice(0, end),
            ...text.length > previewLength ? { contentTruncated: true, contentLength: text.length } : {}
          }, stamp, item.offset, item.finished);
          if (more) break;
        }
      } catch (e) {
        if (e.searchCursor) throw e;
        stats.skippedUnreadable++;
      }
    }
  };
  if (!(await fs8.promises.stat(root)).isDirectory()) throw new Error("\u641C\u7D22\u8D77\u70B9\u5FC5\u987B\u662F\u76EE\u5F55");
  await walk(root);
  if (!resumed) throw new Error("\u6E38\u6807\u4F4D\u7F6E\u5DF2\u4E0D\u5B58\u5728\uFF0C\u8BF7\u91CD\u65B0\u641C\u7D22");
  const next = more ? positions[positions.length - 1] : timedOut ? progress : null;
  const nextCursor = next ? Buffer.from(JSON.stringify({ signature, ...next })).toString("base64") : null;
  const metadata = args.includeMetadata || args.pageSize !== void 0 || args.cursor !== void 0;
  if (!metadata && (timedOut || stats.skippedUnreadable || stats.skippedLargeFiles || stats.skippedSymlinks)) {
    throw new Error(`\u641C\u7D22\u4E0D\u5B8C\u6574\uFF08\u8D85\u65F6:${timedOut}\uFF0C\u4E0D\u53EF\u8BFB:${stats.skippedUnreadable}\uFF0C\u8FC7\u5927:${stats.skippedLargeFiles}\uFF0C\u94FE\u63A5:${stats.skippedSymlinks}\uFF09\uFF0C\u8BF7\u6307\u5B9A includeMetadata:true \u67E5\u770B\u90E8\u5206\u7ED3\u679C\u4E0E\u7EE7\u7EED\u6E38\u6807`);
  }
  return metadata ? { results, nextCursor, truncated: more || timedOut, timedOut, ...stats } : results;
}

// src/core/McpWrappers.ts
var McpWrappers = class {
  static getResourcesList() {
    return [
      {
        uri: "cocos://hierarchy",
        name: "Scene Hierarchy",
        description: "\u5F53\u524D\u573A\u666F\u5C42\u7EA7\u7684 JSON \u5FEB\u7167",
        mimeType: "application/json"
      },
      {
        uri: "cocos://selection",
        name: "Current Selection",
        description: "\u5F53\u524D\u9009\u4E2D\u8282\u70B9\u7684 UUID \u5217\u8868",
        mimeType: "application/json"
      },
      {
        uri: "cocos://logs/latest",
        name: "Editor Logs",
        description: "\u6700\u65B0\u7684\u7F16\u8F91\u5668\u65E5\u5FD7 (\u5185\u5B58\u7F13\u5B58)",
        mimeType: "text/plain"
      }
    ];
  }
  /**
   * 读取指定的 MCP 资源内容
   * @param {string} uri 资源统一资源标识符 (URI)
   * @param {Function} callback 完成回调 (err, content)
   */
  static handleReadResource(uri, callback) {
    let parsed;
    try {
      parsed = new URL(uri);
    } catch (e) {
      return callback(`Invalid URI: ${uri}`);
    }
    if (parsed.protocol !== "cocos:") {
      return callback(`Unsupported protocol: ${parsed.protocol}`);
    }
    const type = parsed.hostname;
    switch (type) {
      case "hierarchy":
        Editor.Ipc.sendToPanel("scene", "scene:query-hierarchy", (err, sceneId, hierarchy) => {
          if (err) return callback(err);
          callback(null, JSON.stringify(hierarchy, null, 2));
        });
        break;
      case "selection":
        const selection = Editor.Selection.curSelection("node");
        callback(null, JSON.stringify(selection));
        break;
      case "logs":
        callback(null, Logger.getLogContent());
        break;
      default:
        callback(`Resource not found: ${uri}`);
        break;
    }
  }
  /**
   * 处理来自 HTTP 的 MCP 调用请求
   * @param {string} name 工具名称
   * @param {Object} args 工具参数
   * @param {Function} callback 完成回调 (err, result)
   */
  static searchProject(args, callback) {
    let rootUrl = args.path || "db://assets";
    if (rootUrl === "db://" || rootUrl === "db:") rootUrl = "db://assets";
    const root = Editor.assetdb.urlToFspath(rootUrl);
    if (!root) return callback(`\u65E0\u6548\u7684\u641C\u7D22\u8DEF\u5F84: ${rootUrl}`);
    searchProject(args, root, Editor.assetdb.urlToFspath("db://assets")).then((result) => callback(null, result), (err) => callback(`\u9879\u76EE\u641C\u7D22\u5931\u8D25: ${err.message}`));
  }
  /**
   * 管理撤销/重做操作及事务分组
   * @param {Object} args 参数 (action, description, id)
   * @param {Function} callback 完成回调
   */
  static manageUndo(args, callback) {
    const { action } = args;
    if (["begin_group", "end_group", "cancel_group"].includes(action)) {
      CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "manage-undo-group", args, callback);
      return;
    }
    try {
      switch (action) {
        case "undo":
          Editor.Ipc.sendToPanel("scene", "scene:undo");
          callback(null, "\u64A4\u9500\u6307\u4EE4\u5DF2\u6267\u884C");
          break;
        case "redo":
          Editor.Ipc.sendToPanel("scene", "scene:redo");
          callback(null, "\u91CD\u505A\u6307\u4EE4\u5DF2\u6267\u884C");
          break;
        default:
          callback(`\u672A\u77E5\u7684\u64A4\u9500\u64CD\u4F5C: ${action}`);
      }
    } catch (err) {
      callback(`\u64A4\u9500\u64CD\u4F5C\u5931\u8D25: ${err.message}`);
    }
  }
  /**
   * 计算资源的 SHA-256 哈希值
   * @param {Object} args 参数 (path)
   * @param {Function} callback 完成回调
   */
  static async getSha(args, callback) {
    const { path: url } = args;
    const fspath = Editor.assetdb.urlToFspath(url);
    if (!fspath || !fs9.existsSync(fspath)) {
      return callback(`\u627E\u4E0D\u5230\u6587\u4EF6: ${url}`);
    }
    try {
      const fileBuffer = await readBounded(fspath, 32 * 1024 * 1024);
      const hashSum = crypto5.createHash("sha256");
      hashSum.update(fileBuffer);
      const sha = hashSum.digest("hex");
      callback(null, { path: url, sha });
    } catch (err) {
      callback(`\u8BA1\u7B97 SHA \u5931\u8D25: ${err.message}`);
    }
  }
  /**
   * 管理节点动画 (播放、停止、获取信息等)
   * @param {Object} args 参数
   * @param {Function} callback 完成回调
   */
  static manageAnimation(args, callback) {
    CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "manage-animation", args, callback);
  }
};

// src/tools/EditorSceneTools.ts
init_define_MCP_BRIDGE_BUILD();
var EditorSceneTools = class {
  static open(url, prefab, callback, onSettled) {
    let uuid;
    try {
      uuid = Editor.assetdb.urlToUuid(url);
    } catch (err) {
      onSettled();
      callback(err);
      return;
    }
    if (!uuid) {
      onSettled();
      callback(`\u627E\u4E0D\u5230\u8DEF\u5F84\u4E3A ${url} \u7684\u8D44\u6E90`);
      return;
    }
    const complete = CommandQueue.trackEditorOperation();
    let finished = false;
    let reported = false;
    let pollTimer;
    const finish = (err, state) => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      clearTimeout(pollTimer);
      complete();
      onSettled();
      if (!reported) {
        reported = true;
        callback(err, state);
      }
    };
    const deadline = setTimeout(() => {
      reported = true;
      CommandQueue.blockPending(`\u6253\u5F00\u8D44\u6E90\u8D85\u65F6\u4E14\u72B6\u6001\u5C1A\u672A\u786E\u8BA4: ${url}\uFF0C\u7B49\u5F85\u5B8C\u6210\u6216\u91CD\u8F7D\u63D2\u4EF6`);
      callback(`\u6253\u5F00\u8D44\u6E90\u8D85\u65F6: ${url}\uFF0C\u672A\u62A5\u544A\u6210\u529F\uFF0C\u540E\u7EED\u64CD\u4F5C\u5DF2\u6682\u505C`);
    }, 3e4);
    const poll = () => {
      if (finished) return;
      let replied = false;
      const retry = setTimeout(() => {
        replied = true;
        pollTimer = setTimeout(poll, reported ? 1e3 : 200);
      }, 2e3);
      try {
        Editor.Scene.callSceneScript("mcp-bridge", "get-edit-state", {}, (err, state) => {
          if (finished || replied) return;
          replied = true;
          clearTimeout(retry);
          const ready = !err && state && (prefab ? state.mode === "prefab" && state.prefabUuid === uuid : state.mode === "scene" && state.sceneUuid === uuid);
          if (ready) finish(null, { url, uuid, mode: state.mode, ready: true });
          else pollTimer = setTimeout(poll, reported ? 1e3 : 200);
        });
      } catch (e) {
        clearTimeout(retry);
        finish(e);
      }
    };
    try {
      if (prefab) Editor.Ipc.sendToAll("scene:enter-prefab-edit-mode", uuid);
      else Editor.Ipc.sendToMain("scene:open-by-uuid", uuid);
      poll();
    } catch (e) {
      finish(e);
    }
  }
};

// src/tools/AssetDependencies.ts
init_define_MCP_BRIDGE_BUILD();
var fs10 = __toESM(require("fs"));
var path7 = __toESM(require("path"));
init_AssetUrl();
init_AtomicFile();
async function inspectAssetDependencies(args, assetdb) {
  var _a, _b, _c;
  const limit = (_a = args.limit) != null ? _a : 500;
  if (!Number.isInteger(limit) || limit < 1 || limit > 2e3) throw new Error("limit \u5FC5\u987B\u4E3A 1\u20132000");
  let url = args.target;
  if (typeof url !== "string" || !url) throw new Error("target \u5FC5\u987B\u4E3A\u8D44\u6E90 UUID \u6216 db://assets/ URL");
  if (!url.startsWith("db://")) url = assetdb.uuidToUrl(url);
  validateAssetUrl(url);
  if (isAssetRoot(url) || !/\.(prefab|fire|anim|mtl|json)$/i.test(url)) throw new Error("\u8BF7\u9009\u62E9\u5177\u4F53\u7684\u5E8F\u5217\u5316 JSON \u8D44\u6E90");
  const root = fs10.realpathSync(assetdb.urlToFspath("db://assets"));
  const file = fs10.realpathSync(assetdb.urlToFspath(url));
  const relative5 = path7.relative(root, file);
  if (!relative5 || relative5.startsWith(".." + path7.sep) || path7.isAbsolute(relative5)) throw new Error("\u8D44\u6E90\u6587\u4EF6\u8D85\u51FA\u5F53\u524D assets \u76EE\u5F55");
  const source = JSON.parse((await readBounded(file, 8 * 1024 * 1024)).toString("utf8"));
  const refs = /* @__PURE__ */ new Map();
  let scanned = 0, truncated = false;
  const visit = (value, location, depth) => {
    if (++scanned > 1e5 || depth > 64) throw new Error("\u8D44\u6E90\u7ED3\u6784\u8D85\u51FA\u68C0\u67E5\u9884\u7B97");
    if (!value || typeof value !== "object") return;
    if (typeof value.__uuid__ === "string" && value.__uuid__) {
      if (!refs.has(value.__uuid__)) {
        if (refs.size >= limit) {
          truncated = true;
          return;
        }
        refs.set(value.__uuid__, []);
      }
      const locations = refs.get(value.__uuid__);
      if (locations.length < 10) locations.push(location);
    }
    for (const key of Object.keys(value)) visit(value[key], `${location}.${key}`, depth + 1);
  };
  visit(source, "$", 0);
  const dependencies = [];
  for (const [uuid, locations] of refs) {
    let targetUrl = null, error = null, sourceExists = false, type = null;
    try {
      targetUrl = assetdb.uuidToUrl(uuid) || null;
      if (targetUrl) {
        type = ((_c = (_b = assetdb.assetInfoByUuid) == null ? void 0 : _b.call(assetdb, uuid)) == null ? void 0 : _c.type) || null;
        const sourcePath = assetdb.uuidToFspath(uuid);
        const paths = assetdb.isSubAssetByUuid(uuid) ? [sourcePath, path7.dirname(sourcePath)] : [sourcePath];
        for (const file2 of paths) {
          try {
            if ((await fs10.promises.stat(file2)).isFile()) {
              sourceExists = true;
              break;
            }
          } catch (e) {
            if (e.code !== "ENOENT" && e.code !== "ENOTDIR") throw e;
          }
        }
      }
    } catch (e) {
      error = String(e.message || e);
    }
    dependencies.push({ uuid, url: targetUrl, type, resolved: !!targetUrl, exists: sourceExists, locations, ...error ? { error } : {} });
  }
  const missing = dependencies.filter((ref) => !ref.exists);
  return {
    target: url,
    uuid: assetdb.urlToUuid(url),
    ok: missing.length === 0 && !truncated,
    complete: !truncated,
    truncated,
    referenceCount: refs.size,
    missingCount: missing.length,
    dependencies,
    missing,
    scope: "serialized-uuid-references"
  };
}

// src/core/BuildInfo.ts
init_define_MCP_BRIDGE_BUILD();
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

// src/utils/TextEdits.ts
init_define_MCP_BRIDGE_BUILD();
function applyValidatedEdits(source, edits) {
  if (!Array.isArray(edits) || !edits.length) throw new Error("edits \u5FC5\u987B\u662F\u975E\u7A7A\u6570\u7EC4");
  const checkOffset = (value, label) => {
    if (!Number.isInteger(value) || value < 0 || value > source.length) throw new Error(`${label} \u5FC5\u987B\u662F\u539F\u6587\u8303\u56F4\u5185\u7684\u6574\u6570\u504F\u79FB`);
    if (value > 0 && value < source.length && source.charCodeAt(value - 1) >= 55296 && source.charCodeAt(value - 1) <= 56319 && source.charCodeAt(value) >= 56320 && source.charCodeAt(value) <= 57343) throw new Error(`${label} \u4E0D\u80FD\u5207\u5F00 Unicode \u4EE3\u7406\u5BF9`);
  };
  const ranges = edits.map((edit, i) => {
    if (!edit || !["insert", "delete", "replace"].includes(edit.type)) throw new Error(`\u7F16\u8F91 ${i}: \u672A\u77E5\u64CD\u4F5C\u7C7B\u578B`);
    const start = edit.type === "insert" ? edit.position : edit.start;
    const end = edit.type === "insert" ? start : edit.end;
    checkOffset(start, `\u7F16\u8F91 ${i}.start/position`);
    checkOffset(end, `\u7F16\u8F91 ${i}.end`);
    if (end < start) throw new Error(`\u7F16\u8F91 ${i}: end \u4E0D\u80FD\u5C0F\u4E8E start`);
    if (edit.type !== "delete" && typeof edit.text !== "string") throw new Error(`\u7F16\u8F91 ${i}: text \u5FC5\u987B\u4E3A\u5B57\u7B26\u4E32`);
    return { start, end, text: edit.type === "delete" ? "" : edit.text, index: i };
  }).sort((a, b) => a.start - b.start || a.end - b.end);
  for (let i = 1; i < ranges.length; i++) {
    const a = ranges[i - 1], b = ranges[i];
    if (b.start < a.end || b.start === a.start) throw new Error(`\u7F16\u8F91 ${a.index} \u548C ${b.index} \u8303\u56F4\u91CD\u53E0\u6216\u8D77\u70B9\u51B2\u7A81`);
  }
  const chunks = [];
  let cursor = 0;
  for (const edit of ranges) {
    chunks.push(source.slice(cursor, edit.start), edit.text);
    cursor = edit.end;
  }
  chunks.push(source.slice(cursor));
  return chunks.join("");
}

// src/tools/EditorWriteTools.ts
init_define_MCP_BRIDGE_BUILD();
var fs11 = __toESM(require("fs"));
var crypto6 = __toESM(require("crypto"));
init_AssetUrl();
var EditorWriteTools = class _EditorWriteTools {
  /** 单文件与批量入口共用监听屏障，避免后台快照重复提交已经删除的资源。 */
  static deleteAsset(url, callback) {
    _EditorWriteTools.deleteAssets([url], callback);
  }
  static deleteAssets(requested, callback) {
    const db = Editor.assetdb;
    let urls, files, restoreWatch;
    try {
      if (!Array.isArray(requested) || !requested.length || requested.length > 500) throw new Error("\u5220\u9664\u8DEF\u5F84\u6570\u91CF\u5FC5\u987B\u4E3A 1\u2013500");
      for (const url of requested) {
        validateAssetUrl(url);
        if (isAssetRoot(url)) throw new Error("\u4E0D\u5141\u8BB8\u5220\u9664\u8D44\u6E90\u6839\u76EE\u5F55");
        if (!db.exists(url)) throw new Error("\u627E\u4E0D\u5230\u8D44\u6E90: " + url);
      }
      urls = [...new Set(requested)].filter((url) => !requested.some((parent) => parent !== url && url.startsWith(parent + "/")));
      files = urls.map((url) => {
        const file = db.urlToFspath(url);
        if (!file) throw new Error("\u8D44\u6E90\u8DEF\u5F84\u65E0\u6548: " + url);
        return file;
      });
      if (typeof db.getWatchState !== "function" || typeof db.watchOFF !== "function" || typeof db.watchON !== "function") {
        throw new Error("\u5F53\u524D AssetDB \u4E0D\u652F\u6301\u76D1\u542C\u72B6\u6001\u5C4F\u969C\uFF0C\u672A\u6267\u884C\u5220\u9664");
      }
      const state = db.getWatchState();
      if (!["watch-on", "watch-off", "watch-starting", "watch-stopping"].includes(state)) throw new Error("\u672A\u77E5\u8D44\u6E90\u76D1\u542C\u72B6\u6001: " + state);
      restoreWatch = state === "watch-on" || state === "watch-starting";
    } catch (error) {
      callback(error);
      return;
    }
    const release = CommandQueue.trackEditorOperation();
    let finished = false, reported = false, pollTimer, deletionError = null, deleteReplied = false;
    const finish = (error) => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      clearTimeout(pollTimer);
      try {
        if (!reported) {
          reported = true;
          callback(error, error ? void 0 : { deleted: urls });
        }
      } finally {
        release();
      }
    };
    const deadline = setTimeout(() => {
      reported = true;
      CommandQueue.blockPending("\u8D44\u6E90\u5220\u9664\u6216\u76D1\u542C\u6062\u590D\u5C1A\u672A\u786E\u8BA4\uFF0C\u8BF7\u7B49\u5F85\u5B8C\u6210\u6216\u91CD\u8F7D\u63D2\u4EF6\uFF0C\u4E0D\u80FD\u76F4\u63A5\u91CD\u8BD5");
      callback("\u8D44\u6E90\u5220\u9664\u8D85\u65F6\uFF0C\u6570\u636E\u5E93/\u78C1\u76D8/\u76D1\u542C\u5B8C\u6210\u72B6\u6001\u672A\u77E5: " + urls.join(", "));
    }, 3e4);
    const later = (poll) => {
      pollTimer = setTimeout(poll, reported ? 500 : 30);
    };
    const pollRestored = () => {
      if (finished) return;
      try {
        if (!restoreWatch || db.getWatchState() === "watch-on") return finish(deletionError);
      } catch (error) {
        return finish(error);
      }
      later(pollRestored);
    };
    const restore = (error) => {
      deletionError = error;
      try {
        if (restoreWatch) db.watchON();
        pollRestored();
      } catch (failure) {
        finish(new Error(`${error ? String(error) + "; " : ""}\u8D44\u6E90\u76D1\u542C\u6062\u590D\u5931\u8D25: ${failure.message || failure}`));
      }
    };
    const pollDeleted = () => {
      if (finished) return;
      try {
        if (urls.every((url, index) => !db.exists(url) && !fs11.existsSync(files[index]) && !fs11.existsSync(files[index] + ".meta"))) return restore(null);
      } catch (error) {
        return restore(error);
      }
      later(pollDeleted);
    };
    const pollPaused = () => {
      if (finished) return;
      try {
        if (db.getWatchState() !== "watch-off") {
          later(pollPaused);
          return;
        }
        if (reported) return restore(new Error("\u76D1\u542C\u6682\u505C\u8D85\u65F6\uFF0C\u672A\u6267\u884C\u5220\u9664"));
        db.delete(urls, (error) => {
          if (deleteReplied) return;
          deleteReplied = true;
          if (error) restore(error);
          else pollDeleted();
        });
      } catch (error) {
        restore(error);
      }
    };
    try {
      if (restoreWatch) db.watchOFF();
      pollPaused();
    } catch (error) {
      restore(error);
    }
  }
  static updatePrefab(args, callback) {
    const url = args.path, uuid = Editor.assetdb.urlToUuid(url);
    if (!args.nodeId || !uuid) return callback("\u66F4\u65B0\u9884\u5236\u4F53\u9700\u8981\u6709\u6548 nodeId \u548C\u5DF2\u5B58\u5728\u7684\u76EE\u6807\u8D44\u6E90");
    CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "get-prefab-update-state", { nodeId: args.nodeId }, (err, state) => {
      if (err) return callback(err);
      if (!state || state.rootId !== args.nodeId || state.assetUuid !== uuid) {
        return callback("\u8282\u70B9\u5FC5\u987B\u662F\u76EE\u6807\u9884\u5236\u4F53\u7684\u6839\u5B9E\u4F8B\uFF0C\u4E0D\u80FD\u8986\u76D6\u5176\u4ED6\u9884\u5236\u4F53\u6216\u4F7F\u7528\u672A\u5173\u8054\u7684\u666E\u901A\u8282\u70B9");
      }
      if (CommandQueue.getBlockedReason()) return callback(CommandQueue.getBlockedReason());
      if (state.mode === "prefab") {
        if (state.activePrefabUuid !== uuid) return callback("\u5F53\u524D\u6253\u5F00\u7684\u9884\u5236\u4F53\u4E0E\u76EE\u6807\u4E0D\u4E00\u81F4");
        CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "save-prefab", {}, (saveErr) => {
          if (saveErr) return callback(saveErr);
          _EditorWriteTools.refreshAfterWrite(url, callback);
        });
        return;
      }
      let file, before;
      const fingerprint = () => {
        var _a;
        const content = fs11.readFileSync(file, "utf8");
        const data = JSON.parse(content);
        if (!Array.isArray(data) || ((_a = data[0]) == null ? void 0 : _a.__type__) !== "cc.Prefab") throw new Error("\u76EE\u6807\u4E0D\u662F\u6709\u6548\u9884\u5236\u4F53\u6570\u636E");
        const stat = fs11.statSync(file);
        return `${stat.mtimeMs}:${stat.size}:` + crypto6.createHash("sha256").update(content).digest("hex");
      };
      try {
        file = Editor.assetdb.urlToFspath(url);
        before = fingerprint();
      } catch (e) {
        callback(e);
        return;
      }
      const complete = CommandQueue.trackEditorOperation();
      let finished = false, reported = false, refreshing = false, previous = "", pollTimer;
      const finish = (writeErr, result) => {
        if (finished) return;
        finished = true;
        clearTimeout(deadline);
        clearTimeout(pollTimer);
        try {
          if (!reported) {
            reported = true;
            callback(writeErr, result);
          }
        } finally {
          complete();
        }
      };
      const deadline = setTimeout(() => {
        if (finished) return;
        reported = true;
        CommandQueue.blockPending(`\u9884\u5236\u4F53\u66F4\u65B0\u7ED3\u679C\u5C1A\u672A\u786E\u8BA4: ${url}\uFF0C\u8BF7\u7B49\u5B8C\u6210\u6216\u91CD\u8F7D\u63D2\u4EF6\uFF0C\u4E0D\u80FD\u76F4\u63A5\u91CD\u8BD5`);
        callback(`\u9884\u5236\u4F53\u66F4\u65B0\u8D85\u65F6\uFF0C\u672A\u786E\u8BA4\u76EE\u6807\u843D\u76D8/\u540C\u6B65\uFF0C\u540E\u7EED\u64CD\u4F5C\u5DF2\u6682\u505C: ${url}`);
      }, 3e4);
      const poll = () => {
        if (finished || refreshing) return;
        try {
          const current = fingerprint();
          if (current !== before && current === previous) {
            refreshing = true;
            _EditorWriteTools.refreshAfterWrite(url, (refreshErr, result) => finish(refreshErr, result));
            return;
          }
          previous = current;
        } catch (e) {
          previous = "";
        }
        pollTimer = setTimeout(poll, reported ? 1e3 : 200);
      };
      try {
        Editor.Ipc.sendToPanel("scene", "scene:apply-prefab", args.nodeId);
        poll();
      } catch (e) {
        finish(e);
      }
    });
  }
  static rename(args, callback) {
    const readName = (cb) => CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "get-node-name", { id: args.id }, cb);
    readName((err) => {
      if (err) return callback(err);
      const blocked = CommandQueue.getBlockedReason();
      if (blocked) return callback(blocked);
      const complete = CommandQueue.trackEditorOperation();
      let finished = false, reported = false, pollTimer;
      const finish = (writeErr = null) => {
        if (finished) return;
        finished = true;
        clearTimeout(deadline);
        clearTimeout(pollTimer);
        try {
          if (!reported) callback(writeErr, writeErr ? void 0 : `\u8282\u70B9\u540D\u79F0\u5DF2\u66F4\u65B0\u4E3A ${args.newName}`);
        } finally {
          complete();
        }
      };
      const deadline = setTimeout(() => {
        if (finished || reported) return;
        reported = true;
        CommandQueue.blockPending("\u8282\u70B9\u540D\u79F0\u5199\u5165\u5C1A\u672A\u786E\u8BA4\uFF0C\u8BF7\u7B49\u5B8C\u6210\u6216\u91CD\u8F7D\u63D2\u4EF6\uFF0C\u4E0D\u80FD\u76F4\u63A5\u91CD\u8BD5");
        callback("\u8282\u70B9\u540D\u79F0\u5199\u5165\u8D85\u65F6\uFF0C\u5C1A\u672A\u786E\u8BA4\u7ED3\u679C\uFF0C\u540E\u7EED\u64CD\u4F5C\u5DF2\u6682\u505C");
      }, 15e3);
      const poll = () => readName((readErr, node) => {
        if (readErr) {
          if (/找不到节点|node missing/.test(String(readErr))) finish(readErr);
          else if (!reported) {
            reported = true;
            clearTimeout(deadline);
            CommandQueue.blockPending(String(readErr));
            callback(readErr);
          }
          return;
        }
        if ((node == null ? void 0 : node.name) === args.newName) finish();
        else pollTimer = setTimeout(poll, reported ? 1e3 : 100);
      });
      try {
        Editor.Ipc.sendToPanel("scene", "scene:set-property", {
          id: args.id,
          path: "name",
          type: "String",
          value: args.newName,
          isSubProp: false
        });
        poll();
      } catch (e) {
        finish(e);
      }
    });
  }
  static refreshAfterWrite(url, callback) {
    const complete = CommandQueue.trackEditorOperation();
    let settled = false;
    const finish = (err) => {
      if (settled) return;
      settled = true;
      try {
        callback(
          err ? `\u6587\u4EF6\u5DF2\u843D\u76D8\uFF0C\u4F46 AssetDB \u540C\u6B65\u5931\u8D25: ${err.message || err}` : null,
          err ? void 0 : `\u6587\u4EF6\u5DF2\u843D\u76D8\u4E14 AssetDB \u5DF2\u540C\u6B65: ${url}`
        );
      } finally {
        complete();
      }
    };
    try {
      Editor.assetdb.refresh(url, finish);
    } catch (err) {
      finish(err);
    }
  }
};

// src/tools/ScriptDiagnostics.ts
init_define_MCP_BRIDGE_BUILD();
var fs12 = __toESM(require("fs"));
var path8 = __toESM(require("path"));
var import_child_process = require("child_process");
async function runScriptDiagnostics(project, options = {}, runtime = {}) {
  var _a;
  const root = fs12.realpathSync(project);
  const config = path8.resolve(root, options.tsconfigPath || "tsconfig.json");
  const inside = (file) => {
    const relative5 = path8.relative(root, file);
    return relative5 !== ".." && !relative5.startsWith(".." + path8.sep) && !path8.isAbsolute(relative5);
  };
  if (!inside(config) || !fs12.existsSync(config) || !inside(fs12.realpathSync(config))) throw new Error("tsconfig \u5FC5\u987B\u662F\u5F53\u524D\u5DE5\u7A0B\u5185\u5B58\u5728\u7684\u6587\u4EF6");
  const candidates = [
    path8.join(root, "node_modules/typescript/bin/tsc"),
    path8.join(root, "packages/mcp-bridge/node_modules/typescript/bin/tsc")
  ];
  const compiler = runtime.compiler || candidates.find((file) => fs12.existsSync(file));
  const boundaries = { creatorCompilationVerified: false, runtimeLoadedVerified: false };
  if (!compiler) return {
    ok: false,
    status: "unavailable",
    scope: "typescript_no_emit",
    diagnostics: [],
    boundaries,
    summary: "\u5DE5\u7A0B\u4E0E MCP \u63D2\u4EF6\u5747\u672A\u5B89\u88C5 TypeScript \u7F16\u8BD1\u5668\uFF0C\u672A\u6267\u884C\u68C0\u67E5"
  };
  const limit = options.limit === void 0 ? 30 : options.limit;
  const contextLines = options.contextLines === void 0 ? 2 : options.contextLines;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(contextLines) || contextLines < 0 || contextLines > 10) throw new Error("limit \u9700\u8981 1\u2013100\uFF0CcontextLines \u9700\u8981 0\u201310");
  const execute = runtime.execFile || import_child_process.execFile;
  const started = Date.now();
  const result = await new Promise((resolve6) => execute(
    runtime.execPath || process.execPath,
    [compiler, "--noEmit", "--incremental", "false", "--pretty", "false", "-p", config],
    { cwd: root, env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, timeout: 3e4, maxBuffer: 4 * 1024 * 1024, windowsHide: true },
    (error, stdout, stderr) => resolve6({ error, stdout: String(stdout || ""), stderr: String(stderr || "") })
  ));
  const output = result.stdout + "\n" + result.stderr;
  const diagnostics = [];
  for (const line of output.split(/\r?\n/)) {
    const match = /^(?:(.+)\((\d+),(\d+)\):\s*)?error\s+(TS\d+):\s*(.*)$/.exec(line);
    if (!match) continue;
    const file = match[1] ? path8.resolve(root, match[1]) : null;
    const row = Number(match[2]) || null;
    const diagnostic = { file, line: row, column: Number(match[3]) || null, code: match[4], message: match[5] };
    if (diagnostics.length < limit && file && row && inside(file)) {
      try {
        if (inside(fs12.realpathSync(file)) && fs12.statSync(file).size <= 1024 * 1024) {
          const lines = fs12.readFileSync(file, "utf8").split(/\r?\n/);
          const from = Math.max(0, row - 1 - contextLines), to = Math.min(lines.length, row + contextLines);
          diagnostic.snippet = lines.slice(from, to).map((text, i) => `${from + i + 1}: ${text.slice(0, 500)}`).join("\n");
        }
      } catch (_) {
        diagnostic.snippet = "\u6E90\u7801\u4E0D\u53EF\u8BFB\u53D6";
      }
    }
    diagnostics.push(diagnostic);
  }
  const ok = !result.error && diagnostics.length === 0;
  return {
    ok,
    status: ok ? "passed" : ((_a = result.error) == null ? void 0 : _a.killed) ? "timeout" : "failed",
    scope: "typescript_no_emit",
    compiler,
    tsconfigPath: config,
    exitCode: result.error ? typeof result.error.code === "number" ? result.error.code : null : 0,
    elapsedMs: Date.now() - started,
    diagnostics: diagnostics.slice(0, limit),
    totalDiagnostics: diagnostics.length,
    truncated: diagnostics.length > limit || output.length > 12e3,
    output: output.slice(0, 12e3),
    error: result.error ? String(result.error.message).slice(0, 2e3) : null,
    boundaries
  };
}

// src/tools/AssetReadiness.ts
init_define_MCP_BRIDGE_BUILD();
async function checkAssetReady(assetdb, options = {}) {
  const target = options.target;
  if (typeof target !== "string" || !target || target.length > 512 || /[\0*?#\\]/.test(target) || (target.startsWith("db://") ? !/^db:\/\/(assets|internal)\/.+/.test(target) || target.slice(5).split("/").some((part) => !part || part === "." || part === "..") : !/^[A-Za-z0-9_+/@-]+$/.test(target))) throw new Error("target \u9700\u8981\u7CBE\u786E db:// \u8D44\u6E90 URL \u6216 UUID");
  const waitMs = options.waitMs === void 0 ? 1500 : options.waitMs;
  if (!Number.isInteger(waitMs) || waitMs < 0 || waitMs > 1e4) throw new Error("waitMs \u9700\u8981 0\u201310000");
  const started = Date.now(), deadline = started + (waitMs || 1e3);
  let previous = "", stableObservations = 0, attempts = 0, status = "missing", asset = null, error = "";
  while (attempts++ < 102) {
    try {
      const uuid = target.startsWith("db://") ? assetdb.urlToUuid(target) : target;
      const url = uuid && assetdb.uuidToUrl(uuid);
      if (!url || assetdb.urlToUuid(url) !== uuid || target.startsWith("db://") && url !== target) {
        status = "missing_or_mismatched";
        asset = null;
      } else {
        let info;
        if (typeof assetdb.assetInfoByUuid === "function") info = assetdb.assetInfoByUuid(uuid);
        else if (typeof assetdb.queryInfoByUuid === "function") info = await new Promise((resolve6, reject) => {
          const timer = setTimeout(() => reject(new Error("\u8D44\u6E90\u4FE1\u606F\u67E5\u8BE2\u8D85\u65F6")), Math.max(1, Math.min(1e3, deadline - Date.now())));
          try {
            assetdb.queryInfoByUuid(uuid, (err, value) => {
              clearTimeout(timer);
              err ? reject(err) : resolve6(value);
            });
          } catch (err) {
            clearTimeout(timer);
            reject(err);
          }
        });
        else throw new Error("\u5F53\u524D AssetDB \u4E0D\u652F\u6301\u8D44\u6E90\u4FE1\u606F\u67E5\u8BE2");
        if (!info || info.uuid !== uuid || info.url !== url || assetdb.uuidToUrl(uuid) !== url || assetdb.urlToUuid(url) !== uuid) {
          status = "identity_mismatch";
          asset = null;
        } else {
          status = "observed";
          asset = { uuid, url, type: info.type || null };
        }
      }
    } catch (err) {
      status = "unavailable";
      asset = null;
      error = String(err.message || err).slice(0, 500);
    }
    const identity = asset ? JSON.stringify(asset) : "";
    stableObservations = identity ? identity === previous ? stableObservations + 1 : 1 : 0;
    previous = identity;
    if (stableObservations >= 2 || !waitMs || Date.now() >= deadline || status === "unavailable") break;
    await new Promise((resolve6) => setTimeout(resolve6, Math.min(100, Math.max(0, deadline - Date.now()))));
  }
  const ready = stableObservations >= 2;
  return {
    ready,
    status: ready ? "ready" : status === "observed" ? "unconfirmed" : status,
    target,
    asset,
    scope: "asset_db_record",
    stableObservations,
    attempts,
    elapsedMs: Date.now() - started,
    timedOut: !ready && Date.now() >= deadline,
    error,
    boundaries: { importQueueVerified: false, sourceBytesVerified: false, scriptCompilationVerified: false, runtimeLoadedVerified: false }
  };
}

// src/tools/ToolDispatcher.ts
init_SerializedValidation();
function getNewSceneTemplate() {
  return `[
  {
    "__type__": "cc.SceneAsset",
    "_name": "",
    "_objFlags": 0,
    "_native": "",
    "scene": {
      "__id__": 1
    }
  },
  {
    "__type__": "cc.Scene",
    "_objFlags": 0,
    "_parent": null,
    "_children": [
      {
        "__id__": 2
      }
    ],
    "_active": true,
    "_components": [],
    "_prefab": null,
    "_opacity": 255,
    "_color": {
      "__type__": "cc.Color",
      "r": 255,
      "g": 255,
      "b": 255,
      "a": 255
    },
    "_contentSize": {
      "__type__": "cc.Size",
      "width": 0,
      "height": 0
    },
    "_anchorPoint": {
      "__type__": "cc.Vec2",
      "x": 0,
      "y": 0
    },
    "_trs": {
      "__type__": "TypedArray",
      "ctor": "Float64Array",
      "array": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        1,
        1
      ]
    },
    "_is3DNode": true,
    "_groupIndex": 0,
    "groupIndex": 0,
    "autoReleaseAssets": false,
    "_id": "67362fcd-77fe-41dc-ac07-ba9829ca1351"
  },
  {
    "__type__": "cc.Node",
    "_name": "Main Camera",
    "_objFlags": 0,
    "_parent": {
      "__id__": 1
    },
    "_children": [],
    "_active": true,
    "_components": [
      {
        "__id__": 3
      }
    ],
    "_prefab": null,
    "_opacity": 255,
    "_color": {
      "__type__": "cc.Color",
      "r": 255,
      "g": 255,
      "b": 255,
      "a": 255
    },
    "_contentSize": {
      "__type__": "cc.Size",
      "width": 0,
      "height": 0
    },
    "_anchorPoint": {
      "__type__": "cc.Vec2",
      "x": 0.5,
      "y": 0.5
    },
    "_trs": {
      "__type__": "TypedArray",
      "ctor": "Float64Array",
      "array": [
        0,
        0,
        0,
        0,
        0,
        0,
        1,
        1,
        1,
        1
      ]
    },
    "_is3DNode": false,
    "_groupIndex": 0,
    "groupIndex": 0,
    "_id": "18g4J2/lRImLg4Jj6+kHee"
  },
  {
    "__type__": "cc.Camera",
    "_name": "",
    "_objFlags": 0,
    "node": {
      "__id__": 2
    },
    "_enabled": true,
    "_cullingMask": 4294967295,
    "_clearFlags": 7,
    "_backgroundColor": {
      "__type__": "cc.Color",
      "r": 0,
      "g": 0,
      "b": 0,
      "a": 255
    },
    "_depth": -1,
    "_zoomRatio": 1,
    "_targetTexture": null,
    "_fov": 60,
    "_orthoSize": 10,
    "_nearClip": 1,
    "_farClip": 4096,
    "_ortho": true,
    "_rect": {
      "__type__": "cc.Rect",
      "x": 0,
      "y": 0,
      "width": 1,
      "height": 1
    },
    "_renderStages": 1,
    "_alignWithScreen": true,
    "_id": "31p6jB6B1H/IpswQ28vjH9"
  }
]`;
}
var _ToolDispatcher = class _ToolDispatcher {
  static clearScreenshotCache() {
    if (_ToolDispatcher.lastScreenshotData) {
      _ToolDispatcher.lastScreenshotData = "";
      Logger.info("[\u6027\u80FD\u4F18\u5316] \u68C0\u6D4B\u5230\u5199\u64CD\u4F5C\uFF0C\u5DF2\u4E3B\u52A8\u6E05\u7A7A\u622A\u56FE\u7F13\u5B58");
    }
  }
  static _ensureParentDirSync(targetPath) {
    const ext = pathModule2.extname(targetPath);
    let dir = targetPath;
    if (ext) {
      dir = pathModule2.dirname(targetPath);
    }
    if (dir === "db://assets") return false;
    const fsPath = Editor.assetdb.urlToFspath(dir);
    if (!fsPath) return false;
    if (!fs13.existsSync(fsPath)) {
      const parentDir = pathModule2.dirname(dir);
      this._ensureParentDirSync(parentDir);
      const dirName = pathModule2.basename(dir);
      const parentFsPath = Editor.assetdb.urlToFspath(parentDir);
      fs13.mkdirSync(pathModule2.join(parentFsPath, dirName));
      Editor.assetdb.refresh(dir);
      return true;
    }
    return false;
  }
  static generateFileId() {
    return AssetPatcher.generateFileId();
  }
  static fixPrefabRootFileId(fp) {
    return AssetPatcher.fixPrefabRootFileId(fp);
  }
  static handleMcpCall(name, args, callback, internalAlias = false) {
    var _a, _b;
    args = args || {};
    try {
      if (internalAlias) validateToolCall(name, args, getToolsList());
      else validateExposedCall(name, args, configuredTools((_a = Editor.Project) == null ? void 0 : _a.path, getToolsList()));
    } catch (err) {
      callback(err.message);
      return;
    }
    const alias2 = resolveToolAlias(name, args);
    if (alias2.name !== name) {
      const descriptor = toolAlias(name), parentPath = alias2.name === "create_node" && args.parentPath && !args.parentId;
      if (descriptor.nodeKey && !alias2.args[descriptor.nodeKey] && (args.path || args.name) || parentPath) {
        return CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "execute-capability", { tool: "resolve_node", args: parentPath ? { path: args.parentPath } : args }, (err, node) => {
          if (err) return callback(err);
          _ToolDispatcher.handleMcpCall(alias2.name, { ...alias2.args, [parentPath ? "parentId" : descriptor.nodeKey]: node.uuid }, callback, true);
        });
      }
      return _ToolDispatcher.handleMcpCall(alias2.name, alias2.args, callback, true);
    }
    const inputControl = ["simulate_mouse_drag", "simulate_mouse_click"].includes(name) && ["status", "cancel"].includes(args.action);
    if (!(name === "build_project" && args.action === "status") && !inputControl && CommandQueue.getBlockedReason()) return callback(CommandQueue.getBlockedReason());
    const writing = isMutatingCall(name, args);
    const inputTool = ["simulate_mouse_drag", "simulate_mouse_click"].includes(name);
    if (EditorInput.isBusy() && !inputTool && mutatesProject(name, args)) return callback("\u539F\u751F\u8F93\u5165\u5C1A\u672A\u7ED3\u675F\uFF0C\u8BF7\u5148\u67E5\u8BE2\u6216\u53D6\u6D88\u8F93\u5165\u4EFB\u52A1");
    if (writing) {
      _ToolDispatcher.clearScreenshotCache();
      EditorScreenshot.invalidate();
    }
    if (_ToolDispatcher.isSceneBusy && writing) return callback("\u7F16\u8F91\u5668\u6B63\u5FD9\uFF0C\u8BF7\u7A0D\u5019");
    if (SCRIPT_TOOLS.includes(name)) return _ToolDispatcher.executeJavascript(name, args, callback);
    if (isSceneCapability(name)) return CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "execute-capability", { tool: name, args }, callback);
    if (isProjectFileTool(name)) {
      executeProjectFile(name, args, Editor.Project.path).then((result) => callback(null, result), (err) => callback(err.message));
      return;
    }
    if (isEditorCapability(name)) {
      if (name === "get_tool_catalog") {
        const all = getToolsList(), exposed = configuredTools((_b = Editor.Project) == null ? void 0 : _b.path, all);
        return callback(null, all.map((tool) => {
          var _a2, _b2, _c;
          return {
            name: tool.name,
            description: tool.description,
            category: tool.category,
            profile: tool.profile,
            compatibility: tool.compatibility,
            enabled: exposed.some((item) => item.name === tool.name),
            annotations: tool.annotations,
            actions: ((_b2 = (_a2 = exposed.find((item) => item.name === tool.name)) == null ? void 0 : _a2.inputSchema.properties.action) == null ? void 0 : _b2.enum) || ((_c = tool.inputSchema.properties.action) == null ? void 0 : _c.enum)
          };
        }));
      }
      if (name === "get_editor_state") return callback(null, { projectContext: getProjectContext(), queue: CommandQueue.snapshot(), nodeSelection: Editor.Selection.curSelection("node"), assetSelection: Editor.Selection.curSelection("asset") });
      executeEditorCapability(name, args, Editor).then((result) => callback(null, result), (err) => callback(err.message));
      return;
    }
    switch (name) {
      case "simulate_mouse_drag":
      case "simulate_mouse_click":
        EditorInput.execute(name, args).then((result) => callback(null, result), (err) => callback(err.message));
        break;
      case "capture_editor_screenshot":
        EditorScreenshot.capture(args, callback);
        break;
      case "resolve_capture_coordinates":
        try {
          callback(null, EditorScreenshot.resolveCoordinates(args));
        } catch (err) {
          callback(err.message);
        }
        break;
      case "inspect_asset_dependencies":
        inspectAssetDependencies(args, Editor.assetdb).then((result) => callback(null, result), (err) => callback(err.message));
        break;
      case "get_selected_node":
        const ids = Editor.Selection.curSelection("node");
        callback(null, ids);
        break;
      case "set_node_name":
        EditorWriteTools.rename(args, callback);
        break;
      case "save_scene":
        _ToolDispatcher.isSceneBusy = true;
        CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "save-scene", {}, (err, res) => {
          _ToolDispatcher.isSceneBusy = false;
          callback(err, res);
        });
        break;
      case "save_prefab":
        _ToolDispatcher.isSceneBusy = true;
        CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "save-prefab", {}, (err, res) => {
          _ToolDispatcher.isSceneBusy = false;
          callback(err, res);
        });
        break;
      case "close_prefab":
        _ToolDispatcher.isSceneBusy = true;
        CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "close-prefab", {}, (err, res) => {
          _ToolDispatcher.isSceneBusy = false;
          callback(err, res);
        });
        break;
      case "get_scene_hierarchy":
        CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "get-hierarchy", args, callback);
        break;
      case "update_node_transform":
        CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "update-node-transform", args, (err, result) => {
          if (err) {
            callback(err);
          } else {
            callback(null, "\u53D8\u6362\u4FE1\u606F\u5DF2\u66F4\u65B0");
          }
        });
        break;
      case "create_scene":
        const sceneUrl = `db://assets/${args.sceneName}.fire`;
        if (Editor.assetdb.exists(sceneUrl)) {
          return callback("\u573A\u666F\u5DF2\u5B58\u5728");
        }
        Editor.assetdb.create(sceneUrl, getNewSceneTemplate(), (err) => {
          callback(err, err ? null : `\u6807\u51C6\u573A\u666F\u5DF2\u521B\u5EFA\u4E8E ${sceneUrl}`);
        });
        break;
      case "create_prefab": {
        let prefabUrl, nodeName;
        if (args.prefabName.startsWith("db://")) {
          prefabUrl = args.prefabName.endsWith(".prefab") ? args.prefabName : args.prefabName + ".prefab";
          const rawName = prefabUrl.substring(prefabUrl.lastIndexOf("/") + 1);
          nodeName = rawName.replace(/\.prefab$/, "");
        } else {
          nodeName = args.prefabName;
          prefabUrl = `db://assets/${nodeName}.prefab`;
        }
        _ToolDispatcher._createPrefabViaSceneScript(args.nodeId, prefabUrl, nodeName, callback);
        break;
      }
      case "open_scene":
        _ToolDispatcher.isSceneBusy = true;
        EditorSceneTools.open(args.url, false, callback, () => {
          _ToolDispatcher.isSceneBusy = false;
        });
        break;
      case "open_prefab":
        _ToolDispatcher.isSceneBusy = true;
        EditorSceneTools.open(args.url, true, callback, () => {
          _ToolDispatcher.isSceneBusy = false;
        });
        break;
      case "create_node":
        if (args.type === "sprite" || args.type === "button") {
          const splashUuid = Editor.assetdb.urlToUuid(
            "db://internal/image/default_sprite_splash.png/default_sprite_splash"
          );
          args.defaultSpriteUuid = args.spriteFrameUuid || splashUuid;
        }
        CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "create-node", args, callback);
        break;
      case "manage_components":
        CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "manage-components", args, callback);
        break;
      case "manage_script":
        _ToolDispatcher.manageScript(args, callback);
        break;
      case "batch_execute":
        _ToolDispatcher.batchExecute(args, callback);
        break;
      case "manage_asset":
        _ToolDispatcher.manageAsset(args, callback);
        break;
      case "scene_management":
        _ToolDispatcher.sceneManagement(args, callback);
        break;
      case "prefab_management":
        _ToolDispatcher.prefabManagement(args, callback);
        break;
      case "manage_editor":
        _ToolDispatcher.manageEditor(args, callback);
        break;
      case "get_sha":
        McpWrappers.getSha(args, callback);
        break;
      case "manage_animation":
        McpWrappers.manageAnimation(args, callback);
        break;
      case "find_gameobjects":
        CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "find-gameobjects", args, callback);
        break;
      case "manage_material":
        _ToolDispatcher.manageMaterial(args, callback);
        break;
      case "manage_texture":
        _ToolDispatcher.manageTexture(args, callback);
        break;
      case "manage_shader":
        _ToolDispatcher.manageShader(args, callback);
        break;
      case "execute_menu_item":
        _ToolDispatcher.executeMenuItem(args, callback);
        break;
      case "apply_text_edits":
        _ToolDispatcher.applyTextEdits(args, callback);
        break;
      case "read_console":
        _ToolDispatcher.readConsole(args, callback);
        break;
      case "validate_script":
        _ToolDispatcher.validateScript(args, callback);
        break;
      case "run_script_diagnostics":
        runScriptDiagnostics(Editor.Project.path, args).then((result) => callback(null, result), (err) => callback(err.message));
        break;
      case "check_asset_ready":
        checkAssetReady(Editor.assetdb, args).then((result) => callback(null, result), (err) => callback(err.message));
        break;
      case "button_events":
        CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "button-events", args, callback);
        break;
      case "validate_prefab":
        inspectAssetDependencies(args, Editor.assetdb).then(async (dependencies) => {
          const data = JSON.parse((await readBounded(Editor.assetdb.urlToFspath(dependencies.target), 8 * 1024 * 1024)).toString("utf8"));
          const structure = validateSerializedAsset(data);
          callback(null, { ok: structure.ok && dependencies.ok, structure, dependencies, runtimeLoadedVerified: false });
        }).catch((err) => callback(err.message));
        break;
      case "search_project":
        McpWrappers.searchProject(args, callback);
        break;
      case "manage_undo":
        McpWrappers.manageUndo(args, callback);
        break;
      case "manage_vfx":
        if (args.properties && args.properties.file) {
          if (typeof args.properties.file === "string" && args.properties.file.startsWith("db://")) {
            const uuid = Editor.assetdb.urlToUuid(args.properties.file);
            if (uuid) {
              args.properties.file = uuid;
            } else {
              console.warn(`Failed to resolve path to UUID: ${args.properties.file}`);
            }
          }
        }
        const defaultPaths = [
          "db://internal/image/default_sprite_splash",
          "db://internal/image/default_sprite_splash.png",
          "db://internal/image/default_particle",
          "db://internal/image/default_particle.png"
        ];
        for (const path12 of defaultPaths) {
          const uuid = Editor.assetdb.urlToUuid(path12);
          if (uuid) {
            args.defaultSpriteUuid = uuid;
            break;
          }
        }
        if (!args.defaultSpriteUuid) {
        }
        CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "manage-vfx", args, callback);
        break;
      case "find_references": {
        const additionalIds = [];
        try {
          const targetUrl = Editor.assetdb.uuidToUrl(args.targetId);
          if (targetUrl) {
            const targetFspath = Editor.assetdb.urlToFspath(targetUrl);
            if (targetFspath) {
              const metaPath = targetFspath + ".meta";
              if (fs13.existsSync(metaPath)) {
                const meta = JSON.parse(fs13.readFileSync(metaPath, "utf8"));
                if (meta && meta.subMetas) {
                  for (const subKey of Object.keys(meta.subMetas)) {
                    const sub = meta.subMetas[subKey];
                    if (sub && sub.uuid) {
                      additionalIds.push(sub.uuid);
                    }
                  }
                }
              }
            }
          }
        } catch (e) {
        }
        if (additionalIds.length > 0) {
          args.additionalIds = additionalIds;
        }
        CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "find-references", args, callback);
        break;
      }
      case "build_project":
        Editor.Ipc.sendToMain("mcp-bridge:build-project", args, (err, state) => {
          callback(err, state);
        });
        break;
      case "get_project_info":
        Editor.Ipc.sendToMain("mcp-bridge:get-project-info", args, (err, info) => {
          const finish = (infoErr, projectInfo) => {
            if (infoErr || !(args == null ? void 0 : args.includeMcpDiagnostics)) return callback(infoErr, projectInfo);
            CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "get-mcp-runtime-info", {}, (sceneErr, scene) => {
              callback(null, {
                ...projectInfo,
                mcpDiagnostics: composeDiagnostics(
                  getRuntimeInfo("editor", __filename),
                  sceneErr ? null : scene,
                  null,
                  sceneErr ? String(sceneErr.message || sceneErr) : void 0
                ),
                queue: typeof CommandQueue.snapshot === "function" ? CommandQueue.snapshot() : void 0
              });
            });
          };
          if (!err && args && args.includeEditState) {
            CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "get-edit-state", {}, (stateErr, editState) => {
              finish(stateErr, { ...info, editState });
            });
            return;
          }
          finish(err, info);
        });
        break;
      case "inspect_builder_targets":
        Editor.Ipc.sendToMain("mcp-bridge:inspect-builder-targets", args, (err, info) => {
          callback(err, info);
        });
        break;
      case "modify_prefab_offline":
      case "modify_scene_offline": {
        const prefab = name === "modify_prefab_offline";
        const url = prefab ? args.prefabUrl : args.sceneUrl;
        const target = Editor.assetdb.urlToFspath(url);
        if (!target) return callback(`\u8D44\u6E90\u8DEF\u5F84\u89E3\u6790\u5931\u8D25: ${url}`);
        const result = OfflinePrefabEditor.modify(target, args.operations, prefab ? "prefab-root" : "scene");
        if (!result.success) return callback(`\u79BB\u7EBF\u4FEE\u6539${prefab ? "\u9884\u5236\u4F53" : "\u573A\u666F"}\u5931\u8D25: ${result.error}`);
        EditorWriteTools.refreshAfterWrite(url, (err, message) => {
          if (err) return callback(err, { written: true, structure: result.validation, retrySafe: false });
          inspectAssetDependencies({ target: url }, Editor.assetdb).then(
            (dependencies) => callback(
              null,
              { written: true, message, structure: result.validation, dependencies, validationOk: dependencies.ok, retrySafe: false }
            ),
            (failure) => callback(null, {
              written: true,
              message,
              structure: result.validation,
              validationOk: false,
              validationError: String(failure.message || failure),
              retrySafe: false
            })
          );
        });
        break;
      }
      default:
        callback(`Unknown tool: ${name}`);
        break;
    }
  }
  /**
   * 管理项目中的脚本文件 (TS/JS)
   * @param {Object} args 参数
   * @param {Function} callback 完成回调
   */
  /**
   * 通过自定义场景脚本创建预制体
   * scene-script 中 create-prefab 兼容单对象和引用数组，转换为标准预制体格式。
   * @param {string} nodeId 要创建为预制体的节点 UUID
   * @param {string} prefabUrl 预制体的 db:// 路径，如 db://assets/MyPrefab.prefab
   * @param {Function} callback 完成回调 (err, result)
   */
  static _createPrefabViaSceneScript(nodeId, prefabUrl, nodeName, callback) {
    CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "create-prefab", { nodeId, nodeName }, (err, serializedData) => {
      if (err) {
        return callback(err);
      }
      if (!serializedData) {
        return callback("\u5E8F\u5217\u5316\u8FD4\u56DE\u7A7A\u6570\u636E");
      }
      try {
        assertSerializedAsset(JSON.parse(serializedData));
      } catch (failure) {
        return callback(failure.message);
      }
      AssetPatcher.safeCreateAsset(prefabUrl, serializedData, callback, (doneCreate) => {
        setTimeout(() => {
          const prefabFspath = Editor.assetdb.urlToFspath(prefabUrl);
          if (prefabFspath) {
            _ToolDispatcher.fixPrefabRootFileId(prefabFspath);
          }
          doneCreate(null, `\u9884\u5236\u4F53\u5DF2\u521B\u5EFA: ${prefabUrl}`);
        }, 500);
      });
    });
  }
  static async manageScript(args, callback) {
    const { action, path: scriptPath, content } = args;
    switch (action) {
      case "create":
        if (Editor.assetdb.exists(scriptPath)) {
          return callback(`\u811A\u672C\u5DF2\u5B58\u5728: ${scriptPath}`);
        }
        AssetPatcher.safeCreateAsset(
          scriptPath,
          content || `const { ccclass, property } = cc._decorator;

@ccclass
export default class NewScript extends cc.Component {
    @property(cc.Label)
    label: cc.Label = null;

    @property
    text: string = 'hello';

    // LIFE-CYCLE CALLBACKS:

    onLoad () {}

    start () {}

    update (dt) {}
}`,
          callback,
          null
          // 不需要 post-modifier，因为脚本没有像纹理那样复杂的子元数据构建
        );
        break;
      case "delete":
        if (!Editor.assetdb.exists(scriptPath)) {
          return callback(`\u627E\u4E0D\u5230\u811A\u672C: ${scriptPath}`);
        }
        EditorWriteTools.deleteAsset(scriptPath, (err) => {
          callback(err, err ? null : `\u811A\u672C\u5DF2\u5220\u9664: ${scriptPath}`);
        });
        break;
      case "read":
        const readFsPath = Editor.assetdb.urlToFspath(scriptPath);
        if (!readFsPath || !fs13.existsSync(readFsPath)) {
          return callback(`\u627E\u4E0D\u5230\u811A\u672C: ${scriptPath}`);
        }
        try {
          const content2 = (await readBounded(readFsPath)).toString("utf8");
          callback(null, content2);
        } catch (e) {
          callback(`\u8BFB\u53D6\u811A\u672C\u5931\u8D25: ${e.message}`);
        }
        break;
      case "save":
      // 兼容 AI 幻觉
      case "write":
        const writeFsPath = Editor.assetdb.urlToFspath(scriptPath);
        if (!writeFsPath) {
          return callback(`\u8DEF\u5F84\u65E0\u6548: ${scriptPath}`);
        }
        try {
          atomicWrite(writeFsPath, content);
          Editor.assetdb.refresh(scriptPath, (err) => {
            if (err) return callback(`\u811A\u672C\u5DF2\u5199\u5165\uFF0C\u4F46\u5237\u65B0\u5931\u8D25: ${err.message || err}`);
            callback(null, `\u811A\u672C\u5DF2\u66F4\u65B0: ${scriptPath}`);
          });
        } catch (e) {
          callback(`\u5199\u5165\u811A\u672C\u5931\u8D25: ${e.message}`);
        }
        break;
      default:
        callback(`\u672A\u77E5\u7684\u811A\u672C\u64CD\u4F5C\u7C7B\u578B: ${action}`);
        break;
    }
  }
  /**
   * 批量执行多个 MCP 工具操作（串行链式执行）
   * 【重要修复】原并行 forEach 会导致多个 AssetDB 操作同时执行引发编辑器卡死，
   * 改为串行执行确保每个操作完成后再执行下一个
   * @param {Object} args 参数 (operations 数组)
   * @param {Function} callback 完成回调
   */
  static batchExecute(args, callback) {
    var _a;
    const allowedTools = configuredTools((_a = Editor.Project) == null ? void 0 : _a.path, getToolsList());
    try {
      validateExposedCall("batch_execute", args, allowedTools);
    } catch (err) {
      return callback(err.message);
    }
    const sceneOnly = Array.isArray(args.operations) && args.operations.length > 0 && args.operations.every((op) => Object.prototype.hasOwnProperty.call(SCENE_BATCH_METHODS, op == null ? void 0 : op.tool));
    if (args.executionMode === "scene" && !sceneOnly) return callback("scene \u6A21\u5F0F\u53EA\u652F\u6301\u8282\u70B9\u521B\u5EFA\u3001\u53D8\u6362\u3001\u7EC4\u4EF6\u548C\u573A\u666F\u67E5\u8BE2\uFF1B\u5176\u4ED6\u5DE5\u5177\u8BF7\u7528 auto \u6216 serial");
    if (sceneOnly && args.executionMode !== "serial") {
      if (CommandQueue.getBlockedReason()) return callback(CommandQueue.getBlockedReason());
      if (_ToolDispatcher.isSceneBusy) return callback("\u7F16\u8F91\u5668\u6B63\u5FD9\uFF0C\u8BF7\u7A0D\u5019");
      if (args.operations.some((op) => isMutatingCall(op.tool, op.params || {}))) EditorScreenshot.invalidate();
      const spriteUuid = args.operations.some((op) => {
        var _a2, _b;
        return op.tool === "create_node" && (typeof ((_a2 = op.params) == null ? void 0 : _a2.type) === "object" || ["sprite", "button"].includes((_b = op.params) == null ? void 0 : _b.type));
      }) ? Editor.assetdb.urlToUuid("db://internal/image/default_sprite_splash.png/default_sprite_splash") : void 0;
      CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "execute-scene-batch", {
        ...args,
        allowedTools: allowedTools.filter((tool) => args.operations.some((op) => op.tool === tool.name)),
        defaultSpriteUuid: spriteUuid,
        deadlineAt: Date.now() + 14e3
      }, callback);
      return;
    }
    executeBatch(args, allowedTools, (tool, params, done) => _ToolDispatcher.handleMcpCall(tool, params, done), callback);
  }
  static executeJavascript(name, args, callback) {
    var _a;
    const context = name === "execute_javascript" ? args.context : name === "execute_editor_script" ? "editor" : "scene";
    try {
      validateJavascript(args);
    } catch (err) {
      callback(err.message);
      return;
    }
    if (context === "scene") {
      CommandQueue.callSceneScriptWithTimeout(
        "mcp-bridge",
        "execute-javascript",
        args,
        (err, packet) => {
          var _a2;
          return callback(err || ((_a2 = packet == null ? void 0 : packet.error) == null ? void 0 : _a2.message), packet);
        },
        ((_a = args.timeoutMs) != null ? _a : 5e3) + 250
      );
      return;
    }
    const release = CommandQueue.trackEditorOperation();
    let execution;
    try {
      execution = startJavascript(args, { context, Editor, require, fs: fs13, path: pathModule2, projectPath: Editor.Project.path });
    } catch (err) {
      release();
      callback(err.message);
      return;
    }
    let responded = false;
    const timer = setTimeout(() => {
      responded = true;
      CommandQueue.blockPending("\u7F16\u8F91\u5668\u811A\u672C\u8D85\u65F6\u4E14\u5C1A\u672A\u7ED3\u675F\uFF0C\u8BF7\u7B49\u5F85\u771F\u5B9E\u5B8C\u6210\u6216\u91CD\u8F7D\u63D2\u4EF6\uFF1B\u7981\u6B62\u76F4\u63A5\u91CD\u653E");
      callback("\u811A\u672C\u6267\u884C\u8D85\u65F6\uFF0C\u526F\u4F5C\u7528\u72B6\u6001\u672A\u77E5", { kind: "mcp-bridge.script.v1", data: null, execution: execution.snapshot(), pending: true });
    }, execution.timeout);
    execution.completion.then((packet) => {
      var _a2;
      clearTimeout(timer);
      try {
        if (!responded) {
          responded = true;
          callback((_a2 = packet.error) == null ? void 0 : _a2.message, packet);
        }
      } finally {
        release();
      }
    }, (error) => {
      clearTimeout(timer);
      try {
        if (!responded) {
          responded = true;
          callback(error.message);
        }
      } finally {
        release();
      }
    });
  }
  /**
   * 通用的资源管理函数 (创建、删除、移动等)
   * @param {Object} args 参数
   * @param {Function} callback 完成回调
   */
  static manageAsset(args, callback) {
    const { action, path: path12, targetPath, content } = args;
    switch (action) {
      case "create":
        if (Editor.assetdb.exists(path12)) {
          return callback(`\u8D44\u6E90\u5DF2\u5B58\u5728: ${path12}`);
        }
        AssetPatcher.safeCreateAsset(path12, content || "", callback);
        break;
      case "delete":
        if (args.paths !== void 0) {
          if (path12 !== void 0) return callback("\u6279\u91CF\u5220\u9664 paths \u4E0E\u5355\u4E2A path \u4E0D\u80FD\u540C\u65F6\u63D0\u4F9B");
          EditorWriteTools.deleteAssets(args.paths, callback);
          break;
        }
        if (!Editor.assetdb.exists(path12)) {
          return callback(`\u627E\u4E0D\u5230\u8D44\u6E90: ${path12}`);
        }
        EditorWriteTools.deleteAsset(path12, (err) => {
          callback(err, err ? null : `\u8D44\u6E90\u5DF2\u5220\u9664: ${path12}`);
        });
        break;
      case "move":
        if (!Editor.assetdb.exists(path12)) {
          return callback(`\u6E90\u8D44\u6E90\u4E0D\u5B58\u5728: ${path12}`);
        }
        if (!targetPath) {
          return callback(`\u672A\u63D0\u4F9B\u76EE\u6807\u8DEF\u5F84 targetPath`);
        }
        let hasNewDir = false;
        try {
          if (typeof _ToolDispatcher._ensureParentDirSync !== "function") {
            let allKeys = [];
            for (let k in Editor.assetdb) {
              allKeys.push(k);
            }
            const dbMethods = allKeys.filter(
              (k) => k.toLowerCase().includes("move") || k.toLowerCase().includes("dir")
            );
            hasNewDir = false;
          } else {
            hasNewDir = _ToolDispatcher._ensureParentDirSync(targetPath);
          }
        } catch (e) {
          return callback(`\u521B\u5EFA\u7269\u7406\u76EE\u5F55\u5931\u8D25: ${e.message}`);
        }
        const onMoveComplete = (err) => {
          if (!Editor.App.focused) {
            Editor.AssetDB.runDBWatch("on");
          }
          if (err) return callback(err);
          if (hasNewDir) {
            const dirUrl = targetPath.substring(0, targetPath.lastIndexOf("/"));
            Editor.assetdb.refresh(dirUrl, (refreshErr) => {
              callback(refreshErr, refreshErr ? null : `\u8D44\u6E90\u5DF2\u79FB\u52A8\u5230: ${targetPath}`);
            });
          } else {
            callback(null, `\u8D44\u6E90\u5DF2\u79FB\u52A8\u5230: ${targetPath}`);
          }
        };
        Editor.AssetDB.runDBWatch("off");
        Editor.assetdb.move(path12, targetPath, onMoveComplete);
        break;
      case "get_info":
        if (!Editor || !Editor.assetdb) {
          return callback(`\u5F53\u524D\u7F16\u8F91\u5668\u8D44\u4EA7\u6570\u636E\u5E93\u5BF9\u8C61\u4E3A\u7A7A\uFF0C\u65E0\u6CD5\u8C03\u7528\u7BA1\u7406`);
        }
        if (!Editor.assetdb.exists(path12)) {
          return callback(`\u627E\u4E0D\u5230\u8D44\u6E90: ${path12}`);
        }
        if (typeof Editor.assetdb.queryInfoByUrl === "function") {
          Editor.assetdb.queryInfoByUrl(path12, (err, info) => {
            if (err) return callback(`\u67E5\u8BE2\u5931\u8D25: ${err.message}`);
            if (!info) return callback(`\u627E\u4E0D\u5230\u8D44\u6E90\u4FE1\u606F: ${path12}`);
            callback(null, info);
          });
        } else if (typeof Editor.assetdb.urlToUuid === "function" && typeof Editor.assetdb.queryInfoByUuid === "function") {
          const uuid = Editor.assetdb.urlToUuid(path12);
          Editor.assetdb.queryInfoByUuid(uuid, (err, info) => {
            if (err) return callback(`\u67E5\u8BE2\u5931\u8D25: ${err.message}`);
            if (!info) return callback(`\u627E\u4E0D\u5230\u8D44\u6E90\u4FE1\u606F: ${path12}`);
            callback(null, info);
          });
        } else {
          let allKeys = [];
          for (let k in Editor.assetdb) {
            allKeys.push(k);
          }
          const dbMethods = allKeys.filter(
            (k) => k.toLowerCase().includes("info") || k.toLowerCase().includes("query") || k.toLowerCase().includes("uuid")
          );
          try {
            const uuid = Editor.assetdb.urlToUuid(path12);
            if (uuid && typeof Editor.assetdb.assetInfoByUuid === "function") {
              const info = Editor.assetdb.assetInfoByUuid(uuid);
              if (info) {
                return callback(null, info);
              }
            }
          } catch (e) {
          }
          return callback(`\u5F53\u524D Cocos \u73AF\u5883\u4E0D\u652F\u6301\u8D44\u6E90\u8BE6\u7EC6\u4FE1\u606F\u67E5\u8BE2 (\u53EF\u7528 API \u5DF2\u5728\u63A7\u5236\u53F0\u6253\u5370)`);
        }
        break;
      default:
        callback(`\u672A\u77E5\u7684\u8D44\u6E90\u64CD\u4F5C\u7C7B\u578B: ${action}`);
        break;
    }
  }
  // 场景管理
  static sceneManagement(args, callback) {
    const { action, path: path12, targetPath, name } = args;
    switch (action) {
      case "create":
        if (Editor.assetdb.exists(path12)) {
          return callback(`\u573A\u666F\u5DF2\u5B58\u5728: ${path12}`);
        }
        AssetPatcher.safeCreateAsset(path12, getNewSceneTemplate(), callback, null);
        break;
      case "delete":
        if (!Editor.assetdb.exists(path12)) {
          return callback(`\u627E\u4E0D\u5230\u573A\u666F: ${path12}`);
        }
        EditorWriteTools.deleteAsset(path12, (err) => {
          callback(err, err ? null : `\u573A\u666F\u5DF2\u5220\u9664: ${path12}`);
        });
        break;
      case "duplicate":
        if (!Editor.assetdb.exists(path12)) {
          return callback(`\u6E90\u573A\u666F\u4E0D\u5B58\u5728: ${path12}`);
        }
        if (Editor.assetdb.exists(targetPath)) {
          return callback(`\u76EE\u6807\u573A\u666F\u5DF2\u5B58\u5728: ${targetPath}`);
        }
        const sourceFsPath = Editor.assetdb.urlToFspath(path12);
        if (!sourceFsPath || !fs13.existsSync(sourceFsPath)) {
          return callback(`\u5B9A\u4F4D\u6E90\u573A\u666F\u6587\u4EF6\u5931\u8D25: ${path12}`);
        }
        try {
          const content = fs13.readFileSync(sourceFsPath, "utf-8");
          AssetPatcher.safeCreateAsset(targetPath, content, callback, null);
        } catch (e) {
          callback(`Duplicate failed: ${e.message}`);
        }
        break;
      case "get_info":
        if (Editor.assetdb.exists(path12)) {
          const uuid = Editor.assetdb.urlToUuid(path12);
          const info = Editor.assetdb.assetInfoByUuid(uuid);
          callback(null, info || { url: path12, uuid, exists: true });
        } else {
          return callback(`\u627E\u4E0D\u5230\u573A\u666F: ${path12}`);
        }
        break;
      default:
        callback(`Unknown scene action: ${action}`);
        break;
    }
  }
  // 预制体管理
  static prefabManagement(args, callback) {
    const { action, path: prefabPath, nodeId, parentId } = args;
    switch (action) {
      case "create":
        if (!nodeId) {
          return callback("\u521B\u5EFA\u9884\u5236\u4F53\u9700\u8981\u8282\u70B9 ID");
        }
        if (Editor.assetdb.exists(prefabPath)) {
          return callback(`\u9884\u5236\u4F53\u5DF2\u5B58\u5728: ${prefabPath}`);
        }
        const targetDir = prefabPath.substring(0, prefabPath.lastIndexOf("/"));
        const fileName = prefabPath.substring(prefabPath.lastIndexOf("/") + 1);
        const prefabName = fileName.replace(".prefab", "");
        const createdPrefabUrl = `${targetDir}/${prefabName}.prefab`;
        _ToolDispatcher._createPrefabViaSceneScript(nodeId, createdPrefabUrl, prefabName, callback);
        break;
      case "save":
      // 兼容 AI 幻觉
      case "update":
        if (!nodeId) {
          return callback("\u66F4\u65B0\u9884\u5236\u4F53\u9700\u8981\u8282\u70B9 ID");
        }
        if (!Editor.assetdb.exists(prefabPath)) {
          return callback(`\u627E\u4E0D\u5230\u9884\u5236\u4F53: ${prefabPath}`);
        }
        EditorWriteTools.updatePrefab(args, callback);
        break;
      case "instantiate":
        if (!Editor.assetdb.exists(prefabPath)) {
          return callback(`\u8DEF\u5F84\u4E3A ${prefabPath} \u7684\u9884\u5236\u4F53\u4E0D\u5B58\u5728`);
        }
        const prefabUuid = Editor.assetdb.urlToUuid(prefabPath);
        CommandQueue.callSceneScriptWithTimeout(
          "mcp-bridge",
          "instantiate-prefab",
          {
            prefabUuid,
            parentId
          },
          callback
        );
        break;
      case "get_info":
        if (Editor.assetdb.exists(prefabPath)) {
          const uuid = Editor.assetdb.urlToUuid(prefabPath);
          const info = Editor.assetdb.assetInfoByUuid(uuid);
          const result = info || { url: prefabPath, uuid };
          result.exists = true;
          callback(null, result);
        } else {
          return callback(`\u627E\u4E0D\u5230\u9884\u5236\u4F53: ${prefabPath}`);
        }
        break;
      default:
        callback(`\u672A\u77E5\u7684\u9884\u5236\u4F53\u7BA1\u7406\u64CD\u4F5C: ${action}`);
    }
  }
  /**
   * 管理编辑器状态 (选中对象、刷新等)
   * @param {Object} args 参数
   * @param {Function} callback 完成回调
   */
  static manageEditor(args, callback) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { action, target, properties } = args;
    switch (action) {
      case "get_selection":
        const nodeSelection = Editor.Selection.curSelection("node");
        const assetSelection = Editor.Selection.curSelection("asset");
        callback(null, {
          nodes: nodeSelection,
          assets: assetSelection
        });
        break;
      case "set_selection": {
        const props = properties && typeof properties === "object" ? properties : {};
        const kind = target === "asset" ? "asset" : "node";
        const raw = (_h = (_g = (_f = (_e = (_d = (_c = (_b = (_a = props.ids) != null ? _a : props.nodes) != null ? _b : props.assets) != null ? _c : props.uuid) != null ? _d : props.nodeId) != null ? _e : props.id) != null ? _f : args.ids) != null ? _g : args.nodes) != null ? _h : args.uuid;
        const wanted = (Array.isArray(raw) ? raw : [raw]).filter((id) => typeof id === "string" && id.length > 0);
        if (!wanted.length) {
          return callback(`set_selection \u9700\u8981${kind === "asset" ? "\u8D44\u6E90" : "\u8282\u70B9"} UUID\uFF1Aproperties.ids\uFF08\u6570\u7EC4\uFF09\u6216 properties.uuid\uFF08\u5355\u4E2A\uFF09`);
        }
        try {
          Editor.Selection.select(kind, wanted);
        } catch (err) {
          return callback(`\u9009\u4E2D\u5931\u8D25: ${err && err.message ? err.message : err}`);
        }
        setTimeout(() => {
          let current = [];
          try {
            current = Editor.Selection.curSelection(kind) || [];
          } catch (_e2) {
            current = [];
          }
          const applied = wanted.filter((id) => current.indexOf(id) !== -1);
          const missing = wanted.filter((id) => applied.indexOf(id) === -1);
          const label = kind === "asset" ? "\u8D44\u6E90" : "\u8282\u70B9";
          if (!applied.length) return callback(`\u9009\u4E2D\u672A\u751F\u6548\uFF0C\u7F16\u8F91\u5668\u5F53\u524D\u9009\u4E2D: ${current.length ? current.join(", ") : "\u7A7A"}`);
          callback(null, missing.length ? `\u5DF2\u9009\u4E2D ${applied.length} \u4E2A${label}\uFF1A${applied.join(", ")}\uFF1B${missing.length} \u4E2A\u65E0\u6548\uFF1A${missing.join(", ")}` : `\u5DF2\u9009\u4E2D ${applied.length} \u4E2A${label}\uFF1A${applied.join(", ")}`);
        }, 20);
        break;
      }
      case "refresh_editor":
        const refreshPath = properties && properties.path ? properties.path : "db://assets";
        const hasExtension = pathModule2.extname(refreshPath) !== "";
        if (!hasExtension) {
          const hint = refreshPath === "db://assets" ? "\u5168\u5C40\u5237\u65B0 db://assets \u4F1A\u963B\u585E\u7F16\u8F91\u5668\u6570\u5206\u949F\u3002\u8BF7\u4EC5\u5237\u65B0\u5177\u4F53\u4FEE\u6539\u7684\u6587\u4EF6\u8DEF\u5F84\uFF08\u5982 db://assets/scripts/MyScript.ts\uFF09\u3002" : `\u76EE\u5F55\u7EA7\u5237\u65B0 "${refreshPath}" \u4F1A\u963B\u585E\u7F16\u8F91\u5668\u4E3B\u7EBF\u7A0B\uFF0C\u4E14\u53EF\u80FD\u89E6\u53D1\u7F16\u8BD1\u7EA7\u8054\u5361\u6B7B\u3002\u8BF7\u4EC5\u5237\u65B0\u8BE5\u76EE\u5F55\u4E0B\u5177\u4F53\u4FEE\u6539\u7684\u5355\u4E2A\u6587\u4EF6\u3002`;
          return callback(hint);
        }
        Editor.assetdb.refresh(refreshPath, (err) => {
          if (err) {
            callback(`\u5237\u65B0\u5931\u8D25: ${err}`);
          } else {
            callback(null, `\u7F16\u8F91\u5668\u5DF2\u5237\u65B0: ${refreshPath}`);
          }
        });
        break;
      default:
        callback("\u672A\u77E5\u7684\u7F16\u8F91\u5668\u7BA1\u7406\u64CD\u4F5C");
        break;
    }
  }
  // 管理着色器 (Effect)
  static async manageShader(args, callback) {
    const { action, path: effectPath, content } = args;
    switch (action) {
      case "create":
        if (Editor.assetdb.exists(effectPath)) {
          return callback(`Effect \u5DF2\u5B58\u5728: ${effectPath}`);
        }
        const defaultEffect = `CCEffect %{
  techniques:
  - passes:
    - vert: vs
      frag: fs
      blendState:
        targets:
        - blend: true
      rasterizerState:
        cullMode: none
      properties:
        texture: { value: white }
        mainColor: { value: [1, 1, 1, 1], editor: { type: color } }
}%

CCProgram vs %{
  precision highp float;
  #include <cc-global>
  attribute vec3 a_position;
  attribute vec2 a_uv0;
  varying vec2 v_uv0;
  void main () {
    gl_Position = cc_matViewProj * vec4(a_position, 1.0);
    v_uv0 = a_uv0;
  }
}%

CCProgram fs %{
  precision highp float;
  uniform sampler2D texture;
  uniform Constant {
    vec4 mainColor;
  };
  varying vec2 v_uv0;
  void main () {
    gl_FragColor = mainColor * texture2D(texture, v_uv0);
  }
}%`;
        AssetPatcher.safeCreateAsset(effectPath, content || defaultEffect, callback);
        break;
      case "read":
        if (!Editor.assetdb.exists(effectPath)) {
          return callback(`\u627E\u4E0D\u5230 Effect: ${effectPath}`);
        }
        const fspath = Editor.assetdb.urlToFspath(effectPath);
        try {
          const data = (await readBounded(fspath)).toString("utf8");
          callback(null, data);
        } catch (e) {
          callback(`\u8BFB\u53D6 Effect \u5931\u8D25: ${e.message}`);
        }
        break;
      case "save":
      // 兼容 AI 幻觉
      case "write":
        if (!Editor.assetdb.exists(effectPath)) {
          return callback(`Effect not found: ${effectPath}`);
        }
        const writeFsPath = Editor.assetdb.urlToFspath(effectPath);
        try {
          atomicWrite(writeFsPath, content);
          Editor.assetdb.refresh(effectPath, (err) => {
            callback(err ? `Effect \u5DF2\u5199\u5165\uFF0C\u4F46 AssetDB \u5237\u65B0\u5931\u8D25: ${err.message || err}` : null, err ? null : `Effect \u5DF2\u66F4\u65B0: ${effectPath}`);
          });
        } catch (e) {
          callback(`\u66F4\u65B0 Effect \u5931\u8D25: ${e.message}`);
        }
        break;
      case "delete":
        if (!Editor.assetdb.exists(effectPath)) {
          return callback(`\u627E\u4E0D\u5230 Effect: ${effectPath}`);
        }
        EditorWriteTools.deleteAsset(effectPath, (err) => {
          callback(err, err ? null : `Effect \u5DF2\u5220\u9664: ${effectPath}`);
        });
        break;
      case "get_info":
        if (Editor.assetdb.exists(effectPath)) {
          const uuid = Editor.assetdb.urlToUuid(effectPath);
          const info = Editor.assetdb.assetInfoByUuid(uuid);
          callback(null, info || { url: effectPath, uuid, exists: true });
        } else {
          callback(`\u627E\u4E0D\u5230 Effect: ${effectPath}`);
        }
        break;
      default:
        callback(`Unknown shader action: ${action}`);
        break;
    }
  }
  // 管理材质
  static async manageMaterial(args, callback) {
    const { action, path: matPath, properties = {} } = args;
    switch (action) {
      case "create":
        if (Editor.assetdb.exists(matPath)) {
          return callback(`\u6750\u8D28\u5DF2\u5B58\u5728: ${matPath}`);
        }
        const materialData = {
          __type__: "cc.Material",
          _name: "",
          _objFlags: 0,
          _native: "",
          _effectAsset: properties.shaderUuid ? { __uuid__: properties.shaderUuid } : null,
          _techniqueIndex: 0,
          _techniqueData: {
            0: {
              defines: properties.defines || {},
              props: properties.uniforms || {}
            }
          }
        };
        AssetPatcher.safeCreateAsset(matPath, JSON.stringify(materialData, null, 2), callback);
        break;
      case "save":
      // 兼容 AI 幻觉
      case "update":
        if (!Editor.assetdb.exists(matPath)) {
          return callback(`\u627E\u4E0D\u5230\u6750\u8D28: ${matPath}`);
        }
        const fspath = Editor.assetdb.urlToFspath(matPath);
        try {
          const content = (await readBounded(fspath)).toString("utf8");
          const matData = JSON.parse(content);
          if (!matData._techniqueData) matData._techniqueData = {};
          if (!matData._techniqueData["0"]) matData._techniqueData["0"] = {};
          const tech = matData._techniqueData["0"];
          if (properties.shaderUuid) {
            matData._effectAsset = { __uuid__: properties.shaderUuid };
          }
          if (properties.defines) {
            tech.defines = Object.assign(tech.defines || {}, properties.defines);
          }
          atomicWrite(fspath, JSON.stringify(matData, null, 2), content);
          Editor.assetdb.refresh(matPath, (err) => {
            callback(err ? `\u6750\u8D28\u5DF2\u5199\u5165\uFF0C\u4F46 AssetDB \u5237\u65B0\u5931\u8D25: ${err.message || err}` : null, err ? null : `\u6750\u8D28\u5DF2\u66F4\u65B0: ${matPath}`);
          });
        } catch (e) {
          callback(`\u66F4\u65B0\u6750\u8D28\u5931\u8D25: ${e.message}`);
        }
        break;
      case "delete":
        if (!Editor.assetdb.exists(matPath)) {
          return callback(`\u627E\u4E0D\u5230\u6750\u8D28: ${matPath}`);
        }
        EditorWriteTools.deleteAsset(matPath, (err) => {
          callback(err, err ? null : `\u6750\u8D28\u5DF2\u5220\u9664: ${matPath}`);
        });
        break;
      case "get_info":
        if (Editor.assetdb.exists(matPath)) {
          const uuid = Editor.assetdb.urlToUuid(matPath);
          const info = Editor.assetdb.assetInfoByUuid(uuid);
          callback(null, info || { url: matPath, uuid, exists: true });
        } else {
          callback(`\u627E\u4E0D\u5230\u6750\u8D28: ${matPath}`);
        }
        break;
      default:
        callback(`Unknown material action: ${action}`);
        break;
    }
  }
  /**
   * 安全创建资源 (V8 完美原子级联方案)
   * 从根源解决 Cocos 原生由于 API 缺陷导致的一系列并发时序和子资产提取错乱 Bug。
   * 策略：永远不去触碰物理项目文件夹里的 fs.mkdir。计算出缺失的深层树结构，
   * 在 OS Temp 文件夹构建整颗由缺失目录和最终文件组成的隔离树，最后通过
   * 原生的 Editor.assetdb.import 单次原子地把整个树吸入最底层的共有确切父节点。
   *
   * @param {string} path db:// 资源路径
   * @param {string|Buffer} content 文件内容
   * @param {Function} originalCallback 外层完毕回调 (err, msg)
   * @param {Function} [postCreateModifier] 修改 Meta 的可选回调
   */
  static manageTexture(args, callback) {
    const { action, path: path12, properties } = args;
    switch (action) {
      case "create":
        if (Editor.assetdb.exists(path12)) {
          return callback(`\u7EB9\u7406\u5DF2\u5B58\u5728: ${path12}`);
        }
        let base64Data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII=";
        if (properties && properties.content) {
          base64Data = properties.content;
        }
        const textureBuffer = Buffer.from(base64Data, "base64");
        AssetPatcher.safeCreateAsset(path12, textureBuffer, callback, (doneCreate) => {
          if (properties && (properties.border || properties.type)) {
            const uuid2 = Editor.assetdb.urlToUuid(path12);
            if (!uuid2) return doneCreate(null, `\u7EB9\u7406\u5DF2\u521B\u5EFA\uFF0C\u4F46\u672A\u80FD\u7ACB\u5373\u83B7\u53D6 UUID\u3002`);
            setTimeout(() => {
              const meta2 = Editor.assetdb.loadMeta(uuid2);
              if (meta2) {
                let changed2 = false;
                if (properties.type) {
                  meta2.type = properties.type;
                  changed2 = true;
                }
                if (properties.border) {
                  meta2.type = "sprite";
                  const subKeys = Object.keys(meta2.subMetas);
                  if (subKeys.length > 0) {
                    const subMeta = meta2.subMetas[subKeys[0]];
                    subMeta.border = properties.border;
                    changed2 = true;
                  }
                }
                if (changed2) {
                  Editor.assetdb.saveMeta(uuid2, JSON.stringify(meta2), (metaErr) => {
                    if (metaErr) Editor.warn(`\u4FDD\u5B58\u8D44\u6E90 Meta \u5931\u8D25 ${path12}: ${metaErr}`);
                    doneCreate(null, `\u7EB9\u7406\u5DF2\u521B\u5EFA\u5E76\u66F4\u65B0 Meta: ${path12}`);
                  });
                  return;
                }
              }
              doneCreate(null, `\u7EB9\u7406\u5DF2\u521B\u5EFA: ${path12}`);
            }, 100);
          } else {
            doneCreate(null, `\u7EB9\u7406\u5DF2\u521B\u5EFA: ${path12}`);
          }
        });
        break;
      case "delete":
        if (!Editor.assetdb.exists(path12)) {
          return callback(`\u627E\u4E0D\u5230\u7EB9\u7406: ${path12}`);
        }
        EditorWriteTools.deleteAsset(path12, (err) => {
          callback(err, err ? null : `\u7EB9\u7406\u5DF2\u5220\u9664: ${path12}`);
        });
        break;
      case "get_info":
        if (Editor.assetdb.exists(path12)) {
          const uuid2 = Editor.assetdb.urlToUuid(path12);
          const info = Editor.assetdb.assetInfoByUuid(uuid2);
          callback(null, info || { url: path12, uuid: uuid2, exists: true });
        } else {
          callback(`\u627E\u4E0D\u5230\u7EB9\u7406: ${path12}`);
        }
        break;
      case "save":
      // 兼容 AI 幻觉
      case "update":
        if (!Editor.assetdb.exists(path12)) {
          return callback(`\u627E\u4E0D\u5230\u7EB9\u7406: ${path12}`);
        }
        const uuid = Editor.assetdb.urlToUuid(path12);
        let meta = Editor.assetdb.loadMeta(uuid);
        if (!meta) {
          try {
            const fspath = Editor.assetdb.urlToFspath(path12);
            const metaPath = fspath + ".meta";
            if (fs13.existsSync(metaPath)) {
              const metaContent = fs13.readFileSync(metaPath, "utf-8");
              meta = JSON.parse(metaContent);
            }
          } catch (e) {
          }
        }
        if (!meta) {
          return callback(`\u52A0\u8F7D\u8D44\u6E90 Meta \u5931\u8D25: ${path12}`);
        }
        let changed = false;
        if (properties) {
          for (const key of ["filterMode", "wrapMode", "premultiplyAlpha", "genMipmaps", "packable"]) {
            if (properties[key] === void 0) continue;
            if (!(key in meta) || typeof properties[key] !== typeof meta[key]) return callback("\u5F53\u524D\u7EB9\u7406 Meta \u4E0D\u652F\u6301\u8BE5\u5C5E\u6027\u6216\u7C7B\u578B\u4E0D\u5339\u914D: " + key);
            if (meta[key] !== properties[key]) {
              meta[key] = properties[key];
              changed = true;
            }
          }
          if (properties.type) {
            if (meta.type !== properties.type) {
              meta.type = properties.type;
              changed = true;
            }
          }
          if (properties.border) {
            if (meta.type !== "sprite") {
              meta.type = "sprite";
              changed = true;
            }
            const subKeys = Object.keys(meta.subMetas);
            if (subKeys.length > 0) {
              const subMeta = meta.subMetas[subKeys[0]];
              const newBorder = properties.border;
              if (subMeta.border !== void 0) {
                const oldBorder = subMeta.border;
                if (!oldBorder || oldBorder[0] !== newBorder[0] || oldBorder[1] !== newBorder[1] || oldBorder[2] !== newBorder[2] || oldBorder[3] !== newBorder[3]) {
                  subMeta.border = newBorder;
                  changed = true;
                }
              } else if (subMeta.borderTop !== void 0) {
                if (subMeta.borderTop !== newBorder[0] || subMeta.borderBottom !== newBorder[1] || subMeta.borderLeft !== newBorder[2] || subMeta.borderRight !== newBorder[3]) {
                  subMeta.borderTop = newBorder[0];
                  subMeta.borderBottom = newBorder[1];
                  subMeta.borderLeft = newBorder[2];
                  subMeta.borderRight = newBorder[3];
                  changed = true;
                }
              } else {
                subMeta.borderTop = newBorder[0];
                subMeta.borderBottom = newBorder[1];
                subMeta.borderLeft = newBorder[2];
                subMeta.borderRight = newBorder[3];
                changed = true;
              }
            }
          }
        }
        if (changed) {
          Editor.assetdb.saveMeta(uuid, JSON.stringify(meta), (err) => {
            if (err) return callback(`\u4FDD\u5B58 Meta \u5931\u8D25: ${err}`);
            callback(null, `\u7EB9\u7406\u5DF2\u66F4\u65B0: ${path12}`);
          });
        } else {
          callback(null, `\u8D44\u6E90\u4E0D\u9700\u8981\u66F4\u65B0: ${path12}`);
        }
        break;
      default:
        callback(`\u672A\u77E5\u7684\u7EB9\u7406\u64CD\u4F5C\u7C7B\u578B: ${action}`);
        break;
    }
  }
  /**
   * 对文件应用一系列精确的文本编辑操作
   * @param {Object} args 参数
   * @param {Function} callback 完成回调
   */
  static async applyTextEdits(args, callback) {
    const { filePath, edits, expectedSha } = args;
    const fspath = Editor.assetdb.urlToFspath(filePath);
    if (!fspath) {
      return callback(`\u627E\u4E0D\u5230\u6587\u4EF6\u6216 URL \u65E0\u6548: ${filePath}`);
    }
    if (/\.(prefab|fire|scene|meta)$/i.test(filePath) || /\.(prefab|fire|scene|meta)$/i.test(fspath)) {
      return callback("\u573A\u666F\u3001\u9884\u5236\u4F53\u548C meta \u4E0D\u80FD\u901A\u8FC7\u6587\u672C\u7F16\u8F91\u5DE5\u5177\u4FEE\u6539\uFF0C\u8BF7\u4F7F\u7528\u5BF9\u5E94 MCP \u5DE5\u5177");
    }
    const fs16 = require("fs");
    if (!fs16.existsSync(fspath)) {
      return callback(`\u6587\u4EF6\u4E0D\u5B58\u5728: ${fspath}`);
    }
    try {
      const original = await readBounded(fspath);
      if (expectedSha !== void 0) {
        if (typeof expectedSha !== "string" || !/^[a-f\d]{64}$/i.test(expectedSha)) throw new Error("expectedSha \u5FC5\u987B\u662F SHA-256 \u5341\u516D\u8FDB\u5236\u5B57\u7B26\u4E32");
        const actual = crypto7.createHash("sha256").update(original).digest("hex");
        if (actual !== expectedSha.toLowerCase()) throw new Error("\u6587\u4EF6 SHA-256 \u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u8BFB\u53D6\u6587\u4EF6\u540E\u518D\u7F16\u8F91\uFF1B\u672A\u5199\u5165\u4EFB\u4F55\u5185\u5BB9");
      }
      const updatedContent = applyValidatedEdits(typeof original === "string" ? original : original.toString("utf8"), edits);
      atomicWrite(fspath, updatedContent, original);
      Editor.assetdb.refresh(filePath, (err) => {
        if (err) return callback(`\u6587\u672C\u5DF2\u5199\u5165\uFF0C\u4F46\u5237\u65B0\u5931\u8D25: ${err.message || err}`);
        callback(null, `\u6587\u672C\u7F16\u8F91\u5DF2\u5E94\u7528: ${filePath}`);
      });
    } catch (err) {
      callback(`\u64CD\u4F5C\u5931\u8D25: ${err.message}`);
    }
  }
  // 读取控制台
  static readConsole(args, callback) {
    if (args.includeMetadata || args.cursor !== void 0) {
      try {
        callback(null, Logger.page(args));
      } catch (err) {
        callback(err.message);
      }
      return;
    }
    const { limit, type } = args;
    let filteredOutput = Logger.getLogs();
    if (type) {
      const targetType = type === "log" ? "info" : type;
      filteredOutput = filteredOutput.filter((item) => item.type === targetType);
    }
    if (limit) {
      filteredOutput = filteredOutput.slice(-limit);
    }
    callback(null, filteredOutput);
  }
  /**
   * 执行编辑器菜单项
   * @param {Object} args 参数 (menuPath)
   * @param {Function} callback 完成回调
   */
  static executeMenuItem(args, callback) {
    const { menuPath } = args;
    if (!menuPath) {
      return callback("\u83DC\u5355\u8DEF\u5F84\u662F\u5FC5\u586B\u9879");
    }
    const menuMap = {
      "File/New Scene": "scene:new-scene",
      "File/Save Scene": "scene:stash-and-save",
      "File/Save": "scene:stash-and-save",
      // 别名
      "Edit/Undo": "scene:undo",
      "Edit/Redo": "scene:redo",
      "Edit/Delete": "scene:delete-nodes",
      Delete: "scene:delete-nodes",
      delete: "scene:delete-nodes"
    };
    if (menuPath.startsWith("delete-node:")) {
      const uuid = menuPath.split(":")[1];
      if (uuid) {
        CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "delete-node", { uuid }, (err, result) => {
          if (err) callback(err);
          else callback(null, result || `\u8282\u70B9 ${uuid} \u5DF2\u901A\u8FC7\u573A\u666F\u811A\u672C\u5220\u9664`);
        });
        return;
      }
    }
    if (menuMap[menuPath]) {
      const ipcMsg = menuMap[menuPath];
      try {
        if (ipcMsg === "scene:delete-nodes") {
          const selection = Editor.Selection.curSelection("node");
          if (selection.length > 0) {
            Editor.Ipc.sendToMain(ipcMsg, selection);
            callback(null, `\u83DC\u5355\u52A8\u4F5C\u5DF2\u89E6\u53D1: ${menuPath} -> ${ipcMsg} (\u5F71\u54CD ${selection.length} \u4E2A\u8282\u70B9)`);
          } else {
            callback("\u6CA1\u6709\u9009\u4E2D\u4EFB\u4F55\u8282\u70B9\u8FDB\u884C\u5220\u9664");
          }
        } else {
          Editor.Ipc.sendToMain(ipcMsg);
          callback(null, `\u83DC\u5355\u52A8\u4F5C\u5DF2\u89E6\u53D1: ${menuPath} -> ${ipcMsg}`);
        }
      } catch (err) {
        callback(`\u6267\u884C IPC ${ipcMsg} \u5931\u8D25: ${err.message}`);
      }
    } else {
      callback(`\u4E0D\u652F\u6301\u6267\u884C\u975E\u9884\u8BBE\u83DC\u5355\u8DEF\u5F84: ${menuPath}\u3002\u5982\u786E\u9700\u8BE5\u83DC\u5355\uFF0C\u8BF7\u5728 ToolDispatcher \u7684 menuMap \u4E2D\u8865\u5145\u771F\u6B63\u7684 IPC \u6D88\u606F\u6620\u5C04\u3002`);
    }
  }
  /**
   * 验证脚本文件的语法或基础结构
   * @param {Object} args 参数 (filePath)
   * @param {Function} callback 完成回调
   */
  static async validateScript(args, callback) {
    const { filePath } = args;
    const fspath = Editor.assetdb.urlToFspath(filePath);
    if (!fspath) {
      return callback(`\u627E\u4E0D\u5230\u6587\u4EF6\u6216 URL \u65E0\u6548: ${filePath}`);
    }
    if (!fs13.existsSync(fspath)) {
      return callback(`\u6587\u4EF6\u4E0D\u5B58\u5728: ${fspath}`);
    }
    try {
      const content = (await readBounded(fspath)).toString("utf8");
      if (!content || content.trim().length === 0) {
        return callback(null, { valid: false, message: "\u811A\u672C\u5185\u5BB9\u4E3A\u7A7A" });
      }
      if (filePath.endsWith(".js")) {
        const wrapper = `(function() { ${content} })`;
        try {
          new Function(wrapper);
          callback(null, { valid: true, message: "JavaScript \u8BED\u6CD5\u9A8C\u8BC1\u901A\u8FC7" });
        } catch (syntaxErr) {
          return callback(null, { valid: false, message: syntaxErr.message });
        }
      } else if (filePath.endsWith(".ts")) {
        const result = await runScriptDiagnostics(Editor.Project.path);
        callback(null, { ...result, valid: result.ok, requestedFile: filePath, message: "\u6309\u5DE5\u7A0B tsconfig \u68C0\u67E5\uFF0C\u5305\u542B\u8BE5\u5DE5\u7A0B\u5176\u4ED6\u6587\u4EF6\u7684\u9519\u8BEF\uFF1B\u4E0D\u4EE3\u8868 Creator \u7F16\u8BD1\u6216\u9884\u89C8\u5DF2\u5B8C\u6210" });
      } else {
        callback(null, { valid: false, status: "unsupported", message: "\u672A\u77E5\u811A\u672C\u7C7B\u578B\uFF0C\u672A\u6267\u884C\u9A8C\u8BC1\u3002" });
      }
    } catch (err) {
      callback(null, { valid: false, message: `\u8BFB\u53D6\u9519\u8BEF: ${err.message}` });
    }
  }
  // 暴露给 MCP 或面板的 API 封装
};
_ToolDispatcher.isSceneBusy = false;
_ToolDispatcher.lastScreenshotTime = 0;
_ToolDispatcher.lastScreenshotData = "";
var ToolDispatcher = _ToolDispatcher;

// src/core/McpRouter.ts
init_HttpServer();
init_LogPreview();

// src/core/CallActivity.ts
init_define_MCP_BRIDGE_BUILD();
var import_crypto5 = require("crypto");
init_LogPreview();
var _CallActivity = class _CallActivity {
  constructor(tool, args = {}) {
    this.tool = tool;
    this.callId = "call_" + (0, import_crypto5.randomBytes)(10).toString("hex");
    this.receivedAt = Date.now();
    this.startedAt = this.receivedAt;
    _CallActivity.totalCalls++;
    this.argumentsPreview = formatLogPreview(args);
  }
  static list() {
    return this.recent.slice(0, 30);
  }
  static clear() {
    this.recent = [];
  }
  start() {
    this.startedAt = Date.now();
  }
  finish(error, result) {
    if (this.finished) return this.finished;
    const timings = { queueWaitMs: this.startedAt - this.receivedAt, executionMs: Date.now() - this.startedAt, totalMs: Date.now() - this.receivedAt };
    const logs = [{ event: "started", tool: this.tool }];
    const steps = this.tool === "batch_execute" ? Array.isArray(result) ? result : (result == null ? void 0 : result.results) || [] : [];
    for (const step of steps.slice(0, 48)) logs.push({
      event: "operation",
      tool: step.tool,
      id: step.id,
      ok: !step.error,
      ...step.error ? { error: truncateLogText(String(step.error), 500) } : {}
    });
    logs.push({ event: error ? "failed" : "completed", ...error ? { error: truncateLogText(String(error.message || error), 1e3) } : {} });
    this.finished = {
      ok: !error,
      tool: this.tool,
      callId: this.callId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      timings,
      logs,
      logsOmitted: Math.max(0, steps.length - 48),
      ...(result == null ? void 0 : result.kind) === "mcp-bridge.script.v1" ? { data: result.data, execution: result.execution, truncated: !!result.truncated, pending: !!result.pending } : {},
      ...(result == null ? void 0 : result.executedCount) !== void 0 ? { executedCount: result.executedCount, nextOperationIndex: result.nextOperationIndex } : {}
    };
    _CallActivity.recent.unshift({
      callId: this.callId,
      tool: this.tool,
      ok: !error,
      at: (/* @__PURE__ */ new Date()).toISOString(),
      timings,
      arguments: this.argumentsPreview,
      result: formatLogPreview(result),
      error: error ? formatLogPreview(String(error.message || error)) : null,
      steps: logs.filter((log) => log.event === "operation").map((log) => ({ tool: log.tool, id: log.id, ok: log.ok, error: log.error ? formatLogPreview(log.error) : void 0 }))
    });
    _CallActivity.recent.length = Math.min(100, _CallActivity.recent.length);
    return this.finished;
  }
};
_CallActivity.totalCalls = 0;
_CallActivity.recent = [];
var CallActivity = _CallActivity;

// src/core/McpRouter.ts
init_ProjectContext();

// src/core/McpHttpGateway.ts
init_define_MCP_BRIDGE_BUILD();
init_ProjectContext();
function prepareMcpRequest(req, res, tools) {
  const context = getProjectContext(), route = projectRoute(req.url || "/", context);
  if (route.error) {
    res.writeHead(route.status);
    res.end(JSON.stringify({ error: route.error, projectContext: context }));
    return null;
  }
  req.projectScoped = route.scoped;
  req.url = route.path;
  if (!["/", "/mcp", "/mcp/"].includes(req.url)) return { req, res };
  if (req.method && req.method !== "POST") {
    res.writeHead(405);
    res.end(JSON.stringify({ error: "\u4F7F\u7528 POST \u8C03\u7528 MCP" }));
    return null;
  }
  let rpc;
  try {
    rpc = JSON.parse(req.bodyString || "{}");
  } catch (_) {
    res.writeHead(400);
    res.end(JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Invalid JSON" } }));
    return null;
  }
  const reply = (result, error) => {
    var _a;
    res.writeHead(200);
    res.end(JSON.stringify({ jsonrpc: "2.0", id: (_a = rpc == null ? void 0 : rpc.id) != null ? _a : null, ...error ? { error } : { result } }));
  };
  if (!rpc || typeof rpc !== "object" || Array.isArray(rpc) || rpc.jsonrpc !== "2.0" || typeof rpc.method !== "string" || rpc.id !== void 0 && rpc.id !== null && !["string", "number"].includes(typeof rpc.id) || rpc.method === "tools/call" && rpc.id === void 0) {
    reply(void 0, { code: -32600, message: "Invalid Request" });
    return null;
  }
  if (rpc.method === "initialize") {
    reply({
      protocolVersion: "2024-11-05",
      serverInfo: { name: "cocos-bridge", version: BUILD_INFO.version },
      capabilities: { tools: {} },
      mcpBridge: { context, endpoint: projectEndpoint(context) },
      instructions: "\u5199\u5165\u524D\u72EC\u7ACB\u6838\u5BF9 mcpBridge.context.project_path \u4E0E project_id\u3002\u65E7 HTTP \u5165\u53E3\u5199\u5165\u9700 expected_context\uFF1B\u663E\u5F0F\u51ED\u8BC1\u4F1A\u68C0\u6D4B\u7F16\u8F91\u5668\u91CD\u8F7D\u3002\u62D6\u62FD\u56DE\u6267\u4E0D\u4EE3\u8868\u6E38\u620F\u63A5\u53D7\u8F93\u5165\u3002"
    });
    return null;
  }
  if (rpc.id === void 0 && rpc.method.startsWith("notifications/")) {
    res.writeHead(202);
    res.end();
    return null;
  }
  if (rpc.method === "ping") {
    reply({});
    return null;
  }
  if (rpc.method === "tools/list") {
    try {
      reply({ tools: tools() });
    } catch (err) {
      reply(void 0, { code: -32603, message: "\u5DE5\u5177\u9884\u8BBE\u8BFB\u53D6\u5931\u8D25: " + err.message });
    }
    return null;
  }
  if (rpc.method !== "tools/call") {
    reply(void 0, { code: -32601, message: "Method not found" });
    return null;
  }
  if (!rpc.params || typeof rpc.params.name !== "string" || rpc.params.arguments !== void 0 && (!rpc.params.arguments || typeof rpc.params.arguments !== "object" || Array.isArray(rpc.params.arguments))) {
    reply(void 0, { code: -32602, message: "Invalid tool arguments" });
    return null;
  }
  req.url = "/call-tool";
  req.bodyString = JSON.stringify(rpc.params);
  let status = 200;
  return { req, res: {
    get destroyed() {
      return res.destroyed;
    },
    writeHead(value) {
      status = value;
    },
    end(body) {
      let value;
      try {
        value = JSON.parse(body);
      } catch (_) {
        value = { error: String(body) };
      }
      if (status !== 200) reply(void 0, { code: -32e3, message: value.error || "HTTP " + status, data: value });
      else reply({ ...value, projectContext: context });
    }
  } };
}

// src/core/McpRouter.ts
function exposedTools() {
  return configuredTools(getProjectContext().project_path, getToolsList());
}
var McpRouter = class {
  static handleRequest(req, res) {
    const prepared = prepareMcpRequest(req, res, exposedTools);
    if (!prepared) return;
    req = prepared.req;
    res = prepared.res;
    const url = req.url;
    const body = req.bodyString;
    if (url === "/list-tools") {
      try {
        const tools = exposedTools();
        Logger.info(`AI Client requested tool list`);
        res.writeHead(200);
        return res.end(JSON.stringify({ tools }));
      } catch (err) {
        res.writeHead(500);
        return res.end(JSON.stringify({ error: "\u5DE5\u5177\u9884\u8BBE\u8BFB\u53D6\u5931\u8D25: " + err.message }));
      }
    }
    if (url === "/mcp-status") {
      try {
        const projectPath = global.Editor ? global.Editor.Project.path : process.cwd();
        res.writeHead(200);
        res.end(JSON.stringify({
          port: HttpServer.config.port,
          projectName: require("path").basename(projectPath),
          projectPath,
          projectContext: getProjectContext(),
          endpoint: projectEndpoint(),
          mcp: getRuntimeInfo("editor", __filename)
        }));
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: String(e) }));
      }
      return;
    }
    if (url === "/mcp-diagnostics") {
      res.writeHead(200);
      return res.end(JSON.stringify({ editor: getRuntimeInfo("editor", __filename), queue: CommandQueue.snapshot() }));
    }
    if (url === "/list-resources") {
      const resources = McpWrappers.getResourcesList();
      Logger.info(`AI Client requested resource list`);
      res.writeHead(200);
      return res.end(JSON.stringify({ resources }));
    }
    if (url === "/read-resource") {
      try {
        const { uri } = JSON.parse(body || "{}");
        Logger.mcp(`READ -> [${uri}]`);
        McpWrappers.handleReadResource(uri, (err, content) => {
          if (err) {
            Logger.error(`\u8BFB\u53D6\u5931\u8D25: ${err}`);
            res.writeHead(500);
            return res.end(JSON.stringify({ error: err }));
          }
          Logger.success(`\u8BFB\u53D6\u6210\u529F: ${uri}`);
          res.writeHead(200);
          res.end(
            JSON.stringify({
              contents: [
                {
                  uri,
                  mimeType: "application/json",
                  text: typeof content === "string" ? content : JSON.stringify(content)
                }
              ]
            })
          );
        });
      } catch (e) {
        res.writeHead(500);
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
    if (url === "/call-tool") {
      try {
        const params = JSON.parse(body || "{}");
        const { name, arguments: args = {} } = params;
        const error = contextError(params, !!req.projectScoped);
        if (error) {
          res.writeHead(409);
          return res.end(JSON.stringify({ error, projectContext: getProjectContext() }));
        }
        const activity = new CallActivity(name, args);
        if (name === "build_project" && args.action === "status" || ["simulate_mouse_drag", "simulate_mouse_click"].includes(name) && ["status", "cancel"].includes(args.action)) {
          activity.start();
          ToolDispatcher.handleMcpCall(name, args, (err, result) => {
            res.writeHead(200);
            res.end(JSON.stringify({ projectContext: getProjectContext(), isError: !!err, structuredContent: activity.finish(err, result), content: [{ type: "text", text: JSON.stringify(result || { error: String(err) }) }] }));
          });
          return;
        }
        if (name === "get_project_info" && args.includeMcpDiagnostics && (CommandQueue.snapshot().processing || CommandQueue.getBlockedReason())) {
          const queue = CommandQueue.snapshot();
          res.writeHead(200);
          return res.end(JSON.stringify({ structuredContent: activity.finish(null, null), content: [{ type: "text", text: JSON.stringify({
            path: Editor.Project.path,
            queue,
            mcpDiagnostics: composeDiagnostics(getRuntimeInfo("editor", __filename), null, null, "\u961F\u5217\u5FD9\u6216\u963B\u585E\uFF0C\u672A\u67E5\u8BE2\u53EF\u53D8\u573A\u666F")
          }) }] }));
        }
        const receivedAt = Date.now();
        let argsPreview = "";
        if (args) {
          try {
            argsPreview = formatLogPreview(args);
          } catch (e) {
            argsPreview = "[\u65E0\u6CD5\u5E8F\u5217\u5316\u7684\u53C2\u6570]";
          }
        }
        Logger.mcp(`[${activity.callId}] REQ -> [${name}] (\u961F\u5217\u957F\u5EA6: ${CommandQueue.getLength()}) \u53C2\u6570: ${argsPreview}`);
        let responseSent = false;
        CommandQueue.enqueue((done) => {
          if (res.destroyed) {
            done();
            return;
          }
          const startTime = Date.now();
          activity.start();
          try {
            ToolDispatcher.handleMcpCall(name, args, (err, result) => {
              if (responseSent) {
                done();
                return;
              }
              responseSent = true;
              const duration = Date.now() - startTime;
              let resultText;
              try {
                resultText = typeof result === "object" ? JSON.stringify(result) : String(result != null ? result : "");
              } catch (failure) {
                err = `\u64CD\u4F5C\u5DF2\u8FD4\u56DE\uFF0C\u4F46\u7ED3\u679C\u65E0\u6CD5\u5E8F\u5217\u5316\uFF0C\u7981\u6B62\u76F4\u63A5\u91CD\u653E: ${failure.message}`;
                resultText = "";
                result = void 0;
              }
              const response = {
                projectContext: getProjectContext(),
                structuredContent: activity.finish(err, result),
                timings: { queueWaitMs: startTime - receivedAt, executionMs: duration, totalMs: Date.now() - receivedAt },
                isError: !!err,
                content: [
                  {
                    type: "text",
                    text: err ? `Error: ${err}` : resultText
                  }
                ]
              };
              if (err && result !== void 0) response.content.push({ type: "text", text: typeof resultText === "string" ? resultText : JSON.stringify(result) });
              if (err) {
                if (typeof CommandQueue.recordError === "function") CommandQueue.recordError(name, err);
                Logger.error(`[${activity.callId}] RES <- [${name}] \u5931\u8D25 (\u8017\u65F6 ${duration}ms): ${err}`);
              } else {
                let preview = "";
                preview = formatLogPreview(result);
                const logText = `[${activity.callId}] RES <- [${name}] \u6210\u529F (\u8017\u65F6 ${duration}ms) : ${preview.substring(0, 200)}${preview.length > 200 ? "..." : ""}`;
                if (duration > 1e3) {
                  Logger.warn(`[\u6162\u64CD\u4F5C\u544A\u8B66] ${logText}`);
                } else {
                  Logger.success(logText);
                }
              }
              if (!err && name === "capture_editor_screenshot" && args.responseMode !== "text") {
                const image = /^data:(image\/(?:png|jpeg));base64,(.+)$/.exec(typeof result === "string" ? result : (result == null ? void 0 : result.dataUrl) || "");
                if (image) {
                  response.content = [{ type: "image", mimeType: image[1], data: image[2] }];
                  if (result && typeof result === "object") {
                    const { dataUrl, ...metadata } = result;
                    response.content.push({ type: "text", text: JSON.stringify(metadata) });
                  }
                }
              }
              try {
                if (!res.destroyed) {
                  res.writeHead(200);
                  res.end(JSON.stringify(response));
                }
              } finally {
                done();
              }
            });
          } catch (err) {
            if (!responseSent) {
              responseSent = true;
              res.writeHead(200);
              res.end(JSON.stringify({ isError: true, structuredContent: activity.finish(err, null), content: [{ type: "text", text: String(err.message || err) }] }));
            }
            done();
          }
        }, () => {
          if (!responseSent) {
            responseSent = true;
            try {
              res.writeHead(504);
              res.end(JSON.stringify({ error: `\u64CD\u4F5C\u8D85\u65F6: ${name} (60s)`, structuredContent: activity.finish("\u64CD\u4F5C\u8D85\u65F6\uFF0C\u540E\u53F0\u5B8C\u6210\u72B6\u6001\u672A\u77E5\uFF0C\u7981\u6B62\u76F4\u63A5\u91CD\u653E", null) }));
            } catch (_e) {
            }
          }
        }, name).catch((rejectReason) => {
          if (!responseSent) {
            responseSent = true;
            res.writeHead(429);
            res.end(JSON.stringify({ error: String(rejectReason), structuredContent: activity.finish(rejectReason, null) }));
          }
        });
      } catch (e) {
        if (e instanceof SyntaxError) {
          Logger.error(`JSON Parse Error: ${e.message}`);
          res.writeHead(400);
          res.end(JSON.stringify({ error: "Invalid JSON" }));
        } else {
          Logger.error(`Internal Server Error: ${e.message}`);
          res.writeHead(500);
          res.end(JSON.stringify({ error: e.message }));
        }
      }
      return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ error: "Not Found", url }));
  }
};

// src/main.ts
init_Logger();

// src/IpcManager.ts
init_define_MCP_BRIDGE_BUILD();
var fs14 = __toESM(require("fs"));
var IpcManager = class {
  /**
   * 获取所有 IPC 消息列表
   * @returns {Array} 消息定义列表
   */
  static getIpcMessages() {
    const docPath = Editor.url("packages://mcp-bridge/docs/IPC_MESSAGES.md");
    if (!fs14.existsSync(docPath)) {
      Editor.error(`[IPC \u7BA1\u7406\u5668] \u627E\u4E0D\u5230\u6587\u6863\u6587\u4EF6: ${docPath}`);
      return [];
    }
    const content = fs14.readFileSync(docPath, "utf-8");
    const messages = [];
    const regex = /### `(.*?)`\r?\n([\s\S]*?)(?=### `|$)/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const name = match[1];
      const body = match[2];
      const purposeMatch = body.match(/- \*\*用途\*\*: (.*)/);
      const description = purposeMatch ? purposeMatch[1].trim() : "\u65E0\u63CF\u8FF0";
      const paramsMatch = body.match(/- \*\*参数\*\*: (.*)/);
      const params = paramsMatch ? paramsMatch[1].trim() : "\u65E0";
      const returnMatch = body.match(/- \*\*返回值\*\*: (.*)/);
      const returns = returnMatch ? returnMatch[1].trim() : "\u65E0";
      const typeMatch = body.match(/- \*\*类型\*\*: (.*)/);
      const type = typeMatch ? typeMatch[1].trim() : "\u672A\u5B9A\u4E49";
      const statusMatch = body.match(/- \*\*状态\*\*: (.*)/);
      const status = statusMatch ? statusMatch[1].trim() : "\u672A\u6D4B\u8BD5";
      if (type === "\u5E7F\u64AD\u4E8B\u4EF6" || type === "Events listened by Renderer Process" || type === "\u6E32\u67D3\u8FDB\u7A0B\u76D1\u542C") {
        continue;
      }
      messages.push({
        name,
        description,
        params,
        returns,
        type,
        status
      });
    }
    return messages;
  }
  /**
   * 测试发送 IPC 消息
   * @param {string} name 消息名称
   * @param {*} args 参数
   * @returns {Promise} 测试结果
   */
  static testIpcMessage(name, args) {
    if (args === void 0) args = null;
    return new Promise((resolve6) => {
      try {
        if (Editor.Ipc.sendToMain) {
          Editor.Ipc.sendToMain(name, args);
          resolve6({ success: true, message: "\u6D88\u606F\u5DF2\u53D1\u9001 (sendToMain)" });
        } else {
          resolve6({ success: false, message: "Editor.Ipc.sendToMain \u4E0D\u53EF\u7528" });
        }
      } catch (e) {
        resolve6({ success: false, message: `\u9519\u8BEF: ${e.message}` });
      }
    });
  }
};

// src/utils/resolveBuildPlatform.ts
init_define_MCP_BRIDGE_BUILD();
var GROUP_PLATFORMS = {
  "mini-game": true,
  runtime: true
};
var TOP_LEVEL_PLATFORMS = {
  "web-mobile": true,
  "web-desktop": true,
  "fb-instant-games": true,
  wechatgame: true,
  bytedance: true,
  baidugame: true,
  alipay: true,
  "alipay-minigame": true,
  "taobao-minigame": true,
  xiaomi: true,
  android: true,
  ios: true,
  mac: true,
  win32: true,
  "android-instant": true,
  "harmonyos-next": true
};
var ALIAS_TO_ACTUAL = {
  bytedance: "bytedance",
  baidu: "baidugame",
  baidugame: "baidugame",
  "baidugame-subcontext": "baidugame-subcontext",
  "bytedance-subcontext": "bytedance-subcontext",
  alipay: "alipay",
  "alipay-minigame": "alipay-minigame",
  taobao: "taobao-minigame",
  "taobao-minigame": "taobao-minigame",
  xiaomi: "xiaomi",
  ks: "ks",
  kuaishou: "ks",
  wechat: "wechatgame",
  wechatgame: "wechatgame",
  oppo: "oppo-mini-game",
  "oppo-mini-game": "oppo-mini-game",
  "oppo-runtime": "oppo-runtime",
  vivo: "vivo-mini-game",
  "vivo-mini-game": "vivo-mini-game",
  "vivo-runtime": "vivo-runtime",
  huawei: "huawei-quick-game",
  "huawei-quick-game": "huawei-quick-game",
  "cocos-play": "cocos-play",
  cocosplay: "cocos-play",
  qgame: "quickgame",
  quickgame: "quickgame"
};
function collapseGroup(platform, actualPlatform) {
  const plat = (platform || "").trim();
  const actual = (actualPlatform || "").trim();
  if (GROUP_PLATFORMS[plat]) {
    const key = actual && !GROUP_PLATFORMS[actual] ? actual : "bytedance";
    return { platform: key, actualPlatform: key };
  }
  if (GROUP_PLATFORMS[actual]) {
    const key = plat && !GROUP_PLATFORMS[plat] ? plat : "bytedance";
    return { platform: key, actualPlatform: key };
  }
  const resolved = plat || actual || "web-mobile";
  return { platform: resolved, actualPlatform: actual || resolved };
}
function resolveBuildPlatform(requested, queried) {
  const q = queried || {};
  const raw = (requested || "").trim();
  const MINI_GAME_PLATFORMS = {
    bytedance: "bytedance",
    wechatgame: "wechatgame",
    alipay: "alipay-minigame",
    "alipay-minigame": "alipay-minigame",
    taobao: "taobao-minigame",
    "taobao-minigame": "taobao-minigame",
    xiaomi: "xiaomi",
    ks: "ks",
    kuaishou: "ks",
    baidugame: "baidugame",
    baidu: "baidugame",
    qgame: "quickgame",
    quickgame: "quickgame",
    oppo: "oppo-mini-game",
    "oppo-mini-game": "oppo-mini-game",
    vivo: "vivo-mini-game",
    "vivo-mini-game": "vivo-mini-game",
    huawei: "huawei-quick-game",
    "huawei-quick-game": "huawei-quick-game"
  };
  const miniGameActual = MINI_GAME_PLATFORMS[raw];
  if (miniGameActual) {
    return {
      platform: "mini-game",
      actualPlatform: miniGameActual
    };
  }
  if (!raw) {
    return collapseGroup(q.platform || "web-mobile", q.actualPlatform);
  }
  if (ALIAS_TO_ACTUAL[raw]) {
    const actual = ALIAS_TO_ACTUAL[raw];
    return { platform: actual, actualPlatform: actual };
  }
  if (GROUP_PLATFORMS[raw]) {
    return collapseGroup(raw, q.actualPlatform);
  }
  if (TOP_LEVEL_PLATFORMS[raw]) {
    return { platform: raw, actualPlatform: raw };
  }
  return { platform: raw, actualPlatform: raw };
}
function alignWithKnownTargets(pair, knownTargets) {
  const known = knownTargets || {};
  const keys = Object.keys(known);
  if (keys.length === 0) {
    return pair;
  }
  if (["web-mobile", "web-desktop", "fb-instant-games", "android", "ios", "mac", "win32", "android-instant"].includes(pair.platform)) return pair;
  if (GROUP_PLATFORMS[pair.platform] && pair.actualPlatform && !GROUP_PLATFORMS[pair.actualPlatform]) {
    return pair;
  }
  const candidates = [pair.platform, pair.actualPlatform];
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (c && known[c]) {
      return {
        platform: c,
        actualPlatform: pair.actualPlatform && known[pair.actualPlatform] ? pair.actualPlatform : c
      };
    }
  }
  return {
    platform: pair.platform,
    actualPlatform: pair.actualPlatform,
    error: `\u672A\u77E5\u6784\u5EFA\u5E73\u53F0: ${pair.platform}/${pair.actualPlatform}\uFF08\u53EF\u7528: ${keys.join(", ")}\uFF09`
  };
}
function resolveBuildDest(projectPath, buildPath, actualPlatform) {
  const pathMod2 = require("path");
  const rel = buildPath && String(buildPath).trim() ? String(buildPath) : "./build";
  if (pathMod2.isAbsolute(rel)) {
    return pathMod2.join(rel, actualPlatform);
  }
  return pathMod2.join(projectPath, rel, actualPlatform);
}

// src/core/PanelStatus.ts
init_define_MCP_BRIDGE_BUILD();
var import_child_process2 = require("child_process");
var path9 = __toESM(require("path"));
init_ProjectContext();
function gitValue(projectPath, args) {
  return new Promise((resolve6) => (0, import_child_process2.execFile)(
    "git",
    args,
    { cwd: projectPath, timeout: 2e3, windowsHide: true, maxBuffer: 4096 },
    (err, stdout) => resolve6(err ? "\u2014" : stdout.trim())
  ));
}
async function queryPanelStatus(config) {
  const projectPath = Editor.Project.path;
  const [branch, head] = await Promise.all([
    gitValue(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"]),
    gitValue(projectPath, ["rev-parse", "--short", "HEAD"])
  ]);
  return {
    config: { ...config },
    projectPath,
    engineVersion: Editor.App.version,
    branch,
    head,
    editorPid: process.pid,
    updatedAt: (/* @__PURE__ */ new Date()).toISOString(),
    endpoint: config.active ? `http://${(config.host || "127.0.0.1").includes(":") ? "[" + config.host + "]" : config.host || "127.0.0.1"}:${config.port}${projectEndpoint()}` : "",
    projectContext: getProjectContext(),
    cli: `node "${path9.join(projectPath, "packages/mcp-bridge/dist/mcp-proxy.js")}" ${config.port}`,
    tools: configuredTools(projectPath, getToolsList()).length,
    resources: McpWrappers.getResourcesList().length,
    requests: CallActivity.totalCalls,
    queue: CommandQueue.snapshot(),
    runtime: getRuntimeInfo("editor", __filename)
  };
}

// src/panel/MenuActions.ts
init_define_MCP_BRIDGE_BUILD();
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
function openPanelMenu(editor, name) {
  if (!Object.prototype.hasOwnProperty.call(PANEL_MENU_ACTIONS, name)) throw new Error("\u672A\u77E5\u7684 MCP \u83DC\u5355\u64CD\u4F5C\uFF1A" + name);
  editor.Panel.open("mcp-bridge", { menuAction: name });
}

// src/main.ts
var autoStartTimer;
var loaded = false;
module.exports = {
  "scene-script": "scene-script.js",
  openTestPanel() {
    Editor.Panel.open("mcp-bridge");
  },
  openMenuAction(event, name) {
    openPanelMenu(Editor, name);
  },
  querySpriteFrameUuid(event, uuid) {
    const fs16 = require("fs");
    try {
      const url = Editor.assetdb.uuidToUrl(uuid);
      if (!url) {
        return event.reply && event.reply(null, null);
      }
      const fspath = Editor.assetdb.urlToFspath(url);
      if (!fspath) {
        return event.reply && event.reply(null, null);
      }
      const metaPath = fspath + ".meta";
      if (fs16.existsSync(metaPath)) {
        const meta = JSON.parse(fs16.readFileSync(metaPath, "utf8"));
        if (meta && meta.subMetas) {
          const subKeys = Object.keys(meta.subMetas);
          for (let k of subKeys) {
            if (meta.subMetas[k].uuid) {
              return event.reply && event.reply(null, meta.subMetas[k].uuid);
            }
          }
        }
      }
      return event.reply && event.reply(null, null);
    } catch (e) {
      return event.reply && event.reply(null, null);
    }
  },
  getProfile() {
    return loadProjectProfile();
  },
  load() {
    var _a;
    loaded = true;
    clearTimeout(autoStartTimer);
    Logger.info("MCP Bridge Plugin Loaded");
    try {
      const os2 = require("os");
      Logger.info(`[\u7CFB\u7EDF\u6307\u7EB9] \u5E73\u53F0: ${os2.platform()}, \u67B6\u6784: ${os2.arch()}, CPU: ${((_a = os2.cpus()[0]) == null ? void 0 : _a.model) || "\u672A\u77E5"}, \u5185\u5B58: ${Math.round(os2.totalmem() / 1024 / 1024 / 1024)}GB`);
    } catch (e) {
    }
    let profile = this.getProfile();
    try {
      HttpServer.config.host = HttpServer.validateHost(profile.get("host") || "127.0.0.1");
    } catch (err) {
      HttpServer.config.startError = err.message;
      Logger.error(err.message);
      return;
    }
    HttpServer.config.port = profile.get("last-port") || 8200;
    let autoStart = profile.get("auto-start");
    if (autoStart) {
      Logger.info("Auto-start is enabled. Initializing server...");
      autoStartTimer = setTimeout(() => {
        if (!loaded) return;
        this.startServer(HttpServer.config.port);
      }, 1e3);
    }
  },
  unload() {
    EditorInput.shutdown();
    loaded = false;
    clearTimeout(autoStartTimer);
    this.stopServer();
    return Logger.flush();
  },
  startServer(port) {
    EditorInput.shutdown();
    HttpServer.start(port, McpRouter.handleRequest, (actualPort) => {
      const profile = this.getProfile();
      profile.set("last-port", actualPort);
      profile.save();
    });
  },
  stopServer() {
    EditorInput.shutdown();
    HttpServer.stop();
  },
  messages: {
    "menu-action"(event, name) {
      this.openMenuAction(event, name);
    },
    "apply-host"(event, value) {
      try {
        const host = HttpServer.validateHost(value), profile = this.getProfile();
        const restart = HttpServer.config.active || !!profile.get("auto-start");
        profile.set("host", host);
        profile.save();
        if (restart) {
          EditorInput.shutdown();
          HttpServer.start(HttpServer.config.port, McpRouter.handleRequest, (port) => {
            profile.set("last-port", port);
            profile.save();
          }, host);
        } else {
          HttpServer.config.host = host;
          HttpServer.config.startError = null;
        }
        event.reply(null, { ...HttpServer.config });
      } catch (err) {
        event.reply(String(err.message || err));
      }
    },
    "get-panel-status"(event) {
      queryPanelStatus(HttpServer.config).then((data) => event.reply(null, { ...data, calls: CallActivity.list() }), (err) => event.reply(String(err)));
    },
    "clear-call-history"(event) {
      CallActivity.clear();
      if (event.reply) event.reply(null);
    },
    "get-tool-presets"(event) {
      try {
        event.reply(null, { state: readToolPresets(Editor.Project.path, getToolsList()), tools: getToolsList() });
      } catch (err) {
        event.reply(String(err.message || err));
      }
    },
    "save-tool-presets"(event, state) {
      try {
        event.reply(null, saveToolPresets(Editor.Project.path, state, getToolsList()));
      } catch (err) {
        event.reply(String(err.message || err));
      }
    },
    "restart-server"(event) {
      this.startServer(HttpServer.config.port);
      if (event.reply) event.reply(null);
    },
    "scan-ipc-messages"(event) {
      try {
        const msgs = IpcManager.getIpcMessages();
        if (event.reply) event.reply(null, msgs);
      } catch (e) {
        if (event.reply) event.reply(e.message);
      }
    },
    "test-ipc-message"(event, args) {
      const { name, params } = args;
      IpcManager.testIpcMessage(name, params).then((result) => {
        if (event.reply) event.reply(null, result);
      });
    },
    "open-test-panel"() {
      Editor.Panel.open("mcp-bridge");
    },
    "toggle-server"(event, port) {
      if (HttpServer.config.state !== "stopped") HttpServer.stop();
      else {
        this.startServer(port);
      }
    },
    "clear-logs"() {
      Logger.clearLogs();
      Logger.info("\u65E5\u5FD7\u5DF2\u6E05\u7406");
    },
    // 修改场景中的节点（需要通过 scene-script）
    "set-node-property"(event, args) {
      Logger.mcp(`\u8BBE\u7F6E\u8282\u70B9\u5C5E\u6027: ${args.name} (${args.type})`);
      Editor.Scene.callSceneScript("mcp-bridge", "set-property", args, (err, result) => {
        if (err) {
          Editor.error("Scene Script Error:", err);
        }
        if (event && event.reply) {
          event.reply(err, result);
        }
      });
    },
    "create-node"(event, args) {
      Logger.mcp(`\u521B\u5EFA\u8282\u70B9: ${args.name} (${args.type})`);
      Editor.Scene.callSceneScript("mcp-bridge", "create-node", args, (err, result) => {
        if (err) Logger.error(`\u521B\u5EFA\u8282\u70B9\u5931\u8D25: ${err}`);
        else Logger.success(`\u8282\u70B9\u5DF2\u521B\u5EFA: ${result}`);
        event.reply(err, result);
      });
    },
    "get-server-state"(event) {
      let profile = this.getProfile();
      event.reply(null, {
        config: HttpServer.config,
        logs: Logger.getLogs(),
        autoStart: profile.get("auto-start"),
        configuredPort: profile.get("last-port") || 8200,
        screenshotMaxWidth: profile.get("screenshot-max-width") !== void 0 ? profile.get("screenshot-max-width") : 1280,
        screenshotThrottle: profile.get("screenshot-throttle") !== void 0 ? profile.get("screenshot-throttle") : 1500
      });
    },
    "set-auto-start"(event, value) {
      this.getProfile().set("auto-start", value);
      this.getProfile().save();
      Logger.info(`\u81EA\u52A8\u542F\u52A8\u5DF2\u8BBE\u7F6E\u4E3A: ${value}`);
    },
    "inspect-apis"() {
      Logger.info("[API \u68C0\u67E5\u5668] \u5F00\u59CB\u6DF1\u5EA6\u5206\u6790...");
      const getArgs = (func) => {
        try {
          const str = func.toString();
          const match = str.match(/function\s.*?\(([^)]*)\)/) || str.match(/.*?\(([^)]*)\)/);
          if (match) {
            return match[1].split(",").map((arg) => arg.trim()).filter((a) => a).join(", ");
          }
          return `${func.length} args`;
        } catch (e) {
          return "?";
        }
      };
      const inspectObj = (name, obj) => {
        if (!obj) return { name, exists: false };
        const props = {};
        const proto = Object.getPrototypeOf(obj);
        const allKeys = /* @__PURE__ */ new Set([
          ...Object.getOwnPropertyNames(obj),
          ...Object.getOwnPropertyNames(proto || {})
        ]);
        allKeys.forEach((key) => {
          if (key.startsWith("_")) return;
          try {
            const val = obj[key];
            if (typeof val === "function") {
              props[key] = `func(${getArgs(val)})`;
            } else {
              props[key] = typeof val;
            }
          } catch (e) {
          }
        });
        return { name, exists: true, props };
      };
      const standardObjects = {
        "Editor.assetdb": Editor.assetdb,
        "Editor.Selection": Editor.Selection,
        "Editor.Ipc": Editor.Ipc,
        "Editor.Panel": Editor.Panel,
        "Editor.Scene": Editor.Scene,
        "Editor.Utils": Editor.Utils,
        "Editor.remote": Editor.remote
      };
      const report = {};
      Object.keys(standardObjects).forEach((key) => {
        report[key] = inspectObj(key, standardObjects[key]);
      });
      const forumChecklist = [
        "Editor.assetdb.queryInfoByUuid",
        "Editor.assetdb.assetInfoByUuid",
        "Editor.assetdb.move",
        "Editor.assetdb.createOrSave",
        "Editor.assetdb.delete",
        "Editor.assetdb.urlToUuid",
        "Editor.assetdb.uuidToUrl",
        "Editor.assetdb.fspathToUrl",
        "Editor.assetdb.urlToFspath",
        "Editor.remote.assetdb.uuidToUrl",
        "Editor.Selection.select",
        "Editor.Selection.clear",
        "Editor.Selection.curSelection",
        "Editor.Selection.curGlobalActivate"
      ];
      const checklistResults = {};
      forumChecklist.forEach((path12) => {
        const parts = path12.split(".");
        let curr = global;
        let exists = true;
        for (const part of parts) {
          if (curr && curr[part]) {
            curr = curr[part];
          } else {
            exists = false;
            break;
          }
        }
        checklistResults[path12] = exists ? typeof curr === "function" ? `Available(${getArgs(curr)})` : "Available" : "Missing";
      });
      Logger.info(`[API \u68C0\u67E5\u5668] \u6807\u51C6\u5BF9\u8C61:
${JSON.stringify(report, null, 2)}`);
      Logger.info(`[API \u68C0\u67E5\u5668] \u8BBA\u575B\u6838\u67E5\u6E05\u5355:
${JSON.stringify(checklistResults, null, 2)}`);
      const ipcReport = {};
      const builtinPackages = ["scene", "builder", "assets"];
      const fs16 = require("fs");
      builtinPackages.forEach((pkgName) => {
        try {
          const pkgPath = Editor.url(`packages://${pkgName}/package.json`);
          if (pkgPath && fs16.existsSync(pkgPath)) {
            const pkgData = JSON.parse(fs16.readFileSync(pkgPath, "utf-8"));
            if (pkgData.messages) {
              ipcReport[pkgName] = Object.keys(pkgData.messages);
            } else {
              ipcReport[pkgName] = "No messages defined";
            }
          } else {
            ipcReport[pkgName] = "Package path not found";
          }
        } catch (e) {
          ipcReport[pkgName] = `Error: ${e.message}`;
        }
      });
      Logger.info(`[API \u68C0\u67E5\u5668] \u5185\u7F6E\u5305 IPC \u6D88\u606F:
${JSON.stringify(ipcReport, null, 2)}`);
    },
    "mcp-scan-clients"(event) {
      try {
        const { scanMcpClients: scanMcpClients2 } = (init_McpConfigurator(), __toCommonJS(McpConfigurator_exports));
        if (event.reply) event.reply(null, scanMcpClients2());
      } catch (e) {
        if (event.reply) event.reply(new Error(e.message));
      }
    },
    "mcp-inject-client"(event, clientId) {
      try {
        const { injectMcpConfig: injectMcpConfig2 } = (init_McpConfigurator(), __toCommonJS(McpConfigurator_exports));
        const log = injectMcpConfig2(clientId === -1 ? void 0 : clientId);
        if (event.reply) event.reply(null, log);
      } catch (e) {
        if (event.reply) event.reply(new Error("\u5199\u5165\u62A5\u9519: " + e.message));
      }
    },
    "mcp-get-payload"(event) {
      try {
        const { getPayload: getPayload2 } = (init_McpConfigurator(), __toCommonJS(McpConfigurator_exports));
        if (event.reply) event.reply(null, getPayload2());
      } catch (e) {
        if (event.reply) event.reply(new Error(e.message));
      }
    },
    "build-project"(event, args) {
      if ((args == null ? void 0 : args.action) === "status") {
        try {
          const job = BuildJobs.get(args.jobId);
          event.reply(job.status === "failed" ? new Error(job.error) : null, job);
        } catch (err) {
          event.reply(err);
        }
        return;
      }
      const replyErr = (msg) => {
        const errObj = msg instanceof Error ? msg : new Error(String(msg));
        Editor.warn(`[mcp-bridge] ${errObj.message}`);
        if (event.reply) event.reply(errObj);
      };
      Editor.log(`[mcp-bridge] \u63A5\u6536\u5230\u6784\u5EFA\u8BF7\u6C42 IPC\uFF0C\u5E73\u53F0: ${args && args.platform}`);
      Editor.Ipc.sendToMain("builder:query-build-options", (err, options) => {
        if (err) {
          replyErr(err);
          return;
        }
        if (!options) {
          replyErr("query-build-options \u8FD4\u56DE\u7A7A\u914D\u7F6E");
          return;
        }
        Editor.log(`[mcp-bridge] \u6210\u529F\u83B7\u53D6\u9ED8\u8BA4\u6784\u5EFA\u914D\u7F6E\uFF0C\u51C6\u5907\u8C03\u7528 Editor.Builder.build`);
        const continueBuild = (startSceneUuid, scenes) => {
          var _a;
          try {
            if (!scenes.length || !startSceneUuid || !scenes.includes(startSceneUuid)) throw new Error("\u8D77\u59CB\u573A\u666F\u4E0D\u5728\u6784\u5EFA\u573A\u666F\u5217\u8868\u4E2D\uFF0C\u8BF7\u68C0\u67E5\u573A\u666F\u548C\u6392\u9664\u914D\u7F6E");
            let pair = resolveBuildPlatform(args && args.platform, options);
            const knownTargets = Editor.Builder && Editor.Builder.simpleBuildTargets || {};
            pair = alignWithKnownTargets(pair, knownTargets);
            if (pair.error) {
              replyErr(pair.error);
              return;
            }
            const destPath = resolveBuildDest(Editor.Project.path, options.buildPath, pair.actualPlatform);
            let excludedModules = options.excludedModules || [];
            try {
              const projJson = JSON.parse(require("fs").readFileSync(require("path").join(Editor.Project.path, "settings", "project.json"), "utf8"));
              if (projJson["excluded-modules"]) {
                excludedModules = projJson["excluded-modules"];
              }
            } catch (e) {
            }
            let buildOptions = Object.assign({}, options, {
              platform: pair.platform,
              actualPlatform: pair.actualPlatform,
              debug: !!(args && args.debug),
              dest: destPath,
              scenes,
              startScene: startSceneUuid,
              excludedModules
            });
            Editor.log(`[mcp-bridge] \u5F00\u59CB\u6784\u5EFA\u9879\u76EE\uFF0C\u5BFC\u51FA ${pair.actualPlatform} \u5305\u5230 ${destPath}`);
            Editor.log(`[mcp-bridge] \u6700\u7EC8\u9632\u5FA1\u578B StartTask \u53C2\u6570: platform=${pair.platform}, actualPlatform=${pair.actualPlatform}, startScene=${startSceneUuid}, scenes.length=${scenes.length}`);
            if (typeof ((_a = Editor.Builder) == null ? void 0 : _a.build) !== "function") throw new Error("\u5F53\u524D\u7F16\u8F91\u5668\u4E0D\u652F\u6301 Editor.Builder.build");
            const job = BuildJobs.begin({ platform: pair.platform, actualPlatform: pair.actualPlatform, dest: destPath });
            try {
              Editor.Builder.build(buildOptions, (err2, result) => BuildJobs.finish(job.jobId, err2, result));
            } catch (err2) {
              BuildJobs.finish(job.jobId, err2, null);
              throw err2;
            }
            if (event.reply) event.reply(null, BuildJobs.get(job.jobId));
          } catch (e) {
            const msg = e && e.stack ? e.stack : String(e);
            try {
              Editor.error(`[mcp-bridge] \u53D1\u8D77\u6784\u5EFA\u5931\u8D25: ${msg}`);
            } catch (_e) {
            }
            replyErr(`\u53D1\u8D77\u6784\u5EFA\u5931\u8D25: ${e && e.message ? e.message : e}`);
          }
        };
        const excluded = new Set(options.excludeScenes || []);
        const useScenes = (scenes) => {
          const included = scenes.filter((uuid) => !excluded.has(uuid));
          continueBuild(options.startScene || included[0], included);
        };
        if (Array.isArray(options.scenes) && options.scenes.length) useScenes(options.scenes.slice());
        else {
          Editor.assetdb.queryAssets(null, "scene", (error, assets) => {
            if (error) return replyErr(error);
            useScenes((assets || []).map((asset) => asset.uuid));
          });
        }
      });
    },
    "get-project-info"(event) {
      const info = {
        path: Editor.Project.path,
        version: Editor.App.version,
        openScene: Editor.currentSceneUuid
      };
      if (event.reply) event.reply(null, info);
    },
    "inspect-builder-targets"(event) {
      const summarizeBuilder = (obj) => {
        if (!obj) return { exists: false };
        let keys = [];
        try {
          keys = Object.keys(obj);
        } catch (e) {
          keys = ["<\u8BFB\u53D6\u952E\u5931\u8D25: " + e.message + ">"];
        }
        const out = { exists: true, keys };
        try {
          const sbt = obj.simpleBuildTargets;
          if (sbt) {
            out.simpleBuildTargetsKeys = Object.keys(sbt);
          } else {
            out.simpleBuildTargets = "\u4E0D\u5B58\u5728\u7684\u5C5E\u6027";
          }
        } catch (e) {
          out.simpleBuildTargetsReadError = String(e);
        }
        ["build", "buildProject", "startTask", "applyBuildOptions"].forEach((m) => {
          try {
            out[m + "IsFunction"] = typeof obj[m] === "function";
          } catch (e) {
            out[m + "IsFunction"] = "\u8BFB\u53D6\u51FA\u9519: " + e.message;
          }
        });
        ["build", "buildCommand", "compile"].forEach((m) => {
          try {
            const fn = obj[m];
            if (typeof fn === "function") {
              const src = fn.toString();
              out[m + "Src"] = src.length > 800 ? src.slice(0, 800) + "..." : src;
            }
          } catch (e) {
            out[m + "Src"] = "\u8BFB\u53D6\u5931\u8D25: " + e.message;
          }
        });
        try {
          const map = obj.actualPlatform2Platform;
          if (map) {
            const entries = {};
            Object.keys(map).forEach((k) => {
              try {
                entries[k] = map[k];
              } catch (_e) {
              }
            });
            out.actualPlatform2Platform = entries;
          }
        } catch (e) {
          out.actualPlatform2PlatformError = String(e);
        }
        return out;
      };
      let replied = false;
      const finish = (err, result2) => {
        if (replied) return;
        replied = true;
        try {
          const safeResult = err ? null : JSON.parse(JSON.stringify(result2));
          if (event.reply) event.reply(err, err ? null : safeResult);
        } catch (e) {
          try {
            if (event.reply) event.reply("inspect-builder-targets \u5E8F\u5217\u5316\u5931\u8D25: " + e.message, null);
          } catch (_e) {
          }
        }
      };
      let resultRef = { current: {} };
      const result = {};
      resultRef.current = result;
      const timeoutId = setTimeout(() => {
        finish(null, resultRef.current);
      }, 2e3);
      try {
        result.project = Editor.Project.path;
        result.builderGlobal = summarizeBuilder(Editor.Builder);
      } catch (e) {
        result.builderReadError = String(e);
        clearTimeout(timeoutId);
        return finish(null, result);
      }
      try {
        Editor.Ipc.sendToMain("builder:query-build-options", (err, options) => {
          clearTimeout(timeoutId);
          try {
            if (err) {
              result.queryBuildOptionsError = String(err);
            } else if (options) {
              result.queryBuildOptions = {
                platform: options.platform,
                actualPlatform: options.actualPlatform,
                buildPath: options.buildPath,
                dest: options.dest,
                startScene: options.startScene,
                scenesCount: options.scenes ? options.scenes.length : 0,
                platformsKeyCount: options.platforms ? Array.isArray(options.platforms) ? options.platforms.length : Object.keys(options.platforms).length : void 0
              };
            } else {
              result.queryBuildOptions = null;
            }
          } catch (e) {
            result.queryBuildOptionsError = "\u89E3\u6790\u5931\u8D25: " + e.message;
          }
          finish(null, result);
        });
      } catch (e) {
        clearTimeout(timeoutId);
        result.queryBuildOptionsError = "sendToMain \u5931\u8D25: " + e.message;
        finish(null, result);
      }
    },
    "set-screenshot-settings"(event, args) {
      try {
        let profile = this.getProfile();
        let maxWidth = Number(args.maxWidth);
        let throttle = Number(args.throttle);
        if (isNaN(maxWidth) || maxWidth < 100) maxWidth = 1280;
        if (isNaN(throttle) || throttle < 0) throttle = 1500;
        profile.set("screenshot-max-width", maxWidth);
        profile.set("screenshot-throttle", throttle);
        profile.save();
        Logger.info(`[\u914D\u7F6E\u66F4\u65B0] \u622A\u56FE\u4F18\u5316\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\uFF1A\u6700\u5927\u5BBD\u5EA6 = ${maxWidth}px\uFF0C\u8282\u6D41 = ${throttle}ms`);
        if (event.reply) event.reply(null, "OK");
      } catch (e) {
        Logger.error(`\u4FDD\u5B58\u8BBE\u7F6E\u5931\u8D25: ${e.message}`);
        if (event.reply) event.reply(e.message);
      }
    }
  }
  /**
   * 全局项目文件搜索 (支持正则表达式、文件名、目录名搜索)
   * @param {Object} args 参数
   * @param {Function} callback 完成回调
   */
};
