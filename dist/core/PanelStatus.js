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
exports.queryPanelStatus = queryPanelStatus;
const child_process_1 = require("child_process");
const path = __importStar(require("path"));
const BuildInfo_1 = require("./BuildInfo");
const CommandQueue_1 = require("./CommandQueue");
const CallActivity_1 = require("./CallActivity");
const ToolRegistry_1 = require("../tools/ToolRegistry");
const McpWrappers_1 = require("./McpWrappers");
const ProjectContext_1 = require("./ProjectContext");
const ToolPresetStore_1 = require("../tools/ToolPresetStore");
function gitValue(projectPath, args) {
    return new Promise(resolve => (0, child_process_1.execFile)("git", args, { cwd: projectPath, timeout: 2000, windowsHide: true, maxBuffer: 4096 }, (err, stdout) => resolve(err ? "—" : stdout.trim())));
}
/** 只读面板快照，不触发资源刷新或场景 IPC。 */
async function queryPanelStatus(config) {
    const projectPath = Editor.Project.path;
    const [branch, head] = await Promise.all([
        gitValue(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"]),
        gitValue(projectPath, ["rev-parse", "--short", "HEAD"]),
    ]);
    return {
        config: { ...config }, projectPath, engineVersion: Editor.App.version, branch, head,
        editorPid: process.pid, updatedAt: new Date().toISOString(),
        endpoint: config.active ? `http://${(config.host || "127.0.0.1").includes(":") ? "[" + config.host + "]" : config.host || "127.0.0.1"}:${config.port}${(0, ProjectContext_1.projectEndpoint)()}` : "",
        projectContext: (0, ProjectContext_1.getProjectContext)(),
        cli: `node "${path.join(projectPath, "packages/mcp-bridge/dist/mcp-proxy.js")}" ${config.port}`,
        tools: (0, ToolPresetStore_1.configuredTools)(projectPath, (0, ToolRegistry_1.getToolsList)()).length, resources: McpWrappers_1.McpWrappers.getResourcesList().length,
        requests: CallActivity_1.CallActivity.totalCalls, queue: CommandQueue_1.CommandQueue.snapshot(),
        runtime: (0, BuildInfo_1.getRuntimeInfo)("editor", __filename),
    };
}
