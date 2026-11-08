# U 校园 OCS 接入验证

日期：2026-10-23
环境：Windows 10.0.26300 / Chrome 141 / Node 24 / pnpm 10.21.0

> 2026-10-26 更新：U校园课程内容的自动遍历与 AI 作答已改由随包内置的第三方「U校园刷课助手」承担，集成方式与「弹出被拦截」的解决方案见 [HELPER.md](./HELPER.md)；本文档保留 OCS 接入部分的验证记录。

## 目标

- 把 U 校园作为与超星、智慧树等并列的网课平台接入桌面端与 OCS 用户脚本。
- 打开 U 校园后，OCS 悬浮面板像「学习通」一样自动出现，并在面板中提供 U 校园工程。
- 进入课程后按目录自动学习视频/音频与阅读页面，自动切到下一节。
- 不修改现有超星、智慧树、职教云、智慧职教、中国大学 MOOC、雨课堂逻辑。

## 真实站点流程（已用测试账号验证）

### 登录

- 入口：`https://u.unipus.cn/user/student`
- 未登录会跳转到统一认证：
  `https://sso.unipus.cn/sso/login?service=https%3A%2F%2Fucloud.unipus.cn%2Fuser%2Fstudent`
- 登录表单：`input[name="username"]`、`input[name="password"]`、`#login`
- 首次登录会弹出服务协议窗口，需要点击「同意」。
- 点击登录后出现极验 GeeTest 滑块（`.geetest_slider_button`，canvas 拼图）。
- 登录成功后回到 `https://u.unipus.cn/user/student?school_id=...`。
- 部分自动化环境会触发算术安全验证（`.index-1XzPx--verification-dialog`），需要人工填写计算结果。

### 课程列表

- 登录后的「我的班课」：`https://u.unipus.cn/user/student?school_id=...`
- 课程卡片：`.my_course_item`，其内部 `.hideurl` 保存课程目录地址，例如：
  `/user/student/mycourse/courseCatalog?courseId=...&school_id=...&eccId=...&classId=...&coursetype=0`
- 课程目录页：`https://u.unipus.cn/user/student/mycourse/courseCatalog?...`
- 课程学习页：`https://ucontent.unipus.cn/_pc_default/pc.html?cid=...&appid=5&schId=...#/course-v1:.../courseware/...`
- 跨域课件/媒体：`ipub.unipus.cn`

## 已实现

### 应用层

- `packages/common/src/platforms.ts` 新增 U 校园平台目录，入口改为真实的「我的班课」地址。
- `OCSApi.getInfos()` 把本地 U 校园入口合并进远程学习导航；远程接口失败时导航页仍保留 U 校园。
- `packages/web/src/pages/bookmarks.vue` 在远程数据失败时回退到本地平台列表。
- `packages/app/src/scripts/automation/wk/unipus.ts` 新增「U校园-打开课程列表」自动化程序：
  - 打开 U 校园「我的班课」。
  - 可选自动填充手机号/密码，处理协议弹窗。
  - 遇到极验滑块或算术安全验证时提示人工完成，并在登录成功后自动继续。
  - 登录完成后等待课程列表出现。
- 应用内「学习导航」与「自动化程序」均出现 U 校园入口。

### OCS 用户脚本

- 新增 `UnipusProject`，域名 `unipus.cn`，构建产物包含：
  `// @match *://*.unipus.cn/*`
- 面板工程包含：
  - `💡 使用提示`
  - `▶️ 进入课程`：课程目录页自动点击「开始学习 / 继续学习」
  - `🖥️ 课程学习`：目录扫描、Tab/Task 遍历、视频/音频播放、阅读停留、自动下一节
  - `课件媒体桥接`（隐藏脚本）：跨域 `ipub` 播放器与课程页通信
- 通用工程「兼容的网课平台」列表已加入 U 校园。
- 课程目录扫描兼容三套 DOM：
  - `.pc-slider-menu-*`
  - Ant Design Tree / `role="tree"`
  - 旧版 `li.group.courseware`
- 作业/测试/考试/讨论/单元项目默认跳过，避免误提交；关闭跳过后会暂停并提示手动完成，当前版本不自动作答。

### ucontent 学习页注入修复

