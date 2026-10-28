# 自动更新 · 1.0.5

需求：发布新版本后客户端提示，用户点击即可下载、校验、保存数据、安装并重启，无需反复卸载。旧版 1.0.4 的更新器是停用实现，无法接收新功能，需要最后手动覆盖安装一次 1.0.5。

## 实现与依据

- 使用 electron-updater 6.6.2 的 NSIS 下载/校验/安装能力，未自行编写覆盖 exe 的程序。构建保留原 appId、包名及用户数据位置，更新源固定为 Alan1145145/chaoxing-auto 的正式 GitHub Release，禁用原 OCS 更新事件。
- 启动 6 秒后检查、运行期间每 4 小时检查；自动检查失败不弹窗打断课程。发现版本只提示，点击后才下载；支持手动检查、进度、后台下载、取消和重试。同一版本每次运行只自动提示一次。
- 安装前请求主界面保存，等待正确窗口/请求 ID 的成功回复，并同步刷盘 GM 配置。关闭课程及外部浏览器时不调用原先 5 秒强制退出逻辑。保存失败或 20 秒超时不安装；更新安装退出不再被普通关闭拦截器阻止。
- electron-builder 生成 app-update.yml、latest.yml、blockmap；安装包使用固定 ASCII 文件名。发布脚本先校验本地 SHA512/大小、远端源码版本，再上传到草稿并核对 GitHub SHA256，最后公开发布；已发布版本不能直接覆盖。
- 修正 pnpm workspace 对历史 dist 目录的误识别。最终 lockfile 差异为更新器及其依赖，历史安装目录没有进入源码锁定文件。

依据：[electron-builder v26 自动更新文档](https://www.electron.build/v26/docs/features/auto-update/)、本机固定版本 BaseUpdater/NsisUpdater 源码。只新增 electron-updater 运行依赖，沿用现有 Electron、Vue、Playwright、NSIS 和 GitHub CLI。

## 证据与验证

| 证据 | 结果 | 文件 / 路径 |
| --- | --- | --- |
| E1 | [V] 27 项：仅检查不下载、禁止相同/旧/非法版本、并发合并、重复安装阻断、下载失败/保存失败/安装失败、取消与重试 | scripts/test-app-update.cjs |
| E2 | [V] 14 项：真实 Electron HTTP 下载器与 SHA512 校验；损坏文件、503 和降级阻断；保存握手错误窗口/ID、超时、监听清理 | scripts/test-update-transport.cjs |
| E3 | [V] 最终包 8 项界面 IPC：760×440 顶部按钮不覆盖系统按钮；手动检查、稍后、取消/重试、进度、关闭 WebView、保存测试设置，再请求静默安装和重启 | scripts/test-update-ui.cjs |
| E4 | [V] web vue-tsc/Vite、app TypeScript 通过；原浏览器 25 项、模型同步 24 项、布局 17 项、异常回归 6 项通过；原重进浏览器 8 次及延迟回复断言通过。最终包再次通过更新 UI 和浏览器重进回归 | docs/auto-update-1.0.5/*.log（仅本机） |
| E5 | [V] 发布命令实际执行成功，4 个资产的远端大小/SHA256 均匹配后才发布；真实 GitHub 源验证：模拟旧客户端识别 1.0.5 为 available，1.0.5 客户端识别 current，检查过程不下载安装包 | scripts/release-github.cjs / scripts/test-update-release.cjs |

## 源码、风险与回退

修改前文件在本机 before/ 保留；根 package.json 的基线从已发布提交 bffd053615798434d15a223fe0b405500a322e96 读取补存。原 1.0.4 安装包与构建保留。新模块拆分为状态机、Electron 适配层、界面和发布工具，无新增用户数据清理流程。

[V] NSIS 1.0.5 已构建，安装包 285234800 字节，SHA256 `709422a91d6b702d6d7b7050764d1e63791bbf0bb6a07746f55ab9454f016670`。本地发布校验通过，147 个打包 public/lib 文件与编译产物逐字节一致，包内 electron-updater=6.6.2，resources/elevate.exe 与固定仓库 app-update.yml 均存在。

[V] [v1.0.5](https://github.com/Alan1145145/chaoxing-auto/releases/tag/v1.0.5) 已正式发布并设为最新，源码提交及标签指向 `fe8aad1aea67e1a91f76011046b74c7901f1aace`，32 个源码文件的远端 blob 摘要已核对。发布命令实际上传安装包、blockmap、SHA256SUMS.txt、latest.yml，所有资产状态为 uploaded，安装包远端摘要与上述本地值一致。原仓库为 public，客户端不需要 GitHub 登录或 token。最终公开源验证已执行通过。

此轮自行审查，无外部评审或用户验收记录。安装调用在测试中由记录器代替，实际 NSIS 安装和 Windows 权限提示未执行，以免修改当前电脑的安装注册信息和快捷方式；不能将这些测试描述为实际安装成功。非 Windows / 开发环境提供安装版提示。未实测所有课程网站与网络环境。

回退：使用 GitHub v1.0.4，或 packages/app/dist-reentry-fix-20261028/win-unpacked/超星自动机.exe。正式发布前如失败，草稿不会向用户推送；发布后需用更高版本修正，禁止覆盖现有更新清单为旧版本。
