# 超星自动机 1.0.5 —— 构建与发布

本软件基于 [ocsjs/ocs-desktop](https://github.com/ocsjs/ocs-desktop) 2.12.0 修改（MIT，见 LICENSE、NOTICE.md），是一个 pnpm monorepo：

| 目录 | 内容 |
| --- | --- |
| `packages/app` | Electron 主进程（输出 `lib/`），打包配置 `electron.builder.json` |
| `packages/web` | Vue 3 界面，`vite build` 输出到 `packages/app/public` |
| `packages/common` | 公共 TypeScript 包（输出 `lib/`） |
| `packages/ocsjs` | OCS 用户脚本源码（界面构建时直接引用其 src） |
| `packages/app/vendor/doubao` | 豆包本地网关（Python/Flask），用 PyInstaller 打成独立 exe |
| `scripts` | 构建脚本（内置浏览器下载、豆包网关打包等） |

## 1. 环境要求（Windows 10/11 x64）

- Node.js **>= 22**（实际使用 Node 24）
- pnpm **10**（`package.json` 里的 packageManager 是 pnpm@10.21.0；可以运行 `corepack enable`）
- Python **3.10+**，用来打包豆包网关（实际使用 Python 3.13.9）
- 能访问 npm 镜像和 Chrome for Testing 下载地址（`.npmrc` 里已经把 Electron 镜像设成 npmmirror）

## 2. 安装依赖

```powershell
pnpm install
```

## 3. 内置浏览器（Chrome for Testing 137.0.7151.55）

源码包里**不含** `bin/chrome/win-x64/chrome.zip`（约 170MB，属于下载产物）。运行下面的命令会通过 `@puppeteer/browsers` 下载，
解压到 `.chrome-temp/`，再压缩成 `bin/chrome/win-x64/chrome.zip`：

```powershell
pnpm chrome:ensure
```

## 4. 豆包网关（doubao-gateway.exe）

```powershell
python -m venv .doubao-venv
.\.doubao-venv\Scripts\python.exe -m pip install -r packages\app\vendor\doubao\requirements-build.txt   # Flask、PyInstaller、certifi
pnpm build:doubao        # 即 scripts/build-doubao.ps1，输出 packages/app/vendor/doubao/runtime/doubao-gateway/
```

`.doubao-build/doubao-gateway.spec` 是上次打包时 PyInstaller 生成的 spec，只用来对照；`build-doubao.ps1` 会重新生成它。
最终用户不需要安装 Python。

## 5. 编译与打包（1.0.5）

```powershell
pnpm build:ocsjs                               # 生成内置 OCS JS 及其类型声明
pnpm --filter @ocs-desktop/common tsc           # 生成 packages/common/lib
pnpm --filter @ocs-desktop/app exec tsc         # 先生成主进程及远程方法的类型声明
pnpm --filter @ocs-desktop/web build            # 检查界面类型并构建到 packages/app/public
cd packages\app
pnpm exec electron-builder --config electron.builder.json --win nsis --x64 --publish never --config.directories.output=dist-auto-update-20261028
```

生成的文件：

- `packages/app/dist-auto-update-20261028/chaoxing-auto-1.0.5-setup-x64.exe`（NSIS 一键安装，沿用原有安装注册信息）
- 同目录的 `.exe.blockmap`、`latest.yml`（自动更新必需，文件名不要手工改动）
- `packages/app/dist-auto-update-20261028/win-unpacked/`（免安装运行目录，根目录启动脚本指向此处）

版本号取自 `packages/app/package.json` 的 `version`（软件、安装包名、关于页都用它）。

## 6. 注意事项

- 自动更新只检查 `Alan1145145/chaoxing-auto` 的正式 GitHub Release，原项目更新源保持停用。不使用用户 GitHub token；下载器用更新清单中的 SHA512 校验安装包。
- 发布新版本时递增 `packages/app/package.json` 的 version，重新构建，将源码推送到 main，再从项目根目录执行下方发布命令。仅提交源码不会向用户推送未构建的程序。
- 不要改 `appId`（ocs.enncy.cn）和 `extraMetadata.name`（OCS Desktop）。用户数据目录 `%APPDATA%\OCS Desktop` 和安装注册信息都依赖这两个值。
- 源码包已经去掉：依赖目录、虚拟环境、构建产物、日志、测试浏览器配置（含 Cookie）、截图和备份。
  `packages/app/vendor/doubao/tests/fixture_capture.txt` 里的会话/消息 ID 已替换成假值。
- `packages/ocsjs/packages/*/lib` 是预先构建好的 OCS 脚本库。web 的 vue-tsc 类型检查会通过 `@ocsjs/scripts` 的 types 用到它，所以保留在源码包里。
- `pnpm build:ocsjs` 会重新构建 `packages/web/public/ocsjs/` 下的 OCS 用户脚本；生成目录由 Git 忽略，从 GitHub 获取源码后必须运行。

## 7. 模型接入回归验证

完成上述 OCS、common、app、web 编译后，在项目根目录执行：

```powershell
pnpm exec electron scripts/test-model-provider.cjs
node scripts/test-model-sync.cjs
pnpm exec electron scripts/test-model-capabilities.cjs
node scripts/test-browser-interactions.cjs
node scripts/test-audit-regressions.cjs
node scripts/test-ui-layout.cjs
pnpm exec electron scripts/test-model-response-errors.cjs
node scripts/test-app-update.cjs
pnpm exec electron scripts/test-update-transport.cjs
node scripts/test-update-ui.cjs
node scripts/test-browser-reentry.cjs
```

测试使用隔离的本地配置、HTTP 模拟模型和课程页面；不需要真实 API Key。测试覆盖模型发现、密钥保留、三类协议的思考/联网参数、流式兼容、设置缓存与持久化，以及真实 WebView 的标签、导航、登录隔离、菜单、滚动和拖拽。测试断言数量以每次输出为准，包括不刷新课程页时同步到 iframe。测试配置会生成在 `docs/model-sync-20261027/`，不应提交到 Git。新增浏览器测试证据位于 `docs/model-browser-fixes/`。

## 8. 发布能自动更新的版本

在根目录准备好更新说明文件，确认已登录具备仓库发布权限的 GitHub CLI：

```powershell
pnpm release:github packages/app/dist-auto-update-20261028 docs/auto-update-1.0.5/release-notes.md
```

发布脚本先验证清单版本、安装包文件名/大小/SHA512，并核对远端 main 的版本号；创建草稿，上传安装包、blockmap、SHA256SUMS.txt 和 latest.yml，逐个核对 GitHub 文件大小及摘要后才正式发布并设为最新。失败的上传可重跑命令继续；已正式发布的版本禁止覆盖，应增加版本号重新发布。将来改用对应版本的输出目录和更新说明即可。

先只验证本地文件，可执行：

```powershell
pnpm release:github packages/app/dist-auto-update-20261028 --verify-only
```

用户从 1.0.5 开始具备更新能力；1.0.4 及以前无法凭空增加检查功能，需要手动覆盖安装一次。自动更新不会卸载或清空用户数据。安装前关闭课程窗口并保存设置；保存失败或超时则取消安装，保留当前程序供重试。Windows 如要求安装权限确认，需按系统提示处理。
