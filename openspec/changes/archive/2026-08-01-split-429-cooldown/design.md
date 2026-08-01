## Context

当前 `fetch-patch.ts` 收到 429 时只看 `response.status`，不读响应体，统一调用 `pool.markCooldown(key)` 熔断 `cooldownMs`（默认 60s）。但火山引擎的 429 有两种完全不同的情况：

- **配额耗尽**：`error.message` 含 `You have exceeded the (monthly|weekly) usage quota. It will reset at ...`，需等数天重置
- **请求太快**：`error.message` 含 `Requests are too frequent. Please reduce your request frequency`，等一会即可

配额耗尽时 60 秒后重试必然再次 429，浪费请求且刷屏日志。两种 429 的区分依据（响应体文案）已从 `opencode.log` 历史日志中确认。

## Goals / Non-Goals

**Goals:**

- fetch-patch 收到 429 时读取响应体，区分配额耗尽与请求太快
- 配额耗尽使用 `quotaCooldownMs`（默认 3600000ms = 1 小时）熔断
- 请求太快维持现有 `cooldownMs`（默认 60000ms）熔断
- 冷却日志标注类型（`rate-limit` / `quota-exhausted`）
- `quotaCooldownMs` 可选配置，不配时配额耗尽也走 `cooldownMs`（向后兼容）

**Non-Goals:**

- 不解析 `reset at <时间>` 做精确熔断（固定 1 小时，靠重试自然收敛）
- 不在 fetch-patch 内部换 provider 重发（现有设计决策不变）
- 不改变全熔断 passthrough 行为

## Decisions

### 决策 1：用 `response.clone()` 读响应体

429 响应的 body 是 ReadableStream，直接读取会消费掉，下游 AI SDK 无法再读。

**选择**：`const clone = response.clone(); const body = await clone.text();` 读取副本，原 response 原封不动返回给下游。

**替代方案**：读完后 `new Response(body, { status, headers })` 重新构造--更复杂，且可能丢失响应头。

**理由**：clone 简单可靠，Node.js/Bun 的 fetch Response 均支持。性能上仅 429 时才 clone，非 429 无开销。

### 决策 2：关键字匹配区分 429 类型

**选择**：读取 `JSON.parse(body).error.message`，不区分大小写检查是否同时含 `exceeded` 与 `quota`。匹配则为配额耗尽，否则为请求太快。

**替代方案**：
- 匹配 `too frequent` 识别请求太快--但未知 429 无法归类
- 精确匹配完整文案--火山微调文案即失效

**理由**：`exceeded` + `quota` 是配额耗尽的核心特征词，跨 weekly/monthly 版本通用。fallback 策略：不匹配或 JSON 解析失败时按请求太快（`cooldownMs`）处理，不会误熔断 1 小时。

### 决策 3：固定 `quotaCooldownMs` 而非解析 reset 时间

配额耗尽错误含 `It will reset at 2026-08-05 23:59:59 +0800 CST`，理论上可解析精确熔断。

**选择**：固定 `quotaCooldownMs`（默认 1 小时），不解析 reset 时间。

**理由**：
- 解析时间字符串涉及跨时区处理，复杂度高
- 1 小时后重试如果仍配额耗尽则再熔断 1 小时，靠重试自然收敛
- 配额重置时刻附近可能恰好命中，固定时长不会错过

### 决策 4：`markCooldown` 重载支持自定义时长

**选择**：`markCooldown(key: string, ms?: number)`，不传 `ms` 时用 `this.cooldownMs`（现有行为）。

**替代方案**：新增 `markQuotaCooldown(key)` 方法--接口更明确但冗余。

**理由**：重载简洁，调用方 `pool.markCooldown(entry.key, isQuota ? quotaCooldownMs : cooldownMs)` 一行搞定。

### 决策 5：冷却日志格式

现有格式：`WARN  cooldown provider=xxx key=#0(..2898) 60000ms`

**选择**：在时长前插入类型标签：`WARN  cooldown provider=xxx key=#0(..2898) rate-limit 60000ms` / `... quota-exhausted 3600000ms`

**理由**：向后不兼容日志格式，但日志是给人读的，新增字段不影响程序逻辑。类型标签放在时长前，可 grep `quota-exhausted` 快速筛查配额耗尽事件。

## Risks / Trade-offs

- **[响应体格式变化]** 火山引擎微调 429 文案 -> 关键字不匹配 -> fallback 到 rate-limit（60s），不会误熔断 1 小时，安全降级
- **[响应体非 JSON]** `JSON.parse` 失败 -> catch 后 fallback 到 rate-limit
- **[clone 开销]** 仅 429 时 clone，正常请求无额外开销；429 本身是异常路径，clone 的微小开销可忽略
- **[日志格式变更]** 现有日志解析脚本可能依赖旧格式 -> 新增字段在末尾，`grep cooldown` 仍有效；README 日志示例同步更新
