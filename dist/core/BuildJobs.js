"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BuildJobs = void 0;
const crypto = __importStar(require("crypto"));
/** 构建 IPC 接受请求与最终完成分开，禁止把 accepted 当成成功。 */
class BuildJobs {
    static begin(details) {
        if ([...this.jobs.values()].some(job => job.status === "building"))
            throw new Error("已有构建运行中，请查询原 jobId，不能重复提交");
        while (this.jobs.size >= 32)
            this.jobs.delete(this.jobs.keys().next().value);
        const job = { jobId: crypto.randomBytes(12).toString("hex"), ...details, status: "building", completed: false, startedAt: new Date().toISOString() };
        this.jobs.set(job.jobId, job);
        return { ...job };
    }
    static finish(id, err, result) {
        const job = this.jobs.get(id);
        if (!job || job.completed)
            return;
        Object.assign(job, { status: err ? "failed" : "succeeded", completed: true,
            error: err ? String(err.message || err) : null, result, finishedAt: new Date().toISOString() });
    }
    static get(id) {
        const job = this.jobs.get(id);
        if (!job)
            throw new Error("找不到构建 jobId；任务只在当前插件进程中保留，插件重载后结果未知，勿自动重建");
        return { ...job };
    }
}
exports.BuildJobs = BuildJobs;
BuildJobs.jobs = new Map();
