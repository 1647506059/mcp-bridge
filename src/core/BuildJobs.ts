import * as crypto from "crypto";

/** 构建 IPC 接受请求与最终完成分开，禁止把 accepted 当成成功。 */
export class BuildJobs {
    private static jobs = new Map<string, any>();
    static begin(details) {
        if ([...this.jobs.values()].some(job => job.status === "building")) throw new Error("已有构建运行中，请查询原 jobId，不能重复提交");
        while (this.jobs.size >= 32) this.jobs.delete(this.jobs.keys().next().value);
        const job = { jobId: crypto.randomBytes(12).toString("hex"), ...details, status: "building", completed: false, startedAt: new Date().toISOString() };
        this.jobs.set(job.jobId, job);
        return { ...job };
    }
    static finish(id, err, result) {
        const job = this.jobs.get(id);
        if (!job || job.completed) return;
        Object.assign(job, { status: err ? "failed" : "succeeded", completed: true,
            error: err ? String(err.message || err) : null, result, finishedAt: new Date().toISOString() });
    }
    static get(id) {
        const job = this.jobs.get(id);
        if (!job) throw new Error("找不到构建 jobId；任务只在当前插件进程中保留，插件重载后结果未知，勿自动重建");
        return { ...job };
    }
}
