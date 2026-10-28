# BF-browser-reentry · 1.0.4

用户路径：打开内置浏览器 → 返回列表 → 再次打开后点击失效，系统窗口按钮仍可操作。

## 已验证问题与修复

- [V] 旧代码在 active 变化时同步读取 WebView ID，等待注册回复后无条件调用 WebView.focus()。注入延迟回复后，先返回列表、再放行回复，实际出现 `hash=#/browsers`、`document.activeElement=WEBVIEW`，隐藏网页仍被聚焦一次。回归断言失败：`Delayed activation focuses a hidden guest after returning to the list`。
- [V] 重新进入现在只异步更新当前标签注册，使用 dom-ready 缓存的 ID，在 DOM 更新后执行；移除自动聚焦网页，用户点击网页时按正常浏览器行为获得焦点。晚到回复不再改变焦点。
- [V] 返回普通页面后等待 DOM 更新，再聚焦可见内容容器；再次进入浏览器时取消这次主界面聚焦，避免快速切换抢焦点。没有重建网页、重载课程或清理登录状态。
- [H] 隐藏 WebView 抢焦点与用户描述的窗口按钮仍可操作相符；本地空白主页的普通进出 8 次未复现持续卡死，不将其记录为完整卡死已复现。

参考：[Electron WebView 实现与同步调用说明](https://www.electronjs.org/docs/latest/api/webview-tag)。使用现有 Electron / Playwright 工具，未新增依赖。

## 文件与验证

源码：EmbeddedTab.vue、EmbeddedWorkspace.vue。新增 test-browser-reentry.cjs 覆盖卡片/详情面板进入、返回、同一 WebContents 保留、延迟激活回复、返回后的模型弹窗交互。test-navigation-responsiveness.cjs 扩展菜单、脚本配置与浏览器切回页面检查。测试 bootstrap 可选启用与正式包相同的 Chromium 启动参数。

- [V] 修改前源码保存在本机 before/，原 1.0.3 构建保留。
- [V] 修改前延迟回复断言失败，实际隐藏网页获得焦点；原始记录在本机 docs/model-browser-fixes/reentry-race-before.log。
- [V] 修复后同一故障注入结果为隐藏聚焦 0 次、activeElement=DIV；8 次进出均使用同一 WebContents，返回没有残留详情遮罩。返回后模型弹窗可输入、键盘追加字符成功。
- [V] 菜单切换 30 次、快速切换 20 次、浏览器切回模型弹窗 3 次、课程配置弹窗 3 次通过，无 JS 运行错误；离线资源 ERR_CONNECTION_REFUSED 单独排除，未吞掉 JS 错误。
- [V] web vue-tsc / Vite、app TypeScript 通过。浏览器交互 25 项、模型同步 24 项、小窗口与下拉布局 17 项、已有异常回归 6 项通过。
- [V] NSIS 1.0.4 构建完成；打包资源再次通过 8 次进出、延迟回复、模型弹窗输入与模型同步 24 项回归。keytar 原生模块与 1.0.3 SHA256 一致；构建期间的 EBUSY 未改变该模块。未执行安装程序。
- [V] 安装包大小 284877851 字节，SHA256 `7ada43468d1996cbdadb3f7c336315c11f6bad964d6aa9328475e3cb86faef9c`。
- [T] GitHub 提交和发布结果待上传后补记。

## 风险、自检与回退

不对所有外部课程站点或全部机器声明验证通过；测试使用隔离配置和本地主页，不登录真实课程或调用付费模型。此轮为自行审查，无外部评审或用户验收记录。当前目录没有 .git，GitHub 提交成功后补记摘要。

回退可使用 GitHub v1.0.3，或本机 packages/app/dist-audit-20261028/win-unpacked/超星自动机.exe。发布不会删除原构建。
