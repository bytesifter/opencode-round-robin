## Context

文章 `articles/opencode-plugin-dev-guide.md` 背景章节当前只有 3 段（429 痛点、6 账号、方案+GitHub 链接）。缺少"为什么不直接用 new-api"的方案对比。审查还发现 1 处路径分隔符混用和缺少版本锁定提示。

## Goals / Non-Goals

**Goals:**

- 背景章节加生态对比，让读者理解插件方案的价值
- 修复路径分隔符和版本锁定

**Non-Goals:**

- 不重写技术章节
- 不加 new-api 的具体安装教程（只对比方案轻重）

## Decisions

### 决策 1: 对比内容放在背景章节末尾

在"完整代码：GitHub 链接"之后、"本文以这个插件为例"之前，加一段"为什么不直接用 API 网关"的对比。

### 决策 2: 用 ASCII 图而非表格

CSDN 文章中 ASCII 图比表格更醒目，适合展示架构差异（网关 vs 插件）。

### 决策 3: 不提具体厂商名

new-api/one-api 只提方案类型（API 网关），不深入具体产品。保持文章通用性。

## Risks / Trade-offs

无。
