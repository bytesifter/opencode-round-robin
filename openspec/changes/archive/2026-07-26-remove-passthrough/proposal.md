## Why

`passthrough` 概念过度设计：单 key 组被标记为 `passthrough=true`，fetch-patch 不拦截、不换 key、不记日志。导致用户配置了 4 个 provider 但日志只出现 3 个，`volxc9208-agentplan`（不同 baseURL，单 key 组）完全不可见。单 key 拦截代价为零（`next()` 对 1 个 key 的随机选择必然返回那个 key），passthrough 没有存在价值。

## What Changes

- **移除 `passthrough` 概念**: 从 `ParsedPool`、`KeyPool`、`patchFetch`、`buildPoolsFromProviders` 中删除 `passthrough` 字段和相关逻辑
- `patchFetch` 中 `if (!pool || pool.passthrough)` 改为 `if (!pool)`：仅 URL 不匹配时才透传
- `KeyPool.next()` 删除 `if (this.passthrough) return this.keys[0]`：单 key 走通用随机逻辑（1 选 1 必然返回）
- `buildPoolsFromProviders` 不再计算 `passthrough`
- README 删除"某组去重后仅 1 个 key -> 该组透传,不拦截"
- 测试更新：移除 passthrough 断言，单 key pool 测试改为验证拦截和 Authorization 设置

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `key-rotation`: 移除单 key 组 passthrough 透传行为，所有匹配 pool 的请求均被拦截、记日志

## Impact

- **src/types.ts**: 删 `ParsedPool.passthrough` 字段
- **src/pool.ts**: 删 `KeyPool.passthrough` 属性和 `next()` 中的早返回
- **src/config.ts**: 删 `passthrough: g.keys.length === 1`
- **src/fetch-patch.ts**: `if (!pool || pool.passthrough)` -> `if (!pool)`
- **tests/pool.test.ts**: 删 passthrough 断言，单 key 测试改为验证 next() 返回唯一 key
- **tests/fetch-patch.test.ts**: 删 passthrough 字段，单 key 测试改为验证 Authorization 被设置
- **tests/config.test.ts**: 删 4 处 passthrough 断言
- **README.md**: 删"单 key 透传"规则
