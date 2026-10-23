# BF-DOUBAO-QR-01

问题：手机确认扫码后，回跳收票报缺少 d_ticket、s_v_web_id。

[V] 根因：QR 收票、网关 Cookie 构造、网页登录同步均把十项 Cookie 当作硬性要求。原 docs/05 P2 只证明十项组合可用，没有逐项删除的实验；截图显示此网页登录流程没有下发两项辅助票据。

修改：保留八项核心会话的非空校验；辅助 d_ticket/s_v_web_id 有则保留、没有则不阻断本地会话初始化。未生成或伪造任何登录票据。桌面导入使用同一校验，拒绝空值。网页登录同步门槛一致。

涉及文件：vendor/doubao/app/doubao.py、app/qrlogin.py、desktop.py、Electron services/doubao.ts，以及对应测试和两个启动脚本。

[V] 验证：
- Python QR/desktop 测试 31 项通过，包括扫码确认→收票→保存→重建客户端的整条离线路由回归、辅助票据保留、八项核心分别缺失/空值拒绝。
- 解析器 52 项、错误路径 8 项、协议桥接 26 项通过。
- app TypeScript 编译通过。
- PyInstaller 网关和 electron-builder dist-ai-study-qrfix 打包通过。
- 新打包 resources/app 的真实 Electron/冻结网关集成测试 17 项通过，无上游请求。

[T] 真实账号重新扫码及首条在线回答待用户验证。健康状态表示本地客户端可初始化，不证明上游会话有效。此补丁验证的是解除本地错误门槛，不声称两个辅助 Cookie 在所有上游场景均无用。

自查：辅助 Cookie 若存在仍发送；核心缺失/空值仍拒绝；未修改设备参数或模型映射；未输出用户凭据；未进行独立人员审查或 CI。

参考：本地原项目 Doubao2api/docs/doubao2api-05-live-probe-results.md；对照 https://github.com/wangchuxiaoji-oss/doubao2api/blob/main/doubao2api/qr_login.py 的会话收集方式，未引入该项目依赖或复制实现。

Git 快照：未创建（用户未要求）。改动前源文件备份在 before/。回滚：关闭修正版后，用 before/ 中相同路径文件恢复并重建；旧 dist-ai-study 输出保留可运行。启动脚本改回 dist-ai-study 即可启动旧版本。
