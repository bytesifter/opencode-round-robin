## Why

opencode 生态缺少系统的插件开发文档:官方 plugins 页面只展示了简化的本地文件 + npm 字符串两种加载方式,而 `PluginModule`/`server`/`config` hook/tuple options 等关键 API 散落在 `@opencode-ai/plugin` 类型定义里,无人系统梳理。我们在开发 opencode-round-robin 的过程中,通过研读类型定义、对照两个已加载的同类插件、深入调查 `@local` 安装问题,积累了一套完整的插件模型知识。将其沉淀为一篇面向社区的教学文章,既填补生态资料空白,也避免后续重复踩坑。

## What Changes

- 新增 `articles/` 目录(遵循 AGENTS-docs.md §1.2 宣传文章目录结构)
- 新增 `articles/opencode-plugin-dev-guide.md`:单篇长文《opencode 插件开发指南》,面向"想给 opencode 写插件"的开发者
- 文章覆盖:插件加载机制(三种方式及实测结论)、插件函数与导出(Plugin/PluginModule/PluginInput)、Hooks 全览(含文档未写的 config hook)、自定义工具(tool helper)、配置与 options 传递、依赖管理、SDK Client API、安装机制内幕(cache vs config-dir、@local 问题)、踩坑与调试技巧
- 内容来源:`@opencode-ai/plugin@1.18.5` 类型定义(`index.d.ts`/`tool.d.ts`)、官方文档(opencode.ai/docs/plugins、/config、/sdk)、opencode-round-robin 开发过程中的实证调查
- 不新增代码,不改动现有 `src/` 或 `README.md`

## Capabilities

### New Capabilities

- `plugin-dev-guide`: 文章必须覆盖的 opencode 插件开发知识体系要求(加载机制、API、hooks、工具、配置、依赖、SDK、安装内幕、踩坑),以及文章的格式与语言合规性

### Modified Capabilities

无。本变更为新增宣传文章,不改变 `key-rotation`/`request-logging`/`usage-tracking`/`plugin-packaging` 任何 spec 级行为。

## Impact

- **新增文件**:`articles/opencode-plugin-dev-guide.md`、`articles/assets/`(如需配图)
- **新增目录**:`articles/`
- **无代码影响**:`src/`、`tests/`、`package.json` 均不变
- **规范遵循**:AGENTS-docs.md §1.2(articles 目录结构)、§1.4(格式:无 `---`、标题不跳级、代码块标语言、中文)、§1.5(语言:中文,技术术语保留英文)
- **素材依赖**:文章中引用的 API 来自 `@opencode-ai/plugin@1.18.5` 类型定义;安装机制结论来自 opencode-round-robin 项目的实证调查(opencode.log、cache package.json、手动 bun install 对照实验)
