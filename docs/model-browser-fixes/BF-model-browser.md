# BF-model-browser · 1.0.2 / OCS 5.1.2

## 问题与修复

| 证据 | 根因 | 修改与验证 |
| --- | --- | --- |
| E1 | popup handler 将新窗口 URL 加载到原页；只注册每个浏览器的单个 WebContents | 新增网页标签、关闭/切换、主页、停止、快捷键和链接菜单。每个标签保持独立历史，同一浏览器共享 partition；原页和其他标签的脚本桥继续保留。 |
| E2 | 设置访问重复读取、解密文件；每次写入同步加密落盘；iframe 同步 XHR 放大成本 | 每个 profile 加载一次，运行器一次取快照，30ms 合并跨框架通知，150ms 合并原子写入，正常退出刷盘。忽略相同值；保留删除标记和默认值语义。 |
| E3 | 老拖动仅依赖 document mouseup，菜单事件也触发拖动 | 用 pointer capture、buttons 检查、取消/失焦清理和 RAF 更新替换两个旧拖动 helper；排除控件和下拉。边缘图标同步修复，并延迟判定至位置样式更新之后。 |
| E4 | 保存时丢弃能力设置；模型请求没有对应字段 | 持久化增强思考、联网与服务商适配选择。适配 OpenAI Chat/Responses、Qwen、DeepSeek、Anthropic、Gemini；通用兼容和内置豆包使用实时搜索资料。开关自动保存，关闭增强后恢复模型默认。 |
| E5 | 模型表单超出小窗口后被 modal 的 overflow 隐藏；导航事件会覆盖正在输入的地址 | 表单限制为视口高度并单独滚动，保持底部按钮可见；地址编辑期间保留输入，导航结束更新历史按钮状态。长模型列表保留搜索、键盘与鼠标选择。 |

新增请求模块将网络调用与配置/题库存储分开；未增加运行时依赖。模型接口参数依据官方文档核对：

- [OpenAI web search](https://developers.openai.com/api/docs/guides/tools-web-search)、[reasoning](https://developers.openai.com/api/docs/guides/reasoning)
- [Qwen search](https://help.aliyun.com/zh/model-studio/web-search/)、[DeepSeek thinking](https://api-docs.deepseek.com/guides/thinking_mode/)
- [Claude thinking](https://platform.claude.com/docs/en/build-with-claude/extended-thinking)、[Gemini generation schema](https://ai.google.dev/api/generate-content)

## 当前验证

- [V] app TypeScript、web vue-tsc/Vite、OCS TypeScript/Vite 构建成功。
- [V] `test-model-provider.cjs`：47 项，模型发现、分页、地址、密钥、错误脱敏等。
- [V] `test-model-capabilities.cjs`：1050 项，包括 1000 次写后读取，三类协议能力参数、流式、Responses、搜索资料注入、加密配置与存储隔离/删除。
- [V] `test-model-sync.cjs`：24 项，202 个模型的列表滚动、搜索/键盘选择、默认模型鼠标选择、能力开关保存、主页面与 iframe 自动同步、取消同步与恢复、小窗口表单和页面滚动。
- [V] `test-browser-interactions.cjs`：25 项，原页保留、标签和历史、快捷键、共享/隔离登录、真实鼠标拖动、松手/失焦、下拉不拖窗、加载 OCS 后滚动、边缘图标失焦，以及跨域 iframe 设置更新和删除。
- [V] 同样 2000 次设置操作：1.0.1 基线读取 1999 次、写入 1000 次；新版读取 0 次、合并写入及删除后刷盘合计 2 次。
- [V] 通用联网搜索实网请求返回 5 个带 URL 的参考结果。模型服务使用本地 HTTP fixtures；未使用用户密钥或调用付费模型。
- [V] 使用安装包内资源（`win-unpacked/resources/app`）启动隔离测试会话，模型界面/同步 24 项和浏览器交互 25 项均通过；关键编译文件及 OCS bundle 与源构建哈希一致。NSIS 安装程序已生成，未执行实际安装。
- [V] 源码提交 `2bc6cf320d8588297ccc26c1c4f285b7659070da`，逐一核对 29 个上传文件。GitHub [v1.0.2](https://github.com/Alan1145145/chaoxing-auto/releases/tag/v1.0.2) 已发布，安装包 284875291 字节，远端 SHA256 与本地一致；校验文件同时上传。

## 限制与自检

服务商需要为所选模型提供对应能力。增强模式遇到不支持的参数会显示错误，不会静默去掉能力。通用联网依赖搜索服务可达；它提供搜索摘要，不承诺来源事实或答题正确率。普通 HTTP(S) 新窗口链接在新标签打开；依赖 `window.open()` 返回窗口对象或 `window.opener` 的特殊弹窗流程仍需网站适配。

150ms 合并写入可在进程异常终止时丢失尚未刷盘的最后一批设置；正常退出执行刷盘。测试包括真实 Electron/WebView 与本地课程 fixtures，不声称已覆盖所有课程网站或登录账户。审查为本轮自行审查，无外部签字或用户验收记录。

## 快照与回退

当前目录无 `.git`。修改前源码保存在本地 `docs/model-browser-fixes/before/`；测试 profile、截图和构建输出均不提交。1.0.1 安装包与免安装目录保留。启动入口指向 `packages/app/dist-browser-fixes-20261028/win-unpacked/超星自动机.exe`；回退可运行 `packages/app/dist-model-sync-20261027/win-unpacked/超星自动机.exe`，或下载 GitHub v1.0.1。

新版安装包 SHA256：`faee4d3dc9071c12ae126d42c4f7c0eb91f4a643cf5d8ab52e31daa4182b4316`。
