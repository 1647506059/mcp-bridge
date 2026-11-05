import { sceneQuery, childVersion } from "./tools/SceneQuery";

"use strict";
import { queryComponents, validateComponentQuery } from "./tools/ComponentQuery";
import { getRuntimeInfo } from "./core/BuildInfo";
import { executeBatch, SCENE_BATCH_METHODS } from "./tools/BatchOperations";
import { getToolsList } from "./tools/ToolRegistry";
import { buttonEvents } from "./tools/ButtonEvents";
import { startJavascript } from "./tools/ScriptExecution";
import { executeSceneCapability } from "./tools/SceneCapabilities";
import { UndoGroups } from "./tools/UndoGroups";
const undoGroups = new UndoGroups();

let activeSceneBatch: any = null;
function notifySceneChanged(event, uuid?: string) {
    const notifications = event.mcpBatchNotifications;
    if (notifications?.active) {
        notifications.dirty = true;
        if (uuid) notifications.changed.add(uuid);
    } else {
        Editor.Ipc.sendToMain("scene:dirty");
        if (uuid) Editor.Ipc.sendToAll("scene:node-changed", { uuid });
    }
}

/**
 * 更加健壮的节点查找函数，支持解压后的 UUID
 * @param {string} id 节点的 UUID (支持 22 位压缩格式)
 * @returns {cc.Node | null} 找到的节点对象或 null
 */
const findNode = (id) => {
    if (!id) return null;
    let node = cc.engine.getInstanceById(id);
    if (!node && typeof Editor !== "undefined" && Editor.Utils && Editor.Utils.UuidUtils) {
        // 如果直接查不到，尝试对可能是压缩格式的 ID 进行解压后再次查找
        try {
            const decompressed = Editor.Utils.UuidUtils.decompressUuid(id);
            if (decompressed !== id) {
                node = cc.engine.getInstanceById(decompressed);
            }
        } catch (e) {
            // 忽略转换错误
        }
    }
    return node;
};

function loadSceneAsset(uuid): Promise<any> {
    return new Promise((resolve, reject) => {
        let settled = false;
        cc.assetManager.loadAny(uuid, (err, asset) => {
            if (settled) return;
            settled = true;
            if (err || !asset) reject(new Error(String(err && (err.message || err) || "资源返回空值")));
            else resolve(asset);
        });
    });
}

