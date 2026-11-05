import { isAssetRoot, validateAssetUrl } from "../utils/AssetUrl";
import { boundedValue } from "../utils/BoundedValue";
// 批处理只串行调用分发器；不能再次加入全局队列，否则会等待自身释放锁。
const forbiddenKeys = new Set(["__proto__", "prototype", "constructor"]);

function mapReferences(value, resolve) {
    if (Array.isArray(value)) return value.map(item => mapReferences(item, resolve));
    if (value && typeof value === "object") {
        if (Object.prototype.hasOwnProperty.call(value, "$ref")) {
            if (Object.keys(value).length !== 1 || typeof value.$ref !== "string") throw new Error("$ref 必须是单独的字符串引用");
            return resolve(value.$ref);
        }
        const result = {};
        for (const key of Object.keys(value)) {
            if (forbiddenKeys.has(key)) throw new Error(`不允许的参数字段: ${key}`);
            result[key] = mapReferences(value[key], resolve);
        }
        return result;
    }
    return value;
}

// 校验工具声明使用的基础 schema；引用占位值在解析后再次按实际类型校验。
export function validate(value, schema, location, allowRef = false) {
    if (allowRef && value && typeof value === "object" && Object.hasOwnProperty.call(value, "$ref")) return;
    const type = schema.type;
    const valid = !type || (type === "array" ? Array.isArray(value)
        : type === "object" ? value !== null && typeof value === "object" && !Array.isArray(value)
        : type === "integer" ? Number.isInteger(value)
        : type === "number" ? typeof value === "number" && Number.isFinite(value) : typeof value === type);
    if (!valid) throw new Error(`${location} 必须为 ${type}`);
    if (type === "object") for (const key of Object.keys(value)) if (forbiddenKeys.has(key)) throw new Error(`不允许的参数字段: ${key}`);
    if (schema.enum && !schema.enum.includes(value)) throw new Error(`${location} 不在允许值中`);
    if (type === "object") {
        for (const key of schema.required || []) if (!Object.prototype.hasOwnProperty.call(value, key)) throw new Error(`${location}.${key} 缺少必填参数`);
        for (const key of Object.keys(value)) if (schema.properties?.[key]) validate(value[key], schema.properties[key], `${location}.${key}`, allowRef);
    }
    if (type === "array" && schema.items) value.forEach((item, i) => validate(item, schema.items, `${location}[${i}]`, allowRef));
    if (schema.minimum !== undefined && value < schema.minimum || schema.maximum !== undefined && value > schema.maximum) throw new Error(`${location} 超出允许范围`);
    if (schema.minItems !== undefined && value.length < schema.minItems || schema.maxItems !== undefined && value.length > schema.maxItems) throw new Error(`${location} 数量超出允许范围`);
}

