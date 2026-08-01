## Why

火山引擎返回 429 有两种完全不同的情况：**配额耗尽**（月/周用量用完，需等数天重置）和**请求太快**（频率限制，等一会即可）。当前插件不区分，统一熔断 60 秒。配额耗尽时 60 秒后重试必然再次 429，白白浪费请求且刷屏日志。需要区分两种 429，配额耗尽时熔断 1 小时，请求太快时维持 1 分钟。

## What Changes

- 新增配置项 `quotaCooldownMs`（默认 3600000ms = 1 小时），用于配额耗尽场景的熔断时长
- fetch-patch 收到 429 时读取响应体，根据 `error.message` 区分两种类型：
  - 含 `exceeded` + `quota` -> 配额耗尽 -> 熔断 `quotaCooldownMs`
  - 其他 429 -> 请求太快 -> 熔断 `cooldownMs`（现有行为）
- `pool.markCooldown` 支持传入自定义冷却时长
- 冷却日志区分类型（`rate-limit` / `quota-exhausted`）与时长
- README 配置表与日志示例同步更新

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `key-rotation`: 429 熔断需求从单一类型拆分为两种--请求太快熔断（`cooldownMs`，现有）与配额耗尽熔断（`quotaCooldownMs`，新增）。fetch-patch 需读响应体区分类型。
- `structured-logging`: 冷却日志需区分 `rate-limit` 与 `quota-exhausted` 两种类型标签，并记录实际冷却时长。

## Impact

- **代码**: `src/types.ts`（ParsedOptions +quotaCooldownMs）、`src/config.ts`（解析新字段）、`src/pool.ts`（markCooldown 重载）、`src/fetch-patch.ts`（读响应体区分 429 类型）、`src/logger.ts`（logCooldown 区分类型）、`src/index.ts`（onResponse 回调适配）
- **测试**: `tests/pool.test.ts`、`tests/fetch-patch.test.ts`、`tests/logger.test.ts` 新增配额耗尽场景
- **文档**: `README.md`（功能描述、配置表、配置示例、日志示例）、`articles/opencode-plugin-dev-guide.md`（429 熔断描述补充区分机制）
- **兼容性**: `quotaCooldownMs` 可选，不配则配额耗尽也走 `cooldownMs`（向后兼容）
