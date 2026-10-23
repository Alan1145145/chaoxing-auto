# 更名「超星自动机」+ 关于页 + 本地公告：验证记录

日期：2026-10-23。状态：已构建并启动，待用户界面验收。

## 构建（复现 dist-ai-study-release 的方式）

脚本：build.ps1（本目录），日志：build.log。

1. pnpm --filter @ocs-desktop/web build（vue-tsc --noEmit + vite build，输出到 packages/app/public）
2. pnpm --filter @ocs-desktop/app exec tsc
3. 在 packages/app：pnpm exec electron-builder --config electron.builder.json --publish never --config.directories.output=dist-chaoxing-release

未运行测试套件（按要求）。未重建豆包网关（未改动 vendor/doubao）。

## 结果

- [V] web 类型检查 + 生产构建通过；app tsc 通过；electron-builder 23.6.0 打包通过（10:02–10:04）。
- [V] 新 EXE：packages/app/dist-chaoxing-release/win-unpacked/超星自动机.exe（FileDescription/ProductName = 超星自动机）。
- [V] 安装包：packages/app/dist-chaoxing-release/超星自动机-2.12.0-安装包-x64.exe，285167817 字节；SHA256 见 installer.sha256。未运行安装器。
- [V] resources/app/package.json：name 仍为 "OCS Desktop"，无 productName 字段 → 用户数据目录仍为 %APPDATA%\OCS Desktop，未新建 %APPDATA%\超星自动机。
- [V] resources/app 中包含 LICENSE、NOTICE.md；public/index.html 的 <title> 为 超星自动机；主进程 window.js 标题为 超星自动机。
- [V] 打包后的前端 JS 不再包含 cdn.ocsjs.com/articles/app/guide.md（远程教程），远程公告/横幅不再请求。
- [V] 关闭旧版 OCS Desktop（以管理员身份运行，需提权关闭，脚本 switch-to-new.ps1，日志 switch.log），通过「启动新版.cmd」启动新版：
      进程名 超星自动机，窗口标题「超星自动机 · 学习概览」；豆包网关随之启动；当日 error.log 无新增记录；updater 未检测到更高版本。
- [T] 「关于软件」页面、公告弹窗、教程弹窗的视觉效果与链接点击待用户在界面中验收。

## 回退

before/ 保存改动前的同路径文件（含两个 .cmd）。恢复这些文件并重新构建即可；或直接把两个 .cmd 改回
packages\app\dist-ai-study-release\win-unpacked\OCS Desktop.exe（旧输出原样保留）。未创建 Git 提交（项目无 .git）。
