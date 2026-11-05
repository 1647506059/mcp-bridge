import * as fs from "fs";
import * as pathModule from "path";

/**
 * 判断是否为可探测的 TCP 端口。
 */
function isValidPort(port: unknown): port is number {
	return typeof port === "number" && Number.isInteger(port) && port > 0 && port < 65536;
}

/**
 * 收集代理要探测的 HTTP 端口：默认范围 + 项目/环境额外端口（去重）。
 * 项目级代理必须扫到 settings 里的 last-port（例如旧默认 3456），
 * 否则 tools/list 会误判为未激活，只露出 get_active_instances。
 */
export function collectScanPorts(
	start: number,
	end: number,
	extraPorts?: Array<number | null | undefined>,
): number[] {
	const seen = new Set<number>();
	const ports: number[] = [];
	const add = (p: unknown) => {
		if (!isValidPort(p) || seen.has(p)) return;
		seen.add(p);
		ports.push(p);
	};
	for (let p = start; p <= end; p++) {
		add(p);
	}
	if (extraPorts) {
		for (const p of extraPorts) {
			add(p);
		}
	}
	return ports;
}

/**
 * 从 settings/mcp-bridge.json 文本读取 last-port。
 * 兼容被 Object.assign(string) 拆成字符键的损坏文件。
 */
export function readLastPortFromSettings(raw: string): number | null {
	try {
		const data = JSON.parse(raw);
		if (!data || typeof data !== "object") return null;
		const port = Number(data["last-port"]);
		return isValidPort(port) ? port : null;
	} catch {
		return null;
	}
}

/**
 * 从 mcp-proxy 所在 dist 目录回溯到含 settings/mcp-bridge.json 的工程根。
 * dist → mcp-bridge → packages → 工程根。
 */
export function resolveProjectRootFromProxyDir(proxyDir: string): string | null {
	const projectRoot = pathModule.resolve(proxyDir, "..", "..", "..");
	const settingsFile = pathModule.join(projectRoot, "settings", "mcp-bridge.json");
	if (fs.existsSync(settingsFile)) return projectRoot;
	return null;
}
