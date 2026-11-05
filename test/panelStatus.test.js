const assert = require('node:assert/strict');
const { test } = require('node:test');
const { loadSource, fakeClock } = require('./sourceHarness');

function loadStatus(gitError = false) {
  const calls = [];
  const module = loadSource('core/PanelStatus.ts', {
    Editor: { Project: { path: '/project with spaces' }, App: { version: '2.4.15' } },
    process: { pid: 123 },
  }, {
    child_process: { execFile(command, args, options, callback) {
      calls.push({ command, args, options }); callback(gitError ? new Error('git unavailable') : null, args.includes('--short') ? 'abc123\n' : 'main\n');
    } },
    './BuildInfo': { getRuntimeInfo: () => ({ version: '1.4.1', buildId: '12345678' }) },
    './CommandQueue': { CommandQueue: { snapshot: () => ({ waiting: 0, current: null }) } },
    './CallActivity': { CallActivity: { totalCalls: 12 } },
    '../tools/ToolRegistry': { getToolsList: () => [1, 2] },
    '../tools/ToolPresetStore': { configuredTools: (project, tools) => tools },
    './McpWrappers': { McpWrappers: { getResourcesList: () => [1] } },
  });
  return { ...module, calls };
}

test('概览返回实际监听端口、调用数和带空格路径的代理命令，Git 查询不启动窗口', async () => {
  const { queryPanelStatus, calls } = loadStatus();
  const data = await queryPanelStatus({ active: true, state: 'listening', port: 3457 });
  assert.match(data.endpoint, /^http:\/\/127\.0\.0\.1:3457\/mcp\/project\/[0-9a-f]{24}\/$/);
  assert.match(data.cli, /^node ".*project with spaces.*mcp-proxy.js" 3457$/);
  assert.equal(data.requests, 12); assert.equal(data.tools, 2); assert.equal(data.resources, 1);
  assert.equal(data.branch, 'main'); assert.equal(data.head, 'abc123'); assert.equal(data.editorPid, 123);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.command, 'git'); assert.equal(call.options.windowsHide, true);
    assert.equal(call.options.timeout, 2000); assert.equal(call.options.cwd, '/project with spaces');
  }
});

test('停止或启动中的服务不提供可复制端点，Git 失败保持状态可用', async () => {
  const { queryPanelStatus } = loadStatus(true);
  for (const state of ['stopped', 'starting']) {
    const data = await queryPanelStatus({ active: false, state, port: 3457 });
    assert.equal(data.endpoint, ''); assert.equal(data.branch, '—'); assert.equal(data.head, '—');
    assert.equal(data.config.state, state); assert.equal(data.engineVersion, '2.4.15');
  }
});

function loadPanel(openPath = async () => '') {
  const elements = new Map(), requests = [], clock = fakeClock();
  let panel;
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set(), events = {};
      elements.set(id, {
        textContent: '', disabled: false, style: {},
        appendChild() {},
        classList: {
          add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name),
          toggle(name, value) { if (value) classes.add(name); else classes.delete(name); },
        },
        addEventListener(name, fn) { events[name] = fn; },
        click() { if (!this.disabled) return events.click(); },
      });
    }
    return elements.get(id);
  }
  loadSource('panel/index.ts', {
    document: { createElement: () => ({}) },
    Editor: {
      url: value => value, Panel: { extend(value) { panel = value; } },
      Ipc: { sendToMain(channel, callback) { if (channel === 'mcp-bridge:get-panel-status') requests.push(callback); } },
    },
    setTimeout: clock.setTimeout, clearTimeout: clock.clearTimeout,
    setInterval: () => 1, clearInterval() {},
  }, { fs: { readFileSync: () => '' }, path: require('node:path').win32, electron: { shell: { openPath } } });
  panel.shadowRoot = { querySelector: element };
  panel.ready();
  const data = {
    config: { active: true }, endpoint: 'http://127.0.0.1:3457', tools: 43, resources: 3, requests: 12,
    projectPath: 'E:\\project with spaces/creator', engineVersion: '2.4.15', branch: 'main', head: 'abc123', editorPid: 123,
    runtime: { version: '1.4.1', buildId: '12345678' }, queue: { waiting: 0 }, updatedAt: '2026-10-23T09:00:00.000Z',
  };
  return { panel, element, requests, clock, data };
}

