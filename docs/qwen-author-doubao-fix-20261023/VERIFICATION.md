# VERIFICATION（2026-10-23，时间为东京时间）

## 构建
- `pnpm build:doubao`（scripts/build-doubao.ps1）退出 0；`.doubao-venv` 先离线安装 certifi-2026.10.19（wheel）。
  新 runtime 增加 `_internal\certifi\cacert.pem`；另少了 3 个 api-ms-win-core-*.dll 转发 DLL（Win10/11 由系统 API Set 解析，不影响；下方测试在最小环境下通过）。
- web `vite build` 退出 0；app `tsc` 退出 0；electron-builder 23.6.0 退出 0（build-pre.log / build.log）。
- 安装包：packages\app\dist-chaoxing-release\超星自动机-2.12.0-安装包-x64.exe，284,863,101 字节，SHA256 见 installer.sha256。

## 功能核对（构建产物）
- web 产物含 qwen-dashscope、https://dashscope.aliyuncs.com/compatible-mode/v1、bailian.console.aliyun.com、「接入千问」（\u 转义形式）、alan34、chaoxing-question-bank-；不含 whiteroseai / WhiteRose / rose-question-bank。
- packages/ocsjs 源码中无 RoseAi/WhiteRose。
- win-unpacked 的 lib/src/services/doubao.js 含新诊断逻辑；runtime 含 certifi\cacert.pem。

## 豆包扫码
- 仅用 certifi 根证书（不读 Windows 证书库）连接 www.doubao.com:443：OK（TLS1.3，签发者 RapidSSL TLS RSA CA G1）。
- 空信任库模拟“缺根证书的电脑”：CERTIFICATE_VERIFY_FAILED；tls.describe_network_error 返回中文「TLS 证书校验失败…」。
- 新网关 exe 复制到 %TEMP% 另一目录、仅 System32 的 PATH、无项目路径：/health 200，POST /login/qr 返回 qrcode_data_uri/token。
- 新 win-unpacked 复制到 %TEMP%\cx-clean\Programs\超星自动机，全新 --user-data-dir、RunAsInvoker 启动，CDP 操作“连接豆包·扫码登录”：结果 QR_OK（弹窗“等待扫码”，截图 clean-probe.png）；
  该测试 profile 的 logs\doubao-gateway.log 已生成（启动行 + Flask 日志）。未使用 %APPDATA%\OCS Desktop。
- 局限：本机有 DigiCert Global Root G2，原问题在本机无法复现；“缺根证书”为推断根因，修复后的效果需在朋友电脑上确认。

## 切换
- 管理员助手 switch-to-new.ps1（一次 UAC）：关闭旧实例 0 残留、结束 doubao-gateway，等待构建完成标记后通过 启动新版.cmd 启动（switch.log）。
- 启动后窗口标题：超星自动机 · 学习概览。测试实例已结束。
