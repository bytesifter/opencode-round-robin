## 1. 准备

- [x] 1.1 创建 `articles/` 目录与 `articles/assets/` 子目录
- [x] 1.2 创建 `articles/opencode-plugin-dev-guide.md` 文件,写入文章标题(`#`)与开头版本标注("基于 @opencode-ai/plugin@1.18.5 / opencode 2026-07")

## 2. 宏观认知(章 1-2)

- [x] 2.1 写第一章"opencode 插件能做什么":扩展点全景(hooks/工具/事件/自定义 provider),一句话概述每种扩展能力
- [x] 2.2 写第二章"三种加载方式":本地文件 / npm 字符串 / tuple 形式,每种含配置写法、安装位置、是否传 options、适用场景;附实测结论(cache package.json 内容、tuple 不进 cache)与对比表格

## 3. API 系统讲解(章 3-8)

- [x] 3.1 写第三章"插件函数与导出":`Plugin` 函数签名、`PluginInput` 上下文字段表格、`PluginModule` 导出形态,配代码示例,标注类型来源(`index.d.ts:51-56`)
- [x] 3.2 写第四章"Hooks 全览":列出全部 hook 的表格(名/签名/用途),其中 config/event/tool/chat.headers 配代码示例;明确标注 config hook 存在于类型定义但官方文档未展示
- [x] 3.3 写第五章"自定义工具":`tool()` helper 用法、Zod schema、`ToolContext` 字段表格、一个完整的工具注册示例(含 description/args/execute)
- [x] 3.4 写第六章"配置与 options 传递":`plugin` 字段的 string/tuple 两种形式、options 传递机制、引用 `Config.plugin` 类型定义
- [x] 3.5 写第七章"依赖管理":本地插件用外部包(config 目录 package.json)、`@opencode-ai/plugin` 运行时由 opencode 提供(只需 devDeps)、bun install 机制
- [x] 3.6 写第八章"SDK Client API":列出 `client.config`/`client.session`/`client.event`/`client.tui`/`client.app`/`client.find`/`client.file` 等命名空间及关键方法,配表格

## 4. 实战与踩坑(章 9-10)

- [x] 4.1 写第九章"实战:写一个 key 轮询插件(迷你版)":组合 config hook(读 provider)+ fetch-patch 或 chat.headers(注入 key)+ event(记统计)+ tool(注册状态查看),代码片段标注来源 file:line 并注明"为教学简化"
- [x] 4.2 写第十章"踩坑与调试":@local 问题为主线(现象/根因/三种 spike 过程与结论)、可复现排查步骤(查 opencode.log / 查 cache package.json / 手动 bun install 对照)、如实标注当前未解决并列出已知方向

## 5. 收尾

- [x] 5.1 写第十一章"资源":官方文档链接(plugins/config/sdk)、`@opencode-ai/plugin` 类型定义位置、社区插件示例(opencode-anthropic-auth/opencode-autognosis)
- [x] 5.2 全文格式校验:无 `---` 水平分割线、标题层级不跳级、代码块均标注语言、中文(技术术语保留英文)、列表统一 `-`
- [x] 5.3 对照 specs 逐条复核:加载机制/函数导出/Hooks/工具与配置/依赖与SDK/安装内幕与踩坑/实战/格式合规,每条 spec 的 scenario 均被文章覆盖
