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

// src/tools/SceneQuery.ts
var import_crypto = require("crypto");

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

// src/tools/SceneQuery.ts
function sceneQuery(args, root, kind) {
  var _a, _b, _c;
  const pageSize = (_a = args.pageSize) != null ? _a : 200;
  const maxVisited = (_b = args.maxVisited) != null ? _b : 1e4;
  const maxTimeMs = (_c = args.maxTimeMs) != null ? _c : 1e3;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) throw new Error("pageSize \u5FC5\u987B\u4E3A 1\u2013500");
  if (!Number.isInteger(maxVisited) || maxVisited < 1 || maxVisited > 5e4) throw new Error("maxVisited \u5FC5\u987B\u4E3A 1\u201350000");
  if (!Number.isInteger(maxTimeMs) || maxTimeMs < 1 || maxTimeMs > 3e3) throw new Error("maxTimeMs \u5FC5\u987B\u4E3A 1\u20133000");
  const hash = (0, import_crypto.createHash)("sha256"), started = Date.now();
  const conditions = JSON.stringify([kind, root.uuid, args.scopeNodeId, args.conditions, args.recursive, args.targetId, args.targetType]);
  hash.update(conditions);
  let visited = 0, incomplete = false, work = 0, resultBytes = 0;
  const results = [];
  return {
    results,
    add(result) {
      const limited = boundedValue(result, 8192, 6);
      if (limited.truncated) {
        incomplete = true;
        return;
      }
      resultBytes += Buffer.byteLength(JSON.stringify(limited.value));
      if (resultBytes > 2 * 1024 * 1024) {
        incomplete = true;
        return;
      }
      results.push(limited.value);
    },
    check(node) {
      var _a2, _b2;
      work++;
      if (node) {
        visited++;
        hash.update(JSON.stringify([node.uuid, node.name, node.active, (_a2 = node.children) == null ? void 0 : _a2.map((n) => n.uuid), (_b2 = node._components) == null ? void 0 : _b2.map((c) => c.uuid)]));
      }
      if (visited > maxVisited || work > maxVisited * 100 || Date.now() - started > maxTimeMs || results.length > 5e3) incomplete = true;
      return !incomplete;
    },
    finish() {
      hash.update(JSON.stringify(results));
      const version = hash.digest("hex");
      let offset = 0;
      if (args.cursor) {
        let cursor;
        try {
          cursor = JSON.parse(args.cursor);
        } catch (_) {
          throw new Error("\u573A\u666F\u6E38\u6807\u65E0\u6548");
        }
        if (cursor.version !== version || cursor.conditions !== conditions || !Number.isInteger(cursor.offset) || cursor.offset < 0) throw new Error("\u573A\u666F\u6216\u67E5\u8BE2\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u67E5\u8BE2");
        offset = cursor.offset;
      }
      if (incomplete) throw new Error(`\u573A\u666F\u626B\u63CF\u9884\u7B97\u8017\u5C3D\uFF08visited=${visited}\uFF09\uFF0C\u8BF7\u4F7F\u7528 scopeNodeId \u7F29\u5C0F\u8303\u56F4\uFF1B\u672A\u8FD4\u56DE\u5B8C\u6574\u7ED3\u679C`);
      if (!args.includeMetadata && args.pageSize === void 0 && !args.cursor) {
        if (results.length > 500) throw new Error("\u7ED3\u679C\u8D85\u8FC7500\u6761\uFF0C\u8BF7\u4F7F\u7528 pageSize \u4E0E scopeNodeId \u5206\u9875\u67E5\u8BE2");
        return results;
      }
      const end = offset + pageSize;
      return {
        results: results.slice(offset, end),
        total: results.length,
        visited,
        nextCursor: end < results.length ? JSON.stringify({ version, conditions, offset: end }) : null,
        truncated: end < results.length
      };
    }
  };
}
function childVersion(scene, node) {
  return (0, import_crypto.createHash)("sha256").update(JSON.stringify([scene.uuid, node.uuid, node.children.map((child) => child.uuid)])).digest("hex");
}

// src/tools/ComponentQuery.ts
function referenceValue(value, cc2, depth = 0, seen = /* @__PURE__ */ new Set(), budget = { remaining: 200 }) {
  var _a, _b;
  if (--budget.remaining < 0) return "[Visit limit]";
  if (typeof value === "string" && value.length > 500) return value.slice(0, 500) + "...[Truncated]";
  if (value === null || typeof value !== "object") return value;
  const type = cc2.js.getClassName(value) || ((_a = value.constructor) == null ? void 0 : _a.name) || "Object";
  if (value instanceof cc2.Asset) return { kind: "asset", uuid: value._uuid || value.uuid || null, type, name: value.name || "" };
  if (value instanceof cc2.Node) return { kind: "node", uuid: value.uuid, type, name: value.name || "" };
  if (value instanceof cc2.Component) return { kind: "component", uuid: value.uuid, type, nodeUuid: ((_b = value.node) == null ? void 0 : _b.uuid) || null };
  if (value instanceof cc2.ValueType) return value.toString();
  if (seen.has(value)) return "[Circular]";
  if (depth >= 4) return "[Depth limit]";
  seen.add(value);
  const result = Array.isArray(value) ? value.slice(0, 20).map((v) => referenceValue(v, cc2, depth + 1, seen, budget)) : Object.fromEntries(Object.keys(value).slice(0, 20).filter((k) => !["__proto__", "constructor", "prototype"].includes(k)).map((k) => [k, referenceValue(value[k], cc2, depth + 1, seen, budget)]));
  seen.delete(value);
  return result;
}
function queryComponents(node, args, cc2) {
  return node._components.filter((c) => (!args.componentId || c.uuid === args.componentId) && (!args.componentType || cc2.js.getClassName(c) === args.componentType)).map((c) => {
    const properties = {};
    const keys = args.fields || (() => {
      const names = [];
      for (const key in c) names.push(key);
      return names;
    })();
    for (const key of keys) {
      if (key.startsWith("_") || key === "constructor" || key === "__proto__" || !(key in c)) continue;
      try {
        const val = c[key];
        if (typeof val === "function" || val === void 0) continue;
        if (val === null || typeof val !== "object") {
          properties[key] = typeof val === "string" && val.length > 200 && !args.includeFullText ? val.substring(0, 50) + `...[Truncated, total length: ${val.length}]` : val;
        } else if (args.referenceMode === "structured") {
          const detail = boundedValue(referenceValue(val, cc2), 4096, 8);
          properties[key] = detail.value;
        } else if (val instanceof cc2.ValueType) {
          properties[key] = val.toString();
        } else if (val instanceof cc2.Asset) {
          properties[key] = `\u8D44\u6E90(${val.name})`;
        } else if (val instanceof cc2.Node) {
          properties[key] = `\u8282\u70B9(${val.name})`;
        } else if (val instanceof cc2.Component) {
          properties[key] = `\u7EC4\u4EF6(${val.name}<${val.__typename}>)`;
        } else if (Array.isArray(val) && val.length > 10) {
          properties[key] = `[Array(${val.length})]`;
        } else {
          try {
            const summary = boundedValue(val, 500, 4);
            properties[key] = summary.truncated ? "[Large JSON Object, bounded summary]" : summary.value;
          } catch (err) {
            properties[key] = `[\u590D\u6742\u5BF9\u8C61: ${val.constructor ? val.constructor.name : typeof val}]`;
          }
        }
      } catch (err) {
        properties[key] = "[Serialization Error]";
      }
    }
    return { type: cc2.js.getClassName(c) || c.constructor.name || "Unknown", uuid: c.uuid, properties };
  });
}
function validateComponentQuery(args) {
  if (args.nodeId && args.nodeIds) throw new Error("nodeId \u4E0E nodeIds \u4E0D\u80FD\u540C\u65F6\u63D0\u4F9B");
  if (args.nodeIds !== void 0 && (!Array.isArray(args.nodeIds) || !args.nodeIds.length || args.nodeIds.length > 100 || args.nodeIds.some((id) => typeof id !== "string" || !id))) throw new Error("nodeIds \u5FC5\u987B\u5305\u542B 1\u2013100 \u4E2A\u8282\u70B9 UUID");
  if (args.fields !== void 0 && (!Array.isArray(args.fields) || args.fields.length > 100 || args.fields.some((key) => typeof key !== "string" || !key))) throw new Error("fields \u5FC5\u987B\u4E3A\u6700\u591A 100 \u4E2A\u5C5E\u6027\u540D");
  if (args.includeFullText !== void 0 && typeof args.includeFullText !== "boolean") throw new Error("includeFullText \u5FC5\u987B\u4E3A boolean");
  if (args.referenceMode !== void 0 && !["summary", "structured"].includes(args.referenceMode)) throw new Error("referenceMode \u5FC5\u987B\u4E3A summary \u6216 structured");
}

