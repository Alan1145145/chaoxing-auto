> **状态（2026-11-09）：U校园 集成已从 1.0.6 起整体移除（功能未达交付标准）。
> 本文与同目录其余文档保留为历史记录；`doubao-injection` / `local-ai-server` 两个依赖助手脚本的夹具随之删除，
> `follow-provider` / `navigation-race` 仍用于通用回归。**

# U校园刷课助手（第三方 userscript）集成说明

日期：2026-10-26（2026-10-28 更新：1.0.5 起随包发布「内置全功能版」1.3.11）
脚本：U校园刷课助手 v1.3.8（作者 叶屿，GPL-3.0），本地重构版 1.3.11（无二维码/无解锁码/无远程公告）

> 完整结构解析、与 OCS 的弹出链路对比、真实环境复现证据见 [HELPER-ANALYSIS.md](./HELPER-ANALYSIS.md)。
> 1.0.5 的一键进入课程链路与验证数据见 [VERIFICATION.md](./VERIFICATION.md)。

## 背景与目标

OCS 的 U校园工程能自动弹面板并按目录学习，但作业/听力等题型不做自动作答。应需求引入这份第三方脚本作为 U校园的主力学习工具，并解决它「弹出之后被拦截」的问题。

脚本本体功能（由脚本作者提供，未做修改）：

- 悬浮球 + 控制面板（`#unipus-ball` / `#unipus-panel`，直接挂在 `document.body`）
- 自动遍历 Unit/Section/Micro 目录、标签、子任务与任务内分页
- 视频/音频自动播放、自动关闭「我知道了」弹窗
- AI 自动作答：DeepSeek（文本）+ 通义千问 Qwen3-Omni-Flash / 智谱 GLM-4-Voice（听力多模态）
- 内置模型：检测到 `window.__ocsLocalAI` 时默认走「超星自动机·内置模型」，文本题不需要用户填 Key
- ~~加速模式：看广告或激活码解锁~~ —— 1.3.11 起已整体删除，题间节奏固定 1.5 秒

## 集成方式

- 脚本原样放在 `packages/app/resources/userscripts/unipus-helper.user.js`（保留完整 GPL 头与作者声明），不与本项目源码合并，见 `packages/app/NOTICE.md`。
- `electron.builder.json` 的 `files` 增加 `resources/userscripts/**/*`，随安装包分发。
- `packages/app/src/utils/embedded-browser.ts` 的注入管线从「单脚本」扩展为「脚本列表」：
  - OCS（`public/ocsjs/ocs.user.js`）为主脚本；
  - 助手按自身的 `@match`（ucontent/ipub/uai/u.unipus.cn）与 `@run-at document-end` 生效；
  - GM API 桥按脚本闭包注入（存储前缀取各自 `@namespace + @name`），全局只注册一次供环境检测，两个脚本的 GM 存储互不覆盖；
  - `@connect` 与 `@match` 取所有脚本的并集。

## 「弹出之后被拦截」的解决方案

在内嵌浏览器里有三类会导致悬浮球/面板「弹出后消失或不可用」的拦截，分别处理：

1. **页面加载期拦截（ucontent 的 document.write/鉴权）**
   脚本若在 `document-start` 立刻执行，会和 U校园课程页的加载流程互相打断。注入管线对 `ucontent.unipus.cn` 统一等待 `document.readyState === 'complete'` 后再执行任何 userscript；`document-end` 脚本在其他域名则等 `DOMContentLoaded`。
2. **网络拦截（AI/公告请求）**
   脚本所有模型请求走 `GM_xmlhttpRequest`。内嵌浏览器提供主进程级 GM 网络桥（支持 `@connect` 白名单、`arraybuffer`、超时与中止），DeepSeek/千问/智谱与脚本公告接口不会被页面 CORS 拦截。密钥在脚本面板里由用户自行填写，保存在本机。
