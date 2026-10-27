# 超星自动机

超星自动机是一个 Windows 桌面端学习助手，基于开源项目 [OCS Desktop](https://github.com/ocsjs/ocs-desktop) 和 [OCSJS](https://github.com/ocsjs/ocsjs) 修改而来。

- 作者：alan34
- 原作者：enncy / ocsjs 团队
- 当前版本：1.0.1

## 相对原版的主要改动

- 更名为「超星自动机」，新增「关于软件」页面
- 接入豆包 AI 答题（豆包 App 扫码登录，内置本地网关）
- 新增「接入千问」预设（阿里云百炼 OpenAI 兼容接口）
- 模型接入支持一键获取模型、保存前测试连接；保存和切换模型后自动接入 OCS JS，已打开的课程页和 iframe 自动同步
- 公告改为本地使用教程，关闭了指向原项目的在线更新
- 界面细节调整

## 下载

到 [v1.0.1 Release](https://github.com/Alan1145145/chaoxing-auto/releases/tag/v1.0.1) 下载 `chaoxing-auto-1.0.1-setup-x64.exe`，支持 Windows 10/11 x64。安装完成后，从桌面或开始菜单启动。

使用模型时，在「模型接入」中填写服务地址和 API Key，点击「一键获取模型」选择模型，再保存即可。服务商未提供模型列表时，可以手动填写模型 ID。

## 从源码构建

见 [BUILD.md](BUILD.md)。

## 开源许可

本项目基于 MIT 许可证的原项目修改，保留原作者版权声明，详见 [LICENSE](LICENSE) 和 [NOTICE.md](NOTICE.md)。感谢原作者 enncy 及 ocsjs 团队。

## 免责声明

本软件仅供个人学习和技术研究使用，请勿用于商业或违法用途。使用自动化工具可能违反学习平台或学校的规定，由此产生的一切后果由使用者自行承担。
