"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CommandQueue = void 0;
const Logger_1 = require("./Logger");
class CommandQueue {
    static recordError(tool, error) { this.lastError = { tool, message: String(error.message || error), at: Date.now() }; }
    static snapshot() {
        const now = Date.now();
        return { processing: this.isProcessingCommand, pending: this.pendingSceneCalls, blockedReason: this.blockedReason,
            waiting: this.commandQueue.length, oldestQueueAgeMs: this.commandQueue.length ? now - this.commandQueue[0].queuedAt : 0,
            current: this.current ? { ...this.current, executionMs: now - this.current.startedAt } : null, last: this.last, lastError: this.lastError };
    }
    static blockPending(reason) {
        var _a;
        CommandQueue.blockedReason = reason;
        CommandQueue.recordError(((_a = CommandQueue.current) === null || _a === void 0 ? void 0 : _a.tool) || "pending", reason);
        const waiting = CommandQueue.commandQueue.splice(0);
        waiting.forEach(item => item.reject(new Error(reason + "；等待中的指令未执行")));
    }
    static getBlockedReason() { return CommandQueue.blockedReason; }
    /** 跟踪没有 IPC 完成回执的编辑器操作，完成确认前不释放队列。 */
    static trackEditorOperation() {
        CommandQueue.pendingSceneCalls++;
        let finished = false;
        return () => {
            if (finished)
                return;
            finished = true;
            CommandQueue.pendingSceneCalls--;
            if (CommandQueue.deferredDone)
                CommandQueue.deferredDone();
        };
    }
    /**
     * 将一个异步操作加入队列，保证串行执行
     * @param {Function} fn 接受 done 回调的函数，fn(done) 中操作完成后必须调用 done()
     * @returns {Promise} 操作完成后 resolve
     */
    static enqueue(fn, onTimeout, tool = "unknown") {
        if (CommandQueue.blockedReason)
            return Promise.reject(new Error(CommandQueue.blockedReason));
        if (CommandQueue.commandQueue.length >= CommandQueue.MAX_QUEUE_LENGTH) {
            Logger_1.Logger.warn(`[CommandQueue] 指令队列已满（${CommandQueue.MAX_QUEUE_LENGTH}），拒绝新请求`);
            return Promise.reject("队列已满，请稍后重试");
        }
        return new Promise((resolve, reject) => {
            CommandQueue.commandQueue.push({ fn, resolve, reject, onTimeout, tool, queuedAt: Date.now() });
            CommandQueue.processNext();
        });
    }
    static processNext() {
        if (CommandQueue.isProcessingCommand || CommandQueue.commandQueue.length === 0)
            return;
        CommandQueue.isProcessingCommand = true;
        const { fn, resolve, onTimeout, tool, queuedAt } = CommandQueue.commandQueue.shift();
        CommandQueue.current = { tool, queuedAt, startedAt: Date.now(), queueWaitMs: Date.now() - queuedAt };
        let completed = false;
        // 只计算真正执行的时间。超时不能取消编辑器写入，必须等真实回调后才能恢复。
        const timeoutId = setTimeout(() => {
            CommandQueue.blockPending("前序指令执行超时且尚未结束，请等待其完成或重载插件");
            Logger_1.Logger.error("[CommandQueue] 指令执行超时(60s)，已暂停后续指令");
            try {
                if (onTimeout)
                    onTimeout();
            }
            finally {
                resolve();
            }
        }, 60000);
        const done = () => {
            if (completed)
                return;
            if (CommandQueue.pendingSceneCalls > 0) {
                CommandQueue.deferredDone = done;
                resolve();
                return;
            }
            completed = true;
            CommandQueue.last = { ...CommandQueue.current, completedAt: Date.now() };
            CommandQueue.current = null;
            clearTimeout(timeoutId);
            CommandQueue.deferredDone = null;
            CommandQueue.blockedReason = "";
            CommandQueue.isProcessingCommand = false;
            resolve();
            CommandQueue.processNext();
        };
        try {
            fn(done);
        }
        catch (e) {
            clearTimeout(timeoutId);
            try {
                Logger_1.Logger.error(`[CommandQueue] 指令执行异常: ${e && e.stack ? e.stack : e}`);
            }
            catch (_logErr) {
                // 日志通道异常时仍须释放队列，避免后续指令全部卡死
            }
            done();
        }
    }
    /**
     * 获取当前队列长度
     */
    static getLength() {
        return CommandQueue.commandQueue.length;
    }
    /**
     * 带超时保护的 callSceneScript 包装
     */
    static callSceneScriptWithTimeout(pluginName, method, args, callback, timeout = 15000) {
        let settled = false;
        let replied = false;
        CommandQueue.pendingSceneCalls++;
        const timer = setTimeout(() => {
            if (!settled) {
                settled = true;
                CommandQueue.blockPending(`场景操作超时且尚未结束: ${method}，请等待其完成或重载插件`);
                Logger_1.Logger.error(`[超时] callSceneScript "${method}" 超过 ${timeout}ms 未响应`);
                callback(`操作超时: ${method} (${timeout}ms)`);
            }
        }, timeout);
        const wrappedCallback = (err, result) => {
            if (replied)
                return;
            replied = true;
            CommandQueue.pendingSceneCalls--;
            if (!settled) {
                settled = true;
                clearTimeout(timer);
                if (err && typeof err === "object" && err.message && err.message.includes("panel not found")) {
                    const friendlyMsg = `场景面板尚未就绪（可能正在重载插件或切换场景），请等待几秒后重试。原始信息: ${err.message}`;
                    Logger_1.Logger.warn(`[scene-script] ${friendlyMsg}`);
                    callback(friendlyMsg);
                }
                else if (err && typeof err === "string" && err.includes("panel not found")) {
                    const friendlyMsg = `场景面板尚未就绪（可能正在重载插件或切换场景），请等待几秒后重试。原始信息: ${err}`;
                    Logger_1.Logger.warn(`[scene-script] ${friendlyMsg}`);
                    callback(friendlyMsg);
                }
                else {
                    callback(err, result);
                }
            }
            else if (CommandQueue.deferredDone) {
                CommandQueue.deferredDone();
            }
        };
        try {
            if (args === null || args === undefined) {
                Editor.Scene.callSceneScript(pluginName, method, wrappedCallback);
            }
            else {
                Editor.Scene.callSceneScript(pluginName, method, args, wrappedCallback);
            }
        }
        catch (err) {
            wrappedCallback(err, null);
        }
    }
}
exports.CommandQueue = CommandQueue;
CommandQueue.current = null;
CommandQueue.last = null;
CommandQueue.lastError = null;
CommandQueue.MAX_QUEUE_LENGTH = 100;
CommandQueue.commandQueue = [];
CommandQueue.isProcessingCommand = false;
CommandQueue.blockedReason = "";
CommandQueue.pendingSceneCalls = 0;
CommandQueue.deferredDone = null;
