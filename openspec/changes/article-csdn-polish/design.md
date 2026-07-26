## Context

文章 `articles/opencode-plugin-dev-guide.md` 共 659 行，11 章。准备发布到 CSDN。当前问题：开头学术 header 不适合 CSDN、无背景动机、含厂商信息（volxc9208/ark.cn-beijing.volces.com）。

## Goals / Non-Goals

**Goals:**

- 文章开头有清晰的"为什么写这个"背景
- 不含任何厂商特定信息
- GitHub 链接出现在背景和结尾
- 标题适合 CSDN

**Non-Goals:**

- 不重写技术内容（API 讲解/Hooks 全览等章节保持不变）
- 不更新实战章节的代码逻辑（只泛化厂商名 + 标注简化版）

## Decisions

### 决策 1: 背景章节内容

讲清三个点：痛点（429 限流）、资源（6 个高级版账号）、方案（插件自动轮询）。不提具体厂商名。

### 决策 2: GitHub 链接位置

背景章节首次出现（引出插件），结尾章节再次出现（引导 star）。链接为 `https://github.com/bytesifter/opencode-round-robin`。

### 决策 3: 标题

`opencode 插件开发指南：从 429 限流到多 Key 自动轮询`

## Risks / Trade-offs

无。
