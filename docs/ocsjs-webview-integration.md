# 内嵌浏览器集成 OCSJS 5

主项目把 `ocsjs-5.0` 源码放在 `packages/ocsjs`，并由 Desktop 构建流程生成本地 OCSJS 用户脚本。目录名是 `ocsjs-5.0`；当前副项目根 `package.json` 的版本为 `5.1.0`。

## 构建和运行

在 `ocs-desktop-main` 根目录执行：

```powershell
pnpm install
pnpm build:ocsjs
```

`pnpm build:ocsjs` 编译 OCSJS 的 `@ocsjs/core`、`@ocsjs/scripts` 和 `@ocsjs/utils`，生成用户脚本、元数据和样式文件。生成文件位于 `packages/web/public/ocsjs`，并复制到 `packages/app/public/ocsjs`；这些文件由 `.gitignore` 忽略。

桌面端开发可使用：

```powershell
pnpm dev
```

完整桌面构建使用：

```powershell
pnpm build
```

`pnpm tsc` 会先运行 OCSJS 本地构建，因此从干净安装状态也能解析本地 workspace 包。

## 内嵌浏览器如何使用 OCSJS

设置面板直接从本地 `@ocsjs/scripts` 和 `easy-us` workspace 包加载配置；样式从应用本地 `/ocsjs/style.css` 读取。内嵌浏览器的“更新脚本”会把 OCS 官方脚本地址切换到 Desktop 提供的本地脚本和元数据端点：

| 端点 | 用途 |
| --- | --- |
| `/api/embedded-ocsjs.user.js` | 向脚本管理器提供本地 OCSJS 用户脚本 |
| `/api/embedded-ocsjs.meta.js` | 提供版本元数据，供更新检查使用 |
| `/ocs-environment` | 识别当前页面是否位于已注册的 Electron WebView |
| `/ocs-script-actions` | 将 OCSJS 5 的 Playwright 操作转发给对应 WebView |

```mermaid
flowchart LR
    source[packages/ocsjs 源码] --> build[pnpm build:ocsjs]
    build --> bundle[本地 OCSJS 5 用户脚本]
    bundle --> manager[内嵌浏览器中的脚本管理器]
    manager --> webview[Electron WebView]
    webview --> bridge[Desktop Playwright 桥接]
```

内嵌浏览器仍通过已安装的 ScriptCat 或 Tampermonkey 执行用户脚本；扩展负责提供 `GM_*` 授权 API。OCSJS 脚本代码和配置包由主项目本地构建提供，不再从 `cdn.ocsjs.com` 获取。

## 已知支持边界

Desktop 桥接支持 OCSJS 5 当前使用的点击、输入、选择、键盘、鼠标、截图、等待元素和网络请求/响应操作。`setInputFiles` 仍会返回“不支持由自动化脚本设置本地文件”的错误。

更新副项目源码时，将 OCSJS 源码同步到 `packages/ocsjs`，保留 `package.json` 中的 `build:desktop` 入口和 `scripts/build-style.js` 中按 workspace 解析 `easy-us` 样式的处理，然后重新运行 `pnpm install`（仅依赖变更时）和 `pnpm build:ocsjs`。
