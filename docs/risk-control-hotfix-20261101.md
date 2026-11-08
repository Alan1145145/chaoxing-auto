# 风控报错定位与热修（2026-11-01）

面向用户实际使用的 `chaoxing-auto-1.0.8-win-x64.zip`（内置豆包 / WorkBuddy 答题版）。
本文记录：安装包与 GitHub 的核验结论、截图报错的来源、热修内容、验证证据与产物哈希。

## 一、核验结论

| 检查项 | 结果 |
| --- | --- |
| 压缩包内 `chaoxing-auto-1.0.8-setup-x64.exe` SHA-256 | `1f06f912895db63930fd80d0ef45e3284f68b37ffc8e70a53973d4258d1ca61d`，与包内 `SHA256SUMS.txt` 一致 |
| 同一文件的 SHA-512（base64） | `b4/rG7y3vfBQTcljBcn86dNL8NUWkIPGsD73iGa+PZ351ywG08VS7NcZGZeQFUM4qR1oziPTluVcRozWZs62Kg==`，与 `latest.yml` 一致 |
| 文件大小 | 290,785,462 字节，与 `latest.yml` 一致 |
| GitHub Releases 最新版本 | **v1.0.5**（2026-10-28T02:25:12Z 发布，`chaoxing-auto-1.0.5-setup-x64.exe`，SHA-256 `709422a9…f016670`） |
| GitHub 是否存在 1.0.8 | **不存在**。API `repos/Alan1145145/chaoxing-auto/releases` 只返回 v1.0.0–v1.0.5 |
| 压缩包来源判定 | 内部清单自洽（不是下载损坏），但**不是本仓库 GitHub 发布的产物**；其 `安装使用说明.txt` 描述的 WorkBuddy 网关、`cn:glm-5.3-flash` 默认模型，本仓库（1.0.5 线）没有这些模块 |

结论：`1.0.8` 与 GitHub 上的 `1.0.5` 是两条不同的构建线：

- GitHub 1.0.5：OCS + 豆包 + **U校园 助手 / 一键进入**；
- 1.0.8：OCS + 豆包 + **WorkBuddy 网关**，没有 U校园 相关模块（包内 `lib/src/services/local-ai.js` 不存在）。

因此 1.0.8 无法用本仓库源码直接重建；本次采用「从安装包解包 → 热修补丁 → 用 Electron 35 重新打包」的方式交付 1.0.9。

## 二、截图报错的来源

截图文本：

```text
rate limited (风控要求验证: type=verify subtype=semantic_reasoning) [logid=202610110160335F77A3260120557AA1C95]
```

调用链：

```text
OCS 脚本（OCS 内置题库，POST http://localhost:15319/query）
  → startup.server.js  sendQuestionBankQuery
  → question-bank.js    queryQuestionBank
  → model-request.js    callProvider
  → doubao.js           chatDoubao → 本地 doubao-gateway.exe → 豆包网页版
  → 豆包网页版风控返回 429/错误体 { error: { message: "rate limited (风控要求验证...)" } }
  → doubao.js 直接把这段上游原文 throw 出去
  → /query 返回 { code: 0, message: 原文 }
  → OCS 面板红色错误卡片 + 「OCS 内置题库」条目
```

旧代码（`lib/src/services/doubao.js`）：

```js
const message = error.response?.data?.error?.message;
throw new Error(typeof message === 'string' ? message.slice(0, 300) : '豆包请求失败…');
```

也就是说：**不是软件自己的限流，是豆包网页版判定答题请求异常（type=verify / semantic_reasoning）后的风控拒绝**；
旧版把上游原文直接透传，导致这一道题失败，OCS 随即暂停刷课。

## 三、热修内容（1.0.9）

新增 `lib/src/services/provider-resilience.js`（仓库源码同步为 `packages/app/src/services/provider-resilience.ts`）：

1. **错误归类**：`risk`（风控）/ `rate`（限流 429）/ `transient`（超时、断连）/ `fatal`（Key、地址等硬错误）。
   命中 `风控`、`semantic_reasoning`、`type=verify`、`rate limited` 等关键词即判定为风控。
2. **冷却**：风控 180 秒、限流 60 秒，冷却只延长不缩短；冷却期内不再请求该模型，避免「越试越封」。
3. **自动降级**：`answerWithFallback()` 按「当前选中的模型 → 其余已启用模型」顺序尝试；
   风控/限流立即换下一个模型，瞬时错误同一模型重试一次，硬错误直接换下一个。
