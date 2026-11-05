# Creator 2.4 工具能力对齐说明

## 使用入口

插件版本为 1.7.0，目标引擎为 Creator 2.4.15。新增能力使用 2.4 的 `cc`、主进程 Editor 和场景 IPC，不引入 3.x 引擎依赖。

- 编辑器：MCP 桥接器 → 开启 MCP 设置面板 → 设置与连接 → 工具开放范围。
- MCP：141 个编辑器工具；stdio 另有 `get_active_instances`、`set_active_instance`。
- 目录：`get_tool_catalog` 返回分类、预设层级、开放状态、兼容标记和可用操作。
- 默认仍为全部工具，旧工具名和默认结果继续保留。

## 分类与细化

工具按工程、节点与场景、组件、UI、预制体、资源、事件、执行、动画、摄像机、运行状态、文件、诊断、日志、原生输入、截图、构建、选择、材质与纹理、撤销共20类组织。

| 能力 | 独立入口示例 | 实现关系 |
| --- | --- | --- |
| 组件 | `list_components`、`inspect_component`、`add_component`、`remove_component`、`set_component_property` | 复用 `manage_components`，固定操作类型 |
| UI | `create_canvas`、`create_label`、`create_button`、`create_sprite` | 复用节点创建；按钮包含子 Label |
| 摄像机 | `list_cameras`、`create_camera`、`set_camera_properties` | 2.4 的 `cc.Camera` |
| 场景 | `get_scene_info`、`get_hierarchy`、`find_nodes`、`inspect_node`、`delete_node`、`set_node_transform` | 复用查询与写入，补充节点定位 |
| 预制体 | `list_prefabs`、`inspect_prefab`、`duplicate_prefab`、`create_prefab_from_node`、`instantiate_prefab`、`apply_prefab_instance` | 2.4 资源与序列化格式 |
| 资源 | `list_assets`、`inspect_asset`、`create_asset`、`delete_asset`、`move_asset`、`refresh_assets` | 复用 AssetDB，刷新需指定路径 |
| 动画 | `list_animations`、`add_animation_clip`、`play_animation`、`stop_animation`、`pause_animation`、`resume_animation` | 2.4 的 `cc.Animation` |
| 事件 | `list_button_click_events`、`bind_button_click_event`、`emit_node_event`、`simulate_button_click`、`invoke_component_method` | 使用真实 EventHandler 和节点事件 |
| 运行状态 | `get_runtime_state`、`pause_runtime`、`resume_runtime`、`set_time_scale` | 当前编辑场景 director / scheduler |
| 文件 | `read_file`、`get_file_snippet`、`write_file`、`replace_in_file`、`list_directory`、`exists`、`search_files` | 工程内路径，写入原子校验 |
| 材质与纹理 | `create_material`、`inspect_material`、`set_material_properties` 等 | 复用现有材质、纹理、shader 管理 |
| 执行 | `execute_javascript`、`execute_editor_script`、`execute_scene_script` | 统一执行与结果记录 |

节点类独立入口支持 `nodeId` / `uuid`、节点 `path` 或唯一 `name`。组件类入口接受 `componentType` 或 `componentName`；重名节点必须提供路径或 UUID。
资源类工具继续使用各自 schema 声明的 2.4 参数，例如 `path: "db://assets/..."`、`prefabName`；不承诺可原样重放所有 3.8 参数。

## 开放范围

预设模式为 `full`、`core`、`readonly`、`ui`、`assets`、`prefabs`、`debug`、`custom`。命名预设保存在 `settings/mcp-tool-presets.json`，保持 version=1，旧配置无需迁移。

组合工具可展开“开放操作”，例如仅允许组件查询：

```json
{
  "version": 1,
  "active": "组件只读",
  "presets": [{
    "name": "组件只读",
    "profile": "custom",
    "enabled": ["manage_components", "list_components", "get_tool_catalog"],
    "disabled": [],
    "actions": { "manage_components": ["get"] }
  }]
}
```