export function validateConditional(tool, params) {
    if (tool === "delete_assets" || tool === "manage_asset" && params.action === "delete" && params.paths !== undefined) {
        if (params.path !== undefined) throw new Error("批量删除 paths 与单个 path 不能同时提供");
        for (const url of params.paths || []) {
            validateAssetUrl(url);
            if (isAssetRoot(url)) throw new Error("delete_assets 不允许删除资源根目录");
        }
    }
    if (tool === "manage_components") {
        if (params.action !== "get" && !params.nodeId) throw new Error("manage_components 写操作必须提供 nodeId");
        if (params.action === "get" && !params.nodeId && !params.nodeIds) throw new Error("manage_components(get) 必须提供 nodeId 或 nodeIds");
        if (params.nodeId && params.nodeIds) throw new Error("nodeId 与 nodeIds 不能同时提供");
        if (params.action === "add" && !params.componentType) throw new Error("添加组件必须提供 componentType");
        if (["remove", "update"].includes(params.action) && !params.componentType && !params.componentId) throw new Error("必须提供 componentType 或 componentId");
        if (params.action !== "get" && params.nodeIds !== undefined) throw new Error("nodeIds 仅适用于 get");
    }
    const requireFields = keys => { for (const key of keys) if (params[key] === undefined || params[key] === "") throw new Error(`${tool}.${key} 缺少操作必填参数`); };
    if (tool === "manage_asset") {
        if (params.paths !== undefined && params.action !== "delete") throw new Error("paths 仅用于批量 delete");
        if (!(params.action === "delete" && params.paths !== undefined)) requireFields(["path"]);
    }
    if (tool === "manage_asset" && params.action === "move") requireFields(["targetPath"]);
    if (tool === "scene_management" && params.action === "duplicate") requireFields(["targetPath"]);
    if (tool === "prefab_management" && ["create", "update"].includes(params.action)) requireFields(["nodeId"]);
    if (tool === "button_events" && params.action === "bind") requireFields(["targetId", "componentName", "handler"]);
    if (["manage_script", "manage_shader"].includes(tool) && ["write", "save"].includes(params.action)) requireFields(["content"]);
    if (tool === "capture_editor_screenshot") {
        if (params.crop && (!["x", "y", "width", "height"].every(k => Number.isInteger(params.crop[k])) || params.crop.x < 0 || params.crop.y < 0 || params.crop.width < 1 || params.crop.height < 1)) throw new Error("crop 需要合法矩形");
    }
    if (tool === "build_project") requireFields(params.action === "status" ? ["jobId"] : ["platform"]);
    if (tool === "manage_editor" && params.action === "refresh_editor") {
        if (!params.properties?.path) throw new Error("refresh_editor 需要 properties.path");
        validateAssetUrl(params.properties.path);
    }
    if (["manage_script", "manage_asset", "scene_management", "prefab_management", "manage_material", "manage_texture", "manage_shader", "apply_text_edits", "validate_script", "get_sha", "modify_prefab_offline", "modify_scene_offline", "open_scene", "open_prefab"].includes(tool)) {
        const readOnly = ["read", "get_info", "get_selection", "get_state"].includes(params.action);
        for (const key of ["path", "targetPath", "filePath", "prefabUrl", "sceneUrl", "url"]) {
            if (typeof params[key] !== "string") continue;
            validateAssetUrl(params[key], readOnly);
            // 根目录仅用于只读查询（如 get_info 列目录），写入类操作一律拒绝，避免误删/误移整个资源库。
            if (isAssetRoot(params[key]) && !readOnly) throw new Error(`${tool} 不允许对资源根目录 ${params[key]} 执行 ${params.action} 操作`);
        }
    }
    if (tool === "create_scene" && typeof params.sceneName === "string") validateAssetUrl(`db://assets/${params.sceneName}.fire`);
    if (tool === "create_prefab" && typeof params.prefabName === "string") validateAssetUrl(params.prefabName.startsWith("db://") ? params.prefabName : `db://assets/${params.prefabName}.prefab`);
}

export const SCENE_BATCH_METHODS = {
    create_node: "create-node", update_node_transform: "update-node-transform",
    manage_components: "manage-components", get_scene_hierarchy: "get-hierarchy", find_gameobjects: "find-gameobjects"
};

