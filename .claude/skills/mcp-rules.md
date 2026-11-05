---
name: mcp-rules
description: 加载 MCP Bridge 插件开发规则与编码规范。
---

# MCP Bridge 开发规范

此技能用于提醒当前对话遵循 MCP Bridge 项目的开发规范。

## 执行指令

加载并遵守 `.agent/rules/project-rules.md` 中的所有规范，核心规则摘要：

### 语言
- 所有对话回复、代码注释、文档使用**简体中文**。

### 架构
| 文件 | 进程 | 可访问 | 不可访问 |
|------|------|--------|----------|
| `main.js` (src/main.ts) | 主进程 | `Editor.*`, `require()` | `cc.*` |
| `scene-script.js` (src/scene-script.ts) | 渲染进程 | `cc.*` | `Editor.assetdb` |

核心规则：永远在 main 进程中将 `db://` 路径转换为 UUID，再传递给 scene-script。

### 命名规范
| 类型 | 规范 | 示例 |
|------|------|------|
| 函数名 | camelCase | `handleMcpCall` |
| 常量 | SCREAMING_SNAKE_CASE | `MAX_RESULTS` |
| MCP 工具名 | snake_case | `get_selected_node` |
| IPC 消息名 | kebab-case | `get-hierarchy` |

### 关键规则
- 修改 `src/` 下的 TS 文件后，**必须**执行 `npm run build`
- 新增功能前搜索是否已存在同名函数，避免重复定义
- 使用 `addLog()` 替代 `console.log()`
- `update-node-transform` 使用直接赋值（非 IPC），保证属性即时生效但牺牲 Undo
- Widget 属性赋值后**禁止**同帧调用 `updateAlignment()`，由引擎异步结算

### 提交规范
使用 Conventional Commits: `feat`/`fix`/`docs`/`refactor`/`test`/`chore`
