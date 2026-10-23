# BF-BROWSER-SCROLL-01

问题：内嵌课程页滚动时外层桌面布局也可溢出，截图中顶部标题/导航被卷走。

[V] 修改：桌面根改为限定高度的纵向 flex，主区域占剩余高度；工作区及 guest 容器裁切溢出，工具栏不收缩，webview 从剩余高度分配。其他应用页面仍由 workspace-route 滚动，导航保留自己的滚动区域。

[H] 原因：外层缺少溢出边界，主区域使用视口计算高度，webview 缺少明确的零高度 flex 基准，子内容溢出可到达文档根。

文件：App.vue、EmbeddedWorkspace.vue、embedded-browser/index.vue、dew-theme.css、启动脚本。

[V] 验证：Vue TypeScript 与生产构建通过（2237 modules）。probe-layout.cjs 加载生产 CSS 并使用真实 Electron webview 的本地 6000px 长页面，在 1280×900 和 700×500 两种尺寸验证外层 scrollY=0，guest scrollY=700，工具栏/浏览器顶点不变，浏览器底端位于窗口内。未访问真实课程或读取账号。

自查：未在课程网页注入禁止滚动样式，未改变 webview 会话或脚本逻辑；保留前一轮豆包扫码修复。

[T] 真实课程页鼠标滚动体验待用户验收。探针验证程序化滚动与布局，不冒称真实课程交互已测试。

快照：未创建 Git 提交（用户未要求）；before/ 保留修改前四个源文件。回滚：恢复 before/ 同路径文件重建，或将启动脚本改回保留的 dist-ai-study-qrfix 输出。未进行独立人员审查或 CI。
