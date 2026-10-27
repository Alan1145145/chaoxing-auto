# 超星自动机 1.0.1

内置 OCS JS 版本为 5.1.1。

- 保存、编辑或切换答题模型时自动接入 OCS JS。
- 课程顶层页面和 iframe 持续同步桌面配置，无需手动刷新；补充课程框架注入并避免重复启动。
- 新增“一键获取模型”、模型搜索选择、手动模型 ID 和保存前测试连接，支持 OpenAI 兼容、Anthropic 和 Gemini。
- 修正自定义接口地址重复追加版本路径、密钥清除选项及编辑框失败后关闭的问题。

## 验证

主进程 TypeScript、OCS JS 和 Vue 界面构建均通过。以下测试分别通过 47 项和 17 项断言，打包目录中的服务及界面也通过相同的同步测试：

```powershell
pnpm exec electron scripts/test-model-provider.cjs
node scripts/test-model-sync.cjs
```

测试使用本地模拟模型、隔离配置及真实 Electron WebView；已验证顶层页面和 iframe 不刷新同步，以及通过 OCS 的 GM 请求获得模型答案。未使用真实 API Key 或发起付费模型请求。构建方式见 [BUILD.md](../../BUILD.md)。

## 下载与校验

[v1.0.1 Release](https://github.com/Alan1145145/chaoxing-auto/releases/tag/v1.0.1) 提供 Windows x64 安装包。

安装包 `chaoxing-auto-1.0.1-setup-x64.exe`，284865304 字节，SHA256：

```text
3ee9883dc188dff44a80f6c7eb06f4a760b976994b66543e01f022ac8ba7991f
```

本地验证日志、浏览器配置及备份不随源码发布。
