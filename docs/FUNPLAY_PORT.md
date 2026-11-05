# Funplay 0.7.0 逻辑在 Creator 2.4 的适配

本项目桥接升级为定制版 1.6.0，保留 Creator 2.4.15 的主进程、场景 IPC、工具集和 stdio 代理。JSONC 范围编辑器源自 Funplay Cocos MCP 0.7.0（MIT，见 FUNPLAY_LICENSE），其余能力接入现有桥接模块。

## 工程与编辑器实例

- 标准 HTTP MCP 入口为 `http://<host>:<port>/mcp/project/<project_id>/`，支持 initialize、tools/list、tools/call、ping 和初始化通知。初始化的 `mcpBridge.context` 提供 project_path、project_id、instance_id 和 expected_context。
- 写入前必须独立核对目标工程的实际路径和标识。项目专属地址防止串工程；显式传 expected_context 才会额外锁定编辑器实例。它们不是登录或权限系统。
- 原 `/mcp-status`、`/call-tool` 等 HTTP 接口仍保留。旧地址的写调用须在 arguments.expected_context 或 _meta.expected_context 中提供已核对的凭证；冲突、旧实例或错误工程一律拒绝。
- stdio 继续使用 get_active_instances / set_active_instance。绑定可附带 projectPath，失败不覆盖原绑定。新生成配置固定 MCP_BRIDGE_PROJECT_PATH，实例重载后需要重新绑定；未配置路径的旧客户端保留显式选实例的流程。
- 截图元数据和工具响应携带项目上下文，截图凭证仍会因过期、窗口/缩放变化或 MCP 写入而失效。

## 原生点击与拖拽

新增 simulate_mouse_click 和 simulate_mouse_drag，包含 start/status/cancel。它们只面向截图所对应的编辑器主窗口，不会自动定位外部浏览器或模拟器。

1. 调 capture_editor_screenshot，传 includeMetadata:true、forceFresh:true，取得 captureId。
2. 从返回的实际图片量取 start:{x,y}，拖拽另传 end:{x,y}。传 captureId、唯一 requestKey，action:start。坐标单位始终是这张截图的像素。
3. 可设置 durationMs（拖拽 50–10000，默认 600）、pressHoldMs/endHoldMs（0–2000，默认各 100）、waitMs（0–2000，默认 1200）。输入跨独立 renderer 帧推进，时长不受游戏时间缩放控制。
4. 返回 running 时，用同一工具、原 requestKey 或 jobId 查询 status 或 cancel；同时传 key/id 时须一致。同 key、相同参数不会再次发送，修改参数复用 key 会拒绝。

只保留最近 32 份输入回执，不能跨淘汰或扩展重载当作持久事务。找不到回执时先检查实际状态，不自动换 key 重放。

输入要求窗口处于前台，持续校验截图几何。失焦、窗口销毁、凭证失效或取消均尝试释放本次鼠标；松键失败时继续占用输入锁，需显式取消原任务重试。扩展卸载时执行同样的清理。输入尚未结束时拒绝其他 MCP 写入。

回执中的 nativeGameUpdateVerified 和 businessOutcomeVerified 始终为 false：renderer 帧与已发送事件不证明 Creator 游戏 Update、命中测试或业务成功。2.4 原生窗口的实际效果需要在编辑器中单独验证。

## 连接配置、Host 与 DSH

- 自动化配置初次打开默认显示 Codex；用户手动切换后，重新扫描保留当前选择。
- 一键配置使用按工程路径派生的 mcp-bridge-<id> 名称，保留其他项目及旧通用条目。JSONC 保留注释，TOML 保留无关配置、额外参数与 env；格式歧义、重复字段、禁用项、手动改向和归属不明条目拒绝覆盖。写入前备份，原子写入仍检查并发修改。
- Host 默认 127.0.0.1，可在面板修改；先校验输入，再重启监听。地址不可用时保留原始错误和面板，不替换 Host、不自动改写配置。改监听地址后需重新配置客户端；仅向可信网络开放非本机地址。
- DeepSeek Harness 与 Deepseek-TUI 是两个不同入口。选择 DSH 时只生成工程内 `.dsh/mcp-bridge.patch.json`，使用官方 streamable-http 客户端补丁；日志显示 `dsh web --patch '…'` 启动命令。不会自动启动 DSH、加载 overlay 或编辑全局 Cordis YAML。
- 这里移植了身份/输入的工作流约束；未引入 Funplay 3.x 的场景实现或完整 Project Skills 安装面板。

## 构建与验证

运行插件目录的 `npm run build` 生成 dist，再在 Creator 2.4 扩展管理中重载 mcp-bridge；重新启动 stdio 代理。磁盘 build-info.json 不能代替已加载实例的构建标识。

新增回归位于 projectContext、projectHttp、clientConfigProtection、editorInput 测试文件，并加入 test:source。HTTP 回归使用独立回环监听器，不修改游戏场景。构建仍先做完整插件类型检查，再逐文件转译生成暂存 JS，保留 staging 失败不覆盖现有 dist 的保证；单独转译不能代替前置类型检查。
