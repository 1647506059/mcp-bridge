import * as http from "http";
import { StringDecoder } from "string_decoder";

export const MAX_REQUEST_BYTES = 5 * 1024 * 1024;
export const MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
export const FORWARD_TIMEOUT_MS = 90000;

/** 按字节限流，并保留跨数据块的 UTF-8 字符；中断和迟到事件只结算一次。 */
export function readUtf8Body(stream, maxBytes: number, callback: (err: Error | null, body?: string) => void) {
    const decoder = new StringDecoder("utf8");
    let parts: string[] = [], size = 0, settled = false;
    const finish = (err: Error | null) => {
        if (settled) return;
        settled = true;
        const body = err ? undefined : parts.join("") + decoder.end();
        parts = [];
        callback(err, body);
    };
    stream.on("data", chunk => {
        if (settled) return;
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > maxBytes) {
            const err: any = new Error(`HTTP 消息超过 ${maxBytes} 字节上限`);
            err.code = "ETOOBIG";
            finish(err);
        } else parts.push(decoder.write(bytes));
    });
    stream.on("end", () => finish(null));
    stream.on("error", err => finish(err));
    stream.on("aborted", () => finish(new Error("HTTP 消息接收中断")));
    stream.on("close", () => { if (!settled) finish(new Error("HTTP 连接在消息完成前关闭")); });
    return () => { settled = true; parts = []; };
}

/** 请求截止时间包含连接和完整响应；超时只报告结果未确认，不重放编辑器写入。 */
export function requestJson(options: http.RequestOptions, payload: string, callback: (err: Error | null, result?: any) => void) {
    let settled = false, cancelRead: (() => void) | undefined;
    let request: http.ClientRequest;
    const finish = (err: Error | null, result?) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (cancelRead) cancelRead();
        callback(err, result);
    };
    const timeout = () => {
        if (settled) return;
        finish(new Error("Cocos HTTP 请求超时，操作结果未确认；如涉及写入，请先读回结果，不要直接重试"));
        if (request) request.destroy();
    };
    const timer = setTimeout(timeout, options.timeout || FORWARD_TIMEOUT_MS);
    try {
        request = http.request(options, res => {
            cancelRead = readUtf8Body(res, MAX_RESPONSE_BYTES, (err, body) => {
                if (err) { finish(err); if (request) request.destroy(); return; }
                let parsed;
                try { parsed = JSON.parse(body); }
                catch (e) { finish(new Error(`Cocos 返回非 JSON 数据 (HTTP ${res.statusCode})`)); return; }
                if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) { finish(new Error("Cocos HTTP 响应必须是 JSON 对象")); return; }
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    finish(new Error(`Cocos HTTP ${res.statusCode}: ${parsed.error || parsed.message || "请求失败"}`));
                } else finish(null, parsed);
            });
        });
        request.on("error", err => finish(err));
        request.on("timeout", timeout);
        if (payload) request.write(payload);
        request.end();
    } catch (err) { finish(err); if (request) request.destroy(); }
}
