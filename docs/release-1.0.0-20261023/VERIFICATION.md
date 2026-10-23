# VERIFICATION —— 超星自动机 1.0.0（2026-10-23，东京时间）

## 构建
- `pnpm --filter @ocs-desktop/web build`（含 vue-tsc）退出 0；`pnpm --filter @ocs-desktop/app exec tsc` 退出 0。
- electron-builder 23.6.0 → `packages/app/dist-release-1.0.0`（build.log、build2/3/4.log；最后一次加了 `extraMetadata.author`）。
- `"publish": null` 之后 resources 里不再生成 app-update.yml（原来指向 github ocsjs/ocs-desktop），也不再生成 latest.yml。

## 版本
- 安装后的 exe：FileVersion 1.0.0、ProductName 超星自动机、CompanyName alan34。
- 卸载注册表项：DisplayName 超星自动机、DisplayVersion 1.0.0、Publisher alan34。
- 打包后的 package.json version 是 1.0.0；全新 profile 的 config.json 里 "version" 是 "1.0.0"。
- 「关于」页显示「版本 1.0.0」：在只差发布者元数据的上一版构建中用 CDP（probe-release.cjs）读到；最终构建核对的是 exe 元数据和打包后 package.json 的 version（app.getVersion() 读取的就是它）。

## 在线更新
- 全新 profile 启动后，界面上没有出现「检测到版本更新 / 确认更新」；教程中已没有「下次一定」。
- web 产物里没有 ocs-app-langs、下次一定；lib/src/tasks/updater.js 里没有 axios/download/getInfos/rmSync/AdmZip。

## 敏感数据扫描（scan_package.py，结果见 scan-final.txt）
- 扫描范围：win-unpacked\resources（asar=false，所以是 resources\app 目录，含 node_modules、vendor\doubao\runtime、bin\chrome\chrome.zip 的文件列表）。共 4273 个文件。
- 未发现开发机路径/用户名、Cookie 值、API Key、Bearer Token、私钥、手机号、密码。命中的都是第三方库代码里的变量名（node-forge/playwright 的 sessionId、arco 的 type:"password"）和 certifi 公共根证书。
- vendor/doubao/tests（含 fixture_capture.txt）、.env、__pycache__ 都不在安装包里（files 里只打包 runtime/doubao-gateway）。网关 PYZ 共 575 个模块，没有 tests，co_filename 是相对路径，没有开发机路径。
- chrome.zip 只有 win64-137.0.7151.55 目录（Chrome for Testing），没有浏览器配置文件。

## 干净环境安装测试
- 先用一次 UAC（switch-to-new.ps1）关闭旧程序；没有发现已安装的旧版注册信息。
- 以 RunAsInvoker（模拟普通用户、不提权）执行 `安装包 /S /D=%TEMP%\cxi\超星自动机`：退出 0，用时约 19 秒，没有 UAC；
  只写 HKCU（没有 HKLM 项）；创建了桌面和开始菜单快捷方式。
- 已安装的 exe 用独立的 `--user-data-dir=%TEMP%\cxi\userdata` 启动：窗口标题「超星自动机」；首次运行弹出「使用教程」和「初始化软件设置」；
  内置 Chrome 解压到测试 profile；豆包扫码结果 QR_OK（弹窗「等待扫码」，截图 release-probe.png）；网关日志在测试 profile 里。
- 静默卸载（`Uninstall 超星自动机.exe /S /currentuser`）：退出 0；安装目录 0 个文件残留；卸载注册表项和快捷方式都已删除；临时目录已删除。
- 整个测试前后对 %APPDATA%\OCS Desktop 做了快照（378 个文件的大小和修改时间），没有变化。
- 局限：测试是在开发机上用独立 profile 和临时安装目录做的，不是一台真正全新的 Windows；没有在标准用户账户/无管理员权限的电脑上实测
  （manifest 是 highestAvailable：标准用户直接运行；管理员账户每次启动会弹 UAC）。
