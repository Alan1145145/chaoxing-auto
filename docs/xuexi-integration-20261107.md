# 学习强国平台 OCS 兼容（2026-11-07）

基于 GitHub 最新发布版 v1.0.5（超星自动机）新增「学习强国」（xuexi.cn）平台支持，
发布为 **1.0.6**。本文记录真实页面调研结论、实现架构、验证证据与已知边界。

## 一、调研结论（2026-11-07 实测）

### 页面清单

| 页面 | URL | 登录 |
| --- | --- | --- |
| 门户首页 | `https://www.xuexi.cn/` | 不需要 |
| 文章/视频详情 | `https://www.xuexi.cn/lgpage/detail/index.html?id=<itemId>` | 不需要 |
| 我的积分 | `https://pc.xuexi.cn/points/my-points.html` | 需扫码 |
| 扫码登录 | `https://pc.xuexi.cn/points/login.html`（`.qrcode-box`） | — |
| 每日答题 | `https://pc.xuexi.cn/points/exam-practice.html` | 需扫码 |
| 每周答题 | `…/exam-weekly-list.html` → `…/exam-weekly-detail.html` | 需扫码 |
| 专项答题 | `…/exam-paper-list.html` → `…/exam-paper-detail.html` | 需扫码 |

> `exam-practice-list.html` / `exam-detail.html` / `daily-exam.html` 等猜测路径实测 404（notFound 页）。

### 数据接口（全部同源静态 JSON，无需鉴权）

- 门户布局与栏目清单：`GET https://www.xuexi.cn/lgdata/index.json` → `DataSet: ["array-channel!<token>.json", …]`
- 栏目内容：`GET https://www.xuexi.cn/lgdata/<token>.json`，条目形如：
  `{ itemId, title, url: "…/lgpage/detail/index.html?id=…", type: "tuwen" | "shipin" | "juji" | "pdf" | "outerLink", itemType: "kNews" | "kReading" | "kPureVideo" | …, publishTime, thumbImage }`
- 积分接口（登录后由 pc 端 SPA 调用）：`pc-proxy-api.xuexi.cn/delegate/score/today/query` 等（脚本不直接调用，积分以页面展示为准）。

### 答题页 DOM（每日/每周/专项同构）

- 题干类型：`.q-header` 文本以「单选题 / 多选题 / 填空题」开头；填空输入在 `.q-body input`。
- 选项：`.q-answer`（选中追加 `.chosen`）。
- 官方答案提示：点击 `.q-footer .tips` 后，`.line-feed` 内红字（`[color=red]` / `font`）即答案。
- 提交：`.submit-btn`；下一题：`.next-btn`；完成态：`.q-header` 消失且出现 `.ant-btn.action.ant-btn-primary`。
- 滑块验证：`#nc_mask` / `#nc_1_n1z`（阿里 ncpc），脚本不代滑，提示人工完成。

## 二、实现

### OCS 用户脚本（packages/ocsjs/.../projects/xuexi.ts，注册于 src/index.ts）

| 脚本 | 页面 | 行为 |
| --- | --- | --- |
| 💡 使用提示 | 全部页面 | 步骤说明 |
| 🚀 门户调度 | `www.xuexi.cn` 首页（正则锚定 `www\.xuexi\.cn/(index\.html)?([?#]|$)`，避免误命中详情页） | 抓取 lgdata 组「文章+视频交替」队列存 `localStorage.ocs-xuexi-queue`；带 `?autostart=1` 进入时弹出第一篇并直接开始 |
| 📚 阅读与视听 | `lgpage/detail/index.html` | 文章：随机节奏滚动 + 停留（默认 75 秒，可配）；视频：静音自动播放到 `ended`（倍速可配、单视频兜底时长可配）；完成写入 `ocs-xuexi-done-list`（保留最近 500 条），随后弹出队列接续下一篇 |
| 🎯 积分页 | `my-points` / `login` | 检测二维码 → 提示扫码；已登录 → 提示进入答题 |
| ✍️ 自动答题 | 三个答题详情页 | 点击官方「提示」读取红字答案 → 单选/多选精确+字符重合度匹配 `.q-answer`、填空写入 `.q-body input`（多空按提示分隔） → `.submit-btn`/`.next-btn`；官方提示缺失时按配置调用 OCS 题库（`createCommonAnswerer`，走软件「模型接入」）兜底；完成态识别后停止；长时间无题目自动暂停防空转 |
| 🗓️/📄 每周/专项列表 | 两个列表页 | 自动点击本年度「开始答题/继续答题」 |

