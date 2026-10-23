# 接入千问 / 作者 alan34 / 安装包豆包扫码失败

日期：2026-10-23。

## 1. 「接入 WhiteRose」→「接入千问」
- 位置：模型接入页（packages/web/src/pages/question-bank/index.vue）右上角灰色按钮。原逻辑：预填一个 OpenAI 兼容模型（id whiteroseai，服务地址 https://whiteroseai.org/v1，模型留空），不打开网页。
- 新逻辑：预填 id `qwen-dashscope`、名称「通义千问」、协议 OpenAI 兼容、服务地址 https://dashscope.aliyuncs.com/compatible-mode/v1（华北2·北京）、模型 qwen-plus；
  弹窗说明附「获取 API Key ↗」https://bailian.console.aliyun.com/?apiKey=1 与「查看说明 ↗」https://help.aliyun.com/zh/model-studio/get-api-key（系统浏览器打开）。
- 官方地址核对：阿里云帮助中心「获取与配置 API Key」「Base URL 总览」「OpenAI Chat 接口兼容」（2026-10 检索）。
- 用户已保存的 whiteroseai 模型配置不删除（属于用户数据），只是不再提供预设按钮。
- 其他 Rose 品牌：本地题库导出文件名 rose-question-bank-日期.json → chaoxing-question-bank-日期.json（不是千问功能，按软件名处理）。

## 2. 作者 lost → alan34
About 页、LICENSE（根目录与 packages/app）、NOTICE.md（两份）、web config/license.ts、electron.builder.json copyright。公告/教程正文不含作者名。

## 3. 安装包在其他电脑上豆包扫码失败
- 检查：界面里没有「脚本刷新失败」这句文字；扫码失败时实际显示「获取失败：…」，原代码对网关的非预期错误统一显示「豆包本地服务请求失败，请重试。」，真实原因被吞掉。
- 已排除（实测）：打包内容完整（runtime 108 个文件与 vendor 一致）；packaged app 内无 F:\ / 项目路径 / venv 引用；网关所有 DLL 依赖均为随包或 Windows 系统 DLL；
  OpenSSL 无开发机 CA 路径；把 win-unpacked 复制到 %TEMP% 另一目录、使用全新 --user-data-dir、最小环境变量启动，网关可启动并成功出码。
- 推断根因（未能在本机复现）：冻结 Python 只信任 Windows 本地证书库里**已存在**的根证书，不会像浏览器那样按需下载根证书；
  www.doubao.com 链到 DigiCert Global Root G2，在缺这张根证书的电脑上 Python 访问豆包登录接口会 CERTIFICATE_VERIFY_FAILED，
  且该异常不是 DoubaoError，网关返回 500，桌面端只显示通用失败。另一个常见原因是杀毒软件隔离/拦截未签名的 doubao-gateway.exe。
- 修复：网关 TLS 使用「系统证书库 + 随包 certifi 根证书」并集（仍完整校验）；扫码接口捕获网络/TLS 异常并返回中文具体原因；
  Electron 端显示真实原因（HTTP 状态/连接错误/网关退出码/被拦截提示），网关 stderr 脱敏后写入 userData\logs\doubao-gateway.log。
- 重建：scripts/build-doubao.ps1（.doubao-venv 安装 certifi 后），再按上次方式重建 web/app/安装包到 dist-chaoxing-release。

改动前文件在 before/。项目无 .git。
