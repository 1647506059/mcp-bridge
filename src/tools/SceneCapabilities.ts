import { queryComponents } from "./ComponentQuery";
import { boundedValue } from "../utils/BoundedValue";

const selector = { nodeId: { type: "string" }, uuid: { type: "string" }, path: { type: "string", description: "场景节点层级路径。" }, name: { type: "string", description: "精确名称；重名时拒绝并要求 UUID 或路径。" } };
const specs: any[] = [
    ["resolve_node", "scene", true, "将 UUID、路径或精确名称解析为唯一场景节点。"],
    ["get_scene_info", "scene", true, "读取当前编辑场景信息。"],
    ["inspect_node", "scene", true, "读取节点变换、组件与父子信息。"],
    ["delete_node", "scene", false, "销毁指定节点，禁止删除场景根。"],
    ["emit_node_event", "events", false, "向节点发送自定义事件及 JSON 数据。", { eventName: { type: "string" }, payload: {} }, ["eventName"]],
    ["simulate_button_click", "events", false, "触发 cc.Button 回调和 click 事件；不证明真实鼠标命中或玩法接受。"],
    ["invoke_component_method", "components", false, "调用指定组件方法，支持异步结果。", { componentName: { type: "string" }, componentType: { type: "string" }, methodName: { type: "string" }, args: { type: "array", maxItems: 100, items: {} } }, ["methodName"]],
    ["list_cameras", "camera", true, "列出当前编辑场景的 cc.Camera。"],
    ["inspect_prefab_instance", "prefabs", true, "读取节点关联的 2.4 预制体 UUID、根节点和文件标识。"],
    ["get_runtime_state", "runtime", true, "读取编辑场景 director 状态，不代表外部游戏预览状态。"],
    ["pause_runtime", "runtime", false, "暂停当前编辑场景 director。"],
    ["resume_runtime", "runtime", false, "恢复当前编辑场景 director。"],
    ["set_time_scale", "runtime", false, "设置当前编辑场景 scheduler 时间倍率。", { timeScale: { type: "number", minimum: 0, maximum: 100 } }, ["timeScale"]],
    ["get_performance_snapshot", "diagnostics", true, "读取编辑场景节点、组件、深度与 UI 数量。"],
    ["add_animation_clip", "animation", false, "将资源 UUID 对应的 AnimationClip 加入节点 Animation 组件。", { clipUuid: { type: "string" }, clipName: { type: "string" } }, ["clipUuid"]],
];
export function sceneCapabilityDefinitions() {
    return specs.map(([name, category, readOnly, description, extra = {}, required = []]) => ({ name, category, profile: readOnly ? "core" : "full", description,
        annotations: { readOnlyHint: readOnly, destructiveHint: !readOnly, idempotentHint: readOnly, openWorldHint: false },
        inputSchema: { type: "object", properties: { ...selector, ...extra }, required } }));
}
export function isSceneCapability(name) { return specs.some(item => item[0] === name); }
export function sceneCapabilityReadOnly(name) { return specs.find(item => item[0] === name)?.[2]; }

