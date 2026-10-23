# 更名「超星自动机」+ 关于页 + 本地公告

日期：2026-10-23。作者：lost。

## 范围

1. 更名：所有用户可见的软件名（窗口标题、网页标题、标题栏、工作区页头、导航、学习导航页、内嵌浏览器起始页、
   electron-builder productName / 安装包名 / 快捷方式名 / 卸载显示名）统一为「超星自动机」。
2. 关于：新增左侧导航「关于软件」页面（路由 /about），标题栏「帮助」菜单与 logo、空白浏览器卡片也可进入。
   内容：名称与版本、作者 lost、基于 enncy / ocsjs 团队原项目修改（GitHub 链接用系统浏览器打开）、修改说明（依据 docs/ 记录）、
   致谢、MIT 许可全文、免责声明。
3. 公告：原版启动公告、横幅、「使用教程」均从 cdn.ocsjs.com 远程获取，改为随软件打包的本地「使用教程」
   （packages/web/src/config/notice.ts），不再请求远程公告/横幅/教程。
4. 许可：原 ocs-desktop 仓库只在 package.json 声明 MIT、无独立 LICENSE；在根目录与 packages/app 补齐 LICENSE（保留 enncy 版权）
   和 NOTICE.md，并加入打包 files；packages/ocsjs/LICENSE 原样保留。
5. 构建：沿用 dist-ai-study-release 的方式（web 生产构建 → app tsc → electron-builder，NSIS + win-unpacked），
   输出到新目录 packages/app/dist-chaoxing-release，旧输出全部保留用于回退；根目录两个 .cmd 改指向新 exe。

## 刻意不改

- npm 包名 @ocs-desktop/*、导入路径、目录名；appId `ocs.enncy.cn`；extraMetadata.name `OCS Desktop`（决定 %APPDATA%\OCS Desktop 用户数据目录）；
  app.setName('ocs')（keytar 密钥/内部名称）；.ocsdata 数据文件扩展名；分区名 persist:ocs-*。
- 指代课程脚本本身的「OCS 网课助手」「OCS 课程配置」「OCS 内置题库」「接入 OCS」等文字（它们是 OCSJS 脚本/配置的名字，不是软件名）。
- 日志里的内部任务名（OCS启动程序、OCS服务启动成功等），不显示在界面上。
- 远程语言包 fetchRemoteLangs、学习导航书签、原项目更新检查（updater）逻辑未改，只把弹窗标题去掉 OCS 字样。

## 备份

改动前文件保存在 before/ 同路径下。项目无 .git，未创建提交。
