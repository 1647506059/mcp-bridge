import { BuildJobs } from "./core/BuildJobs";
import { EditorInput } from "./tools/EditorInput";
import { HttpServer } from './core/HttpServer';
import { McpRouter } from './core/McpRouter';
import { Logger } from './core/Logger';
import { IpcManager } from './IpcManager';
import { alignWithKnownTargets, resolveBuildDest, resolveBuildPlatform } from './utils/resolveBuildPlatform';
import { loadProjectProfile } from './core/ProjectProfile';
import { queryPanelStatus } from './core/PanelStatus';
import { CallActivity } from './core/CallActivity';
import { getToolsList } from './tools/ToolRegistry';
import { readToolPresets, saveToolPresets } from './tools/ToolPresetStore';
import { openPanelMenu } from './panel/MenuActions';
declare const Editor: any;
let autoStartTimer: any;
let loaded = false;

export = {
    'scene-script': 'scene-script.js',
    openTestPanel() {
        Editor.Panel.open('mcp-bridge');
    },
    openMenuAction(event, name) {
        openPanelMenu(Editor, name);
    },
    querySpriteFrameUuid(event, uuid) {
		const fs = require("fs");
		try {
			const url = Editor.assetdb.uuidToUrl(uuid);
			if (!url) {
				return event.reply && event.reply(null, null);
			}
			const fspath = Editor.assetdb.urlToFspath(url);
			if (!fspath) {
				return event.reply && event.reply(null, null);
			}
			const metaPath = fspath + ".meta";
			if (fs.existsSync(metaPath)) {
				const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
				if (meta && meta.subMetas) {
					const subKeys = Object.keys(meta.subMetas);
					for (let k of subKeys) {
						if (meta.subMetas[k].uuid) {
							return event.reply && event.reply(null, meta.subMetas[k].uuid);
						}
					}
				}
			}
			return event.reply && event.reply(null, null);
		} catch (e) {
			return event.reply && event.reply(null, null);
		}
	},
    getProfile() {
		// 'project' 表示存储在项目本地（settings/mcp-bridge.json），实现配置隔离
		return loadProjectProfile();
	},
    load() {
        loaded = true; clearTimeout(autoStartTimer);
        Logger.info('MCP Bridge Plugin Loaded');
        try {
            const os = require("os");
            Logger.info(`[系统指纹] 平台: ${os.platform()}, 架构: ${os.arch()}, CPU: ${os.cpus()[0]?.model || "未知"}, 内存: ${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`);
        } catch (e) {
            // 防御保护
        }
        let profile = this.getProfile();
        try { HttpServer.config.host = HttpServer.validateHost(profile.get("host") || "127.0.0.1"); }
        catch (err) { HttpServer.config.startError = err.message; Logger.error(err.message); return; }
        HttpServer.config.port = profile.get('last-port') || 8200;
        let autoStart = profile.get('auto-start');

        if (autoStart) {
            Logger.info('Auto-start is enabled. Initializing server...');
            autoStartTimer = setTimeout(() => {
                if (!loaded) return;
                this.startServer(HttpServer.config.port);
            }, 1000);
        }
    },
    unload() {
        EditorInput.shutdown();
        loaded = false; clearTimeout(autoStartTimer);
        this.stopServer();
        return Logger.flush();
    },
    startServer(port: number) {
        EditorInput.shutdown();
        HttpServer.start(port, McpRouter.handleRequest, actualPort => {
            const profile = this.getProfile(); profile.set("last-port", actualPort); profile.save();
        });
    },
    stopServer() {
        EditorInput.shutdown();
        HttpServer.stop();
    },
    messages: {
        "menu-action"(event, name) {
            this.openMenuAction(event, name);
        },
        "apply-host"(event, value) {
            try {
                const host = HttpServer.validateHost(value), profile = this.getProfile();
                const restart = HttpServer.config.active || !!profile.get("auto-start");
                profile.set("host", host); profile.save();
                if (restart) { EditorInput.shutdown(); HttpServer.start(HttpServer.config.port, McpRouter.handleRequest, port => { profile.set("last-port", port); profile.save(); }, host); }
                else { HttpServer.config.host = host; HttpServer.config.startError = null; }
                event.reply(null, { ...HttpServer.config });
            } catch (err) { event.reply(String(err.message || err)); }
        },
        "get-panel-status"(event) {
            queryPanelStatus(HttpServer.config).then(data => event.reply(null, { ...data, calls: CallActivity.list() }), err => event.reply(String(err)));
        },
        "clear-call-history"(event) { CallActivity.clear(); if (event.reply) event.reply(null); },
        "get-tool-presets"(event) {
            try { event.reply(null, { state: readToolPresets(Editor.Project.path, getToolsList()), tools: getToolsList() }); }
            catch (err) { event.reply(String(err.message || err)); }
        },
        "save-tool-presets"(event, state) {
            try { event.reply(null, saveToolPresets(Editor.Project.path, state, getToolsList())); }
            catch (err) { event.reply(String(err.message || err)); }
        },
        "restart-server"(event) {
            this.startServer(HttpServer.config.port);
            if (event.reply) event.reply(null);
        },
		"scan-ipc-messages"(event) {
			try {
				const msgs = IpcManager.getIpcMessages();
				if (event.reply) event.reply(null, msgs);
			} catch (e) {
				if (event.reply) event.reply(e.message);
			}
		},
		"test-ipc-message"(event, args) {
			const { name, params } = args;
			IpcManager.testIpcMessage(name, params).then((result) => {
				if (event.reply) event.reply(null, result);
			});
		},
		"open-test-panel"() {
			Editor.Panel.open("mcp-bridge");
		},

		"toggle-server"(event, port) {
			if (HttpServer.config.state !== "stopped") HttpServer.stop();
			else {
				// 用户手动启动时，保存偏好端口
				this.startServer(port);
			}
		},
		"clear-logs"() {
			Logger.clearLogs();
			Logger.info("日志已清理");
		},

		// 修改场景中的节点（需要通过 scene-script）
		"set-node-property"(event, args) {
			Logger.mcp(`设置节点属性: ${args.name} (${args.type})`);
			// 确保第一个参数 'mcp-bridge' 和 package.json 的 name 一致
			Editor.Scene.callSceneScript("mcp-bridge", "set-property", args, (err, result) => {
				if (err) {
					Editor.error("Scene Script Error:", err);
				}
				if (event && event.reply) {
					event.reply(err, result);
				}
			});
		},
		"create-node"(event, args) {
			Logger.mcp(`创建节点: ${args.name} (${args.type})`);
			Editor.Scene.callSceneScript("mcp-bridge", "create-node", args, (err, result) => {
				if (err) Logger.error(`创建节点失败: ${err}`);
				else Logger.success(`节点已创建: ${result}`);
				event.reply(err, result);
			});
		},
		"get-server-state"(event) {
			let profile = this.getProfile();
			event.reply(null, {
				config: HttpServer.config,
				logs: Logger.getLogs(),
				autoStart: profile.get("auto-start"),
				configuredPort: profile.get('last-port') || 8200,
				screenshotMaxWidth: profile.get("screenshot-max-width") !== undefined ? profile.get("screenshot-max-width") : 1280,
				screenshotThrottle: profile.get("screenshot-throttle") !== undefined ? profile.get("screenshot-throttle") : 1500
			});
		},

		"set-auto-start"(event, value) {
			this.getProfile().set("auto-start", value);
			this.getProfile().save();
			Logger.info(`自动启动已设置为: ${value}`);
		},

		"inspect-apis"() {
			Logger.info("[API 检查器] 开始深度分析...");

			// 获取函数参数的辅助函数
			const getArgs = (func) => {
				try {
					const str = func.toString();
					const match = str.match(/function\s.*?\(([^)]*)\)/) || str.match(/.*?\(([^)]*)\)/);
					if (match) {
						return match[1]
							.split(",")
							.map((arg) => arg.trim())
							.filter((a) => a)
							.join(", ");
					}
					return `${func.length} args`;
				} catch (e) {
					return "?";
				}
			};

			// 检查对象的辅助函数
			const inspectObj = (name, obj) => {
				if (!obj) return { name, exists: false };
				const props = {};
				const proto = Object.getPrototypeOf(obj);

				// 组合自身属性和原型属性
				const allKeys = new Set([
					...Object.getOwnPropertyNames(obj),
					...Object.getOwnPropertyNames(proto || {}),
				]);

				allKeys.forEach((key) => {
					if (key.startsWith("_")) return; // 跳过私有属性
					try {
						const val = obj[key];
						if (typeof val === "function") {
							props[key] = `func(${getArgs(val)})`;
						} else {
							props[key] = typeof val;
						}
					} catch (e) {}
				});
				return { name, exists: true, props };
			};

			// 1. 检查标准对象
			const standardObjects = {
				"Editor.assetdb": Editor.assetdb,
				"Editor.Selection": Editor.Selection,
				"Editor.Ipc": Editor.Ipc,
				"Editor.Panel": Editor.Panel,
				"Editor.Scene": Editor.Scene,
				"Editor.Utils": Editor.Utils,
				"Editor.remote": Editor.remote,
			};

			const report = {};
			Object.keys(standardObjects).forEach((key) => {
				report[key] = inspectObj(key, standardObjects[key]);
			});

			// 2. 检查特定论坛提到的 API
			const forumChecklist = [
				"Editor.assetdb.queryInfoByUuid",
				"Editor.assetdb.assetInfoByUuid",
				"Editor.assetdb.move",
				"Editor.assetdb.createOrSave",
				"Editor.assetdb.delete",
				"Editor.assetdb.urlToUuid",
				"Editor.assetdb.uuidToUrl",
				"Editor.assetdb.fspathToUrl",
				"Editor.assetdb.urlToFspath",
				"Editor.remote.assetdb.uuidToUrl",
				"Editor.Selection.select",
				"Editor.Selection.clear",
				"Editor.Selection.curSelection",
				"Editor.Selection.curGlobalActivate",
			];

			const checklistResults = {};
			forumChecklist.forEach((path) => {
				const parts = path.split(".");
				let curr = global; // 在主进程中，Editor 是全局的
				let exists = true;
				for (const part of parts) {
					if (curr && curr[part]) {
						curr = curr[part];
					} else {
						exists = false;
						break;
					}
				}
				checklistResults[path] = exists
					? typeof curr === "function"
						? `Available(${getArgs(curr)})`
						: "Available"
					: "Missing";
			});

			Logger.info(`[API 检查器] 标准对象:\n${JSON.stringify(report, null, 2)}`);
			Logger.info(`[API 检查器] 论坛核查清单:\n${JSON.stringify(checklistResults, null, 2)}`);

			// 3. 检查内置包 IPC 消息
			const ipcReport = {};
			const builtinPackages = ["scene", "builder", "assets"]; // 核心内置包
			const fs = require("fs");

			builtinPackages.forEach((pkgName) => {
				try {
					const pkgPath = Editor.url(`packages://${pkgName}/package.json`);
					if (pkgPath && fs.existsSync(pkgPath)) {
						const pkgData = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
						if (pkgData.messages) {
							ipcReport[pkgName] = Object.keys(pkgData.messages);
						} else {
							ipcReport[pkgName] = "No messages defined";
						}
					} else {
						ipcReport[pkgName] = "Package path not found";
					}
				} catch (e) {
					ipcReport[pkgName] = `Error: ${e.message}`;
				}
			});

			Logger.info(`[API 检查器] 内置包 IPC 消息:\n${JSON.stringify(ipcReport, null, 2)}`);
		},

		"mcp-scan-clients"(event) {
			try {
				const { scanMcpClients } = require('./McpConfigurator');
				if (event.reply) event.reply(null, scanMcpClients());
			} catch (e) {
				if (event.reply) event.reply(new Error(e.message));
			}
		},

		"mcp-inject-client"(event, clientId) {
			try {
				const { injectMcpConfig } = require('./McpConfigurator');
				const log = injectMcpConfig(clientId === -1 ? undefined : clientId);
				if (event.reply) event.reply(null, log);
			} catch (e) {
				if (event.reply) event.reply(new Error("写入报错: " + e.message));
			}
		},

		"mcp-get-payload"(event) {
			try {
				const { getPayload } = require('./McpConfigurator');
				if (event.reply) event.reply(null, getPayload());
			} catch (e) {
				if (event.reply) event.reply(new Error(e.message));
			}
		},

		"build-project"(event, args) {
            if (args?.action === "status") {
                try { const job = BuildJobs.get(args.jobId); event.reply(job.status === "failed" ? new Error(job.error) : null, job); } catch (err) { event.reply(err); }
                return;
            }
			const replyErr = (msg) => {
				const errObj = msg instanceof Error ? msg : new Error(String(msg));
				Editor.warn(`[mcp-bridge] ${errObj.message}`);
				if (event.reply) event.reply(errObj);
			};
			Editor.log(`[mcp-bridge] 接收到构建请求 IPC，平台: ${args && args.platform}`);
			Editor.Ipc.sendToMain('builder:query-build-options', (err, options) => {
				if (err) {
					replyErr(err);
					return;
				}
				if (!options) {
					replyErr("query-build-options 返回空配置");
					return;
				}
				Editor.log(`[mcp-bridge] 成功获取默认构建配置，准备调用 Editor.Builder.build`);

				const continueBuild = (startSceneUuid, scenes) => {
					try {
						if (!scenes.length || !startSceneUuid || !scenes.includes(startSceneUuid)) throw new Error("起始场景不在构建场景列表中，请检查场景和排除配置");

						let pair = resolveBuildPlatform(args && args.platform, options);
						const knownTargets = (Editor.Builder && Editor.Builder.simpleBuildTargets) || {};
						pair = alignWithKnownTargets(pair, knownTargets);
						if (pair.error) {
							replyErr(pair.error);
							return;
						}

						const destPath = resolveBuildDest(Editor.Project.path, options.buildPath, pair.actualPlatform);

						// 抓取被剔除的模块，参照官方 adapter 防御
						let excludedModules = options.excludedModules || [];
						try {
							const projJson = JSON.parse(require('fs').readFileSync(require('path').join(Editor.Project.path, 'settings', 'project.json'), 'utf8'));
							if (projJson['excluded-modules']) {
								excludedModules = projJson['excluded-modules'];
							}
						} catch(e) {}

						let buildOptions = Object.assign({}, options, {
							platform: pair.platform,
							actualPlatform: pair.actualPlatform,
							debug: !!(args && args.debug),
							dest: destPath,
							scenes: scenes,
							startScene: startSceneUuid,
							excludedModules: excludedModules
						});

						Editor.log(`[mcp-bridge] 开始构建项目，导出 ${pair.actualPlatform} 包到 ${destPath}`);
						Editor.log(`[mcp-bridge] 最终防御型 StartTask 参数: platform=${pair.platform}, actualPlatform=${pair.actualPlatform}, startScene=${startSceneUuid}, scenes.length=${scenes.length}`);

						if (typeof Editor.Builder?.build !== "function") throw new Error("当前编辑器不支持 Editor.Builder.build");
						const job = BuildJobs.begin({ platform: pair.platform, actualPlatform: pair.actualPlatform, dest: destPath });
                        try {
                            // start-task 是面板任务消息，2.4.15 不返回完成回执，会在180秒触发IPC超时。
                            // 与编辑器 buildCommand 一致，使用构建器本身的终态回调。
                            Editor.Builder.build(buildOptions, (err2, result) => BuildJobs.finish(job.jobId, err2, result));
                        } catch (err) { BuildJobs.finish(job.jobId, err, null); throw err; }
                        if (event.reply) event.reply(null, BuildJobs.get(job.jobId));
					} catch (e) {
						const msg = e && e.stack ? e.stack : String(e);
						try {
							Editor.error(`[mcp-bridge] 发起构建失败: ${msg}`);
						} catch (_e) {}
						replyErr(`发起构建失败: ${e && e.message ? e.message : e}`);
					}
				};

                const excluded = new Set(options.excludeScenes || []);
                const useScenes = scenes => {
                    const included = scenes.filter(uuid => !excluded.has(uuid));
                    continueBuild(options.startScene || included[0], included);
                };
                if (Array.isArray(options.scenes) && options.scenes.length) useScenes(options.scenes.slice());
                else {
                    // 与 buildCommand 一样补齐未排除的场景；query-build-options 可能返回空 scenes。
                    Editor.assetdb.queryAssets(null, 'scene', (error, assets) => {
                        if (error) return replyErr(error);
                        useScenes((assets || []).map(asset => asset.uuid));
                    });
                }
			});
		},

		"get-project-info"(event) {
			const info = {
				path: Editor.Project.path,
				version: Editor.App.version,
				openScene: Editor.currentSceneUuid
			};
			if (event.reply) event.reply(null, info);
		},
		"inspect-builder-targets"(event) {
			const summarizeBuilder = (obj) => {
				if (!obj) return { exists: false };
				let keys: string[] = [];
				try { keys = Object.keys(obj); } catch (e) { keys = ["<读取键失败: " + e.message + ">"]; }
				const out: any = { exists: true, keys };
				// 只读 simpleBuildTargets 的键，避免逐字段访问 getter 触发编辑器内部错误
				try {
					const sbt = (obj as any).simpleBuildTargets;
					if (sbt) {
						out.simpleBuildTargetsKeys = Object.keys(sbt);
					} else {
						out.simpleBuildTargets = "不存在的属性";
					}
				} catch (e) {
					out.simpleBuildTargetsReadError = String(e);
				}
				["build", "buildProject", "startTask", "applyBuildOptions"].forEach((m) => {
					try { out[m + "IsFunction"] = typeof (obj as any)[m] === "function"; }
					catch (e) { out[m + "IsFunction"] = "读取出错: " + e.message; }
				});
				// 读取 build/buildCommand 函数源码，理解 platform 用法
				["build", "buildCommand", "compile"].forEach((m) => {
					try {
						const fn = (obj as any)[m];
						if (typeof fn === "function") {
							const src = fn.toString();
							out[m + "Src"] = src.length > 800 ? src.slice(0, 800) + "..." : src;
						}
					} catch (e) { out[m + "Src"] = "读取失败: " + e.message; }
				});
				// 读取 actualPlatform2Platform 映射（编辑器如何把 actual 映射回 platform）
				try {
					const map = (obj as any).actualPlatform2Platform;
					if (map) {
						const entries = {};
						Object.keys(map).forEach(k => { try { entries[k] = map[k]; } catch (_e) {} });
						out.actualPlatform2Platform = entries;
					}
				} catch (e) { out.actualPlatform2PlatformError = String(e); }
				return out;
			};
			let replied = false;
			const finish = (err, result) => {
				if (replied) return;
				replied = true;
				try {
					const safeResult = err ? null : JSON.parse(JSON.stringify(result));
					if (event.reply) event.reply(err, err ? null : safeResult);
				} catch (e) {
					try { if (event.reply) event.reply("inspect-builder-targets 序列化失败: " + e.message, null); }
					catch (_e) { /* ignore */ }
				}
			};
			let resultRef = { current: ({} as any) };
			const result = ({} as any);
			resultRef.current = result;
			// 兜底：无论 query-build-options 是否响应，2 秒内必须返回已收集的数据
			const timeoutId = setTimeout(() => { finish(null, resultRef.current); }, 2000);
			try {
				result.project = Editor.Project.path;
				result.builderGlobal = summarizeBuilder(Editor.Builder);
			} catch (e) {
				result.builderReadError = String(e);
				clearTimeout(timeoutId);
				return finish(null, result);
			}
			// 查询默认构建选项，看编辑器当前认识的 platform
			try {
				Editor.Ipc.sendToMain("builder:query-build-options", (err, options) => {
					clearTimeout(timeoutId);
					try {
						if (err) {
							result.queryBuildOptionsError = String(err);
						} else if (options) {
							result.queryBuildOptions = {
								platform: options.platform,
								actualPlatform: options.actualPlatform,
								buildPath: options.buildPath,
								dest: options.dest,
								startScene: options.startScene,
								scenesCount: options.scenes ? options.scenes.length : 0,
								platformsKeyCount: options.platforms ? (Array.isArray(options.platforms) ? options.platforms.length : Object.keys(options.platforms).length) : undefined,
							};
						} else {
							result.queryBuildOptions = null;
						}
					} catch (e) {
						result.queryBuildOptionsError = "解析失败: " + e.message;
					}
					finish(null, result);
				});
			} catch (e) {
				clearTimeout(timeoutId);
				result.queryBuildOptionsError = "sendToMain 失败: " + e.message;
				finish(null, result);
			}
		},
		"set-screenshot-settings"(event, args) {
			try {
				let profile = this.getProfile();
				let maxWidth = Number(args.maxWidth);
				let throttle = Number(args.throttle);
				
				// 参数防呆校验
				if (isNaN(maxWidth) || maxWidth < 100) maxWidth = 1280;
				if (isNaN(throttle) || throttle < 0) throttle = 1500;
				
				profile.set("screenshot-max-width", maxWidth);
				profile.set("screenshot-throttle", throttle);
				profile.save();
				
				Logger.info(`[配置更新] 截图优化设置已保存：最大宽度 = ${maxWidth}px，节流 = ${throttle}ms`);
				if (event.reply) event.reply(null, "OK");
			} catch (e) {
				Logger.error(`保存设置失败: ${e.message}`);
				if (event.reply) event.reply(e.message);
			}
		}
	},

	/**
	 * 全局项目文件搜索 (支持正则表达式、文件名、目录名搜索)
	 * @param {Object} args 参数
	 * @param {Function} callback 完成回调
	 */
};
