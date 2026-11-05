"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.boundedValue = boundedValue;
/** 在遍历时限量，禁止先完整 stringify 再截断。只读取数据属性，不执行 getter/toJSON。 */
function boundedValue(input, maxBytes = 4096, maxDepth = 6) {
    let remaining = maxBytes, truncated = false;
    const seen = new Set();
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
                const paired = c >= 0xd800 && c <= 0xdbff && value.charCodeAt(end + 1) >= 0xdc00 && value.charCodeAt(end + 1) <= 0xdfff;
                if (paired)
                    width = 4;
                else if (c >= 0xd800 && c <= 0xdfff)
                    width = 6;
                if (size + width + 16 > remaining)
                    break;
                size += width;
                if (paired)
                    end++;
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
            for (let i = 0; i < Math.min(value.length, 1000); i++) {
                if (remaining < 32)
                    break;
                remaining -= 2;
                const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
                if (!descriptor) {
                    remaining -= 4;
                    result.push(null);
                }
                else if ("value" in descriptor)
                    result.push(visit(descriptor.value, depth + 1));
                else {
                    remaining -= 16;
                    result.push("[Accessor]");
                }
            }
            if (result.length < value.length)
                truncated = true;
            seen.delete(value);
            return result;
        }
        let count = 0;
        for (const key in value) {
            if (!Object.prototype.hasOwnProperty.call(value, key))
                continue;
            if (remaining < 32 || ++count > 1000) {
                truncated = true;
                break;
            }
            if (["__proto__", "prototype", "constructor"].includes(key))
                continue;
            if (key.length * 6 + 6 > remaining) {
                truncated = true;
                break;
            }
            remaining -= key.length * 6 + 6;
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            if (descriptor && "value" in descriptor)
                result[key] = visit(descriptor.value, depth + 1);
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