export function executeBatch(args, tools, dispatch, callback, options: { deadlineAt?: number } = {}) {
    const operations = args?.operations;
    const schemas = new Map(tools.map(tool => [tool.name, tool.inputSchema]));
    try {
        if (!Array.isArray(operations) || !operations.length || operations.length > 100) throw new Error("operations 必须包含 1–100 个操作");
        if (args.stopOnError !== undefined && typeof args.stopOnError !== "boolean") throw new Error("stopOnError 必须为 boolean");
        if (args.executionMode !== undefined && !["auto", "serial", "scene"].includes(args.executionMode)) throw new Error("executionMode 必须为 auto、serial 或 scene");
        if (args.maxResultBytes !== undefined && (!Number.isInteger(args.maxResultBytes) || args.maxResultBytes < 1024 || args.maxResultBytes > 4 * 1024 * 1024)) throw new Error("maxResultBytes 必须为 1024–4194304");
        if (args.outputMode && !["full", "summary"].includes(args.outputMode)) throw new Error("outputMode 必须为 full 或 summary");
        if (args.resultFields && (!Array.isArray(args.resultFields) || args.resultFields.length > 100 || args.resultFields.some(k => typeof k !== "string" || forbiddenKeys.has(k)))) throw new Error("resultFields 无效");
        const ids = new Set<string>();
        operations.forEach((op, i) => {
            if (!op || typeof op !== "object" || op.tool === "batch_execute" || !schemas.has(op.tool)) throw new Error(`操作 ${i}: 未知工具或不允许嵌套批处理`);
            if (op.id !== undefined && (typeof op.id !== "string" || !/^[A-Za-z][\w-]*$/.test(op.id) || ids.has(op.id) || forbiddenKeys.has(op.id))) throw new Error(`操作 ${i}: id 无效或重复`);
            mapReferences(op.params, ref => {
                const parts = ref.split(".");
                if (!ids.has(parts[0]) || parts.some(key => !key || forbiddenKeys.has(key))) throw new Error(`操作 ${i}: 引用只能指向前面操作的 id: ${ref}`);
                return null;
            });
            validate(op.params, schemas.get(op.tool), `操作 ${i}.params`, true);
            validateConditional(op.tool, op.params);
            if (op.id) ids.add(op.id);
        });
    } catch (err) { callback(`批处理预检失败: ${err.message}`); return; }

    const results = [], completed = new Map();
    let index = 0, usedBytes = 0, retainedBytes = 0;
    const retainedSizes = new Map<string, number>();
    const budget = args.maxResultBytes || 2 * 1024 * 1024;
    const lastUse = new Map<string, number>();
    operations.forEach((op, i) => mapReferences(op.params, ref => { lastUse.set(ref.split(".")[0], i); return null; }));
    const next = () => {
        // 无法取消正在进行的资源加载，但截止后绝不启动下一步，也不宣称已回滚。
        if (options.deadlineAt && Date.now() >= options.deadlineAt) {
            callback("场景批处理已超时；已执行步骤不会回滚，禁止整批重放", {
                results, executedCount: index, nextOperationIndex: index < operations.length ? index : null,
                remainingCount: operations.length - index, reason: "deadline"
            }); return;
        }
        if (index === operations.length) {
            const failures = results.filter(item => item.error).length;
            callback(failures ? `批处理有 ${failures} 个操作失败` : null, results);
            return;
        }
        const op = operations[index];
        let replied = false;
        const finish = (err, result?) => {
            if (replied) return;
            replied = true;
            const error = err ? String(err.message || err) : null;
            const selected = args.resultFields && result && typeof result === "object"
                ? Object.fromEntries(args.resultFields.filter(key => Object.prototype.hasOwnProperty.call(result, key)).map(key => [key, result[key]])) : result;
            const limited = boundedValue(selected, Math.max(32, budget - usedBytes - 2048), 16);
            const entry = { tool: op.tool, error, result: args.outputMode === "summary" ? { completed: !error } : limited.value, ...(op.id ? { id: op.id } : {}) };
            results.push(entry);
            usedBytes += Buffer.byteLength(JSON.stringify(entry));
            let referenceOverflow = false;
            if (op.id && lastUse.has(op.id)) {
                const retained = boundedValue(result, 4 * 1024 * 1024 - retainedBytes, 24);
                referenceOverflow = retained.truncated;
                if (!referenceOverflow) {
                    const size = Buffer.byteLength(JSON.stringify(retained.value) || "null");
                    retainedBytes += size; retainedSizes.set(op.id, size); completed.set(op.id, { error, result });
                }
            }
            for (const [id, until] of lastUse) if (until <= index) { completed.delete(id); retainedBytes -= retainedSizes.get(id) || 0; retainedSizes.delete(id); }
            index++;
            if (referenceOverflow || usedBytes >= budget - 2048 || (args.outputMode !== "summary" && limited.truncated)) {
                callback("批处理结果预算已达上限；已执行步骤不会回滚，禁止整批重放。请从未执行的步骤继续", {
                    results, executedCount: index, nextOperationIndex: index < operations.length ? index : null,
                    remainingCount: operations.length - index, resultTruncated: true, reason: referenceOverflow ? "referenceBudget" : "outputBudget"
                }); return;
            }
            if (error && args.stopOnError !== false) {
                callback(`批处理在操作 ${index - 1} (${op.tool}) 失败，后续未执行: ${error}`, results);
            } else {
                // 同步完成的工具也让出调用栈，避免深层递归。
                Promise.resolve().then(next);
            }
        };
        try {
            const params = mapReferences(op.params, ref => {
                const [id, ...keys] = ref.split(".");
                const prior = completed.get(id);
                if (!prior || prior.error) throw new Error(`引用的操作未成功: ${ref}`);
                let value = prior.result;
                for (const key of keys) {
                    if (value === null || typeof value !== "object" || !Object.prototype.hasOwnProperty.call(value, key)) throw new Error(`结果中不存在引用: ${ref}`);
                    value = value[key];
                }
                if (value === undefined) throw new Error(`结果引用为空: ${ref}`);
                return mapReferences(value, () => { throw new Error("结果不能包含嵌套 $ref"); });
            });
            validate(params, schemas.get(op.tool), `操作 ${index}.params`);
            validateConditional(op.tool, params);
            dispatch(op.tool, params, finish);
        } catch (err) { finish(err); }
    };
    next();
}
