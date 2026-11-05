const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { loadSource } = require('./sourceHarness');

class ChangeEvent {
  constructor(type, options) { this.type = type; Object.assign(this, options); }
}
const { PANEL_MENU_ACTIONS, openPanelMenu, runPanelMenu } = loadSource('panel/MenuActions.ts', { Event: ChangeEvent });

function fixture() {
  const nodes = new Map();
  for (const action of Object.values(PANEL_MENU_ACTIONS)) {
    nodes.set('#' + action.target, {
      tagName: 'BUTTON', disabled: false, clicks: 0, events: [],
      parentElement: { tagName: 'DETAILS', open: false, parentElement: null },
      scrollIntoView() { this.scrolled = true; }, focus() { this.focused = true; },
      click() { this.clicks++; }, dispatchEvent(event) { this.events.push(event); },
    });
  }
  const panel = {
    shadowRoot: { querySelector: selector => nodes.get(selector) },
    menuElements: { tabMain: 'main-tab', panelMain: 'main-page', tabConfig: 'config-tab', panelConfig: 'config-page' },
    switchMenuTab(tab, page) { this.visible = page; },
    menuServerReady: Promise.resolve(true), menuDashboardReady: Promise.resolve(true), menuToolsReady: Promise.resolve(true),
    fetchMcpClients: () => Promise.resolve(true), dashboardClosed: false,
  };
  return { panel, node: id => nodes.get('#' + id) };
}

test('顶部菜单的每个选项都有唯一操作与真实面板控件，分属工具链和设置', () => {
  const root = path.join(__dirname, '..');
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const html = fs.readFileSync(path.join(root, 'panel/index.html'), 'utf8');
  const entries = Object.entries(pkg['main-menu']).filter(([, item]) => item.message === 'mcp-bridge:menu-action');
  assert.equal(entries.length, Object.keys(PANEL_MENU_ACTIONS).length);
  assert.equal(new Set(entries.map(([, item]) => item.params[0])).size, entries.length);
  for (const [label, item] of entries) {
    assert.match(label, /^MCP 桥接器\/(工具链|设置)\/[^/]+$/);
    const action = PANEL_MENU_ACTIONS[item.params[0]];
    assert.ok(action, label);
    assert.ok(html.includes('id="' + action.target + '"'), label);
  }
});

test('主进程菜单通过 Panel.open 的 run 参数传递操作，首次打开与已打开共用入口', () => {
  const opened = [];
  const Editor = { Panel: { open: (...args) => opened.push(args) } };
  const main = loadSource('main.ts', { Editor });
  main.messages['menu-action'].call(main, null, 'screenshots');
  main.openMenuAction(null, 'toolchain');
  assert.equal(opened.length, 2);
  assert.equal(opened[0][0], 'mcp-bridge');
  assert.equal(opened[0][1].menuAction, 'screenshots');
  assert.equal(opened[1][1].menuAction, 'toolchain');
  assert.throws(() => openPanelMenu(Editor, '__proto__'), /未知/);
  assert.equal(opened.length, 2);
});

test('输入项跳到正确分页并定位控件；日志入口会展开折叠栏', async () => {
  const s = fixture();
  await runPanelMenu(s.panel, 'screenshot-width');
  assert.equal(s.panel.visible, 'config-page');
  assert.equal(s.node('screenshotWidthInput').focused, true);
  assert.equal(s.node('screenshotWidthInput').clicks, 0);
  await runPanelMenu(s.panel, 'logs');
  assert.equal(s.panel.visible, 'main-page');
  assert.equal(s.node('logConsole').parentElement.open, true);
});

test('预设未读完时不保存，读取完成后只触发一次现有保存操作', async () => {
  const s = fixture(); let complete;
  s.panel.menuToolsReady = new Promise(resolve => { complete = resolve; });
  const pending = runPanelMenu(s.panel, 'save-preset');
  await Promise.resolve();
  assert.equal(s.node('btnSavePreset').clicks, 0);
  complete(true); await pending;
  assert.equal(s.node('btnSavePreset').clicks, 1);
});