U 校园课程页（`ucontent.unipus.cn`）是特殊 SPA：在 `document-start` 阶段仍在执行 `document.write` 和鉴权跳转。早期版本的 OCS 在这个时机会直接打断页面加载，表现为页面反复登录、控制台循环 `Authenticate: loging....`，悬浮窗也无法出现。已做三层修复：

1. **入口延迟启动**（`packages/ocsjs/packages/scripts/entry.js`）
   - 当 `location.hostname === 'ucontent.unipus.cn'` 且页面尚未 `complete` 时，先监听 `readystatechange` / `load`，等页面完全加载后再调用 `start()`。
   - 其他 U 校园域名（登录页、班课列表）仍保持 `document-start` 启动，不改变原有行为。
2. **延迟挂载悬浮窗**（`patches/easy-us@1.0.15.patch`，通过 `pnpm-workspace.yaml` 的 `patchedDependencies` 持久化）
   - `mount()` 只在 `document.readyState === 'complete'` 后挂载，避免在 `interactive` 阶段向正在 `document.write` 的页面插入节点。
   - `CustomWindow.mount(parent)` 增加 `parent.children` 为空时回退到 `append`，修复 `Cannot read properties of undefined (reading 'after')`。
   - 通用工程 `edgeMinimize` 增加 `oncomplete`，页面完成后补一次边缘最小化初始化。
3. **修复请求记录拦截器的 `fetch` 调用者**（`packages/ocsjs/packages/scripts/src/projects/background.ts`）
   - 原实现使用 `originalFetch.apply(this, ...)`，`this` 是脚本实例而不是 `window`，浏览器会抛 `Illegal invocation`。
   - U 校园课程内容依赖 `fetch` 加载，拦截器即使未开启记录也会影响页面，导致课程页白屏。
   - 已改为 `originalFetch.call(window, ...)`，`GM_xmlhttpRequest` 同理改为直接调用。

## 验证结果

### 构建

执行：

```powershell
pnpm build:ocsjs
```

结果：通过，生成物包含 U 校园工程、`@match *://*.unipus.cn/*`、ucontent 延迟启动逻辑和 `fetch` 修复。

### 真实 ucontent 学习页

使用构建产物 `packages/web/public/ocsjs/ocs.user.js`，在保存的登录态下从 `document-start` 注入真实课程页：

```text
https://ucontent.unipus.cn/_pc_default/pc.html?cid=...&appid=5&schId=...#/course-v1:.../courseware/...
```

结果：

- `page.goto` 无超时，`document.readyState === 'complete'`。
- 页面正文正常显示课程内容（`新未来大学英语 综合教程3A > Unit 1 ...`）。
- `window.OCS` 为 `object`，无 OCS 初始化异常。
- 页面内出现 1 个 OCS Shadow DOM 宿主，悬浮窗成功挂载。
- 悬浮窗顶部显示 `OCS v5.1.0`、`U校园` 标签，以及 `通用` / `其他` 页签。
- 页面左上出现 OCS 提示「U校园课程学习开始，正在识别课程目录...」。
- 控制台不再出现 `Illegal invocation`，页面课程内容与悬浮窗可同时正常显示。

### 其他页面

在真实 `https://u.unipus.cn/user/student` 页面注入构建产物：

- OCS 悬浮窗自动出现。
- 顶部出现 `U校园` 工程标签。
- `U校园` 下拉菜单包含：`使用提示`、`进入课程`、`课程学习`。
- `通用` 页的兼容平台列表出现 `U校园`。

### DOM 烟雾测试

使用 `browser-env` 加载编译后的 `collectMenuNodes`：

| DOM 结构 | 识别结果 |
| --- | --- |
| `.pc-slider-menu-*` | 3 个节点，Unit/Section 与完成状态正确 |
| Ant Design Tree | 2 个叶子节点 |
| 旧版 `li.group.courseware` | 2 个节点，Unit 归属正确 |

### 真实账号验证

- 统一认证登录、协议弹窗、极验滑块、登录后跳转均已在真实账号上验证。
- 测试账号下有 2 门已激活课程，课程目录地址与 `.hideurl` 结构已确认。
- 登录态下已确认课程学习页能正常加载并注入 OCS 悬浮窗。
- 测试凭据只用于本地验证，未写入仓库或安装包。

### 版本号

