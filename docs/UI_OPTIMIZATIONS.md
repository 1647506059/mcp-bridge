# 1.4.0：UI 操作效率与验证

适用 Cocos Creator 2.4.x。更新后先重载 Creator 插件，再重启 MCP 客户端中的代理连接；用 `get_project_info({includeMcpDiagnostics:true})` 确认 editor / scene / proxy 三侧版本及 buildId 一致。替换磁盘文件不会更新已经加载的进程。

1.4.1 修复 `settings/mcp-bridge.json` 中数字字符键污染：`Editor.Profile.load` 传入默认对象，启动及截图时只清理完整的旧 `mcp-bridge` 字符签名，保留其他设置。

## 场景内批处理

`batch_execute` 默认 `executionMode:"auto"`。整批只包含以下工具时，使用一次 SceneScript IPC，内部仍严格串行：`create_node`、`update_node_transform`、`manage_components`、`get_scene_hierarchy`、`find_gameobjects`。重复的 dirty 和同节点 changed 通知合并；节点 created 通知保持原路径。

```json
{
  "operations": [
    {"id":"panel","tool":"create_node","params":{"name":"Panel","type":"empty","parentId":"已核实的父节点UUID","returnDetails":true}},
    {"tool":"update_node_transform","params":{"id":{"$ref":"panel.uuid"},"width":600,"height":400}},
    {"tool":"manage_components","params":{"action":"get","nodeId":{"$ref":"panel.uuid"},"referenceMode":"structured"}}
  ]
}
```

整批先校验，保留 `$ref`、`stopOnError`、输出预算和已执行结果。场景批处理在 14 秒截止后不再启动下一步；无法取消的资源加载仍需等真实回执，主进程超时后保持写锁。不会自动回滚，也不能整批重放。`executionMode:"serial"` 保留逐步骤 IPC；`"scene"` 对不支持的工具直接报错。混合 AssetDB、文件、重命名、打开、保存等操作的 auto 批次沿用逐项分发。

## 引用与依赖检查

`manage_components(action:"get", referenceMode:"structured")` 返回资源、节点、组件引用的 kind / uuid / type 等身份信息，也支持有界的嵌套引用；默认摘要格式不变。资源路径由主进程 AssetDB 查询，场景返回值不猜路径。

`inspect_asset_dependencies({target:"db://assets/.../View.prefab"})` 只读检查 JSON 序列化中的 `__uuid__`，返回引用位置、URL、类型、AssetDB 解析状态和源文件存在状态；子资源检查所属源文件。默认最多 500 个不同依赖，最大 2000，文件上限 8 MiB。`complete:false` / `truncated:true` 不等于校验通过；不验证运行时动态加载、资源类型匹配或分包规则。

## 截图凭证与坐标

`capture_editor_screenshot({forceFresh:true, includeMetadata:true})` 在图片后附带 `captureId`、`capturedAt`、`cached`、`cacheAgeMs`、实际编码像素尺寸、裁剪范围及窗口几何。旧调用仍返回原图片；`responseMode:"text"` 保留文本模式，显式 includeMetadata 时返回含 dataUrl 的 JSON。

`resolve_capture_coordinates({captureId:"...",points:[{x:100,y:200}]})` 接受该张返回图片的像素点，反算裁剪/缩放，返回 Electron 窗口内容坐标（DIP）。它只计算坐标，不发送鼠标事件，也不转换为 Cocos 世界坐标。窗口、缩放、主窗口实例变化、MCP 写入或超过 60 秒后拒绝使用旧凭证。缺少可验证的窗口几何时 `coordinateMappingAvailable:false`；`sceneContentVerified:false` 表示不能证明手动编辑、动画或场景视口内容未变化，视觉核验应重新截图。

## 调用记录与工具集

工具响应保留原 content / isError，并新增 structuredContent：callId、tool、ok、排队/执行/总耗时及本次执行事件。批处理记录最多 48 个步骤摘要并注明省略数；失败保留已执行步骤及可用的继续位置。记录不接管全局 console，也不承诺包含游戏业务日志。持久日志中的请求与结果使用相同 callId。

代理支持以下环境变量，修改后重启代理：

- `MCP_BRIDGE_TOOL_PROFILE=full`：默认，保留完整目录。
- `MCP_BRIDGE_TOOL_PROFILE=ui`：只暴露 UI、场景、引用、截图和检查常用工具。
- `MCP_BRIDGE_TOOL_PROFILE=custom`，配合 `MCP_BRIDGE_ENABLED_TOOLS=create_node,manage_components,...`。
- `MCP_BRIDGE_DISABLED_TOOLS=manage_script,...`：从目录排除指定工具；批处理也不能调用被隐藏的工具。