3. **DOM 移除拦截（SPA 重绘）**
   ucontent 是重绘型 SPA，悬浮球/面板直接挂在 `body` 上，路由切换或重绘可能把它们一并清掉。注入管线对 `unipus-ball`、`unipus-panel` 加了防移除护栏：MutationObserver 记录元素，发现脱管后 1.5 秒内重新挂回 `document.body`。

## AI 作答接入超星自动机（1.0.3）

- 新增本地 OpenAI 兼容接口 `POST http://127.0.0.1:<port>/api/local-ai/v1/chat/completions`（`packages/app/src/services/local-ai.ts`）：
  - 使用与内嵌 GM 存储桥相同的令牌校验，只有内嵌浏览器能调用；
  - 内部复用 `chatWithSelectedProvider()` →「模型接入」里当前选中的模型（默认内置豆包），也支持用户配置的 OpenAI 兼容 / Anthropic / Gemini 接口；
  - 返回标准 `chat.completion` 结构，助手脚本无需改动协议。
- 注入层向页面暴露 `window.__ocsLocalAI = { chatUrl, token }`。
- 助手脚本新增 `ocs_local`（「超星自动机·跟随软件端」）文本模型：
  - 在内嵌浏览器里、用户尚未选择过模型时作为默认文本模型；
  - 请求发往本地接口，使用页面注入的令牌，不需要用户填写 API Key；
  - 独立安装（Tampermonkey）时没有该桥，脚本会提示「本地模型仅在超星自动机内嵌浏览器中可用」。
- 听力/音频题仍使用脚本自带的千问 Qwen3-Omni-Flash / 智谱 GLM-4-Voice，需要用户自备对应 Key；若未配置音频 Key，听力题按脚本原逻辑不猜答。

## 豆包助手直连（1.0.5，未新增版本号）

`ocs_local` 走的是「模型接入」里选中的模型；如果使用者把「模型接入」换成了别的模型，U校园 助手就用不到豆包。1.0.5 把软件自带的豆包助手单独开了一条链路：

- **桌面端接口**：`POST /api/local-ai/doubao`（`packages/app/src/services/local-ai.ts`）直接调用 `chatDoubao()`，请求/响应仍是 OpenAI 格式；`model` 传空或非法值时用 `doubao-fast`。
- **健康探测**：`GET /api/local-ai/health?doubao=1` 返回 `doubao: { loggedIn, models, maxPromptLength, endpoint, error }` 与 `localAi: { selected: { id, name, model, builtinDoubao } }`；`selected` 是软件端「模型接入」当前选中的模型（只带名字与模型 ID，不含 Key）；不带参数时只读缓存，不会拉起网关子进程。
- **助手完全跟随软件端**（`Store.getAIProvider()` / `Store.getDesktopProvider()`）：
  - 软件端选的是内置豆包且豆包已登录 → 文本 AI 用「超星自动机·豆包助手」（`doubao_app`，直连 `/api/local-ai/doubao`）；
  - 软件端选了别的模型（DeepSeek / 自建 OpenAI 兼容等）或豆包未登录 → 用「超星自动机·跟随软件端」（`ocs_local`，走 `/api/local-ai/v1/chat/completions`，由软件按「模型接入」转发）；
  - 两种情况下助手都不需要 Key：选中本地模型时面板会把「文本 AI Key」整行隐藏，并显示一行「当前跟随软件端「模型接入」：<模型名>」；
  - 在两个本地选项（豆包直连/跟随软件端）之间手选不生效，一律由桌面端按「模型接入」路由；
  - 用户手动改选外部平台后不再自动切回（清除 `unipus_ai_provider_auto`），但只要软件端在线且该项没填 Key，仍会回到跟随状态。
- **三层兜底**：题目超过豆包 3 万字上限、豆包返回非 200、网络错误/超时，都会退回 `ocs_local`（只退一次，不递归），不会让整道题失败；`ocs_local` 自身失败时把桌面端 `error.message` 原样抛出，方便看清是 Key 还是额度问题。
- 顺带修复：外部 Chrome 里 `ocs_local` 之前因为没有注入令牌被判成「未配置 Key」，现在 `__unipusLocalAIAvailable` 也算本地就绪。

