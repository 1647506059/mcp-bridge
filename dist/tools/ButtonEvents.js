"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buttonEvents = buttonEvents;
/** 使用 2.4 原生 EventHandler；绑定成功仅代表编辑态绑定，不代表真实点击命中。 */
function buttonEvents(args, findNode, engine) {
    const node = findNode(args.nodeId);
    if (!node)
        throw new Error("按钮节点不存在");
    const button = node.getComponent(engine.Button);
    if (!button)
        throw new Error("节点没有 cc.Button");
    const describe = event => {
        const target = event.target, component = target && target.getComponent(event.component);
        return { targetUuid: (target === null || target === void 0 ? void 0 : target.uuid) || null, componentName: event.component, handler: event.handler,
            customEventData: event.customEventData || "", valid: !!component && typeof component[event.handler] === "function" };
    };
    const events = Array.isArray(button.clickEvents) ? button.clickEvents : [];
    if (args.action === "list")
        return { nodeId: node.uuid, events: events.slice(0, 200).map(describe), total: events.length, truncated: events.length > 200 };
    if (args.action !== "bind")
        throw new Error("action 需要 list 或 bind");
    const target = findNode(args.targetId), componentName = args.componentName, handler = args.handler;
    if (!target || !componentName || !handler || ["__proto__", "constructor", "prototype"].includes(handler))
        throw new Error("需要有效的目标节点、组件和回调方法");
    const component = target.getComponent(componentName);
    if (!component || typeof component[handler] !== "function")
        throw new Error(`目标组件或回调不存在: ${componentName}.${handler}`);
    if (events.length >= 200)
        throw new Error("按钮已有200个事件，请先整理绑定");
    const customEventData = args.customEventData || "";
    const same = event => event.target === target && event.component === componentName && event.handler === handler && (event.customEventData || "") === customEventData;
    const duplicate = events.find(same);
    if (duplicate && !args.replace)
        return { bound: false, duplicate: true, event: describe(duplicate) };
    const event = new engine.Component.EventHandler();
    event.target = target;
    event.component = componentName;
    event.handler = handler;
    event.customEventData = customEventData;
    button.clickEvents = (args.replace ? events.filter(item => !same(item)) : events).concat(event);
    return { bound: true, event: describe(event), eventCount: button.clickEvents.length, runtimeClickVerified: false };
}