`play()` 的 Promise 在无源/自定义播放器上可能永远 pending，已用 2 秒竞速处理；
`matches` 在 easy-us 里按 **RegExp 对完整 URL** 测试，所有新增匹配都据此转义锚定。

### 桌面端与 UI

- `packages/common/src/platforms.ts`：新增 `XUEXI_PLATFORM` 并入 `LOCAL_PLATFORM_LINKS`（学习导航自动合并，不与远程书签重复）。
- `packages/app/src/scripts/automation/wk/xuexi.ts`：`XuexiOpenScript`（学习强国-打开学习）——打开门户并附 `autostart=1`（可关）；
  打开 pc.xuexi.cn 时检测二维码并提示扫码；导航竞态按「Execution context destroyed」同款策略重试。
  注册于 `packages/app/src/scripts/index.ts`。
- `packages/web/src/pages/xuexi/index.vue` + 路由 `xuexi`（侧边栏「学习强国」）：预设入口（门户/积分/每日/每周/专项/扫码页）、
  一键开始、运行说明。构建产物随安装包分发。

## 三、验证证据

### 夹具：`docs/fixtures/xuexi-ocs.mjs`（16 项断言，全部通过）

本地 HTTP 服务 mock 学习强国五个页面，`--host-resolver-rules` 把 `www.xuexi.cn`/`pc.xuexi.cn` 指到本地，
`addInitScript` 在每次导航前注入真实构建产物 `ocs.user.js`（GM_* 以 localStorage 桥接，配置按
`<namespace>.<configName>` 预置到秒级时长）：

```text
PASS 门户整理队列并弹出第一篇（剩 3 项）      ["V2001","A1002","V2002"]
PASS 剩余队列文章视频交替                     ["V2001","A1002","V2002"]
PASS autostart 直接跳到第一篇                 …/detail/index.html?id=A1001
PASS 文章 A1001 完成并标记                    4/4
PASS 视频 V2001 完成（ended 后自动继续）
PASS 文章 A1002 完成
PASS 视频 V2002 完成
PASS 队列全部消费完毕                         []
PASS 最终停留在详情页
PASS 三道题都被提交                           tips→提交×3
PASS 单选命中官方提示（旅顺口）               chosen=["旅顺口"]
PASS 多选命中两个官方提示                     chosen=["指南针","造纸术"]
PASS 填空自动填写（上下而求索）               fills=["上下而求索"]
PASS 答题完成态被识别                         true
PASS 积分页扫码提示路径不报错                 true
PASS 无页面级 JS 异常（localStorage 瞬态文档错误除外）
```

夹具过程中发现并修复的两个真实缺陷：

1. `video.play()` 在无源/自定义播放器上 Promise 永远 pending → 学习循环永远等不到开始。已改为 2 秒竞速。
2. easy-us 的 `matches` 是 **RegExp** 语义，`www.xuexi.cn` 会命中详情页 → 门户调度在详情页反复重建队列。已改为锚定正则。

### 真站冒烟（真实门户 + 真实构建产物，无需登录）

```text
landed: https://www.xuexi.cn/lgpage/detail/index.html?id=3692664046110329969&item_id=…
STATE  queue=[shipin:8180666629727623842, tuwen:8516054005886392951]（真实 lgdata 数据）
STATE2 done=[3692664046110329969, 8180666629727623842] queueLeft=0
```

门户整理真实栏目队列 → 自动进入真实文章（8 秒驻留）→ 自动接续真实视频 → 队列清空。

### 构建与注册核验

- `pnpm build:ocsjs` 通过，`ocs.user.js` 含 `@match *://*.xuexi.cn/*` 与「【学习强国】」描述；
- `pnpm --filter @ocs-desktop/web build` 通过（学习强国页面进入产物）；
- `packages/app` `tsc` 通过，编译产物 `AutomationScripts` 含「学习强国-打开学习」（9 个脚本）。

## 四、已知边界

