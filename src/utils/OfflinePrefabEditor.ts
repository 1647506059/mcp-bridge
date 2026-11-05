import * as fs from "fs";
import * as crypto from "crypto";
import { Logger } from "../core/Logger";
import * as path from "path";
import { AssetPatcher } from "./AssetPatcher";
import { assertSerializedAsset } from "./SerializedValidation";

/**
 * 预制体声明式修改操作接口
 */
export interface PrefabOperation {
	/**
	 * 操作动作：更新属性、添加组件、移除组件、添加节点、删除节点、克隆节点、子节点重排序、属性引用绑定
	 */
	action: "update_property" | "add_component" | "remove_component" | "add_node" | "remove_node" | "clone_node" | "reorder_child" | "set_reference";
	/**
	 * 目标节点在预制体内部以根节点为起点的相对路径，如 "Canvas/Root/Label"。对于 add_node 这是父节点的相对路径。
	 */
	targetPath?: string;
	/**
	 * 组件的类名，如果要修改/操作的是节点属性则留空；如果涉及组件操作，则传入如 "cc.Label" / "cc.Sprite"
	 */
	componentType?: string;
	/**
	 * 待更新或初始化的属性键值对 (update_property/add_component 使用)
	 */
	properties?: Record<string, any>;
	/**
	 * 新节点或克隆节点的名称 (add_node/clone_node 使用)
	 */
	nodeName?: string;
	/**
	 * 克隆出的节点所要挂载的父节点相对路径，如果不传，默认挂载在被克隆节点的同级目录下 (clone_node 使用)
	 */
	newParentPath?: string;
	/**
	 * 子节点重排名称顺序数组 (reorder_child 使用)
	 */
	childOrder?: string[];
	/**
	 * 要绑定引用的组件属性名 (set_reference 使用)。
	 * 支持数组索引语法如 "clickEvents[0].target"，用于绑定数组元素内的引用属性。
	 */
	propertyName?: string;
	/**
	 * 绑定的引用特征值，可绑定外部资源UUID，也可绑定预制体内部节点或特定组件 (set_reference 使用)
	 */
	referenceValue?: {
		uuid?: string;
		path?: string;
		componentType?: string;
	};
	/**
	 * 数组元素类型 (add_component / set_reference 使用)。
	 * 当 propertyName 使用数组索引语法（如 clickEvents[0].target）且该数组元素尚不存在时，
	 * 自动创建指定类型的元素。常用值： "cc.ClickEvent"
	 */
	elementType?: string;
}

/**
 * 离线预制体修改引擎
 * 直接在 Node.js 主进程中对 .prefab 文件的 JSON 数组进行解析、检索、操作，并回写物理磁盘
 */
export class OfflinePrefabEditor {
	/**
	 * 生成 22 位 Base64 URL-safe 随机字符串，用作预制体 fileId
	 */
	public static generateFileId(): string {
		return crypto.randomBytes(16).toString("base64").replace(/\+/g, "/").replace(/=/g, "").substring(0, 22);
	}

	/**
	 * 判断平铺 JSON 数组是否为场景文件格式（而非预制体）
	 * @param data 平铺 of JSON 数组
	 * @returns 如果首元素为 cc.SceneAsset 则返回 true
	 */
	public static isSceneData(data: any[]): boolean {
		return data[0] && data[0].__type__ === "cc.SceneAsset";
	}

