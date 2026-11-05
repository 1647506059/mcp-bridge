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
exports.targetPaths = void 0;
exports.processTomlInjection = processTomlInjection;
exports.projectConnection = projectConnection;
exports.scanMcpClients = scanMcpClients;
exports.getPayload = getPayload;
exports.injectMcpConfig = injectMcpConfig;
const AtomicFile_1 = require("./utils/AtomicFile");
const ClientConfigProtection_1 = require("./utils/ClientConfigProtection");
const ProjectContext_1 = require("./core/ProjectContext");
const HttpServer_1 = require("./core/HttpServer");
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const bridgeCommand = 'node';
const bridgeArgs = [path.resolve(__dirname, 'mcp-proxy.js').replace(/\\/g, '/')];
const isWin = process.platform === 'win32';
const isMac = process.platform === 'darwin';
const getAppdataPath = () => process.env.APPDATA || (isWin ? process.env.USERPROFILE + '\\AppData\\Roaming' : '');
const getMacAppSupportPath = () => process.env.HOME + '/Library/Application Support';
const getUserProfilePath = () => process.env.USERPROFILE || process.env.HOME || '';
const getAppDataDir = () => isWin ? getAppdataPath() : getMacAppSupportPath();
/**
 * 支持的常见 AI 客户端配置文件路径与元数据定义列表
 */
