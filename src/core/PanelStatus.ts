import { execFile } from "child_process";
import * as path from "path";
import { getRuntimeInfo } from "./BuildInfo";
import { CommandQueue } from "./CommandQueue";
import { CallActivity } from "./CallActivity";
import { getToolsList } from "../tools/ToolRegistry";
import { McpWrappers } from "./McpWrappers";
import { getProjectContext, projectEndpoint } from "./ProjectContext";
import { configuredTools } from "../tools/ToolPresetStore";

function gitValue(projectPath: string, args: string[]): Promise<string> {
    return new Promise(resolve => execFile("git", args, { cwd: projectPath, timeout: 2000, windowsHide: true, maxBuffer: 4096 },
        (err, stdout) => resolve(err ? "—" : stdout.trim())));
}

/** 只读面板快照，不触发资源刷新或场景 IPC。 */
export async function queryPanelStatus(config: { active: boolean; state: string; port: number; host?: string }) {
    const projectPath = Editor.Project.path;
    const [branch, head] = await Promise.all([
        gitValue(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"]),
        gitValue(projectPath, ["rev-parse", "--short", "HEAD"]),
    ]);
    return {
        config: { ...config }, projectPath, engineVersion: Editor.App.version, branch, head,
        editorPid: process.pid, updatedAt: new Date().toISOString(),
        endpoint: config.active ? `http://${(config.host || "127.0.0.1").includes(":") ? "[" + config.host + "]" : config.host || "127.0.0.1"}:${config.port}${projectEndpoint()}` : "",
        projectContext: getProjectContext(),
        cli: `node "${path.join(projectPath, "packages/mcp-bridge/dist/mcp-proxy.js")}" ${config.port}`,
        tools: configuredTools(projectPath, getToolsList()).length, resources: McpWrappers.getResourcesList().length,
        requests: CallActivity.totalCalls, queue: CommandQueue.snapshot(),
        runtime: getRuntimeInfo("editor", __filename),
    };
}