## 语音/口语相关：词汇与朗读任务

- **能自动完成**：`Vocabulary`（`v3vocabulary_pc`，单词卡/词汇学习）这类没有作答题目的任务。OCS 新增「📚 词汇/朗读自动完成」脚本（`packages/ocsjs/packages/scripts/src/projects/unipus.ts`，默认开启）：
  - 从 hash 路由解析 `courseId` / `groupId`；
  - `GET /course/api/pc/group/{courseId}/{groupId}/default/` 确认任务类型（base 含 vocabulary）；
  - `GET /course/api/pc/summary/...` 确认没有题目（有题目则不动，避免影响作业/测试）；
  - `POST /api/mobile/user_group/{courseId}/{groupId}/progress/`，body `{status:1,rid:"flowengine:studyStatus:1:<groupId>",groupId,version:"default"}`；
  - 之后用 `course_progress` 校验 `pass === 1`。
- **不能自动完成**：真正的跟读/口语评分题。录音与评分走腾讯 SOE（`speech.unipus.cn`，含服务端签名），伪造录音上传成本高、风控风险大；助手脚本也会把这类任务列为人工待办。
- 真实账号实测（2026-10-26）：
  - 该 progress 接口对 `u2g27` 返回 `{"code":0,...}`，随后 `course_progress` 的 `pass` 从 0 变为 1；
  - 参考项目的简化载荷（`quesDatas:[] + submitType:2`）在当前 web 版本返回 HTTP 601，已弃用；当前使用浏览器同款的 `enable_mistake/version/record_version/state/specific_scores/answers` 结构（仅用于无题目任务时改用 progress 接口）。
  - 高频测试后站点会对部分 API 返回风控验证页（captcha HTML，HTTP 200），脚本遇到非 JSON 响应会跳过，不会误报完成。

## 外部 Chrome（脚本猫）路径（1.0.4 起）

实际使用中，课程页面通常是在软件启动的外部 Chrome 里打开，脚本由 Chrome 内的脚本管理器（脚本猫）执行，而不是内嵌浏览器。此前版本只处理了内嵌浏览器，导致外部 Chrome 里 ScriptCat 显示「当前页运行脚本：暂无数据」，OCS 面板和助手悬浮球都不会出现。1.0.4 补齐：

- **启动时自动安装脚本**：点击启动浏览器时，软件会把「OCS 网课助手」和「U校园刷课助手」自动补进「我的脚本」列表（地址为 `http://127.0.0.1:<本地端口>/api/embedded-*.user.js`），并对新浏览器/旧浏览器执行安装或更新；已存在的旧 OCS 条目会被改成本地构建版本。安装改为**串行**执行（装完一个再打开下一个），因为 ScriptCat 一次只处理一个安装页，同时打开多个会导致其中一个被忽略。
- **本地服务器新增接口**：`/api/embedded-unipus-helper.user.js`、`/api/embedded-unipus-helper.meta.js`（供脚本管理器安装与版本检查）、`/api/local-ai/health`（外部 Chrome 探测桌面端是否在线）。
- **本地模型在外部 Chrome 可用**：本地 AI 接口允许本机回环（127.0.0.1/::1）无令牌访问，与已有 `/query` 题库接口同一安全边界；助手检测到本地服务后，默认文本模型仍是「超星自动机·内置模型」。
- **OCS 让位检测**：除 `window.__unipusPanel` 外，还会检查页面里的 `#unipus-ball` / `#unipus-panel`，兼容脚本管理器的沙箱环境。

### 升级后的操作步骤

1. 安装 1.0.4 安装包，完全退出旧版软件（含任务栏残留进程）。
2. 重新打开软件，进入「浏览器」页面启动课程空间；脚本管理器会弹出 OCS 与 U校园刷课助手的安装/更新确认，等待安装完成。
3. 打开 U校园 课程页：右上应出现 OCS 悬浮面板，右下应出现 📚 悬浮球。
4. 若脚本管理器里仍显示「暂无数据」，检查「我的脚本」页面两个脚本是否为启用状态，然后重启浏览器（或在该页面手动点一次安装）。