	/**
	 * 离线修改预制体主入口
	 * @param prefabFsPath 预制体文件的绝对物理路径
	 * @param operations 待执行的操作列表
	 * @returns 返回操作结果及可能出现的错误
	 */
	public static modify(prefabFsPath: string, operations: PrefabOperation[], createMode?: "prefab-root" | "prefab-child" | "scene"): { success: boolean; error?: string; validation?: any } {
		let tempPath: string;
		const createdDirs: string[] = [];
		try {
			if (!Array.isArray(operations) || operations.length > 1000) throw new Error("operations 必须为最多1000项数组");
			const existed = fs.existsSync(prefabFsPath);
			if (existed && fs.statSync(prefabFsPath).size > 32 * 1024 * 1024) throw new Error("离线资源超过32MiB上限，请拆分处理");
            const content = existed ? fs.readFileSync(prefabFsPath, "utf8") : null;
			const first = operations[0];
			if (!existed && (!createMode || first?.action !== "add_node" || first.targetPath && first.targetPath !== "/")) {
				throw new Error("文件不存在，且不满足自动新建条件（首项需为 add_node 且 targetPath 为空/根）");
			}
			const data = existed ? JSON.parse(content) : this.makeEmptyData(createMode, first.nodeName);
			if (!Array.isArray(data) || data.length === 0) {
				throw new Error("格式错误的资源 JSON 文件，期待平铺数组");
			}
			// 在线新建 prefab 的首项定义根；纯离线代理仍保留 Root/子节点的既有语义。
			const pending = !existed && createMode === "prefab-root" ? operations.slice(1) : operations;
			for (const op of pending) {
				this.applyOperation(data, op);
			}
			AssetPatcher.fixPrefabRootFileIdData(data);
			const validation = assertSerializedAsset(data);
			const output = JSON.stringify(data, null, 2);
            if (Buffer.byteLength(output) > 32 * 1024 * 1024) throw new Error("修改结果超过32MiB上限，未提交");
			// 验证结束后才创建目录/临时文件；目标在提交前保持原样。
			let parent = path.dirname(prefabFsPath);
			const missing = [];
			while (!fs.existsSync(parent)) { missing.unshift(parent); parent = path.dirname(parent); }
			for (const dir of missing) { fs.mkdirSync(dir); createdDirs.push(dir); }
			tempPath = path.join(path.dirname(prefabFsPath), ".mcp-" + path.basename(prefabFsPath) + "-" + crypto.randomBytes(8).toString("hex") + ".tmp");
			fs.writeFileSync(tempPath, output, { encoding: "utf8", flag: "wx" });
			if (existed) {
				if (fs.readFileSync(prefabFsPath, "utf8") !== content) throw new Error("提交前资源已被外部修改，未覆盖目标");
				fs.renameSync(tempPath, prefabFsPath);
			} else {
				// link 的排他创建防止覆盖验证期间新出现的同名文件。
				fs.linkSync(tempPath, prefabFsPath);
			}
			return { success: true, validation };
		} catch (e) {
			Logger.error(`[OfflineEditor] 修改未提交: ${(e as Error).message}`);
			return { success: false, error: (e as Error).message };
		} finally {
			try { if (tempPath && fs.existsSync(tempPath)) fs.unlinkSync(tempPath); }
			catch (e) { Logger.warn(`[OfflineEditor] 临时文件清理失败: ${tempPath}: ${e.message}`); }
			for (const dir of createdDirs.reverse()) { try { fs.rmdirSync(dir); } catch (_) {} }
		}
	}

