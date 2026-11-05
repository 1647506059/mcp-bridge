import { validateExposedCall } from "./tools/ToolValidation";
import { projectIdentity, normalizeProjectPath, mutatesProject } from "./core/ProjectContext";
/**
 * MCP 桥接代理脚本
 * 负责在标准 MCP 客户端 (stdin/stdout) 与 Cocos Creator 插件 (HTTP) 之间转发请求。
 * 内建离线场景/预制体编辑能力，无需 Cocos Creator 运行即可修改 .prefab/.fire 文件。
 */

import * as http from "http";
import * as pathModule from "path";
import * as fs from "fs";
import * as readline from "readline";
import { OfflinePrefabEditor } from "./utils/OfflinePrefabEditor";
import { BUILD_INFO, getRuntimeInfo, composeDiagnostics } from "./core/BuildInfo";
import { requestJson, FORWARD_TIMEOUT_MS } from "./utils/HttpTransport";
import { getToolsList } from "./tools/ToolRegistry";
import { configuredTools } from "./tools/ToolPresetStore";
import {
	collectScanPorts,
	readLastPortFromSettings,
	resolveProjectRootFromProxyDir,
} from "./utils/proxyDiscovery";

/**
 * 当前 Cocos Creator 插件监听的端口
 * 支持通过环境变量 MCP_BRIDGE_PORT 或命令行参数指定端口
 * @type {number}
 */
const COCOS_PORT = parseInt(process.env.MCP_BRIDGE_PORT || process.argv[2] || "8200", 10);
let globalActivePort: number | null = null;
let activeProjectPath: string | null = null;
let activeInstancePin: string | null = null;
const routingStats = { statusProbes: 0, fullScans: 0, monitorProbes: 0, coalescedProbes: 0, monitorDelayMs: 5000, lastRoute: "unbound" };
const pendingProbes = new Map<number, Promise<Instance | null>>();
let scanInFlight: Promise<Instance[]> | null = null;
let lastActivity = Date.now(), offlineRounds = 0, monitorRound = 0;
const START_PORT = 8200;
const END_PORT = 8210;

/** 从扫描到的实例缓存的项目物理路径，用于 db:// URL → 绝对路径 转换 */
const configuredProjectPath = process.env.MCP_BRIDGE_PROJECT_PATH || null;
const COCOS_HOST = process.env.MCP_BRIDGE_HOST || "127.0.0.1";
let cachedProjectPath: string | null = configuredProjectPath;

/** 项目级代理：从本插件 dist 回溯工程根，便于读取 last-port */
const bundledProjectRoot = resolveProjectRootFromProxyDir(__dirname);
if (!cachedProjectPath && bundledProjectRoot) {
	cachedProjectPath = bundledProjectRoot;
}

/**
 * 默认 8200–8210，再加上 MCP_BRIDGE_PORT / 项目 settings 的 last-port。
 * 本工程 last-port 仍是旧默认 3456，只扫 8200 会把已启动的插件当成未激活。
 */
function getScanPorts(): number[] {
	const extras: number[] = [];
	if (COCOS_PORT) extras.push(COCOS_PORT);
	if (globalActivePort) extras.push(globalActivePort);
	const projectRoot = bundledProjectRoot || cachedProjectPath;
	if (projectRoot) {
		try {
			const raw = fs.readFileSync(pathModule.join(projectRoot, "settings", "mcp-bridge.json"), "utf8");
			const lastPort = readLastPortFromSettings(raw);
			if (lastPort) extras.push(lastPort);
		} catch {
			// 无 settings 时仍扫默认范围
		}
	}
	return collectScanPorts(START_PORT, END_PORT, extras);
}

// ── 离线工具定义 ──────────────────────────────────────────────────────────

