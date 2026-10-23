# 超星自动机 1.0.0 发布

日期：2026-10-23。

## 1. 版本号 → 1.0.0
- packages/app/package.json：version 2.12.0 → 1.0.0。electron-builder 用它生成安装包名称和 exe 文件版本，app.getVersion() 也读它。
- 根 package.json：2.12.0 → 1.0.0（只是工作区元数据）。
- 不改：@ocs-desktop/common、@ocs-desktop/web（0.0.1）、ocsjs（5.1.0）这些内部包，其他包按 workspace 版本号引用它们；.release-please-manifest.json 属于原项目发布工具，不改。
- 「关于」页里的“基于 OCS Desktop 2.12.0 修改”是来源说明，不是本软件的版本号，保留。
- init.store.ts：原逻辑是“当前版本 > 已存版本”才补全默认设置。旧数据里存的是 2.12.0，比 1.0.0 大，会导致以后永远不补全；改成“版本不同就补全”（defaultsDeep 只补缺失项），并写回当前版本。

## 2. 关闭在线更新，防止被原版覆盖
- app 主进程：启动后不再执行 updater()。updater() 不再联网；updateApp() 不再下载/删除/解压任何文件，只弹窗说明“已关闭在线更新”。
- 渲染层：ipc.ts 不再弹出「检测到版本更新 / 确认更新 / 下次一定」；帮助菜单「原项目更新日志」（读取原项目服务器版本列表并引导下载原版）改为本地「版本信息」窗口。
- 初始化向导（Setup.vue）：没找到可用浏览器时，原逻辑会从原项目服务器下载“最新版本软件”的安装包并直接运行（相当于装上原版）。现在改成提示用户选择软件内置浏览器或重新安装本软件。
- 远程语言包（cdn.ocsjs.com/api/ocs-app-langs.json）：停用，并清空已缓存的语言包，所有文字都用本地默认值（原文字里有“前往官网下载最新OCS软件”等提示）。
- 保留（功能需要，且不会替换程序文件）：ocs-app-infos.json 里的资源列表（应用中心的脚本管理器拓展、用户脚本下载，下载到 userData/downloads）和官方书签；OCS 用户脚本的版本同步。worker 默认文字里的“去官网下载最新 OCS 软件”改为“重新运行超星自动机安装包”。
- 教程：删除「检测到版本更新 → 点下次一定」那条，改成“已关闭在线更新，手动安装新安装包”；NOTICE_ID 改为 chaoxing-auto-tutorial-1.0.0。
- 「关于」页增加 1.0.0 更新说明。

## 3. 发布安装包
- 输出到新目录 packages/app/dist-release-1.0.0，不覆盖正在运行的 dist-chaoxing-release；启动新版.cmd 改为指向新目录。
- 扫描打包后的 resources（asar=false，所以扫的是 resources/app 目录）、extraResources（bin/chrome）、vendor/doubao 里有没有 cookie、sessionid、token、手机号、密码、API Key、开发机路径和用户数据，发现就排除。
- 安装方式：NSIS 一键安装、按用户安装（%LOCALAPPDATA%\Programs\超星自动机，不需要管理员）；requestedExecutionLevel=highestAvailable（普通用户直接运行，管理员账户会弹 UAC）。
- 验证：先关闭旧程序；用 /S /D= 把真实安装包静默安装到临时目录，用独立的 --user-data-dir 启动，确认版本是 1.0.0、豆包二维码能显示；然后卸载、清理。不碰 %APPDATA%\OCS Desktop。

## 4. 源码包 / 5. 发布目录
<工作目录>\超星自动机-1.0.0-发布\：安装包 + SHA256 + 超星自动机-1.0.0-源码.zip（附 BUILD.md）。