function sceneNodes(scene) {
    const nodes = [], stack = [{ node: scene, depth: 0 }];
    while (stack.length) {
        if (nodes.length >= 10000) throw new Error("场景遍历超过10000节点，请使用指定 UUID 或缩小场景");
        const item = stack.pop(); nodes.push(item);
        for (const child of item.node.children || []) stack.push({ node: child, depth: item.depth + 1 });
    }
    return nodes;
}
export function resolveSceneNode(args, scene, engine, byId) {
    const id = args.nodeId || args.uuid || args.id;
    if (id) {
        const node = byId(id);
        if (!node || !(node instanceof engine.Node)) throw new Error("找不到场景节点: " + id);
        let root = node; while (root.parent) root = root.parent;
        if (root !== scene) throw new Error("节点不属于当前编辑场景");
        return node;
    }
    if (args.path) {
        const parts = args.path.split("/").filter(Boolean); if (parts[0] === scene.name) parts.shift();
        let node = scene;
        for (const part of parts) {
            const matches = (node.children || []).filter(child => child.name === part);
            if (matches.length !== 1) throw new Error("节点路径不存在或存在重名: " + args.path);
            node = matches[0];
        }
        return node;
    }
    if (args.name) {
        const matches = sceneNodes(scene).map(item => item.node).filter(node => node.name === args.name);
        if (matches.length !== 1) throw new Error("节点名称不存在或不唯一，请提供 UUID 或路径: " + args.name);
        return matches[0];
    }
    throw new Error("需要 nodeId、uuid、path 或 name 定位节点");
}
export async function executeSceneCapability(name, args, engine, byId, loadAsset, notify) {
    const scene = engine.director.getScene();
    if (!scene) throw new Error("编辑场景尚未就绪");
    const ref = node => ({ uuid: node.uuid, name: node.name, parentId: node.parent?.uuid || null });
    if (name === "get_scene_info") return { ...ref(scene), childrenCount: scene.children.length, context: "edit_scene" };
    if (name === "list_cameras" || name === "get_performance_snapshot") {
        const nodes = sceneNodes(scene);
        if (name === "list_cameras") return nodes.flatMap(({ node }) => (node.getComponents(engine.Camera) || []).map(camera => ({ ...ref(node), componentId: camera.uuid, enabled: camera.enabled, depth: camera.depth })));
        return { context: "edit_scene", nodes: nodes.length, components: nodes.reduce((sum, item) => sum + (item.node._components || []).length, 0),
            depth: Math.max(...nodes.map(item => item.depth)), uiNodes: nodes.filter(item => item.node.getComponent(engine.Label) || item.node.getComponent(engine.Sprite)).length };
    }
    if (["get_runtime_state", "pause_runtime", "resume_runtime", "set_time_scale"].includes(name)) {
        const director = engine.director, scheduler = director.getScheduler();
        if (name === "pause_runtime") director.pause();
        if (name === "resume_runtime") director.resume();
        if (name === "set_time_scale") scheduler.setTimeScale(args.timeScale);
        return { context: "edit_scene", scene: ref(scene), paused: director.isPaused(), timeScale: scheduler.getTimeScale(), gamePreviewVerified: false };
    }
    const node = resolveSceneNode(args, scene, engine, byId);
    if (name === "resolve_node") return ref(node);
    if (name === "inspect_node") return { ...ref(node), active: node.active, position: { x: node.x, y: node.y, z: node.z }, angle: node.angle,
        scale: { x: node.scaleX, y: node.scaleY }, size: { width: node.width, height: node.height }, anchor: { x: node.anchorX, y: node.anchorY },
        children: node.children.slice(0, 1000).map(ref), childrenTruncated: node.children.length > 1000, components: queryComponents(node, { fields: ["enabled"] }, engine) };
    if (name === "inspect_prefab_instance") return { ...ref(node), linked: !!node._prefab?.asset, assetUuid: node._prefab?.asset?._uuid || null, rootId: node._prefab?.root?.uuid || null, fileId: node._prefab?.fileId || null };
    if (name === "delete_node") {
        if (node === scene) throw new Error("不能删除场景根节点");
        const result = ref(node); node.destroy(); notify(node.uuid);
        return { ...result, destroyRequested: true };
    }
    if (name === "emit_node_event") { node.emit(args.eventName, args.payload); return { ...ref(node), eventName: args.eventName, emitted: true, businessOutcomeVerified: false }; }
    if (name === "simulate_button_click") {
        const button = node.getComponent(engine.Button);
        if (!button || button.enabled === false || button.interactable === false || !node.activeInHierarchy) throw new Error("目标没有可交互的 cc.Button");
        engine.Component.EventHandler.emitEvents(button.clickEvents, button);
        node.emit("click", button);
        return { ...ref(node), emitted: true, nativeInputVerified: false, businessOutcomeVerified: false };
    }
    if (name === "invoke_component_method") {
        const component = node.getComponent(args.componentName || args.componentType);
        if (!component || ["constructor", "__proto__", "prototype"].includes(args.methodName) || typeof component[args.methodName] !== "function") throw new Error("组件或目标方法不存在");
        try {
            const value = await component[args.methodName](...(args.args || []));
            const safe = boundedValue(value === undefined ? null : value, 1024 * 1024, 12);
            return { ...ref(node), data: safe.value, truncated: safe.truncated, businessOutcomeVerified: false };
        } finally { notify(node.uuid); }
    }
    if (name === "add_animation_clip") {
        const animation = node.getComponent(engine.Animation);
        if (!animation) throw new Error("节点没有 cc.Animation 组件");
        const clip = await loadAsset(args.clipUuid);
        if (!(clip instanceof engine.AnimationClip)) throw new Error("资源不是 cc.AnimationClip");
        if (engine.director.getScene() !== scene || (engine.isValid && !engine.isValid(node))) throw new Error("资源加载期间场景已变化");
        animation.addClip(clip, args.clipName || clip.name); notify(node.uuid);
        return { ...ref(node), clipUuid: args.clipUuid, clipName: args.clipName || clip.name };
    }
    throw new Error("未知场景能力: " + name);
}