const operationsSchema = {
	type: "array",
	items: {
		type: "object",
		properties: {
			action: {
				type: "string",
				enum: [
					"update_property", "add_component", "remove_component",
					"add_node", "remove_node", "clone_node",
					"reorder_child", "set_reference"
				]
			},
			targetPath: { type: "string", description: "节点相对根节点的查找路径" },
			componentType: { type: "string", description: "组件类名，如 'cc.Label'" },
			properties: { type: "object", description: "属性键值对" },
			nodeName: { type: "string", description: "新节点或克隆后节点的名称" },
			newParentPath: { type: "string", description: "克隆节点要挂载的父节点路径" },
			childOrder: { type: "array", items: { type: "string" }, description: "子节点名称排序数组" },
			propertyName: { type: "string", description: "要绑定引用的组件属性名。支持数组索引语法如 clickEvents[0].target" },
			elementType: { type: "string", description: "数组元素类型，用于自动创建嵌套数组中的引用对象（如 cc.ClickEvent）。与 propertyName 的数组索引语法配合使用" },
			referenceValue: {
				type: "object",
				description: "绑定的引用的目标值",
				properties: {
					uuid: { type: "string", description: "外部资源的 UUID" },
					path: { type: "string", description: "内部节点路径" },
					componentType: { type: "string", description: "特定组件类名" }
				}
			}
		},
		required: ["action"]
	}
};

const OFFLINE_TOOLS = [
	{
		name: "modify_prefab_offline",
		description: `【离线高效预制体修改】在不打开编辑器预制体窗口的情况下，直接通过底层的 JSON 结构修改预制体数据，并刷新 AssetDB。支持 update_property, add_component, remove_component, add_node, remove_node, clone_node, reorder_child, set_reference 操作。如果预制体文件本身不存在且第一个基动作为 add_node 且 targetPath 为空，则工具将无中生有自动初始化空预制体。`,
		inputSchema: {
			type: "object",
			properties: {
				prefabUrl: { type: "string", description: "预制体在项目中的相对路径，如 db://assets/prefabs/MyPrefab.prefab" },
				operations: operationsSchema
			},
			required: ["prefabUrl", "operations"]
		}
	},
	{
		name: "modify_scene_offline",
		description: `【离线高效场景修改】在不打开编辑器场景窗口的情况下，直接通过底层的 JSON 结构修改场景数据，并刷新 AssetDB。支持 update_property, add_component, remove_component, add_node, remove_node, clone_node, reorder_child, set_reference 操作。与 modify_prefab_offline 共享完全相同的 operations 参数结构。如果场景文件不存在且第一个操作为 add_node 且 targetPath 为空，则自动创建空场景。注意：场景中新增的节点不会携带 PrefabInfo。`,
		inputSchema: {
			type: "object",
			properties: {
				sceneUrl: { type: "string", description: "场景在项目中的相对路径，如 db://assets/scenes/MyScene.fire" },
				operations: operationsSchema
			},
			required: ["sceneUrl", "operations"]
		}
	}
];
const OFFLINE_TOOL_NAMES = new Set(OFFLINE_TOOLS.map(t => t.name));
// 与编辑器使用同一份本地目录，启动顺序和多实例状态不再影响工具注册。
const ALL_PROXY_TOOLS = [
    ...OFFLINE_TOOLS,
    ...getToolsList().filter(tool => !OFFLINE_TOOL_NAMES.has(tool.name)),
    {
        name: "get_active_instances",
        description: "Scan local MCP Bridge ports (8200-8210 plus project last-port / MCP_BRIDGE_PORT) to find running Cocos Creator instances.",
        inputSchema: { type: "object", properties: {
            includeMcpDiagnostics: { type: "boolean", description: "同时返回实例列表和三侧构建诊断；离线或工程未唯一确定时仍返回代理诊断。默认保持实例数组响应。" }
        } }
    },
    {
        name: "set_active_instance",
        description: "Manually bind the MCP client to a specific Cocos Creator instance's port. Call this before using other tools when multiple instances are running.",
        inputSchema: { type: "object", properties: { port: { description: "The port number of the target instance to connect to.", type: "number" }, projectPath: { type: "string", description: "独立确认的工程绝对路径；不匹配时拒绝绑定" } }, required: ["port"] }
    }
];
let PROXY_TOOLS = configuredTools(configuredProjectPath || bundledProjectRoot, ALL_PROXY_TOOLS);
function refreshProxyTools() {
    const next = configuredTools(configuredProjectPath || activeProjectPath || bundledProjectRoot, ALL_PROXY_TOOLS);
    const signature = tools => JSON.stringify(tools.map(tool => [tool.name, tool.inputSchema.properties?.action?.enum]));
    if (signature(next) !== signature(PROXY_TOOLS)) {
        PROXY_TOOLS = next;
        if (clientReady && !connectionClosed) sendToAI({ jsonrpc: "2.0", method: "notifications/tools/list_changed" });
    }
}

