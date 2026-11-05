type MenuAction = {
    page: "main" | "config";
    target: string;
    invoke?: "click" | "toggle";
    waitFor?: "server" | "dashboard" | "tools" | "clients";
};

/** 顶部菜单复用面板控件，避免另存配置或维护第二套操作逻辑。 */
export const PANEL_MENU_ACTIONS: { [name: string]: MenuAction } = {
    "server": { page: "main", target: "btnToggle", invoke: "click", waitFor: "server" },
    "restart": { page: "main", target: "btnRestart", invoke: "click" },
    "copy-endpoint": { page: "main", target: "btnCopyEndpoint", invoke: "click", waitFor: "dashboard" },
    "copy-cli": { page: "main", target: "btnCopyCli", invoke: "click", waitFor: "dashboard" },
    "refresh-status": { page: "main", target: "btnRefreshStatus", invoke: "click" },
    "open-project": { page: "main", target: "btnOpenProject", invoke: "click", waitFor: "dashboard" },
    "call-history": { page: "main", target: "callHistory" },
    "clear-calls": { page: "main", target: "btnClearCalls", invoke: "click" },
    "logs": { page: "main", target: "logConsole" },
    "copy-logs": { page: "main", target: "btnCopy", invoke: "click", waitFor: "server" },
    "clear-logs": { page: "main", target: "btnClear", invoke: "click" },
    "toolchain": { page: "config", target: "toolchainSettings", waitFor: "clients" },
    "client": { page: "config", target: "mcpClientSelect", waitFor: "clients" },
    "scan-clients": { page: "config", target: "btnRefreshMcp", invoke: "click" },
    "configure-client": { page: "config", target: "btnInjectMcp", invoke: "click", waitFor: "clients" },
    "configure-all": { page: "config", target: "btnInjectAll", invoke: "click", waitFor: "clients" },
    "connection": { page: "main", target: "serverSettings" },
    "port": { page: "main", target: "portInput", waitFor: "server" },
    "host": { page: "main", target: "hostInput", waitFor: "server" },
    "apply-host": { page: "main", target: "btnApplyHost", invoke: "click", waitFor: "server" },
    "auto-start": { page: "main", target: "autoStartCheck", invoke: "toggle", waitFor: "server" },
    "tools": { page: "config", target: "toolExposureSettings" },
    "preset": { page: "config", target: "toolPresetSelect", waitFor: "tools" },
    "preset-name": { page: "config", target: "toolPresetName", waitFor: "tools" },
    "tool-mode": { page: "config", target: "toolProfileMode", waitFor: "tools" },
    "search-tools": { page: "config", target: "toolSearch" },
    "hide-compat": { page: "config", target: "hideCompatTools", invoke: "toggle", waitFor: "tools" },
    "reload-presets": { page: "config", target: "btnLoadPresets", invoke: "click" },
    "select-tools": { page: "config", target: "btnSelectAllTools", invoke: "click", waitFor: "tools" },
    "clear-tools": { page: "config", target: "btnClearTools", invoke: "click", waitFor: "tools" },
    "reset-tools": { page: "config", target: "btnResetTools", invoke: "click", waitFor: "tools" },
    "save-preset": { page: "config", target: "btnSavePreset", invoke: "click", waitFor: "tools" },
    "export-presets": { page: "config", target: "btnExportPresets", invoke: "click", waitFor: "tools" },
    "import-presets": { page: "config", target: "btnImportPresets", invoke: "click", waitFor: "tools" },
    "screenshots": { page: "config", target: "screenshotSettings" },
    "screenshot-width": { page: "config", target: "screenshotWidthInput", waitFor: "server" },
    "screenshot-throttle": { page: "config", target: "screenshotThrottleInput", waitFor: "server" },
    "save-screenshots": { page: "config", target: "btnSaveScreenshotSettings", invoke: "click", waitFor: "server" },
};

export function openPanelMenu(editor: any, name: string) {
    if (!Object.prototype.hasOwnProperty.call(PANEL_MENU_ACTIONS, name)) throw new Error("未知的 MCP 菜单操作：" + name);
    // Creator 在面板 ready 后调用 run，首次打开也不会丢失菜单参数。
    editor.Panel.open("mcp-bridge", { menuAction: name });
}

export async function runPanelMenu(panel: any, name: string) {
    if (!Object.prototype.hasOwnProperty.call(PANEL_MENU_ACTIONS, name)) throw new Error("未知的 MCP 菜单操作：" + name);
    const action = PANEL_MENU_ACTIONS[name], els = panel.menuElements;
    panel.switchMenuTab(action.page === "config" ? els.tabConfig : els.tabMain,
        action.page === "config" ? els.panelConfig : els.panelMain);
    // 首次打开时，预设列表和调用记录的异步渲染会改变控件位置。
    await (action.page === "config" ? panel.menuToolsReady : Promise.all([panel.menuServerReady, panel.menuDashboardReady]));
    let ready = true;
    if (action.waitFor === "clients") {
        ready = await panel.fetchMcpClients(els);
    } else if (action.waitFor) {
        const pending = { server: panel.menuServerReady, dashboard: panel.menuDashboardReady, tools: panel.menuToolsReady };
        ready = action.waitFor === "dashboard" && !!panel.dashboardData || await pending[action.waitFor];
    }
    if (panel.dashboardClosed) return;
    if (!ready) throw new Error("面板数据读取失败，请重新读取后操作");
    const target = panel.shadowRoot.querySelector("#" + action.target);
    if (!target) throw new Error("找不到菜单对应的面板选项：" + action.target);
    if (target.disabled) throw new Error("当前状态下该操作不可用，请先检查面板状态");
    for (let parent = target.parentElement; parent; parent = parent.parentElement) {
        if (parent.tagName === "DETAILS") parent.open = true;
    }
    target.scrollIntoView({ block: "center" });
    target.focus();
    if (action.invoke === "toggle") {
        if (target.tagName === "UI-CHECKBOX") target.value = !target.value;
        else target.checked = !target.checked;
        target.dispatchEvent(new Event("change", { bubbles: true }));
    } else if (action.invoke === "click") target.click();
}
