"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateToolCall = validateToolCall;
exports.validateExposedCall = validateExposedCall;
const BatchOperations_1 = require("./BatchOperations");
const ToolCapabilities_1 = require("./ToolCapabilities");
function validateToolCall(name, args, tools) {
    const tool = tools.find(tool => tool.name === name);
    if (!tool)
        throw new Error(`未知工具: ${name}`);
    const descriptor = (0, ToolCapabilities_1.toolAlias)(name);
    const validationArgs = descriptor && args.componentName && !args.componentType ? { ...args, componentType: args.componentName } : args;
    (0, BatchOperations_1.validate)(validationArgs, tool.inputSchema, name);
    (0, BatchOperations_1.validateConditional)(name, args);
    const alias = (0, ToolCapabilities_1.resolveToolAlias)(name, args);
    if (alias.name !== name && !(descriptor.nodeKey && !alias.args[descriptor.nodeKey] && (args.path || args.name)))
        (0, BatchOperations_1.validateConditional)(alias.name, alias.args);
}
/** 批处理还会在解析引用后逐项校验；此处先拒绝隐藏入口与字面量越权操作。 */
function validateExposedCall(name, args, tools) {
    var _a, _b;
    validateToolCall(name, args, tools);
    if (name !== "batch_execute")
        return;
    for (const operation of args.operations || []) {
        const tool = tools.find(item => item.name === operation.tool);
        if (!tool)
            throw new Error("当前工具集未开放: " + operation.tool);
        const choices = (_a = tool.inputSchema.properties.action) === null || _a === void 0 ? void 0 : _a.enum, action = (_b = operation.params) === null || _b === void 0 ? void 0 : _b.action;
        if (choices && typeof action === "string" && !choices.includes(action))
            throw new Error("当前工具集未开放操作: " + operation.tool + "." + action);
    }
}
