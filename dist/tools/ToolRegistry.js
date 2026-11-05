"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getToolsList = void 0;
// @ts-nocheck
const ToolCapabilities_1 = require("./ToolCapabilities");
const ScriptExecution_1 = require("./ScriptExecution");
const SceneCapabilities_1 = require("./SceneCapabilities");
const ProjectFiles_1 = require("./ProjectFiles");
const EditorCapabilities_1 = require("./EditorCapabilities");
const getToolsList = () => {
    const globalPrecautions = "【AI 安全守则】: 1. 执行任何写操作前必须先通过 get_scene_hierarchy 或 manage_components(get) 验证主体存在。 2. 严禁基于假设盲目猜测属性名。 3. 资源属性（如 cc.Prefab）必须通过 UUID 进行赋值。 4. 严禁频繁刷新全局资源 (refresh_editor)，必须通过 properties.path 指定具体修改的文件或目录以防止编辑器长期卡死。";
    const base = [
        ...["simulate_mouse_drag", "simulate_mouse_click"].map(name => ({
            name, description: "基于截图像素坐标向编辑器主窗口发送原生鼠标输入；按 renderer 帧推进。回执不证明游戏接受输入。start 需新截图和唯一 requestKey；status/cancel 必须使用原工具和原 key/jobId，禁止回执丢失后自动重放。",
            inputSchema: { type: "object", properties: {
                    action: { type: "string", enum: ["start", "status", "cancel"] },
                    captureId: { type: "string" }, requestKey: { type: "string", maxLength: 128 }, jobId: { type: "string" },
                    start: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
                    end: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } }, required: ["x", "y"] },
                    durationMs: { type: "number", minimum: 50, maximum: 10000 },
                    pressHoldMs: { type: "number", minimum: 0, maximum: 2000 }, endHoldMs: { type: "number", minimum: 0, maximum: 2000 },
                    waitMs: { type: "number", minimum: 0, maximum: 2000 },
                } },
        })),
        {
            name: "get_selected_node",
            description: `获取当前编辑器中选中的节点 ID。建议获取后立即调用 get_scene_hierarchy 确认该节点是否仍存在于当前场景中。`,
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "set_node_name",
            description: `${globalPrecautions} 修改指定节点的名称`,
            inputSchema: {
                type: "object",
                properties: {
                    id: { type: "string", description: "节点的 UUID" },
                    newName: { type: "string", description: "新的节点名称" },
                },
                required: ["id", "newName"],
            },
        },
        {
            name: "save_scene",
            description: `保存当前场景的修改`,
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "save_prefab",
            description: `保存当前正在编辑的预制体的修改（仅在 open_prefab 进入预制体编辑模式后使用）`,
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "close_prefab",
            description: `退出预制体编辑模式，返回普通场景编辑状态`,
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "get_scene_hierarchy",
            description: `获取当前场景的节点树结构（包含 UUID、名称、子节点数）。若要查询节点组件详情等，请使用 manage_components。`,
            inputSchema: {
                type: "object",
                properties: {
                    childOffset: { type: "integer", minimum: 0 }, childPageSize: { type: "integer", minimum: 1, maximum: 100 }, childVersion: { type: "string" },
                    nodeId: { type: "string", description: "指定的根节点 UUID。如果不传则获取整个场景的根。" },
                    depth: {
                        type: "integer", minimum: 0, maximum: 10,
                        description: "遍历的深度限制，默认为 2。用来防止过大场景导致返回数据超长。",
                    },
                    includeDetails: { type: "boolean", description: "是否包含坐标、缩放等杂项详情，默认为 false。" },
                },
            },
        },
        {
            name: "update_node_transform",
            description: `${globalPrecautions} 修改节点的坐标、缩放、颜色或显隐状态。执行前必须调用 get_scene_hierarchy 确保 node ID 有效。`,
            inputSchema: {
                type: "object",
                properties: {
                    id: { type: "string", description: "节点 UUID" },
                    active: { type: "boolean", description: "节点的激活状态 (显隐)" },
                    x: { type: "number" },
                    y: { type: "number" },
                    rotation: { type: "number", description: "旋转角度" },
                    width: { type: "number" },
                    height: { type: "number" },
                    scaleX: { type: "number" },
                    scaleY: { type: "number" },
                    anchorX: { type: "number", description: "锚点 X (0~1)" },
                    anchorY: { type: "number", description: "锚点 Y (0~1)" },
                    color: { type: "string", description: "HEX 颜色代码如 #FF0000" },
                    opacity: { type: "number", description: "透明度 (0~255)" },
                    skewX: { type: "number", description: "倾斜 X" },
                    skewY: { type: "number", description: "倾斜 Y" },
                },
                required: ["id"],
            },
        },
        {
            name: "create_scene",
            description: `在 assets 目录下创建一个新的场景文件。创建并通过 open_scene 打开后，请务必初始化基础节点（如 Canvas 和 Camera）。`,
            inputSchema: {
                type: "object",
                properties: {
                    sceneName: { type: "string", description: "场景名称" },
                },
                required: ["sceneName"],
            },
        },
        {
            name: "create_prefab",
            description: `${globalPrecautions} 将场景中的某个节点保存为预制体资源`,
            inputSchema: {
                type: "object",
                properties: {
                    nodeId: { type: "string", description: "节点 UUID" },
                    prefabName: { type: "string", description: "预制体名称或包含完整路径的名称（如 MyPrefab 或 db://assets/prefabs/MyPrefab.prefab）" },
                },
                required: ["nodeId", "prefabName"],
            },
        },
        {
            name: "open_scene",
            description: `打开场景文件。注意：这是一个异步且耗时的操作，打开后请等待几秒。重要：如果是新创建或空的场景，请务必先创建并初始化基础节点（Canvas/Camera）。`,
            inputSchema: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "场景资源路径，如 db://assets/NewScene.fire",
                    },
                },
                required: ["url"],
            },
        },
        {
            name: "open_prefab",
            description: `在编辑器中打开预制体文件进入编辑模式。注意：这是一个异步操作，打开后请等待几秒。`,
            inputSchema: {
                type: "object",
                properties: {
                    url: {
                        type: "string",
                        description: "预制体资源路径，如 db://assets/prefabs/Test.prefab",
                    },
                },
                required: ["url"],
            },
        },
        {
            name: "create_node",
            description: `${globalPrecautions} 在当前场景中创建一个新节点。重要提示：1. 如果指定 parentId，必须先通过 get_scene_hierarchy 确保该父节点真实存在且未被删除。2. 类型说明：'sprite' (100x100 尺寸 + 默认贴图), 'button' (150x50 尺寸 + 深色底图 + Button组件), 'label' (120x40 尺寸 + Label组件), 'empty' (纯空节点)。`,
            inputSchema: {
                type: "object",
                properties: {
                    returnDetails: { type: "boolean", description: "返回包含 uuid/name/parentId 的对象，供批处理 $ref 引用；默认仍返回文本" },
                    width: { type: "number", minimum: 0 }, height: { type: "number", minimum: 0 }, text: { type: "string" }, fontSize: { type: "number", minimum: 1 },
                    spriteFrameUuid: { type: "string", description: "Sprite 或 Button 使用的 SpriteFrame / Texture UUID。" },
                    name: { type: "string", description: "节点名称" },
                    parentId: {
                        type: "string",
                        description: "父节点 UUID (可选，不传则挂在场景根部)",
                    },
                    type: {
                        type: "string",
                        enum: ["empty", "sprite", "label", "button", "canvas", "camera"],
                        description: "节点预设类型",
                    },
                    layout: {
                        type: "string",
                        enum: [
                            "center",
                            "top",
                            "bottom",
                            "left",
                            "right",
                            "top-left",
                            "top-right",
                            "bottom-left",
                            "bottom-right",
                            "full",
                        ],
                        description: "自动挂载 cc.Widget 并进行快捷排版适配。推荐绝大多数 UI 元素在创建时使用此参数替代手动指定坐标。",
                    },
                },
                required: ["name"],
            },
        },
        {
            name: "manage_components",
            description: `${globalPrecautions} 管理节点组件。重要提示：1. 操作前必须调用 get_scene_hierarchy 确认 nodeId 对应的节点仍然存在。2. 添加前先用 'get' 检查是否已存在。3. 添加 cc.Sprite 后必须设置 spriteFrame 属性，否则节点不显示。4. 创建按钮时，请确保目标节点有足够的 width 和 height 作为点击区域。5. 赋值或更新属性前，必须确保目标属性在组件上真实存在，严禁盲目操作不存在的属性。6. 对于资源类属性（如 cc.Prefab, sp.SkeletonData），传递资源的 UUID。插件会自动进行异步加载并正确序列化，避免 Inspector 出现 Type Error。`,
            inputSchema: {
                type: "object",
                properties: {
                    nodeIds: { type: "array", minItems: 1, maxItems: 100, items: { type: "string" }, description: "仅 get：批量节点 UUID，返回每个节点的 components 或 error；与 nodeId 互斥" },
                    fields: { type: "array", maxItems: 100, items: { type: "string" }, description: "仅 get：只读取指定属性；不传仍返回所有公开属性" },
                    includeFullText: { type: "boolean", description: "仅 get：完整返回字符串；默认保留长文本摘要" },
                    referenceMode: { type: "string", enum: ["summary", "structured"], description: "仅 get：structured 返回资源/节点/组件引用的 UUID 和类型，默认保留名称摘要" },
                    nodeId: { type: "string", description: "节点 UUID" },
                    action: {
                        type: "string",
                        enum: ["add", "remove", "update", "get"],
                        description: "操作类型 (add: 添加组件, remove: 移除组件, update: 更新组件属性, get: 获取组件列表)",
                    },
                    componentType: { type: "string", description: "组件类型，如 cc.Sprite (add/update 操作需要)" },
                    componentId: { type: "string", description: "组件 ID (remove/update 操作可选)" },
                    properties: {
                        type: "object",
                        description: "组件属性 (add/update 操作使用). 支持智能解析: 如果属性类型是组件但提供了节点UUID，会自动查找对应组件。",
                    },
                },
                required: ["action"],
            },
        },
        {
            name: "manage_script",
            description: `${globalPrecautions} 管理脚本文件。注意：创建或修改脚本需时间编译。创建后必须调用 refresh_editor (务必指定 path) 生成 meta 文件，否则无法作为组件添加。`,
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["create", "delete", "read", "write", "save"], description: "操作类型" },
                    path: { type: "string", description: "脚本路径，如 db://assets/scripts/NewScript.js" },
                    content: { type: "string", description: "脚本内容 (用于 create 和 write 操作)" },
                    name: { type: "string", description: "脚本名称 (用于 create 操作)" },
                },
                required: ["action", "path"],
            },
        },
        {
            name: "batch_execute",
            description: `${globalPrecautions} 串行执行多个操作。整批参数先预检；默认遇错停止并返回已执行结果，不自动回滚。params 中可用 {"$ref":"前序操作id.结果字段"} 引用返回值；create_node 配合 returnDetails:true 获取 uuid。`,
            inputSchema: {
                type: "object",
                properties: {
                    outputMode: { type: "string", enum: ["full", "summary"] },
                    executionMode: { type: "string", enum: ["auto", "serial", "scene"], description: "默认 auto：整批为节点/组件/场景查询时单次场景 IPC 执行（14秒截止）；serial 保留逐项通信；scene 遇不支持的工具直接拒绝。失败不会回滚。" },
                    maxResultBytes: { type: "integer", minimum: 1024, maximum: 4194304 },
                    resultFields: { type: "array", items: { type: "string" }, maxItems: 100 },
                    stopOnError: { type: "boolean", description: "默认 true：失败立即停止；false 继续独立操作，最终仍标记失败" },
                    operations: {
                        type: "array",
                        minItems: 1, maxItems: 100,
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "string", description: "可选唯一名称，以字母开头，只含字母数字下划线或短横线，供后续引用" },
                                tool: { type: "string", description: "工具名称" },
                                params: { type: "object", description: "工具参数" },
                            },
                            required: ["tool", "params"],
                        },
                        description: "操作列表",
                    },
                },
                required: ["operations"],
            },
        },
        {
            name: "manage_asset",
            description: `${globalPrecautions} 管理资源`,
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["create", "delete", "move", "get_info"], description: "操作类型" },
                    path: { type: "string", description: "资源路径，如 db://assets/textures；根目录 db://assets 仅允许 get_info，写操作会被拒绝" },
                    paths: { type: "array", minItems: 1, maxItems: 500, items: { type: "string" }, description: "仅 delete 可用：批量资源 URL，与 path 二选一" },
                    targetPath: { type: "string", description: "目标路径 (用于 move 操作)" },
                    content: { type: "string", description: "资源内容 (用于 create 操作)" },
                },
                required: ["action"],
            },
        },
        {
            name: "scene_management",
            description: `${globalPrecautions} 场景管理`,
            inputSchema: {
                type: "object",
                properties: {
                    action: {
                        type: "string",
                        enum: ["create", "delete", "duplicate", "get_info"],
                        description: "操作类型",
                    },
                    path: { type: "string", description: "场景路径，如 db://assets/scenes/NewScene.fire" },
                    targetPath: { type: "string", description: "目标路径 (用于 duplicate 操作)" },
                    name: { type: "string", description: "场景名称 (用于 create 操作)" },
                },
                required: ["action", "path"],
            },
        },
        {
            name: "prefab_management",
            description: `${globalPrecautions} 预制体管理。update 只接受目标资源的根实例；在对应预制体编辑模式等待保存回执，场景实例使用 Creator apply 消息并等待落盘/AssetDB同步。未确认完成不报告成功。`,
            inputSchema: {
                type: "object",
                properties: {
                    action: {
                        type: "string",
                        enum: ["create", "update", "instantiate", "get_info"],
                        description: "操作类型",
                    },
                    path: { type: "string", description: "预制体路径，如 db://assets/prefabs/NewPrefab.prefab" },
                    nodeId: { type: "string", description: "节点 ID (用于 create 操作)" },
                    parentId: { type: "string", description: "父节点 ID (用于 instantiate 操作)" },
                },
                required: ["action", "path"],
            },
        },
        {
            name: "manage_editor",
            description: `${globalPrecautions} 管理编辑器`,
            inputSchema: {
                type: "object",
                properties: {
                    action: {
                        type: "string",
                        enum: ["get_selection", "set_selection", "refresh_editor"],
                        description: "操作类型",
                    },
                    target: {
                        type: "string",
                        enum: ["node", "asset"],
                        description: "目标类型 (用于 set_selection 操作)",
                    },
                    properties: {
                        type: "object",
                        description: "操作属性。set_selection 需提供 properties.ids（节点/资源 UUID 数组，也接受 properties.uuid 单个值）；未真正选中会直接报错。refresh_editor 需提供 properties.path，且仅接受单文件路径（带后缀名如 'db://assets/scripts/MyScript.ts'）。目录路径和 db://assets 全局路径已被代码层拒绝，传入将直接报错。这是因为目录级刷新会阻塞编辑器主线程数分钟并触发编译级联卡死。修改多个文件后请逐个刷新。",
                    },
                },
                required: ["action"],
            },
        },
        {
            name: "find_gameobjects",
            description: `按条件在场景中搜索游戏对象。返回匹配节点的轻量级结构 (UUID, name, active, components 等)。若要获取完整的详细组件属性，请进一步对目标使用 manage_components。`,
            inputSchema: {
                type: "object",
                properties: {
                    scopeNodeId: { type: "string" }, pageSize: { type: "integer", minimum: 1, maximum: 500 }, cursor: { type: "string" },
                    maxVisited: { type: "integer", minimum: 1, maximum: 50000 }, maxTimeMs: { type: "integer", minimum: 1, maximum: 3000 }, includeMetadata: { type: "boolean" },
                    conditions: {
                        type: "object",
                        description: "查找条件。支持的属性：name (节点名称，支持模糊匹配), component (包含的组件类名，如 'cc.Sprite'), active (布尔值，节点的激活状态)。",
                    },
                    recursive: { type: "boolean", default: true, description: "是否递归查找所有子节点" },
                },
                required: ["conditions"],
            },
        },
        {
            name: "manage_material",
            description: `${globalPrecautions} 管理材质。支持创建、获取信息以及更新 Shader、Defines 和 Uniforms 参数。`,
            inputSchema: {
                type: "object",
                properties: {
                    action: {
                        type: "string",
                        enum: ["create", "delete", "get_info", "update"],
                        description: "操作类型",
                    },
                    path: { type: "string", description: "材质路径，如 db://assets/materials/NewMaterial.mat" },
                    properties: {
                        type: "object",
                        description: "材质属性 (add/update 操作使用)",
                        properties: {
                            shaderUuid: { type: "string", description: "关联的 Shader (Effect) UUID" },
                            defines: { type: "object", description: "预编译宏定义" },
                            uniforms: { type: "object", description: "Uniform 参数列表" },
                        },
                    },
                },
                required: ["action", "path"],
            },
        },
        {
            name: "manage_texture",
            description: `${globalPrecautions} 管理纹理`,
            inputSchema: {
                type: "object",
                properties: {
                    action: {
                        type: "string",
                        enum: ["create", "delete", "get_info", "update"],
                        description: "操作类型",
                    },
                    path: { type: "string", description: "纹理路径，如 db://assets/textures/NewTexture.png" },
                    properties: { type: "object", description: "纹理属性" },
                },
                required: ["action", "path"],
            },
        },
        {
            name: "manage_shader",
            description: `${globalPrecautions} 管理着色器 (Effect)。支持创建、读取、更新、删除和获取信息。`,
            inputSchema: {
                type: "object",
                properties: {
                    action: {
                        type: "string",
                        enum: ["create", "delete", "read", "write", "get_info"],
                        description: "操作类型",
                    },
                    path: { type: "string", description: "着色器路径，如 db://assets/effects/NewEffect.effect" },
                    content: { type: "string", description: "着色器内容 (create/write)" },
                },
                required: ["action", "path"],
            },
        },
        {
            name: "execute_menu_item",
            description: `${globalPrecautions} 执行菜单项。对于节点删除，请使用 "delete-node:UUID" 格式以确保精确执行。对于保存、撤销等操作，请优先使用专用工具 (save_scene, manage_undo)。`,
            inputSchema: {
                type: "object",
                properties: {
                    menuPath: {
                        type: "string",
                        description: "菜单项路径 (支持 'Project/Build' 或 'delete-node:UUID')",
                    },
                },
                required: ["menuPath"],
            },
        },
        {
            name: "apply_text_edits",
            description: `${globalPrecautions} 对文件应用文本编辑。**专用于修改脚本源代码 (.js, .ts) 或文本文件**。如果要修改场景节点属性，请使用 'manage_components'。`,
            inputSchema: {
                type: "object",
                properties: {
                    expectedSha: { type: "string", description: "可选原文件 SHA-256（可由 get_sha 获得），不一致则整批拒绝。偏移基于原文UTF-16索引，不得切开emoji、越界或重叠。" },
                    edits: {
                        type: "array",
                        minItems: 1,
                        items: {
                            type: "object",
                            properties: {
                                type: {
                                    type: "string",
                                    enum: ["insert", "delete", "replace"],
                                    description: "操作类型",
                                },
                                start: { type: "integer", minimum: 0, description: "原文UTF-16起始偏移量" },
                                end: { type: "integer", minimum: 0, description: "原文UTF-16结束偏移量（不含）" },
                                position: { type: "integer", minimum: 0, description: "原文UTF-16插入位置" },
                                text: { type: "string", description: "要插入或替换的文本" },
                            },
                            required: ["type"],
                        },
                        description: "编辑操作列表。请严格使用偏移量(offset)而非行号。",
                    },
                    filePath: { type: "string", description: "文件路径 (db://...)" },
                },
                required: ["filePath", "edits"],
            },
        },
        {
            name: "read_console",
            description: `读取控制台`,
            inputSchema: {
                type: "object",
                properties: {
                    cursor: { type: "string" }, includeMetadata: { type: "boolean" },
                    limit: { type: "number", description: "输出限制" },
                    type: {
                        type: "string",
                        enum: ["info", "log", "warn", "error", "success", "mcp"],
                        description: "输出类型 (info, warn, error, success, mcp)",
                    },
                },
            },
        },
        {
            name: "validate_script",
            description: `验证脚本：JS 进行语法检查；TS 按整个工程 tsconfig 运行 tsc --noEmit，非 Creator 编译/预览完成证明。`,
            inputSchema: {
                type: "object",
                properties: {
                    filePath: { type: "string", description: "脚本路径" },
                },
                required: ["filePath"],
            },
        },
        {
            name: "button_events",
            description: "列出或绑定 2.4 Button 事件；绑定前核对目标节点、组件和回调函数，防止同一事件重复绑定；结果不代表真实点击命中或已保存。",
            inputSchema: { type: "object", properties: { action: { type: "string", enum: ["list", "bind"] }, nodeId: { type: "string" }, targetId: { type: "string" }, componentName: { type: "string" }, handler: { type: "string" }, customEventData: { type: "string" }, replace: { type: "boolean" } }, required: ["action", "nodeId"] },
        },
        {
            name: "validate_prefab",
            description: "只读验证已保存的 2.4 Prefab/SceneAsset 对象表、父子/组件引用以及序列化资源 UUID；不证明运行时加载。",
            inputSchema: { type: "object", properties: { target: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 2000 } }, required: ["target"] },
        },
        {
            name: "run_script_diagnostics",
            description: "运行工程 TypeScript noEmit 静态检查，返回文件/行列/错误码和源码片段。限时30秒；编译器缺失明确报未检查，不证明 Creator 编译或运行时加载。",
            inputSchema: { type: "object", properties: { tsconfigPath: { type: "string" }, limit: { type: "integer", minimum: 1, maximum: 100 }, contextLines: { type: "integer", minimum: 0, maximum: 10 } } },
        },
        {
            name: "check_asset_ready",
            description: "只读查询精确资源的 UUID/URL/类型记录，连续两次一致才报告 ready；不刷新、不重放写入，不证明导入队列、源文件字节、脚本编译或运行时已完成。",
            inputSchema: { type: "object", properties: { target: { type: "string" }, waitMs: { type: "integer", minimum: 0, maximum: 10000 } }, required: ["target"] },
        },
        {
            name: "search_project",
            description: `分批搜索项目文件，支持 content/file_name/dir_name 与正则。旧调用仍返回最多500条数组；指定 pageSize、cursor 或 includeMetadata:true 时返回 results/nextCursor/truncated 和跳过统计。默认内容文件上限4MiB、行摘要500字符、扫描预算20秒；旧调用发生跳过或超时会明确报搜索不完整。需要完整内容时使用文件读取工具。`,
            inputSchema: {
                type: "object",
                properties: {
                    query: { type: "string", description: "搜索关键词或正则表达式模式" },
                    useRegex: {
                        type: "boolean",
                        description: "是否将 query 视为正则表达式 (仅在 matchType 为 'content', 'file_name' 或 'dir_name' 时生效)",
                    },
                    path: {
                        type: "string",
                        description: "搜索起点路径，例如 'db://assets/scripts'。默认为 'db://assets'",
                    },
                    matchType: {
                        type: "string",
                        enum: ["content", "file_name", "dir_name"],
                        description: "匹配模式：'content' (内容关键词/正则), 'file_name' (搜索文件名), 'dir_name' (搜索文件夹名)",
                    },
                    extensions: {
                        type: "array",
                        items: { type: "string" },
                        description: "限定文件后缀 (如 ['.js', '.ts'])。仅在 matchType 为 'content' 或 'file_name' 时有效。",
                        default: [".js", ".ts", ".json", ".fire", ".prefab", ".xml", ".txt", ".md"],
                    },
                    includeSubpackages: { type: "boolean", default: true, description: "是否递归搜索子目录" },
                    pageSize: { type: "integer", minimum: 1, maximum: 500, description: "每页结果数；设置后返回包含游标的对象" },
                    cursor: { type: "string", description: "上一页的 nextCursor；查询条件需相同，文件变化后应重新搜索" },
                    includeMetadata: { type: "boolean", description: "返回分页、截断、超时与跳过文件统计；默认仍兼容数组" },
                    maxFileBytes: { type: "integer", minimum: 1, maximum: 33554432, description: "内容搜索的单文件字节上限，默认4194304" },
                    maxPreviewLength: { type: "integer", minimum: 1, maximum: 10000, description: "匹配行的摘要字符上限，默认500" },
                },
                required: ["query"],
            },
        },
        {
            name: "manage_undo",
            description: `${globalPrecautions} 管理编辑器的撤销和重做历史`,
            inputSchema: {
                type: "object",
                properties: {
                    action: {
                        type: "string",
                        enum: ["undo", "redo", "begin_group", "end_group", "cancel_group"],
                        description: "操作类型",
                    },
                    description: { type: "string", description: "撤销组的描述 (用于 begin_group)" },
                    id: { type: "string", description: "开始撤销组时可选的目标节点 UUID。" },
                },
                required: ["action"],
            },
        },
        {
            name: "manage_vfx",
            description: `${globalPrecautions} 管理全场景特效 (粒子系统)。重要提示：在创建或更新前，必须通过 get_scene_hierarchy 或 manage_components 确认父节点或目标节点的有效性。严禁对不存在的对象进行操作。`,
            inputSchema: {
                type: "object",
                properties: {
                    action: {
                        type: "string",
                        enum: ["create", "update", "get_info"],
                        description: "操作类型",
                    },
                    nodeId: { type: "string", description: "节点 UUID (用于 update/get_info)" },
                    properties: {
                        type: "object",
                        description: "粒子系统属性 (用于 create/update)",
                        properties: {
                            duration: { type: "number", description: "发射时长" },
                            emissionRate: { type: "number", description: "发射速率" },
                            life: { type: "number", description: "生命周期" },
                            lifeVar: { type: "number", description: "生命周期变化" },
                            startColor: { type: "string", description: "起始颜色 (Hex)" },
                            endColor: { type: "string", description: "结束颜色 (Hex)" },
                            startSize: { type: "number", description: "起始大小" },
                            endSize: { type: "number", description: "结束大小" },
                            speed: { type: "number", description: "速度" },
                            angle: { type: "number", description: "角度" },
                            gravity: { type: "object", properties: { x: { type: "number" }, y: { type: "number" } } },
                            file: { type: "string", description: "粒子文件路径 (plist) 或 texture 路径" },
                        },
                    },
                    name: { type: "string", description: "节点名称 (用于 create)" },
                    parentId: { type: "string", description: "父节点 ID (用于 create)" },
                },
                required: ["action"],
            },
        },
        {
            name: "get_sha",
            description: `获取指定文件的 SHA-256 哈希值`,
            inputSchema: {
                type: "object",
                properties: {
                    path: { type: "string", description: "文件路径，如 db://assets/scripts/Test.ts" },
                },
                required: ["path"],
            },
        },
        {
            name: "manage_animation",
            description: `${globalPrecautions} 管理节点的动画组件。重要提示：在执行 play/pause 等操作前，必须先确认节点及其 Animation 组件存在。严禁操作空引用。`,
            inputSchema: {
                type: "object",
                properties: {
                    action: {
                        type: "string",
                        enum: ["get_list", "get_info", "play", "stop", "pause", "resume"],
                        description: "操作类型",
                    },
                    nodeId: { type: "string", description: "节点 UUID" },
                    clipName: { type: "string", description: "动画剪辑名称 (用于 play)" },
                },
                required: ["action", "nodeId"],
            },
        },
        {
            name: "capture_editor_screenshot",
            description: `捕获当前编辑器窗口和场景视图的截图。默认返回 MCP image（PNG/JPEG），responseMode=text 兼容 DataURL。默认保持当前视口，按需居中。用于在需要对场景情况有视觉掌握时使用。编辑器窗口最小化时 capturePage 只能返回过期画面，因此默认会自动恢复窗口后再截图；传 restoreWindow: false 则不改动窗口状态、直接报错。`,
            inputSchema: {
                type: "object",
                properties: {
                    forceFresh: { type: "boolean" }, centerViewport: { type: "boolean" },
                    includeMetadata: { type: "boolean", description: "同时返回 captureId、捕获时间、缓存年龄及坐标几何；配合 forceFresh:true 校验当前画面。坐标是编辑器窗口坐标，不是 Cocos 世界坐标。" },
                    maxWidth: { type: "integer", minimum: 64, maximum: 4096 },
                    format: { type: "string", enum: ["png", "jpeg"] }, quality: { type: "integer", minimum: 1, maximum: 100 },
                    crop: { type: "object", properties: { x: { type: "integer" }, y: { type: "integer" }, width: { type: "integer" }, height: { type: "integer" } }, required: ["x", "y", "width", "height"] },
                    restoreWindow: { type: "boolean", description: "窗口最小化时是否自动恢复后再截图，默认 true；false 表示保持窗口状态并返回错误，避免拿到过期画面" },
                    responseMode: { type: "string", enum: ["image", "text"] }
                },
            },
        },
        {
            name: "resolve_capture_coordinates",
            description: "把指定新截图中的像素坐标映射到 Electron 窗口内容坐标。先截图 includeMetadata:true 获取 captureId；窗口/缩放变化、MCP写入或超过60秒将拒绝。只做坐标计算，不点击，也不保证场景内容未变化。",
            inputSchema: { type: "object", properties: {
                    captureId: { type: "string" }, points: { type: "array", minItems: 1, maxItems: 100,
                        items: { type: "object", properties: { x: { type: "number", minimum: 0 }, y: { type: "number", minimum: 0 } }, required: ["x", "y"] } }
                }, required: ["captureId", "points"] }
        },
        {
            name: "inspect_asset_dependencies",
            description: "只读检查当前 assets 中 prefab/fire/anim/mtl/json 的序列化 __uuid__ 依赖，返回引用位置、UUID、AssetDB URL 和缺失项；complete:false 不能作为校验通过，不验证运行时动态加载或资源分包规则。",
            inputSchema: { type: "object", properties: { target: { type: "string", description: "资源 UUID 或 db://assets/ 文件 URL" },
                    limit: { type: "integer", minimum: 1, maximum: 2000, description: "检查不同依赖的上限，默认500" } }, required: ["target"] }
        },
        {
            name: "find_references",
            description: `查找当前场景中引用了指定节点或资源的所有位置。返回引用所在节点、组件类型、属性名等详细信息。支持查找节点引用（cc.Node）和资源引用（cc.Prefab, cc.SpriteFrame, sp.SkeletonData 等）。`,
            inputSchema: {
                type: "object",
                properties: {
                    scopeNodeId: { type: "string" }, pageSize: { type: "integer", minimum: 1, maximum: 500 }, cursor: { type: "string" },
                    maxVisited: { type: "integer", minimum: 1, maximum: 50000 }, maxTimeMs: { type: "integer", minimum: 1, maximum: 3000 }, includeMetadata: { type: "boolean" },
                    targetId: { type: "string", description: "要查找引用的目标 UUID（节点 UUID 或资源 UUID）" },
                    targetType: {
                        type: "string",
                        enum: ["node", "asset", "auto"],
                        description: "目标类型。'node' 查找节点引用，'asset' 查找资源引用，'auto' (默认) 自动检测",
                    },
                },
                required: ["targetId"],
            },
        },
        {
            name: "build_project",
            description: `${globalPrecautions} 构建并导出 Cocos 项目，通过 Editor.Builder.build 的终态回调跟踪结果。platform 使用具体渠道名（bytedance、wechatgame、taobao-minigame、web-mobile），内部适配 Creator 2.4 分组参数。start 返回 building 只表示请求已接受，需用 status 查询完成状态。`,
            inputSchema: {
                type: "object",
                properties: {
                    action: { type: "string", enum: ["start", "status"] },
                    jobId: { type: "string", description: "action=status 查询任务终态，building 仅代表已接受，不能当作完成" },
                    platform: { type: "string", description: "构建平台。2.4 一级平台如 web-mobile / wechatgame / bytedance；勿传 mini-game（会被折叠为具体平台）" },
                    debug: { type: "boolean", description: "是否构建调试版" },
                },
                required: [],
            },
        },
        {
            name: "get_project_info",
            description: `获取当前项目的宏观信息，例如引擎版本、根目录、当前打开的场景等。`,
            inputSchema: { type: "object", properties: {
                    includeEditState: { type: "boolean", description: "读取当前编辑模式和资源身份" },
                    includeMcpDiagnostics: { type: "boolean", description: "只读诊断：返回代理、编辑器插件、场景脚本实际加载的版本、构建ID、进程和路由计数，并报告不一致或缺失。编辑器离线或工程未唯一确定时，代理仍返回自身诊断及连接原因。默认不增加诊断字段。" }
                } },
        },
        {
            name: "inspect_builder_targets",
            description: `${globalPrecautions}【只读诊断】检查编辑器运行时引擎构建器（Editor.Builder）支持的构建平台列表及结构。返回 simpleBuildTargets 的键、Editor.Builder 暴露的属性名、build/buildProject 是否存在，以及 builder:query-build-options 返回的 platform/actualPlatform。用于排查 builder:start-task 报 isNative of undefined 的问题。`,
            inputSchema: { type: "object", properties: {} },
        },
        {
            name: "modify_prefab_offline",
            description: `【离线高效预制体修改】在不打开编辑器预制体窗口的情况下，直接通过底层的 JSON 结构修改预制体数据，并刷新 AssetDB。支持 update_property, add_component, remove_component, add_node, remove_node, clone_node, reorder_child, set_reference 操作。如果预制体文件本身不存在且第一个基动作为 add_node 且 targetPath 为空，则工具将无中生有自动初始化空预制体。`,
            inputSchema: {
                type: "object",
                properties: {
                    prefabUrl: { type: "string", description: "预制体在项目中的相对路径，如 db://assets/prefabs/MyPrefab.prefab" },
                    operations: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                action: { type: "string", enum: ["update_property", "add_component", "remove_component", "add_node", "remove_node", "clone_node", "reorder_child", "set_reference"] },
                                targetPath: { type: "string", description: "节点相对根节点的查找路径，用 '/' 分割，如 'Root/Body/Label'。对于 add_node 这是父节点的路径。" },
                                componentType: { type: "string", description: "组件类名，在增删改查组件时传入，如 'cc.Label'。修改节点自身属性时不传。" },
                                properties: { type: "object", description: "属性键值对 (update_property/add_component 属性值)" },
                                nodeName: { type: "string", description: "新节点或克隆后节点的名称 (add_node/clone_node 使用)" },
                                newParentPath: { type: "string", description: "克隆节点要挂载的父节点相对路径，不传默认挂在同级 (clone_node 使用)" },
                                childOrder: { type: "array", items: { type: "string" }, description: "子节点名称排序数组 (reorder_child 使用)" },
                                propertyName: { type: "string", description: "要绑定引用的组件属性名 (set_reference 使用)" },
                                referenceValue: {
                                    type: "object",
                                    description: "绑定的引用的目标值 (set_reference 使用)",
                                    properties: {
                                        uuid: { type: "string", description: "外部资源的 UUID" },
                                        path: { type: "string", description: "要关联引用的预制体内部节点的路径" },
                                        componentType: { type: "string", description: "要关联引用的特定组件类名，若绑定节点本身则留空" }
                                    }
                                }
                            },
                            required: ["action"]
                        }
                    }
                },
                required: ["prefabUrl", "operations"]
            }
        },
        {
            name: "modify_scene_offline",
            description: `【离线高效场景修改】在不打开编辑器场景窗口的情况下，直接通过底层的 JSON 结构修改场景数据，并刷新 AssetDB。支持 update_property, add_component, remove_component, add_node, remove_node, clone_node, reorder_child, set_reference 操作。与 modify_prefab_offline 共享完全相同的 operations 参数结构。如果场景文件不存在且第一个操作为 add_node 且 targetPath 为空，则自动创建空场景。注意：场景中新增的节点不会携带 PrefabInfo。`,
            inputSchema: {
                type: "object",
                properties: {
                    sceneUrl: { type: "string", description: "场景在项目中的相对路径，如 db://assets/scenes/MyScene.fire" },
                    operations: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                action: { type: "string", enum: ["update_property", "add_component", "remove_component", "add_node", "remove_node", "clone_node", "reorder_child", "set_reference"] },
                                targetPath: { type: "string", description: "节点相对根节点的查找路径，用 '/' 分割，如 'Canvas/Body/Label'。场景中寻路起点为 cc.Scene 虚拟节点，直接传 'Canvas' 即可定位到 Canvas 节点。" },
                                componentType: { type: "string", description: "组件类名，如 'cc.Label'" },
                                properties: { type: "object", description: "属性键值对" },
                                nodeName: { type: "string", description: "新节点或克隆后节点的名称" },
                                newParentPath: { type: "string", description: "克隆节点要挂载的父节点路径" },
                                childOrder: { type: "array", items: { type: "string" }, description: "子节点名称排序数组" },
                                propertyName: { type: "string", description: "要绑定引用的组件属性名" },
                                referenceValue: {
                                    type: "object",
                                    description: "绑定的引用目标值",
                                    properties: {
                                        uuid: { type: "string", description: "外部资源的 UUID" },
                                        path: { type: "string", description: "内部节点路径" },
                                        componentType: { type: "string", description: "特定组件类名" }
                                    }
                                }
                            },
                            required: ["action"]
                        }
                    }
                },
                required: ["sceneUrl", "operations"]
            }
        }
    ];
    return [...base, ...(0, ToolCapabilities_1.granularTools)(base), ...(0, ScriptExecution_1.scriptToolDefinitions)(), ...(0, SceneCapabilities_1.sceneCapabilityDefinitions)(), ...(0, ProjectFiles_1.projectFileDefinitions)(), ...(0, EditorCapabilities_1.editorCapabilityDefinitions)()]
        .map(tool => (0, ToolCapabilities_1.capabilityMetadata)({ ...tool, inputSchema: { ...tool.inputSchema,
            properties: { ...tool.inputSchema.properties, expected_context: { type: "string", description: "独立核对项目后取得的实例凭证；编辑器重载后须重新绑定" } } } }));
};
exports.getToolsList = getToolsList;
