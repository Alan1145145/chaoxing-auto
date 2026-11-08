# U校园 语音/词汇作业自动完成可行性分析

- 日期：2026-10-26
- 参考项目：<https://github.com/Zzj-klwgxdz/UnipusAI>（master，Rust 版）
- 参考版本：`UnipusAI 0.1.0`，许可证 `GPL-3.0-or-later`

## 2026-10-26 实测更新（已完成接入）

在真实账号上完成了抓包与验证，结论比下面的初始分析更明确：

1. **真正可用的是「学习状态上报」接口**：
   `POST /api/mobile/user_group/{courseId}/{groupId}/progress/`
   body：`{"status":1,"rid":"flowengine:studyStatus:1:<groupId>","groupId":"<groupId>","version":"default"}`
   实测对 Vocabulary 任务（`u2g27`）返回 `{"code":0,...}`，随后 `course_progress` 中该任务 `pass` 从 0 变为 1。
2. **参考项目的简化载荷已不可用**：`quesDatas:[] + submitType:2 + openId ...` 在当前 web 端返回 HTTP 601（纯文本），
   说明线上 `/course/api/v3/submit/` 已经要求浏览器同款的 `enable_mistake/version/record_version/state/specific_scores/answers` 结构。
3. **词汇任务不需要录音**：上述 progress 接口不包含任何音频数据，也不是伪造评分，只是复刻页面自身的学习状态心跳。
4. **真跟读/口语仍不可行**：录音与评分走腾讯 SOE（含服务端签名），仍未复刻，也不建议做。
5. 已落地：`packages/ocsjs/packages/scripts/src/projects/unipus.ts` 新增「📚 词汇/朗读自动完成」脚本，
   仅对 `v3vocabulary_pc` 且 `summary.questionsList` 为空的任务生效，作业/测试/口语录音题不会提交。
6. 风控提示：短时间高频抓取后，站点会对部分 API 返回验证页（captcha HTML，HTTP 200）；脚本遇到非 JSON 响应会跳过。

以下为最初的可行性分析，保留作为背景与参考项目证据。

## 结论

`UnipusAI` 的“自动完成语音作业”并不是录音、语音合成或真实口语作答，而是：

1. 识别出 `vocabulary`（单词卡/朗读练习）这类**没有可作答子题**的任务组；
2. 直接向 U校园 提交接口发送 `submitType=2` 的“标记已看”空载荷；
3. 该载荷不包含任何录音数据，但实测可以让任务 `pass=true`。

真正的句子跟读/口语评分走腾讯 SOE WebSocket，仓库明确没有复刻。它只保证任务通过，不产生真实录音，也不产生真实语音评分。

因此，这个思路可以借鉴，但**不能直接把仓库代码搬进本项目**：对方是 GPL-3.0-or-later，本项目是 MIT，直接复制代码会造成许可证冲突。我们只能根据公开的协议行为独立实现。

## 仓库证据

### 1. README 对 vocabulary 的说明

`Readme.md` 第 175-181 行：

> 模块类型为 `vocabulary`（`contents[]` 为单词卡：单词、发音、释义、例句）的题型**无需作答**：
>
> - 浏览器在录完音后最终提交的也是 `submitType=2` 的“标记已看”载荷（不含任何录音数据），经实测单独提交即可 `pass=true`。
> - 程序对这类模块直接走“标记已看”提交（`task` 叶子同样适用）。
> - 录音与语音评测走腾讯 SOE WebSocket（`zt.unipus.cn/soe/*` + `wss://speech.unipus.cn/speech/proxy/wss`，含服务端签名），程序未复刻，也不影响任务通过。

### 2. 标记已看载荷

`src/api/submit.rs` 第 178-189 行：

```rust
pub fn build_mark_seen_payload(session: &Session, group_id: &str) -> Result<String> {
    let s = build_payload_json(
        session,
        group_id,
        Vec::new(),      // quesDatas
        Vec::new(),      // isCompleted
        "[]".to_string(),// thirdPartyJudges
        2,               // submitType
        true,            // hideLoading
    )?;
    Ok(s)
}
```

顶层结构（第 66-77 行）：

```json
{
  "quesDatas": [],
  "groupId": "<groupId>",
  "isCompleted": [],
  "thirdPartyJudges": "[]",
  "submitType": 2,
  "hideLoading": true,
  "associationGroupId": "",
  "courseId": "<courseId>",
  "openId": "<openId>",
  "version": "default"
}
```

### 3. 哪些任务会走标记已看

`src/core/runner.rs` 第 133-136 行：

```rust
// 无可答模块（纯讨论/单词卡朗读/视频弹题等）：与浏览器一致，空 quesDatas + submitType=2 标记完成。
if !has_answerable_module(&group) {
    let payload = build_mark_seen_payload(session, &task.group_id)?;
    return submit_with_rate_retry(session, &payload, reporter, cancel).await;
}
```

`has_answerable_module` 的定义是“存在非 discussion 且有 children 的模块”。`vocabulary` 没有 children，所以被判为不可作答，直接标记已看。

### 4. 语音评测没有复刻

`src/solve.rs` 第 12、28 行：

```rust
// 无子题模块（vocabulary 单词卡朗读、视频弹题、纯阅读材料等）无需作答。
"vocabulary" => Ok(Vec::new()),
```

