## Context

文章 `articles/opencode-plugin-dev-guide.md` §4(Hooks 全览)目前有 §4.1 表格 + §4.2-4.5 四个代码示例(config/event/tool/chat.headers)。`experimental.session.compacting` 在 §4.1 表格中列出但没有对应示例小节。

该 hook 的类型定义(`@opencode-ai/plugin` `index.d.ts:274-279`)有两种用法:`output.context.push()` 追加上下文、`output.prompt =` 整体替换 prompt。

## Goals / Non-Goals

**Goals:**

- 在 §4.5 之后新增 §4.6,为 `experimental.session.compacting` 补代码示例
- 示例覆盖 `context` 追加和 `prompt` 替换两种用法
- 与现有 §4.2-4.5 的风格一致(标注类型来源、可读的非伪代码)

**Non-Goals:**

- 不修改 §4.1 表格内容(hook 已列出,无需改动)
- 不为其他 experimental hooks(messages.transform/system.transform/text.complete)补示例
- 不修正表格中 `dispose`/`small_model` 的准确性问题(超出本 change 范围)

## Decisions

### 示例只展示 `context.push`,注释提及 `prompt` 替换

**决策**:主体示例用 `output.context.push()` 追加上下文(更常见的用法),`output.prompt =` 以注释形式展示。

**理由**:与 §4.5 chat.headers 示例风格一致--一个主要用法 + 注释提及替代方案。两个都展开会让示例过长,且 `context.push` 是更安全的增量用法。

### 标注类型来源行号

**决策**:示例说明处标注 `index.d.ts:274-279`,与文章其他章节标注风格一致(如 §3.1 标注 `index.d.ts:51`)。

## Risks / Trade-offs

- [类型定义版本漂移] `index.d.ts` 行号可能随 `@opencode-ai/plugin` 版本变化 -> 文章开头已标注"基于 @opencode-ai/plugin@1.18.5",行号在该版本内固定