- 应用版本：`1.0.1`（根 `package.json` 与 `packages/app/package.json` 一致）。
- OCS 用户脚本版本：`5.1.0`（`@version 5.1.0`，符合 semver）。
- 仓库中不存在 `test` 版本号；早期调试脚本里的 `version: 'test'` 是本地测试桩，已随临时文件清理。

### Windows 安装包

已使用 electron-builder 23.6.0 + Electron 35.0.0 + NSIS 3.0.4.1 完成打包。**当前为唯一交付版本 1.0.5**：以线上发布 `v1.0.4` 为基线，把 U校园 的全部改动（一键页面、403 自动恢复、内置无二维码助手、一键链路自动化、导航竞态修复、豆包助手直连）合并进这一个版本，不再保留中间版本：

```text
packages/app/dist-release-1.0.5/超星自动机-1.0.5-安装包-x64.exe   285,284,972 字节
packages/app/dist-release-1.0.5/win-unpacked/                     免安装版
```

SHA256：`5efe483312e004c42fb531a9b0f4b1afc9135fb2fdb20b9fce71bead789b5009`
（同目录下 `SHA256SUMS.txt` 可直接校验；安装包未做代码签名，Windows SmartScreen 可能提示。）

历史版本以 GitHub Releases 为准（`v1.0.4`、`v1.0.3`、`v1.0.2`、`v1.0.1`、`v1.0.0`）。本地曾出现的 1.0.6 / 1.0.7 / 1.0.8 是为了排查 403 临时构建的中间产物，已删除，其内容全部包含在 1.0.5 中。

安装包内已确认包含：

- `resources/app/package.json`（版本 `1.0.5`）
- `resources/app/resources/userscripts/unipus-helper.user.js`（U校园刷课助手 内置全功能版 v1.3.11：已删除二维码解锁、解锁码校验、作者远程公告与微信反馈条，GPL-3.0）
- `resources/app/lib/src/services/local-ai.js`（本地 OpenAI 兼容接口，复用「模型接入」模型；健康回包带 `localAi.selected` 供助手跟随；另含豆包直连接口 `/api/local-ai/doubao`）
- `resources/app/lib/src/services/question-bank.js`（`describeSelectedProvider()`：把「模型接入」当前选中的模型以不含 Key 的摘要回传）
- `resources/app/lib/src/services/doubao.js`（内置豆包网关：扫码/手机号/Cookie 登录、`chatDoubao`、`peekDoubaoStatus`）
- `resources/app/lib/src/tasks/startup.server.js`（新增助手脚本/ meta / 健康检查接口）
- `resources/app/public/assets/*`（启动浏览器时自动把 OCS 与助手脚本安装到脚本管理器）
- `resources/app/lib/src/utils/embedded-browser.js`（多 userscript 注入、ucontent 延迟执行、GM API 按脚本隔离、面板防移除护栏、`__ocsLocalAI` 注入、unipus 域下 document-start 预置助手状态）
- `resources/app/public/ocsjs/ocs.user.js`（版本 `5.1.0`，含 U校园 工程、ucontent 延迟启动、`fetch` 修复、词汇/朗读自动完成与检测到助手时让位）
- `resources/app/lib/src/scripts/automation/wk/unipus.js`（一键链路：登录 → 班课列表 → 课程 → 继续学习 → 学习页接管确认；含导航竞态重试与页面稳定等待）
- `resources/app/public/assets/*`（含 U校园 一键页面与「关于软件」更新说明）
- `resources/bin/chrome/chrome.zip`
- `resources/app/vendor/doubao/runtime/doubao-gateway/`
- `resources/app/node_modules/keytar/build/Release/keytar.node`
- `resources/app/node_modules/@ocs-desktop/common/lib/src/utils/electron.js`（worker 线程延迟加载 electron）

## 一键进入课程链路（1.0.5 新增，含 403 恢复）

目标：在软件左侧导航「U校园」页填一次手机号/密码，点「一键开始刷课」，之后登录 → 班课列表 → 课程 → 继续学习 → 学习页 → 助手接管全部自动完成，不再依赖任何二维码/解锁码，也不需要脚本作者的远程服务。

实现由三层协同：

