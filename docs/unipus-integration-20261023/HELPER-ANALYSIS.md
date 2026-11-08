# U校园刷课助手 v1.3.8 强行解析与「为什么 OCS 正常弹出、助手不弹」根因报告

日期：2026-10-26（2026-10-28 补充 1.3.11 内置全功能版）
对象：`packages/app/resources/userscripts/unipus-helper.user.js`（作者 叶屿，GPL-3.0，本地构建版本 1.3.11）
对照：OCS 用户脚本（`packages/ocsjs`，本地构建 5.1.0）与桌面端注入管线（`packages/app/src/utils/embedded-browser.ts`、`packages/web/src/utils/user-scripts.ts`、`packages/app/src/worker/index.ts`）

## 一、结论摘要

助手脚本本身没有“不会弹”的代码缺陷：在真实 ScriptCat + 真实登录态下，`#unipus-ball` 与 `#unipus-panel` 都成功创建，日志输出「主页面已初始化（ucontent）」。真正导致用户看到“不弹 / 弹出后被收回”的是三个工程问题：

1. **面板被脚本自己收回**：自动开始刷课时执行 `panel.style.display='none'`，把刚弹出的面板收起成悬浮球（v1.3.8 原始逻辑）。
2. **脚本可能根本没装上**：ScriptCat 一次只处理一个安装页。软件同时打开 OCS 与助手的 `.user.js` 时，其中一个请求会被忽略；旧安装逻辑 2 秒就强制关页，也可能把更新中断。
3. **安装后没有刷新页面**：ScriptCat 不会向已经打开的标签页补注入 userscript，课程页在安装前打开就一直“无脚本”。

此外还有两个显示/兼容问题一并修复：悬浮球与 U校园 右下角自带悬浮按钮位置重叠（视觉上易被当成站点按钮）；ScriptCat 沙箱里 `window.__unipusPanel` 不在页面主世界，OCS 的让位检测改为同时检查 DOM。

## 二、脚本结构解析（v1.3.8 原始版本）

单文件 IIFE，约 6978 行，模块按对象字面量组织，没有构建步骤。主要分区：

| 行号（v1.3.8） | 模块 | 作用 |
| --- | --- | --- |
| 1–28 | UserScript 元数据 | `@match` ucontent/ipub/uai/u.unipus.cn，`@run-at document-end`，`@noframes false` |
| 130–139 | 环境判定 | `IS_IPUB` / `IS_UCONTENT` / `IS_LEGACY` / `IS_IFRAME` / `IS_MAIN` |
| 151 | `Config` | 版本、等待时间、题目延迟、存储 key、公告/验证地址 |
| 200+ | `Utils` | sleep、safeText、poll、safeClick、HTML5/指针拖拽、格式化 |
| 387 | `Store` | localStorage 配置、AI Key、解锁凭证、跨 iframe 配置导入导出 |
| 590+ | `AI_PROVIDERS` | DeepSeek（文本）、Qwen3-Omni-Flash / GLM-4-Voice（音频多模态） |
| 665+ | `Solver` | 题型识别（单选/多选/填空/听力/阅读/翻译/写作/完形/听写/匹配/排序）、题目 DOM 提取、AI 调用、答案写入、拖拽 |
| 2400+ | `Player` / 媒体 | 视频/音频播放控制、媒体状态、换源与结束判断 |
| 4927 | `IframeRPC` | 父页面（ipub）与 ucontent iframe 之间的 postMessage RPC（菜单扫描、指令、日志） |
| 5751 | `Panel` | 悬浮球、控制面板、设置/用途确认浮层、公告、解锁 UI |
| 6143 | `Panel.createBall` | 创建 `#unipus-ball`，挂到 `document.body` |
| 6162 | `Panel.createPanel` | `innerHTML` 构建 `#unipus-panel`，挂到 `document.body` |
| 6940 | `Panel.init` | 写 `window.__unipusPanel`、创建悬浮球、按 `Store.getPanelOpen()` 决定是否展开面板 |
| 6972 | 入口分支 | iframe 子页 → `setupIframeChild()`；主页面 → `initMainPage()` |
| 7055 | 主页面初始化 | `document.readyState === 'loading'` 时等 `DOMContentLoaded`，否则立即初始化 |

### 弹出链路（原始）

1. `@run-at document-end`：DOM 就绪后执行整个 IIFE。
2. 顶层判断 `IS_MAIN`（非 iframe 且是 ipub / 旧版 / ucontent）。
3. `initMainPage()` → `Panel.init()` → **无条件创建悬浮球**；只有 `Store.getPanelOpen()` 为真时才创建面板。
4. 自动开始流程：扫描目录 → 弹出用途确认 → 自动开始前执行
   ```js
   if (Panel.panelEl) Panel.panelEl.style.display = 'none';
   Store.setPanelOpen(false);
   ```
   即“面板弹出 → 被收回成球”。
