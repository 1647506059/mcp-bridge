"use strict";

/**
 * MCP Bridge 插件面板脚本
 * 负责处理面板 UI 交互、与主进程通信以及提供测试工具界面。
 */

import * as fs from "fs";
import * as path from "path";
import { selectToolProfile, TOOL_PROFILES } from "../tools/ToolProfiles";
import { TOOL_CATEGORIES } from "../tools/ToolCapabilities";
import { runPanelMenu } from "./MenuActions";

Editor.Panel.extend({
	/**
	 * 面板 CSS 样式
	 */
	style: fs.readFileSync(Editor.url("packages://mcp-bridge/panel/index.css"), "utf-8"),

	/**
	 * 面板 HTML 模板
	 */
	template: fs.readFileSync(Editor.url("packages://mcp-bridge/panel/index.html"), "utf-8"),

	/**
	 * 监听来自主进程的消息
	 */
	messages: {
		/**
		 * 接收并渲染日志
		 * @param {Object} event IPC 事件对象
		 * @param {Object} log 日志数据
		 */
		"mcp-bridge:on-log"(event, log) {
			this.renderLog(log);
		},

		/**
		 * 服务器状态变更通知
		 * @param {Object} event IPC 事件对象
		 * @param {Object} config 服务器配置
		 */
		"mcp-bridge:state-changed"(event, config) {
			Editor.Ipc.sendToMain("mcp-bridge:get-server-state", (err, data) => {
				if (data) {
					const portInput = (this as any).shadowRoot.querySelector("#portInput") as HTMLInputElement;
					if (portInput) portInput.value = data.config.port;

					this.updateUI(data.config.active);

					const activePortDisplay = (this as any).shadowRoot.querySelector(
						"#activePortDisplay",
					) as HTMLElement;
					if (data.config.active && activePortDisplay) {
						activePortDisplay.style.display = "inline";
						const actPort = parseInt(data.config.port);
						activePortDisplay.textContent = `(当前生效: ${actPort})`;
						activePortDisplay.style.color = "#888";
					} else {
						if (activePortDisplay) activePortDisplay.style.display = "none";
					}
				}
			});
		},
	},

	async run(argv) {
		if (!argv?.menuAction) return;
		try { await runPanelMenu(this, argv.menuAction); }
		catch (err) { Editor.warn("MCP 菜单操作失败：" + String(err.message || err)); }
	},

	/**
	 * 面板就绪回调，进行 DOM 绑定与事件初始化
	 */
	ready() {
		this.dashboardClosed = false;
		this.dashboardPending = false;
		this.dashboardGeneration = (this.dashboardGeneration || 0) + 1;
		this.menuDashboardReady = new Promise(resolve => { this.resolveMenuDashboardReady = resolve; });
		clearInterval(this.dashboardTimer);
		const root = (this as any).shadowRoot;
        root.querySelector("#btnApplyHost").addEventListener("click", () => {
            const button = root.querySelector("#btnApplyHost"); button.disabled = true;
            Editor.Ipc.sendToMain("mcp-bridge:apply-host", root.querySelector("#hostInput").value, (err, config) => {
                button.disabled = false;
                root.querySelector("#hostNotice").textContent = err ? String(err) : "Host 已保存；连接地址改变后请重新配置客户端。";
                this.refreshDashboard();
            });
        });
        this.setupToolPresets(root);
		const notice = (message: string, error = false) => {
			const el = root.querySelector("#dashboardNotice");
			el.textContent = message; el.classList.toggle("error", error);
		};
		root.querySelector("#btnRefreshStatus").addEventListener("click", () => this.refreshDashboard(true));
        root.querySelector("#btnClearCalls").addEventListener("click", () => {
            Editor.Ipc.sendToMain("mcp-bridge:clear-call-history", err => { if (err) notice(String(err), true); else this.refreshDashboard(); });
        });
		root.querySelector("#btnCopyEndpoint").addEventListener("click", () => {
			if (!this.dashboardData?.endpoint) return;
			require("electron").clipboard.writeText(this.dashboardData.endpoint); notice("端点已复制");
		});
		root.querySelector("#btnCopyCli").addEventListener("click", () => {
			if (!this.dashboardData) return;
			require("electron").clipboard.writeText(this.dashboardData.cli); notice("stdio 代理命令已复制");
		});
		root.querySelector("#btnOpenProject").addEventListener("click", async () => {
			const button = root.querySelector("#btnOpenProject");
			button.disabled = true;
			try {
				if (!this.dashboardData?.projectPath) throw new Error("工程信息尚未读取，请先刷新状态");
				const projectPath = path.normalize(this.dashboardData.projectPath);
				const error = await require("electron").shell.openPath(projectPath);
				if (error) throw new Error(error);
				notice("已打开工程目录：" + projectPath);
			} catch (err) {
				notice("打开工程目录失败：" + String(err.message || err), true);
			} finally {
				button.disabled = false;
			}
		});
		root.querySelector("#btnRestart").addEventListener("click", () => {
			const button = root.querySelector("#btnRestart"); button.disabled = true;
			notice("正在重启服务…");
			Editor.Ipc.sendToMain("mcp-bridge:restart-server", (err) => {
				button.disabled = false;
				notice(err ? String(err.message || err) : "已提交重启，服务状态以概览为准", !!err);
				this.refreshDashboard();
			});
		});
		this.refreshDashboard();
		this.dashboardTimer = setInterval(() => this.refreshDashboard(), 10000);
		// 获取 DOM 元素映射
		const els = {
			port: root.querySelector("#portInput"),
			btnToggle: root.querySelector("#btnToggle"),
			autoStart: root.querySelector("#autoStartCheck"),
			logView: root.querySelector("#logConsole"),
			tabMain: root.querySelector("#tabMain"),
			tabConfig: root.querySelector("#tabConfig"),
			panelMain: root.querySelector("#panelMain"),
			panelConfig: root.querySelector("#panelConfig"),
			mcpClientSelect: root.querySelector("#mcpClientSelect"),
			mcpConfigStatus: root.querySelector("#mcpConfigStatus"),
			btnRefreshMcp: root.querySelector("#btnRefreshMcp"),
			btnInjectMcp: root.querySelector("#btnInjectMcp"),
			btnInjectAll: root.querySelector("#btnInjectAll"),
		};
		this.menuElements = els;

		// 1. 初始化服务器状态与配置
		this.menuServerReady = new Promise(resolve => {
			Editor.Ipc.sendToMain("mcp-bridge:get-server-state", (err, data) => {
				if (data) {
					els.port.value = data.config.port;
	                root.querySelector("#hostInput").value = data.config.host || "127.0.0.1";
	                root.querySelector("#hostNotice").textContent = data.config.startError || "默认仅本机访问；改为局域网地址后，仅向可信网络开放。";
					els.autoStart.value = data.autoStart;
					this.updateUI(data.config.active);

					const activePortDisplay = root.querySelector("#activePortDisplay") as HTMLElement;
					if (data.config.active && activePortDisplay) {
						activePortDisplay.style.display = "inline";
						const actPort = parseInt(data.config.port);
						activePortDisplay.textContent = `(当前生效: ${actPort})`;
						activePortDisplay.style.color = "#888";
					} else {
						if (activePortDisplay) activePortDisplay.style.display = "none";
					}

					const widthInput = root.querySelector("#screenshotWidthInput") as HTMLInputElement;
					const throttleInput = root.querySelector("#screenshotThrottleInput") as HTMLInputElement;
					if (widthInput) widthInput.value = data.screenshotMaxWidth !== undefined ? data.screenshotMaxWidth : 1280;
					if (throttleInput) throttleInput.value = data.screenshotThrottle !== undefined ? data.screenshotThrottle : 1500;

					els.logView.innerHTML = "";
					data.logs.forEach((l) => this.renderLog(l));
				}
				resolve(!!data && !err);
			});
		});

		// 2. 标签页切换逻辑
		const switchTab = (activeTab, activePanel) => {
			[els.tabMain, els.tabConfig].forEach((t) => {
				if (t) t.classList.remove("active");
			});
			[els.panelMain, els.panelConfig].forEach((p) => {
				if (p) p.classList.remove("active");
			});
			if (activeTab) activeTab.classList.add("active");
			if (activePanel) activePanel.classList.add("active");
		};
		this.switchMenuTab = switchTab;

		if (els.tabMain) els.tabMain.addEventListener("click", () => switchTab(els.tabMain, els.panelMain));
 
 		if (els.tabConfig) {
 			els.tabConfig.addEventListener("click", () => {
 				switchTab(els.tabConfig, els.panelConfig);
 				this.fetchMcpClients(els);
 			});
 		}
 
 		// 3. 基础控制按钮逻辑
		els.btnToggle.addEventListener("click", () => {
			const port = Number(els.port.value);
			if (!Number.isInteger(port) || port < 1 || port > 65535) { notice("端口必须为 1–65535 的整数", true); return; }
			Editor.Ipc.sendToMain("mcp-bridge:toggle-server", port);
 		});
 
 		root.querySelector("#btnClear").addEventListener("click", () => {
 			els.logView.innerHTML = "";
 			Editor.Ipc.sendToMain("mcp-bridge:clear-logs");
 		});
 
 		root.querySelector("#btnCopy").addEventListener("click", () => {
 			require("electron").clipboard.writeText(els.logView.innerText);
 			Editor.success("日志已复制到剪贴板");
 		});
 
 		els.autoStart.addEventListener("change", (e) => {
 			Editor.Ipc.sendToMain("mcp-bridge:set-auto-start", e.target.value);
 		});
 
 		// 4.5 MCP 配置页交互逻辑
 		if (els.btnRefreshMcp) els.btnRefreshMcp.addEventListener("click", () => this.fetchMcpClients(els));
 		if (els.btnInjectMcp) {
 			els.btnInjectMcp.addEventListener("click", () => {
 				const clientId = parseInt(els.mcpClientSelect.value);
 				if (!isNaN(clientId)) this.injectMcpConfig(clientId, els);
 			});
 		}
 		if (els.btnInjectAll) {
 			els.btnInjectAll.addEventListener("click", () => {
 				this.injectMcpConfig(-1, els);
 			});
 		}
 		if (els.mcpClientSelect) {
 			els.mcpClientSelect.addEventListener("change", () => {
 				this.renderMcpClientStatus(els);
 			});
 		}
 
 		const btnSaveScreenshotSettings = root.querySelector("#btnSaveScreenshotSettings");
 		if (btnSaveScreenshotSettings) {
 			btnSaveScreenshotSettings.addEventListener("click", () => {
 				const widthInput = root.querySelector("#screenshotWidthInput") as HTMLInputElement;
 				const throttleInput = root.querySelector("#screenshotThrottleInput") as HTMLInputElement;
 				const maxWidth = parseInt(widthInput.value);
 				const throttle = parseInt(throttleInput.value);
 				
 				if (isNaN(maxWidth) || maxWidth < 100) {
 					Editor.warn("最大宽度必须是大于等于 100 的数字");
 					return;
 				}
 				if (isNaN(throttle) || throttle < 0) {
 					Editor.warn("节流时间必须是大于等于 0 的数字");
 					return;
				}
				
				Editor.Ipc.sendToMain("mcp-bridge:set-screenshot-settings", { maxWidth, throttle }, (err) => {
					if (err) {
						Editor.error("保存设置失败: " + err);
					} else {
						Editor.success("截图优化设置已成功保存！");
					}
				});
			});
		}
	},

	close() {
		clearInterval(this.dashboardTimer);
		clearTimeout(this.dashboardTimeout);
		this.dashboardClosed = true;
		this.dashboardGeneration++;
		if (this.resolveMenuDashboardReady) this.resolveMenuDashboardReady(false);
		this.resolveMenuDashboardReady = null;
	},

	refreshDashboard(manual = false) {
		if (this.dashboardPending || this.dashboardClosed) return;
		this.dashboardPending = true;
		const generation = this.dashboardGeneration;
		const root = (this as any).shadowRoot;
		const button = root.querySelector("#btnRefreshStatus");
		const notice = root.querySelector("#dashboardNotice");
		button.disabled = true;
		if (manual) { button.textContent = "刷新中…"; notice.textContent = "正在读取最新状态…"; notice.classList.remove("error"); }
		let finished = false;
		const finish = (err, data?) => {
			if (finished || generation !== this.dashboardGeneration) return;
			finished = true;
			clearTimeout(this.dashboardTimeout);
			this.dashboardPending = false;
			if (this.dashboardClosed) return;
			if (this.resolveMenuDashboardReady) {
				this.resolveMenuDashboardReady(!err && !!data);
				this.resolveMenuDashboardReady = null;
			}
			button.disabled = false;
			button.textContent = "刷新状态";
			if (err || !data) {
				notice.textContent = "状态读取失败：" + String(err?.message || err || "无数据"); notice.classList.add("error");
				root.querySelector("#serverState").textContent = "状态未知";
				root.querySelector("#serverDot").classList.remove("online");
				root.querySelector("#btnCopyEndpoint").disabled = true;
				return;
			}
			this.dashboardData = data;
            if (data.config.startError) root.querySelector("#hostNotice").textContent = data.config.startError;
            if (data.calls) this.renderCalls(data.calls);
			const set = (id: string, value: any) => { const el = root.querySelector("#" + id); el.textContent = String(value); el.title = String(value); };
			set("serverState", data.config.active ? "运行中" : data.config.state === "starting" ? "启动中" : "已停止");
			root.querySelector("#serverDot").classList.toggle("online", data.config.active);
			set("endpoint", data.endpoint || "服务未启动");
			root.querySelector("#btnCopyEndpoint").disabled = !data.endpoint;
			set("toolCount", `Tools ${data.tools} / ${data.resources} res`); set("requestCount", `工具调用 ${data.requests}`);
			set("projectPath", data.projectPath); set("engineVersion", "Creator " + data.engineVersion);
			set("gitBranch", data.branch); set("gitHead", data.head); set("editorPid", data.editorPid);
			set("buildInfo", data.runtime.version + " / " + data.runtime.buildId.slice(0, 8));
			set("queueInfo", data.queue.blockedReason ? "已阻塞：" + data.queue.blockedReason : data.queue.current ? data.queue.current.tool + " · 等待 " + data.queue.waiting : "空闲");
			set("infoUpdated", new Date(data.updatedAt).toLocaleTimeString());
			this.updateUI(data.config.active);
			if (manual || notice.classList.contains("error")) { notice.textContent = "状态已刷新（" + new Date(data.updatedAt).toLocaleTimeString() + "）"; notice.classList.remove("error"); }
		};
		this.dashboardTimeout = setTimeout(() => finish(new Error("编辑器响应超时，请重试")), 5000);
		try { Editor.Ipc.sendToMain("mcp-bridge:get-panel-status", finish); }
		catch (err) { finish(err); }
	},

    setupToolPresets(root) {
        for (const value of Object.keys(TOOL_PROFILES)) { const option = document.createElement("option"); option.value = value; option.textContent = TOOL_PROFILES[value]; root.querySelector("#toolProfileMode").appendChild(option); }
        let pending = false;
        const message = (text, error = false) => { const el = root.querySelector("#toolPresetNotice"); el.textContent = text; el.classList.toggle("error", error); };
        const send = (method, value, done) => new Promise<boolean>(resolve => {
            if (pending) { message("正在处理预设，请稍候"); resolve(false); return; }
            pending = true;
            const generation = this.dashboardGeneration;
            let finished = false;
            const finish = (err, result?) => {
                if (finished) return;
                finished = true; pending = false; clearTimeout(timer);
                if (this.dashboardClosed || generation !== this.dashboardGeneration) { resolve(false); return; }
                if (err) message(String(err.message || err), true); else done(result);
                resolve(!err);
            };
            const timer = setTimeout(() => finish("操作超时，请重新读取预设确认结果"), 5000);
            try { if (value === undefined) Editor.Ipc.sendToMain("mcp-bridge:" + method, finish); else Editor.Ipc.sendToMain("mcp-bridge:" + method, value, finish); } catch (err) { finish(err); }
        });
        const checklist = (preset) => {
            const container = root.querySelector("#toolChecklist"); container.textContent = "";
            const chosen = new Set(selectToolProfile(this.presetTools, { MCP_BRIDGE_TOOL_PROFILE: preset.profile, MCP_BRIDGE_ENABLED_TOOLS: preset.enabled.join(","), MCP_BRIDGE_DISABLED_TOOLS: preset.disabled.join(","), MCP_BRIDGE_TOOL_ACTIONS: JSON.stringify(preset.actions || {}) }).map(tool => tool.name));
            for (const category of Object.keys(TOOL_CATEGORIES)) {
                const tools = this.presetTools.filter(tool => tool.category === category);
                if (!tools.length) continue;
                const group = document.createElement("details"), summary = document.createElement("summary"), buttons = document.createElement("div");
                group.className = "tool-group"; group.open = true; summary.dataset.title = TOOL_CATEGORIES[category]; group.appendChild(summary); buttons.className = "tool-group-actions";
                for (const [title, checked] of [["选择", true], ["清除", false]] as [string, boolean][]) { const button = document.createElement("button"); button.textContent = title; button.addEventListener("click", () => { group.querySelectorAll("input[data-tool]").forEach((input: any) => { if (!input.disabled) input.checked = checked; }); updateCounts(); }); buttons.appendChild(button); }
                group.appendChild(buttons);
                for (const tool of tools) {
                    const row = document.createElement("div"), title = document.createElement("label"), input = document.createElement("input"), label = document.createElement("span"), badge = document.createElement("span"), description = document.createElement("small");
                    row.className = "tool-row"; row.dataset.search = (tool.name + " " + tool.description + " " + category + " " + TOOL_CATEGORIES[category]).toLowerCase(); row.dataset.compatibility = String(!!tool.compatibility);
                    input.type = "checkbox"; input.dataset.tool = tool.name; input.checked = chosen.has(tool.name); input.disabled = preset.profile === "readonly" && !tool.annotations?.readOnlyHint && tool.name !== "batch_execute"; input.addEventListener("change", updateCounts);
                    const precautionsEnd = "以防止编辑器长期卡死。", precautionsIndex = tool.description.indexOf(precautionsEnd);
                    row.title = tool.description;
                    label.textContent = tool.name; badge.className = "tool-badge"; badge.textContent = (tool.compatibility ? "兼容 · " : "") + (tool.annotations?.readOnlyHint ? "只读" : "可操作"); description.textContent = precautionsIndex < 0 ? tool.description : tool.description.slice(precautionsIndex + precautionsEnd.length).trim();
                    title.appendChild(input); title.appendChild(label); title.appendChild(badge); row.appendChild(title); row.appendChild(description);
                    const choices = tool.inputSchema.properties.action?.enum;
                    if (choices) {
                        const details = document.createElement("details"), heading = document.createElement("summary"), items = document.createElement("div");
                        details.className = "tool-actions"; heading.textContent = "开放操作"; details.appendChild(heading);
                        for (const action of choices) {
                            const item = document.createElement("label"), checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.disabled = input.disabled; checkbox.dataset.owner = tool.name; checkbox.dataset.action = action; checkbox.checked = !preset.actions?.[tool.name] || preset.actions[tool.name].includes(action);
                            checkbox.addEventListener("change", () => { input.checked = Array.from(items.querySelectorAll("input")).some((value: any) => value.checked); updateCounts(); });
                            item.appendChild(checkbox); item.appendChild(document.createTextNode(action)); items.appendChild(item);
                        }
                        details.appendChild(items); row.appendChild(details);
                    }
                    group.appendChild(row);
                }
                container.appendChild(group);
            }
            updateCounts(); filterTools();
        };
        const updateCounts = () => {
            const total = root.querySelectorAll("#toolChecklist input[data-tool]");
            total.forEach(input => { const actions = Array.from(root.querySelectorAll('input[data-owner="' + input.dataset.tool + '"]')); if (input.checked && actions.length && !actions.some((action: any) => action.checked)) actions.forEach((action: any) => action.checked = true); });
            root.querySelector("#toolExposureCount").textContent = Array.from(total).filter((input: any) => input.checked).length + " / " + total.length + " 个工具";
            root.querySelectorAll(".tool-group").forEach(group => { const inputs = Array.from(group.querySelectorAll("input[data-tool]")); const summary = group.querySelector("summary"); summary.textContent = summary.dataset.title + "（" + inputs.filter((input: any) => input.checked).length + "/" + inputs.length + "）"; });
        };
        const filterTools = () => {
            const query = root.querySelector("#toolSearch").value.trim().toLowerCase(), hideCompat = root.querySelector("#hideCompatTools").checked;
            root.querySelectorAll(".tool-row").forEach(row => row.hidden = !row.dataset.search.includes(query) || (hideCompat && row.dataset.compatibility === "true"));
            root.querySelectorAll(".tool-group").forEach(group => group.hidden = !Array.from(group.querySelectorAll(".tool-row")).some((row: any) => !row.hidden));
        };
        root.querySelector("#toolSearch").addEventListener("input", filterTools); root.querySelector("#hideCompatTools").addEventListener("change", filterTools);
        for (const [id, checked] of [["btnSelectAllTools", true], ["btnClearTools", false]]) root.querySelector("#" + id).addEventListener("click", () => { root.querySelectorAll("#toolChecklist input[data-tool]").forEach(input => { if (!input.disabled) input.checked = checked; }); updateCounts(); });
        root.querySelector("#btnResetTools").addEventListener("click", () => { if (this.presetTools) checklist({ profile: root.querySelector("#toolProfileMode").value === "custom" ? "core" : root.querySelector("#toolProfileMode").value, enabled: [], disabled: [] }); });
        const show = (name) => {
            const preset = this.presetState.presets.find(item => item.name === name);
            root.querySelector("#toolPresetName").value = preset.name; root.querySelector("#toolProfileMode").value = preset.profile; checklist(preset);
        };
        const render = state => {
            this.presetState = state;
            const select = root.querySelector("#toolPresetSelect"); select.textContent = "";
            for (const preset of state.presets) { const option = document.createElement("option"); option.value = preset.name; option.textContent = preset.name + (state.active === preset.name ? "（启用）" : ""); select.appendChild(option); }
            select.value = state.active; show(state.active);
        };
        const load = () => this.menuToolsReady = send("get-tool-presets", undefined, data => { this.presetTools = data.tools; render(data.state); message("预设已读取"); });
        root.querySelector("#btnLoadPresets").addEventListener("click", load);
        root.querySelector("#toolPresetSelect").addEventListener("change", event => { if (this.presetState) show(event.target.value); });
        root.querySelector("#toolProfileMode").addEventListener("change", event => {
            if (!this.presetTools || event.target.value === "custom") return;
            checklist({ profile: event.target.value, enabled: [], disabled: [] });
        });
        root.querySelector("#btnSavePreset").addEventListener("click", () => {
            if (!this.presetState) return message("请先读取预设", true);
            const name = root.querySelector("#toolPresetName").value.trim(), profile = root.querySelector("#toolProfileMode").value;
            const enabled: string[] = [], disabled: string[] = [], actions = {};
            root.querySelectorAll("#toolChecklist input[data-tool]").forEach(input => (input.checked ? enabled : disabled).push(input.dataset.tool));
            for (const tool of this.presetTools) {
                const inputs = Array.from(root.querySelectorAll('#toolChecklist input[data-owner="' + tool.name + '"]'));
                const selected = inputs.filter((input: any) => input.checked).map((input: any) => input.dataset.action);
                if (inputs.length && selected.length && selected.length !== inputs.length) actions[tool.name] = selected;
            }
            const preset = { name, profile, enabled, disabled, actions };
            const state = { version: 1, active: name, presets: this.presetState.presets.filter(item => item.name !== name).concat(preset) };
            send("save-tool-presets", state, result => { render(result); message("已保存并启用；HTTP 即时生效，stdio 刷新工具目录。未自动更新的客户端请重新连接"); });
        });
        root.querySelector("#btnExportPresets").addEventListener("click", () => { if (this.presetState) { require("electron").clipboard.writeText(JSON.stringify(this.presetState, null, 2)); message("预设 JSON 已复制"); } });
        root.querySelector("#btnImportPresets").addEventListener("click", () => {
            if (!this.presetTools) return message("请先读取预设", true);
            try { const raw = require("electron").clipboard.readText(); if (raw.length > 128 * 1024) throw new Error("预设超过128KiB");
                send("save-tool-presets", JSON.parse(raw), result => { render(result); message("已导入并启用；未自动更新的客户端请重新连接"); });
            } catch (err) { message("导入失败：" + err.message, true); }
        });
        load();
    },

    renderCalls(calls) {
        const container = (this as any).shadowRoot.querySelector("#callHistory");
        const opened = new Set(Array.from(container.querySelectorAll("details[open]")).map((el: any) => el.dataset.callId));
        container.textContent = calls.length ? "" : "暂无调用";
        for (const call of calls) {
            const row = document.createElement("details"), title = document.createElement("summary"), body = document.createElement("pre");
            row.dataset.callId = call.callId; row.open = opened.has(call.callId);
            title.textContent = `${call.ok ? "✓" : "✗"} ${call.tool} · ${call.timings.totalMs}ms · ${new Date(call.at).toLocaleTimeString()}`;
            title.className = call.ok ? "" : "error";
            body.textContent = JSON.stringify(call, null, 2);
            row.appendChild(title); row.appendChild(body); container.appendChild(row);
        }
    },
	fetchMcpClients(els) {
		if (!els.mcpClientSelect) return Promise.resolve(false);
		if (this.clientScanPending) return this.clientScanPending;
		els.mcpConfigStatus.innerHTML = "<span style='color:#ffb74d'>正在扫描系统配置...</span>";
		this.clientScanPending = new Promise<boolean>(resolve => {
			Editor.Ipc.sendToMain("mcp-bridge:mcp-scan-clients", (err, clients) => {
				if (err) {
					els.mcpConfigStatus.innerHTML = `<span style='color:#f44336'>扫描失败: ${err.message}</span>`;
					resolve(false);
					return;
				}
				this.mcpClientsData = clients;
				const previousSelection = els.mcpClientSelect.value;
				els.mcpClientSelect.innerHTML = "";
				clients.forEach((client) => {
					const opt = document.createElement("option");
					opt.value = client.id;
					opt.textContent = client.name;
					els.mcpClientSelect.appendChild(opt);
				});
				const selected = clients.find(client => String(client.id) === previousSelection)
					|| clients.find(client => client.name === "Codex") || clients[0];
				if (selected) els.mcpClientSelect.value = String(selected.id);
				this.renderMcpClientStatus(els);
				resolve(clients.length > 0);
			});
		}).then(result => { this.clientScanPending = null; return result; });
		return this.clientScanPending;
	},

	renderMcpClientStatus(els) {
		if (!this.mcpClientsData || !els.mcpClientSelect.value) return;
		const clientId = parseInt(els.mcpClientSelect.value);
		const client = this.mcpClientsData.find((c) => c.id === clientId);
		if (!client) return;

		let statusHtml = `<div style="word-break: break-all;">储存路径: <span style="color:#aaa">${client.path || "未知"}</span></div>`;
		if (client.isError) {
			statusHtml += `<div style="color:#f44336; margin-top:5px; font-weight:bold;">🔴 配置文件损坏</div>`;
		} else if (!client.isInstalled) {
			statusHtml += `<div style="color:#f44336; margin-top:5px; font-weight:bold;">🔴 未安装此客户端或找不到配置文件</div>`;
		} else if (client.isConfigured) {
			statusHtml += `<div style="color:#4caf50; margin-top:5px; font-weight:bold;">🟢 当前已连通 (MCP已配置)</div>`;
		} else {
			statusHtml += `<div style="color:#ff9800; margin-top:5px; font-weight:bold;">🟡 发现配置目录，但尚未设置 MCP 服务</div>`;
		}
		els.mcpConfigStatus.innerHTML = statusHtml;
	},

	injectMcpConfig(clientId, els) {
		els.mcpConfigStatus.innerHTML += "<br><span style='color:#1976d2'>正在注入配置...</span>";
		Editor.Ipc.sendToMain("mcp-bridge:mcp-inject-client", clientId, (err, log) => {
			if (err) {
				this.renderLog({
					type: "error",
					time: new Date().toLocaleTimeString(),
					content: "配置失败: " + err.message,
				});
			} else {
				this.renderLog({
					type: "success",
					time: new Date().toLocaleTimeString(),
					content: "MCP 配置结果:\n" + log,
				});
			}
			// 回到主页以便查看日志
			if (els.tabMain) {
				els.tabMain.dispatchEvent(new Event("click"));
			}
			// 重新刷新下数据，但由于刚才跳到了主页所以下次回配置页时会刷新。
			setTimeout(() => this.fetchMcpClients(els), 500);
		});
	},

	/**
	 * 将日志条目渲染至面板控制台
	 * @param {Object} log 日志对象
	 */
	renderLog(log: any) {
		const view = (this as any).shadowRoot.querySelector("#logConsole") as HTMLElement;
		if (!view) return;
		// 限制面板日志 DOM 节点数量，防止长时间运行后面板卡顿
		while (view.childNodes.length > 1000) {
			view.removeChild(view.firstChild);
		}
		const atBottom = view.scrollHeight - view.scrollTop <= view.clientHeight + 50;
		const el = document.createElement("div");
		el.className = `log-item ${log.type}`;
		// 使用 textContent 代替 innerHTML 防止 XSS 注入
		const timeSpan = document.createElement("span");
		timeSpan.className = "time";
		timeSpan.textContent = log.time;
		const msgSpan = document.createElement("span");
		msgSpan.className = "msg";
		msgSpan.textContent = log.content;
		el.appendChild(timeSpan);
		el.appendChild(msgSpan);
		view.appendChild(el);
		if (atBottom) view.scrollTop = view.scrollHeight;
	},

	/**
	 * 根据服务器运行状态更新 UI 按钮文字与样式
	 * @param {boolean} active 服务器是否处于激活状态
	 */
	updateUI(active: boolean) {
		const btn = (this as any).shadowRoot.querySelector("#btnToggle") as HTMLElement;
		if (!btn) return;
		btn.innerText = active ? "停止" : "启动";
		
		// 移除直接 style 修改，通过 class 切换实现样式优雅过渡
		btn.style.backgroundColor = ""; 
		if (active) {
			btn.classList.add("running");
			btn.classList.remove("green");
		} else {
			btn.classList.remove("running");
			btn.classList.add("green");
		}
	},
});
