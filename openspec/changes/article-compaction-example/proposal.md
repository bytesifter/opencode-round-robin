## Why

文章 §4.1 Hooks 全览表格中列出了 `experimental.session.compacting`,但与 `config`/`event`/`tool`/`chat.headers` 不同,它没有配代码示例小节(§4.2-4.5 已有,compacting 缺失)。compaction 是 vibe coding 中的高频场景(上下文超限时自动压缩),读者看到表格里有这个 hook 却找不到示例,无法上手。

## What Changes

- 在文章 §4.5 `chat.headers` 示例之后新增 §4.6 `experimental.session.compacting` hook 代码示例
- 示例 SHALL 覆盖两种用法:`output.context.push()`(追加上下文)和 `output.prompt =`(整体替换 prompt)
- 示例 SHALL 标注类型来源(`index.d.ts:274-279`)
- 更新 `plugin-dev-guide` spec:Hooks 全览的示例要求从"config/event/tool/chat.headers"扩展到含 `experimental.session.compacting`

## Capabilities

### New Capabilities

(无)

### Modified Capabilities

- `plugin-dev-guide`: Hooks 全览的代码示例要求新增 `experimental.session.compacting`

## Impact

- `articles/opencode-plugin-dev-guide.md`:新增 §4.6 小节(约 20-30 行)
- `openspec/specs/plugin-dev-guide/spec.md`:修改"覆盖 Hooks 全览"requirement,增加 compacting 示例要求
