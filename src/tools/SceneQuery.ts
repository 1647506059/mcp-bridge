import { createHash } from "crypto";
import { boundedValue } from "../utils/BoundedValue";

export function sceneQuery(args, root, kind: string) {
    const pageSize = args.pageSize ?? 200;
    const maxVisited = args.maxVisited ?? 10000;
    const maxTimeMs = args.maxTimeMs ?? 1000;
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 500) throw new Error("pageSize 必须为 1–500");
    if (!Number.isInteger(maxVisited) || maxVisited < 1 || maxVisited > 50000) throw new Error("maxVisited 必须为 1–50000");
    if (!Number.isInteger(maxTimeMs) || maxTimeMs < 1 || maxTimeMs > 3000) throw new Error("maxTimeMs 必须为 1–3000");
    const hash = createHash("sha256"), started = Date.now();
    const conditions = JSON.stringify([kind, root.uuid, args.scopeNodeId, args.conditions, args.recursive, args.targetId, args.targetType]);
    hash.update(conditions);
    let visited = 0, incomplete = false, work = 0, resultBytes = 0;
    const results = [];
    return {
        results,
        add(result) {
            const limited = boundedValue(result, 8192, 6);
            if (limited.truncated) { incomplete = true; return; }
            resultBytes += Buffer.byteLength(JSON.stringify(limited.value));
            if (resultBytes > 2 * 1024 * 1024) { incomplete = true; return; }
            results.push(limited.value);
        },
        check(node?) {
            work++;
            if (node) {
                visited++; hash.update(JSON.stringify([node.uuid, node.name, node.active, node.children?.map(n => n.uuid), node._components?.map(c => c.uuid)]));
            }
            if (visited > maxVisited || work > maxVisited * 100 || Date.now() - started > maxTimeMs || results.length > 5000) incomplete = true;
            return !incomplete;
        },
        finish() {
            hash.update(JSON.stringify(results));
            const version = hash.digest("hex");
            let offset = 0;
            if (args.cursor) {
                let cursor;
                try { cursor = JSON.parse(args.cursor); } catch (_) { throw new Error("场景游标无效"); }
                if (cursor.version !== version || cursor.conditions !== conditions || !Number.isInteger(cursor.offset) || cursor.offset < 0) throw new Error("场景或查询已变化，请重新查询");
                offset = cursor.offset;
            }
            if (incomplete) throw new Error(`场景扫描预算耗尽（visited=${visited}），请使用 scopeNodeId 缩小范围；未返回完整结果`);
            if (!args.includeMetadata && args.pageSize === undefined && !args.cursor) {
                if (results.length > 500) throw new Error("结果超过500条，请使用 pageSize 与 scopeNodeId 分页查询");
                return results;
            }
            const end = offset + pageSize;
            return { results: results.slice(offset, end), total: results.length, visited,
                nextCursor: end < results.length ? JSON.stringify({ version, conditions, offset: end }) : null, truncated: end < results.length };
        }
    };
}

export function childVersion(scene, node) {
    return createHash("sha256").update(JSON.stringify([scene.uuid, node.uuid, node.children.map(child => child.uuid)])).digest("hex");
}