1. `packages/web/src/pages/unipus/index.vue`：新建/复用一个带 automationScripts 的独立空间「U校园一键学习」，保存账号与课程关键词后直接在内嵌浏览器打开。
2. `packages/app/src/scripts/automation/wk/unipus.ts`：脚本名仍为 `U校园-打开课程列表`（保持既有配置兼容），新增 `url / autoLogin / phone / password / courseKeyword / autoEnterCourse / autoStartLearning / loginTimeout / startTimeout`。流程为 goto → 可选自动填表提交 → 预置助手状态 → 若已在班课列表则选课 → 点「继续学习」→ 等 `ucontent` 加载 → 轮询 `#unipus-panel` 并确认日志出现「自动开始刷课」等关键字。滑块/验证码只等待，不尝试绕过：超时后提示用户人工完成一次。
3. 状态预置：`embedded-browser.ts` 的注入运行时在 `unipus.cn` 域下于 document-start 写入 `unipus_panel_open=1`、`unipus_study_purpose_confirmed=1`、`unipus_ai_provider=ocs_local` 与 `unipus_feature_conf`；自动化脚本进入页面后再 `seedHelperState` 兜底一次。

### 本地夹具验证

用 playwright-core + 本地路由拦截模拟 `u.unipus.cn`、`sso.unipus.cn`、`ucontent.unipus.cn` 三页，真实调用编译后的 `lib/src/scripts/automation/wk/unipus.js`：

```json
{
  "elapsedMs": 23265,
  "finalUrl": "https://ucontent.unipus.cn/_pc_default/pc.html#/course-v1:demo/courseware/p_1",
  "seeded": { "panelOpen": "1", "purpose": "1", "provider": "ocs_local" },
  "logs": [
    "正在打开 U校园 ...",
    "找到课程：大学英语（一） 2026秋，正在进入 ...",
    "正在进入课程学习页 ...",
    "已进入课程学习页，正在等待「U校园刷课助手」挂载 ...",
    "助手 v1.3.11 已接管，课程学习已开始。"
  ],
  "errors": []
}
```

### 403 Forbidden（openresty）问题与修复

现象：早期的本地构建在未登录的浏览器里打开 `https://u.unipus.cn/user/student`，页面直接显示 nginx 的默认错误页：

```html
<html><head><title>403 Forbidden</title></head><body bgcolor="white">
<center><h1>403 Forbidden</h1></center><hr><center>openresty</center></body></html>
```

实测（curl 与真实 Chrome 引擎结果一致，与 UA/Referer 无关）：

| 地址 | 未登录时的响应 |
| --- | --- |
| `https://u.unipus.cn/user/student` | `403 Forbidden`（openresty，568 字节） |
| `https://u.unipus.cn/user/student/` | `403 Forbidden` |
| `https://u.unipus.cn/user/comm/login` | 302 → `sso.unipus.cn/sso/login?service=...`，200 并出现账号密码表单 |
| `https://u.unipus.cn/user/index`、`/user/`、`/user/class`、`/user/myclass` | 302 → SSO 登录页 |
| `https://ucontent.unipus.cn/_pc_default/pc.html` | `403 Forbidden`（无会话时） |

也就是说「我的班课」在未登录时不是跳登录而是直接 403，而当时一键页的默认地址正好是它，所以用户看到的就是 403 错误页。

修复内容：

1. 平台默认地址改为登录入口 `https://u.unipus.cn/user/comm/login`（`packages/common/src/platforms.ts`，学习导航书签与一键页的默认值同时生效）。
2. 自动化程序新增 403 识别与恢复：`isAccessDenied()` 按标题/正文识别 openresty 错误页，`recoverFromAccessDenied()` 转到登录入口；班课列表、课程页、学习页三处都会先判断 403 再决定「需要登录」还是「列表为空」。已有用户保存的旧地址（`/user/student`）因此仍可用。
3. 登录后若仍停在中转页而读不到班课列表，脚本会主动打开「我的班课」再等列表；学习页仍 403 时给出明确提示（登录态没有带到 `ucontent.unipus.cn`），不再静默超时。
4. `waitForHelper` 读取日志时增加 `textContent` 兜底，避免元素未布局时把「已开始」误判成「仅挂载」。

修复后的夹具（第一次访问 `/user/student` 返回 403，登录后第二次返回班课列表）：

