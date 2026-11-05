import { randomBytes } from "crypto";
import { truncateLogText, formatLogPreview } from "../utils/LogPreview";

/** 显式记录本次工具的执行事件，不接管全局 console，也不混入其他请求日志。 */
export class CallActivity {
    public static totalCalls = 0;
    private static recent: any[] = [];
    public static list() { return this.recent.slice(0, 30); }
    public static clear() { this.recent = []; }
    readonly callId = "call_" + randomBytes(10).toString("hex");
    private receivedAt = Date.now();
    private startedAt = this.receivedAt;
    private argumentsPreview: string;
    private finished: any;
    constructor(private tool: string, args: any = {}) { CallActivity.totalCalls++; this.argumentsPreview = formatLogPreview(args); }
    start() { this.startedAt = Date.now(); }
    finish(error, result) {
        if (this.finished) return this.finished;
        const timings = { queueWaitMs: this.startedAt - this.receivedAt, executionMs: Date.now() - this.startedAt, totalMs: Date.now() - this.receivedAt };
        const logs: any[] = [{ event: "started", tool: this.tool }];
        const steps = this.tool === "batch_execute" ? (Array.isArray(result) ? result : result?.results || []) : [];
        for (const step of steps.slice(0, 48)) logs.push({ event: "operation", tool: step.tool, id: step.id, ok: !step.error,
            ...(step.error ? { error: truncateLogText(String(step.error), 500) } : {}) });
        logs.push({ event: error ? "failed" : "completed", ...(error ? { error: truncateLogText(String(error.message || error), 1000) } : {}) });
        this.finished = { ok: !error, tool: this.tool, callId: this.callId, timestamp: new Date().toISOString(), timings, logs, logsOmitted: Math.max(0, steps.length - 48),
            ...(result?.kind === "mcp-bridge.script.v1" ? { data: result.data, execution: result.execution, truncated: !!result.truncated, pending: !!result.pending } : {}),
            ...(result?.executedCount !== undefined ? { executedCount: result.executedCount, nextOperationIndex: result.nextOperationIndex } : {}) };
        CallActivity.recent.unshift({ callId: this.callId, tool: this.tool, ok: !error, at: new Date().toISOString(), timings,
            arguments: this.argumentsPreview, result: formatLogPreview(result), error: error ? formatLogPreview(String(error.message || error)) : null,
            steps: logs.filter(log => log.event === "operation").map(log => ({ tool: log.tool, id: log.id, ok: log.ok, error: log.error ? formatLogPreview(log.error) : undefined })) });
        CallActivity.recent.length = Math.min(100, CallActivity.recent.length);
        return this.finished;
    }
}
