"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EditorInput = exports.EditorInputController = void 0;
const crypto_1 = require("crypto");
const perf_hooks_1 = require("perf_hooks");
const EditorScreenshot_1 = require("./EditorScreenshot");
const ProjectContext_1 = require("../core/ProjectContext");
/** 复用截图凭证；仅证明 Electron 收到事件，不声称 Game View 或玩法接受输入。 */
class EditorInputController {
    constructor(env) {
        this.env = env;
        this.jobs = new Map();
        this.active = null;
    }
    isBusy() { return !!this.active; }
    receipt(job) {
        return { jobId: job.id, requestKey: job.key, state: job.state, eventsSent: job.eventsSent,
            error: job.error || null, releasePending: !!job.held, target: "editor-main-window",
            nativeGameUpdateVerified: false, businessOutcomeVerified: false, projectContext: (0, ProjectContext_1.getProjectContext)() };
    }
    release(job) {
        var _a, _b, _c, _d;
        if (!job.held)
            return;
        if (((_b = (_a = job.win).isDestroyed) === null || _b === void 0 ? void 0 : _b.call(_a)) || ((_d = (_c = job.win.webContents).isDestroyed) === null || _d === void 0 ? void 0 : _d.call(_c))) {
            job.held = false;
            job.error = job.error || "目标窗口已销毁，旧输入已终止";
            return;
        }
        this.send(job, "mouseUp", job.last, false);
        job.held = false;
    }
    send(job, type, point, held) {
        const bounds = job.win.getContentBounds();
        job.win.webContents.sendInputEvent({ type, x: Math.round(point.x), y: Math.round(point.y),
            globalX: Math.round(bounds.x + point.x), globalY: Math.round(bounds.y + point.y),
            button: "left", clickCount: 1, modifiers: held ? ["leftButtonDown"] : [] });
        job.eventsSent++;
        job.last = point;
    }
    check(job) {
        var _a, _b, _c, _d, _e, _f;
        if (job.cancelled)
            throw new Error("输入已取消");
        if (((_b = (_a = job.win).isDestroyed) === null || _b === void 0 ? void 0 : _b.call(_a)) || ((_d = (_c = job.win.webContents).isDestroyed) === null || _d === void 0 ? void 0 : _d.call(_c)) || !((_f = (_e = job.win).isFocused) === null || _f === void 0 ? void 0 : _f.call(_e)))
            throw new Error("目标编辑器窗口未处于前台");
        this.env.resolve(job.coordinates);
    }
    async frame(job) {
        this.check(job);
        let timer;
        try {
            await Promise.race([this.env.frame(job.win), new Promise((_, reject) => {
                    timer = setTimeout(() => reject(new Error("目标渲染帧等待超时")), 1500);
                })]);
        }
        finally {
            clearTimeout(timer);
        }
        this.check(job);
    }
    async hold(job, ms) {
        const start = this.env.now();
        do {
            await this.frame(job);
        } while (this.env.now() - start < ms);
    }
    async run(job) {
        try {
            this.check(job);
            this.send(job, "mouseMove", job.start, false);
            // 即使底层发送抛错也尝试释放，避免留下按住状态。
            job.held = true;
            this.send(job, "mouseDown", job.start, true);
            await this.hold(job, job.args.pressHoldMs);
            if (job.tool === "simulate_mouse_drag") {
                const start = this.env.now();
                let progress = 0;
                while (progress < 1) {
                    await this.frame(job);
                    progress = Math.min(1, (this.env.now() - start) / job.args.durationMs);
                    this.send(job, "mouseMove", { x: job.start.x + (job.end.x - job.start.x) * progress,
                        y: job.start.y + (job.end.y - job.start.y) * progress }, true);
                }
            }
            await this.hold(job, job.args.endHoldMs);
            this.release(job);
            job.state = "completed";
        }
        catch (err) {
            job.error = err.message;
            job.state = job.cancelled ? "cancelled" : "failed";
            try {
                this.release(job);
            }
            catch (releaseError) {
                job.error += "; 松键失败: " + releaseError.message;
            }
        }
        finally {
            job.finished = true;
            if (!job.held && this.active === job)
                this.active = null;
            this.env.invalidate();
        }
    }
    async execute(tool, args) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        const action = args.action || "start";
        if (!["start", "status", "cancel"].includes(action))
            throw new Error("action 必须是 start/status/cancel");
        const existing = args.jobId ? [...this.jobs.values()].find(job => job.id === args.jobId) : this.jobs.get(args.requestKey);
        if (existing && args.requestKey !== undefined && args.requestKey !== existing.key)
            throw new Error("jobId 与 requestKey 不匹配");
        if (action !== "start") {
            if (!existing || existing.tool !== tool)
                throw new Error("输入回执不存在或属于另一个工具；请检查实际状态，不要自动重放");
            if (args.requestKey !== undefined && args.requestKey !== existing.key)
                throw new Error("jobId 与 requestKey 不匹配");
            if (action === "cancel") {
                existing.cancelled = true;
                try {
                    this.release(existing);
                }
                catch (err) {
                    existing.error = "松键失败: " + err.message;
                }
                if (existing.finished && !existing.held && this.active === existing) {
                    this.active = null;
                    this.env.invalidate();
                }
                if (existing.state === "running")
                    existing.state = "cancelled";
            }
            return this.receipt(existing);
        }
        if (typeof args.requestKey !== "string" || !args.requestKey || args.requestKey.length > 128)
            throw new Error("start 需要 1–128 字符的唯一 requestKey");
        const normalized = { ...args, action: "start", durationMs: (_a = args.durationMs) !== null && _a !== void 0 ? _a : 600,
            pressHoldMs: (_b = args.pressHoldMs) !== null && _b !== void 0 ? _b : 100, endHoldMs: (_c = args.endHoldMs) !== null && _c !== void 0 ? _c : 100 };
        const signature = JSON.stringify([tool, args.captureId, (_d = args.start) === null || _d === void 0 ? void 0 : _d.x, (_e = args.start) === null || _e === void 0 ? void 0 : _e.y, (_f = args.end) === null || _f === void 0 ? void 0 : _f.x, (_g = args.end) === null || _g === void 0 ? void 0 : _g.y, normalized.durationMs, normalized.pressHoldMs, normalized.endHoldMs]);
        if (existing) {
            if (existing.signature !== signature || existing.tool !== tool)
                throw new Error("requestKey 已用于不同的输入参数");
            return this.receipt(existing);
        }
        for (const [name, min, max] of [["durationMs", 50, 10000], ["pressHoldMs", 0, 2000], ["endHoldMs", 0, 2000], ["waitMs", 0, 2000]]) {
            const value = name === "waitMs" ? (_h = args.waitMs) !== null && _h !== void 0 ? _h : 1200 : normalized[name];
            if (!Number.isFinite(value) || value < min || value > max)
                throw new Error(name + " 超出允许范围");
        }
        if (this.active)
            throw new Error("窗口存在尚未结束或未释放的输入；请先查询或取消原任务");
        const coordinates = { captureId: args.captureId, points: [args.start, tool === "simulate_mouse_drag" ? args.end : args.start] };
        const points = this.env.resolve(coordinates).points;
        const win = this.env.window();
        if (typeof ((_j = win === null || win === void 0 ? void 0 : win.webContents) === null || _j === void 0 ? void 0 : _j.sendInputEvent) !== "function" || typeof ((_k = win === null || win === void 0 ? void 0 : win.webContents) === null || _k === void 0 ? void 0 : _k.executeJavaScript) !== "function")
            throw new Error("此 Creator 窗口不支持原生输入/渲染帧接口");
        const job = { id: "input_" + (0, crypto_1.randomBytes)(12).toString("hex"), key: args.requestKey, signature, tool,
            args: normalized, coordinates, win, start: points[0].windowContent, end: points[1].windowContent,
            last: points[0].windowContent, state: "running", eventsSent: 0, held: false, cancelled: false };
        this.jobs.set(job.key, job);
        this.active = job;
        while (this.jobs.size > 32) {
            const oldest = [...this.jobs.values()].find(row => row !== this.active && row.state !== "running");
            if (!oldest)
                break;
            this.jobs.delete(oldest.key);
        }
        const done = this.run(job);
        let timer;
        try {
            await Promise.race([done, new Promise(resolve => { var _a; timer = setTimeout(resolve, (_a = args.waitMs) !== null && _a !== void 0 ? _a : 1200); })]);
        }
        finally {
            clearTimeout(timer);
        }
        return this.receipt(job);
    }
    shutdown() {
        for (const job of this.jobs.values()) {
            if (job.state !== "running" && !job.held)
                continue;
            job.cancelled = true;
            job.state = "cancelled";
            try {
                this.release(job);
            }
            catch (err) {
                job.error = err.message;
            }
        }
    }
}
exports.EditorInputController = EditorInputController;
exports.EditorInput = new EditorInputController({
    window: () => Editor.Window.main.nativeWin,
    resolve: args => EditorScreenshot_1.EditorScreenshot.resolveCoordinates(args),
    now: () => perf_hooks_1.performance.now(),
    frame: win => win.webContents.executeJavaScript("new Promise(resolve => requestAnimationFrame(() => resolve(performance.now())))", true),
    invalidate: () => EditorScreenshot_1.EditorScreenshot.invalidate(),
});