test('手动刷新按钮请求最新状态并显示完成反馈，自动刷新不覆盖操作提示', () => {
  const { panel, element, requests, data } = loadPanel();
  requests.shift()(null, data);
  element('#btnRefreshStatus').click();
  assert.equal(element('#btnRefreshStatus').disabled, true);
  assert.equal(element('#btnRefreshStatus').textContent, '刷新中…');
  requests.shift()(null, { ...data, requests: 27 });
  assert.equal(element('#btnRefreshStatus').disabled, false);
  assert.equal(element('#requestCount').textContent, '工具调用 27');
  assert.match(element('#dashboardNotice').textContent, /状态已刷新/);
  element('#dashboardNotice').textContent = '已打开工程目录';
  panel.refreshDashboard(); requests.shift()(null, data);
  assert.equal(element('#dashboardNotice').textContent, '已打开工程目录');
});

test('状态请求超时恢复按钮、忽略过期回执，并允许重新刷新', () => {
  const { element, requests, clock, data } = loadPanel();
  const lateReply = requests.shift();
  clock.tick(5000);
  assert.equal(element('#btnRefreshStatus').disabled, false);
  assert.match(element('#dashboardNotice').textContent, /响应超时/);
  element('#btnRefreshStatus').click();
  lateReply(null, { ...data, requests: 999 });
  assert.equal(element('#btnRefreshStatus').disabled, true);
  requests.shift()(null, data);
  assert.equal(element('#requestCount').textContent, '工具调用 12');
  assert.match(element('#dashboardNotice').textContent, /状态已刷新/);
  assert.equal(element('#dashboardNotice').classList.contains('error'), false);
});

test('打开工程目录使用内置Electron的openPath及规范化目录，失败和未就绪均有反馈', async () => {
  const opened = [];
  let success = true;
  const { element, requests, data } = loadPanel(async value => { opened.push(value); return success ? '' : '系统未能打开目录'; });
  await element('#btnOpenProject').click();
  assert.match(element('#dashboardNotice').textContent, /工程信息尚未读取/);
  assert.equal(opened.length, 0);
  requests.shift()(null, data);
  await element('#btnOpenProject').click();
  assert.equal(opened[0], 'E:\\project with spaces\\creator');
  assert.match(element('#dashboardNotice').textContent, /已打开工程目录/);
  success = false; await element('#btnOpenProject').click();
  assert.match(element('#dashboardNotice').textContent, /打开工程目录失败/);
  assert.equal(element('#dashboardNotice').classList.contains('error'), true);
  assert.equal(element('#btnOpenProject').disabled, false);
});

test('面板关闭清理刷新超时，迟到回执不再更新界面', () => {
  const { panel, element, requests, clock, data } = loadPanel();
  panel.close(); clock.tick(5000); requests.shift()(null, data);
  assert.equal(element('#dashboardNotice').textContent, '');
  assert.equal(element('#requestCount').textContent, '');
});

test('面板重新就绪后忽略上次生命周期回执，并保留新请求的超时保护', () => {
  const { panel, element, requests, clock, data } = loadPanel();
  const oldReply = requests.shift();
  panel.close(); panel.ready();
  oldReply(null, { ...data, requests: 999 });
  assert.equal(element('#btnRefreshStatus').disabled, true);
  assert.equal(element('#requestCount').textContent, '');
  clock.tick(5000);
  assert.equal(element('#btnRefreshStatus').disabled, false);
  assert.match(element('#dashboardNotice').textContent, /响应超时/);
});
