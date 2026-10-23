# OCS Desktop 启动修复记录（2026-10-10）

## 修复结果

Windows 开发模式现可启动 OCS Desktop、内置 Chrome 和 OCSJS 5.1.0 本地脚本服务。路径为空时，启动会自动选择内置 Chrome；已有自定义浏览器路径会保留。

## 发现与修复

1. 首次解压 Chrome 后，开发模式会重启 Electron；重启时 Vite 服务被并发启动流程关闭，导致窗口加载 `http://localhost:3000/` 时报 `ERR_CONNECTION_REFUSED`。开发模式现在解压后继续启动，不再重启；打包模式仍保留初始化后重启。
2. 开发模式 Chrome 改为运行在项目 `bin/chrome/<platform>-<arch>/runtime/` 下，避开用户数据目录中出现的 Windows Side-by-Side 清单加载错误。
3. 浏览器设置存于加密的 `render` 字符串。旧路径迁移把它当普通对象读取，无法迁移。现在先解密设置，再迁移旧路径或补齐空路径，最后按原有加密格式写回。
4. 根目录新增 `chrome:ensure`，启动和构建前检查内置 Chrome 压缩包是否存在。

## 验证证据

- `[V]` `pnpm --filter @ocs-desktop/common tsc` 通过。
- `[V]` `pnpm --filter @ocs-desktop/app exec tsc --noEmit` 通过；`pnpm dev` 内部 app `tsc` 也通过。
- `[V]` `pnpm dev` 启动 OCSJS 5.1.0、Vite `3000`、OCS API `15319`；Electron 主进程和渲染进程均已启动。
- `[V]` 日志确认 Chrome 路径自动设为 `bin/chrome/win-x64/runtime/chrome/chrome.exe`，且首次解压后未触发开发模式重启。
- `[V]` 使用该 Chrome 经 Playwright 访问 `https://www.baidu.com` 和 `https://www.qq.com`，均返回 HTTP 200，页面标题分别为“百度一下，你就知道”和“腾讯网”。
- `[V]` 绕过系统代理直连本地服务：Vite `/`、OCS `/state`、`/api/embedded-ocsjs.user.js`、`/api/embedded-ocsjs.meta.js` 均返回 HTTP 200。
- `[V]` 本次启动未新增 app 错误日志；`error.log` 最后修改时间仍为 2026-10-10 08:28，内容是修复前的 `ERR_CONNECTION_REFUSED`。

## 复现命令

在项目根目录启动桌面端：

```powershell
pnpm dev
```

通过项目内置 Chrome 检查国内站点：

```powershell
Set-Location packages/app
@'
const { chromium } = require('playwright-core');
const path = require('path');
(async () => {
  const executablePath = path.resolve(process.cwd(), '..', '..', 'bin', 'chrome', 'win-x64', 'runtime', 'chrome', 'chrome.exe');
  const browser = await chromium.launch({ executablePath, headless: true, args: ['--no-sandbox', '--disable-gpu'] });
  try {
    for (const url of ['https://www.baidu.com', 'https://www.qq.com']) {
      const page = await browser.newPage();
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log(url, response && response.status(), await page.title());
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
'@ | node -
```

## 回滚与边界

最新的加密设置迁移修改可单独回滚到此前的启动修复状态：

```powershell
Copy-Item -LiteralPath '<备份目录>\ocs-chrome-startup-20261010\packages\app\src\tasks\init.chrome.ts.pre-encrypted-path-fix' -Destination '<项目根目录>\packages\app\src\tasks\init.chrome.ts' -Force
```

其他启动修复前的源码基线位于 `<备份目录>\ocs-chrome-startup-20261010`。项目没有 `.git` 目录，因此没有 Git diff 或提交可用于回滚。当前验证覆盖 Windows 开发模式；打包构建及其他操作系统尚未验证。国内网络检查覆盖百度和腾讯，其他网站仍受各自站点策略和本机网络配置影响。

## 追加修复：OCSJS CommonJS 白屏（2026-10-10）

### 根因与修复

- `@ocsjs/scripts` 是 pnpm workspace 链接包，默认入口 `lib/index.js` 是 CommonJS。Vite 开发服务器把链接包视作源码，直接把含 `exports` 的文件交给浏览器，触发 `ReferenceError: exports is not defined`。
- 在 `packages/web/vite.config.ts` 显式将 `@ocsjs/scripts` 纳入 `optimizeDeps.include`，让 Vite 预构建该 CommonJS 包及其依赖。
- Vite 预构建结果把 CommonJS 导出放在 `default` 下；`packages/web/src/components/OCSConfigs.vue` 现在兼容读取 `default` 和命名空间两种模块形态。

### 验证

- `[V]` 根目录 `pnpm dev` 完成 OCSJS 5.1.0 资源构建，Vite 在 `3000` 端口就绪。
- `[V]` `pnpm --filter @ocs-desktop/web exec vue-tsc --noEmit` 通过。
- `[V]` 使用项目内置 Chrome 加载预构建模块并调用 `definedProjects()`，返回 8 个项目：知到智慧树、超星学习通、智慧职教、职教云、中国大学MOOC、雨课堂、通用、其他；浏览器页面错误列表为空。
- `[V]` Electron 开发进程启动后，`15319` 的 `/state`、`/ocsjs/style.css`、`/api/embedded-ocsjs.user.js`、`/api/embedded-ocsjs.meta.js` 均返回 HTTP 200。
- `[V]` `render.log` 于 09:51 和 09:56 记录渲染初始化；09:40 的 `exports is not defined` 仅为旧错误记录，修复后没有新错误。

### 回滚与边界

恢复这次修改前的文件：

```powershell
Copy-Item -LiteralPath '<备份目录>\ocs-commonjs-filter-20261010\packages\web\vite.config.ts.pre-fix' -Destination '<项目根目录>\packages\web\vite.config.ts' -Force
Copy-Item -LiteralPath '<备份目录>\ocs-commonjs-filter-20261010\packages\web\OCSConfigs.vue.pre-fix' -Destination '<项目根目录>\packages\web\src\components\OCSConfigs.vue' -Force
```

本次验证覆盖 Windows 开发模式；生产打包启动尚未验证。
