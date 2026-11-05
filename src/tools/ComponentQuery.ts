import { boundedValue } from "../utils/BoundedValue";
function referenceValue(value, cc, depth = 0, seen = new Set(), budget = { remaining: 200 }) {
    if (--budget.remaining < 0) return "[Visit limit]";
    if (typeof value === "string" && value.length > 500) return value.slice(0, 500) + "...[Truncated]";
    if (value === null || typeof value !== "object") return value;
    const type = cc.js.getClassName(value) || value.constructor?.name || "Object";
    if (value instanceof cc.Asset) return { kind: "asset", uuid: value._uuid || value.uuid || null, type, name: value.name || "" };
    if (value instanceof cc.Node) return { kind: "node", uuid: value.uuid, type, name: value.name || "" };
    if (value instanceof cc.Component) return { kind: "component", uuid: value.uuid, type, nodeUuid: value.node?.uuid || null };
    if (value instanceof cc.ValueType) return value.toString();
    if (seen.has(value)) return "[Circular]";
    if (depth >= 4) return "[Depth limit]";
    seen.add(value);
    const result = Array.isArray(value) ? value.slice(0, 20).map(v => referenceValue(v, cc, depth + 1, seen, budget))
        : Object.fromEntries(Object.keys(value).slice(0, 20).filter(k => !["__proto__", "constructor", "prototype"].includes(k))
            .map(k => [k, referenceValue(value[k], cc, depth + 1, seen, budget)]));
    seen.delete(value);
    return result;
}
/** 保留默认摘要格式，按需读取组件和字段，避免触碰无关 getter。 */
export function queryComponents(node, args, cc) {
    return node._components.filter(c => (!args.componentId || c.uuid === args.componentId)
        && (!args.componentType || cc.js.getClassName(c) === args.componentType)).map(c => {
        const properties = {};
        const keys = args.fields || (() => { const names = []; for (const key in c) names.push(key); return names; })();
        for (const key of keys) {
            if (key.startsWith("_") || key === "constructor" || key === "__proto__" || !(key in c)) continue;
            try {
                const val = c[key];
                if (typeof val === "function" || val === undefined) continue;
                if (val === null || typeof val !== "object") {
                    properties[key] = typeof val === "string" && val.length > 200 && !args.includeFullText
                        ? val.substring(0, 50) + `...[Truncated, total length: ${val.length}]` : val;
                } else if (args.referenceMode === "structured") {
                    const detail = boundedValue(referenceValue(val, cc), 4096, 8);
                    properties[key] = detail.value;
                } else if (val instanceof cc.ValueType) {
                    properties[key] = val.toString();
                } else if (val instanceof cc.Asset) {
                    properties[key] = `资源(${val.name})`;
                } else if (val instanceof cc.Node) {
                    properties[key] = `节点(${val.name})`;
                } else if (val instanceof cc.Component) {
                    properties[key] = `组件(${val.name}<${val.__typename}>)`;
                } else if (Array.isArray(val) && val.length > 10) {
                    properties[key] = `[Array(${val.length})]`;
                } else {
                    try {
                        const summary = boundedValue(val, 500, 4);
                        properties[key] = summary.truncated ? "[Large JSON Object, bounded summary]" : summary.value;
                    } catch (err) {
                        properties[key] = `[复杂对象: ${val.constructor ? val.constructor.name : typeof val}]`;
                    }
                }
            } catch (err) { properties[key] = "[Serialization Error]"; }
        }
        return { type: cc.js.getClassName(c) || c.constructor.name || "Unknown", uuid: c.uuid, properties };
    });
}

export function validateComponentQuery(args) {
    if (args.nodeId && args.nodeIds) throw new Error("nodeId 与 nodeIds 不能同时提供");
    if (args.nodeIds !== undefined && (!Array.isArray(args.nodeIds) || !args.nodeIds.length || args.nodeIds.length > 100
        || args.nodeIds.some(id => typeof id !== "string" || !id))) throw new Error("nodeIds 必须包含 1–100 个节点 UUID");
    if (args.fields !== undefined && (!Array.isArray(args.fields) || args.fields.length > 100
        || args.fields.some(key => typeof key !== "string" || !key))) throw new Error("fields 必须为最多 100 个属性名");
    if (args.includeFullText !== undefined && typeof args.includeFullText !== "boolean") throw new Error("includeFullText 必须为 boolean");
    if (args.referenceMode !== undefined && !["summary", "structured"].includes(args.referenceMode)) throw new Error("referenceMode 必须为 summary 或 structured");
}