`Readme.md` 第 181 行明确说明腾讯 SOE 未复刻。仓库的 `AudioRecognizer`（v2.4 Python 版）只做本地 Whisper 转写，用于“根据音频/视频内容回答题目”，不是给朗读作业录音。

### 5. 浏览器前端实际提交方式

从 U校园 `pc.html` 实际加载的 `pc-release-e9e3f488b048bc7e68f6.js` 中可以确认：

- 请求头构造（约第 41097 字节）：

```js
var n = /csrftoken=([\w\d%]+)/.exec(document.cookie);
t.set("X-CSRFTOKEN", n && n[1]);
var i = e.env.EXP ? localStorage.jwtTokeMock : localStorage.jwtToke;
t.set("X-ANNOTATOR-AUTH-TOKEN", i);
t.set("Content-type", "application/json");
t.set("uni-client-ver", "12040");
// appid 从 location.search 的 appid= 参数读取
```

- 内容接口：`/course/api/v3/content/{courseId}/{groupId}/{usageId}/`
- 提交接口：`/course/api/v3/submit/{courseId}/{groupId}/`，POST JSON，`credentials: "same-origin"`
- 朗读组件（`v3Component.js`）会把录音结果写入：

```js
student_answer: {
  payloads: [{
    type: "Audio",
    url: o.audioUrl,
    specific_scores: ...,
    recordDetail: ...
  }]
}
```

也就是说，真正的朗读任务在页面上会先录音、上传音频，再把音频 URL 写进 `student_answer`；而 `vocabulary` 这类任务浏览器最终仍然走“标记已看”。

## 与当前项目的差距

当前 `packages/ocsjs/packages/scripts/src/projects/unipus.ts` 的定位是 DOM 自动化：

- 已处理：课程目录、标签页、视频播放、阅读页停留、自动进入下一节；
- 作业/测试：`isExerciseTask` 命中后默认跳过，关闭跳过后弹窗等待手动完成；
- 未处理：`vocabulary`、单词卡、朗读、跟读、口语任务；
- 未实现：任何 U校园 提交接口调用。

`isExerciseTask` 的正则目前是：

```ts
/(作业|练习|测试|考试|测验|单元项目|讨论|评论|quiz|exam|homework|exercise|project|discussion|comment)/i
```

它不匹配“单词”“朗读”“Vocabulary”，所以这类任务现在会被当作普通阅读页，等待 `readSeconds` 后进入下一节，不会真正完成。

## 可选接入方案

### 方案 A：页面上下文“标记已看”（推荐，低风险）

在 U校园 页面内直接调用提交接口，只对确认属于词汇/朗读的任务生效：

1. 从当前页面 URL、内容接口 URL 或课程数据中取得 `courseId`、`groupId`；
2. 从 `localStorage.jwtToke` 取 `X-ANNOTATOR-AUTH-TOKEN`，从 `document.cookie` 取 `X-CSRFTOKEN`；
3. POST `/course/api/v3/submit/{courseId}/{groupId}/`，body 使用空 `quesDatas` + `submitType=2`；
4. 检查响应 `code === 0` 或任务状态 `pass=true`；
5. 命中限频（`600001`/`600002` 或“操作过于频繁”）时等待 180 秒再重试，最多 5 次；
6. 每个任务只提交一次，提交成功后重新拉取课程进度，再进入下一节。

优点：不依赖录音、不依赖 UI 按钮，和仓库已验证的行为一致。
风险：会影响成绩；必须先抓一次真实请求确认 body 字段和 `version`，不能凭猜测直接提交。

### 方案 B：DOM 点击（更保守）

进入词汇/朗读任务后，尝试点击页面上的“完成/提交”按钮。

优点：不直接调 API，行为最接近用户。
缺点：页面可能要求先录音，按钮不可用；依赖 UI 稳定性，不同课程版本差异大。

### 方案 C：完整语音（不建议）

TTS 合成音频 → 腾讯 SOE WebSocket 上传 → 获取评分 → 写入 `student_answer`。

仓库没有实现，签名和协议都带服务端校验，成本和风控风险都高；即使做出来，音色、语速、环境音也可能被判定异常。不建议纳入本次范围。

## 建议的下一步

先做“只观察、不提交”的 capture 模式，而不是直接上线自动提交：

1. 在真实课程中找到一个 `vocabulary`/单词卡/朗读任务；
2. 用 DevTools 或 Playwright 记录点击“完成”时页面自己发出的 `/course/api/v3/submit/` 请求，保存 URL、headers、body；
3. 对比仓库的 `submitType=2` 载荷，确认 web 端是否需要 `openId`、`version` 用 `"default"` 还是 `publish_version`；
4. 在测试账号上只提交一次，确认返回 `code=0` 且任务变为已完成；
5. 再把该逻辑接入 `unipus.ts`，默认关闭，只对词汇/朗读任务生效。

在完成第 2-4 步之前，不建议把自动提交写进主流程：当前对 U校园 提交接口的 web 端 body 还没有实测样本，直接猜字段可能会提交失败，甚至把任务状态改坏。

## 合规与风险提示

- 自动标记完成会影响课程成绩，应由使用者明确开启并自行承担后果；
- 只对“无评分、无录音要求”的词汇/朗读任务启用，不要扩散到作业、测验、考试；
- 默认关闭，UI 中明确标注“会提交完成状态”；
- 参考项目是 GPL-3.0-or-later，不要复制其源码到本项目；
- 不要把测试账号、cookie、JWT 写入仓库或安装包。
