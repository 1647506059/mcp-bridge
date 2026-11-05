import * as fs from "fs";
import * as path from "path";
import { atomicWrite } from "../utils/AtomicFile";
import { selectToolProfile } from "./ToolProfiles";

const filename = "mcp-tool-presets.json";
export function validateToolPresets(value, tools) {
    if (!value || value.version !== 1 || !Array.isArray(value.presets) || !value.presets.length || value.presets.length > 20) throw new Error("需要 version=1 和 1–20 个工具预设");
    const names = new Set();
    const presets = value.presets.map(item => {
        if (!item || typeof item.name !== "string" || !item.name.trim() || item.name.length > 48 || /[\x00-\x1f]/.test(item.name) || names.has(item.name)) throw new Error("预设名称需要唯一且不超过48字");
        names.add(item.name);
        for (const key of ["enabled", "disabled"]) if (!Array.isArray(item[key]) || item[key].length > 200 || item[key].some(name => typeof name !== "string" || !tools.some(tool => tool.name === name))) throw new Error(`${item.name}: 工具名称无效`);
        const preset: any = { name: item.name, profile: item.profile, enabled: [...new Set(item.enabled)], disabled: [...new Set(item.disabled)], ...(item.actions !== undefined ? { actions: item.actions } : {}) };
        selectToolProfile(tools, presetEnvironment(preset));
        return preset;
    });
    if (!names.has(value.active)) throw new Error("当前预设不存在");
    return { version: 1, active: value.active, presets };
}
function presetEnvironment(item) {
    return { MCP_BRIDGE_TOOL_PROFILE: item.profile, MCP_BRIDGE_ENABLED_TOOLS: item.enabled.join(","), MCP_BRIDGE_DISABLED_TOOLS: item.disabled.join(","), MCP_BRIDGE_TOOL_ACTIONS: JSON.stringify(item.actions || {}) };
}
export function readToolPresets(project, tools) {
    const file = project && path.join(project, "settings", filename);
    if (!file || !fs.existsSync(file)) return { version: 1, active: "全部", presets: [
        { name: "全部", profile: "full", enabled: [], disabled: [] }, { name: "UI", profile: "ui", enabled: [], disabled: [] }] };
    if (fs.statSync(file).size > 128 * 1024) throw new Error("工具预设文件超过128KiB");
    return validateToolPresets(JSON.parse(fs.readFileSync(file, "utf8")), tools);
}
export function saveToolPresets(project, value, tools) {
    const state = validateToolPresets(value, tools);
    const dir = path.join(project, "settings"); fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, filename), previous = fs.existsSync(file) ? fs.readFileSync(file) : undefined;
    atomicWrite(file, JSON.stringify(state, null, 2) + "\n", previous);
    return state;
}
export function configuredTools(project, tools, env = typeof process === "undefined" ? {} : process.env || {}) {
    const state = readToolPresets(project, tools);
    const merged: any = presetEnvironment(state.presets.find(item => item.name === state.active));
    for (const key of Object.keys(merged)) if (env[key] !== undefined) merged[key] = env[key];
    return selectToolProfile(tools, merged);
}
