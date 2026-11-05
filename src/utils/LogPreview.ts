/** 日志只遍历有限字段，避免为了截短展示而先序列化整个大参数。 */
export function truncateLogText(text: string, limit = 4096): string {
    if (text.length <= limit) return text;
    let end = limit;
    if (/[\uD800-\uDBFF]/.test(text[end - 1])) end--;
    return text.slice(0, end) + `...[length:${text.length}]`;
}

export function formatLogPreview(value: any): string {
    const seen = new Set();
    const sanitize = text => text.replace(/data:[^\s"']+/gi, "[omitted]").replace(/\bBearer\s+[^\s"',;]+/gi, "Bearer [redacted]")
        .replace(/((?:password|secret|token|api[_-]?key|authorization)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^,\s;}]+)/gi, "$1[redacted]");
    const visit = (item, depth) => {
        if (typeof item === "string") return truncateLogText(sanitize(item), 256);
        if (typeof item === "function" || typeof item === "symbol") return undefined;
        if (item === null || typeof item !== "object") return typeof item === "bigint" ? String(item) : item;
        if (seen.has(item)) return "[Circular]";
        if (depth === 0) return Array.isArray(item) ? `[Array(${item.length})]` : "[Object]";
        seen.add(item);
        const result: any = Array.isArray(item) ? [] : Object.create(null);
        if (Array.isArray(item)) for (let index = 0; index < Math.min(8, item.length); index++) {
            const descriptor = Object.getOwnPropertyDescriptor(item, String(index));
            result.push(descriptor && "value" in descriptor ? visit(descriptor.value, depth - 1) : "[Getter]");
        }
        if (!Array.isArray(item)) {
            let count = 0;
            for (const key in item) {
                if (!Object.prototype.hasOwnProperty.call(item, key)) continue;
                if (count++ === 12) break;
                if (/password|secret|token|authorization|credential|cookie|api.?key/i.test(key)) { result[truncateLogText(key, 64)] = "[redacted]"; continue; }
                if (/^(content|contents|code|script|source|stdout|stderr|base64|buffer|dataUrl)$/i.test(key)) { result[key] = "[omitted]"; continue; }
                const descriptor = Object.getOwnPropertyDescriptor(item, key);
                result[truncateLogText(key, 64)] = descriptor && "value" in descriptor ? visit(descriptor.value, depth - 1) : "[Getter]";
            }
        } else if (item.length > 8) result.push(`[+${item.length - 8} items]`);
        return result;
    };
    try { return truncateLogText(JSON.stringify(visit(value, 3)) || String(value), 2048); }
    catch (_) { return "[无法生成日志摘要]"; }
}