```json
{
  "elapsedMs": 6515,
  "finalUrl": "https://ucontent.unipus.cn/_pc_default/pc.html#/course-v1:demo/courseware/p_1",
  "studentVisits": 2,
  "seeded": { "panelOpen": "1", "purpose": "1", "provider": "ocs_local" },
  "logs": [
    "正在打开 U校园 ...",
    "目标地址返回 403（通常是尚未登录），正在转到 U校园 登录入口 ...",
    "检测到 U校园 登录页，正在自动填充账号 ...",
    "U校园 登录完成，正在进入我的班课 ...",
    "找到课程：大学英语（一） 2026秋，正在进入 ...",
    "正在进入课程学习页 ...",
    "已进入课程学习页，正在等待「U校园刷课助手」挂载 ...",
    "助手 v1.3.11 已接管，课程学习已开始。"
  ],
  "errors": []
}
```


### 导航竞态修复（Execution context was destroyed）

现象：一键学习偶尔报

```text
自动化程序错误： Error: page.evaluate: Execution context was destroyed, most likely because of a navigation
```

原因：U校园 的跳转比一般站点密集得多——登录入口 302 到 SSO、SSO 提交后回跳、班课列表是 SPA、课程目录再跳 `ucontent`，而且不少页面在 `load` 之后还会自己再跳一次。`evaluate / fill / click` 恰好落在两次导航之间时，Playwright 的上下文被销毁，抛出的正是上面这条错误。旧代码把它当作业务失败直接 `script-error`，于是用户看到报错而不是「继续等待」。

修复（`packages/app/src/scripts/automation/wk/unipus.ts`）：

1. `NAVIGATION_ERRORS` 统一匹配 `Execution context was destroyed`、`Cannot find context with specified id`、`Navigating frame was detached`、`frame was detached`、`Target page, context or browser has been closed`。
2. `retryOnNavigation(task, fallback, tries, delayMs)`：命中上述错误就等待后重试（默认 8 次 × 400ms），非导航错误立即抛出，不会掩盖真实故障。
3. `waitForPageSettled(page)`：地址连续两次不变且 `readyState === 'complete'` 才算稳定；`navigate(page, url)` = `goto` + `waitForPageSettled`，替换了所有手写 `goto + waitForTimeout(1500)`。
4. 所有页面脚本调用都包进重试：`ensurePasswordTab`、`acceptAgreement`、`hasSelector`、`isAccessDenied`、`seedHelperState`、`openCourse`、`enterLearningPage`、`waitForHelper.readSnapshot`，以及登录流程里的 `waitForSelector / fill / click`。

夹具 `fixtures/navigation-race.mjs` 分两层制造竞态：真实层让每类页面加载后自己再跳一次；注入层对每个新地址的第一次 `evaluate/fill` 直接抛 Playwright 原文错误，保证时序每次都命中。

```json
{
  "elapsedMs": 10838,
  "finalUrl": "https://ucontent.unipus.cn/study/1",
  "realNavErrors": 1,
  "injectedNavErrors": 6,
  "fixtureRaces": 5,
  "studentVisits": 2,
  "seeded": { "panelOpen": "1", "purpose": "1", "provider": "ocs_local" },
  "logs": [
    "正在打开 U校园 ...",
    "目标地址返回 403（通常是尚未登录），正在转到 U校园 登录入口 ...",
    "检测到 U校园 登录页，正在自动填充账号 ...",
    "U校园 登录完成，正在进入我的班课 ...",
    "找到课程：大学英语（一） 2026秋，正在进入 ...",
    "正在进入课程学习页 ...",
    "已进入课程学习页，正在等待「U校园刷课助手」挂载 ...",
    "助手 v1.3.11 已接管，课程学习已开始。"
  ],
  "errors": [],
  "started": true
}
```

`realNavErrors: 1` 说明真实 Playwright 竞态确实发生过一次并被重试吞掉，`errors` 为空说明它没有再冒到界面上。

### 助手渲染验证（真实脚本源码，非夹具）

在无头 Chrome 中注入真实的 `unipus-helper.user.js` 并模拟 `GM_*` 接口：

```json
{ "panel": true, "panelDisplay": "flex", "ball": true, "qrImages": 0, "unlockInputs": 0,
  "wechat": false, "announce": 0, "version": "v1.3.11", "builtinBadge": true }
```