test('首次打开截图选项时等待预设列表渲染完成再滚动，避免随后被挤出视口', async () => {
  const s = fixture(); let complete;
  s.panel.menuToolsReady = new Promise(resolve => { complete = resolve; });
  const pending = runPanelMenu(s.panel, 'screenshots');
  await Promise.resolve();
  assert.equal(s.node('screenshotSettings').scrolled, undefined);
  complete(true); await pending;
  assert.equal(s.node('screenshotSettings').scrolled, true);
});

test('读取失败、禁用或已关闭时不执行菜单操作', async () => {
  const s = fixture();
  s.panel.menuDashboardReady = Promise.resolve(false);
  await assert.rejects(runPanelMenu(s.panel, 'copy-cli'), /读取失败/);
  assert.equal(s.node('btnCopyCli').clicks, 0);
  s.panel.dashboardData = { cli: 'proxy command' };
  await runPanelMenu(s.panel, 'copy-cli');
  assert.equal(s.node('btnCopyCli').clicks, 1, '手动刷新成功后菜单可以恢复使用');
  s.node('btnRestart').disabled = true;
  await assert.rejects(runPanelMenu(s.panel, 'restart'), /不可用/);
  assert.equal(s.node('btnRestart').clicks, 0);
  let complete;
  s.panel.menuToolsReady = new Promise(resolve => { complete = resolve; });
  const pending = runPanelMenu(s.panel, 'import-presets');
  s.panel.dashboardClosed = true; complete(true); await pending;
  assert.equal(s.node('btnImportPresets').clicks, 0);
});

test('自动启动和兼容入口筛选复用原控件的 change 事件', async () => {
  const s = fixture();
  const auto = s.node('autoStartCheck'); auto.tagName = 'UI-CHECKBOX'; auto.value = false;
  await runPanelMenu(s.panel, 'auto-start');
  assert.equal(auto.value, true); assert.equal(auto.events.length, 1);
  const compat = s.node('hideCompatTools'); compat.tagName = 'INPUT'; compat.checked = true;
  await runPanelMenu(s.panel, 'hide-compat');
  assert.equal(compat.checked, false); assert.equal(compat.events[0].type, 'change');
});

test('宿主平台扫描成功前不分发配置，失败时不会写入', async () => {
  const s = fixture(); let complete;
  let scanStarted;
  const started = new Promise(resolve => { scanStarted = resolve; });
  s.panel.fetchMcpClients = () => new Promise(resolve => { complete = resolve; scanStarted(); });
  const pending = runPanelMenu(s.panel, 'configure-client');
  await started; assert.equal(s.node('btnInjectMcp').clicks, 0);
  complete(false); await assert.rejects(pending, /读取失败/);
  assert.equal(s.node('btnInjectMcp').clicks, 0);
  s.panel.fetchMcpClients = () => Promise.resolve(true);
  await runPanelMenu(s.panel, 'configure-client');
  assert.equal(s.node('btnInjectMcp').clicks, 1);
});

test('重复宿主扫描共用在途请求，完成后保留用户选择', async () => {
  let definition, reply, requests = 0;
  const root = path.join(__dirname, '..');
  const Editor = {
    url: value => path.join(root, value.replace('packages://mcp-bridge/', '')),
    Panel: { extend: value => { definition = value; } },
    Ipc: { sendToMain(channel, callback) { requests++; reply = callback; } },
  };
  loadSource('panel/index.ts', { Editor, document: { createElement: () => ({}) } });
  const panel = { renderMcpClientStatus() {} };
  const els = { mcpClientSelect: { value: '7', appendChild() {} }, mcpConfigStatus: {} };
  const first = definition.fetchMcpClients.call(panel, els);
  const second = definition.fetchMcpClients.call(panel, els);
  assert.equal(first, second); assert.equal(requests, 1);
  reply(null, [{ id: 1, name: 'Codex' }, { id: 7, name: 'Other' }]);
  assert.equal(await first, true); assert.equal(els.mcpClientSelect.value, '7');
  assert.equal(panel.clientScanPending, null);
});
