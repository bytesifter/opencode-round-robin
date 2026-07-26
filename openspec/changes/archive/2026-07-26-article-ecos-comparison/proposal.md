## Why

文章背景章节只讲了"429 痛点 + 6 账号"，缺少方案对比。读者会问：opencode 没有内置？其他 agent 有没有？为什么不直接用 new-api？需要在背景章节加一段生态对比，说明为什么选择写插件而不是用 API 网关方案。同时修复审查发现的路径分隔符问题和版本锁定提示。

## What Changes

### 背景章节加方案对比

- 加一段：opencode 无内置多 key 轮询，其他 vibe coding agent（Cursor/Windsurf/Continue/Aider）也没有
- 加一段：new-api/one-api 等网关方案能做但太重（独立进程+数据库+Web UI），对比插件方案（monkey-patch fetch，零额外进程）
- 加 ASCII 对比图

### 审查修复

- L641 路径分隔符统一：`~/.local\Programs\` -> `~/.local/Programs/`
- 背景章节 GitHub 链接后加版本锁定提示："本文基于 opencode v1.18.5"

## Capabilities

### New Capabilities

无。

### Modified Capabilities

无。

## Impact

- **articles/opencode-plugin-dev-guide.md**: 背景章节加方案对比段落 + 2 处审查修复