- 积分、答题相关功能都需要「学习强国」App 扫码登录（网页端无账号密码通道）；登录由用户完成，脚本不碰凭据。
- 滑块验证（ncpc）不代滑：出现时提示人工完成，脚本自动继续。
- 官方提示缺失且关闭「无提示时用 OCS 题库（AI）作答」时，脚本暂停等人工；开启时走「模型接入」的模型。
- 每周/专项列表的选择器来自开源实现（ttglad/learning，GPL-3.0）与实测 DOM，若站点改版可能需要更新；
  选择失败时只提示不误点。
- 剧集（juji）类条目按「视频」处理，自动播放当前集；自动连播下一集暂未实现（队列粒度为条目）。


## 六、同步远程 v1.0.5 代码线（2026-11-09）

用户要求以「今天（2026-11-09）的 GitHub 最新版本」为基准。核验：GitHub 最新 release 仍是 **v1.0.5**
（2026-10-28），远程 main HEAD 为 `4e8a25f`（含 v1.0.1→v1.0.5 的官方提交：应用内自动更新、
model-request 架构、设置保留、浏览器修复等），而本地仓库此前停留在 v1.0.0（`983930d`）。

同步方式（git 直连 github.com 被重置，改走 API tarball）：

1. 通过 `api.github.com/.../tarball/main` 取得 `4e8a25f` 源码树；
2. 以 `983930d` 为父提交构造快照提交 `remote-main-snapshot`（远程历史本就是 983930d + 9 个提交，
   快照树 = 远程 main 树，合并基正确）；
3. 本地全部工作先提交存档，再执行真实三方合并，解决 14 个冲突：

| 文件 | 处理 |
| --- | --- |
| app/package.json | 版本保持 1.0.6 |
| pnpm-workspace.yaml | 双方排除规则并集（`!**/dist*/**` + vendor 运行时排除） |
| electron.builder.json | 保留远程的 GitHub publish 配置（应用内更新必需）+ 本地的 `resources/userscripts/**/*` |
| question-bank.ts | 以远程版为基底，重放本地的 `describeSelectedProvider` / `chatWithSelectedProvider` / `answerWithFallback` 降级链（适配远程 `callProvider(provider, prompt, images, maxTokens, searchQuery)` 签名） |
| embedded-browser.ts | 保留本地多脚本注入管线 + 本地 AI 桥，采纳远程「课程框架 did-frame-finish-load 补注入」（以多脚本运行时源拼接的 `state.scriptRuntimeSource` 供其执行）；GM 闭包模板保持本地实测版 |
| web/about、README | 合并双方条目（远程「应用内更新」说明 + 本地 U校园/学习强国条目） |
| web/bookmarks.vue | 取本地版（含平台合并与本地 UI，远程该文件为本地的旧改写） |
| packages/ocsjs/**/lib/*（UD） | 接受远程删除（构建产物不入库） |

4. `pnpm install` 同步依赖 → app `tsc` 通过 → `build:ocsjs` 产出 **v5.1.3** 用户脚本（远程版本号），
   同时包含【学习强国】项目与远程的 edge-minimize/safe-window-drag 等修复 → web/app 构建通过。

回归验证（合并后全量重跑，全部退出码 0）：

- `docs/fixtures/xuexi-ocs.mjs`：16/16（队列/阅读/视频/三题型答题/完成态）
- `docs/fixtures/risk-control.mjs`：11/11（风控冷却+降级，适配远程 model-request）
- U校园四夹具：`local-ai-server` / `doubao-injection` / `follow-provider` / `navigation-race` 全过

合并后 1.0.6 = 远程 v1.0.5 代码线（应用内更新器 + model-request + 浏览器修复）+ 本地全部工作
（学习强国平台、U校园 助手与一键链路、豆包风控韧性层）。安装包重新打包，哈希见 Release 资产
`SHA256SUMS.txt`。应用内更新器指向本项目 GitHub Releases（当前最新 1.0.5 < 1.0.6，不会自我降级）。

## 五、发布

- 版本 **1.0.6**（基于 GitHub v1.0.5 代码线，`package.json` 已同步）。
- 安装包与校验文件见 `packages/app/dist-release-1.0.6/`（`SHA256SUMS.txt` / `latest.yml` / `安装使用说明.txt`）。
