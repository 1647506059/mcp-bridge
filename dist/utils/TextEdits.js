"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyValidatedEdits = applyValidatedEdits;
/** 所有偏移均基于原文的 UTF-16 索引；整批校验后一次生成结果。 */
function applyValidatedEdits(source, edits) {
    if (!Array.isArray(edits) || !edits.length)
        throw new Error("edits 必须是非空数组");
    const checkOffset = (value, label) => {
        if (!Number.isInteger(value) || value < 0 || value > source.length)
            throw new Error(`${label} 必须是原文范围内的整数偏移`);
        if (value > 0 && value < source.length && source.charCodeAt(value - 1) >= 0xd800 && source.charCodeAt(value - 1) <= 0xdbff
            && source.charCodeAt(value) >= 0xdc00 && source.charCodeAt(value) <= 0xdfff)
            throw new Error(`${label} 不能切开 Unicode 代理对`);
    };
    const ranges = edits.map((edit, i) => {
        if (!edit || !["insert", "delete", "replace"].includes(edit.type))
            throw new Error(`编辑 ${i}: 未知操作类型`);
        const start = edit.type === "insert" ? edit.position : edit.start;
        const end = edit.type === "insert" ? start : edit.end;
        checkOffset(start, `编辑 ${i}.start/position`);
        checkOffset(end, `编辑 ${i}.end`);
        if (end < start)
            throw new Error(`编辑 ${i}: end 不能小于 start`);
        if (edit.type !== "delete" && typeof edit.text !== "string")
            throw new Error(`编辑 ${i}: text 必须为字符串`);
        return { start, end, text: edit.type === "delete" ? "" : edit.text, index: i };
    }).sort((a, b) => a.start - b.start || a.end - b.end);
    for (let i = 1; i < ranges.length; i++) {
        const a = ranges[i - 1], b = ranges[i];
        if (b.start < a.end || b.start === a.start)
            throw new Error(`编辑 ${a.index} 和 ${b.index} 范围重叠或起点冲突`);
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
