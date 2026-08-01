## 1. 配置层

- [x] 1.1 `src/types.ts`: `ParsedOptions` 新增 `quotaCooldownMs: number` 字段
- [x] 1.2 `src/config.ts`: 新增 `DEFAULT_QUOTA_COOLDOWN_MS = 3600000`，`parseOptions` 解析 `quotaCooldownMs`（可选，默认 3600000）

## 2. Pool 层

- [x] 2.1 `src/pool.ts`: `markCooldown` 重载为 `markCooldown(key: string, ms?: number)`，不传 `ms` 时用 `this.cooldownMs`（向后兼容）

## 3. fetch-patch 层

- [x] 3.1 `src/fetch-patch.ts`: 新增 429 分类逻辑--`response.clone()` 读响应体，`JSON.parse` 后检查 `error.message` 是否含 `exceeded` 与 `quota`（不区分大小写），返回 `"quota-exhausted" | "rate-limit"`；解析失败时返回 `"rate-limit"`
- [x] 3.2 `src/fetch-patch.ts`: `FetchPatchCallbacks.onResponse` 签名增加 429 类型参数（`type?: "rate-limit" | "quota-exhausted"`）
- [x] 3.3 `src/fetch-patch.ts`: 429 处理改为：先分类，再按类型选择冷却时长调用 `markCooldown(key, ms)`，回调传入类型

## 4. 日志层

- [x] 4.1 `src/logger.ts`: `logCooldown` 签名增加类型参数（`type: "rate-limit" | "quota-exhausted"`），日志格式改为 `WARN  cooldown provider=xxx key=#0(..2898) <type> <ms>ms`

## 5. 入口层

- [x] 5.1 `src/index.ts`: `onResponse` 回调适配新签名，根据 429 类型选择 `cooldownMs` 或 `quotaCooldownMs` 调用 `markCooldown`，并调用 `logCooldown` 传入类型

## 6. 测试

- [x] 6.1 `tests/pool.test.ts`: 新增 `markCooldown(key, ms)` 自定义时长测试-指定 ms 覆盖默认 cooldownMs
- [x] 6.2 `tests/fetch-patch.test.ts`: 新增配额耗尽 429 测试-响应体含 `exceeded` + `quota` 触发 `markCooldown` 传入 `quotaCooldownMs`
- [x] 6.3 `tests/fetch-patch.test.ts`: 新增请求太快 429 测试-响应体不含 `quota` 触发 `markCooldown` 传入 `cooldownMs`
- [x] 6.4 `tests/fetch-patch.test.ts`: 新增响应体不可读 429 测试-非 JSON 响应体 fallback 到 `rate-limit`
- [x] 6.5 `tests/logger.test.ts`: 新增冷却日志类型标签测试-`rate-limit` 与 `quota-exhausted` 各一行

## 7. 文档

- [x] 7.1 `README.md` 功能描述(line 10):补充"配额耗尽时熔断 1 小时，请求太快时熔断 1 分钟"
- [x] 7.2 `README.md` 配置表(line 40):新增 `quotaCooldownMs` 行(默认 3600000)
- [x] 7.3 `README.md` 配置示例(line 97):可选补充 `"quotaCooldownMs": 3600000`
- [x] 7.4 `README.md` 日志示例(line 125-130):补充 `quota-exhausted` 冷却行示例
- [x] 7.5 `articles/opencode-plugin-dev-guide.md`: 429 熔断描述补充区分机制(配额耗尽 vs 请求太快)

## 8. 验证

- [x] 8.1 `bun test` 全部通过
- [x] 8.2 `bun x tsc --noEmit` 类型检查通过
- [x] 8.3 `bun run build` 构建成功