// ── URL 解析 ──────────────────────────────────────────────────────────────

/**
 * 将 db://assets/xxx 映射为绝对文件系统路径。
 * 需要先通过扫描 Cocos 实例或 MCP_BRIDGE_PROJECT_PATH 环境变量设置项目根目录。
 */
function resolveDbUrl(url: string): string {
	if (!cachedProjectPath) {
		throw new Error(
			`无法解析路径 "${url}"，因为尚未检测到 Cocos Creator 项目路径。\n` +
			`解决办法：① 启动 Cocos Creator 编辑器并确保 MCP 插件的 HTTP 服务已开启；\n` +
			`② 或在启动代理前设置环境变量 MCP_BRIDGE_PROJECT_PATH=C:/你的项目路径。`
		);
	}
	const target = url.startsWith("db://")
		? pathModule.resolve(cachedProjectPath, url.replace(/^db:\/\//, ""))
		: pathModule.resolve(url);
	const relative = pathModule.relative(pathModule.join(cachedProjectPath, "assets"), target);
	if (!relative || relative === ".." || relative.startsWith(".." + pathModule.sep) || pathModule.isAbsolute(relative)) {
		throw new Error("离线编辑路径必须位于绑定工程的 assets 内");
	}
	return target;
}

// ── 扫描存活实例 ──────────────────────────────────────────────────────────

type Instance = { port: number, projectName: string, projectPath: string, mcp?: any, projectContext?: any };
const observedInstances = new Map<number, Instance>();
let clientReady = false;
let connectionClosed = false;
let connectionState: string | undefined;
let connectionTimer: ReturnType<typeof setTimeout> | undefined;

function queryInstance(p: number, background = false): Promise<Instance | null> {
        if (pendingProbes.has(p)) { routingStats.coalescedProbes++; return pendingProbes.get(p); }
        if (background) routingStats.monitorProbes++;
        else routingStats.statusProbes++;
        const pending = new Promise<Instance | null>((resolve) => {
            const options: http.RequestOptions = {
                hostname: COCOS_HOST,
                port: p,
                path: "/mcp-status",
                method: "GET",
                timeout: 200,
            };
            requestJson(options, "", (err, info) => {
                const instance = !err && info && typeof info.projectPath === "string" && pathModule.isAbsolute(info.projectPath)
                    ? { ...info, port: p } : null;
                if (instance) observedInstances.set(p, instance);
                else observedInstances.delete(p);
                resolve(instance);
            });
        });
        pendingProbes.set(p, pending);
        pending.then(() => { if (pendingProbes.get(p) === pending) pendingProbes.delete(p); });
        return pending;
}

async function scanActiveInstances() {
    if (scanInFlight) return scanInFlight;
    routingStats.fullScans++;
    scanInFlight = Promise.all(getScanPorts().map(port => queryInstance(port))).then(results => {
        publishConnectionChange(); return results.filter(instance => instance !== null);
    });
    try { return await scanInFlight; } finally { scanInFlight = null; }
}

// 合并一轮探测的变化；不以探测次数或每次响应时间触发重复通知。
function publishConnectionChange() {
    const state = JSON.stringify({ port: globalActivePort, projectPath: activeProjectPath,
        instances: [...observedInstances.values()].sort((a, b) => a.port - b.port).map(instance => [
            instance.port, pathModule.resolve(instance.projectPath), instance.mcp?.buildId,
            instance.mcp?.pid, instance.mcp?.loadedAt
        ]) });
    if (clientReady && connectionState !== undefined && connectionState !== state) {
        sendToAI({ jsonrpc: "2.0", method: "notifications/tools/list_changed" });
    }
    connectionState = state;
}

async function monitorConnections() {
    // 绑定后只检查目标，离线时也不自动换工程；不占用调用快路径的计数。
    const allPorts = getScanPorts();
    const hints = [...new Set([...observedInstances.keys(), COCOS_PORT, ...allPorts.filter(port => port < START_PORT || port > END_PORT)])];
    const ports = globalActivePort !== null ? [globalActivePort] : monitorRound++ % 4 === 0 ? allPorts : hints;
    const online = (await Promise.all(ports.map(port => queryInstance(port, true)))).some(Boolean);
    offlineRounds = online ? 0 : offlineRounds + 1;
    routingStats.monitorDelayMs = online ? (Date.now() - lastActivity < 30000 ? 5000 : 15000) : Math.min(60000, 5000 * Math.pow(2, Math.min(offlineRounds, 4)));
    if (!clientReady || connectionClosed) return;
    publishConnectionChange();
    try { refreshProxyTools(); } catch (err) { process.stderr.write("工具预设读取失败: " + err.message + "\n"); }
    connectionTimer = setTimeout(() => { void monitorConnections(); }, routingStats.monitorDelayMs);
    connectionTimer.unref?.();
}

/** 已绑定时只探测目标；失败再发现实例，但绝不自动切换工程。 */
async function getRoutingInstances() {
    if (globalActivePort !== null) {
        const selected = await queryInstance(globalActivePort);
        if (selected) { routingStats.lastRoute = "bound"; publishConnectionChange(); return [selected]; }
    }
    routingStats.lastRoute = globalActivePort === null ? "discovery" : "bound-fallback-scan";
    return scanActiveInstances();
}

function selectInstance(instances: Awaited<ReturnType<typeof scanActiveInstances>>, allowOffline = false) {
    if (globalActivePort !== null) {
        const selected = instances.find(instance => instance.port === globalActivePort);
        if (selected && pathModule.resolve(selected.projectPath) !== activeProjectPath) {
            throw new Error("绑定端口的工程身份已变化，请重新 set_active_instance 后再操作");
        }
        if (selected && activeInstancePin && selected.projectContext?.expected_context !== activeInstancePin) throw new Error("EDITOR_INSTANCE_CHANGED：编辑器实例已重载，请重新 set_active_instance");
        if (!selected && !allowOffline) throw new Error("绑定的 Cocos 项目实例已离线，请等待恢复或重新绑定");
        cachedProjectPath = activeProjectPath;
        return selected || null;
    }
    if (instances.length > 1) throw new Error("Multiple Cocos instances detected，请先 set_active_instance 指定唯一工程");
    if (instances.length === 0) {
        if (allowOffline && configuredProjectPath && pathModule.isAbsolute(configuredProjectPath)
            && fs.existsSync(pathModule.join(configuredProjectPath, "assets"))) {
            cachedProjectPath = pathModule.resolve(configuredProjectPath);
            return null;
        }
        throw new Error("未激活任何 Cocos 项目实例，请先 set_active_instance 绑定在线工程，或显式配置 MCP_BRIDGE_PROJECT_PATH 进行离线编辑");
    }
    if (configuredProjectPath && normalizeProjectPath(instances[0].projectPath) !== normalizeProjectPath(configuredProjectPath)) throw new Error("PROJECT_CONTEXT_MISMATCH：在线实例不是配置绑定的工程");
    cachedProjectPath = instances[0].projectPath;
    return instances[0];
}

// ── 日志 ──────────────────────────────────────────────────────────────────

function debugLog(msg: string) {
    process.stderr.write(`[代理调试] ${msg}\n`);
}

// ── 离线编辑处理 ──────────────────────────────────────────────────────────

/**
 * 在代理进程中直接执行离线修改，不依赖 Cocos Creator 插件。
 * 支持预制体文件自动初始化（无中生有）。
 */
function executeOfflineEdit(name: string, args: any, id: string | number | undefined) {
	try {
		const isPrefab = name === "modify_prefab_offline";
		const url = isPrefab ? args.prefabUrl : args.sceneUrl;
		if (!url) return sendError(id, -32602, `缺少参数: ${isPrefab ? 'prefabUrl' : 'sceneUrl'}`);

		const fsPath = resolveDbUrl(url);
		const result = OfflinePrefabEditor.modify(fsPath, args.operations, isPrefab ? "prefab-child" : "scene");
		if (!result.success) {
			return sendError(id, -32603, `离线修改${isPrefab ? '预制体' : '场景'}失败: ${result.error}`);
		}

		sendToAI({
			jsonrpc: "2.0",
			id,
			result: {
				content: [{
					type: "text",
					text: `✅ 成功离线修改${isPrefab ? '预制体' : '场景'}: ${url}，物理数据已安全落盘。`
				}]
			}
		});
	} catch (e: any) {
		sendError(id, -32603, `离线编辑异常: ${e.message}`);
	}
}

// ── MCP 请求处理 ──────────────────────────────────────────────────────────

// 监听标准输入以获取 MCP 请求
readline.createInterface({ input: process.stdin, crlfDelay: Infinity }).on("line", (line) => {
    if (!line.trim()) return;
    try {
        const request = JSON.parse(line);
        handleRequest(request);
    } catch (e) {
        sendError(null, -32700, "Parse error");
    }
}).on("close", () => {
    connectionClosed = true;
    clientReady = false;
    if (connectionTimer) clearTimeout(connectionTimer);
});

function proxyRuntime() {
    return { ...getRuntimeInfo("proxy", __filename),
        routing: { ...routingStats, boundPort: globalActivePort, projectPath: activeProjectPath } };
}

function sendLocalDiagnostics(id: string | number | undefined, reason: string, extra = {}) {
    const diagnostics = composeDiagnostics(null, null, proxyRuntime());
    diagnostics.issues.push(`connection: ${reason}`);
    sendToAI({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify({
        path: activeProjectPath || configuredProjectPath || bundledProjectRoot,
        ...extra, connectionError: reason, mcpDiagnostics: diagnostics
    }) }] } });
}

