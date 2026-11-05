"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UndoGroups = void 0;
/** 使用 Creator 2.4 场景撤销栈，将跨 MCP 请求的记录合并或回退。 */
class UndoGroups {
    constructor() {
        this.group = null;
    }
    execute(action, args, scene, findNode, undo) {
        const stack = undo._undo;
        if (!stack || typeof stack._position !== "number")
            throw new Error("当前场景未提供 Creator 2.4 撤销栈");
        if (action === "begin_group") {
            if (this.group)
                throw new Error("已有活动撤销组，请先结束或取消");
            if (args.id && !findNode(args.id))
                throw new Error("撤销组目标节点不存在");
            this.group = { scene, position: stack._position, description: args.description || "MCP 操作" };
            if (args.id)
                undo.recordNode(args.id, this.group.description);
            return { begun: true, position: stack._position };
        }
        if (!this.group)
            throw new Error("没有活动撤销组");
        const group = this.group;
        if (scene !== group.scene) {
            this.group = null;
            throw new Error("场景已变化，拒绝操作其他场景的撤销栈");
        }
        undo.commit();
        if (action === "end_group") {
            const first = group.position + 1;
            if (stack._position > first)
                stack.collapseTo(first);
            this.group = null;
            return { committed: true, position: stack._position };
        }
        if (action !== "cancel_group")
            throw new Error("未知撤销组操作");
        let reverted = 0;
        while (stack._position > group.position) {
            undo.undo();
            reverted++;
        }
        undo.cancel();
        if (reverted)
            stack._clearRedo();
        this.group = null;
        return { cancelled: true, reverted, position: stack._position };
    }
}
exports.UndoGroups = UndoGroups;
