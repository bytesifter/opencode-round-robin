## Why

文章背景章节 L5 写"opencode 的 opencode.jsonc 只能配一个 provider"，事实错误：opencode.jsonc 可以配多个 provider，只是 model 一次只指向一个。应改为强调"手动切换繁琐 + 无法自动应对 429"。

## What Changes

- 修正 L5 表述：`只能配一个 provider` -> `model 一次只能指向一个 provider，手动切换繁琐，无法自动应对 429 限流`

## Capabilities

无 spec 变更。

## Impact

- **articles/opencode-plugin-dev-guide.md**: L5 一处文字修正