- 面板默认展开，二维码图片 0 个、解锁输入框 0 个、微信条与公告栏均不存在。
- `ensureStudyPurposeConfirmed()` 直接返回 `true`，写入 `unipus_study_purpose_confirmed=1`，用途确认浮层 `display:none`，不再插入二次弹窗。
- 题间节奏固定为 1.5 秒 + 0~500ms 抖动（原「未解锁 35 秒」分支已删除）。

### 豆包助手注入（U校园 助手自动接入软件端「模型接入」）

目标：让「超星自动机」里已经配好的模型直接成为 U校园 助手的答题模型——**不要求使用者再配 API Key，也不要求在两边各选一次**，并且不新开版本号。

桌面端新增两个接口（`packages/app/src/services/local-ai.ts`、`tasks/startup.server.ts`）：

| 接口 | 作用 |
| --- | --- |
| `POST /api/local-ai/doubao` | 直接调用内置豆包网关，绕过「模型接入」的模型选择；请求体是 OpenAI 格式的 `messages / model`，响应是标准 `chat.completion` |
| `GET /api/local-ai/health?doubao=1` | 健康探测，附带 `doubao.loggedIn / models / maxPromptLength` 与 `localAi.selected`（「模型接入」当前选中的模型，只含 id/name/model，不含 Key）；不带 `doubao=1` 时只用缓存状态，不会拉起网关子进程 |

- 未登录/网关不可用 → `502` + `error.code = doubao_error` + `error.fallback = ocs_local`。
- 超过豆包 3 万字上限 → `413` + `error.code = prompt_too_long` + `error.fallback = ocs_local`。
- 令牌规则与 `/v1/chat/completions` 完全一致（内嵌令牌或回环地址免令牌）。
- `describeSelectedProvider()`（`services/question-bank.ts`）负责把「模型接入」的选择摘要出来，供健康接口回传。

助手侧（`unipus-helper.user.js`，版本仍为 `1.3.11`）：

1. 新增文本提供商 `doubao_app`「超星自动机·豆包助手」，`local: true` + `doubao: true`，指向 `/api/local-ai/doubao`；`ocs_local` 更名为「超星自动机·跟随软件端」，指向 `/api/local-ai/v1/chat/completions`。
2. `detectLocalAIService()` 探测 `?doubao=1`，把 `loggedIn` 写入 `window.__unipusDoubaoAIAvailable`，把 `localAi.selected` 写入 `window.__unipusDesktopProvider`。
3. `Store.getDesktopProvider()` **完全跟随软件端**：选中的是内置豆包且已登录 → `doubao_app`；选的是别的模型或豆包未登录 → `ocs_local`（由桌面端按「模型接入」转发）。两条链路都不需要助手侧填 Key。
4. 面板在选中本地模型时隐藏整行「文本 AI Key」，并显示「当前跟随软件端「模型接入」：<模型名> · <模型 ID>」；用户手动改选外部平台后不再自动切换（清除 `unipus_ai_provider_auto`），但该项没填 Key 时仍会回到跟随状态。
5. `_callTextAI` 对豆包做了三层兜底：题目超过 3 万字直接走 `ocs_local`；豆包返回非 200、网络错误、超时都退回 `ocs_local`；回退只发生一次，不会递归。`ocs_local` 自身失败时把桌面端 `error.message` 原样抛出，便于区分是 Key 还是额度问题。
6. 顺带修掉一个旧问题：外部 Chrome 里 `ocs_local` 因为没有注入令牌会被判成「未配置 Key」而跳过答题，现在 `__unipusLocalAIAvailable` 也算本地就绪。

夹具 `fixtures/doubao-injection.mjs`（A 单元层从源码抽真实 `_callTextAI` 与 `AI_PROVIDERS`，B 界面层在无头 Chromium 注入真实助手脚本；B 覆盖「选内置豆包+已登录 / 选自定义模型 / 豆包未登录」三种「模型接入」状态）：

