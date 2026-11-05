import { CommandQueue } from "../core/CommandQueue";
import * as fs from "fs";
import * as crypto from "crypto";

declare const Editor: any;

/** 保留编辑器原有写入路径，只在完成回执/读回后交还执行权。 */
export class EditorWriteTools {
    /** AssetDB 删除回调可能早于磁盘移入回收站，读回确认后再报告完成。 */
    static deleteAsset(url, callback) {
        let file;
        try { file = Editor.assetdb.urlToFspath(url); if (!file) throw new Error("资源路径无效"); }
        catch (error) { callback(error); return; }
        const release = CommandQueue.trackEditorOperation();
        let finished = false, reported = false, pollTimer;
        const finish = error => {
            if (finished) return;
            finished = true; clearTimeout(deadline); clearTimeout(pollTimer);
            try { if (!reported) { reported = true; callback(error); } } finally { release(); }
        };
        const deadline = setTimeout(() => {
            reported = true;
            CommandQueue.blockPending("资源删除尚未确认，请等待磁盘完成或重载插件，不能直接重试");
            callback("资源删除超时，磁盘完成状态未知: " + url);
        }, 15000);
        const poll = () => {
            if (finished) return;
            try { if (!Editor.assetdb.exists(url) && !fs.existsSync(file) && !fs.existsSync(file + ".meta")) return finish(null); }
            catch (error) { return finish(error); }
            pollTimer = setTimeout(poll, reported ? 500 : 30);
        };
        try { Editor.assetdb.delete([url], error => { if (error) finish(error); else poll(); }); }
        catch (error) { finish(error); }
    }
    static updatePrefab(args, callback) {
        const url = args.path, uuid = Editor.assetdb.urlToUuid(url);
        if (!args.nodeId || !uuid) return callback("更新预制体需要有效 nodeId 和已存在的目标资源");
        CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "get-prefab-update-state", { nodeId: args.nodeId }, (err, state) => {
            if (err) return callback(err);
            if (!state || state.rootId !== args.nodeId || state.assetUuid !== uuid) {
                return callback("节点必须是目标预制体的根实例，不能覆盖其他预制体或使用未关联的普通节点");
            }
            if (CommandQueue.getBlockedReason()) return callback(CommandQueue.getBlockedReason());
            if (state.mode === "prefab") {
                if (state.activePrefabUuid !== uuid) return callback("当前打开的预制体与目标不一致");
                CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "save-prefab", {}, saveErr => {
                    if (saveErr) return callback(saveErr);
                    EditorWriteTools.refreshAfterWrite(url, callback);
                });
                return;
            }
            // Creator 2.4 的标准应用消息没有可靠回执：观察目标落盘，稳定后再等 AssetDB 同步。
            let file: string, before: string;
            const fingerprint = () => {
                const content = fs.readFileSync(file, "utf8");
                const data = JSON.parse(content);
                if (!Array.isArray(data) || data[0]?.__type__ !== "cc.Prefab") throw new Error("目标不是有效预制体数据");
                const stat = fs.statSync(file);
                return `${stat.mtimeMs}:${stat.size}:` + crypto.createHash("sha256").update(content).digest("hex");
            };
            try { file = Editor.assetdb.urlToFspath(url); before = fingerprint(); }
            catch (e) { callback(e); return; }
            const complete = CommandQueue.trackEditorOperation();
            let finished = false, reported = false, refreshing = false, previous = "", pollTimer;
            const finish = (writeErr?, result?) => {
                if (finished) return;
                finished = true; clearTimeout(deadline); clearTimeout(pollTimer);
                try { if (!reported) { reported = true; callback(writeErr, result); } }
                finally { complete(); }
            };
            const deadline = setTimeout(() => {
                if (finished) return;
                reported = true;
                CommandQueue.blockPending(`预制体更新结果尚未确认: ${url}，请等完成或重载插件，不能直接重试`);
                callback(`预制体更新超时，未确认目标落盘/同步，后续操作已暂停: ${url}`);
            }, 30000);
            const poll = () => {
                if (finished || refreshing) return;
                try {
                    const current = fingerprint();
                    if (current !== before && current === previous) {
                        refreshing = true;
                        EditorWriteTools.refreshAfterWrite(url, (refreshErr, result) => finish(refreshErr, result));
                        return;
                    }
                    previous = current;
                } catch (e) { previous = ""; } // 写入中的半成品不能当作完成。
                pollTimer = setTimeout(poll, reported ? 1000 : 200);
            };
            try { Editor.Ipc.sendToPanel("scene", "scene:apply-prefab", args.nodeId); poll(); }
            catch (e) { finish(e); }
        });
    }

    static rename(args, callback) {
        const readName = cb => CommandQueue.callSceneScriptWithTimeout("mcp-bridge", "get-node-name", { id: args.id }, cb);
        readName(err => {
            if (err) return callback(err);
            const blocked = CommandQueue.getBlockedReason();
            if (blocked) return callback(blocked);
            const complete = CommandQueue.trackEditorOperation();
            let finished = false, reported = false, pollTimer;
            const finish = (writeErr = null) => {
                if (finished) return;
                finished = true; clearTimeout(deadline); clearTimeout(pollTimer);
                try { if (!reported) callback(writeErr, writeErr ? undefined : `节点名称已更新为 ${args.newName}`); }
                finally { complete(); }
            };
            const deadline = setTimeout(() => {
                if (finished || reported) return;
                reported = true;
                CommandQueue.blockPending("节点名称写入尚未确认，请等完成或重载插件，不能直接重试");
                callback("节点名称写入超时，尚未确认结果，后续操作已暂停");
            }, 15000);
            const poll = () => readName((readErr, node) => {
                if (readErr) {
                    // 查询超时仍可能有迟到的写入，保留锁直到重载；节点已删除则无迟到写入目标。
                    if (/找不到节点|node missing/.test(String(readErr))) finish(readErr);
                    else if (!reported) { reported = true; clearTimeout(deadline); CommandQueue.blockPending(String(readErr)); callback(readErr); }
                    return;
                }
                if (node?.name === args.newName) finish();
                else pollTimer = setTimeout(poll, reported ? 1000 : 100);
            });
            try {
                Editor.Ipc.sendToPanel("scene", "scene:set-property", {
                    id: args.id, path: "name", type: "String", value: args.newName, isSubProp: false,
                });
                poll();
            } catch (e) { finish(e); }
        });
    }

    static refreshAfterWrite(url: string, callback: Function) {
        const complete = CommandQueue.trackEditorOperation();
        let settled = false;
        const finish = err => {
            if (settled) return;
            settled = true;
            try {
                callback(err ? `文件已落盘，但 AssetDB 同步失败: ${err.message || err}` : null,
                    err ? undefined : `文件已落盘且 AssetDB 已同步: ${url}`);
            } finally { complete(); }
        };
        try { Editor.assetdb.refresh(url, finish); }
        catch (err) { finish(err); }
    }
}
