## Context

opencode 官方插件文档(opencode.ai/docs/plugins)是简化版:只展示本地文件 + npm 字符串两种加载方式,以及基础的 `Plugin` 函数签名。实际 `@opencode-ai/plugin@1.18.5` 类型定义(`index.d.ts`/`tool.d.ts`)包含更完整的 API:`PluginModule`/`server` 导出形态、`config` hook(文档未写)、tuple 形式 options 传递、`chat.headers`/`chat.params` 等十余种 hook、SDK Client API。

在开发 opencode-round-robin 过程中,我们通过研读类型定义、对照 `opencode-anthropic-auth`/`opencode-autognosis` 两个已加载插件、调查 `@local` 安装问题,掌握了完整的插件模型。这些知识目前只散落在对话中,需要沉淀为一篇结构化文章。

约束:
- 遵循 AGENTS-docs.md §1.2(articles 目录)、§1.4(格式:无 `---`、标题不跳级、代码块标语言)、§1.5(中文,技术术语保留英文)
- 文章内容须与 `@opencode-ai/plugin@1.18.5` 类型定义一致(可验证)
- 安装机制结论须有实证支撑(opencode.log、cache package.json、手动 bun install 对照)

## Goals / Non-Goals

**Goals:**
- 一篇单篇长文《opencode 插件开发指南》,放在 `articles/opencode-plugin-dev-guide.md`
- 面向"想给 opencode 写插件"的开发者,从零讲到能动手写
- 覆盖:加载机制、函数与导出、Hooks、自定义工具、配置与 options、依赖管理、SDK Client API、安装机制内幕、踩坑与调试
- 每个关键点配代码示例(从类型定义或 round-robin 实现提炼)
- 安装机制部分包含实测结论(cache vs config-dir、@local 问题),有可复现的排查步骤
- 格式合规 AGENTS-docs.md

**Non-Goals:**
- 不写本插件介绍(README 已覆盖,用户确认不重复)
- 不写 @local 踩坑实录的独立故事向文章(本期只写教学指南;踩坑内容作为指南的一个章节,不单独成篇)
- 不改 `src/` 代码、不改 `README.md`、不动 `docs/` 目录(本期只产出 articles/)
- 不发布到外部平台(仅写入仓库 articles/ 目录)
- 不做 docs/ 全套技术文档重构(那是后续独立 change)

## Decisions

### 决策 1:单篇长文,不拆系列

**选择**:一篇文章写完全部内容(预计 6000-10000 字),不拆成系列连载。

**理由**:
- 用户明确选择方案 A(单篇长文)
- 单篇便于通读和检索,读者一篇文章获得完整图景
- 系列连载适合持续运营,本期目标是沉淀知识,非运营

**备选**:系列拆分(4 篇:加载与导出 / Hooks 详解 / 工具与配置 / 实战与踩坑),已弃--本期不运营连载。

### 决策 2:文章结构(十一章)

**选择**:按以下章节组织,从"能做什么"到"怎么写"到"怎么调试"递进:

1. opencode 插件能做什么(扩展点全景)
2. 三种加载方式(附实测结论)
3. 插件函数与导出(Plugin/PluginModule/PluginInput)
4. Hooks 全览(表格 + 代码示例,含文档未写的 config hook)
5. 自定义工具(tool helper、ToolContext)
6. 配置与 options 传递
7. 依赖管理(package.json、@opencode-ai/plugin 角色)
8. SDK Client API(插件能调什么)
9. 实战:写一个 key 轮询插件(迷你版,简化自 round-robin)
10. 踩坑与调试(@local 问题、opencode.log 查法、工具是否注册判断、asar 挖掘)
11. 资源(官方文档、类型定义、社区插件)

**理由**:
- 1-2 章建立宏观认知(能做什么、怎么加载)
- 3-8 章是 API 系统讲解(函数、hooks、工具、配置、依赖、SDK)
- 9 章实战串联前 8 章(用 round-robin 的真实场景)
- 10 章踩坑(我们踩过的坑,别人不用再踩)
- 11 章资源(延伸阅读)