发现和绑定项目的两个工具始终可见。profiles 只管理代理工具暴露，不是 HTTP 访问控制。

# 1.5.0：检查、调用历史、工具预设与发布

- `run_script_diagnostics` 按工程 `tsconfig.json` 运行真实 `tsc --noEmit --incremental false`，优先工程 TypeScript，其次本工程插件依赖；无编译器明确未检查。30 秒超时、4MiB 输出上限，诊断数量与源码片段受限。`validate_script` 的 TS 分支复用该检查，结果属于整个 tsconfig，不等价于 Creator 编译或预览加载。
- `check_asset_ready` 连续两次核对 2.4 AssetDB 的 UUID、URL、类型记录。`waitMs:0` 只观察一次，不能报告稳定。不会刷新或重试写入；不验证导入队列、源字节、脚本编译或运行时加载。
- `button_events` 的 `list/bind` 使用原生 `cc.Component.EventHandler`，绑定前检查组件方法，默认重复绑定不追加；`replace:true` 仅替换相同目标/组件/方法/自定义数据的事件。修改后仍需保存；未验证真实点击。
- `validate_prefab` 结合 2.4 对象表结构校验与现有 UUID 依赖扫描。离线编辑在原子提交前检查内部引用，在线离线编辑在刷新后返回依赖验证；`written:true` 表示已经落盘，即使验证失败也不能直接重放。纯离线代理只检查结构，没有 AssetDB 依赖验证。不存在 3.x 的 CompPrefabInfo 要求。
- 概览新增最近调用，可展开参数、结果、耗时和批量步骤摘要；最多保留100条，展示最近30条，重载后清空。正文、图片及常见敏感字段省略/脱敏，getter 不执行；摘要不替代完整结果。
- 设置页支持 full/ui/custom、工具勾选、命名预设和剪贴板 JSON 导入导出。保存于 `settings/mcp-tool-presets.json`，格式 version=1、active、presets；代理启动时读取，各 MCP_BRIDGE_* 环境变量逐项优先覆盖，修改后重连客户端。直接调用与 batch 子操作共用代理暴露集合。连接工具始终保留；这不是 HTTP 权限边界。

本地发布与恢复（在插件目录运行；发布目录需位于插件之外）：

```powershell
node scripts/build.js
node scripts/release-sync.js pack E:\Releases\mcp-1.5.0
node scripts/release-sync.js plan E:\Releases\mcp-1.5.0 E:\YourProject | Out-File -Encoding utf8 plan.json
node scripts/release-sync.js apply plan.json
node scripts/release-sync.js restore E:\YourProject\local\mcp-release-backups\release-xxxx
```

发布包逐文件 SHA256、版本和 buildId 校验；计划确认后若目标变化会拒绝执行。只替换清单中的插件文件，未列出的文件保留；不删除历史非托管文件。原版本备份与恢复清单留在目标 `local/mcp-release-backups`，更新失败自动恢复，恢复遇到后续用户改动会停止。更新前退出目标工程编辑器，更新后重载/重新打开并用 `get_project_info(includeMcpDiagnostics:true)` 确认实际加载版本；磁盘更新回执不声称编辑器已加载。工程 settings/local 客户端配置、assets、node_modules 均不参与复制。

## 2026-10-23 编辑器与构建实测

- 修复 `check_asset_ready`：2.4 主进程使用同步 `assetInfoByUuid`；保留异步 API 存在时的兼容分支。真实编辑器已验证两次稳定观察返回 ready。
- 修复 `build_project`：面板 `builder:start-task` 没有返回本轮的完成回执，旧实现会在180秒误报 IPC 超时。改用 `Editor.Builder.build` 的终态回调；启动仍返回 jobId，status 查询 building/succeeded/failed。默认 scenes 为空时查询全部未排除场景；起始场景不在列表中会在构建前拒绝。
- 构建身份 `1ce7f9bf`：微信137秒、抖音124秒、淘宝小游戏166秒，均收到 succeeded。三份产物均包含 load/game 两个场景、32个远程 bundle 配置，入口/设置脚本语法检查通过。真实接口13项冒烟检查通过；构建与诊断专项24项通过。
- 本轮只验证 Creator 导出，未执行手动后处理、CDN上传或平台开发工具/真机运行。`build/wx.js` 依赖的 `packages/after-build-action/channel-check` 当前缺失；构建繁忙时代理200ms存活探测曾短暂误报离线，只读状态查询重试后恢复。这两项仍需后续处理。工程 tsc 返回61条现有诊断，详见本轮本地记录，不代表 Creator 构建失败。
- 记录位于工程 `local/mcp-interface-check-20261023/`；构建钩子写入的 `assets/resources/version.json` 已恢复原字节并单文件刷新。
