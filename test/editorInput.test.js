const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource } = require('./sourceHarness');
function setup() {
    let now = 0, focused = true, destroyed = false, stale = false, invalidations = 0, frameHook;
    const events = [];
    const win = { isFocused: () => focused, isDestroyed: () => destroyed,
        getContentBounds: () => ({ x: 100, y: 200 }),
        webContents: { isDestroyed: () => destroyed, executeJavaScript() {}, sendInputEvent(event) { if (destroyed) throw Error('destroyed'); events.push(event); } } };
    const { EditorInputController } = loadSource('tools/EditorInput.ts');
    const input = new EditorInputController({ window: () => win, now: () => now,
        resolve: args => { if (stale) throw Error('stale'); return { points: args.points.map(point => ({ windowContent: point })) }; },
        frame: async () => { now += 16; if (frameHook) await frameHook(); }, invalidate: () => { invalidations++; } });
    const args = { captureId: 'fresh', requestKey: 'unique', start: { x: 1, y: 2 }, end: { x: 30, y: 40 }, durationMs: 64, pressHoldMs: 16, endHoldMs: 16 };
    return { input, args, events, win, setFocused: value => focused = value, destroy: () => destroyed = true,
        setStale: () => stale = true, hook: value => frameHook = value, invalidations: () => invalidations };
}
test('拖拽经过独立渲染帧，发送屏幕坐标和按住标志，重复 key 不重放', async () => {
    const s = setup(), result = await s.input.execute('simulate_mouse_drag', s.args);
    assert.equal(result.state, 'completed'); assert.equal(result.businessOutcomeVerified, false);
    assert.deepEqual(s.events.map(event => event.type), ['mouseMove', 'mouseDown', 'mouseMove', 'mouseMove', 'mouseMove', 'mouseMove', 'mouseUp']);
    assert.equal(s.events[2].modifiers[0], 'leftButtonDown'); assert.equal(s.events.at(-1).globalX, 130); assert.equal(s.events.at(-1).globalY, 240);
    const count = s.events.length;
    assert.equal((await s.input.execute('simulate_mouse_drag', s.args)).jobId, result.jobId); assert.equal(s.events.length, count);
    await assert.rejects(s.input.execute('simulate_mouse_drag', { ...s.args, end: { x: 2, y: 3 } }), /不同/);
    assert.equal(s.input.isBusy(), false); assert.equal(s.invalidations(), 1);
});
test('失焦、坐标失效与窗口销毁会结束任务并尝试释放，不能报告成功', async () => {
    for (const interrupt of ['focus', 'stale', 'destroy']) {
        const s = setup(); s.hook(() => { if (interrupt === 'focus') s.setFocused(false); if (interrupt === 'stale') s.setStale(); if (interrupt === 'destroy') s.destroy(); });
        const result = await s.input.execute('simulate_mouse_drag', s.args);
        assert.equal(result.state, 'failed', interrupt); assert.equal(result.releasePending, false); assert.equal(s.input.isBusy(), false);
        if (interrupt !== 'destroy') assert.equal(s.events.at(-1).type, 'mouseUp');
    }
});
test('取消、工具归属及 key/id 一致性；等待中的输入拒绝第二个 start', async () => {
    const s = setup(); let releaseFrame; s.hook(() => new Promise(resolve => { releaseFrame = resolve; }));
    const running = await s.input.execute('simulate_mouse_drag', { ...s.args, waitMs: 0 }); assert.equal(running.state, 'running');
    await assert.rejects(s.input.execute('simulate_mouse_drag', { ...s.args, requestKey: 'other', waitMs: 0 }), /尚未/);
    await assert.rejects(s.input.execute('simulate_mouse_drag', { action: 'cancel', jobId: running.jobId, requestKey: 'wrong' }), /不匹配/);
    await assert.rejects(s.input.execute('simulate_mouse_click', { action: 'cancel', jobId: running.jobId }), /另一个工具/);
    const cancelled = await s.input.execute('simulate_mouse_drag', { action: 'cancel', requestKey: s.args.requestKey });
    assert.equal(cancelled.state, 'cancelled'); assert.equal(s.events.at(-1).type, 'mouseUp');
    releaseFrame(); await new Promise(setImmediate); assert.equal(s.input.isBusy(), false);
});
test('mouseDown 发送异常仍尝试松键，缺少原生 API 时不发送事件', async () => {
    const s = setup(), send = s.win.webContents.sendInputEvent;
    s.win.webContents.sendInputEvent = event => { if (event.type === 'mouseDown') throw Error('send failed'); send(event); };
    assert.equal((await s.input.execute('simulate_mouse_click', s.args)).state, 'failed');
    assert.equal(s.events.at(-1).type, 'mouseUp');
    const noApi = setup(); noApi.win.webContents.executeJavaScript = undefined;
    await assert.rejects(noApi.input.execute('simulate_mouse_click', noApi.args), /不支持/); assert.equal(noApi.events.length, 0);
});