exports.targetPaths = [
    { name: 'Antigravity', file: path.join(getUserProfilePath(), '.gemini', 'config', 'mcp_config.json') },
    { name: 'Cherry Studio', file: path.join(getAppDataDir(), 'cherry-studio', 'mcp.json') },
    { name: 'Claude Code', file: path.join(getUserProfilePath(), '.claude.json') },
    { name: 'Claude Desktop', file: path.join(getAppDataDir(), 'Claude', 'claude_desktop_config.json') },
    { name: 'Cline', file: path.join(getAppDataDir(), 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json') },
    { name: 'CodeBuddy CLI', file: path.join(getUserProfilePath(), '.codebuddy', 'mcp.json') },
    { name: 'CodeWhale', file: path.join(getUserProfilePath(), '.codewhale', 'mcp.json') },
    { name: 'Deepseek-TUI', file: path.join(getUserProfilePath(), '.deepseek', 'mcp.json') },
    { name: 'Codex', file: path.join(getUserProfilePath(), '.codex', 'config.toml'), format: 'toml' },
    { name: 'Cursor', file: path.join(getUserProfilePath(), '.cursor', 'mcp.json') },
    { name: 'Gemini CLI', file: path.join(getUserProfilePath(), '.gemini', 'mcp.json') },
    { name: 'GitHub Copilot CLI', file: path.join(getUserProfilePath(), '.config', 'github-copilot', 'mcp.json') },
    { name: 'Kilo Code', file: path.join(getUserProfilePath(), '.kilo', 'mcp.json') },
    { name: 'Kiro', file: path.join(getUserProfilePath(), '.kiro', 'mcp.json') },
    { name: 'OpenCode', file: path.join(getUserProfilePath(), '.opencode', 'mcp.json') },
    { name: 'Qwen Code', file: path.join(getUserProfilePath(), '.qwen', 'mcp.json') },
    { name: 'Rider GitHub Copilot', file: path.join(getAppDataDir(), 'JetBrains', 'Rider', 'github-copilot', 'mcp.json') },
    { name: 'Roo Code', file: path.join(getAppDataDir(), 'Code', 'User', 'globalStorage', 'rooveterinaryinc.roo-cline', 'settings', 'cline_mcp_settings.json') },
    { name: 'Trae', file: path.join(getUserProfilePath(), '.trae', 'mcp.json') },
    { name: 'Trae CN', file: path.join(getUserProfilePath(), '.trae-cn', 'mcp.json') },
    { name: 'VSCode GitHub Copilot', file: path.join(getAppDataDir(), 'Code', 'User', 'globalStorage', 'github.copilot', 'mcp.json') },
    { name: 'VSCode Insiders GitHub Copilot', file: path.join(getAppDataDir(), 'Code - Insiders', 'User', 'globalStorage', 'github.copilot', 'mcp.json') },
    { name: 'Windsurf', file: path.join(getUserProfilePath(), '.codeium', 'windsurf', 'mcp_config.json') },
    {
        name: 'Zed',
        file: isWin
            ? path.join(getAppdataPath(), 'Zed', 'settings.json')
            : path.join(getUserProfilePath(), '.config', 'zed', 'settings.json'),
        format: 'json',
        mcpKey: 'context_servers'
    }
];
/**
 * 备份目标配置文件，生成同名 .bak 文件兜底
 * @param targetFile 目标文件绝对路径
 * @param clientName AI 客户端名称
 * @returns 备份文件的绝对路径，若无需备份或失败返回 null
 */
function backupConfigFile(targetFile, clientName) {
    if (!fs.existsSync(targetFile)) {
        return null;
    }
    const backupPath = `${targetFile}.${Date.now()}-${crypto.randomBytes(4).toString("hex")}.bak`;
    try {
        fs.copyFileSync(targetFile, backupPath, fs.constants.COPYFILE_EXCL);
        return backupPath;
    }
    catch (e) {
        console.error(`[McpConfigurator] 备份配置文件失败 (${clientName}): ${e.message}`);
        return null;
    }
}
/**
 * 向 TOML 格式（如 Codex 的 config.toml）安全增量注入 mcp-bridge 配置
 * @param content 现有的 TOML 字符串
 * @param command 启动命令 (如 node)
 * @param args 命令参数数组
 * @returns 更新后的 TOML 字符串
 */
function processTomlInjection(content, command, args) {
    return (0, ClientConfigProtection_1.updateTomlClient)(content, 'mcp-bridge', { command, args });
}
function projectConnection() {
    var _a;
    const root = typeof Editor !== 'undefined' && ((_a = Editor.Project) === null || _a === void 0 ? void 0 : _a.path) ? path.resolve(Editor.Project.path) : path.resolve(__dirname, '../../..');
    const serverName = 'mcp-bridge-' + (0, ProjectContext_1.projectIdentity)(root).slice(0, 12);
    const host = HttpServer_1.HttpServer.config.host || '127.0.0.1';
    const authority = host.includes(':') ? '[' + host + ']' : host;
    return { root, serverName, url: 'http://' + authority + ':' + HttpServer_1.HttpServer.config.port + '/mcp/project/' + (0, ProjectContext_1.projectIdentity)(root) + '/',
        entry: { command: bridgeCommand, args: bridgeArgs, env: { MCP_BRIDGE_PROJECT_PATH: root.replace(/\\/g, '/'), MCP_BRIDGE_HOST: host } } };
}
exports.targetPaths.push({ name: 'DeepSeek Harness (DSH)', file: path.join(projectConnection().root, '.dsh', 'mcp-bridge.patch.json'), format: 'dsh' });
function updatedClient(target, original) {
    const info = projectConnection();
    if (target.format === 'dsh')
        return (0, ClientConfigProtection_1.updateDshPatch)(original, info.serverName, info.url);
    if (target.format === 'toml')
        return (0, ClientConfigProtection_1.updateTomlClient)(original || '', info.serverName, info.entry);
    return (0, ClientConfigProtection_1.updateJsonClient)(original || '{}', target.mcpKey || 'mcpServers', info.serverName, info.entry);
}
/**
 * 扫描系统中已知 AI 客户端的配置文件存在状态及 MCP 注入配置状态
 * @returns 客户端配置检测结果列表
 */
function scanMcpClients() {
    return exports.targetPaths.map((target, id) => {
        const isInstalled = !!target.file && fs.existsSync(path.dirname(target.file));
        let isConfigured = false, isError = false, error = '';
        if (target.file && fs.existsSync(target.file)) {
            try {
                const raw = fs.readFileSync(target.file, 'utf8');
                isConfigured = updatedClient(target, raw) === raw;
            }
            catch (failure) {
                isError = true;
                error = failure.message;
            }
        }
        return { id, name: target.name, path: target.file, isInstalled, isConfigured, isError, error };
    });
}
/**
 * 获取默认的标准 JSON MCP 配置 Payload
 * @returns JSON 配置字符串
 */
function getPayload() {
    const info = projectConnection();
    return JSON.stringify({ mcpServers: { [info.serverName]: info.entry } }, null, 2);
}
/**
 * 注入 MCP Bridge 配置至指定的 AI 客户端配置文件中
 * 支持自动创建目录、.bak 备份兜底以及 JSON/TOML 格式的安全增量合并
 * @param clientId 客户端索引 ID（可选，不传时注入全部可注入的目标）
 * @returns 操作日志信息
 */
function injectMcpConfig(clientId) {
    let log = '', successCount = 0;
    const targets = exports.targetPaths.map((target, id) => ({ ...target, id })).filter(target => clientId === undefined || clientId < 0 || target.id === clientId);
    for (const target of targets) {
        if (!target.file)
            continue;
        try {
            const existed = fs.existsSync(target.file), original = existed ? fs.readFileSync(target.file) : undefined;
            if (existed && !backupConfigFile(target.file, target.name)) {
                log += '备份失败，未修改 ' + target.name + '\n';
                continue;
            }
            const updated = updatedClient(target, original === null || original === void 0 ? void 0 : original.toString('utf8'));
            fs.mkdirSync(path.dirname(target.file), { recursive: true });
            (0, AtomicFile_1.atomicWrite)(target.file, updated, original);
            log += '✅ [' + target.name + '] 已写入本项目专属配置，其他项目条目保持原样。\n';
            if (target.format === 'dsh') {
                const quoted = process.platform === 'win32' ? target.file.replace(/'/g, "''") : target.file.replace(/'/g, "'\\''");
                log += "在工程目录手动运行：dsh web --patch '" + quoted + "'（不会自动启动或修改全局 YAML）\n";
            }
            successCount++;
        }
        catch (error) {
            log += '❌ [' + target.name + '] 未修改配置: ' + error.message + '\n';
        }
    }
    return log || (successCount ? '配置完成' : '未找到所选客户端');
}