## 助手面板“不弹出/弹出后被收回”修复

在真实 ScriptCat + 用户浏览器配置下复现后确认：脚本本身在运行，悬浮球/面板都创建成功，但有两个显示层问题：

1. **悬浮球被站点自己的悬浮按钮遮挡**：U校园 页面右下角有客服/反馈悬浮按钮，助手悬浮球原来也在 `bottom:24px;right:24px`，几乎完全重叠。已把悬浮球移到 `bottom:96px`，并把层级提到 `2147483647`。
2. **自动开始后把面板收回悬浮球**：助手脚本原逻辑在自动开始时执行 `panel.style.display='none'`，用户看到的就是“面板弹出后又被收回”。本地构建改为**保持面板展开**，需要收起时点标题栏「─」。
3. 另外增加悬浮球/面板防移除保护：SPA 重绘或站点清理 DOM 后 1.5 秒内自动挂回。
4. 安装链路改为串行 + 等安装页自然关闭（最多 8 秒）+ 处理二次确认，避免 ScriptCat 漏装或更新中断。
5. 助手内部版本与 `@version` 统一为 1.3.10，`@name` 保持不变以保证 ScriptCat 能识别为“更新”而不是新脚本。

验证（用户真实配置副本 + 登录态 + ScriptCat）：悬浮球位于站点按钮上方且 `elementFromPoint` 命中悬浮球；自动开始后 `#unipus-panel` 保持 `display:flex`；手动删除悬浮球和面板后均被自动挂回。

注意：如果课程页在脚本安装前就已经打开，ScriptCat 不会向已存在的标签页补注入，需要刷新页面或重新打开课程页。

## 与 OCS 的协调

- 检测到助手（`window.__unipusPanel`）时，OCS 的 U校园「课程学习」自动让位并提示，避免两边同时点目录；OCS 面板本身照常弹出。
- 学习导航入口、登录自动化（自动填充 + 滑块提示人工完成）不变，进入课程页后由助手接管。
- 1.0.5 起软件左侧导航新增「U校园」页：填一次账号与课程关键词即可一键走完登录 → 班课 → 课程 → 学习页，并预置助手面板为展开、跳过用途确认。

## 内置全功能版 1.3.11（1.0.5 起）

不再按作者的更新节奏走，也不再访问作者的服务器。全部为本地删除式重构，未改 solver/播放器/RPC/AI 主体逻辑：

- 删除 `@antifeature payment`、`@connect qsy.iano.cn`、`Config.qrImageUrl/verifyUrl/announceUrl`、`Solver.verifyUnlockCode()`。
- `Store.isUnlocked()` 恒为 `true`；题间延迟统一 `1500 + random(0~500)` 毫秒（原「未解锁 35 秒」分支删除）。
- 删除面板的二维码区、解锁码输入与校验状态、微信反馈条、远程公告栏及其 CSS/事件处理器。
- 用途确认弹窗改为直接记录已确认（原流程保留在 `_legacyEnsureStudyPurposeConfirmed()`），配合桌面端一键进入时不再打断。
- `@name` 保持不变，ScriptCat 仍能把内置版识别为原脚本的更新。

安装包内的助手脚本已复核：`@version 1.3.11`，`up-qr-box` / `up-unlock-input` / `C919irt` 命中数 0，面板默认 `display:flex`，标题显示 `v1.3.11`。

## 真实页面验证（2026-10-26）

在真实账号登录态下，向 `ucontent.unipus.cn/_pc_default/pc.html?...#/course-v1:...` 以 document-start 模拟桌面端注入（OCS + 助手 + GM 桩）：