4. **可读提示**：全部模型不可用时抛出中文提示（含「风控」「模型接入」「重新登录豆包完成验证」），不再只显示上游原文。
5. **请求间隔**：相邻两次模型调用至少间隔 900 ms，降低连续答题触发风控的概率。

接入点：

| 文件 | 改动 |
| --- | --- |
| `lib/src/services/question-bank.js` | `queryQuestionBank()` 改用 `answerWithFallback()`，诊断里记录实际作答模型与 `fallbackFrom` |
| `lib/src/services/doubao.js` | 冷却守卫（冷却中直接快速失败）、调用前 `pace()`、风控/限流识别与中文提示 |
| `lib/src/services/workbuddy.js` | 同样的风控/限流识别、冷却与提示 |
| `lib/src/services/provider-resilience.js` | 新增（如上） |

仓库源码（1.0.5 线）同步修改，`npx tsc -p tsconfig.json --noEmit` 通过：

- `packages/app/src/services/provider-resilience.ts`（新增）
- `packages/app/src/services/question-bank.ts`（`queryQuestionBank` 走降级链）
- `packages/app/src/services/doubao.ts`（冷却守卫、`pace()`、风控提示）

## 四、验证证据

夹具：`docs/fixtures/risk-control.mjs`（可重复执行）。
做法：stub `electron`（app / safeStorage）与临时 userData，直接 require 包内 `question-bank.js`；
起两个本地 HTTP 上游：A 固定返回截图里的风控原文（HTTP 429），B 返回正常答案 JSON。

对 **1.0.8 解包目录**、**1.0.9 安装包解包目录** 与 **本仓库编译产物** 各跑一次，11 项断言全部通过：

```text
PASS classifyFailure 识别用户截图里的风控原文              → risk
PASS 命中风控后仍能答出题                                  → 东方的直布罗陀
PASS 答案来源记录为备用模型                                → mock-ok
PASS 说明本题发生了降级                                    → [{id: mock-risk, kind: risk}]
PASS 风控模型只被请求一次                                  → 1
PASS 风控模型进入冷却                                      → remainingMs ≈ 179100
PASS 冷却期内不再请求风控模型                              → 1
PASS 第二题仍由备用模型作答                                → mock-ok
PASS 全部风控时给出可操作提示                              → 含「风控」「模型接入」
PASS 全部风控时不再直接抛上游原文
PASS 豆包冷却时直接快速失败                                → 内置豆包仍在风控冷却中（剩余 180 秒）
```

结构核验：1.0.9 解包后 `resources/app` 文件数 4462，与 1.0.8 完全相同（仅 4 个 JS 与 `package.json` 版本变化）；
`vendor/doubao`、`vendor/workbuddy`、`resources/bin/chrome/chrome.zip` 均在包内；`keytar.node` 存在；
`package.json` 为 `name: OCS Desktop`、`version: 1.0.9`（`name` 保持不变，用户数据目录仍是 `%APPDATA%\OCS Desktop`）。

未做：GUI 启动实测。安装包 `requestedExecutionLevel` 为 `highestAvailable`，静默启动会弹 UAC，
无法在无人值守环境完成；运行时行为以解包后的代码断言为准。

凭据检查：安装包与解包目录中未写入任何测试账号、密码或 API Key（按测试账号字符串检索命中数 0）。

## 五、产物

| 产物 | 路径 | SHA-256 |
| --- | --- | --- |
| 安装包 | `packages/app/dist-release-1.0.9/chaoxing-auto-1.0.9-setup-x64.exe` | `7493ca30d89eccdfad343723c8d389da4d0224a083ff815bd44065fa6a19e04e` |
| 分发 zip | `packages/app/dist-release-1.0.9/chaoxing-auto-1.0.9-win-x64.zip` | `6b5147f6d9789482f5de67402f16ba2e4d009c513bd11305c3a935487fc55175`（290,818,968 字节） |

`latest.yml`、`SHA256SUMS.txt`、`安装使用说明.txt` 已随目录生成。
1.0.9 **尚未上传 GitHub**；如需发布，另建 tag 并上传 zip/EXE 与校验文件。

## 六、后续建议

- 若豆包风控持续：在「模型接入」中登录 WorkBuddy 作为备用（本版会自动切换），或隔几分钟再继续；
  风控是账号级行为判定，软件侧只能降低触发频率，无法绕过官网验证。
- 本仓库（1.0.5 线）已带同样的韧性逻辑，后续重新构建 U校园 版本时会自动生效。
