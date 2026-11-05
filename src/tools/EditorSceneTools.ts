import { CommandQueue } from "../core/CommandQueue";

declare const Editor: any;

/** 打开操作没有完成回执，必须读回目标资源身份后才算完成。 */
export class EditorSceneTools {
	public static open(url: string, prefab: boolean, callback: Function, onSettled: () => void) {
		let uuid: string;
		try { uuid = Editor.assetdb.urlToUuid(url); }
		catch (err) { onSettled(); callback(err); return; }
		if (!uuid) { onSettled(); callback(`找不到路径为 ${url} 的资源`); return; }
		const complete = CommandQueue.trackEditorOperation();
		let finished = false;
		let reported = false;
		let pollTimer: any;
		const finish = (err?: any, state?: any) => {
			if (finished) return;
			finished = true;
			clearTimeout(deadline);
			clearTimeout(pollTimer);
			complete();
			onSettled();
			if (!reported) { reported = true; callback(err, state); }
		};
		const deadline = setTimeout(() => {
			reported = true;
			CommandQueue.blockPending(`打开资源超时且状态尚未确认: ${url}，等待完成或重载插件`);
			callback(`打开资源超时: ${url}，未报告成功，后续操作已暂停`);
		}, 30000);
		const poll = () => {
			if (finished) return;
			let replied = false;
			const retry = setTimeout(() => {
				replied = true;
				pollTimer = setTimeout(poll, reported ? 1000 : 200);
			}, 2000);
			try {
				Editor.Scene.callSceneScript("mcp-bridge", "get-edit-state", {}, (err, state) => {
					if (finished || replied) return;
					replied = true;
					clearTimeout(retry);
					const ready = !err && state && (prefab
						? state.mode === "prefab" && state.prefabUuid === uuid
						: state.mode === "scene" && state.sceneUuid === uuid);
					if (ready) finish(null, { url, uuid, mode: state.mode, ready: true });
					else pollTimer = setTimeout(poll, reported ? 1000 : 200);
				});
			} catch (e) { clearTimeout(retry); finish(e); }
		};
		try {
			if (prefab) Editor.Ipc.sendToAll("scene:enter-prefab-edit-mode", uuid);
			else Editor.Ipc.sendToMain("scene:open-by-uuid", uuid);
			poll();
		} catch (e) { finish(e); }
	}
}