- 页面正常加载完成（`readyState: complete`，课程正文可见），不再出现反复登录/白屏。
- OCS：`window.OCS` 为对象，悬浮窗正常挂载；其 U校园学习流程按预期让位。
- 助手：`#unipus-ball` 悬浮球出现，点击弹出 `#unipus-panel`（380×720，v1.3.8 面板内容完整）；目录扫描成功（19 项）并进入自动开始流程（用途确认弹窗）。
- 防移除护栏：手动 `remove()` 悬浮球与面板后，约 2 秒内均被自动挂回。

1.0.3 追加验证：

- 本地模型：`handleLocalAiChat` 端到端测试通过（有效令牌 200 并返回 `choices[0].message.content`；无效令牌 401；空提示 400）。助手面板中「超星自动机·跟随软件端」默认选中，且不再显示外部平台链接。
- 豆包直连：`_callTextAI` 的四条路径（豆包正常 / 413 / 网络错误 / 超长）用夹具验证通过；无头 Chromium 注入真实脚本后，三种「模型接入」场景都符合预期（选内置豆包且已登录 → `doubao_app`；选自定义模型 → `ocs_local`；豆包未登录 → `ocs_local`），面板均隐藏 Key 输入并显示当前跟随的模型，健康探测带 `?doubao=1`。
- 注意：`ocs_local` 在脚本里的显示名已从「内置模型」改为「跟随软件端」，旧描述里的「内置模型」指同一条链路。
- 跟随逻辑的桌面端一侧：`fixtures/follow-provider.mjs` 直接 require 编译产物（stub `electron` + 临时 userData），确认 `describeSelectedProvider()` 首次安装返回 `builtin-doubao / doubao-fast / builtinDoubao: true`，切换自定义模型后返回 `builtinDoubao: false`，且摘要里不含 `apiKey`。
- 端到端集成：`fixtures/local-ai-server.mjs` 把编译产物真的跑成本地 HTTP 服务（含真实 `doubao-gateway.exe` 启动），从真实网络验证「助手 → 本地接口 → 模型接入 → 上游」整条链路与三层回退；并确认旧数据手动选过 `doubao_app` 也会交回桌面端路由（本地选项之间手选不生效，一律以软件端为准）。该夹具与另外三条一起连续三轮自测通过（见 VERIFICATION.md「自测轮次」）。
- 词汇任务：真实账号对 `u2g27` 调用 progress 接口后 `pass` 0→1；脚本级测试（请求拦截 mock）确认 OCS 在 `#/.../u2g29/vocabulary` 上只上报一次，body 为 `{"status":1,"rid":"flowengine:studyStatus:1:u2g29","groupId":"u2g29","version":"default"}`，并能在后续 `course_progress` 读到 `pass: 1`。

截图：`.zcode/tmp/helper-panel.png`（临时，不入库）。

## 使用说明

1. 在软件「学习导航」打开 U校园，登录并进入课程学习页。
2. 页面右下角出现 📚 悬浮球，点开面板：
   - 文本 AI 默认是「超星自动机·跟随软件端」/「超星自动机·豆包助手」，直接使用软件「模型接入」里配置的模型，无需填 Key；
   - 听力题需要音频 AI：填写千问（推荐）或智谱的 Key；
   - 可选：开启加速模式（脚本作者的看广告/解锁码，与本软件无关）。
3. 确认「复习用途」后脚本自动遍历目录作答；AI 作答请求经内置跨域桥发出。

## 已知边界

- 文本题默认跟随软件端「模型接入」；听力/音频题仍需用户自备千问或智谱 Key（脚本作者推荐千问）。
- 真正的跟读/口语评分题（腾讯 SOE 录音评测）不做自动作答：伪造录音上传成本高、风控风险大，助手会列为人工待办。
- 词汇/朗读自动完成只针对无题目的 `v3vocabulary` 任务，且会直接标记完成，可能影响成绩；作业/测试/口语题不受影响。
- 脚本的加速验证、远程公告由脚本作者的 `qsy.iano.cn` 提供，网络不可达时仅影响这些附加功能。
- GPL-3.0 脚本作为独立文件分发；本仓库的本地修改已在文件头与代码处标注，如需再分发修改版需遵守 GPL-3.0 的开源义务。
