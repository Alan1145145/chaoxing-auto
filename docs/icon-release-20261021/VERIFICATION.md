# AI智能学习图标与 Windows 安装包

设计：深绿色圆角底，奶油色展开书页与四角星光。可编辑 SVG 在 packages/web/public/ai-study-icon.svg；PNG 为 1024×1024 RGBA，ICO 包含 16/24/32/48/64/128/256 七种分辨率。

采用代码原生 SVG 设计，Chromium 栅格化，Pillow 编码 ICO；未使用生成式位图。复现命令：在 packages/app 执行 pnpm exec electron ../../scripts/build-app-icon.cjs（本地 Python 需 Pillow）。

替换：应用 EXE 图标、BrowserWindow 图标、网页 favicon、标题栏和侧边栏标记、NSIS 安装/卸载图标与桌面快捷方式名称。BrowserWindow 图标路径改为相对 app.getAppPath() 解析，避免从其他目录启动丢失图标。内部应用标识保持现值，以便读取已有设置。

[V] 验证：app TypeScript、web Vue TypeScript/生产构建通过。打包后 favicon.ico 与设计源 ICO SHA256 一致；从真实 EXE 提取的图标已目视检查（exe-icon-preview.png）。打包 resources/app 的 17 项 Electron/冻结网关离线集成检查通过。生产 CSS 的真实 webview 布局探针在 1280×900 和 700×500 均通过。图标构建脚本 node --check 通过。

发行包包含豆包扫码 Cookie 校验修复与浏览器外层滚动修复。

[V] NSIS x64 安装包生成成功，文件 AI智能学习-2.12.0-安装包-x64.exe，285157396 字节（271.9 MiB）。7-Zip 检验内嵌档案返回 Everything is Ok / exit 0；同时提示档案末尾有额外数据（自解压 EXE 容器），未据此声称已运行安装器。安装 EXE 提取图标已检查。SHA256 记录在 installer.sha256。

[T] 未在用户系统执行安装/卸载流程，避免更改当前安装和正在运行的课程；真实账号登录/答题与课程滚动仍待用户验收。未声明独立审查或 CI。

改动前源文件和旧 favicon 在 before/；旧版本输出保留。回滚可恢复 before/ 同路径源文件并重新构建，或把启动脚本改回 dist-ai-study-scrollfix。未创建 Git 提交，用户未要求。