```json
{
  "unit": [
    { "name": "豆包正常", "ok": true, "urls": ["http://127.0.0.1:15319/api/local-ai/doubao"], "answers": ["DOUBAO"] },
    { "name": "豆包 413 回退", "ok": true, "urls": ["http://127.0.0.1:15319/api/local-ai/doubao", "http://127.0.0.1:15319/api/local-ai/v1/chat/completions"], "answers": ["LOCAL"] },
    { "name": "豆包网络错误回退", "ok": true, "urls": ["http://127.0.0.1:15319/api/local-ai/doubao", "http://127.0.0.1:15319/api/local-ai/v1/chat/completions"], "answers": ["LOCAL"] },
    { "name": "题目超长直接走内置模型", "ok": true, "urls": ["http://127.0.0.1:15319/api/local-ai/v1/chat/completions"], "answers": ["LOCAL"] }
  ],
  "browser": {
    "豆包已登录_选内置豆包": {
      "selected": "doubao_app",
      "desktopProvider": { "id": "builtin-doubao", "name": "内置豆包", "model": "doubao-fast", "builtinDoubao": true },
      "doubaoAvailable": true, "keyRowHidden": true,
      "followText": "🤖 当前跟随软件端「模型接入」：内置豆包 · doubao-fast，无需在这里填 Key。",
      "healthProbe": "/api/local-ai/health?doubao=1"
    },
    "豆包已登录_选自定义模型": {
      "selected": "ocs_local",
      "desktopProvider": { "id": "self-hosted", "name": "自建 OpenAI 兼容", "model": "gpt-4o-mini", "builtinDoubao": false },
      "doubaoAvailable": true, "keyRowHidden": true,
      "followText": "🤖 当前跟随软件端「模型接入」：自建 OpenAI 兼容 · gpt-4o-mini，无需在这里填 Key。",
      "healthProbe": "/api/local-ai/health?doubao=1"
    },
    "豆包未登录_选内置豆包": {
      "selected": "ocs_local",
      "desktopProvider": { "id": "builtin-doubao", "name": "内置豆包", "model": "doubao-fast", "builtinDoubao": true },
      "doubaoAvailable": false, "keyRowHidden": true,
      "followText": "🤖 当前跟随软件端「模型接入」：内置豆包 · doubao-fast（豆包未登录，暂时走模型接入转发），无需在这里填 Key。",
      "healthProbe": "/api/local-ai/health?doubao=1"
    },
    "panel": true
  }
}
```

未覆盖：真实豆包账号的联网问答（需要人工登录豆包网关），夹具只验证到「请求打到正确端点 + 失败正确回退 + 选择跟随软件端」。

桌面端一侧另用 `fixtures/follow-provider.mjs` 验证 `describeSelectedProvider()` 的真实输出（stub `electron` + 临时 userData，直接 require 编译产物）：

```text
OK   默认选中内置豆包
OK   默认模型 doubao-fast
OK   保存后 selectedProviderId 生效
OK   自定义模型 builtinDoubao = false
OK   自定义模型名与 ID 正确
OK   摘要不含 apiKey
OK   配置里保留内置豆包备用

{ "fresh":  { "id": "builtin-doubao", "name": "内置豆包", "model": "doubao-fast", "builtinDoubao": true },
  "custom": { "id": "self-hosted", "name": "自建 OpenAI 兼容", "model": "gpt-4o-mini", "builtinDoubao": false } }
```

即：首次安装默认 `builtin-doubao / doubao-fast`，选了自定义模型后 `builtinDoubao = false`，且摘要里不含 `apiKey`。

### 本地 AI 链路集成自测（local-ai-server.mjs）

前面两个夹具把「桌面端逻辑」和「助手行为」分开验证；`fixtures/local-ai-server.mjs` 把两者接起来跑**真实 HTTP**：stub `electron` 后加载编译产物 `local-ai.js / question-bank.js`，起一个按 `startup.server.ts` 同样路由分发的 harness 服务（仅补 CORS/PNA 放行头，生产环境请求走内嵌桥或脚本管理器，不受页面 CORS 约束），外加一个 mock 上游 OpenAI 服务充当「模型接入」里的自定义模型后端。

覆盖链路：助手 `_callTextAI` → harness(HTTP) → `handleLocalAi*` → `chatWithSelectedProvider` → axios → mock 上游；豆包侧则真的拉起 `doubao-gateway.exe`。