5. `#unipus-ball` 样式：`position:fixed; bottom:24px; right:24px; z-index:99999`。

## 三、OCS 的弹出链路（对照）

OCS 之所以稳定：

- `packages/ocsjs/packages/scripts/entry.js` 对 `ucontent.unipus.cn` **延迟到 `document.readyState === 'complete'` 才调用 `start()`**，避开页面 `document.write`/鉴权阶段。
- easy-us 的 `mount()` 被 patch 为只在 `complete` 后挂载，且 `CustomWindow.mount(parent)` 对空 body 做 `append` 兜底（`patches/easy-us@1.0.15.patch`）。
- OCS 面板挂载后**没有自动隐藏逻辑**，只在用户点击最小化时收起。
- 面板使用 closed shadow DOM，内部节点不受站点 CSS 影响；挂载位置是 `body` 随机子节点后插入。
- 外部 Chrome 路径由软件启动浏览器时把 OCS 加入脚本列表并安装到 ScriptCat（`packages/web/src/utils/user-scripts.ts` + `packages/app/src/worker/index.ts`）。

对比结论：OCS 的“弹出”是一次性的、完成即保持；助手的“弹出”是条件式的（面板默认不展开）且会被自动开始主动收回。

## 四、真实环境复现与证据

环境：用户真实浏览器配置副本（含 ScriptCat 与已安装脚本）+ 真实账号登录 + 真实 `zh2+202202` 课程页。

### E1 脚本确实在运行

- ScriptCat 存储（`Default/Extension Scripts/*.ldb`）中可检索到「OCS 网课助手」「U校园刷课助手」。
- 页面控制台日志：
  `[U校园助手] 🌐 环境: ucontent` → `[U校园助手] 📦 iframe 数量: 1` → `[U校园助手] 主页面已初始化（ucontent）`
- MutationObserver 记录：`#unipus-ball` 在 442ms 挂到 BODY，`#unipus-panel` 在 3519ms 挂到 BODY。

### E2 面板被自动收回（主因）

同一时间线中，自动开始日志出现后 `getComputedStyle(#unipus-panel).display === 'none'`，且连续 88 秒无 remove 事件——节点仍在，只是被隐藏。这与用户描述的“弹出后又被收回”完全一致。

### E3 ScriptCat 安装竞态（“不会弹出”的另一主因）

- 单独安装助手：安装页出现、点击安装、页面关闭，成功。
- 单独安装 OCS：同样成功。
- 同时打开两个 `.user.js`：只出现一个安装页，另一个请求被忽略（助手优先时助手丢失，OCS 优先时 OCS 丢失）。
- 串行安装（装完一个再触发下一个）：两个安装页依次出现并点击成功。

### E4 安装后未刷新

ScriptCat 只在文档加载时注入 userscript；已打开的课程标签页不会因为“刚刚安装”而补注入。用户安装完 1.0.4 后未刷新页面，是当时仍显示「暂无数据/不弹」的直接原因之一。

### E5 悬浮球位置

- 原位置 `bottom:24px; right:24px` 与 U校园 右下角自带悬浮按钮处于同一区域。
- 实测 `document.elementFromPoint` 在球中心命中的仍是 `#unipus-ball`（z-index 99999 足够），因此**不是点击被遮挡**；但视觉上两个圆钮高度重合，容易被误认成站点按钮而“没看见”。
- 新位置 `bottom:96px` + `z-index:2147483647`，球中心仍命中自身，且与站点按钮错开。

### E6 沙箱兼容

ScriptCat 沙箱内 `window.__unipusPanel` 不暴露到页面主世界，OCS 原检测失效。已改为同时检查 `#unipus-ball` / `#unipus-panel` DOM，真实页面上 OCS 学习流程能正确让位。

## 五、重构与修复（保证核心功能不变）

没有对整个 7000 行脚本做重写，而是把**显示/生命周期层**从核心逻辑中剥离出来做“定点重构”，solver、播放器、RPC、AI 调用完全未改：

1. 悬浮球：`bottom:96px`、`z-index:2147483647`；面板 `bottom:164px`、`z-index:2147483646`；浮层层级同步提升。
2. 自动开始不再隐藏面板：删除 `display='none'` 与 `setPanelOpen(false)`，改为保持展开（`Store.setPanelOpen(true)`）。
3. 防移除看护：`Panel.init()` 内用 MutationObserver 记录 `#unipus-ball`/`#unipus-panel`，脱管后 1.5 秒挂回 `document.body`；内嵌浏览器注入层也有同样的 keep-alive。
4. 版本/身份元数据：脚本内部 `Config.version` 与 `@version` 统一为 1.3.10，`@name` 保持不变（ScriptCat 用 name+namespace 识别更新，改名会被当成新脚本）。
5. 安装链路：软件端 `initScripts` 改为串行安装 + 等页面自然关闭（最多 8 秒）+ 处理二次确认，避免脚本被漏装或更新被强制中断。
6. 外部 Chrome 的本地模型桥：`window.__ocsLocalAI`/`/api/local-ai/health` 自动探测，默认模型「超星自动机·内置模型」。