function sendDiagnosedResult(cocosRes: any, id: string | number | undefined, extra = {}) {
    // 只给成功的项目查询补诊断，不包装或掩盖原始工具错误。
    if (!cocosRes.isError && cocosRes.content?.[0]?.type === "text") {
        try {
            const info = JSON.parse(cocosRes.content[0].text);
            const prior = info.mcpDiagnostics;
            Object.assign(info, extra);
            info.mcpDiagnostics = composeDiagnostics(prior?.editor, prior?.scene, proxyRuntime());
            if (prior?.issues) info.mcpDiagnostics.issues.push(...prior.issues.filter(issue => issue.startsWith("scene:") && !info.mcpDiagnostics.issues.includes(issue)));
            cocosRes.content[0].text = JSON.stringify(info);
        } catch (e) { debugLog(`无法附加 MCP 诊断: ${e.message}`); }
    }
    sendToAI({ jsonrpc: "2.0", id, result: cocosRes });
}

/**
 * 处理 JSON-RPC 请求
 */
function handleRequest(req: any) {
    if (!req || typeof req !== "object" || Array.isArray(req) || req.jsonrpc !== "2.0" || typeof req.method !== "string"
        || (req.id !== undefined && req.id !== null && !["string", "number"].includes(typeof req.id))
        || (req.method === "tools/call" && req.id === undefined)) { sendError(req?.id ?? null, -32600, "Invalid Request"); return; }
    const { method, id, params } = req;

    // 处理握手初始化
    if (method === "initialize") {
        sendToAI({
            jsonrpc: "2.0",
            id: id,
            result: {
                protocolVersion: "2024-11-05",
                capabilities: { tools: { listChanged: true } },
                serverInfo: { name: "cocos-bridge", version: BUILD_INFO.version },
                mcpBridge: { expected_project_path: configuredProjectPath, project_id: configuredProjectPath ? projectIdentity(configuredProjectPath) : null },
                instructions: "先核对 get_active_instances 返回的工程路径与 projectContext，再 set_active_instance。绑定后编辑器重载需重新绑定，不能将任意响应服务的凭证用于写入。",
            },
        });
        return;
    }

    if (method === "notifications/initialized") {
        if (!clientReady && !connectionClosed) {
            clientReady = true;
            publishConnectionChange();
            void monitorConnections();
        }
        return;
    }

    // 工具目录不依赖 HTTP 服务，不扫描端口、不隐式选择工程。
    if (method === "tools/list") {
        try { refreshProxyTools(); } catch (err) { sendError(id, -32602, err.message); return; }
        sendToAI({ jsonrpc: "2.0", id, result: { tools: PROXY_TOOLS } });
        return;
    }

    // 执行具体工具
    if (method === "tools/call") {
        lastActivity = Date.now();
        try {
            if (!params || typeof params !== "object") throw new Error("tools/call 缺少 params");
            if (params.arguments === undefined) params.arguments = {};
            const argumentPin = params.arguments?.expected_context, metaPin = params._meta?.expected_context;
            if (argumentPin !== undefined && metaPin !== undefined && argumentPin !== metaPin) throw new Error("PROJECT_CONTEXT_MISMATCH：参数与元数据凭证冲突");
            if ([argumentPin, metaPin].some(pin => pin !== undefined && (typeof pin !== "string" || !pin))) throw new Error("PROJECT_CONTEXT_MISMATCH：实例凭证格式不合法");
            refreshProxyTools();
            validateExposedCall(params.name, params.arguments, PROXY_TOOLS);
        } catch (err) { sendError(id, -32602, err.message); return; }
        // 内建工具：get_active_instances
        if (params.name === "get_active_instances") {
            scanActiveInstances().then(list => {
                if (params.arguments?.includeMcpDiagnostics) {
                    let selected;
                    try { selected = selectInstance(list); }
                    catch (e) { sendLocalDiagnostics(id, e.message, { instances: list }); return; }
                    forwardToCocos("/call-tool", { name: "get_project_info", arguments: { includeMcpDiagnostics: true } }, id, "POST", selected.port,
                        result => sendDiagnosedResult(result, id, { instances: list }),
                        error => sendLocalDiagnostics(id, error.message, { instances: list }));
                    return;
                }
                sendToAI({ jsonrpc: "2.0", id, result: { content: [{ type: "text", text: JSON.stringify(list, null, 2) }] }});
            });
            return;
        }

        // 内建工具：set_active_instance
        if (params.name === "set_active_instance") {
            const p = params.arguments ? params.arguments.port : null;
            if (typeof p !== "number" || !Number.isInteger(p) || p < 1 || p > 65535) {
                sendError(id, -32602, "Invalid port parameter");
                return;
            }
            queryInstance(p).then(instance => {
                if (!instance) { sendError(id, -32000, "目标端口不是在线 Cocos 项目，原绑定保持不变"); return; }
                const expectedPath = params.arguments.projectPath || configuredProjectPath;
                if (expectedPath && normalizeProjectPath(instance.projectPath) !== normalizeProjectPath(expectedPath)) { sendError(id, -32000, "PROJECT_CONTEXT_MISMATCH：端口对应工程与预期路径不符"); return; }
                globalActivePort = p;
                activeProjectPath = pathModule.resolve(instance.projectPath);
                activeInstancePin = instance.projectContext?.expected_context || null;
                cachedProjectPath = activeProjectPath;
                publishConnectionChange();
                sendToAI({ jsonrpc: "2.0", id, result: { projectContext: instance.projectContext, content: [{ type: "text", text: `Active instance successfully set to port ${p}. Project: ${activeProjectPath}` }] }});
            });
            return;
        }

        // 所有工具共用工程身份校验，离线操作也不能绕过多实例保护。
        getRoutingInstances().then(onlineEngines => {
            const offline = OFFLINE_TOOL_NAMES.has(params.name);
            const diagnostics = params.name === "get_project_info" && params.arguments?.includeMcpDiagnostics;
            let selected;
            try {
                selected = selectInstance(onlineEngines, offline);
                if (selected?.projectContext) {
                    const context = selected.projectContext;
                    if (normalizeProjectPath(context.project_path) !== normalizeProjectPath(selected.projectPath) || context.project_id !== projectIdentity(selected.projectPath)) throw new Error("PROJECT_CONTEXT_MISMATCH：服务身份与工程路径不一致");
                    const pin = params.arguments.expected_context === undefined ? params._meta?.expected_context : params.arguments.expected_context;
                    if (pin && pin !== context.expected_context) throw new Error("EDITOR_INSTANCE_CHANGED：凭证已失效，请重新核对并绑定");
                    if (mutatesProject(params.name, params.arguments) && globalActivePort === null && !configuredProjectPath && !pin) throw new Error("PROJECT_CONTEXT_REQUIRED：写入前请核对工程并 set_active_instance");
                    if (globalActivePort !== null || configuredProjectPath || pin) params.arguments.expected_context = context.expected_context;
                }
                if (offline) resolveDbUrl(params.name === "modify_prefab_offline" ? params.arguments.prefabUrl : params.arguments.sceneUrl);
            } catch (e) {
                if (diagnostics) { sendLocalDiagnostics(id, e.message); return; }
                sendError(id, e.message.includes("Multiple Cocos") ? -32600 : -32000, e.message); return;
            }
            if (!selected) { executeOfflineEdit(params.name, params.arguments, id); return; }
            const finalPort = selected.port;
            forwardToCocos(
                "/call-tool",
                {
                    name: params.name,
                    arguments: params.arguments,
                },
                id,
                "POST",
                finalPort,
                diagnostics ? cocosRes => sendDiagnosedResult(cocosRes, id) : undefined,
                diagnostics ? error => sendLocalDiagnostics(id, error.message) : undefined
            );
        });
        return;
    }

    if (method === "ping") { if (id !== undefined) sendToAI({ jsonrpc: "2.0", id, result: {} }); return; }
    if (id !== undefined) sendError(id, -32601, `Method not found: ${method}`);
}

