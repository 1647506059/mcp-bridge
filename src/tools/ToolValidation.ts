import { validate, validateConditional } from "./BatchOperations";
import { resolveToolAlias, toolAlias } from "./ToolCapabilities";

export function validateToolCall(name, args, tools) {
    const tool = tools.find(tool => tool.name === name);
    if (!tool) throw new Error(`未知工具: ${name}`);
    const descriptor = toolAlias(name);
    const validationArgs = descriptor && args.componentName && !args.componentType ? { ...args, componentType: args.componentName } : args;
    validate(validationArgs, tool.inputSchema, name);
    validateConditional(name, args);
    const alias = resolveToolAlias(name, args);
    if (alias.name !== name && !(descriptor.nodeKey && !alias.args[descriptor.nodeKey] && (args.path || args.name))) validateConditional(alias.name, alias.args);
}

/** 批处理还会在解析引用后逐项校验；此处先拒绝隐藏入口与字面量越权操作。 */
export function validateExposedCall(name, args, tools) {
    validateToolCall(name, args, tools);
    if (name !== "batch_execute") return;
    for (const operation of args.operations || []) {
        const tool = tools.find(item => item.name === operation.tool);
        if (!tool) throw new Error("当前工具集未开放: " + operation.tool);
        const choices = tool.inputSchema.properties.action?.enum, action = operation.params?.action;
        if (choices && typeof action === "string" && !choices.includes(action)) throw new Error("当前工具集未开放操作: " + operation.tool + "." + action);
    }
}
