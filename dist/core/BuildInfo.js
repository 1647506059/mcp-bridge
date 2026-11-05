"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BUILD_INFO = void 0;
exports.getRuntimeInfo = getRuntimeInfo;
exports.composeDiagnostics = composeDiagnostics;
// 构建时嵌入各入口；进程启动后不重新读取 dist 清单，避免旧进程误报成新版本。
exports.BUILD_INFO = Object.freeze(typeof __MCP_BRIDGE_BUILD__ === "undefined"
    ? { version: "unbundled", buildId: "unbundled", builtAt: null } : __MCP_BRIDGE_BUILD__);
const loadedAt = new Date().toISOString();
function getRuntimeInfo(role, entryPath) {
    return { ...exports.BUILD_INFO, role, pid: process.pid, loadedAt, entryPath };
}
function composeDiagnostics(editor, scene, proxy, sceneError) {
    const runtimes = { editor: editor || null, scene: scene || null, proxy: proxy || null };
    const issues = [];
    for (const role of Object.keys(runtimes)) {
        if (!runtimes[role])
            issues.push(`${role}: runtime information unavailable`);
        else if (!runtimes[role].buildId || runtimes[role].buildId === "unbundled")
            issues.push(`${role}: no embedded build identity`);
    }
    if (sceneError)
        issues.push(`scene: ${sceneError}`);
    const identified = Object.keys(runtimes).filter(role => { var _a; return ((_a = runtimes[role]) === null || _a === void 0 ? void 0 : _a.buildId) && runtimes[role].buildId !== "unbundled"; });
    const mismatch = new Set(identified.map(role => runtimes[role].buildId)).size > 1;
    if (mismatch)
        issues.push("Loaded builds differ; restart the proxy and reload the Creator plugin/scene script");
    return { ...runtimes, status: mismatch ? "mismatch" : issues.length ? "incomplete" : "matched", issues };
}