- 限制同时作用于组合入口、独立别名和批处理；批处理解析引用后仍逐项检查。
- HTTP 每次读取最新工程预设；stdio 在请求及后台监测时重读，并发送 `notifications/tools/list_changed`。
- HTTP 当前采用 POST 请求响应，未增加服务端通知流；不自动更新目录的客户端需重新连接或重新调用 `tools/list`。
- stdio 环境变量 `MCP_BRIDGE_TOOL_PROFILE`、`MCP_BRIDGE_ENABLED_TOOLS`、`MCP_BRIDGE_DISABLED_TOOLS` 和 JSON 格式的 `MCP_BRIDGE_TOOL_ACTIONS` 可裁剪客户端目录；工程服务端仍执行自己的预设。
- 只读预设不因额外勾选而开放写工具。通用脚本始终按可能写入处理，工程身份、输入锁和执行队列保护仍生效。

## 通用 JavaScript

统一入口参数：`code`、`context`、可选 `args`、`timeoutMs`、`safety_checks`。两个兼容入口通过工具名固定上下文。

```json
{
  "context": "scene",
  "code": "return { name: scene.name, count: scene.children.length };"
}
```

```json
{
  "context": "editor",
  "args": { "file": "project.json" },
  "code": "module.exports = async ({ args, fs, path, projectPath }) => JSON.parse(await fs.promises.readFile(path.join(projectPath, args.file), 'utf8'));"
}
```

| 上下文 | 可用对象 |
| --- | --- |
| editor | `Editor`、`require`、`fs`、`path`、`projectPath`、`args`、`console`、`env` |
| scene | `cc`、`Editor`、`require`、`scene`、`director`、`markSceneDirty`、`args`、`console`、`env` |

- 支持直接 `return`、顶层 `await`、`run(env)`、`module.exports = 函数`、`exports.run = 函数`。
- 返回 `structuredContent.data` 与 `structuredContent.execution`；包含上下文、耗时、最多50条日志及省略数。
- 结果限量裁剪，不执行返回对象的普通 getter / toJSON。建议显式返回 JSON 数据，避免直接返回引擎对象。
- 场景脚本直接改动节点后调用 `markSceneDirty(node.uuid)`，再通过 `save_scene` 保存；只读脚本不会自动把场景标脏。
- editor 与 scene 保持进程隔离，scene 的 `Editor` 不包含主进程 AssetDB。脚本使用 JavaScript，不自动转译 TypeScript。

## 执行边界

脚本拥有编辑器进程权限；vm 仅提供执行环境和初始同步执行截止，不是安全沙箱。默认静态检查拦截常见删除文件、退出进程和子进程调用，可用 `safety_checks:false` 明确覆盖。

开放通用脚本后，代码可直接调用 Editor / cc / Node API，不受其他结构化工具开关限制。需要只读或禁止特定写操作时，应关闭执行类工具；只读预设已自动排除它们。

默认截止为5000ms，允许100–10000ms。同步脚本初始执行受 vm 截止约束；异步脚本超时不代表取消副作用，队列保持锁定直到真实完成。异步恢复后的同步死循环不保证能强制中断，需重载插件；禁止因超时自动重放写脚本。

运行状态和组件方法作用于编辑场景，未将外部浏览器或游戏预览伪装成同一运行上下文。事件发送和按钮回调成功不证明玩法接受。

本次按本机3.8 MCP目录对齐75个同名入口，并补充2.4原有能力的独立入口。3.8的插件更新、项目技能生成、外部预览输入、桌面/分面板截图等未逐项复制；保留2.4现有截图及原生点击/拖拽流程。其余高级 Editor 自动化可通过通用脚本使用实际2.4 API，需遵守相同项目保护与版本约束。

## 加载与验证

运行插件目录的 `node scripts/build.js` 生成 dist，在 Creator 的开发者 → Package Manager 重载 `mcp-bridge`，再重连旧 stdio 客户端以加载新代码。
配置修改本身无需重新构建插件。

专项测试为 `npm run test:alignment`；完整插件回归为 `node --test test/*.test.js`，不运行游戏工程构建或测试。