	private static makeEmptyData(mode: "prefab-root" | "prefab-child" | "scene", nodeName: string): any[] {
		const scene = mode === "scene";
		const root: any = {
			__type__: scene ? "cc.Scene" : "cc.Node", _name: scene ? "" : mode === "prefab-root" ? nodeName || "NewPrefab" : "Root",
			_objFlags: 0, _parent: null, _children: [], _components: [], _active: true,
			_prefab: scene ? null : { __id__: 2 }, _opacity: 255,
			_color: { __type__: "cc.Color", r: 255, g: 255, b: 255, a: 255 },
			_contentSize: { __type__: "cc.Size", width: scene ? 0 : 100, height: scene ? 0 : 100 },
			_anchorPoint: { __type__: "cc.Vec2", x: scene ? 0 : 0.5, y: scene ? 0 : 0.5 },
			_trs: { __type__: "TypedArray", ctor: "Float64Array", array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1] },
			_is3DNode: scene, _groupIndex: 0, groupIndex: 0, _id: "",
		};
		if (scene) { root.autoReleaseAssets = false; return [{ __type__: "cc.SceneAsset", _name: "", _objFlags: 0, _native: "", scene: { __id__: 1 } }, root]; }
		Object.assign(root, { _eulerAngles: { __type__: "cc.Vec3", x: 0, y: 0, z: 0 }, _skewX: 0, _skewY: 0 });
		const entry: any = { __type__: "cc.Prefab", _name: "", _objFlags: 0, _native: "", data: { __id__: 1 } };
		if (mode === "prefab-root") Object.assign(entry, { optimizationPolicy: 0, asyncLoadAssets: false, readonly: false });
		return [entry, root, { __type__: "cc.PrefabInfo", root: { __id__: 1 }, asset: { __id__: 0 }, fileId: this.generateFileId(), sync: false }];
	}

	private static readonly BASE64_KEYS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	private static readonly HexMap: Record<string, number> = (() => {
		const map: Record<string, number> = {};
		for (let i = 0; i < 16; i++) {
			map[i.toString(16)] = i;
			map[i.toString(16).toUpperCase()] = i;
		}
		return map;
	})();

	public static isUuid(str: string): boolean {
		const s = /^[0-9a-fA-F-]{36}$/;
		const o = /^[0-9a-fA-F]{32}$/;
		const u = /^[0-9a-zA-Z+/]{22,23}$/;
		return s.test(str) || o.test(str) || u.test(str);
	}

	public static compressUuid(uuid: string): string {
		const s = /^[0-9a-fA-F-]{36}$/;
		const o = /^[0-9a-fA-F]{32}$/;
		let cleanUuid = uuid;
		if (s.test(uuid)) {
			cleanUuid = uuid.replace(/-/g, "");
		} else if (!o.test(uuid)) {
			return uuid;
		}
		
		const r = 5;
		const prefix = cleanUuid.slice(0, r);
		const chars: string[] = [];
		let i = r;
		while (i < cleanUuid.length) {
			const left = this.HexMap[cleanUuid[i]];
			const mid = this.HexMap[cleanUuid[i + 1]];
			const right = this.HexMap[cleanUuid[i + 2]];
			chars.push(this.BASE64_KEYS[(left << 2) | (mid >> 2)]);
			chars.push(this.BASE64_KEYS[((mid & 3) << 4) | right]);
			i += 3;
		}
		return prefix + chars.join("");
	}

	/**
	 * 解析嵌套属性路径，支持数组索引语法 "clickEvents[0].target"。
	 * 当路径中存在数组访问且元素不存在时，可根据 elementType 自动创建。
	 * @returns { target: 最终属性所在的对象, prop: 最终属性名 }
	 */
	private static resolveNestedProperty(
		targetObj: any,
		propertyName: string,
		data: any[],
		elementType?: string
	): { target: any; prop: string } {
		// 匹配 "arrayField[index].subField" 模式
		const arrayMatch = propertyName.match(/^(\w+)\[(\d+)\]\.(.+)$/);
		if (!arrayMatch) {
			return { target: targetObj, prop: propertyName };
		}

		const [, arrayField, indexStr, subField] = arrayMatch;
		const index = parseInt(indexStr, 10);

		// 尝试访问数组字段（兼容 _N$ 前缀序列化版本）
		let arr = targetObj[arrayField];
		if (arr === undefined || arr === null) {
			arr = targetObj['_N$' + arrayField];
		}

		// 如果数组不存在，根据 elementType 自动创建
		if (!Array.isArray(arr)) {
			if (!elementType) {
				throw new Error(
					`属性 "${propertyName}" 寻址失败：组件上不存在数组属性 "${arrayField}"。` +
					`请提供 elementType 参数来自动创建数组元素（如 "cc.ClickEvent"）。`
				);
			}
			arr = [];
			targetObj[arrayField] = arr;
			targetObj['_N$' + arrayField] = arr;
		}

		// 获取或自动创建数组元素
		let elementRef = arr[index];
		if (!elementRef || elementRef === null) {
			if (!elementType) {
				throw new Error(
					`属性 "${propertyName}" 寻址失败：数组 "${arrayField}" 索引 ${index} 不存在。` +
					`请提供 elementType 参数来自动创建（如 "cc.ClickEvent"）。`
				);
			}
			const newElement: any = { __type__: elementType };
			// ClickEvent 默认值
			if (elementType === 'cc.ClickEvent') {
				newElement.target = null;
				newElement.component = '';
				newElement.handler = '';
			}
			const newIdx = data.length;
			data.push(newElement);
			// 填充数组到目标索引
			while (arr.length <= index) {
				arr.push(null);
			}
			arr[index] = { __id__: newIdx };
			elementRef = arr[index];
		}

		// 解引用扁平数组存储（{ __id__: N } → data[N]）
		let element = elementRef;
		if (element && typeof element === 'object' && element.__id__ !== undefined) {
			element = data[element.__id__];
		}

		return { target: element, prop: subField };
	}

	private static liftObject(data: any[], obj: any): any {
		if (!obj || typeof obj !== "object") {
			return obj;
		}

		if (Array.isArray(obj)) {
			return obj.map(item => this.liftObject(data, item));
		}

		if (obj.__type__ !== undefined) {
			const inlineTypes = ["cc.Vec2", "cc.Vec3", "cc.Vec4", "cc.Size", "cc.Rect", "cc.Color", "cc.Quat", "cc.Mat4", "TypedArray"];
			if (!inlineTypes.includes(obj.__type__)) {
				const newIdx = data.length;
				data.push(null);

				if (obj.__type__ === "cc.ClickEvent") {
					let scriptUuid = "";
					if (obj.target && obj.target.__id__ !== undefined) {
						const targetNode = data[obj.target.__id__];
						if (targetNode && targetNode._components) {
							for (const compRef of targetNode._components) {
								const comp = data[compRef.__id__];
								if (comp && comp.__type__) {
									const rawType = comp.__type__;
									if (this.isUuid(rawType)) {
										scriptUuid = rawType;
										break;
									}
								}
							}
						}
					}
					if (scriptUuid) {
						obj._componentId = this.compressUuid(scriptUuid);
						obj.component = "";
					} else if (obj.component) {
						if (this.isUuid(obj.component)) {
							obj._componentId = this.compressUuid(obj.component);
							obj.component = "";
						}
					}
				}

				const processedObj: any = {};
				for (const [k, v] of Object.entries(obj)) {
					processedObj[k] = this.liftObject(data, v);
				}

				data[newIdx] = processedObj;
				return { __id__: newIdx };
			}
		}

		const result: any = {};
		for (const [k, v] of Object.entries(obj)) {
			result[k] = this.liftObject(data, v);
		}
		return result;
	}

	/**
	 * 根据相对路径检索节点对象在数组中的索引位置
	 * @param data 平铺的 JSON 数组
	 * @param path 相对根节点的检索路径，如 "RootNode/Body/Label"
	 * @returns 目标节点在 data 数组中的索引值
	 */
	private static findNodeByPath(data: any[], path: string): number {
		const rootEntry = data[0];
		if (!rootEntry) {
			throw new Error("格式错误：数组首位未找到有效声明入口");
		}

		let currentNodeIdx = -1;
		const isScene = this.isSceneData(data);

		if (rootEntry.__type__ === "cc.Prefab" && rootEntry.data) {
			currentNodeIdx = rootEntry.data.__id__;
		} else if (rootEntry.__type__ === "cc.SceneAsset" && rootEntry.scene) {
			currentNodeIdx = rootEntry.scene.__id__;
		} else {
			throw new Error(`不支持的离线编辑资源类型: ${rootEntry.__type__}`);
		}

		if (!path || path === "" || path === "/") {
			return currentNodeIdx;
		}

		let segments = path.split("/").filter((s) => s !== "");
		const rootNode = data[currentNodeIdx];
		// 智能容错：对于预制体，如果第一个路径段就是根节点名称，且没有重名冲突，则跳过
		// 对于场景，寻路起点是 cc.Scene 虚拟节点，其 _name 通常无意义，直接开始匹配子节点
		if (!isScene && rootNode && segments[0] === rootNode._name) {
			let hasSameNameChild = false;
			if (rootNode._children) {
				for (const childRef of rootNode._children) {
					const childNode = data[childRef.__id__];
					if (childNode && childNode._name === segments[0]) {
						hasSameNameChild = true;
						break;
					}
				}
			}
			if (!hasSameNameChild) {
				segments.shift(); // 消费掉根节点名字前缀
			}
		}

		for (const segment of segments) {
			const node = data[currentNodeIdx];
			if (!node) {
				throw new Error(`引用错误：找不到索引为 ${currentNodeIdx} 的节点对象`);
			}
			if (!node._children) {
				throw new Error(`节点查找失败：节点 ${node._name || 'Scene'} (索引 ${currentNodeIdx}) 没有子节点`);
			}

			let foundIdx = -1;
			for (const childRef of node._children) {
				const childNode = data[childRef.__id__];
				if (childNode && childNode._name === segment) {
					foundIdx = childRef.__id__;
					break;
				}
			}

			if (foundIdx === -1) {
				throw new Error(`检索路径中未找到匹配名称为 "${segment}" 的子节点`);
			}
			currentNodeIdx = foundIdx;
		}

		return currentNodeIdx;
	}

	/**
	 * 单个操作的具体执行
	 * @param data 平铺的 JSON 数组
	 * @param op 声明式操作项
	 */
	private static applyOperation(data: any[], op: PrefabOperation) {
		const nodeIdx = this.findNodeByPath(data, op.targetPath || "");
		const node = data[nodeIdx];
		if (!node) {
			throw new Error(`找不到路径为 "${op.targetPath}" 的目标节点`);
		}

		// 常用常见字段别名转换字典（自动映射非下划线前缀至 Cocos 序列化字段）
		const propMap: Record<string, string> = {
			name: "_name",
			active: "_active",
			opacity: "_opacity",
			color: "_color",
			string: "_string",
			spriteFrame: "_spriteFrame",
			enabled: "_enabled",
		};

		if (op.action === "update_property") {
			if (op.componentType) {
				// 修改指定类型的组件属性
				const compTypeToFind = this.isUuid(op.componentType) ? this.compressUuid(op.componentType) : op.componentType;
				let foundCompIdx = -1;
				const components = node._components || [];
				for (const compRef of components) {
					const comp = data[compRef.__id__];
					if (comp && comp.__type__ === compTypeToFind) {
						foundCompIdx = compRef.__id__;
						break;
					}
				}

				if (foundCompIdx === -1) {
					throw new Error(`节点 "${op.targetPath}" 上未挂载组件: "${op.componentType}"`);
				}

				const component = data[foundCompIdx];
				for (const [key, val] of Object.entries(op.properties || {})) {
					// 支持数组索引语法：clickEvents[0].handler → 自动解析到数组元素内
					const { target: propTarget, prop: resolvedProp } = this.resolveNestedProperty(
						component, key, data, op.elementType
					);
					const finalKey = propMap[resolvedProp] || resolvedProp;
					const lifted = this.liftObject(data, val);
					propTarget[finalKey] = lifted;
					// 智能同步 _N$ 私有序列化字段，防止编辑器重绘时反吞数据
					// Cocos 编辑器在检测脚本更新并重构时，依赖 _N$ 前缀字段进行反序列化；
					// 若缺失，编辑器会重置为默认值，覆盖离线写入的数据。
					if (!resolvedProp.startsWith('_N$') && !resolvedProp.startsWith('_')) {
						propTarget['_N$' + resolvedProp] = lifted;
					}
				}
			} else {
				// 修改节点属性
				for (const [key, val] of Object.entries(op.properties || {})) {
					const finalKey = propMap[key] || key;
					node[finalKey] = this.liftObject(data, val);
				}
			}
		} else if (op.action === "add_component") {
			if (!op.componentType) {
				throw new Error("新增组件失败：组件类型 componentType 缺失");
			}

			const compTypeToUse = this.isUuid(op.componentType) ? this.compressUuid(op.componentType) : op.componentType;

			// 初始化新增组件，并利用 push 追加到数组尾部以保持其他元素索引不受影响
			const newCompIdx = data.length;
			const defaultProps: Record<string, any> = {};

			// 部分特定组件追加核心参数以防解析失败
			if (compTypeToUse === "cc.Label") {
				defaultProps._string = "Label";
				defaultProps._N$string = "Label";
			} else if (compTypeToUse === "cc.Sprite") {
				defaultProps._spriteFrame = null;
			}

			const newComp: any = {
				__type__: compTypeToUse,
				_name: "",
				_objFlags: 0,
				node: { __id__: nodeIdx },
				_enabled: true,
				...defaultProps,
			};

			// 应用用户传入的属性（含 _N$ 智能同步）
			for (const [key, val] of Object.entries(op.properties || {})) {
				const finalKey = propMap[key] || key;
				const lifted = this.liftObject(data, val);
				newComp[finalKey] = lifted;
				// 同步 _N$ 前缀的私有序列化字段，防止编辑器重绘时反吞数据
				if (!key.startsWith('_N$') && !key.startsWith('_')) {
					newComp['_N$' + key] = lifted;
				}
			}

			data.push(newComp);

			if (!node._components) {
				node._components = [];
			}
			node._components.push({ __id__: newCompIdx });
		} else if (op.action === "remove_component") {
			if (!op.componentType) {
				throw new Error("移除组件失败：组件类型 componentType 缺失");
			}

			const compTypeToFind = this.isUuid(op.componentType) ? this.compressUuid(op.componentType) : op.componentType;
			let foundCompIdx = -1;
			const components = node._components || [];
			for (const compRef of components) {
				const comp = data[compRef.__id__];
				if (comp && comp.__type__ === compTypeToFind) {
					foundCompIdx = compRef.__id__;
					break;
				}
			}

			if (foundCompIdx === -1) {
				throw new Error(`节点 "${op.targetPath}" 上未挂载组件: "${op.componentType}"，无法移除`);
			}

			// 1. 从节点组件引用数组中移出
			node._components = components.filter((ref: any) => ref.__id__ !== foundCompIdx);

			// 2. 物理删除并对剩余索引及连线引用进行重算，杜绝 null 占位造成的反序列化卡死
			this.physicalEraseAndRealign(data, [foundCompIdx]);
		} else if (op.action === "add_node") {
			const isScene = this.isSceneData(data);
			const newNodeIdx = data.length;

			const newNode: any = {
				__type__: "cc.Node",
				_name: op.nodeName || "New Node",
				_objFlags: 0,
				_parent: { __id__: nodeIdx },
				_children: [],
				_components: [],
				_active: true,
				_prefab: null,
				_opacity: 255,
				_color: { __type__: "cc.Color", "r": 255, "g": 255, "b": 255, "a": 255 },
				_contentSize: { __type__: "cc.Size", "width": 100, "height": 100 },
				_anchorPoint: { __type__: "cc.Vec2", "x": 0.5, "y": 0.5 },
				_trs: {
					__type__: "TypedArray",
					ctor: "Float64Array",
					array: [0, 0, 0, 0, 0, 0, 1, 1, 1, 1]
				},
				_eulerAngles: { __type__: "cc.Vec3", "x": 0, "y": 0, "z": 0 },
				_skewX: 0,
				_skewY: 0,
				_is3DNode: false,
				_groupIndex: 0,
				groupIndex: 0,
				_id: ""
			};

			data.push(newNode);

			if (!isScene) {
				const prefabInfoIdx = data.length;
				const newPrefabInfo = {
					__type__: "cc.PrefabInfo",
					root: { __id__: data[0].data.__id__ },
					asset: { __id__: 0 },
					fileId: this.generateFileId(),
					sync: false
				};
				data.push(newPrefabInfo);
				newNode._prefab = { __id__: prefabInfoIdx };
			}

			if (!node._children) {
				node._children = [];
			}
			node._children.push({ __id__: newNodeIdx });
		} else if (op.action === "remove_node") {
			// 从其父节点的子节点列表中移除引用
			if (node._parent) {
				const parentNode = data[node._parent.__id__];
				if (parentNode && parentNode._children) {
					parentNode._children = parentNode._children.filter(
						(ref: any) => ref.__id__ !== nodeIdx
					);
				}
			}

			const eraseList: number[] = [];
			const collectNodeAndDeps = (idx: number) => {
				const n = data[idx];
				if (!n) return;
				eraseList.push(idx);
				for (const compRef of n._components || []) {
					eraseList.push(compRef.__id__);
				}
				for (const childRef of n._children || []) {
					collectNodeAndDeps(childRef.__id__);
				}
				if (n._prefab) {
					eraseList.push(n._prefab.__id__);
				}
			};

			collectNodeAndDeps(nodeIdx);

			// 执行物理删除并重排其它对象的 __id__ 引用，防止 null 占位造成引擎反序列化崩溃
			this.physicalEraseAndRealign(data, eraseList);
		} else if (op.action === "clone_node") {
			// 深拷贝子树并重算相对引用索引
			const destParentIdx = op.newParentPath ? this.findNodeByPath(data, op.newParentPath) : node._parent.__id__;
			const destParentNode = data[destParentIdx];
			if (!destParentNode) {
				throw new Error("克隆失败：目标挂载父节点不存在");
			}

			const sourceSubtreeIndices: number[] = [];
			const collectSubtree = (idx: number) => {
				const n = data[idx];
				if (!n) return;
				sourceSubtreeIndices.push(idx);
				for (const compRef of n._components || []) {
					sourceSubtreeIndices.push(compRef.__id__);
				}
				if (n._prefab) {
					sourceSubtreeIndices.push(n._prefab.__id__);
				}
				for (const childRef of n._children || []) {
					collectSubtree(childRef.__id__);
				}
			};
			collectSubtree(nodeIdx);

			const indexMap = new Map<number, number>();
			const cloneStartOffset = data.length;

			// 1. 拷贝子树并推入尾部建立 Map 映射
			sourceSubtreeIndices.forEach((oldIdx, i) => {
				indexMap.set(oldIdx, cloneStartOffset + i);
				data.push(JSON.parse(JSON.stringify(data[oldIdx])));
			});

			// 2. 遍历并对克隆新对象的 __id__ 索引进行重算
			for (let i = cloneStartOffset; i < data.length; i++) {
				const obj = data[i];
				if (!obj) continue;

				if (obj.__type__ === "cc.Node") {
					obj._name = (i === cloneStartOffset && op.nodeName) ? op.nodeName : obj._name;
					if (i === cloneStartOffset) {
						obj._parent = { __id__: destParentIdx };
					} else if (obj._parent && indexMap.has(obj._parent.__id__)) {
						obj._parent = { __id__: indexMap.get(obj._parent.__id__) };
					}

					if (obj._prefab && indexMap.has(obj._prefab.__id__)) {
						obj._prefab = { __id__: indexMap.get(obj._prefab.__id__) };
					}

					if (obj._children) {
						obj._children = obj._children.map((ref: any) =>
							indexMap.has(ref.__id__) ? { __id__: indexMap.get(ref.__id__) } : ref
						);
					}

					if (obj._components) {
						obj._components = obj._components.map((ref: any) =>
							indexMap.has(ref.__id__) ? { __id__: indexMap.get(ref.__id__) } : ref
						);
					}
				} else if (obj.__type__ === "cc.PrefabInfo") {
					if (obj.root && indexMap.has(obj.root.__id__)) {
						obj.root = { __id__: indexMap.get(obj.root.__id__) };
					}
					obj.fileId = this.generateFileId(); // 为克隆新节点生成唯一的 fileId
				} else {
					// 组件
					if (obj.node && indexMap.has(obj.node.__id__)) {
						obj.node = { __id__: indexMap.get(obj.node.__id__) };
					}
					// 遍历检查组件内部可能关联的其它节点/组件
					for (const [key, val] of Object.entries(obj)) {
						if (val && typeof val === "object" && (val as any).__id__ !== undefined) {
							const oldTarget = (val as any).__id__;
							if (indexMap.has(oldTarget)) {
								obj[key] = { __id__: indexMap.get(oldTarget) };
							}
						}
					}
				}
			}

			// 3. 将克隆出来的根节点关联到目标父节点下面
			if (!destParentNode._children) {
				destParentNode._children = [];
			}
			destParentNode._children.push({ __id__: cloneStartOffset });
		} else if (op.action === "reorder_child") {
			if (!op.childOrder || op.childOrder.length === 0) {
				throw new Error("子节点重新排序失败：子节点渲染列表 childOrder 为空");
			}

			const parentChildren = node._children || [];
			const nameToIdxMap = new Map<string, number>();

			parentChildren.forEach((ref: any) => {
				const child = data[ref.__id__];
				if (child) {
					nameToIdxMap.set(child._name, ref.__id__);
				}
			});

			const newChildren: any[] = [];
			op.childOrder.forEach((name) => {
				if (nameToIdxMap.has(name)) {
					newChildren.push({ __id__: nameToIdxMap.get(name) });
					nameToIdxMap.delete(name);
				}
			});

			// 防丢失安全保护：对于没有在 childOrder 中列出的子节点，默认追加到尾部
			nameToIdxMap.forEach((id) => {
				newChildren.push({ __id__: id });
			});

			node._children = newChildren;
		} else if (op.action === "set_reference") {
			if (!op.propertyName || !op.referenceValue) {
				throw new Error("引用属性绑定失败：属性名称 propertyName 或目标引用 referenceValue 为空");
			}

			let targetObj = node;
			if (op.componentType) {
				const compTypeToFind = this.isUuid(op.componentType) ? this.compressUuid(op.componentType) : op.componentType;
				let foundCompIdx = -1;
				for (const compRef of node._components || []) {
					const comp = data[compRef.__id__];
					if (comp && comp.__type__ === compTypeToFind) {
						foundCompIdx = compRef.__id__;
						break;
					}
				}
				if (foundCompIdx === -1) {
					throw new Error(`目标节点 "${op.targetPath}" 上找不到组件 "${op.componentType}"`);
				}
				targetObj = data[foundCompIdx];
			}

			// 解析 propertyName，支持数组索引语法如 "clickEvents[0].target"
			// 在所有 ref 分支前解析，确保数组路径在两分支下均生效
			const { target: propTarget, prop: resolvedProp } = this.resolveNestedProperty(
				targetObj, op.propertyName, data, op.elementType
			);

			const ref = op.referenceValue;
			if (ref.uuid) {
				// 绑定外部资源（自动同步 _N$ 私有序列化字段）
				propTarget[resolvedProp] = { __uuid__: ref.uuid };
				if (!resolvedProp.startsWith('_N$') && !resolvedProp.startsWith('_')) {
					propTarget['_N$' + resolvedProp] = { __uuid__: ref.uuid };
				}
			} else if (ref.path) {
				// 绑定内部对象（节点或组件）
				const refNodeIdx = this.findNodeByPath(data, ref.path);
				if (ref.componentType) {
					const refCompTypeToFind = this.isUuid(ref.componentType) ? this.compressUuid(ref.componentType) : ref.componentType;
					let refCompIdx = -1;
					const refNode = data[refNodeIdx];
					for (const cRef of refNode._components || []) {
						const c = data[cRef.__id__];
						if (c && c.__type__ === refCompTypeToFind) {
							refCompIdx = cRef.__id__;
							break;
						}
					}
					if (refCompIdx === -1) {
						throw new Error(`连线失败：引用的目标节点下未包含组件 "${ref.componentType}"`);
					}
					propTarget[resolvedProp] = { __id__: refCompIdx };
				} else {
					propTarget[resolvedProp] = { __id__: refNodeIdx };
				}
			}
		}
	}

	/**
	 * 深度递归重算对象/数组中所有引用的 __id__ 值，防止物理 splice 后产生错位与悬空引用
	 */
	private static remapAllIdRefs(obj: any, mapping: number[], structural = false): any {
		if (!obj || typeof obj !== "object") return obj;
		if (Array.isArray(obj)) {
			const values = obj.map(item => this.remapAllIdRefs(item, mapping));
			return structural ? values.filter(item => item !== null) : values;
		}
		if (Number.isInteger(obj.__id__)) {
			const next = mapping[obj.__id__];
			if (next === undefined || next < 0) return null;
			obj.__id__ = next;
			return obj;
		}
		for (const key of Object.keys(obj)) {
			obj[key] = this.remapAllIdRefs(obj[key], mapping, key === "_children" || key === "_components");
		}
		return obj;
	}



	private static physicalEraseAndRealign(data: any[], indicesToErase: number[]) {
		const deleted = new Set(indicesToErase.filter(i => Number.isInteger(i) && i >= 0 && i < data.length));
		if (!deleted.size) return;
		let shift = 0;
		const mapping = data.map((_, i) => deleted.has(i) ? (shift++, -1) : i - shift);
		for (let i = 0; i < data.length; i++) data[i] = this.remapAllIdRefs(data[i], mapping);
		for (const i of Array.from(deleted).sort((a, b) => b - a)) data.splice(i, 1);
	}
}
