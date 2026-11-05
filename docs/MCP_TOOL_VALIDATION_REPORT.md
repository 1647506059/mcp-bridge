# MCP 工具逐项验收报告

验收日期：2026-11-04。目标：Creator 2.4.15 / MCP Bridge 1.7.0。

最终结果：**143/143通过，0失败，0未测**。

最终构建：`9634650ce9da0ec4ea0cb50fada2a0e9435e53609c6ce4ea36f434d3fea03d05`。在全新隔离工程执行，游戏工程未承受资源写入、场景切换、构建或原生输入测试。

完整调用和断言记录：[最终原始报告](E:/MmSpace/dmx/client/client/local/mcp-tool-validation-final-20261104/evidence/report.json)。首轮失败及修复后的重测保留在[首轮原始报告](E:/MmSpace/dmx/client/client/local/mcp-tool-validation-20261104/evidence/report.json)。

## 实际验证方式

- 每个工具至少执行一条正常路径，并断言实际节点、组件、文件、事件计数或任务终态；不把错误拒绝当成功能通过。
- 按钮回调与自定义节点事件以组件计数验证；动画以实际播放/暂停状态验证；预制体以保存文件和实例关联验证。
- 原生点击、拖拽以截图确认位置，并核对编辑器测试区域的鼠标事件计数；不声称验证了游戏玩法。
- Web构建达到 succeeded，且隔离工程 build/web-mobile/index.html 等产物存在。
- stdio暴露143个工具，代理、编辑器和场景构建标识匹配；HTTP、stdio、批处理、操作白名单和目录变化通知均通过。
- 最终插件自动回归：209项通过，0失败。

## 首轮发现及修复

| 问题 | 修复和复测 |
| --- | --- |
| 删除回执早于文件及meta真正删除 | 共用删除完成检查；脚本、资源、材质、纹理、shader和场景删除等待实际完成。 |
| 默认PNG数据损坏 | 替换为有效1×1 PNG，验证图像解码及实际 cc.Texture2D 加载。 |
| 纹理更新忽略filterMode等属性 | 校验当前Meta字段与类型后写入，读回确认。 |
| 取消撤销组未回退修改 | 使用2.4场景撤销栈，结束时合并，取消时回退并清理已取消记录。 |
| 内置Web平台被小游戏平台表误拒绝 | 单独识别内置平台，实际完成Web构建。 |

首轮预制体用例引用了源节点树外的场景节点，结构校验拒绝写入；成功路径改用自包含节点。最终拖拽首测中途失焦，工具拒绝并释放鼠标，重新取得前台后重测通过。两类记录均保留。

## 143个工具明细