**备选**:按"概念 -> 实战"两段式(前半概念后半实战),已弃--十一章递进式更适合教学,且踩坑单独成章更突出。

### 决策 3:实战章节用迷你版 round-robin

**选择**:第 9 章实战写一个简化版 key 轮询插件,从 round-robin 的 `src/` 提炼核心片段(config hook 读 provider + fetch-patch 注入 Authorization + event 记统计 + tool 注册状态查看),但不照搬完整实现。

**理由**:
- round-robin 是真实场景,比虚构例子有说服力
- 简化版去掉 cooldown/日志/图表等细节,聚焦"如何组合 hooks 写插件"
- 代码片段直接引用 round-robin 的 `src/`(标注 file:line),读者可对照完整实现

**备选**:虚构一个更简单的例子(如"给所有 bash 命令加前缀"),已弃--缺乏真实场景的说服力,且无法展示 config hook + fetch-patch 这种进阶用法。

### 决策 4:踩坑章节聚焦 @local,附可复现排查步骤

**选择**:第 10 章踩坑以 `@local` 安装问题为主线,包含:
- 现象(opencode.log 的 WARN 原文)
- 根因(opencode 无条件注入 @opencode-ai/plugin@local,bun 解析不了)
- 三种 spike 的过程与结论(挪 devDeps / junction / 移除 config 依赖)
- 可复现的排查步骤(查 opencode.log、查 cache package.json、手动 bun install 对照)
- 当前结论与绕过方向(字符串形式 / overrides / 报 bug)

**理由**:
- @local 是我们花最多时间调查的问题,素材最扎实
- 别人撞同样问题能搜到这篇文章直达结论
- 三种 spike 的失败过程本身就是调试方法论的教学

**备选**:只写结论不写过程,已弃--过程更有教学价值,且让文章有"实战感"而非纯 API 罗列。

### 决策 5:格式遵循 AGENTS-docs.md

**选择**:
- 文件放 `articles/opencode-plugin-dev-guide.md`(kebab-case)
- 无 `---` 水平分割线(章节用标题层级)
- 标题层级严格递进(`#` -> `##` -> `###`,不跳级)
- 代码块标注语言类型(` ```ts ` / ` ```jsonc ` / ` ```bash `)
- 中文撰写,技术术语保留英文(Plugin、Hooks、fetch-patch 等)
- 列表统一用 `-`
- 表格展示结构化数据(hooks 全览、加载方式对比等)

**理由**:遵循项目文档规范,与 README/AGENTS 一致。

## Risks / Trade-offs

- **[文章与 opencode 版本绑定]** -> 文章基于 `@opencode-ai/plugin@1.18.5` 与 oh-my-opencode 3.15.3。opencode API 可能随版本变化。缓解:文章开头标注"基于 @opencode-ai/plugin@1.18.5 / opencode 2026-07"版本,API 变化时更新。
- **[@local 问题尚未解决]** -> 文章踩坑章节描述的 @local 问题在当前版本未修复,我们也没找到完美的配置侧修复(方案 B 重构待做)。缓解:踩坑章节如实写"当前未解决,以下为已知方向",不假装已解决;待方案 B 落地或 opencode 修复后更新。
- **[文章长度]** -> 单篇 6000-10000 字较长,部分读者可能只关注某章节。缓解:章节标题清晰,开头加目录(锚点),读者可跳读。
- **[实证结论的准确性]** -> 安装机制部分(cache vs config-dir、tuple 不进 cache)来自本项目实证,可能随 opencode 版本变化。缓解:结论均标注来源(具体文件/日志行),可复现验证。
- **[实战章节代码与实际实现偏差]** -> 迷你版简化了 round-robin,可能与 `src/` 实际代码有出入。缓解:代码片段标注来源 file:line,并注明"为教学简化,完整实现见 src/"。

## Open Questions

无。文章结构、内容来源、格式规范均已明确,无待定项。