### 为什么不整体拆文件重写

- 脚本是 GPL-3.0 第三方单文件，没有测试；solver/播放器/RPC 与站点 DOM 强耦合，重写风险远大于收益。
- 本次故障域完全在“显示层 + 安装链路”，定点修复即可闭环，并已用真实环境验证。
- 若后续要做完全模块化，建议按：`env/lifecycle`、`panel-host`、`solver`、`player`、`iframe-rpc`、`ai-provider` 六个模块拆分，先补 DOM 快照测试再迁移；本次已把 `panel-host` 的边界（创建/可见性/防移除）独立出来，可作为第一步。

## 六、最终验证（1.3.10 + ScriptCat）

在真实 ScriptCat 中把已安装的 1.3.8 更新到 1.3.10（更新页显示 `1.3.8 → 1.3.10`，点击「更新」后页面自然关闭），随后登录真实课程页：

- 悬浮球：`pos=[1202,570]`（新位置），球中心 `elementFromPoint` 命中 `unipus-ball`。
- 面板：自动开始刷课日志出现后 `display:flex`，保持展开；面板标题显示 `v1.3.10`。
- 防移除：手动删除悬浮球/面板后均被自动挂回。
- OCS：同一页面 OCS 面板正常显示，学习流程按 DOM 检测让位。

## 七、1.3.11 内置全功能版：移除二维码、解锁码与远程公告

目标：不再依赖第三方作者的更新与服务，脚本随软件发布即为完整功能；用户看不到任何扫码/付费/公告元素。

删除清单（全部在 `packages/app/resources/userscripts/unipus-helper.user.js` 内）：

| 项 | 原实现 | 处理 |
| --- | --- | --- |
| 元数据付费声明 | `@antifeature payment` | 删除 |
| 远程域名声明 | `@connect qsy.iano.cn` | 删除 |
| 二维码图片 | `Config.qrImageUrl = 'https://qsy.iano.cn/yzm.png'` | 删除字段 |
| 解锁校验接口 | `Config.verifyUrl = 'https://qsy.iano.cn/api/verify'`、`Solver.verifyUnlockCode()` | 删除字段与方法 |
| 远程公告 | `Config.announceUrl`、`_fetchAnnounce()`、`_renderAnnounce()`、公告栏 DOM/CSS | 全部删除 |
| 解锁状态 | `Store.isUnlocked()` 读本地 proof | 改为恒 `true` |
| 题间延迟 | 未解锁 35 秒 / 解锁 1.5 秒 | 统一 `1500 + random(0~500)` 毫秒 |
| 面板解锁区 | `.up-qr-box`、`.up-unlock-input`、`.up-unlock-status`、解锁按钮/链接 | 删除，替换为一行「内置全功能版」说明 |
| 微信反馈条 | `.up-wechat-*` 与复制微信号处理器 `C919irt` | 删除 |
| 用途确认弹窗 | 每次启动强制弹 `ensureStudyPurposeConfirmed()` 浮层 | 改为直接记录已确认并返回 `true`；原流程保留在 `_legacyEnsureStudyPurposeConfirmed()` |

保留不变：`@name`（ScriptCat 用 name+namespace 识别更新，改名会被当成新脚本）、solver/播放器/RPC/AI 调用、`ocs_local` 内置模型接入、悬浮球与面板的位置与防移除逻辑。

验证（无头 Chrome 注入真实脚本源码，模拟 `GM_*`）：

```json
{ "panel": true, "panelDisplay": "flex", "ball": true, "qrImages": 0, "unlockInputs": 0,
  "wechat": false, "announce": 0, "version": "v1.3.11", "builtinBadge": true }
```

`node --check` 通过；安装包内的 `resources/userscripts/unipus-helper.user.js` 复核为 `@version 1.3.11`，`up-qr-box / up-unlock-input / C919irt` 命中数为 0（仅文件头历史更新日志里还留有上游 v1.1 的说明文字）。

## 八、遗留风险

- ScriptCat 更新已打开的标签页仍需刷新，这是脚本管理器机制，不是脚本缺陷。
- 站点若改版右下角布局或引入更高层级的全屏浮层，悬浮球仍可能需要再调位置。
- 助手作者后续若发布 1.3.9+ 官方版本，需要重新合并本地修改（已用文件头注释标注修改点）。