// src/core/BuildInfo.ts
var BUILD_INFO = Object.freeze(typeof define_MCP_BRIDGE_BUILD_default === "undefined" ? { version: "unbundled", buildId: "unbundled", builtAt: null } : define_MCP_BRIDGE_BUILD_default);
var loadedAt = (/* @__PURE__ */ new Date()).toISOString();
function getRuntimeInfo(role, entryPath) {
  return { ...BUILD_INFO, role, pid: process.pid, loadedAt, entryPath };
}

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
function mapReferences(value, resolve) {
  if (Array.isArray(value)) return value.map((item) => mapReferences(item, resolve));
  if (value && typeof value === "object") {
    if (Object.prototype.hasOwnProperty.call(value, "$ref")) {
      if (Object.keys(value).length !== 1 || typeof value.$ref !== "string") throw new Error("$ref \u5FC5\u987B\u662F\u5355\u72EC\u7684\u5B57\u7B26\u4E32\u5F15\u7528");
      return resolve(value.$ref);
    }
    const result = {};
    for (const key of Object.keys(value)) {
      if (forbiddenKeys.has(key)) throw new Error(`\u4E0D\u5141\u8BB8\u7684\u53C2\u6570\u5B57\u6BB5: ${key}`);
      result[key] = mapReferences(value[key], resolve);
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

// src/tools/ScriptExecution.ts
var vm = __toESM(require("vm"));
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
function sceneNodes(scene) {
  const nodes = [], stack = [{ node: scene, depth: 0 }];
  while (stack.length) {
    if (nodes.length >= 1e4) throw new Error("\u573A\u666F\u904D\u5386\u8D85\u8FC710000\u8282\u70B9\uFF0C\u8BF7\u4F7F\u7528\u6307\u5B9A UUID \u6216\u7F29\u5C0F\u573A\u666F");
    const item = stack.pop();
    nodes.push(item);
    for (const child of item.node.children || []) stack.push({ node: child, depth: item.depth + 1 });
  }
  return nodes;
}
function resolveSceneNode(args, scene, engine, byId) {
  const id = args.nodeId || args.uuid || args.id;
  if (id) {
    const node = byId(id);
    if (!node || !(node instanceof engine.Node)) throw new Error("\u627E\u4E0D\u5230\u573A\u666F\u8282\u70B9: " + id);
    let root = node;
    while (root.parent) root = root.parent;
    if (root !== scene) throw new Error("\u8282\u70B9\u4E0D\u5C5E\u4E8E\u5F53\u524D\u7F16\u8F91\u573A\u666F");
    return node;
  }
  if (args.path) {
    const parts = args.path.split("/").filter(Boolean);
    if (parts[0] === scene.name) parts.shift();
    let node = scene;
    for (const part of parts) {
      const matches = (node.children || []).filter((child) => child.name === part);
      if (matches.length !== 1) throw new Error("\u8282\u70B9\u8DEF\u5F84\u4E0D\u5B58\u5728\u6216\u5B58\u5728\u91CD\u540D: " + args.path);
      node = matches[0];
    }
    return node;
  }
  if (args.name) {
    const matches = sceneNodes(scene).map((item) => item.node).filter((node) => node.name === args.name);
    if (matches.length !== 1) throw new Error("\u8282\u70B9\u540D\u79F0\u4E0D\u5B58\u5728\u6216\u4E0D\u552F\u4E00\uFF0C\u8BF7\u63D0\u4F9B UUID \u6216\u8DEF\u5F84: " + args.name);
    return matches[0];
  }
  throw new Error("\u9700\u8981 nodeId\u3001uuid\u3001path \u6216 name \u5B9A\u4F4D\u8282\u70B9");
}
async function executeSceneCapability(name, args, engine, byId, loadAsset, notify) {
  var _a, _b, _c, _d, _e, _f;
  const scene = engine.director.getScene();
  if (!scene) throw new Error("\u7F16\u8F91\u573A\u666F\u5C1A\u672A\u5C31\u7EEA");
  const ref = (node2) => {
    var _a2;
    return { uuid: node2.uuid, name: node2.name, parentId: ((_a2 = node2.parent) == null ? void 0 : _a2.uuid) || null };
  };
  if (name === "get_scene_info") return { ...ref(scene), childrenCount: scene.children.length, context: "edit_scene" };
  if (name === "list_cameras" || name === "get_performance_snapshot") {
    const nodes = sceneNodes(scene);
    if (name === "list_cameras") return nodes.flatMap(({ node: node2 }) => (node2.getComponents(engine.Camera) || []).map((camera) => ({ ...ref(node2), componentId: camera.uuid, enabled: camera.enabled, depth: camera.depth })));
    return {
      context: "edit_scene",
      nodes: nodes.length,
      components: nodes.reduce((sum, item) => sum + (item.node._components || []).length, 0),
      depth: Math.max(...nodes.map((item) => item.depth)),
      uiNodes: nodes.filter((item) => item.node.getComponent(engine.Label) || item.node.getComponent(engine.Sprite)).length
    };
  }
  if (["get_runtime_state", "pause_runtime", "resume_runtime", "set_time_scale"].includes(name)) {
    const director = engine.director, scheduler = director.getScheduler();
    if (name === "pause_runtime") director.pause();
    if (name === "resume_runtime") director.resume();
    if (name === "set_time_scale") scheduler.setTimeScale(args.timeScale);
    return { context: "edit_scene", scene: ref(scene), paused: director.isPaused(), timeScale: scheduler.getTimeScale(), gamePreviewVerified: false };
  }
  const node = resolveSceneNode(args, scene, engine, byId);
  if (name === "resolve_node") return ref(node);
  if (name === "inspect_node") return {
    ...ref(node),
    active: node.active,
    position: { x: node.x, y: node.y, z: node.z },
    angle: node.angle,
    scale: { x: node.scaleX, y: node.scaleY },
    size: { width: node.width, height: node.height },
    anchor: { x: node.anchorX, y: node.anchorY },
    children: node.children.slice(0, 1e3).map(ref),
    childrenTruncated: node.children.length > 1e3,
    components: queryComponents(node, { fields: ["enabled"] }, engine)
  };
  if (name === "inspect_prefab_instance") return { ...ref(node), linked: !!((_a = node._prefab) == null ? void 0 : _a.asset), assetUuid: ((_c = (_b = node._prefab) == null ? void 0 : _b.asset) == null ? void 0 : _c._uuid) || null, rootId: ((_e = (_d = node._prefab) == null ? void 0 : _d.root) == null ? void 0 : _e.uuid) || null, fileId: ((_f = node._prefab) == null ? void 0 : _f.fileId) || null };
  if (name === "delete_node") {
    if (node === scene) throw new Error("\u4E0D\u80FD\u5220\u9664\u573A\u666F\u6839\u8282\u70B9");
    const result = ref(node);
    node.destroy();
    notify(node.uuid);
    return { ...result, destroyRequested: true };
  }
  if (name === "emit_node_event") {
    node.emit(args.eventName, args.payload);
    return { ...ref(node), eventName: args.eventName, emitted: true, businessOutcomeVerified: false };
  }
  if (name === "simulate_button_click") {
    const button = node.getComponent(engine.Button);
    if (!button || button.enabled === false || button.interactable === false || !node.activeInHierarchy) throw new Error("\u76EE\u6807\u6CA1\u6709\u53EF\u4EA4\u4E92\u7684 cc.Button");
    engine.Component.EventHandler.emitEvents(button.clickEvents, button);
    node.emit("click", button);
    return { ...ref(node), emitted: true, nativeInputVerified: false, businessOutcomeVerified: false };
  }
  if (name === "invoke_component_method") {
    const component = node.getComponent(args.componentName || args.componentType);
    if (!component || ["constructor", "__proto__", "prototype"].includes(args.methodName) || typeof component[args.methodName] !== "function") throw new Error("\u7EC4\u4EF6\u6216\u76EE\u6807\u65B9\u6CD5\u4E0D\u5B58\u5728");
    try {
      const value = await component[args.methodName](...args.args || []);
      const safe = boundedValue(value === void 0 ? null : value, 1024 * 1024, 12);
      return { ...ref(node), data: safe.value, truncated: safe.truncated, businessOutcomeVerified: false };
    } finally {
      notify(node.uuid);
    }
  }
  if (name === "add_animation_clip") {
    const animation = node.getComponent(engine.Animation);
    if (!animation) throw new Error("\u8282\u70B9\u6CA1\u6709 cc.Animation \u7EC4\u4EF6");
    const clip = await loadAsset(args.clipUuid);
    if (!(clip instanceof engine.AnimationClip)) throw new Error("\u8D44\u6E90\u4E0D\u662F cc.AnimationClip");
    if (engine.director.getScene() !== scene || engine.isValid && !engine.isValid(node)) throw new Error("\u8D44\u6E90\u52A0\u8F7D\u671F\u95F4\u573A\u666F\u5DF2\u53D8\u5316");
    animation.addClip(clip, args.clipName || clip.name);
    notify(node.uuid);
    return { ...ref(node), clipUuid: args.clipUuid, clipName: args.clipName || clip.name };
  }
  throw new Error("\u672A\u77E5\u573A\u666F\u80FD\u529B: " + name);
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

// src/tools/ButtonEvents.ts
function buttonEvents(args, findNode2, engine) {
  const node = findNode2(args.nodeId);
  if (!node) throw new Error("\u6309\u94AE\u8282\u70B9\u4E0D\u5B58\u5728");
  const button = node.getComponent(engine.Button);
  if (!button) throw new Error("\u8282\u70B9\u6CA1\u6709 cc.Button");
  const describe = (event2) => {
    const target2 = event2.target, component2 = target2 && target2.getComponent(event2.component);
    return {
      targetUuid: (target2 == null ? void 0 : target2.uuid) || null,
      componentName: event2.component,
      handler: event2.handler,
      customEventData: event2.customEventData || "",
      valid: !!component2 && typeof component2[event2.handler] === "function"
    };
  };
  const events = Array.isArray(button.clickEvents) ? button.clickEvents : [];
  if (args.action === "list") return { nodeId: node.uuid, events: events.slice(0, 200).map(describe), total: events.length, truncated: events.length > 200 };
  if (args.action !== "bind") throw new Error("action \u9700\u8981 list \u6216 bind");
  const target = findNode2(args.targetId), componentName = args.componentName, handler = args.handler;
  if (!target || !componentName || !handler || ["__proto__", "constructor", "prototype"].includes(handler)) throw new Error("\u9700\u8981\u6709\u6548\u7684\u76EE\u6807\u8282\u70B9\u3001\u7EC4\u4EF6\u548C\u56DE\u8C03\u65B9\u6CD5");
  const component = target.getComponent(componentName);
  if (!component || typeof component[handler] !== "function") throw new Error(`\u76EE\u6807\u7EC4\u4EF6\u6216\u56DE\u8C03\u4E0D\u5B58\u5728: ${componentName}.${handler}`);
  if (events.length >= 200) throw new Error("\u6309\u94AE\u5DF2\u6709200\u4E2A\u4E8B\u4EF6\uFF0C\u8BF7\u5148\u6574\u7406\u7ED1\u5B9A");
  const customEventData = args.customEventData || "";
  const same = (event2) => event2.target === target && event2.component === componentName && event2.handler === handler && (event2.customEventData || "") === customEventData;
  const duplicate = events.find(same);
  if (duplicate && !args.replace) return { bound: false, duplicate: true, event: describe(duplicate) };
  const event = new engine.Component.EventHandler();
  event.target = target;
  event.component = componentName;
  event.handler = handler;
  event.customEventData = customEventData;
  button.clickEvents = (args.replace ? events.filter((item) => !same(item)) : events).concat(event);
  return { bound: true, event: describe(event), eventCount: button.clickEvents.length, runtimeClickVerified: false };
}

// src/tools/UndoGroups.ts
var UndoGroups = class {
  constructor() {
    this.group = null;
  }
  execute(action, args, scene, findNode2, undo) {
    const stack = undo._undo;
    if (!stack || typeof stack._position !== "number") throw new Error("\u5F53\u524D\u573A\u666F\u672A\u63D0\u4F9B Creator 2.4 \u64A4\u9500\u6808");
    if (action === "begin_group") {
      if (this.group) throw new Error("\u5DF2\u6709\u6D3B\u52A8\u64A4\u9500\u7EC4\uFF0C\u8BF7\u5148\u7ED3\u675F\u6216\u53D6\u6D88");
      if (args.id && !findNode2(args.id)) throw new Error("\u64A4\u9500\u7EC4\u76EE\u6807\u8282\u70B9\u4E0D\u5B58\u5728");
      this.group = { scene, position: stack._position, description: args.description || "MCP \u64CD\u4F5C" };
      if (args.id) undo.recordNode(args.id, this.group.description);
      return { begun: true, position: stack._position };
    }
    if (!this.group) throw new Error("\u6CA1\u6709\u6D3B\u52A8\u64A4\u9500\u7EC4");
    const group = this.group;
    if (scene !== group.scene) {
      this.group = null;
      throw new Error("\u573A\u666F\u5DF2\u53D8\u5316\uFF0C\u62D2\u7EDD\u64CD\u4F5C\u5176\u4ED6\u573A\u666F\u7684\u64A4\u9500\u6808");
    }
    undo.commit();
    if (action === "end_group") {
      const first = group.position + 1;
      if (stack._position > first) stack.collapseTo(first);
      this.group = null;
      return { committed: true, position: stack._position };
    }
    if (action !== "cancel_group") throw new Error("\u672A\u77E5\u64A4\u9500\u7EC4\u64CD\u4F5C");
    let reverted = 0;
    while (stack._position > group.position) {
      undo.undo();
      reverted++;
    }
    undo.cancel();
    if (reverted) stack._clearRedo();
    this.group = null;
    return { cancelled: true, reverted, position: stack._position };
  }
};

// src/scene-script.ts
var undoGroups = new UndoGroups();
var activeSceneBatch = null;
function notifySceneChanged(event, uuid) {
  const notifications = event.mcpBatchNotifications;
  if (notifications == null ? void 0 : notifications.active) {
    notifications.dirty = true;
    if (uuid) notifications.changed.add(uuid);
  } else {
    Editor.Ipc.sendToMain("scene:dirty");
    if (uuid) Editor.Ipc.sendToAll("scene:node-changed", { uuid });
  }
}
var findNode = (id) => {
  if (!id) return null;
  let node = cc.engine.getInstanceById(id);
  if (!node && typeof Editor !== "undefined" && Editor.Utils && Editor.Utils.UuidUtils) {
    try {
      const decompressed = Editor.Utils.UuidUtils.decompressUuid(id);
      if (decompressed !== id) {
        node = cc.engine.getInstanceById(decompressed);
      }
    } catch (e) {
    }
  }
  return node;
};
function loadSceneAsset(uuid) {
  return new Promise((resolve, reject) => {
    let settled = false;
    cc.assetManager.loadAny(uuid, (err, asset) => {
      if (settled) return;
      settled = true;
      if (err || !asset) reject(new Error(String(err && (err.message || err) || "\u8D44\u6E90\u8FD4\u56DE\u7A7A\u503C")));
      else resolve(asset);
    });
  });
}
var sceneTools = {
  "manage-undo-group": function(event, args) {
    try {
      const result = undoGroups.execute(args.action, args, cc.director.getScene(), findNode, Editor.require("scene://undo"));
      if (result.cancelled) notifySceneChanged(event);
      event.reply(null, result);
    } catch (error) {
      event.reply(new Error(error.message || error));
    }
  },
  "execute-javascript": async function(event, args) {
    try {
      const execution = startJavascript(args, {
        context: "scene",
        cc,
        Editor,
        require,
        scene: cc.director.getScene(),
        director: cc.director,
        markSceneDirty: (uuid) => notifySceneChanged(event, uuid)
      });
      const packet = await execution.completion;
      event.reply(null, packet);
    } catch (err) {
      event.reply(new Error(err.message || err));
    }
  },
  "execute-capability": async function(event, request) {
    try {
      event.reply(null, await executeSceneCapability(request.tool, request.args, cc, findNode, loadSceneAsset, (uuid) => notifySceneChanged(event, uuid)));
    } catch (err) {
      event.reply(new Error(err.message || err));
    }
  },
  "execute-scene-batch": function(event, args) {
    if (activeSceneBatch) return event.reply(new Error("\u573A\u666F\u6279\u5904\u7406\u6B63\u5728\u6267\u884C"));
    if (!Array.isArray(args.operations) || args.operations.some((op) => !Object.prototype.hasOwnProperty.call(SCENE_BATCH_METHODS, op == null ? void 0 : op.tool))) return event.reply(new Error("\u8BE5\u5DE5\u5177\u4E0D\u652F\u6301\u573A\u666F\u6279\u5904\u7406"));
    const notifications = { active: true, dirty: false, changed: /* @__PURE__ */ new Set() };
    activeSceneBatch = notifications;
    const scene = cc.director.getScene();
    const deadlineAt = Math.min(args.deadlineAt || Infinity, Date.now() + 14e3);
    const flush = () => {
      notifications.active = false;
      if (notifications.dirty) Editor.Ipc.sendToMain("scene:dirty");
      for (const uuid of notifications.changed) Editor.Ipc.sendToAll("scene:node-changed", { uuid });
      notifications.dirty = false;
      notifications.changed.clear();
    };
    const watchdog = setTimeout(flush, Math.max(0, deadlineAt - Date.now()));
    const finish = (err, result) => {
      clearTimeout(watchdog);
      if (activeSceneBatch === notifications) activeSceneBatch = null;
      try {
        flush();
      } finally {
        event.reply(err, result);
      }
    };
    executeBatch(args, args.allowedTools || getToolsList(), (tool, params, done) => {
      if (cc.director.getScene() !== scene) return done("\u573A\u666F\u5DF2\u53D8\u5316\uFF0C\u672A\u6267\u884C\u8BE5\u6B65\u9AA4");
      const method = Object.prototype.hasOwnProperty.call(SCENE_BATCH_METHODS, tool) && SCENE_BATCH_METHODS[tool];
      if (!method) return done("\u8BE5\u5DE5\u5177\u4E0D\u652F\u6301\u573A\u666F\u6279\u5904\u7406");
      if (tool === "create_node") params = { ...params, defaultSpriteUuid: args.defaultSpriteUuid };
      const pending = sceneTools[method]({ reply: done, mcpBatchNotifications: notifications }, params);
      if (pending == null ? void 0 : pending.catch) pending.catch(done);
    }, finish, { deadlineAt });
  },
  "get-prefab-update-state": function(event, args) {
    try {
      const node = findNode(args.nodeId);
      if (!node) throw new Error(`\u627E\u4E0D\u5230\u8282\u70B9: ${args.nodeId}`);
      const root = node._prefab && node._prefab.root;
      const asset = root && root._prefab && root._prefab.asset;
      const scene = cc.director.getScene();
      const activeRoot = scene && scene.children.find((child) => child._prefab && child._prefab.asset);
      const mode = Editor.require("scene://edit-mode").curMode();
      event.reply(null, {
        rootId: root && root.uuid,
        assetUuid: asset && asset._uuid,
        mode: mode && mode.name,
        activePrefabUuid: activeRoot && activeRoot._prefab.asset._uuid
      });
    } catch (err) {
      event.reply(new Error(err.message || err));
    }
  },
  "button-events": function(event, args) {
    try {
      const result = buttonEvents(args, findNode, cc);
      if (result.bound) notifySceneChanged(event, args.nodeId);
      event.reply(null, result);
    } catch (err) {
      event.reply(new Error(err.message || err));
    }
  },
  "get-mcp-runtime-info": function(event) {
    event.reply(null, getRuntimeInfo("scene", __filename));
  },
  "get-node-name": function(event, args) {
    const node = findNode(args.id);
    if (!node) return event.reply(new Error(`\u627E\u4E0D\u5230\u8282\u70B9: ${args.id}`));
    event.reply(null, { uuid: node.uuid, name: node.name });
  },
  "get-edit-state": function(event) {
    try {
      const editMode = Editor.require("scene://edit-mode");
      const mode = editMode.curMode();
      const scene = cc.director.getScene();
      const root = scene && scene.children.find((node) => node._prefab && node._prefab.asset);
      event.reply(null, {
        mode: mode && mode.name,
        sceneUuid: scene && scene.uuid,
        prefabUuid: root && root._prefab.asset._uuid,
        url: mode && mode.title
      });
    } catch (e) {
      event.reply(new Error("\u8BFB\u53D6\u7F16\u8F91\u6A21\u5F0F\u5931\u8D25: " + e.message));
    }
  },
  /**
   * 修改节点的基础属性
   * @param {Object} event IPC 事件对象
   * @param {Object} args 参数 (id, path, value)
   */
  "set-property": function(event, args) {
    const { id, path, value } = args;
    let node = findNode(id);
    if (node) {
      if (path === "name") {
        node.name = value;
      } else {
        node[path] = value;
      }
      Editor.Ipc.sendToMain("scene:dirty");
      Editor.Ipc.sendToAll("scene:node-changed", {
        uuid: id
      });
      if (event.reply) {
        event.reply(null, `\u8282\u70B9 ${id} \u5DF2\u66F4\u65B0\u4E3A ${value}`);
      }
    } else {
      if (event.reply) {
        event.reply(new Error("\u573A\u666F\u811A\u672C\uFF1A\u627E\u4E0D\u5230\u8282\u70B9 " + id));
      }
    }
  },
  /**
   * 获取当前场景的完整层级树
   * @param {Object} event IPC 事件对象
   * @param {Object} args 参数 (nodeId, depth, includeDetails)
   */
  "get-hierarchy": function(event, args) {
    const { nodeId = null, depth = 2, includeDetails = false } = args || {};
    const scene = cc.director.getScene();
    let rootNode = scene;
    if (nodeId) {
      rootNode = findNode(nodeId);
      if (!rootNode) {
        if (event.reply) event.reply(new Error(`\u627E\u4E0D\u5230\u6307\u5B9A\u7684\u8D77\u59CB\u8282\u70B9: ${nodeId}`));
        return;
      }
    }
    let visited = 0, hierarchyBytes = 0;
    function dumpNodes(node, currentDepth) {
      var _a;
      if (++visited > 2e3 || (hierarchyBytes += (((_a = node == null ? void 0 : node.name) == null ? void 0 : _a.length) || 0) * 3 + 512) > 2 * 1024 * 1024) throw new Error("\u5C42\u7EA7\u9884\u7B97\u8017\u5C3D\uFF0C\u8BF7\u7F29\u5C0F\u6839\u8282\u70B9\u6216\u6DF1\u5EA6");
      if (!node || !node.name || typeof node.name === "string" && (node.name.startsWith("Editor Scene") || node.name === "gizmoRoot")) {
        return null;
      }
      let nodeData = {
        name: node.name,
        uuid: node.uuid,
        childrenCount: node.childrenCount
      };
      const comps = node._components || [];
      if (includeDetails) {
        nodeData.active = node.active;
        nodeData.position = { x: Math.round(node.x), y: Math.round(node.y) };
        nodeData.rotation = node.angle;
        nodeData.scale = { x: node.scaleX, y: node.scaleY };
        nodeData.anchor = { x: node.anchorX, y: node.anchorY };
        nodeData.size = { width: node.width, height: node.height };
        nodeData.color = { r: node.color.r, g: node.color.g, b: node.color.b };
        nodeData.opacity = node.opacity;
        nodeData.skew = { x: node.skewX, y: node.skewY };
        nodeData.group = node.group;
        nodeData.components = comps.map((c) => cc.js.getClassName(c));
      } else {
        if (comps.length > 0) {
          nodeData.components = comps.map((c) => {
            const parts = (cc.js.getClassName(c) || "").split(".");
            return parts[parts.length - 1];
          });
        }
      }
      const MAX_CHILDREN_PER_LEVEL = Math.min(100, Math.max(1, args.childPageSize || 50));
      const offset = currentDepth === 0 ? args.childOffset || 0 : 0;
      const version = childVersion(cc.director.getScene(), node);
      if (currentDepth === 0 && args.childVersion && args.childVersion !== version) throw new Error("\u5B50\u8282\u70B9\u96C6\u5408\u6216\u573A\u666F\u5DF2\u53D8\u5316\uFF0C\u8BF7\u91CD\u65B0\u8BFB\u53D6");
      if (currentDepth < depth && node.childrenCount > 0) {
        nodeData.children = [];
        const childLimit = Math.min(node.childrenCount, offset + MAX_CHILDREN_PER_LEVEL);
        for (let i = offset; i < childLimit; i++) {
          let childData = dumpNodes(node.children[i], currentDepth + 1);
          if (childData) nodeData.children.push(childData);
        }
        if (node.childrenCount > childLimit) {
          nodeData.nextChildrenQuery = { nodeId: node.uuid, childOffset: childLimit, childVersion: version, depth: depth - currentDepth };
          nodeData.childrenTruncated = node.childrenCount - childLimit;
        }
      }
      return nodeData;
    }
    try {
      const hierarchy = dumpNodes(rootNode, 0);
      if (event.reply) event.reply(null, hierarchy);
    } catch (err) {
      event.reply(err);
    }
  },
  /**
   * 批量更新节点的变换信息 (坐标、缩放、颜色等)
   * @param {Object} event IPC 事件对象
   * @param {Object} args 参数 (id, x, y, rotation, scaleX, scaleY, anchorX, anchorY, color, opacity, skewX, skewY, width, height)
   */
  "update-node-transform": function(event, args) {
    const { id, x, y, scaleX, scaleY, color } = args;
    let node = findNode(id);
    if (node) {
      if (x !== void 0) {
        node.x = Number(x);
      }
      if (y !== void 0) {
        node.y = Number(y);
      }
      if (args.rotation !== void 0) {
        node.angle = Number(args.rotation);
      }
      if (args.width !== void 0) {
        node.width = Number(args.width);
      }
      if (args.height !== void 0) {
        node.height = Number(args.height);
      }
      if (scaleX !== void 0) {
        node.scaleX = Number(scaleX);
      }
      if (scaleY !== void 0) {
        node.scaleY = Number(scaleY);
      }
      if (args.anchorX !== void 0) {
        node.anchorX = Number(args.anchorX);
      }
      if (args.anchorY !== void 0) {
        node.anchorY = Number(args.anchorY);
      }
      if (color) {
        node.color = new cc.Color().fromHEX(color);
      }
      if (args.opacity !== void 0) {
        node.opacity = Number(args.opacity);
      }
      if (args.skewX !== void 0) {
        node.skewX = Number(args.skewX);
      }
      if (args.skewY !== void 0) {
        node.skewY = Number(args.skewY);
      }
      if (args.active !== void 0) {
        node.active = !!args.active;
      }
      notifySceneChanged(event, id);
      if (event.reply) event.reply(null, "\u53D8\u6362\u4FE1\u606F\u5DF2\u66F4\u65B0");
    } else {
      if (event.reply) event.reply(new Error("\u627E\u4E0D\u5230\u8282\u70B9"));
    }
  },
  /**
   * 在场景中创建新节点
   * @param {Object} event IPC 事件对象
   * @param {Object} args 参数 (name, parentId, type)
   */
  "create-node": async function(event, args) {
    let newNode = null;
    try {
      const { name, parentId, type } = args;
      const scene = cc.director.getScene();
      if (!scene) {
        if (event.reply) event.reply(new Error("\u573A\u666F\u5C1A\u672A\u51C6\u5907\u597D\u6216\u6B63\u5728\u52A0\u8F7D\u3002"));
        return;
      }
      if (parentId && !findNode(parentId)) throw new Error(`\u627E\u4E0D\u5230\u7236\u8282\u70B9: ${parentId}`);
      if (type === "canvas" || name === "Canvas" && !["sprite", "label", "button", "camera"].includes(type)) {
        newNode = new cc.Node(name || "Canvas");
        let canvas = newNode.addComponent(cc.Canvas);
        newNode.addComponent(cc.Widget);
        canvas.designResolution = cc.size(960, 640);
        canvas.fitHeight = true;
        let camNode = new cc.Node("Main Camera");
        camNode.addComponent(cc.Camera);
        camNode.parent = newNode;
      } else if (type === "camera") {
        newNode = new cc.Node(name || "Camera");
        newNode.addComponent(cc.Camera);
      } else if (type === "sprite") {
        newNode = new cc.Node(name || "\u65B0\u5EFA\u7CBE\u7075\u8282\u70B9");
        let sprite = newNode.addComponent(cc.Sprite);
        sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        newNode.width = 100;
        newNode.height = 100;
        if (args.defaultSpriteUuid) {
          const asset = await loadSceneAsset(args.defaultSpriteUuid);
          if (!(asset instanceof cc.SpriteFrame || asset instanceof cc.Texture2D)) throw new Error("\u9ED8\u8BA4\u8D34\u56FE\u7C7B\u578B\u4E0D\u5339\u914D");
          sprite.spriteFrame = asset instanceof cc.SpriteFrame ? asset : new cc.SpriteFrame(asset);
        }
      } else if (type === "button") {
        newNode = new cc.Node(name || "\u65B0\u5EFA\u6309\u94AE\u8282\u70B9");
        let sprite = newNode.addComponent(cc.Sprite);
        newNode.addComponent(cc.Button);
        sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
        newNode.width = 150;
        newNode.height = 50;
        newNode.color = new cc.Color(160, 160, 160);
        const labelNode = new cc.Node("Label");
        labelNode.addComponent(cc.Label).string = args.text === void 0 ? "Button" : args.text;
        labelNode.parent = newNode;
        if (args.defaultSpriteUuid) {
          const asset = await loadSceneAsset(args.defaultSpriteUuid);
          if (!(asset instanceof cc.SpriteFrame || asset instanceof cc.Texture2D)) throw new Error("\u9ED8\u8BA4\u8D34\u56FE\u7C7B\u578B\u4E0D\u5339\u914D");
          sprite.spriteFrame = asset instanceof cc.SpriteFrame ? asset : new cc.SpriteFrame(asset);
        }
      } else if (type === "label") {
        newNode = new cc.Node(name || "\u65B0\u5EFA\u6587\u672C\u8282\u70B9");
        let l = newNode.addComponent(cc.Label);
        l.string = args.text === void 0 ? "\u65B0\u6587\u672C" : args.text;
        if (args.fontSize !== void 0) l.fontSize = args.fontSize;
        newNode.width = 120;
        newNode.height = 40;
      } else {
        newNode = new cc.Node(name || "\u65B0\u5EFA\u8282\u70B9");
      }
      if (args.width !== void 0) newNode.width = args.width;
      if (args.height !== void 0) newNode.height = args.height;
      if (cc.director.getScene() !== scene) throw new Error("\u8D44\u6E90\u52A0\u8F7D\u671F\u95F4\u573A\u666F\u5DF2\u53D8\u5316\uFF0C\u672A\u6302\u8F7D\u65B0\u8282\u70B9");
      let parent = null;
      if (parentId) {
        parent = findNode(parentId);
      } else {
        if (type === "sprite" || type === "button" || type === "label") {
          const canvasComp = scene.getComponentInChildren(cc.Canvas);
          if (canvasComp) {
            parent = canvasComp.node;
          }
        }
        if (!parent) parent = scene;
      }
      if (parent && (!cc.isValid || cc.isValid(parent))) {
        newNode.parent = parent;
        if (args.layout) {
          let widget = newNode.addComponent(cc.Widget);
          widget.alignMode = cc.Widget.AlignMode.ONCE;
          switch (args.layout) {
            case "center":
              widget.isAlignHorizontalCenter = true;
              widget.isAlignVerticalCenter = true;
              widget.horizontalCenter = 0;
              widget.verticalCenter = 0;
              break;
            case "full":
              widget.isAlignTop = true;
              widget.isAlignBottom = true;
              widget.isAlignLeft = true;
              widget.isAlignRight = true;
              widget.top = 0;
              widget.bottom = 0;
              widget.left = 0;
              widget.right = 0;
              break;
            case "top":
              widget.isAlignTop = true;
              widget.isAlignHorizontalCenter = true;
              widget.top = 0;
              widget.horizontalCenter = 0;
              break;
            case "bottom":
              widget.isAlignBottom = true;
              widget.isAlignHorizontalCenter = true;
              widget.bottom = 0;
              widget.horizontalCenter = 0;
              break;
            case "left":
              widget.isAlignLeft = true;
              widget.isAlignVerticalCenter = true;
              widget.left = 0;
              widget.verticalCenter = 0;
              break;
            case "right":
              widget.isAlignRight = true;
              widget.isAlignVerticalCenter = true;
              widget.right = 0;
              widget.verticalCenter = 0;
              break;
            case "top-left":
              widget.isAlignTop = true;
              widget.isAlignLeft = true;
              widget.top = 0;
              widget.left = 0;
              break;
            case "top-right":
              widget.isAlignTop = true;
              widget.isAlignRight = true;
              widget.top = 0;
              widget.right = 0;
              break;
            case "bottom-left":
              widget.isAlignBottom = true;
              widget.isAlignLeft = true;
              widget.bottom = 0;
              widget.left = 0;
              break;
            case "bottom-right":
              widget.isAlignBottom = true;
              widget.isAlignRight = true;
              widget.bottom = 0;
              widget.right = 0;
              break;
          }
        }
        notifySceneChanged(event);
        setTimeout(() => {
          Editor.Ipc.sendToAll("scene:node-created", {
            uuid: newNode.uuid,
            parentUuid: parent.uuid
          });
        }, 10);
        if (event.reply) {
          let canvasInfo = "";
          let canvasComp = parent.getComponent(cc.Canvas);
          if (canvasComp) {
            canvasInfo = `CanvasSize(${parent.width}x${parent.height}) Design(${canvasComp.designResolution.width}x${canvasComp.designResolution.height})`;
          }
          const message = `\u8282\u70B9\u521B\u5EFA\u6210\u529F UUID: ${newNode.uuid}, \u5DF2\u6302\u8F7D\u81F3 ${parent.name}${canvasInfo ? " " + canvasInfo : ""}. ComputedPos: (${newNode.x}, ${newNode.y})`;
          event.reply(null, args.returnDetails ? { uuid: newNode.uuid, name: newNode.name, parentId: parent.uuid, message } : message);
        }
      } else {
        if (event.reply) event.reply(new Error(`\u65E0\u6CD5\u521B\u5EFA\u8282\u70B9\uFF1A\u627E\u4E0D\u5230\u7236\u8282\u70B9 ${parentId}`));
      }
    } catch (err) {
      if (newNode && typeof newNode.destroy === "function") newNode.destroy();
      if (event.reply) event.reply(new Error("\u521B\u5EFA\u8282\u70B9\u5931\u8D25: " + (err.message || err)));
    }
  },
  /**
   * 管理节点上的组件 (添加、移除、更新属性)
   * @param {Object} event IPC 事件对象
   * @param {Object} args 参数 (nodeId, action, componentType, componentId, properties)
   */
  "manage-components": async function(event, args) {
    let { nodeId, action, operation, componentType, componentId, properties } = args;
    action = action || operation;
    if (action === "get") {
      try {
        validateComponentQuery(args);
        if (args.nodeIds) {
          const results = args.nodeIds.map((id) => {
            const target = findNode(id);
            return target ? { nodeId: id, components: queryComponents(target, args, cc) } : { nodeId: id, error: "\u627E\u4E0D\u5230\u8282\u70B9", components: [] };
          });
          if (event.reply) event.reply(null, results);
        } else {
          const target = findNode(nodeId);
          if (!target) throw new Error("\u627E\u4E0D\u5230\u8282\u70B9");
          if (event.reply) event.reply(null, queryComponents(target, args, cc));
        }
      } catch (err) {
        if (event.reply) event.reply(new Error(`\u83B7\u53D6\u7EC4\u4EF6\u5931\u8D25: ${err.message}`));
      }
      return;
    }
    if (args.nodeIds !== void 0) {
      if (event.reply) event.reply(new Error("nodeIds \u4EC5\u9002\u7528\u4E8E get\uFF0C\u5199\u64CD\u4F5C\u5FC5\u987B\u63D0\u4F9B\u5355\u4E2A nodeId"));
      return;
    }
    let node = findNode(nodeId);
    const loadAssetValue = (uuid, key, propertyType) => new Promise((resolve, reject) => {
      if (uuid === null) return resolve(null);
      if (typeof uuid !== "string" || !Editor.Utils.UuidUtils.isUuid(uuid)) {
        return reject(new Error(`${key} \u7684\u8D44\u6E90\u5F15\u7528\u5FC5\u987B\u4E3A\u6709\u6548 UUID \u6216 null`));
      }
      const needsSpriteFrame = propertyType === cc.SpriteFrame || key.toLowerCase().includes("sprite");
      let targetUuid = uuid;
      if (needsSpriteFrame && Editor.assetdb && Editor.assetdb.remote) {
        try {
          const fs = require("fs");
          const fspath = Editor.assetdb.remote.uuidToFspath(uuid);
          if (fspath && fs.existsSync(fspath + ".meta")) {
            const meta = JSON.parse(fs.readFileSync(fspath + ".meta", "utf-8"));
            for (const subKey of Object.keys(meta.subMetas || {})) {
              const subMeta = meta.subMetas[subKey];
              if (subMeta && subMeta.uuid) {
                targetUuid = subMeta.uuid;
                Editor.log(`[scene-script] \u81EA\u52A8\u8F6C\u6362 UUID: ${uuid} (Texture2D) -> ${targetUuid} (SpriteFrame)`);
                break;
              }
            }
          }
        } catch (err) {
          Editor.log(`[scene-script] \u8BFB\u53D6 meta \u5931\u8D25: ${err.message}`);
        }
      }
      cc.AssetLibrary.loadAsset(targetUuid, (err, asset) => {
        if (err || !asset) return reject(new Error(`\u52A0\u8F7D ${key} \u7684\u8D44\u6E90 ${targetUuid} \u5931\u8D25: ${err && (err.message || err) || "\u8FD4\u56DE\u7A7A\u8D44\u6E90"}`));
        if (needsSpriteFrame && asset instanceof cc.Texture2D) {
          return reject(new Error(`${key} \u9700\u8981 SpriteFrame\uFF0C\u8D44\u6E90 ${targetUuid} \u4ECD\u662F Texture2D`));
        }
        resolve(asset);
      });
    });
    const applyProperties = async (component, props) => {
      var _a;
      if (!props) return;
      const compClass = component.constructor;
      const before = new Map(Object.keys(props).map((key) => [key, component[key]]));
      try {
        for (const key of Object.keys(props)) {
          if (["node", "uuid", "_id", "__proto__", "constructor", "prototype"].includes(key)) throw new Error("\u4E0D\u5141\u8BB8\u4FEE\u6539\u6838\u5FC3\u5B57\u6BB5: " + key);
          if (!(key in component)) throw new Error("\u7EC4\u4EF6\u4E0D\u5B58\u5728\u5C5E\u6027: " + key);
          const attrs = cc.Class.Attr.getClassAttrs && cc.Class.Attr.getClassAttrs(compClass) || {};
          const type = ((_a = attrs[key]) == null ? void 0 : _a.type) || attrs[key + "$_$ctor"];
          const value = props[key];
          if (value !== null && type && (type === cc.Node || type === cc.Component || type.prototype instanceof cc.Component)) {
            const target = value instanceof cc.Node ? value : findNode(value);
            if (!target || type !== cc.Node && !target.getComponent(type)) throw new Error("\u65E0\u6CD5\u89E3\u6790\u8282\u70B9/\u7EC4\u4EF6\u5F15\u7528: " + key);
          }
        }
        for (const [key, value] of Object.entries(props)) {
          const isEventProp = Array.isArray(value) && (key.toLowerCase().endsWith("events") || key === "clickEvents");
          if (isEventProp) {
            const eventHandlers = [];
            for (const item of value) {
              if (typeof item === "object" && (item.target || item.component || item.handler)) {
                const handler = new cc.Component.EventHandler();
                if (item.target) {
                  let targetNode = findNode(item.target);
                  if (!targetNode && item.target instanceof cc.Node) {
                    targetNode = item.target;
                  }
                  if (!targetNode) throw new Error("\u4E8B\u4EF6 target \u8282\u70B9\u4E0D\u5B58\u5728: " + item.target);
                  handler.target = targetNode;
                }
                if (item.component) handler.component = item.component;
                if (item.handler) handler.handler = item.handler;
                if (item.customEventData !== void 0)
                  handler.customEventData = String(item.customEventData);
                eventHandlers.push(handler);
              } else {
                eventHandlers.push(item);
              }
            }
            component[key] = eventHandlers;
            continue;
          }
          {
            let finalValue = value;
            try {
              const attrs = cc.Class.Attr.getClassAttrs && cc.Class.Attr.getClassAttrs(compClass) || {};
              let propertyType = attrs[key] ? attrs[key].type : null;
              if (!propertyType && attrs[key + "$_$ctor"]) {
                propertyType = attrs[key + "$_$ctor"];
              }
              if (typeof value === "string" && (typeof component[key] === "string" || propertyType === String || propertyType === cc.String || propertyType === "String" || attrs[key + "$_$type"] === "String")) {
                component[key] = value;
                continue;
              }
              const isReferenceId = typeof value === "string" && Editor.Utils.UuidUtils.isUuid(value);
              let isAsset = propertyType && (propertyType.prototype instanceof cc.Asset || propertyType === cc.Asset || propertyType === cc.Prefab || propertyType === cc.SpriteFrame);
              let isAssetArray = Array.isArray(value) && (isAsset || key === "materials" || key.toLowerCase().includes("assets"));
              if (!isAsset && !isAssetArray && isReferenceId) {
                const lowerKey = key.toLowerCase();
                const assetKeywords = [
                  "prefab",
                  "sprite",
                  "texture",
                  "material",
                  "skeleton",
                  "spine",
                  "atlas",
                  "font",
                  "audio",
                  "data"
                ];
                if (assetKeywords.some((k) => lowerKey.includes(k))) {
                  if (!findNode(value)) {
                    isAsset = true;
                  }
                }
              }
              if (isAsset || isAssetArray) {
                if (isAssetArray) {
                  component[key] = await Promise.all(value.map((uuid) => loadAssetValue(uuid, key, propertyType)));
                } else {
                  component[key] = await loadAssetValue(value, key, propertyType);
                }
                continue;
              } else if (propertyType && (propertyType.prototype instanceof cc.Component || propertyType === cc.Component || propertyType === cc.Node)) {
                if (value === null) {
                  component[key] = null;
                  continue;
                }
                const targetNode = findNode(value);
                if (targetNode) {
                  if (propertyType === cc.Node) {
                    finalValue = targetNode;
                  } else {
                    const targetComp = targetNode.getComponent(propertyType);
                    if (targetComp) {
                      finalValue = targetComp;
                    } else {
                      throw new Error(`\u5728\u8282\u70B9 ${targetNode.name} \u4E0A\u627E\u4E0D\u5230\u7EC4\u4EF6 ${propertyType.name}`);
                    }
                  }
                } else {
                  throw new Error(`\u65E0\u6CD5\u89E3\u6790 ${key} \u7684\u76EE\u6807\u8282\u70B9/\u7EC4\u4EF6: ${value}`);
                }
              } else {
                if (isReferenceId) {
                  const targetNode = findNode(value);
                  if (targetNode) {
                    finalValue = targetNode;
                  } else {
                    finalValue = await loadAssetValue(value, key, propertyType);
                  }
                }
              }
            } catch (e) {
              throw new Error(`\u8BBE\u7F6E\u5C5E\u6027 ${key} \u5931\u8D25: ${e.message}`);
            }
            component[key] = finalValue;
          }
        }
      } catch (err) {
        const applied = [...before].filter(([key, value]) => !Object.is(component[key], value)).map(([key]) => key);
        throw new Error(err.message + (applied.length ? `\uFF1B\u90E8\u5206\u5C5E\u6027\u5DF2\u5E94\u7528: ${applied.join(",")}\uFF0C\u8BF7\u8BFB\u56DE\u786E\u8BA4\uFF0C\u7981\u6B62\u6574\u6279\u91CD\u653E` : ""));
      }
    };
    if (!node) {
      if (event.reply) event.reply(new Error("\u627E\u4E0D\u5230\u8282\u70B9"));
      return;
    }
    switch (action) {
      case "add":
        if (!componentType) {
          if (event.reply) event.reply(new Error("\u5FC5\u987B\u63D0\u4F9B\u7EC4\u4EF6\u7C7B\u578B"));
          return;
        }
        const COMPONENT_ALIAS_MAP = {
          "cc.BoxCollider2D": "cc.BoxCollider",
          "cc.Collider2D": "cc.Collider",
          "cc.TiledAtlas": "cc.TiledMap",
          "cc.UITransform": "cc.Widget",
          "cc.SpriteBox": "cc.Sprite"
        };
        if (COMPONENT_ALIAS_MAP[componentType]) {
          componentType = COMPONENT_ALIAS_MAP[componentType];
        }
        if (componentType === "cc.Node" || componentType === "Node") {
          if (event.reply) {
            event.reply(
              new Error(
                "\u3010\u7EA0\u9519\u63D0\u793A\u3011cc.Node \u662F\u8282\u70B9\u800C\u4E0D\u662F\u7EC4\u4EF6\uFF0C\u65E0\u6CD5\u88AB\u5F53\u505A\u7EC4\u4EF6\u6DFB\u52A0\uFF01\n- \u5982\u679C\u4F60\u60F3\u521B\u5EFA\u5E26\u6709\u540D\u5B57\u7684\u5B50\u8282\u70B9\uFF0C\u8BF7\u4E0D\u8981\u4F7F\u7528 manage_components\uFF0C\u800C\u662F\u4F7F\u7528 create-node (\u6216\u76F8\u5E94\u7684\u521B\u5EFA\u8282\u70B9\u5DE5\u5177)\u3002\n- \u5982\u679C\u4F60\u60F3\u4FEE\u6539\u73B0\u6709\u8282\u70B9\u7684 name \u5C5E\u6027\uFF0C\u8BF7\u4F7F\u7528\u4FEE\u6539\u8282\u70B9\u7684 set-property \u5DE5\u5177\u3002"
              )
            );
          }
          return;
        }
        try {
          let compClass = null;
          if (componentType.startsWith("cc.")) {
            const className = componentType.replace("cc.", "");
            compClass = cc[className];
          } else {
            compClass = cc.js.getClassByName(componentType);
            if (!compClass && cc[componentType]) {
              compClass = cc[componentType];
            }
          }
          if (!compClass) {
            if (event.reply) event.reply(new Error(`\u627E\u4E0D\u5230\u7EC4\u4EF6\u7C7B\u578B: ${componentType}`));
            return;
          }
          if (!cc.js.isChildClassOf(compClass, cc.Component)) {
            if (event.reply) {
              event.reply(
                new Error(
                  `\u3010\u9519\u8BEF\u3011'${componentType}' \u4E0D\u662F\u4E00\u4E2A\u5408\u6CD5\u7684\u7EC4\u4EF6\u7C7B\u578B\uFF08\u5FC5\u987B\u7EE7\u627F\u81EA cc.Component\uFF09\u3002\u8BF7\u786E\u8BA4\u4F60\u7684\u610F\u56FE\u3002`
                )
              );
            }
            return;
          }
          let isReused = false;
          let component = node.addComponent(compClass);
          if (!component) {
            component = node.getComponent(compClass);
            if (!component) {
              if (event.reply) event.reply(new Error(`\u6DFB\u52A0\u7EC4\u4EF6\u5931\u8D25\uFF0C\u5F15\u64CE\u8FD4\u56DE null \u4E14\u672A\u627E\u5230\u5DF2\u6709\u540C\u7C7B\u7EC4\u4EF6: ${componentType}`));
              return;
            }
            isReused = true;
          }
          try {
            if (properties) await applyProperties(component, properties);
          } finally {
            notifySceneChanged(event, nodeId);
          }
          if (event.reply) {
            event.reply(null, isReused ? `\u7EC4\u4EF6 ${componentType} \u5DF2\u5B58\u5728\uFF0C\u5DF2\u81EA\u52A8\u91CD\u7528\u5E76\u8986\u76D6\u5176\u5C5E\u6027` : `\u7EC4\u4EF6 ${componentType} \u5DF2\u6DFB\u52A0`);
          }
        } catch (err) {
          if (event.reply) event.reply(new Error(`\u6DFB\u52A0\u7EC4\u4EF6\u5931\u8D25: ${err.message}`));
        }
        break;
      case "remove":
        if (!componentId && !componentType) {
          if (event.reply) event.reply(new Error("\u5FC5\u987B\u63D0\u4F9B\u7EC4\u4EF6 ID \u6216\u7EC4\u4EF6\u7C7B\u578B(componentType)"));
          return;
        }
        try {
          let component = null;
          if (componentId) {
            if (node._components) {
              for (let i = 0; i < node._components.length; i++) {
                if (node._components[i].uuid === componentId) {
                  component = node._components[i];
                  break;
                }
              }
            }
          } else if (componentType) {
            let compClass = null;
            if (componentType.startsWith("cc.")) {
              const className = componentType.replace("cc.", "");
              compClass = cc[className];
            } else {
              compClass = cc.js.getClassByName(componentType);
              if (!compClass && cc[componentType]) {
                compClass = cc[componentType];
              }
            }
            if (compClass) {
              component = node.getComponent(compClass);
            }
          }
          if (component) {
            node.removeComponent(component);
            notifySceneChanged(event, nodeId);
            if (event.reply) event.reply(null, "\u7EC4\u4EF6\u5DF2\u79FB\u9664");
          } else {
            if (event.reply) event.reply(new Error("\u627E\u4E0D\u5230\u7EC4\u4EF6"));
          }
        } catch (err) {
          if (event.reply) event.reply(new Error(`\u79FB\u9664\u7EC4\u4EF6\u5931\u8D25: ${err.message}`));
        }
        break;
      case "update":
        if (!componentType && !componentId) {
          if (event.reply) event.reply(new Error("\u5FC5\u987B\u63D0\u4F9B\u7EC4\u4EF6 ID \u6216\u7EC4\u4EF6\u7C7B\u578B"));
          return;
        }
        try {
          let targetComp = null;
          if (componentId) {
            if (node._components) {
              for (let i = 0; i < node._components.length; i++) {
                if (node._components[i].uuid === componentId) {
                  targetComp = node._components[i];
                  break;
                }
              }
            }
          }
          if (!targetComp && componentType) {
            let compClass = null;
            if (componentType.startsWith("cc.")) {
              const className = componentType.replace("cc.", "");
              compClass = cc[className];
            } else {
              compClass = cc.js.getClassByName(componentType);
              if (!compClass && cc[componentType]) {
                compClass = cc[componentType];
              }
            }
            if (compClass) {
              targetComp = node.getComponent(compClass);
            }
          }
          if (targetComp) {
            if (properties) {
              try {
                await applyProperties(targetComp, properties);
              } finally {
                notifySceneChanged(event, nodeId);
              }
              if (event.reply) event.reply(null, "\u7EC4\u4EF6\u5C5E\u6027\u5DF2\u66F4\u65B0");
            } else {
              if (event.reply) event.reply(null, "\u6CA1\u6709\u9700\u8981\u66F4\u65B0\u7684\u5C5E\u6027");
            }
          } else {
            if (event.reply)
              event.reply(new Error(`\u627E\u4E0D\u5230\u7EC4\u4EF6 (\u7C7B\u578B: ${componentType}, ID: ${componentId})`));
          }
        } catch (err) {
          if (event.reply) event.reply(new Error(`\u66F4\u65B0\u7EC4\u4EF6\u5931\u8D25: ${err.message}`));
        }
        break;
      default:
        if (event.reply) event.reply(new Error(`\u672A\u77E5\u7684\u7EC4\u4EF6\u64CD\u4F5C\u7C7B\u578B: ${action}`));
        break;
    }
  },
  "get-component-properties": function(component) {
    const properties = {};
    for (const key in component) {
      if (typeof component[key] !== "function" && !key.startsWith("_") && component[key] !== void 0) {
        try {
          properties[key] = component[key];
        } catch (e) {
        }
      }
    }
    return properties;
  },
  "instantiate-prefab": function(event, args) {
    const { prefabUuid, parentId } = args;
    const scene = cc.director.getScene();
    if (!scene) {
      if (event.reply) event.reply(new Error("\u573A\u666F\u5C1A\u672A\u51C6\u5907\u597D\u6216\u6B63\u5728\u52A0\u8F7D\u3002"));
      return;
    }
    if (!prefabUuid) {
      if (event.reply) event.reply(new Error("\u5FC5\u987B\u63D0\u4F9B\u9884\u5236\u4F53 UUID\u3002"));
      return;
    }
    cc.assetManager.loadAny(prefabUuid, (err, prefab) => {
      if (err) {
        if (event.reply) event.reply(new Error(`\u52A0\u8F7D\u9884\u5236\u4F53\u5931\u8D25: ${err.message}`));
        return;
      }
      const instance = cc.instantiate(prefab);
      if (!instance) {
        if (event.reply) event.reply(new Error("\u5B9E\u4F8B\u5316\u9884\u5236\u4F53\u5931\u8D25"));
        return;
      }
      let parent = parentId ? findNode(parentId) : scene;
      if (parent) {
        instance.parent = parent;
        Editor.Ipc.sendToMain("scene:dirty");
        setTimeout(() => {
          Editor.Ipc.sendToAll("scene:node-created", {
            uuid: instance.uuid,
            parentUuid: parent.uuid
          });
        }, 10);
        if (event.reply) event.reply(null, `\u9884\u5236\u4F53\u5B9E\u4F8B\u5316\u6210\u529F\uFF0CUUID: ${instance.uuid}`);
      } else {
        if (event.reply) event.reply(new Error("\u627E\u4E0D\u5230\u7236\u8282\u70B9"));
      }
    });
  },
  /**
   * 根据特定条件在场景中搜索节点
   * @param {Object} event IPC 事件对象
   * @param {Object} args 参数 (conditions, recursive)
   */
  "find-gameobjects": function(event, args) {
    const { conditions, recursive = true } = args;
    let budget;
    const scene = args.scopeNodeId ? findNode(args.scopeNodeId) : cc.director.getScene();
    if (!scene) return event.reply(new Error("\u573A\u666F\u6216\u67E5\u8BE2\u8303\u56F4\u4E0D\u5B58\u5728"));
    try {
      budget = sceneQuery(args, scene, "nodes");
    } catch (err) {
      return event.reply(err);
    }
    const pending = [scene];
    function searchNode(node) {
      if (!budget.check(node)) return;
      if (!node || !node.name || typeof node.name === "string" && (node.name.startsWith("Editor Scene") || node.name === "gizmoRoot")) {
        return;
      }
      let match = true;
      if (conditions.name && !node.name.includes(conditions.name)) {
        match = false;
      }
      if (conditions.component) {
        let hasComponent = false;
        try {
          if (conditions.component.startsWith("cc.")) {
            const className = conditions.component.replace("cc.", "");
            hasComponent = node.getComponent(cc[className]) !== null;
          } else {
            hasComponent = node.getComponent(conditions.component) !== null;
          }
        } catch (e) {
          hasComponent = false;
        }
        if (!hasComponent) {
          match = false;
        }
      }
      if (conditions.active !== void 0 && node.active !== conditions.active) {
        match = false;
      }
      if (match) {
        const comps = node._components || [];
        budget.add({
          uuid: node.uuid,
          name: node.name,
          active: node.active,
          components: comps.map((c) => {
            const parts = (cc.js.getClassName(c) || "").split(".");
            return parts[parts.length - 1];
          }),
          childrenCount: node.childrenCount
        });
      }
      if (recursive) {
        for (let i = node.childrenCount - 1; i >= 0; i--) {
          pending.push(node.children[i]);
        }
      }
    }
    while (pending.length && budget.check()) searchNode(pending.pop());
    if (event.reply) {
      try {
        event.reply(null, budget.finish());
      } catch (err) {
        event.reply(err);
      }
    }
  },
  /**
   * 查找场景中引用了指定节点或资源的所有位置
   * @param {Object} event IPC 事件对象
   * @param {Object} args 参数 (targetId, targetType)
   */
  "find-references": function(event, args) {
    const { targetId, targetType = "auto", additionalIds } = args;
    if (!targetId) {
      if (event.reply) event.reply(new Error("\u5FC5\u987B\u63D0\u4F9B targetId \u53C2\u6570"));
      return;
    }
    const scene = args.scopeNodeId ? findNode(args.scopeNodeId) : cc.director.getScene();
    if (!scene) {
      if (event.reply) event.reply(new Error("\u573A\u666F\u5C1A\u672A\u51C6\u5907\u597D"));
      return;
    }
    let detectedType = targetType;
    if (targetType === "auto") {
      const targetNode = findNode(targetId);
      detectedType = targetNode ? "node" : "asset";
    }
    let budget;
    try {
      budget = sceneQuery(args, scene, "references");
    } catch (err) {
      return event.reply(err);
    }
    const targetVariants = [targetId];
    try {
      if (typeof Editor !== "undefined" && Editor.Utils && Editor.Utils.UuidUtils) {
        const compressed = Editor.Utils.UuidUtils.compressUuid(targetId);
        const decompressed = Editor.Utils.UuidUtils.decompressUuid(targetId);
        if (compressed && compressed !== targetId) targetVariants.push(compressed);
        if (decompressed && decompressed !== targetId) targetVariants.push(decompressed);
      }
    } catch (e) {
    }
    if (Array.isArray(additionalIds)) {
      additionalIds.forEach(function(aid) {
        if (targetVariants.indexOf(aid) === -1) targetVariants.push(aid);
        try {
          if (typeof Editor !== "undefined" && Editor.Utils && Editor.Utils.UuidUtils) {
            var c = Editor.Utils.UuidUtils.compressUuid(aid);
            var d = Editor.Utils.UuidUtils.decompressUuid(aid);
            if (c && targetVariants.indexOf(c) === -1) targetVariants.push(c);
            if (d && targetVariants.indexOf(d) === -1) targetVariants.push(d);
          }
        } catch (e) {
        }
      });
    }
    function checkValue(val) {
      if (!val || typeof val !== "object") return null;
      if (detectedType === "node") {
        if (val instanceof cc.Node && val.uuid === targetId) {
          return `\u8282\u70B9(${val.name})`;
        }
      } else {
        if (val instanceof cc.Asset) {
          var assetUuid = val._uuid || "";
          for (var vi = 0; vi < targetVariants.length; vi++) {
            if (assetUuid === targetVariants[vi]) {
              return `\u8D44\u6E90(${val.name || assetUuid})`;
            }
          }
        }
      }
      return null;
    }
    const pending = [scene];
    function scanNode(node) {
      if (!budget.check(node)) return;
      if (!node || !node.name) return;
      if (typeof node.name === "string" && (node.name.startsWith("Editor Scene") || node.name === "gizmoRoot")) {
        return;
      }
      if (detectedType === "node" && node.uuid === targetId) {
      } else {
        const comps = node._components || [];
        for (let ci = 0; ci < comps.length; ci++) {
          const comp = comps[ci];
          const compTypeName = cc.js.getClassName(comp) || comp.constructor.name || "Unknown";
          for (const key in comp) {
            if (!budget.check()) return;
            if (typeof comp[key] === "function" || key.startsWith("_")) continue;
            if (key === "node" || key === "uuid" || key === "name") continue;
            try {
              const val = comp[key];
              if (val === null || val === void 0) continue;
              const directMatch = checkValue(val);
              if (directMatch) {
                budget.add({
                  nodeId: node.uuid,
                  nodeName: node.name,
                  componentType: compTypeName,
                  componentIndex: ci,
                  propertyName: key,
                  propertyValue: directMatch
                });
                continue;
              }
              if (Array.isArray(val)) {
                for (let ai = 0; ai < val.length; ai++) {
                  if (!budget.check()) return;
                  const item = val[ai];
                  const arrMatch = checkValue(item);
                  if (arrMatch) {
                    budget.add({
                      nodeId: node.uuid,
                      nodeName: node.name,
                      componentType: compTypeName,
                      componentIndex: ci,
                      propertyName: `${key}[${ai}]`,
                      propertyValue: arrMatch
                    });
                  }
                  if (item && item instanceof cc.Component.EventHandler && item.target) {
                    const ehMatch = checkValue(item.target);
                    if (ehMatch) {
                      budget.add({
                        nodeId: node.uuid,
                        nodeName: node.name,
                        componentType: compTypeName,
                        componentIndex: ci,
                        propertyName: `${key}[${ai}].target`,
                        propertyValue: ehMatch
                      });
                    }
                  }
                }
              }
            } catch (e) {
            }
          }
        }
      }
      for (let i = node.childrenCount - 1; i >= 0; i--) {
        pending.push(node.children[i]);
      }
    }
    while (pending.length && budget.check()) scanNode(pending.pop());
    try {
      const page = budget.finish();
      if (event.reply) event.reply(null, Array.isArray(page) ? { targetId, targetType: detectedType, referenceCount: page.length, references: page } : {
        targetId,
        targetType: detectedType,
        referenceCount: page.total,
        references: page.results,
        nextCursor: page.nextCursor,
        truncated: page.truncated,
        visited: page.visited
      });
    } catch (err) {
      event.reply(err);
    }
  },
  /**
   * 删除指定的场景节点
   * @param {Object} event IPC 事件对象
   * @param {Object} args 参数 (uuid)
   */
  "delete-node": function(event, args) {
    const { uuid } = args;
    const node = findNode(uuid);
    if (node) {
      const parent = node.parent;
      node.destroy();
      Editor.Ipc.sendToMain("scene:dirty");
      setTimeout(() => {
        if (parent) {
          Editor.Ipc.sendToAll("scene:node-changed", { uuid: parent.uuid });
        }
        Editor.Ipc.sendToAll("scene:node-deleted", { uuid });
      }, 10);
      const confirm = () => {
        if (cc.isValid(node)) {
          setTimeout(confirm, 16);
          return;
        }
        if (event.reply) event.reply(null, `\u8282\u70B9 ${uuid} \u5DF2\u5220\u9664`);
      };
      setTimeout(confirm, 16);
    } else {
      if (event.reply) event.reply(new Error(`\u627E\u4E0D\u5230\u8282\u70B9: ${uuid}`));
    }
  },
  /**
   * 管理高效的全场景特效 (粒子系统)
   * @param {Object} event IPC 事件对象
   * @param {Object} args 参数 (action, nodeId, properties, name, parentId)
   */
  "manage-vfx": async function(event, args) {
    let createdNode = null, createdComponent = null;
    try {
      const { action, nodeId, properties, name, parentId } = args;
      const scene = cc.director.getScene();
      const applyParticleProperties = async (particleSystem, props) => {
        props = props || {};
        const resourceId = props.file || !particleSystem.texture && !particleSystem.file && args.defaultSpriteUuid;
        const asset = resourceId ? await loadSceneAsset(resourceId) : null;
        if (asset && !(asset instanceof cc.ParticleAsset || asset instanceof cc.Texture2D || asset instanceof cc.SpriteFrame)) throw new Error("\u7279\u6548\u8D44\u6E90\u7C7B\u578B\u4E0D\u5339\u914D");
        if (cc.director.getScene() !== scene) throw new Error("\u52A0\u8F7D\u7279\u6548\u671F\u95F4\u573A\u666F\u5DF2\u53D8\u5316");
        if (props.duration !== void 0) particleSystem.duration = props.duration;
        if (props.emissionRate !== void 0) particleSystem.emissionRate = props.emissionRate;
        if (props.life !== void 0) particleSystem.life = props.life;
        if (props.lifeVar !== void 0) particleSystem.lifeVar = props.lifeVar;
        particleSystem.custom = true;
        if (props.startColor) particleSystem.startColor = new cc.Color().fromHEX(props.startColor);
        if (props.endColor) particleSystem.endColor = new cc.Color().fromHEX(props.endColor);
        if (props.startSize !== void 0) particleSystem.startSize = props.startSize;
        if (props.endSize !== void 0) particleSystem.endSize = props.endSize;
        if (props.speed !== void 0) particleSystem.speed = props.speed;
        if (props.angle !== void 0) particleSystem.angle = props.angle;
        if (props.gravity) {
          if (props.gravity.x !== void 0) particleSystem.gravity.x = props.gravity.x;
          if (props.gravity.y !== void 0) particleSystem.gravity.y = props.gravity.y;
        }
        if (asset instanceof cc.ParticleAsset) particleSystem.file = asset;
        else if (asset) particleSystem.texture = asset;
      };
      if (action === "create") {
        if (parentId && !findNode(parentId)) throw new Error("\u627E\u4E0D\u5230\u7236\u8282\u70B9");
        let newNode = createdNode = new cc.Node(name || "New Particle");
        let particleSystem = newNode.addComponent(cc.ParticleSystem);
        particleSystem.resetSystem();
        particleSystem.custom = true;
        await applyParticleProperties(particleSystem, properties);
        let parent = parentId ? cc.engine.getInstanceById(parentId) : scene;
        if (parent) {
          newNode.parent = parent;
          Editor.Ipc.sendToMain("scene:dirty");
          setTimeout(() => {
            Editor.Ipc.sendToAll("scene:node-created", {
              uuid: newNode.uuid,
              parentUuid: parent.uuid
            });
          }, 10);
          if (event.reply) event.reply(null, newNode.uuid);
        } else {
          throw new Error("\u627E\u4E0D\u5230\u7236\u8282\u70B9");
        }
      } else if (action === "update") {
        let node = findNode(nodeId);
        if (node) {
          let particleSystem = node.getComponent(cc.ParticleSystem);
          if (!particleSystem) {
            particleSystem = node.addComponent(cc.ParticleSystem);
            createdComponent = particleSystem;
          }
          await applyParticleProperties(particleSystem, properties);
          Editor.Ipc.sendToMain("scene:dirty");
          Editor.Ipc.sendToAll("scene:node-changed", { uuid: nodeId });
          if (event.reply) event.reply(null, "\u7279\u6548\u5DF2\u66F4\u65B0");
        } else {
          if (event.reply) event.reply(new Error("\u627E\u4E0D\u5230\u8282\u70B9"));
        }
      } else if (action === "get_info") {
        let node = findNode(nodeId);
        if (node) {
          let ps = node.getComponent(cc.ParticleSystem);
          if (ps) {
            const info = {
              duration: ps.duration,
              emissionRate: ps.emissionRate,
              life: ps.life,
              lifeVar: ps.lifeVar,
              startColor: ps.startColor.toHEX("#RRGGBB"),
              endColor: ps.endColor.toHEX("#RRGGBB"),
              startSize: ps.startSize,
              endSize: ps.endSize,
              speed: ps.speed,
              angle: ps.angle,
              gravity: { x: ps.gravity.x, y: ps.gravity.y },
              file: ps.file ? ps.file.name : null
            };
            if (event.reply) event.reply(null, info);
          } else {
            if (event.reply) event.reply(null, { hasParticleSystem: false });
          }
        } else {
          if (event.reply) event.reply(new Error("\u627E\u4E0D\u5230\u8282\u70B9"));
        }
      } else {
        if (event.reply) event.reply(new Error(`\u672A\u77E5\u7684\u7279\u6548\u64CD\u4F5C\u7C7B\u578B: ${action}`));
      }
    } catch (err) {
      const temporary = createdNode || createdComponent;
      if (temporary && typeof temporary.destroy === "function") {
        temporary.destroy();
        while (cc.isValid && cc.isValid(temporary)) await new Promise((resolve) => setTimeout(resolve, 16));
      }
      if (event.reply) event.reply(new Error("\u7279\u6548\u64CD\u4F5C\u5931\u8D25: " + (err.message || err)));
    }
  },
  /**
   * 控制节点的动画组件 (播放、暂停、停止等)
   * @param {Object} event IPC 事件对象
   * @param {Object} args 参数 (action, nodeId, clipName)
   */
  "manage-animation": function(event, args) {
    const { action, nodeId, clipName } = args;
    const node = findNode(nodeId);
    if (!node) {
      if (event.reply) event.reply(new Error(`\u627E\u4E0D\u5230\u8282\u70B9: ${nodeId}`));
      return;
    }
    const anim = node.getComponent(cc.Animation);
    if (!anim) {
      if (event.reply) event.reply(new Error(`\u5728\u8282\u70B9 ${nodeId} \u4E0A\u627E\u4E0D\u5230 Animation \u7EC4\u4EF6`));
      return;
    }
    switch (action) {
      case "get_list":
        const clips = anim.getClips();
        const clipList = clips.map((c) => ({
          name: c.name,
          duration: c.duration,
          sample: c.sample,
          speed: c.speed,
          wrapMode: c.wrapMode
        }));
        if (event.reply) event.reply(null, clipList);
        break;
      case "get_info":
        const currentClip = anim.currentClip;
        let isPlaying = false;
        if (currentClip) {
          const state = anim.getAnimationState(currentClip.name);
          if (state) {
            isPlaying = state.isPlaying;
          }
        }
        const info = {
          currentClip: currentClip ? currentClip.name : null,
          clips: anim.getClips().map((c) => c.name),
          playOnLoad: anim.playOnLoad,
          isPlaying
        };
        if (event.reply) event.reply(null, info);
        break;
      case "play":
        if (!clipName) {
          anim.play();
          if (event.reply) event.reply(null, "\u6B63\u5728\u64AD\u653E\u9ED8\u8BA4\u52A8\u753B\u526A\u8F91");
        } else {
          anim.play(clipName);
          if (event.reply) event.reply(null, `\u6B63\u5728\u64AD\u653E\u52A8\u753B\u526A\u8F91: ${clipName}`);
        }
        break;
      case "stop":
        anim.stop();
        if (event.reply) event.reply(null, "\u52A8\u753B\u5DF2\u505C\u6B62");
        break;
      case "pause":
        anim.pause();
        if (event.reply) event.reply(null, "\u52A8\u753B\u5DF2\u6682\u505C");
        break;
      case "resume":
        anim.resume();
        if (event.reply) event.reply(null, "\u52A8\u753B\u5DF2\u6062\u590D\u64AD\u653E");
        break;
      default:
        if (event.reply) event.reply(new Error(`\u672A\u77E5\u7684\u52A8\u753B\u64CD\u4F5C\u7C7B\u578B: ${action}`));
        break;
    }
  },
  /**
   * 自定义预制体创建：在场景进程中序列化节点树，并转换为正确的预制体格式
   * Editor.serialize() 对简单节点返回单对象，对引用图返回数组，统一转换为预制体格式。
   * @param {Object} event IPC 事件对象
   * @param {Object} args 参数 (nodeId)
   */
  "create-prefab": function(event, args) {
    const { nodeId, nodeName } = args;
    const node = findNode(nodeId);
    if (!node) {
      if (event.reply) event.reply(new Error(`\u627E\u4E0D\u5230\u8282\u70B9: ${nodeId}`));
      return;
    }
    const originalParent = node.parent;
    const originalName = node.name;
    const originalSiblingIndex = originalParent ? node.getSiblingIndex() : 0;
    try {
      let generateFileId = function() {
        const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let result2 = "";
        for (let i = 0; i < 22; i++) {
          result2 += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result2;
      }, updateRefs = function(obj) {
        if (obj === null || obj === void 0 || typeof obj !== "object") return;
        if (Array.isArray(obj)) {
          obj.forEach(function(item) {
            updateRefs(item);
          });
          return;
        }
        for (let key in obj) {
          if (!obj.hasOwnProperty(key)) continue;
          if (key === "__id__" && typeof obj[key] === "number") {
            let oldIdx = obj[key];
            if (oldToNewIndex.hasOwnProperty(oldIdx)) {
              obj[key] = oldToNewIndex[oldIdx];
            }
          } else if (typeof obj[key] === "object" && obj[key] !== null) {
            updateRefs(obj[key]);
          }
        }
      };
      let serializedStr;
      try {
        node.parent = null;
        if (nodeName) node.name = nodeName;
        serializedStr = Editor.serialize(node);
      } finally {
        node.parent = originalParent;
        node.name = originalName;
        if (originalParent) node.setSiblingIndex(originalSiblingIndex);
      }
      const serialized = JSON.parse(serializedStr);
      const sceneData = Array.isArray(serialized) ? serialized : [serialized];
      if (sceneData.length === 0 || sceneData.some((item) => !item || typeof item !== "object")) {
        if (event.reply) event.reply(new Error("\u5E8F\u5217\u5316\u6570\u636E\u683C\u5F0F\u5F02\u5E38"));
        return;
      }
      let sceneIndex = -1;
      for (let i = 0; i < sceneData.length; i++) {
        if (sceneData[i].__type__ === "cc.Scene") {
          sceneIndex = i;
          break;
        }
      }
      let filteredData = [];
      let oldToNewIndex = {};
      let newIndex = 0;
      newIndex = 1;
      for (let i = 0; i < sceneData.length; i++) {
        if (i === sceneIndex) {
          oldToNewIndex[i] = -1;
          continue;
        }
        oldToNewIndex[i] = newIndex;
        filteredData.push(sceneData[i]);
        newIndex++;
      }
      let rootNodeOldIndex = -1;
      for (let i = 0; i < sceneData.length; i++) {
        if (i === sceneIndex) continue;
        if (sceneData[i].__type__ === "cc.Node") {
          if (sceneData[i]._parent && sceneData[i]._parent.__id__ === sceneIndex) {
            rootNodeOldIndex = i;
            break;
          }
        }
      }
      if (rootNodeOldIndex === -1) {
        for (let i = 0; i < sceneData.length; i++) {
          if (i === sceneIndex) continue;
          if (sceneData[i].__type__ === "cc.Node") {
            rootNodeOldIndex = i;
            break;
          }
        }
      }
      if (rootNodeOldIndex === -1) throw new Error("\u5E8F\u5217\u5316\u6570\u636E\u4E2D\u6CA1\u6709\u53EF\u521B\u5EFA\u9884\u5236\u4F53\u7684\u8282\u70B9");
      const rootNodeNewIndex = oldToNewIndex[rootNodeOldIndex];
      let nodeEntries = [];
      for (let i = 0; i < filteredData.length; i++) {
        if (filteredData[i].__type__ === "cc.Node") {
          nodeEntries.push({
            arrayIndex: i + 1,
            // +1 因为 cc.Prefab 在索引 0
            isRoot: i + 1 === rootNodeNewIndex
          });
        }
      }
      let prefabData = [];
      prefabData.push({
        __type__: "cc.Prefab",
        _name: "",
        _objFlags: 0,
        _native: "",
        data: { __id__: rootNodeNewIndex },
        optimizationPolicy: 0,
        asyncLoadAssets: false,
        readonly: false
      });
      for (let i = 0; i < filteredData.length; i++) {
        prefabData.push(filteredData[i]);
      }
      for (let i = 1; i < prefabData.length; i++) {
        updateRefs(prefabData[i]);
      }
      let rootNodeObj = prefabData[rootNodeNewIndex];
      if (rootNodeObj) {
        rootNodeObj._parent = null;
      }
      for (let i = 1; i < prefabData.length; i++) {
        if (prefabData[i]._id !== void 0) {
          prefabData[i]._id = "";
        }
      }
      let prefabInfoStartIndex = prefabData.length;
      for (let ni = 0; ni < nodeEntries.length; ni++) {
        let entry = nodeEntries[ni];
        let prefabInfoIndex = prefabInfoStartIndex + ni;
        let nodeObj = prefabData[entry.arrayIndex];
        if (nodeObj) {
          nodeObj._prefab = { __id__: prefabInfoIndex };
        }
        prefabData.push({
          __type__: "cc.PrefabInfo",
          root: { __id__: rootNodeNewIndex },
          asset: { __id__: 0 },
          fileId: entry.isRoot ? "" : generateFileId(),
          sync: false
        });
      }
      const result = JSON.stringify(prefabData, null, 2);
      if (event.reply) event.reply(null, result);
    } catch (e) {
      if (event.reply) event.reply(new Error(`\u5E8F\u5217\u5316\u8282\u70B9\u5931\u8D25: ${e.message}`));
    }
  },
  "save-scene": function(event, args) {
    try {
      const editMode = Editor.require("scene://edit-mode");
      if (!editMode || editMode.curMode().name !== "scene") {
        event.reply(new Error("\u5F53\u524D\u4E0D\u5728\u573A\u666F\u7F16\u8F91\u6A21\u5F0F\u4E2D\uFF0C\u8BF7\u4F7F\u7528 save_prefab \u4FDD\u5B58\u9884\u5236\u4F53"));
        return;
      }
      editMode.save((err) => event.reply(err ? new Error(err.message || err) : null, err ? null : "\u573A\u666F\u4FDD\u5B58\u5B8C\u6210"));
    } catch (e) {
      event.reply(new Error("\u4FDD\u5B58\u573A\u666F\u53D1\u751F\u5F02\u5E38: " + e.message));
    }
  },
  "save-prefab": function(event, args) {
    try {
      const editMode = Editor.require("scene://edit-mode");
      if (editMode && editMode.curMode().name === "prefab") {
        editMode.save((err) => {
          if (err) {
            if (event.reply) event.reply(new Error(err.message || err));
          } else {
            if (event.reply) event.reply(null, "\u9884\u5236\u4F53\u4FDD\u5B58\u6210\u529F");
          }
        });
      } else {
        if (event.reply) event.reply(new Error("\u5F53\u524D\u4E0D\u5728\u9884\u5236\u4F53\u7F16\u8F91\u6A21\u5F0F\u4E2D"));
      }
    } catch (e) {
      if (event.reply) event.reply(new Error("\u4FDD\u5B58\u9884\u5236\u4F53\u53D1\u751F\u5F02\u5E38: " + e.message));
    }
  },
  "close-prefab": function(event, args) {
    try {
      const editMode = Editor.require("scene://edit-mode");
      if (editMode && editMode.curMode().name === "prefab") {
        editMode.pop();
        const confirm = () => {
          if (editMode.curMode().name === "prefab") {
            setTimeout(confirm, 50);
            return;
          }
          if (event.reply) event.reply(null, "\u5DF2\u9000\u51FA\u9884\u5236\u4F53\u7F16\u8F91\u6A21\u5F0F");
        };
        setTimeout(confirm, 50);
      } else {
        if (event.reply) event.reply(new Error("\u5F53\u524D\u4E0D\u5728\u9884\u5236\u4F53\u7F16\u8F91\u6A21\u5F0F\u4E2D"));
      }
    } catch (e) {
      if (event.reply) event.reply(new Error("\u9000\u51FA\u9884\u5236\u4F53\u6A21\u5F0F\u53D1\u751F\u5F02\u5E38: " + e.message));
    }
  }
};
module.exports = sceneTools;
