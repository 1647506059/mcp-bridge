import { readBounded } from "../utils/AtomicFile";
import * as fs from 'fs';
import * as pathModule from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import { Logger } from './Logger';
import { CommandQueue } from './CommandQueue';
import { searchProject } from '../tools/ProjectSearch';
declare const Editor: any;

export class McpWrappers {
  static getResourcesList() {
		return [
			{
				uri: "cocos://hierarchy",
				name: "Scene Hierarchy",
				description: "当前场景层级的 JSON 快照",
				mimeType: "application/json",
			},
			{
				uri: "cocos://selection",
				name: "Current Selection",
				description: "当前选中节点的 UUID 列表",
				mimeType: "application/json",
			},
			{
				uri: "cocos://logs/latest",
				name: "Editor Logs",
				description: "最新的编辑器日志 (内存缓存)",
				mimeType: "text/plain",
			},
		];
	}

	/**
	 * 读取指定的 MCP 资源内容
	 * @param {string} uri 资源统一资源标识符 (URI)
	 * @param {Function} callback 完成回调 (err, content)
	 */

  static handleReadResource(uri, callback) {
		let parsed;
		try {
			parsed = new URL(uri);
		} catch (e) {
			return callback(`Invalid URI: ${uri}`);
		}

		if (parsed.protocol !== "cocos:") {
			return callback(`Unsupported protocol: ${parsed.protocol}`);
		}

		const type = parsed.hostname; // hierarchy, selection, logs

		switch (type) {
			case "hierarchy":
				// 注意: query-hierarchy 是异步的
				Editor.Ipc.sendToPanel("scene", "scene:query-hierarchy", (err, sceneId, hierarchy) => {
					if (err) return callback(err);
					callback(null, JSON.stringify(hierarchy, null, 2));
				});
				break;

			case "selection":
				const selection = Editor.Selection.curSelection("node");
				callback(null, JSON.stringify(selection));
				break;

			case "logs":
				callback(null, Logger.getLogContent());
				break;

			default:
				callback(`Resource not found: ${uri}`);
				break;
		}
	}

	/**
	 * 处理来自 HTTP 的 MCP 调用请求
	 * @param {string} name 工具名称
	 * @param {Object} args 工具参数
	 * @param {Function} callback 完成回调 (err, result)
	 */

  static searchProject(args, callback) {
        let rootUrl = args.path || "db://assets";
        if (rootUrl === "db://" || rootUrl === "db:") rootUrl = "db://assets";
        const root = Editor.assetdb.urlToFspath(rootUrl);
        if (!root) return callback(`无效的搜索路径: ${rootUrl}`);
        searchProject(args, root, Editor.assetdb.urlToFspath("db://assets"))
            .then(result => callback(null, result), err => callback(`项目搜索失败: ${err.message}`));
    }

	/**
	 * 管理撤销/重做操作及事务分组
	 * @param {Object} args 参数 (action, description, id)
	 * @param {Function} callback 完成回调
	 */

  static manageUndo(args, callback) {
		const { action } = args;

        if (["begin_group", "end_group", "cancel_group"].includes(action)) {
            CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "manage-undo-group", args, callback);
            return;
        }

		try {
			switch (action) {
				case "undo":
					Editor.Ipc.sendToPanel("scene", "scene:undo");
					callback(null, "撤销指令已执行");
					break;
				case "redo":
					Editor.Ipc.sendToPanel("scene", "scene:redo");
					callback(null, "重做指令已执行");
					break;
				default:
					callback(`未知的撤销操作: ${action}`);
			}
		} catch (err) {
			callback(`撤销操作失败: ${err.message}`);
		}
	}

	/**
	 * 计算资源的 SHA-256 哈希值
	 * @param {Object} args 参数 (path)
	 * @param {Function} callback 完成回调
	 */

  static async getSha(args, callback) {
		const { path: url } = args;
		const fspath = Editor.assetdb.urlToFspath(url);

		if (!fspath || !fs.existsSync(fspath)) {
			return callback(`找不到文件: ${url}`);
		}

		try {
			const fileBuffer = await readBounded(fspath, 32 * 1024 * 1024);
			const hashSum = crypto.createHash("sha256");
			hashSum.update(fileBuffer);
			const sha = hashSum.digest("hex");
			callback(null, { path: url, sha: sha });
		} catch (err) {
			callback(`计算 SHA 失败: ${err.message}`);
		}
	}

	/**
	 * 管理节点动画 (播放、停止、获取信息等)
	 * @param {Object} args 参数
	 * @param {Function} callback 完成回调
	 */

  static manageAnimation(args, callback) {
		// 转发给场景脚本处理
		CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "manage-animation", args, callback);
	}



}