const sceneTools = {
    "manage-undo-group": function (event, args) {
        try {
            const result = undoGroups.execute(args.action, args, cc.director.getScene(), findNode, Editor.require("scene://undo"));
            if (result.cancelled) notifySceneChanged(event);
            event.reply(null, result);
        } catch (error) { event.reply(new Error(error.message || error)); }
    },
    "execute-javascript": async function (event, args) {
        try {
            const execution = startJavascript(args, { context: "scene", cc, Editor, require, scene: cc.director.getScene(), director: cc.director,
                markSceneDirty: uuid => notifySceneChanged(event, uuid) });
            const packet = await execution.completion;
            event.reply(null, packet);
        } catch (err) { event.reply(new Error(err.message || err)); }
    },
    "execute-capability": async function (event, request) {
        try { event.reply(null, await executeSceneCapability(request.tool, request.args, cc, findNode, loadSceneAsset, uuid => notifySceneChanged(event, uuid))); }
        catch (err) { event.reply(new Error(err.message || err)); }
    },
    "execute-scene-batch": function (event, args) {
        if (activeSceneBatch) return event.reply(new Error("场景批处理正在执行"));
        if (!Array.isArray(args.operations) || args.operations.some(op => !Object.prototype.hasOwnProperty.call(SCENE_BATCH_METHODS, op?.tool))) return event.reply(new Error("该工具不支持场景批处理"));
        const notifications = { active: true, dirty: false, changed: new Set<string>() };
        activeSceneBatch = notifications;
        const scene = cc.director.getScene();
        const deadlineAt = Math.min(args.deadlineAt || Infinity, Date.now() + 14000);
        const flush = () => {
            notifications.active = false;
            if (notifications.dirty) Editor.Ipc.sendToMain("scene:dirty");
            for (const uuid of notifications.changed) Editor.Ipc.sendToAll("scene:node-changed", { uuid });
            notifications.dirty = false; notifications.changed.clear();
        };
        // 超时先释放本批的通知收集；仍等真实完成回执，让主进程继续保持写锁。
        const watchdog = setTimeout(flush, Math.max(0, deadlineAt - Date.now()));
        const finish = (err, result?) => {
            clearTimeout(watchdog);
            if (activeSceneBatch === notifications) activeSceneBatch = null;
            try { flush(); } finally { event.reply(err, result); }
        };
        executeBatch(args, args.allowedTools || getToolsList(), (tool, params, done) => {
            if (cc.director.getScene() !== scene) return done("场景已变化，未执行该步骤");
            const method = Object.prototype.hasOwnProperty.call(SCENE_BATCH_METHODS, tool) && SCENE_BATCH_METHODS[tool];
            if (!method) return done("该工具不支持场景批处理");
            if (tool === "create_node") params = { ...params, defaultSpriteUuid: args.defaultSpriteUuid };
            const pending = sceneTools[method]({ reply: done, mcpBatchNotifications: notifications }, params);
            if (pending?.catch) pending.catch(done);
        }, finish, { deadlineAt });
    },
    "get-prefab-update-state": function (event, args) {
        try {
            const node = findNode(args.nodeId);
            if (!node) throw new Error(`找不到节点: ${args.nodeId}`);
            const root = node._prefab && node._prefab.root;
            const asset = root && root._prefab && root._prefab.asset;
            const scene: any = cc.director.getScene();
            const activeRoot = scene && scene.children.find(child => child._prefab && child._prefab.asset);
            const mode = Editor.require("scene://edit-mode").curMode();
            event.reply(null, { rootId: root && root.uuid, assetUuid: asset && asset._uuid,
                mode: mode && mode.name, activePrefabUuid: activeRoot && activeRoot._prefab.asset._uuid });
        } catch (err) { event.reply(new Error(err.message || err)); }
    },
    "button-events": function (event, args) {
        try {
            const result = buttonEvents(args, findNode, cc);
            if (result.bound) notifySceneChanged(event, args.nodeId);
            event.reply(null, result);
        } catch (err) { event.reply(new Error(err.message || err)); }
    },
    "get-mcp-runtime-info": function (event) {
        event.reply(null, getRuntimeInfo("scene", __filename));
    },
    "get-node-name": function (event, args) {
        const node = findNode(args.id);
        if (!node) return event.reply(new Error(`找不到节点: ${args.id}`));
        event.reply(null, { uuid: node.uuid, name: node.name });
    },
    "get-edit-state": function (event) {
        try {
            const editMode = Editor.require("scene://edit-mode");
            const mode = editMode.curMode();
            const scene: any = cc.director.getScene();
            const root = scene && scene.children.find(node => node._prefab && node._prefab.asset);
            event.reply(null, {
                mode: mode && mode.name,
                sceneUuid: scene && scene.uuid,
                prefabUuid: root && root._prefab.asset._uuid,
                url: mode && mode.title,
            });
        } catch (e) { event.reply(new Error("读取编辑模式失败: " + e.message)); }
    },
    /**
     * 修改节点的基础属性
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (id, path, value)
     */
    "set-property": function (event, args) {
        const { id, path, value } = args;

        // 1. 获取节点
        let node = findNode(id);

        if (node) {
            // 2. 修改属性
            if (path === "name") {
                node.name = value;
            } else {
                node[path] = value;
            }

            // 3. 【解决报错的关键】告诉编辑器场景变脏了（需要保存）
            // 在场景进程中，我们发送 IPC 给主进程
            Editor.Ipc.sendToMain("scene:dirty");

            // 4. 【额外补丁】通知层级管理器（Hierarchy）同步更新节点名称
            // 否则你修改了名字，层级管理器可能还是显示旧名字
            Editor.Ipc.sendToAll("scene:node-changed", {
                uuid: id,
            });

            if (event.reply) {
                event.reply(null, `节点 ${id} 已更新为 ${value}`);
            }
        } else {
            if (event.reply) {
                event.reply(new Error("场景脚本：找不到节点 " + id));
            }
        }
    },
    /**
     * 获取当前场景的完整层级树
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (nodeId, depth, includeDetails)
     */
    "get-hierarchy": function (event, args) {
        const { nodeId = null, depth = 2, includeDetails = false } = args || {};
        const scene = cc.director.getScene();

        let rootNode = scene;
        if (nodeId) {
            rootNode = findNode(nodeId);
            if (!rootNode) {
                if (event.reply) event.reply(new Error(`找不到指定的起始节点: ${nodeId}`));
                return;
            }
        }

        /**
         * 递归遍历并序列化节点树
         * @param {cc.Node} node 目标节点
         * @param {number} currentDepth 当前深度
         * @returns {Object|null} 序列化后的节点数据
         */
        let visited = 0, hierarchyBytes = 0;
        function dumpNodes(node, currentDepth) {
            if (++visited > 2000 || (hierarchyBytes += (node?.name?.length || 0) * 3 + 512) > 2 * 1024 * 1024) throw new Error("层级预算耗尽，请缩小根节点或深度");
            // 【优化】跳过编辑器内部的私有节点，减少数据量
            if (
                !node ||
                !node.name ||
                (typeof node.name === "string" && (node.name.startsWith("Editor Scene") || node.name === "gizmoRoot"))
            ) {
                return null;
            }

            let nodeData: any = {
                name: node.name,
                uuid: node.uuid,
                childrenCount: node.childrenCount,
            };

            const comps = node._components || [];

            // 根据是否需要详情来决定附加哪些数据以节省 Token
            if (includeDetails) {
                nodeData.active = node.active;
                nodeData.position = { x: Math.round(node.x), y: Math.round(node.y) };
                nodeData.rotation = node.angle;
                nodeData.scale = { x: node.scaleX, y: node.scaleY };
                nodeData.anchor = { x: node.anchorX, y: node.anchorY };
                nodeData.size = { width: node.width, height: node.height };
                nodeData.color = { r: node.color.r, g: node.color.g, b: node.color.b };
                nodeData.opacity = node.opacity;
                nodeData.skew = { x: node.skewX, y: node.skewY };
                nodeData.group = node.group;
                nodeData.components = comps.map((c) => cc.js.getClassName(c));
            } else {
                // 简略模式下如果存在组件，至少提供一个极简列表让 AI 知道节点的作用
                if (comps.length > 0) {
                    nodeData.components = comps.map((c) => {
                        const parts = (cc.js.getClassName(c) || "").split(".");
                        return parts[parts.length - 1]; // 只取类名，例如 cc.Sprite -> Sprite
                    });
                }
            }

            // 如果未超出深度限制，继续递归子树（每层最多返回 50 个子节点作为安全上限）
            const MAX_CHILDREN_PER_LEVEL = Math.min(100, Math.max(1, args.childPageSize || 50));
            const offset = currentDepth === 0 ? args.childOffset || 0 : 0;
            const version = childVersion(cc.director.getScene(), node);
            if (currentDepth === 0 && args.childVersion && args.childVersion !== version) throw new Error("子节点集合或场景已变化，请重新读取");
            if (currentDepth < depth && node.childrenCount > 0) {
                nodeData.children = [];
                const childLimit = Math.min(node.childrenCount, offset + MAX_CHILDREN_PER_LEVEL);
                for (let i = offset; i < childLimit; i++) {
                    let childData = dumpNodes(node.children[i], currentDepth + 1);
                    if (childData) nodeData.children.push(childData);
                }
                if (node.childrenCount > childLimit) {
                    nodeData.nextChildrenQuery = { nodeId: node.uuid, childOffset: childLimit, childVersion: version, depth: depth - currentDepth };
                    nodeData.childrenTruncated = node.childrenCount - childLimit;
                }
            }

            return nodeData;
        }

        try {
            const hierarchy = dumpNodes(rootNode, 0);
            if (event.reply) event.reply(null, hierarchy);
        } catch (err) { event.reply(err); }
    },

    /**
     * 批量更新节点的变换信息 (坐标、缩放、颜色等)
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (id, x, y, rotation, scaleX, scaleY, anchorX, anchorY, color, opacity, skewX, skewY, width, height)
     */
    "update-node-transform": function (event, args) {
        const { id, x, y, scaleX, scaleY, color } = args;

        let node = findNode(id);

        if (node) {
            // 直接赋值，确保同步生效
            if (x !== undefined) {
                node.x = Number(x);
            }
            if (y !== undefined) {
                node.y = Number(y);
            }
            if (args.rotation !== undefined) {
                node.angle = Number(args.rotation);
            }
            if (args.width !== undefined) {
                node.width = Number(args.width);
            }
            if (args.height !== undefined) {
                node.height = Number(args.height);
            }
            if (scaleX !== undefined) {
                node.scaleX = Number(scaleX);
            }
            if (scaleY !== undefined) {
                node.scaleY = Number(scaleY);
            }
            if (args.anchorX !== undefined) {
                node.anchorX = Number(args.anchorX);
            }
            if (args.anchorY !== undefined) {
                node.anchorY = Number(args.anchorY);
            }
            if (color) {
                node.color = new cc.Color().fromHEX(color);
            }
            if (args.opacity !== undefined) {
                node.opacity = Number(args.opacity);
            }
            if (args.skewX !== undefined) {
                node.skewX = Number(args.skewX);
            }
            if (args.skewY !== undefined) {
                node.skewY = Number(args.skewY);
            }
            if (args.active !== undefined) {
                node.active = !!args.active;
            }

            notifySceneChanged(event, id);

            if (event.reply) event.reply(null, "变换信息已更新");
        } else {
            if (event.reply) event.reply(new Error("找不到节点"));
        }
    },
    /**
     * 在场景中创建新节点
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (name, parentId, type)
     */
    "create-node": async function (event, args) {
        let newNode = null;
        try {
        const { name, parentId, type } = args;
        const scene = cc.director.getScene();
        if (!scene) {
            if (event.reply) event.reply(new Error("场景尚未准备好或正在加载。"));
            return;
        }

        if (parentId && !findNode(parentId)) throw new Error(`找不到父节点: ${parentId}`);

        // 特殊处理：如果是创建 Canvas，自动设置好适配
        if (type === "canvas" || (name === "Canvas" && !["sprite", "label", "button", "camera"].includes(type))) {
            newNode = new cc.Node(name || "Canvas");
            let canvas = newNode.addComponent(cc.Canvas);
            newNode.addComponent(cc.Widget);
            // 设置默认设计分辨率
            canvas.designResolution = cc.size(960, 640);
            canvas.fitHeight = true;
            // 自动在 Canvas 下创建一个 Camera
            let camNode = new cc.Node("Main Camera");
            camNode.addComponent(cc.Camera);
            camNode.parent = newNode;
        } else if (type === "camera") {
            newNode = new cc.Node(name || "Camera");
            newNode.addComponent(cc.Camera);
        } else if (type === "sprite") {
            newNode = new cc.Node(name || "新建精灵节点");
            let sprite = newNode.addComponent(cc.Sprite);
            // 设置为 CUSTOM 模式
            sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            // 为精灵设置默认尺寸
            newNode.width = 100;
            newNode.height = 100;

            // 加载引擎默认图做占位
            if (args.defaultSpriteUuid) {
                const asset = await loadSceneAsset(args.defaultSpriteUuid);
                if (!(asset instanceof cc.SpriteFrame || asset instanceof cc.Texture2D)) throw new Error("默认贴图类型不匹配");
                sprite.spriteFrame = asset instanceof cc.SpriteFrame ? asset : new cc.SpriteFrame(asset);
            }
        } else if (type === "button") {
            newNode = new cc.Node(name || "新建按钮节点");
            let sprite = newNode.addComponent(cc.Sprite);
            newNode.addComponent(cc.Button);

            // 设置为 CUSTOM 模式并应用按钮专用尺寸
            sprite.sizeMode = cc.Sprite.SizeMode.CUSTOM;
            newNode.width = 150;
            newNode.height = 50;

            // 设置稍暗的背景颜色 (#A0A0A0)，以便于看清其上的文字
            newNode.color = new cc.Color(160, 160, 160);
            const labelNode = new cc.Node("Label");
            labelNode.addComponent(cc.Label).string = args.text === undefined ? "Button" : args.text;
            labelNode.parent = newNode;

            // 加载引擎默认图
            if (args.defaultSpriteUuid) {
                const asset = await loadSceneAsset(args.defaultSpriteUuid);
                if (!(asset instanceof cc.SpriteFrame || asset instanceof cc.Texture2D)) throw new Error("默认贴图类型不匹配");
                sprite.spriteFrame = asset instanceof cc.SpriteFrame ? asset : new cc.SpriteFrame(asset);
            }
        } else if (type === "label") {
            newNode = new cc.Node(name || "新建文本节点");
            let l = newNode.addComponent(cc.Label);
            l.string = args.text === undefined ? "新文本" : args.text;
            if (args.fontSize !== undefined) l.fontSize = args.fontSize;
            newNode.width = 120;
            newNode.height = 40;
        } else {
            newNode = new cc.Node(name || "新建节点");
        }

        if (args.width !== undefined) newNode.width = args.width;
        if (args.height !== undefined) newNode.height = args.height;
        if (cc.director.getScene() !== scene) throw new Error("资源加载期间场景已变化，未挂载新节点");
        // 设置层级
        let parent = null;
        if (parentId) {
            parent = findNode(parentId);
        } else {
            // 【Canvas Sniffing】如果是 UI 节点且未指定 parentId，尝试挂载到 Canvas
            if (type === "sprite" || type === "button" || type === "label") {
                const canvasComp = scene.getComponentInChildren(cc.Canvas);
                if (canvasComp) {
                    parent = canvasComp.node;
                }
            }
            if (!parent) parent = scene;
        }
        if (parent && (!cc.isValid || cc.isValid(parent))) {
            newNode.parent = parent;

            // 【Auto Layout】自动挂载和配置 cc.Widget
            if (args.layout) {
                let widget = newNode.addComponent(cc.Widget);
                // 默认对齐模式为 ONCE
                widget.alignMode = cc.Widget.AlignMode.ONCE;

                switch (args.layout) {
                    case "center":
                        widget.isAlignHorizontalCenter = true;
                        widget.isAlignVerticalCenter = true;
                        widget.horizontalCenter = 0;
                        widget.verticalCenter = 0;
                        break;
                    case "full":
                        widget.isAlignTop = true;
                        widget.isAlignBottom = true;
                        widget.isAlignLeft = true;
                        widget.isAlignRight = true;
                        widget.top = 0;
                        widget.bottom = 0;
                        widget.left = 0;
                        widget.right = 0;
                        break;
                    case "top":
                        widget.isAlignTop = true;
                        widget.isAlignHorizontalCenter = true;
                        widget.top = 0;
                        widget.horizontalCenter = 0;
                        break;
                    case "bottom":
                        widget.isAlignBottom = true;
                        widget.isAlignHorizontalCenter = true;
                        widget.bottom = 0;
                        widget.horizontalCenter = 0;
                        break;
                    case "left":
                        widget.isAlignLeft = true;
                        widget.isAlignVerticalCenter = true;
                        widget.left = 0;
                        widget.verticalCenter = 0;
                        break;
                    case "right":
                        widget.isAlignRight = true;
                        widget.isAlignVerticalCenter = true;
                        widget.right = 0;
                        widget.verticalCenter = 0;
                        break;
                    case "top-left":
                        widget.isAlignTop = true;
                        widget.isAlignLeft = true;
                        widget.top = 0;
                        widget.left = 0;
                        break;
                    case "top-right":
                        widget.isAlignTop = true;
                        widget.isAlignRight = true;
                        widget.top = 0;
                        widget.right = 0;
                        break;
                    case "bottom-left":
                        widget.isAlignBottom = true;
                        widget.isAlignLeft = true;
                        widget.bottom = 0;
                        widget.left = 0;
                        break;
                    case "bottom-right":
                        widget.isAlignBottom = true;
                        widget.isAlignRight = true;
                        widget.bottom = 0;
                        widget.right = 0;
                        break;
                }
            }
            // 不要在这里同步调用 widget.updateAlignment()，因为此刻场景树的世界矩阵可能未刷新，
            // 导致 cc.Widget 计算出双倍的错误坐标（如将 405 算成 810）。
            // 让 Cocos 引擎在下一帧自动接管并对齐！

            // 【优化】通知主进程场景变脏
            notifySceneChanged(event);

            // 【关键】使用 setTimeout 延迟通知 UI 刷新，让出主循环
            setTimeout(() => {
                Editor.Ipc.sendToAll("scene:node-created", {
                    uuid: newNode.uuid,
                    parentUuid: parent.uuid,
                });
            }, 10);

            if (event.reply) {
                // 如果父节点有 Canvas，返回设计分辨率信息
                let canvasInfo = "";
                let canvasComp = parent.getComponent(cc.Canvas);
                if (canvasComp) {
                    canvasInfo = `CanvasSize(${parent.width}x${parent.height}) Design(${canvasComp.designResolution.width}x${canvasComp.designResolution.height})`;
                }
                const message = `节点创建成功 UUID: ${newNode.uuid}, 已挂载至 ${parent.name}${canvasInfo ? ' ' + canvasInfo : ''}. ComputedPos: (${newNode.x}, ${newNode.y})`;
                event.reply(null, args.returnDetails ? { uuid: newNode.uuid, name: newNode.name, parentId: parent.uuid, message } : message);
            }
        } else {
            if (event.reply) event.reply(new Error(`无法创建节点：找不到父节点 ${parentId}`));
        }
        } catch (err) {
            if (newNode && typeof newNode.destroy === "function") newNode.destroy();
            if (event.reply) event.reply(new Error("创建节点失败: " + (err.message || err)));
        }
    },

    /**
     * 管理节点上的组件 (添加、移除、更新属性)
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (nodeId, action, componentType, componentId, properties)
     */
    "manage-components": async function (event, args) {
        let { nodeId, action, operation, componentType, componentId, properties } = args;
        // 兼容 AI 幻觉带来的传参错误
        action = action || operation;

        if (action === "get") {
            try {
                validateComponentQuery(args);
                if (args.nodeIds) {
                    const results = args.nodeIds.map(id => {
                        const target = findNode(id);
                        return target ? { nodeId: id, components: queryComponents(target, args, cc) }
                            : { nodeId: id, error: "找不到节点", components: [] };
                    });
                    if (event.reply) event.reply(null, results);
                } else {
                    const target = findNode(nodeId);
                    if (!target) throw new Error("找不到节点");
                    if (event.reply) event.reply(null, queryComponents(target, args, cc));
                }
            } catch (err) { if (event.reply) event.reply(new Error(`获取组件失败: ${err.message}`)); }
            return;
        }
        if (args.nodeIds !== undefined) {
            if (event.reply) event.reply(new Error("nodeIds 仅适用于 get，写操作必须提供单个 nodeId"));
            return;
        }
        let node = findNode(nodeId);

        /** 加载并校验单个资源，保留项目子资源映射。 */
        const loadAssetValue = (uuid, key, propertyType): Promise<any> => new Promise((resolve, reject) => {
            if (uuid === null) return resolve(null);
            if (typeof uuid !== "string" || !Editor.Utils.UuidUtils.isUuid(uuid)) {
                return reject(new Error(`${key} 的资源引用必须为有效 UUID 或 null`));
            }
            const needsSpriteFrame = propertyType === cc.SpriteFrame || key.toLowerCase().includes("sprite");
            let targetUuid = uuid;
            // 保留项目的 Texture2D → SpriteFrame 子资源转换。
            if (needsSpriteFrame && Editor.assetdb && Editor.assetdb.remote) {
                try {
                    const fs = require("fs");
                    const fspath = Editor.assetdb.remote.uuidToFspath(uuid);
                    if (fspath && fs.existsSync(fspath + ".meta")) {
                        const meta = JSON.parse(fs.readFileSync(fspath + ".meta", "utf-8"));
                        for (const subKey of Object.keys(meta.subMetas || {})) {
                            const subMeta = meta.subMetas[subKey];
                            if (subMeta && subMeta.uuid) {
                                targetUuid = subMeta.uuid;
                                Editor.log(`[scene-script] 自动转换 UUID: ${uuid} (Texture2D) -> ${targetUuid} (SpriteFrame)`);
                                break;
                            }
                        }
                    }
                } catch (err) { Editor.log(`[scene-script] 读取 meta 失败: ${err.message}`); }
            }
            cc.AssetLibrary.loadAsset(targetUuid, (err, asset) => {
                if (err || !asset) return reject(new Error(`加载 ${key} 的资源 ${targetUuid} 失败: ${err && (err.message || err) || "返回空资源"}`));
                if (needsSpriteFrame && asset instanceof cc.Texture2D) {
                    return reject(new Error(`${key} 需要 SpriteFrame，资源 ${targetUuid} 仍是 Texture2D`));
                }
                resolve(asset);
            });
        });

        /** 应用属性并等待资源解析完成，再由调用方回复 IPC。 */
        const applyProperties = async (component, props) => {
            if (!props) return;
            // 尝试获取组件类的属性定义
            const compClass = component.constructor;
            const before = new Map(Object.keys(props).map(key => [key, component[key]]));
            try {

            for (const key of Object.keys(props)) {
                if (["node", "uuid", "_id", "__proto__", "constructor", "prototype"].includes(key)) throw new Error("不允许修改核心字段: " + key);
                if (!(key in component)) throw new Error("组件不存在属性: " + key);
                const attrs = (cc.Class.Attr.getClassAttrs && cc.Class.Attr.getClassAttrs(compClass)) || {};
                const type = attrs[key]?.type || attrs[key + "$_$ctor"];
                const value = props[key];
                if (value !== null && type && (type === cc.Node || type === cc.Component || type.prototype instanceof cc.Component)) {
                    const target = value instanceof cc.Node ? value : findNode(value);
                    if (!target || type !== cc.Node && !target.getComponent(type)) throw new Error("无法解析节点/组件引用: " + key);
                }
            }
            for (const [key, value] of Object.entries(props)) {
                // 【核心修复】专门处理各类事件属性 (ClickEvents, ScrollEvents 等)
                const isEventProp =
                    Array.isArray(value) && (key.toLowerCase().endsWith("events") || key === "clickEvents");

                if (isEventProp) {
                    const eventHandlers = [];
                    for (const item of value) {
                        if (typeof item === "object" && (item.target || item.component || item.handler)) {
                            const handler = new cc.Component.EventHandler();

                            // 解析 Target Node
                            if (item.target) {
                                let targetNode = findNode(item.target);
                                if (!targetNode && item.target instanceof cc.Node) {
                                    targetNode = item.target;
                                }

                                if (!targetNode) throw new Error("事件 target 节点不存在: " + item.target);
                                handler.target = targetNode;
                            }

                            if (item.component) handler.component = item.component;
                            if (item.handler) handler.handler = item.handler;
                            if (item.customEventData !== undefined)
                                handler.customEventData = String(item.customEventData);

                            eventHandlers.push(handler);
                        } else {
                            // 如果不是对象，原样保留
                            eventHandlers.push(item);
                        }
                    }
                    component[key] = eventHandlers;
                    continue; // 处理完事件数组，跳出本次循环
                }

                // 检查属性是否存在
                {
                    let finalValue = value;

                    // 【核心逻辑】智能类型识别与赋值
                    try {
                        const attrs = (cc.Class.Attr.getClassAttrs && cc.Class.Attr.getClassAttrs(compClass)) || {};
                        let propertyType = attrs[key] ? attrs[key].type : null;
                        if (!propertyType && attrs[key + "$_$ctor"]) {
                            propertyType = attrs[key + "$_$ctor"];
                        }

                        // 字符串字段始终保留原文，UUID 外形的文本也不能变成资源或节点引用。
                        if (typeof value === "string" && (
                            typeof component[key] === "string" || propertyType === String ||
                            propertyType === cc.String || propertyType === "String" || attrs[key + "$_$type"] === "String"
                        )) {
                            component[key] = value;
                            continue;
                        }
                        const isReferenceId = typeof value === "string" && Editor.Utils.UuidUtils.isUuid(value);

                        let isAsset =
                            propertyType &&
                            (propertyType.prototype instanceof cc.Asset ||
                                propertyType === cc.Asset ||
                                propertyType === cc.Prefab ||
                                propertyType === cc.SpriteFrame);
                        let isAssetArray =
                            Array.isArray(value) && (isAsset || key === "materials" || key.toLowerCase().includes("assets"));

                        // 启发式：如果属性名包含 prefab/sprite/texture 等，且值为 UUID 且不是节点
                        if (!isAsset && !isAssetArray && isReferenceId) {
                            const lowerKey = key.toLowerCase();
                            const assetKeywords = [
                                "prefab",
                                "sprite",
                                "texture",
                                "material",
                                "skeleton",
                                "spine",
                                "atlas",
                                "font",
                                "audio",
                                "data",
                            ];
                            if (assetKeywords.some((k) => lowerKey.includes(k))) {
                                if (!findNode(value)) {
                                    isAsset = true;
                                }
                            }
                        }

                        if (isAsset || isAssetArray) {
                            // 全部加载成功后才赋值，保留数组的空槽、顺序和失败前的原引用。
                            if (isAssetArray) {
                                component[key] = await Promise.all((value as any[]).map(uuid => loadAssetValue(uuid, key, propertyType)));
                            } else {
                                component[key] = await loadAssetValue(value, key, propertyType);
                            }
                            continue;
                        } else if (
                            propertyType &&
                            (propertyType.prototype instanceof cc.Component ||
                                propertyType === cc.Component ||
                                propertyType === cc.Node)
                        ) {
                            // 2. 处理节点或组件引用
                            if (value === null) { component[key] = null; continue; }
                            const targetNode = findNode(value);
                            if (targetNode) {
                                if (propertyType === cc.Node) {
                                    finalValue = targetNode;
                                } else {
                                    const targetComp = targetNode.getComponent(propertyType);
                                    if (targetComp) {
                                        finalValue = targetComp;
                                    } else {
                                        throw new Error(`在节点 ${targetNode.name} 上找不到组件 ${propertyType.name}`);
                                    }
                                }
                            } else {
                                throw new Error(`无法解析 ${key} 的目标节点/组件: ${value}`);
                            }
                        } else {
                            // 3. 通用启发式 (找不到类型时的 fallback)
                            if (isReferenceId) {
                                const targetNode = findNode(value);
                                if (targetNode) {
                                    finalValue = targetNode;
                                } else {
                                    finalValue = await loadAssetValue(value, key, propertyType);
                                }
                            }
                        }
                    } catch (e) {
                        throw new Error(`设置属性 ${key} 失败: ${e.message}`);
                    }

                    component[key] = finalValue;
                }
            }
            } catch (err) {
                const applied = [...before].filter(([key, value]) => !Object.is(component[key], value)).map(([key]) => key);
                throw new Error(err.message + (applied.length ? `；部分属性已应用: ${applied.join(",")}，请读回确认，禁止整批重放` : ""));
            }
        };

        if (!node) {
            if (event.reply) event.reply(new Error("找不到节点"));
            return;
        }

        switch (action) {
            case "add":
                if (!componentType) {
                    if (event.reply) event.reply(new Error("必须提供组件类型"));
                    return;
                }

                // 容错：自动纠正 AI 可能混淆的 3.x 等组件名称
                const COMPONENT_ALIAS_MAP: Record<string, string> = {
                    "cc.BoxCollider2D": "cc.BoxCollider",
                    "cc.Collider2D": "cc.Collider",
                    "cc.TiledAtlas": "cc.TiledMap",
                    "cc.UITransform": "cc.Widget",
                    "cc.SpriteBox": "cc.Sprite",
                };

                if (COMPONENT_ALIAS_MAP[componentType]) {
                    componentType = COMPONENT_ALIAS_MAP[componentType];
                }

                // 【防呆设计】拦截 AI 错误地将 cc.Node 作为组件添加
                if (componentType === "cc.Node" || componentType === "Node") {
                    if (event.reply) {
                        event.reply(
                            new Error(
                                "【纠错提示】cc.Node 是节点而不是组件，无法被当做组件添加！\n" +
                                "- 如果你想创建带有名字的子节点，请不要使用 manage_components，而是使用 create-node (或相应的创建节点工具)。\n" +
                                "- 如果你想修改现有节点的 name 属性，请使用修改节点的 set-property 工具。",
                            ),
                        );
                    }
                    return;
                }

                try {
                    // 解析组件类型
                    let compClass = null;
                    if (componentType.startsWith("cc.")) {
                        const className = componentType.replace("cc.", "");
                        compClass = cc[className];
                    } else {
                        // 尝试获取自定义组件
                        compClass = cc.js.getClassByName(componentType);
                        if (!compClass && cc[componentType]) {
                            compClass = cc[componentType];
                        }
                    }

                    if (!compClass) {
                        if (event.reply) event.reply(new Error(`找不到组件类型: ${componentType}`));
                        return;
                    }

                    // 【防呆设计】确保获取到的类是一个组件
                    if (!cc.js.isChildClassOf(compClass, cc.Component)) {
                        if (event.reply) {
                            event.reply(
                                new Error(
                                    `【错误】'${componentType}' 不是一个合法的组件类型（必须继承自 cc.Component）。请确认你的意图。`,
                                ),
                            );
                        }
                        return;
                    }

                    // 添加组件
                    let isReused = false;
                    let component = node.addComponent(compClass);

                    if (!component) {
                        // 引擎底层 (如 _checkMultipleComp) 可能拦截了唯一组件，导致返回 null
                        component = node.getComponent(compClass);
                        if (!component) {
                            if (event.reply) event.reply(new Error(`添加组件失败，引擎返回 null 且未找到已有同类组件: ${componentType}`));
                            return;
                        }
                        isReused = true;
                    }

                    // 等待属性写入完成；即使部分属性失败，也通知编辑器已有变更。
                    try {
                        if (properties) await applyProperties(component, properties);
                    } finally {
                        notifySceneChanged(event, nodeId);
                    }

                    if (event.reply) {
                        event.reply(null, isReused ? `组件 ${componentType} 已存在，已自动重用并覆盖其属性` : `组件 ${componentType} 已添加`);
                    }
                } catch (err) {
                    if (event.reply) event.reply(new Error(`添加组件失败: ${err.message}`));
                }
                break;

            case "remove":
                if (!componentId && !componentType) {
                    if (event.reply) event.reply(new Error("必须提供组件 ID 或组件类型(componentType)"));
                    return;
                }

                try {
                    // 查找并移除组件
                    let component = null;
                    if (componentId) {
                        if (node._components) {
                            for (let i = 0; i < node._components.length; i++) {
                                if (node._components[i].uuid === componentId) {
                                    component = node._components[i];
                                    break;
                                }
                            }
                        }
                    } else if (componentType) {
                        let compClass = null;
                        if (componentType.startsWith("cc.")) {
                            const className = componentType.replace("cc.", "");
                            compClass = cc[className];
                        } else {
                            compClass = cc.js.getClassByName(componentType);
                            if (!compClass && cc[componentType]) {
                                compClass = cc[componentType];
                            }
                        }
                        if (compClass) {
                            component = node.getComponent(compClass);
                        }
                    }

                    if (component) {
                        node.removeComponent(component);
                        notifySceneChanged(event, nodeId);
                        if (event.reply) event.reply(null, "组件已移除");
                    } else {
                        if (event.reply) event.reply(new Error("找不到组件"));
                    }
                } catch (err) {
                    if (event.reply) event.reply(new Error(`移除组件失败: ${err.message}`));
                }
                break;

            case "update":
                // 更新现有组件属性
                if (!componentType && !componentId) {
                    if (event.reply) event.reply(new Error("必须提供组件 ID 或组件类型"));
                    return;
                }

                try {
                    let targetComp = null;

                    // 1. 尝试通过 componentId 查找
                    if (componentId) {
                        if (node._components) {
                            for (let i = 0; i < node._components.length; i++) {
                                if (node._components[i].uuid === componentId) {
                                    targetComp = node._components[i];
                                    break;
                                }
                            }
                        }
                    }

                    // 2. 尝试通过 type 查找
                    if (!targetComp && componentType) {
                        let compClass = null;
                        if (componentType.startsWith("cc.")) {
                            const className = componentType.replace("cc.", "");
                            compClass = cc[className];
                        } else {
                            compClass = cc.js.getClassByName(componentType);
                            if (!compClass && cc[componentType]) {
                                compClass = cc[componentType];
                            }
                        }
                        if (compClass) {
                            targetComp = node.getComponent(compClass);
                        }
                    }

                    if (targetComp) {
                        if (properties) {
                            try {
                                await applyProperties(targetComp, properties);
                            } finally {
                                notifySceneChanged(event, nodeId);
                            }
                            if (event.reply) event.reply(null, "组件属性已更新");
                        } else {
                            if (event.reply) event.reply(null, "没有需要更新的属性");
                        }
                    } else {
                        if (event.reply)
                            event.reply(new Error(`找不到组件 (类型: ${componentType}, ID: ${componentId})`));
                    }
                } catch (err) {
                    if (event.reply) event.reply(new Error(`更新组件失败: ${err.message}`));
                }
                break;

            default:
                if (event.reply) event.reply(new Error(`未知的组件操作类型: ${action}`));
                break;
        }
    },

    "get-component-properties": function (component) {
        const properties = {};

        // 遍历组件属性
        for (const key in component) {
            if (typeof component[key] !== "function" && !key.startsWith("_") && component[key] !== undefined) {
                try {
                    properties[key] = component[key];
                } catch (e) {
                    // 忽略无法序列化的属性
                }
            }
        }

        return properties;
    },

    "instantiate-prefab": function (event, args) {
        const { prefabUuid, parentId } = args;
        const scene = cc.director.getScene();

        if (!scene) {
            if (event.reply) event.reply(new Error("场景尚未准备好或正在加载。"));
            return;
        }

        if (!prefabUuid) {
            if (event.reply) event.reply(new Error("必须提供预制体 UUID。"));
            return;
        }

        // 使用 cc.assetManager.loadAny 通过 UUID 加载 (Cocos 2.4+)
        // 如果是旧版，可能需要 cc.loader.load({uuid: ...})，但在 2.4 环境下 assetManager 更推荐
        cc.assetManager.loadAny(prefabUuid, (err, prefab) => {
            if (err) {
                if (event.reply) event.reply(new Error(`加载预制体失败: ${err.message}`));
                return;
            }

            // 实例化预制体
            const instance = cc.instantiate(prefab);
            if (!instance) {
                if (event.reply) event.reply(new Error("实例化预制体失败"));
                return;
            }

            // 设置父节点
            let parent = parentId ? findNode(parentId) : scene;
            if (parent) {
                instance.parent = parent;

                // 通知场景变脏
                Editor.Ipc.sendToMain("scene:dirty");

                // 通知 UI 刷新
                setTimeout(() => {
                    Editor.Ipc.sendToAll("scene:node-created", {
                        uuid: instance.uuid,
                        parentUuid: parent.uuid,
                    });
                }, 10);

                if (event.reply) event.reply(null, `预制体实例化成功，UUID: ${instance.uuid}`);
            } else {
                if (event.reply) event.reply(new Error("找不到父节点"));
            }
        });
    },

    /**
     * 根据特定条件在场景中搜索节点
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (conditions, recursive)
     */
    "find-gameobjects": function (event, args) {
        const { conditions, recursive = true } = args;
        let budget;
        const scene = args.scopeNodeId ? findNode(args.scopeNodeId) : cc.director.getScene();
        if (!scene) return event.reply(new Error("场景或查询范围不存在"));
        try { budget = sceneQuery(args, scene, "nodes"); } catch (err) { return event.reply(err); }

        const pending = [scene];
        function searchNode(node) {
            if (!budget.check(node)) return;
            if (
                !node ||
                !node.name ||
                (typeof node.name === "string" && (node.name.startsWith("Editor Scene") || node.name === "gizmoRoot"))
            ) {
                return;
            }

            // 检查节点是否满足条件
            let match = true;

            if (conditions.name && !node.name.includes(conditions.name)) {
                match = false;
            }

            if (conditions.component) {
                let hasComponent = false;
                try {
                    if (conditions.component.startsWith("cc.")) {
                        const className = conditions.component.replace("cc.", "");
                        hasComponent = node.getComponent(cc[className]) !== null;
                    } else {
                        hasComponent = node.getComponent(conditions.component) !== null;
                    }
                } catch (e) {
                    hasComponent = false;
                }
                if (!hasComponent) {
                    match = false;
                }
            }

            if (conditions.active !== undefined && node.active !== conditions.active) {
                match = false;
            }

            if (match) {
                const comps = node._components || [];
                budget.add({
                    uuid: node.uuid,
                    name: node.name,
                    active: node.active,
                    components: comps.map((c) => {
                        const parts = (cc.js.getClassName(c) || "").split(".");
                        return parts[parts.length - 1]; // 简化的组件名
                    }),
                    childrenCount: node.childrenCount,
                });
            }

            // 递归搜索子节点
            if (recursive) {
                for (let i = node.childrenCount - 1; i >= 0; i--) {
                    pending.push(node.children[i]);
                }
            }
        }

        // 从场景根节点开始搜索
        while (pending.length && budget.check()) searchNode(pending.pop());

        if (event.reply) {
            try { event.reply(null, budget.finish()); } catch (err) { event.reply(err); }
        }
    },

    /**
     * 查找场景中引用了指定节点或资源的所有位置
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (targetId, targetType)
     */
    "find-references": function (event, args) {
        const { targetId, targetType = "auto", additionalIds } = args;
        if (!targetId) {
            if (event.reply) event.reply(new Error("必须提供 targetId 参数"));
            return;
        }

        const scene = args.scopeNodeId ? findNode(args.scopeNodeId) : cc.director.getScene();
        if (!scene) {
            if (event.reply) event.reply(new Error("场景尚未准备好"));
            return;
        }

        // 判断目标类型：尝试先当节点查找
        let detectedType = targetType;
        if (targetType === "auto") {
            const targetNode = findNode(targetId);
            detectedType = targetNode ? "node" : "asset";
        }

        let budget;
        try { budget = sceneQuery(args, scene, "references"); } catch (err) { return event.reply(err); }

        // 规范化 UUID: 同时生成压缩(22位)和解压(36位)格式，确保资源匹配
        const targetVariants = [targetId];
        try {
            if (typeof Editor !== "undefined" && Editor.Utils && Editor.Utils.UuidUtils) {
                const compressed = Editor.Utils.UuidUtils.compressUuid(targetId);
                const decompressed = Editor.Utils.UuidUtils.decompressUuid(targetId);
                if (compressed && compressed !== targetId) targetVariants.push(compressed);
                if (decompressed && decompressed !== targetId) targetVariants.push(decompressed);
            }
        } catch (e) {
            /* 忽略 UUID 转换错误 */
        }
        // 合并 main.js 预解析的子资源 UUID (如 Texture2D 对应的 SpriteFrame)
        if (Array.isArray(additionalIds)) {
            additionalIds.forEach(function (aid) {
                if (targetVariants.indexOf(aid) === -1) targetVariants.push(aid);
                try {
                    if (typeof Editor !== "undefined" && Editor.Utils && Editor.Utils.UuidUtils) {
                        var c = Editor.Utils.UuidUtils.compressUuid(aid);
                        var d = Editor.Utils.UuidUtils.decompressUuid(aid);
                        if (c && targetVariants.indexOf(c) === -1) targetVariants.push(c);
                        if (d && targetVariants.indexOf(d) === -1) targetVariants.push(d);
                    }
                } catch (e) {
                    /* 忽略 */
                }
            });
        }

        /**
         * 检查一个属性值是否引用了目标
         * @returns {string|null} 匹配时返回可读描述，否则返回 null
         */
        function checkValue(val) {
            if (!val || typeof val !== "object") return null;

            if (detectedType === "node") {
                // 检查节点引用
                if (val instanceof cc.Node && val.uuid === targetId) {
                    return `节点(${val.name})`;
                }
            } else {
                // 检查资源引用 (cc.Asset 的 _uuid 属性)
                if (val instanceof cc.Asset) {
                    var assetUuid = val._uuid || "";
                    for (var vi = 0; vi < targetVariants.length; vi++) {
                        if (assetUuid === targetVariants[vi]) {
                            return `资源(${val.name || assetUuid})`;
                        }
                    }
                }
            }
            return null;
        }

        /**
         * 递归扫描节点及其子节点
         */
        const pending = [scene];
        function scanNode(node) {
            if (!budget.check(node)) return;
            if (!node || !node.name) return;
            if (typeof node.name === "string" && (node.name.startsWith("Editor Scene") || node.name === "gizmoRoot")) {
                return;
            }

            // 跳过目标节点自身
            if (detectedType === "node" && node.uuid === targetId) {
                // 不跳过，仍然扫描子节点，但不扫描自身的组件
            } else {
                // 遍历该节点的所有组件
                const comps = node._components || [];
                for (let ci = 0; ci < comps.length; ci++) {
                    const comp = comps[ci];
                    const compTypeName = cc.js.getClassName(comp) || comp.constructor.name || "Unknown";

                    for (const key in comp) {
                        if (!budget.check()) return;
                        if (typeof comp[key] === "function" || key.startsWith("_")) continue;
                        if (key === "node" || key === "uuid" || key === "name") continue;

                        try {
                            const val = comp[key];
                            if (val === null || val === undefined) continue;

                            // 直接值检查
                            const directMatch = checkValue(val);
                            if (directMatch) {
                                budget.add({
                                    nodeId: node.uuid,
                                    nodeName: node.name,
                                    componentType: compTypeName,
                                    componentIndex: ci,
                                    propertyName: key,
                                    propertyValue: directMatch,
                                });
                                continue;
                            }

                            // 数组检查 (如 EventHandler 数组、materials 等)
                            if (Array.isArray(val)) {
                                for (let ai = 0; ai < val.length; ai++) {
                                    if (!budget.check()) return;
                                    const item = val[ai];
                                    const arrMatch = checkValue(item);
                                    if (arrMatch) {
                                        budget.add({
                                            nodeId: node.uuid,
                                            nodeName: node.name,
                                            componentType: compTypeName,
                                            componentIndex: ci,
                                            propertyName: `${key}[${ai}]`,
                                            propertyValue: arrMatch,
                                        });
                                    }
                                    // EventHandler 的 target 属性
                                    if (item && item instanceof cc.Component.EventHandler && item.target) {
                                        const ehMatch = checkValue(item.target);
                                        if (ehMatch) {
                                            budget.add({
                                                nodeId: node.uuid,
                                                nodeName: node.name,
                                                componentType: compTypeName,
                                                componentIndex: ci,
                                                propertyName: `${key}[${ai}].target`,
                                                propertyValue: ehMatch,
                                            });
                                        }
                                    }
                                }
                            }
                        } catch (e) {
                            // 跳过无法访问的属性
                        }
                    }
                }
            }

            // 递归子节点
            for (let i = node.childrenCount - 1; i >= 0; i--) {
                pending.push(node.children[i]);
            }
        }

        while (pending.length && budget.check()) scanNode(pending.pop());

        try {
            const page = budget.finish();
            if (event.reply) event.reply(null, Array.isArray(page)
                ? { targetId, targetType: detectedType, referenceCount: page.length, references: page }
                : { targetId, targetType: detectedType, referenceCount: page.total, references: page.results,
                    nextCursor: page.nextCursor, truncated: page.truncated, visited: page.visited });
        } catch (err) { event.reply(err); }
    },

    /**
     * 删除指定的场景节点
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (uuid)
     */
    "delete-node": function (event, args) {
        const { uuid } = args;
        const node = findNode(uuid);
        if (node) {
            const parent = node.parent;
            node.destroy();
            Editor.Ipc.sendToMain("scene:dirty");
            // 延迟通知以确保节点已被移除
            setTimeout(() => {
                if (parent) {
                    Editor.Ipc.sendToAll("scene:node-changed", { uuid: parent.uuid });
                }
                // 广播节点删除事件
                Editor.Ipc.sendToAll("scene:node-deleted", { uuid: uuid });
            }, 10);

            const confirm = () => {
                if (cc.isValid(node)) { setTimeout(confirm, 16); return; }
                if (event.reply) event.reply(null, `节点 ${uuid} 已删除`);
            };
            setTimeout(confirm, 16);
        } else {
            if (event.reply) event.reply(new Error(`找不到节点: ${uuid}`));
        }
    },

    /**
     * 管理高效的全场景特效 (粒子系统)
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (action, nodeId, properties, name, parentId)
     */
    "manage-vfx": async function (event, args) {
        let createdNode = null, createdComponent = null;
        try {
        const { action, nodeId, properties, name, parentId } = args;
        const scene = cc.director.getScene();

        const applyParticleProperties = async (particleSystem, props) => {
            props = props || {};
            const resourceId = props.file || (!particleSystem.texture && !particleSystem.file && args.defaultSpriteUuid);
            const asset = resourceId ? await loadSceneAsset(resourceId) : null;
            if (asset && !(asset instanceof cc.ParticleAsset || asset instanceof cc.Texture2D || asset instanceof cc.SpriteFrame)) throw new Error("特效资源类型不匹配");
            if (cc.director.getScene() !== scene) throw new Error("加载特效期间场景已变化");

            if (props.duration !== undefined) particleSystem.duration = props.duration;
            if (props.emissionRate !== undefined) particleSystem.emissionRate = props.emissionRate;
            if (props.life !== undefined) particleSystem.life = props.life;
            if (props.lifeVar !== undefined) particleSystem.lifeVar = props.lifeVar;

            // 【关键修复】启用自定义属性，否则属性修改可能不生效
            particleSystem.custom = true;

            if (props.startColor) particleSystem.startColor = new cc.Color().fromHEX(props.startColor);
            if (props.endColor) particleSystem.endColor = new cc.Color().fromHEX(props.endColor);

            if (props.startSize !== undefined) particleSystem.startSize = props.startSize;
            if (props.endSize !== undefined) particleSystem.endSize = props.endSize;

            if (props.speed !== undefined) particleSystem.speed = props.speed;
            if (props.angle !== undefined) particleSystem.angle = props.angle;

            if (props.gravity) {
                if (props.gravity.x !== undefined) particleSystem.gravity.x = props.gravity.x;
                if (props.gravity.y !== undefined) particleSystem.gravity.y = props.gravity.y;
            }

            if (asset instanceof cc.ParticleAsset) particleSystem.file = asset;
            else if (asset) particleSystem.texture = asset;

        };

        if (action === "create") {
            if (parentId && !findNode(parentId)) throw new Error("找不到父节点");
            let newNode = createdNode = new cc.Node(name || "New Particle");
            let particleSystem = newNode.addComponent(cc.ParticleSystem);

            // 设置默认值
            particleSystem.resetSystem();
            particleSystem.custom = true; // 确保新创建的也是 custom 模式

            await applyParticleProperties(particleSystem, properties);

            let parent = parentId ? cc.engine.getInstanceById(parentId) : scene;
            if (parent) {
                newNode.parent = parent;
                Editor.Ipc.sendToMain("scene:dirty");
                setTimeout(() => {
                    Editor.Ipc.sendToAll("scene:node-created", {
                        uuid: newNode.uuid,
                        parentUuid: parent.uuid,
                    });
                }, 10);
                if (event.reply) event.reply(null, newNode.uuid);
            } else {
                throw new Error("找不到父节点");
            }
        } else if (action === "update") {
            let node = findNode(nodeId);
            if (node) {
                let particleSystem = node.getComponent(cc.ParticleSystem);
                if (!particleSystem) {
                    // 如果没有组件，自动添加
                    particleSystem = node.addComponent(cc.ParticleSystem);
                    createdComponent = particleSystem;
                }

                await applyParticleProperties(particleSystem, properties);

                Editor.Ipc.sendToMain("scene:dirty");
                Editor.Ipc.sendToAll("scene:node-changed", { uuid: nodeId });
                if (event.reply) event.reply(null, "特效已更新");
            } else {
                if (event.reply) event.reply(new Error("找不到节点"));
            }
        } else if (action === "get_info") {
            let node = findNode(nodeId);
            if (node) {
                let ps = node.getComponent(cc.ParticleSystem);
                if (ps) {
                    const info = {
                        duration: ps.duration,
                        emissionRate: ps.emissionRate,
                        life: ps.life,
                        lifeVar: ps.lifeVar,
                        startColor: ps.startColor.toHEX("#RRGGBB"),
                        endColor: ps.endColor.toHEX("#RRGGBB"),
                        startSize: ps.startSize,
                        endSize: ps.endSize,
                        speed: ps.speed,
                        angle: ps.angle,
                        gravity: { x: ps.gravity.x, y: ps.gravity.y },
                        file: ps.file ? ps.file.name : null,
                    };
                    if (event.reply) event.reply(null, info);
                } else {
                    if (event.reply) event.reply(null, { hasParticleSystem: false });
                }
            } else {
                if (event.reply) event.reply(new Error("找不到节点"));
            }
        } else {
            if (event.reply) event.reply(new Error(`未知的特效操作类型: ${action}`));
        }
        } catch (err) {
            const temporary = createdNode || createdComponent;
            if (temporary && typeof temporary.destroy === "function") {
                temporary.destroy();
                while (cc.isValid && cc.isValid(temporary)) await new Promise(resolve => setTimeout(resolve, 16));
            }
            if (event.reply) event.reply(new Error("特效操作失败: " + (err.message || err)));
        }
    },

    /**
     * 控制节点的动画组件 (播放、暂停、停止等)
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (action, nodeId, clipName)
     */
    "manage-animation": function (event, args) {
        const { action, nodeId, clipName } = args;
        const node = findNode(nodeId);

        if (!node) {
            if (event.reply) event.reply(new Error(`找不到节点: ${nodeId}`));
            return;
        }

        const anim = node.getComponent(cc.Animation);
        if (!anim) {
            if (event.reply) event.reply(new Error(`在节点 ${nodeId} 上找不到 Animation 组件`));
            return;
        }

        switch (action) {
            case "get_list":
                const clips = anim.getClips();
                const clipList = clips.map((c) => ({
                    name: c.name,
                    duration: c.duration,
                    sample: c.sample,
                    speed: c.speed,
                    wrapMode: c.wrapMode,
                }));
                if (event.reply) event.reply(null, clipList);
                break;

            case "get_info":
                const currentClip = anim.currentClip;
                let isPlaying = false;
                // [安全修复] 只有在有当前 Clip 时才获取状态，避免 Animation 组件无 Clip 时的崩溃
                if (currentClip) {
                    const state = anim.getAnimationState(currentClip.name);
                    if (state) {
                        isPlaying = state.isPlaying;
                    }
                }
                const info = {
                    currentClip: currentClip ? currentClip.name : null,
                    clips: anim.getClips().map((c) => c.name),
                    playOnLoad: anim.playOnLoad,
                    isPlaying: isPlaying,
                };
                if (event.reply) event.reply(null, info);
                break;

            case "play":
                if (!clipName) {
                    anim.play();
                    if (event.reply) event.reply(null, "正在播放默认动画剪辑");
                } else {
                    anim.play(clipName);
                    if (event.reply) event.reply(null, `正在播放动画剪辑: ${clipName}`);
                }
                break;

            case "stop":
                anim.stop();
                if (event.reply) event.reply(null, "动画已停止");
                break;

            case "pause":
                anim.pause();
                if (event.reply) event.reply(null, "动画已暂停");
                break;

            case "resume":
                anim.resume();
                if (event.reply) event.reply(null, "动画已恢复播放");
                break;

            default:
                if (event.reply) event.reply(new Error(`未知的动画操作类型: ${action}`));
                break;
        }
    },

    /**
     * 自定义预制体创建：在场景进程中序列化节点树，并转换为正确的预制体格式
     * Editor.serialize() 对简单节点返回单对象，对引用图返回数组，统一转换为预制体格式。
     * @param {Object} event IPC 事件对象
     * @param {Object} args 参数 (nodeId)
     */
    "create-prefab": function (event, args) {
        const { nodeId, nodeName } = args;

        const node = findNode(nodeId);
        if (!node) {
            if (event.reply) event.reply(new Error(`找不到节点: ${nodeId}`));
            return;
        }

        // 保存原始状态，序列化完成后恢复
        const originalParent = node.parent;
        const originalName = node.name;
        const originalSiblingIndex = originalParent ? node.getSiblingIndex() : 0;

        try {
            let serializedStr;
            try {
                // 隔离父级，避免将目标子树以外的场景一起导出。
                node.parent = null;
                if (nodeName) node.name = nodeName;
                serializedStr = Editor.serialize(node);
            } finally {
                node.parent = originalParent;
                node.name = originalName;
                if (originalParent) node.setSiblingIndex(originalSiblingIndex);
            }
            const serialized = JSON.parse(serializedStr);
            const sceneData = Array.isArray(serialized) ? serialized : [serialized];

            if (sceneData.length === 0 || sceneData.some(item => !item || typeof item !== "object")) {
                if (event.reply) event.reply(new Error("序列化数据格式异常"));
                return;
            }

            // 第二步：识别并移除 cc.Scene 对象，找到真正的根节点
            // Editor.serialize 输出格式：[根节点(cc.Node), cc.Scene, 子节点..., 组件...]
            // 根节点的 _parent 指向 cc.Scene
            let sceneIndex = -1;
            for (let i = 0; i < sceneData.length; i++) {
                if (sceneData[i].__type__ === "cc.Scene") {
                    sceneIndex = i;
                    break;
                }
            }

            // 移除 cc.Scene 并构建旧索引到新索引的映射
            let filteredData = [];
            let oldToNewIndex = {};
            let newIndex = 0;

            // 先留出索引 0 给 cc.Prefab
            newIndex = 1;

            for (let i = 0; i < sceneData.length; i++) {
                if (i === sceneIndex) {
                    // 跳过 cc.Scene
                    oldToNewIndex[i] = -1;
                    continue;
                }
                oldToNewIndex[i] = newIndex;
                filteredData.push(sceneData[i]);
                newIndex++;
            }

            // 第三步：为每个 cc.Node 生成 cc.PrefabInfo
            // 需要知道根节点在新数组中的索引
            let rootNodeOldIndex = -1;
            for (let i = 0; i < sceneData.length; i++) {
                if (i === sceneIndex) continue;
                if (sceneData[i].__type__ === "cc.Node") {
                    // 根节点是 _parent 指向 cc.Scene 的那个，或者是第一个 cc.Node
                    if (sceneData[i]._parent && sceneData[i]._parent.__id__ === sceneIndex) {
                        rootNodeOldIndex = i;
                        break;
                    }
                }
            }
            // 如果没有找到指向 Scene 的根节点，使用第一个 cc.Node
            if (rootNodeOldIndex === -1) {
                for (let i = 0; i < sceneData.length; i++) {
                    if (i === sceneIndex) continue;
                    if (sceneData[i].__type__ === "cc.Node") {
                        rootNodeOldIndex = i;
                        break;
                    }
                }
            }

            if (rootNodeOldIndex === -1) throw new Error("序列化数据中没有可创建预制体的节点");
            const rootNodeNewIndex = oldToNewIndex[rootNodeOldIndex]; // 根节点在新数组中的索引

            // 收集所有 cc.Node 的新索引，用于给每个节点附加 PrefabInfo
            let nodeEntries = []; // { newIndex, isRoot }
            for (let i = 0; i < filteredData.length; i++) {
                if (filteredData[i].__type__ === "cc.Node") {
                    nodeEntries.push({
                        arrayIndex: i + 1, // +1 因为 cc.Prefab 在索引 0
                        isRoot: i + 1 === rootNodeNewIndex,
                    });
                }
            }

            // 生成 fileId 的简单方法（与 main.js 中的 generateFileId 逻辑一致）
            function generateFileId() {
                const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                let result = "";
                for (let i = 0; i < 22; i++) {
                    result += chars.charAt(Math.floor(Math.random() * chars.length));
                }
                return result;
            }

            // 第四步：构建最终的预制体数据数组
            // 结构: [cc.Prefab, 根节点(cc.Node), 子节点..., 组件..., cc.PrefabInfo...]
            let prefabData = [];

            // 索引 0: cc.Prefab 包装器
            prefabData.push({
                __type__: "cc.Prefab",
                _name: "",
                _objFlags: 0,
                _native: "",
                data: { __id__: rootNodeNewIndex },
                optimizationPolicy: 0,
                asyncLoadAssets: false,
                readonly: false,
            });

            // 添加过滤后的数据（所有原始对象，除了 cc.Scene）
            for (let i = 0; i < filteredData.length; i++) {
                prefabData.push(filteredData[i]);
            }

            // 第五步：更新所有 __id__ 引用（使用旧到新的索引映射）
            function updateRefs(obj) {
                if (obj === null || obj === undefined || typeof obj !== "object") return;
                if (Array.isArray(obj)) {
                    obj.forEach(function (item) {
                        updateRefs(item);
                    });
                    return;
                }
                for (let key in obj) {
                    if (!obj.hasOwnProperty(key)) continue;
                    if (key === "__id__" && typeof obj[key] === "number") {
                        let oldIdx = obj[key];
                        if (oldToNewIndex.hasOwnProperty(oldIdx)) {
                            obj[key] = oldToNewIndex[oldIdx];
                        }
                    } else if (typeof obj[key] === "object" && obj[key] !== null) {
                        updateRefs(obj[key]);
                    }
                }
            }

            // 更新 prefabData 中所有对象的 __id__ 引用（跳过索引 0 的 cc.Prefab，它的引用已经是新索引）
            for (let i = 1; i < prefabData.length; i++) {
                updateRefs(prefabData[i]);
            }

            // 第六步：修复根节点的 _parent 为 null
            let rootNodeObj = prefabData[rootNodeNewIndex];
            if (rootNodeObj) {
                rootNodeObj._parent = null;
            }

            // 第七步：清空所有 _id 字段（预制体中节点的 _id 应为空，运行时由引擎分配）
            for (let i = 1; i < prefabData.length; i++) {
                if (prefabData[i]._id !== undefined) {
                    prefabData[i]._id = "";
                }
            }

            // 第八步：为每个 cc.Node 添加 cc.PrefabInfo
            // PrefabInfo 追加在数组末尾
            let prefabInfoStartIndex = prefabData.length;
            for (let ni = 0; ni < nodeEntries.length; ni++) {
                let entry = nodeEntries[ni];
                let prefabInfoIndex = prefabInfoStartIndex + ni;

                // 在节点上设置 _prefab 引用
                let nodeObj = prefabData[entry.arrayIndex];
                if (nodeObj) {
                    nodeObj._prefab = { __id__: prefabInfoIndex };
                }

                // 创建 PrefabInfo 对象
                prefabData.push({
                    __type__: "cc.PrefabInfo",
                    root: { __id__: rootNodeNewIndex },
                    asset: { __id__: 0 },
                    fileId: entry.isRoot ? "" : generateFileId(),
                    sync: false,
                });
            }

            // 第九步：序列化为 JSON 字符串
            const result = JSON.stringify(prefabData, null, 2);
            if (event.reply) event.reply(null, result);
        } catch (e) {
            if (event.reply) event.reply(new Error(`序列化节点失败: ${e.message}`));
        }
    },

    "save-scene": function (event, args) {
        try {
            const editMode = Editor.require("scene://edit-mode");
            if (!editMode || editMode.curMode().name !== "scene") {
                event.reply(new Error("当前不在场景编辑模式中，请使用 save_prefab 保存预制体"));
                return;
            }
            editMode.save(err => event.reply(err ? new Error(err.message || err) : null, err ? null : "场景保存完成"));
        } catch (e) { event.reply(new Error("保存场景发生异常: " + e.message)); }
    },
    "save-prefab": function (event, args) {
        try {
            const editMode = Editor.require("scene://edit-mode");
            if (editMode && editMode.curMode().name === "prefab") {
                editMode.save((err) => {
                    if (err) {
                        if (event.reply) event.reply(new Error(err.message || err));
                    } else {
                        if (event.reply) event.reply(null, "预制体保存成功");
                    }
                });
            } else {
                if (event.reply) event.reply(new Error("当前不在预制体编辑模式中"));
            }
        } catch (e) {
            if (event.reply) event.reply(new Error("保存预制体发生异常: " + e.message));
        }
    },

    "close-prefab": function (event, args) {
        try {
            const editMode = Editor.require("scene://edit-mode");
            if (editMode && editMode.curMode().name === "prefab") {
                editMode.pop();
                const confirm = () => {
                    if (editMode.curMode().name === "prefab") { setTimeout(confirm, 50); return; }
                    if (event.reply) event.reply(null, "已退出预制体编辑模式");
                };
                setTimeout(confirm, 50);
            } else {
                if (event.reply) event.reply(new Error("当前不在预制体编辑模式中"));
            }
        } catch (e) {
            if (event.reply) event.reply(new Error("退出预制体模式发生异常: " + e.message));
        }
    },
};

export = sceneTools;