| 工具 | 分类 | 结果 | 调用证据 |
| --- | --- | --- | --- |
| `simulate_mouse_drag` | 原生输入 | 通过 | `call_a06f176454f978930fa8` |
| `simulate_mouse_click` | 原生输入 | 通过 | `call_45889318600b75f47e6a` |
| `get_selected_node` | 节点与场景 | 通过 | `call_727455767614312ddc60` |
| `set_node_name` | 节点与场景 | 通过 | `call_4f3ced8cb29d38c695db` |
| `save_scene` | 节点与场景 | 通过 | `call_a3aed673abc18feccdf5` |
| `save_prefab` | 预制体 | 通过 | `call_4b548c49e3fca15f8be6` |
| `close_prefab` | 预制体 | 通过 | `call_baa801bc65fbfad34a8c` |
| `get_scene_hierarchy` | 节点与场景 | 通过 | `call_7044eded729655b26033` |
| `update_node_transform` | 节点与场景 | 通过 | `call_70ff7f6578f53c34e5a3` |
| `create_scene` | 节点与场景 | 通过 | `call_704e6be3d5046946f5e3` |
| `create_prefab` | 预制体 | 通过 | `call_c375611bcf11003ecd02` |
| `open_scene` | 节点与场景 | 通过 | `call_ea398b608b3547cd0949` |
| `open_prefab` | 预制体 | 通过 | `call_1fa94fefdcd8774580e9` |
| `create_node` | 节点与场景 | 通过 | `call_67993d04f5506005fdba` |
| `manage_components` | 组件 | 通过 | `call_3182d003dbb7b0fec995` |
| `manage_script` | 文件 | 通过 | `call_e3274c127911b8024f76` |
| `batch_execute` | 工程与目录 | 通过 | `call_5f95ba4a2dcf49f7be1a` |
| `manage_asset` | 资源 | 通过 | `call_f3c7f14114122002d99a` |
| `scene_management` | 节点与场景 | 通过 | `call_4d339ef285a93e702fa6` |
| `prefab_management` | 预制体 | 通过 | `call_c290f821515679b2695c` |
| `manage_editor` | 编辑器选择 | 通过 | `call_d3d44a0adc65b1e578c0` |
| `find_gameobjects` | 节点与场景 | 通过 | `call_45590dd56adb09fe8f04` |
| `manage_material` | 材质与纹理 | 通过 | `call_464e49c121af85ce31a7` |
| `manage_texture` | 材质与纹理 | 通过 | `call_e0a3e0207b374dbad737` |
| `manage_shader` | 材质与纹理 | 通过 | `call_99447265ba8c05430651` |
| `execute_menu_item` | 编辑器选择 | 通过 | `call_d29b68ea40cc518617c2` |
| `apply_text_edits` | 文件 | 通过 | `call_eedf9ece8a8fbe094636` |
| `read_console` | 日志 | 通过 | `call_1d368c147dfec9062835` |
| `validate_script` | 诊断与验证 | 通过 | `call_0ca4257932965e9266f4` |
| `button_events` | 事件 | 通过 | `call_aa0cfbc4b370471ec920` |
| `validate_prefab` | 诊断与验证 | 通过 | `call_4ed185e21777c3d2eb92` |
| `run_script_diagnostics` | 诊断与验证 | 通过 | `call_a160862a219a20ebceac` |
| `check_asset_ready` | 资源 | 通过 | `call_5ce97307f3293b2932cc` |
| `search_project` | 文件 | 通过 | `call_56b6f0f0a5927953ec46` |
| `manage_undo` | 撤销与重做 | 通过 | `call_3d542cad591926e94598` |
| `manage_vfx` | UI 创建 | 通过 | `call_6d03ff60b8c905328041` |
| `get_sha` | 文件 | 通过 | `call_98ea3d9b59c56458575a` |
| `manage_animation` | 动画 | 通过 | `call_1f549e6778e63e736c81` |
| `capture_editor_screenshot` | 截图 | 通过 | `call_c36f63cbba48f739b752` |
| `resolve_capture_coordinates` | 截图 | 通过 | `call_254439d787deaf39adee` |
| `inspect_asset_dependencies` | 诊断与验证 | 通过 | `call_33471f2e71aeb7192166` |
| `find_references` | 节点与场景 | 通过 | `call_ac1b52f452884d7b9850` |
| `build_project` | 构建 | 通过 | `call_32b9e67005ee826484b9` |
| `get_project_info` | 工程与目录 | 通过 | `call_4c98d83aef1bacedf2ec` |
| `inspect_builder_targets` | 诊断与验证 | 通过 | `call_829a46e896b12fd2dcb1` |
| `modify_prefab_offline` | 预制体 | 通过 | `call_74989e4f2263e163aa5b` |
| `modify_scene_offline` | 预制体 | 通过 | `call_f3e4d32923625ddeec57` |
| `get_hierarchy` | 节点与场景 | 通过 | `call_7cd658045aad58256573` |
| `find_nodes` | 节点与场景 | 通过 | `call_aec75e89645f9ed0cb6c` |
| `set_node_transform` | 节点与场景 | 通过 | `call_37ba1986497189f079f7` |
| `save_current_scene` | 节点与场景 | 通过 | `call_0ddac7fb07cc5974162a` |
| `create_canvas` | UI 创建 | 通过 | `call_bc2efea3fc9a19333cfc` |
| `create_label` | UI 创建 | 通过 | `call_2294eae84290ea539be4` |
| `create_button` | UI 创建 | 通过 | `call_a1a44ab8fd8ebea35e16` |
| `create_sprite` | UI 创建 | 通过 | `call_1ede096d9b5fab14785e` |
| `create_camera` | 摄像机 | 通过 | `call_cbb6db37d726f774e315` |
| `list_components` | 组件 | 通过 | `call_12510677b084eb775d39` |
| `inspect_component` | 组件 | 通过 | `call_889d68f7f243acd6a852` |
| `add_component` | 组件 | 通过 | `call_34eae6ee70b2bec41713` |
| `remove_component` | 组件 | 通过 | `call_ec5b74725296dc447225` |
| `set_component_properties` | 组件 | 通过 | `call_db589dca2e105570eb93` |
| `set_component_property` | 组件 | 通过 | `call_d3ba85952a8781e89cd2` |
| `set_camera_properties` | 摄像机 | 通过 | `call_4b2f13c469c9cb590a53` |
| `list_button_click_events` | 事件 | 通过 | `call_38b4afe1efb7a85b1468` |
| `bind_button_click_event` | 事件 | 通过 | `call_fc53171585ba76d66d4d` |
| `get_selection` | 编辑器选择 | 通过 | `call_7a794b5f9cc1d128aed4` |
| `get_editor_selection` | 编辑器选择 | 通过 | `call_cc82735f53c239b00baa` |
| `set_selection` | 编辑器选择 | 通过 | `call_e8954b4ca781caa5c493` |
| `refresh_assets` | 资源 | 通过 | `call_828504efc130afa656e7` |
| `get_recent_logs` | 日志 | 通过 | `call_be4d07ed5d1732963c6c` |
| `search_files` | 文件 | 通过 | `call_449db9550ed8abea670d` |
| `validate_prefab_references` | 诊断与验证 | 通过 | `call_294b4bc9f106dc50f030` |
| `validate_asset_dependencies` | 诊断与验证 | 通过 | `call_538f4e8eabfaa8bfcf9d` |
| `inspect_prefab` | 预制体 | 通过 | `call_896573589b8e405d9307` |
| `create_prefab_from_node` | 预制体 | 通过 | `call_7e4168a7ca353d7cf8ae` |
| `create_prefab_instance` | 预制体 | 通过 | `call_5a383407bc3ea13d6e86` |
| `instantiate_prefab` | 预制体 | 通过 | `call_1d6deee9e96caafe3821` |
| `apply_prefab_instance` | 预制体 | 通过 | `call_475ff36b3da7936056ea` |
| `create_asset` | 资源 | 通过 | `call_6a24d0d74ec52468478b` |
| `delete_asset` | 资源 | 通过 | `call_8556251d9f45b555fcbb` |
| `move_asset` | 资源 | 通过 | `call_eaa4de092691559b48e2` |
| `inspect_asset` | 资源 | 通过 | `call_a04f228244722d3cfe4c` |
| `create_script` | 文件 | 通过 | `call_dc605b2be3a37ada4b15` |
| `delete_script` | 文件 | 通过 | `call_a5a4416a4d818230663a` |
| `read_script` | 文件 | 通过 | `call_7ba3abd63957838151f1` |
| `write_script` | 文件 | 通过 | `call_1729b688e489e199437c` |
| `list_animations` | 动画 | 通过 | `call_2476b55626dc68294aa8` |
| `inspect_animation` | 动画 | 通过 | `call_d2505a7818104063f1ac` |
| `play_animation` | 动画 | 通过 | `call_f71f4be5b35730f13715` |
| `stop_animation` | 动画 | 通过 | `call_b7c0955a836fef8b2055` |
| `pause_animation` | 动画 | 通过 | `call_633e28985451f7ab0c57` |
| `resume_animation` | 动画 | 通过 | `call_6947dd12047a47449545` |
| `create_material` | 材质与纹理 | 通过 | `call_75baf6b7793253727473` |
| `delete_material` | 材质与纹理 | 通过 | `call_0193cf11c73a79055d6d` |
| `inspect_material` | 材质与纹理 | 通过 | `call_d374ed0a0b28981522f9` |
| `set_material_properties` | 材质与纹理 | 通过 | `call_f1b2ec5144f1de3abec3` |
| `create_texture` | 材质与纹理 | 通过 | `call_a14e135e1e4dfd9c3980` |
| `delete_texture` | 材质与纹理 | 通过 | `call_f003e41d34bf3b6e7c59` |
| `inspect_texture` | 材质与纹理 | 通过 | `call_3423c3a3d6afb54718f0` |
| `set_texture_properties` | 材质与纹理 | 通过 | `call_91084bdaf0c7164b0f3e` |
| `create_shader` | 材质与纹理 | 通过 | `call_63448387340cb338dda0` |
| `delete_shader` | 材质与纹理 | 通过 | `call_353c2cd3706474710427` |
| `read_shader` | 材质与纹理 | 通过 | `call_f23f45eb6a89f0198298` |
| `write_shader` | 材质与纹理 | 通过 | `call_590dca41d732124f6b81` |
| `inspect_shader` | 材质与纹理 | 通过 | `call_a0720502e97931313d8b` |
| `undo` | 撤销与重做 | 通过 | `call_10bc037e7ba8e8edfa4c` |
| `redo` | 撤销与重做 | 通过 | `call_ca1e46705c6e09f5fcae` |
| `begin_undo_group` | 撤销与重做 | 通过 | `call_f8b534369ff14827b413` |
| `end_undo_group` | 撤销与重做 | 通过 | `call_bb0870cf06e9c217dc28` |
| `cancel_undo_group` | 撤销与重做 | 通过 | `call_490ee15bcc8a22a25eae` |
| `execute_javascript` | 脚本执行 | 通过 | `call_042b766e53cf61bca121` |
| `execute_editor_script` | 脚本执行 | 通过 | `call_d36f7d078b0cdd4f76a9` |
| `execute_scene_script` | 脚本执行 | 通过 | `call_633a3200c4e522a51953` |
| `resolve_node` | 节点与场景 | 通过 | `call_4d7bbd495929c2ecabb8` |
| `get_scene_info` | 节点与场景 | 通过 | `call_5612ee75aa3fdc987fce` |
| `inspect_node` | 节点与场景 | 通过 | `call_02b34ec8658a7d969f31` |
| `delete_node` | 节点与场景 | 通过 | `call_61b3eaf6533d783d13c9` |
| `emit_node_event` | 事件 | 通过 | `call_befcf57192d2b54921e7` |
| `simulate_button_click` | 事件 | 通过 | `call_628a5f2afd9fef02d7d5` |
| `invoke_component_method` | 组件 | 通过 | `call_99a0575acbf7698d9f14` |
| `list_cameras` | 摄像机 | 通过 | `call_be512013a3a26ed72de2` |
| `inspect_prefab_instance` | 预制体 | 通过 | `call_7ed2b660f94b0312c8d9` |
| `get_runtime_state` | 运行状态 | 通过 | `call_bb3897c796bd83b16f5d` |
| `pause_runtime` | 运行状态 | 通过 | `call_df5050173dd2d85fb739` |
| `resume_runtime` | 运行状态 | 通过 | `call_ef80febfb8579210e49e` |
| `set_time_scale` | 运行状态 | 通过 | `call_5719f35363e9e3c4817a` |
| `get_performance_snapshot` | 诊断与验证 | 通过 | `call_38ccfa2ea8b31c085fe2` |
| `add_animation_clip` | 动画 | 通过 | `call_520accd87c480facd3f7` |
| `read_file` | 文件 | 通过 | `call_1b414c7b198e582c7141` |
| `get_file_snippet` | 文件 | 通过 | `call_27d25223e6f0375717b8` |
| `write_file` | 文件 | 通过 | `call_f470566c60cd50e58746` |
| `replace_in_file` | 文件 | 通过 | `call_8f6affac0741fc9cfdc1` |
| `list_directory` | 文件 | 通过 | `call_6642c9bce4d8627fb5de` |
| `exists` | 文件 | 通过 | `call_c743dde3325b558b9073` |
| `get_tool_catalog` | 工程与目录 | 通过 | `call_3db84dff976f9028ff0c` |
| `get_editor_state` | 工程与目录 | 通过 | `call_0aa002521ceef689a0a6` |
| `list_editor_windows` | 工程与目录 | 通过 | `call_9c38b9d48ad88b23d343` |
| `list_assets` | 资源 | 通过 | `call_844d796d5ce68e305671` |
| `list_scenes` | 资源 | 通过 | `call_c13d72a91c37793667e8` |
| `list_prefabs` | 预制体 | 通过 | `call_52cdb07af3b745c319a8` |
| `duplicate_prefab` | 预制体 | 通过 | `call_309e6bfbb7721cdfafb3` |
| `get_active_instances` | 工程与目录 | 通过 | stdio |
| `set_active_instance` | 工程与目录 | 通过 | stdio |

## 复现与范围

验收脚本：`scripts/validate-live-tools.js`。使用独立工程路径 MCP_VALIDATION_PROJECT 和端口 MCP_VALIDATION_PORT，先运行 first；查看实际截图后运行 input、build、connections，最后运行 report。

每项工具验证正常路径，另外覆盖本次风险相关的拒绝与恢复路径；不代表穷尽所有参数组合。隔离工程和原始证据保存在local目录，便于复现。

复跑first阶段需要空的独立Creator 2.4.15工程；已保留的测试工程含现成夹具。可在local下建立符合 `mcp-tool-validation-日期-序号` 命名的新工程，并配置当前插件及TypeScript检查环境。

隔离测试Creator实例已关闭；原游戏工程已经加载上述修复构建，编辑器、场景和新代理诊断为matched，原场景UUID、名称和子节点数量保持一致。
