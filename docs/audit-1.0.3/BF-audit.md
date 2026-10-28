# BF-audit · 1.0.3 / OCS 5.1.3

本轮按真实运行回归检查 1.0.2，复现后修复以下四类问题。修改前文件保存在本地 `before/`，1.0.2 构建和 GitHub 发布保留。

| 编号 | 已复现问题 | 根因与修复 | 验证 |
| --- | --- | --- | --- |
| A1 | 从 GM_getValue 取出数组、push 后 GM_setValue，界面值变化但原生存储仍为 []；保存对象后继续修改原对象也会污染缓存 | 运行器缓存直接返回对象引用，相同值优化比较了同一个已被修改的对象。读、写和监听通知现在均隔离对象引用，保留内存缓存和合并写入 | [V] 原生快照由 [] 变为 ["persisted"]，调用方对象不再改变缓存；跨域 iframe 和删除回归通过 |
| A2 | 切换默认模型时模型文件保存成功，后续 OCS saveStore 失败，界面退回豆包，实际配置仍为新模型 | saveConfig 将部分保存当作整体未保存。现在保留已持久化的默认模型，继续明确显示 OCS 接入错误；模型本身未保存时仍回滚 | [V] 在真实 Electron IPC 注入两阶段失败，验证 UI/配置一致、真正失败的选择和开关恢复 |
| A3 | OCS 题库要求等待 150 秒，但原生网络桥强制截成 120 秒 | 内嵌 GM 网络桥上限过低；现在尊重调用方超时，上限 300 秒，缺省仍 30 秒 | [V] 经过真实 GM/CDP/原生 Axios 调用，截获 timeout 从 120000 修复为 150000；未等待真实付费模型 |
| A4 | HTTP 200 但 finish_reason/stop_reason 表示截断、拒绝、工具未完成或流式错误时，残缺内容仍进入自动保存题库 | 只读取文本、忽略终止原因，SSE 吞掉错误。新增 model-response.ts，先验证完整性，再进入答案解析；识别显式错误、长度/安全终止、未完成工具、流式中断和 error 事件，同时兼容 SSE 心跳 | [V] 16 个 HTTP fixtures：12 个异常不保存答案；4 个正常 Chat/Anthropic/Gemini/SSE 继续保存；错误密钥脱敏 |

## 验证范围

- [V] 1.0.2 原包资源复现截断/拒绝/流式中断后仍保存答案；当前修复后对应断言通过。
- [V] app TypeScript、OCS TypeScript/Vite、web vue-tsc/Vite 构建通过。
- [V] 原回归：47 项模型接口、1050 项模型能力/存储、24 项界面/同步、25 项浏览器交互均通过。
- [V] 新增 `scripts/test-audit-regressions.cjs` 6 项真实 Electron 异常路径、`scripts/test-model-response-errors.cjs` 16 个响应 fixtures 通过。
- [V] NSIS 1.0.3 已构建，关键打包模块与编译文件逐个一致；新安装程序未执行实际安装。
- [V] 打包资源回归：新增异常路径 6 项、模型界面/同步 24 项、浏览器交互 25 项、响应 fixtures 16 项均通过。
- [T] GitHub 提交及发布结果在交付前补记。

官方响应依据：[OpenAI finish_reason](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create)、[Claude stop_reason](https://platform.claude.com/docs/en/build-with-claude/handling-stop-reasons)、[Gemini finishReason](https://ai.google.dev/api/generate-content)。使用现有 Electron、Playwright、Axios、TypeScript，未新增依赖。

## 自检、限制和回退

本轮为自行审查，无外部评审或用户验收记录。测试使用本地模拟服务和隔离配置；不代表全部课程网站和付费模型实测。异常响应会明确报错而不自动继续工具调用，避免把未完成内容当成答案。未删除或修改用户已有题库。缓存合并写入、正常退出刷盘及原有窗口/弹窗限制与 1.0.2 相同。

源码差异均保留本地 before/；当前目录没有 .git。发布前记录实际 GitHub 提交与安装包摘要。回退可运行 `packages/app/dist-browser-fixes-20261028/win-unpacked/超星自动机.exe` 或下载 v1.0.2。新启动脚本指向 `packages/app/dist-audit-20261028/win-unpacked/超星自动机.exe`。


附带修正：能力回归的旧版磁盘对比仅在本地存在 1.0.1 构建时执行；全新源码 checkout 缺少忽略的旧版构建时不再因此报模块不存在。

## 截图反馈：弹窗与浏览器空间

- [V] 重现弹窗外层伪元素与 display:flex 混用：1360×800 下 wrapper 的 clientHeight=768、scrollHeight=1520；滚轮可使整窗 top=-720、标题消失。使用独立 flex wrapper 并移除居中伪元素后，wrapper scrollHeight=clientHeight，标题和底部按钮固定，只滚动表单内容。
- [V] `test-ui-layout.cjs` 17 项通过：1360×800、900×560、760×440 的弹窗位置、滚动、适配下拉选择；700px 宽工具栏；专注模式开关和恢复导航。
- [V] 相同 1360×800 宿主，网页高度从 496.4px 提升至普通模式 641.6px、专注模式 683.6px；专注模式网页宽度为完整 1360px。去掉重复页头和网页四周空白，浏览状态侧栏自动紧凑，专注模式隐藏侧栏/浏览器分组栏。
- [V] 统一侧栏、按钮、表单和卡片间距，提高辅助文字对比度。模型弹窗按“地址/密钥 → 获取模型 → 能力”排序，将详细说明折叠；下拉跟随表单滚动并自动适应视口。原有 24/25 项界面/浏览器回归继续通过，截图已人工查看。
- [V] 初始窗口尺寸按当前显示器可用区域调整，避免超出小屏工作区。
- [T] 含 UI 改动的最终安装包校验与 GitHub 发布待补记。
