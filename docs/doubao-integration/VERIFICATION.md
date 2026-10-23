# 豆包集成与界面改造交付记录

日期：2026-10-20。状态：实现与下述验证已执行，待用户验收。

## 实现范围

- 内置用户指定的 Doubao2api Python/Flask 网关，保留三种兼容协议与六档模型；上游来源说明见 `packages/app/vendor/doubao/UPSTREAM.md`。
- Electron 管理子进程：随机回环端口、随机 Bearer 密钥、失败提示、退出回收；Windows 运行文件由 PyInstaller 打包，使用者不需要安装 Python。
- 扫码登录、豆包官方网页登录（由官网提供手机号等登录流程）、Cookie 导入。网页窗口关闭 Node 权限，隔离会话。凭据经现有加密模块存储在 userData/doubao/session.enc；内置 Python 不读取原项目 .env，不落盘登录 Cookie。
- 内置模型接入现有本地题库/课程答题接口，保留用户已有的自定义模型选择；助手页可一键设置豆包为默认模型并接入 OCS。
- 学习概览、助手、本地题库页面；统一导航、工作区页头、主题、卡片和控件样式，并调整浏览器、脚本、资源、设置、监控与书签页。助手逻辑与页面样式拆分保存。
- 模型接入页的内置模型编辑入口进入豆包助手；本地题库支持查询、编辑、核对、删除和 JSON 导入/导出。

## 验证证据

| 编号 | 结论 | 实际执行 |
| --- | --- | --- |
| E-01 [V] | 主进程编译通过 | pnpm --filter @ocs-desktop/app exec tsc |
| E-02 [V] | Vue 类型检查与生产构建通过 | pnpm --filter @ocs-desktop/web build；2231 modules transformed |
| E-03 [V] | 原网关离线断言通过 | test_parser.py：52；test_error_paths.py：8；test_bridges.py：26 |
| E-04 [V] | 原扫码状态机通过 | 在 vendor/doubao 下执行 python -m pytest tests/test_qrlogin.py -q：8 passed |
| E-05 [V] | 新桌面桥接测试通过 | python -m pytest tests/test_desktop.py -q：4 passed；覆盖鉴权、Cookie 缺失、不落盘、退出与模拟回答 |
| E-06 [V] | 真实 Electron + 内置网关集成通过 | scripts/test-doubao-electron.cjs：16 assertions；使用隔离测试目录、真实加密和独立 EXE；故意将 Python 后备命令设为不存在，验证不依赖系统 Python |
| E-07 [V] | 真实扫码出码成功 | scripts/probe-doubao-login.cjs：取得 PNG 二维码与令牌；仅单次出码，不登录、不发题目，不记录令牌与图片 |
| E-08 [V] | 浏览器可视检查 | 工作台与助手页在本机 Vite 预览中打开，检查卡片、导航、登录入口；预览不提供桌面 IPC 登录能力 |
| E-09 [V] | Windows 目录包生成 | electron-builder --dir --publish never --config.directories.output=dist-doubao |
| E-10 [V] | 打包后资源集成验证通过 | 从 dist-doubao/win-unpacked/resources/app 加载服务，再次运行 16 项 Electron 集成断言；主进程、网页入口、网关 EXE 与构建源 SHA256 一致 |
| E-11 [V] | 现有 app.exit 关闭路径回收网关 | DOUBAO_TEST_EXIT_NOW=1 运行集成脚本；进程退出后查询 doubao-gateway.exe 无残留 |

日志：electron-test.stdout.log、electron-test.stderr.log、qr-probe.stdout.log、qr-probe.stderr.log、packaged-test.stdout.log、packaged-test.stderr.log。界面图：workbench-preview.png。

## 待实际账号验证

- [T] 手机扫描并确认后的完整登录流程，以及官方网页登录后的 Cookie 同步：未使用用户账号完成登录。
- [T] 真实账号的在线回答与实际课程页面自动答题：未执行；离线测试不等同于上游验证。
- [T] 账号 Cookie 是否被上游接受：本地就绪状态只表示所需凭据字段齐全，不代表在线会话永不失效。
- [V] 当前上游网关支持文本输入，会丢弃图片；集成对图片题明确返回错误，避免悄悄丢图。
- [T] macOS/Linux 运行文件未构建。本次交付为 Windows x64。

## 运行与重建

直接双击项目根目录 `启动新版.cmd`，或运行 `packages/app/dist-doubao/win-unpacked/OCS Desktop.exe`。保持整个 win-unpacked 文件夹完整。

重建网关（开发时）：创建 .doubao-venv，安装 vendor/doubao/requirements-build.txt，然后运行 pnpm build:doubao。
重建 UI：pnpm --filter @ocs-desktop/web build。
重建主进程：pnpm --filter @ocs-desktop/app exec tsc。
重建 Windows 目录包：在 packages/app 下执行 electron-builder --config electron.builder.json --dir --publish never --config.directories.output=dist-doubao。

## 回退与保留

工作目录没有 .git，未创建 Git checkpoint。before/ 保存已记录的改动文件副本；remote.ts 副本是在日志参数脱敏后保存的检查点，不能视为完整改动前副本。原有 packages/app/dist 未替换，新版输出在 dist-doubao。

构建环境 .doubao-venv、.doubao-build，隔离 test-profile 和构建目录均保留，未自动清理。未复制桌面源项目的 .env 或实际账号凭据。