```text
✅ 跟随软件端（自定义模型转发）  /v1/chat/completions → chatWithSelectedProvider → MOCKUPSTREAM
✅ 豆包超长客户端预检            _callTextAI 客户端直接改走「模型接入」，一次豆包请求都不发
✅ 豆包超长服务端 413            直接 POST 30001 字 → 413 + prompt_too_long + fallback=ocs_local
✅ 豆包未登录 502 回退           真实网关启动（running=true）但未登录 → 502 → 回退「模型接入」→ MOCKUPSTREAM
✅ 健康探测 ?doubao=1            localAi.selected = 自建模型（builtinDoubao=false），doubao.running=true / loggedIn=false
✅ 无头 Chromium（真实网络）     旧数据手动选过 doubao_app 也交回桌面端路由 → ocs_local，
   Key 行隐藏，面板显示「当前跟随软件端「模型接入」：自建 OpenAI 兼容 · mock-model」，0 个失败请求
```

夹具开发期间顺带修掉的问题：Chrome 151 的 Private Network Access 会把「公网源页面 → 127.0.0.1」的 fetch 在预检前直接拦掉，夹具改用 `--host-resolver-rules` 把 `ucontent.unipus.cn` 解析到 127.0.0.1，使文档本身来自 loopback（local→local 允许）。生产环境不受影响：内嵌浏览器的 `GM_xmlhttpRequest` 走 IPC 桥（`embedded-browser.ts`），外部 Chrome 走脚本管理器的特权请求。

### 自测轮次（同一套夹具反复执行）

四条夹具命令（`navigation-race` / `doubao-injection` / `follow-provider` / `local-ai-server`）连续执行三轮，全部退出码 0；`local-ai-server` 每轮都真实拉起一次豆包网关并完整走通转发与回退链路。

### 类型检查

- `pnpm --filter @ocs-desktop/app exec tsc --noEmit` → 0
- `pnpm --filter @ocs-desktop/web exec vue-tsc --noEmit` → 0

### 已知限制

- 滑块/短信验证仍需人工一次；脚本只负责等待与提示。
- `u.unipus.cn/user/student` 与 `ucontent.unipus.cn` 在无登录态时由 openresty 直接返回 403，脚本只能转到登录入口；如果学校网络整体被站点拦截（登录页也 403），需要更换网络。
- 班课列表与「继续学习」按钮的选择器按当前线上 DOM 编写，学校改版后需补充。
- 课程关键词留空时默认进入第一门可进入的课程。

## 尚未覆盖

- OCS 自身的 U校园工程不做作业/测试/考试的自动作答（默认跳过，避免误提交）；此类内容已交由内置「U校园刷课助手」的 AI 作答处理，见 [HELPER.md](./HELPER.md)。
- 语音/词汇作业：`vocabulary` 单词卡/朗读类任务可用 `submitType=2` 标记已看，但需先抓真实请求确认 web 端载荷，详见 [VOICE-HOMEWORK-ANALYSIS.md](./VOICE-HOMEWORK-ANALYSIS.md)。
- U 校园 AI 版（`uai.unipus.cn`）：OCS 仅提供入口提示；刷课助手声明支持 `uai` 域名，实际效果以脚本为准。
- 登录滑块未内置自动破解：需要用户在可见浏览器中完成一次滑块/安全验证。
- 课程目录与播放器可能按学校、课程类型、学期改版，选择器需要根据实际页面继续补充。

## 构建修复

`packages/ocsjs/packages/utils/src/common/script.builder.ts` 的资源解析原来按空格切分 `STYLE <path>`，项目路径包含空格时会把路径截断成目录并报 `EISDIR`。已改为只按第一个空白切分，兼容 `D:\...\chaoxing-auto ZC` 这类路径。

`packages/common` 原来在模块顶层 `import { app } from 'electron'`，worker 线程加载 `@ocs-desktop/common`（U校园自动化程序会导入平台常量）时找不到 `electron` 而崩溃。已改为在 `getElectronApp()` 内延迟 `require('electron')`，worker 只导入平台常量时不再依赖 electron；主进程调用浏览器路径相关函数时仍正常工作。

`easy-us` 的修复通过 `pnpm patch` + `pnpm patch-commit` 保存为 `patches/easy-us@1.0.15.patch`，并登记在 `pnpm-workspace.yaml` 的 `patchedDependencies` 中，重新安装依赖后仍然生效。
