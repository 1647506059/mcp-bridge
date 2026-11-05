"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallActivity = void 0;
const crypto_1 = require("crypto");
const LogPreview_1 = require("../utils/LogPreview");
/** 显式记录本次工具的执行事件，不接管全局 console，也不混入其他请求日志。 */
class CallActivity {
    static list() { return this.recent.slice(0, 30); }
    static clear() { this.recent = []; }
    constructor(tool, args = {}) {
        this.tool = tool;
        this.callId = "call_" + (0, crypto_1.randomBytes)(10).toString("hex");
        this.receivedAt = Date.now();
        this.startedAt = this.receivedAt;
        CallActivity.totalCalls++;
        this.argumentsPreview = (0, LogPreview_1.formatLogPreview)(args);
    }
    start() { this.startedAt = Date.now(); }
    finish(error, result) {
        if (this.finished)
            return this.finished;
        const timings = { queueWaitMs: this.startedAt - this.receivedAt, executionMs: Date.now() - this.startedAt, totalMs: Date.now() - this.receivedAt };
        const logs = [{ event: "started", tool: this.tool }];
        const steps = this.tool === "batch_execute" ? (Array.isArray(result) ? result : (result === null || result === void 0 ? void 0 : result.results) || []) : [];
        for (const step of steps.slice(0, 48))
            logs.push({ event: "operation", tool: step.tool, id: step.id, ok: !step.error,
                ...(step.error ? { error: (0, LogPreview_1.truncateLogText)(String(step.error), 500) } : {}) });
        logs.push({ event: error ? "failed" : "completed", ...(error ? { error: (0, LogPreview_1.truncateLogText)(String(error.message || error), 1000) } : {}) });
        this.finished = { ok: !error, tool: this.tool, callId: this.callId, timestamp: new Date().toISOString(), timings, logs, logsOmitted: Math.max(0, steps.length - 48),
            ...((result === null || result === void 0 ? void 0 : result.kind) === "mcp-bridge.script.v1" ? { data: result.data, execution: result.execution, truncated: !!result.truncated, pending: !!result.pending } : {}),
            ...((result === null || result === void 0 ? void 0 : result.executedCount) !== undefined ? { executedCount: result.executedCount, nextOperationIndex: result.nextOperationIndex } : {}) };
        CallActivity.recent.unshift({ callId: this.callId, tool: this.tool, ok: !error, at: new Date().toISOString(), timings,
            arguments: this.argumentsPreview, result: (0, LogPreview_1.formatLogPreview)(result), error: error ? (0, LogPreview_1.formatLogPreview)(String(error.message || error)) : null,
            steps: logs.filter(log => log.event === "operation").map(log => ({ tool: log.tool, id: log.id, ok: log.ok, error: log.error ? (0, LogPreview_1.formatLogPreview)(log.error) : undefined })) });
        CallActivity.recent.length = Math.min(100, CallActivity.recent.length);
        return this.finished;
    }
}
exports.CallActivity = CallActivity;
CallActivity.totalCalls = 0;
CallActivity.recent = [];