// ── HTTP 转发 ─────────────────────────────────────────────────────────────

/**
 * 将请求通过 HTTP 转发给 Cocos Creator 插件
 */
function forwardToCocos(path_: string, payload: any, id: string | number | undefined, method = "POST", overridePort?: number, onSuccess?: (res: any) => void, onError?: (error: Error) => void) {
    const postData = payload ? JSON.stringify(payload) : "";
    const targetPort = overridePort || COCOS_PORT;

    const options: http.RequestOptions = {
        hostname: COCOS_HOST,
        port: targetPort,
        path: path_,
        method: method,
        headers: { "Content-Type": "application/json" },
        timeout: FORWARD_TIMEOUT_MS,
    };

    if (postData && options.headers) {
        options.headers["Content-Length"] = Buffer.byteLength(postData);
    }

    requestJson(options, postData, (err, cocosRes) => {
        if (err) { debugLog(err.message); if (onError) onError(err); else sendError(id, -32000, err.message); return; }
        if (onSuccess) {
            onSuccess(cocosRes);
        } else sendToAI({ jsonrpc: "2.0", id, result: cocosRes });
    });
}

// ── 响应输出 ──────────────────────────────────────────────────────────────

function sendToAI(obj: any) {
    if (connectionClosed) return;
    process.stdout.write(JSON.stringify(obj) + "\n");
}

function sendError(id: string | number | undefined, code: number, message: string) {
    sendToAI({ jsonrpc: "2.0", id: id, error: { code, message } });
}
