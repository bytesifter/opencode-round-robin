## Context

当前插件按 baseURL 分组，组内随机选 key，只替换 Authorization 头。用户要求：所有 provider 放一个扁平列表，每次请求随机选一个 provider，key 和 baseURL 一起换。全部熔断时 passthrough 回退到 opencode 原生。

当前模块：
- `types.ts`: `ParsedPool`（match/keys/keyAccounts/cooldownMs）
- `pool.ts`: `KeyPool`（per-key cooldown，`next()` 返回 key）
- `config.ts`: `buildPoolsFromProviders`（按 baseURL 分组）
- `fetch-patch.ts`: `patchFetch`（matchPool 找 pool，只换 Authorization）
- `index.ts`: 含调试代码（try-catch + console.error）

## Goals / Non-Goals

**Goals:**

- 所有 provider 扁平列表，随机选一个，key + baseURL 一起换
- 全部熔断时 passthrough（不兜底随机）
- 429 熔断 per-provider，cooldownMs 可配
- 删除调试代码，修 session 截取长度

**Non-Goals:**

- 不改日志格式/轮转（已在 improve-logging-and-bundling 完成）
- 不改 stats 统计逻辑
- 不改 chart 工具
- 不实现熔断恢复探测（半开状态）

## Decisions

### 决策 1: URL 替换 -- 提取路径拼接

**选择**: 请求进来时，找到原始 baseURL（URL 以某个 provider 的 baseURL 开头），提取剩余路径，拼到选中 provider 的 baseURL 上。

```
请求 URL: https://ark.../coding/v3/chat/completions
原始 baseURL: https://ark.../coding/v3
路径: /chat/completions
选中 provider baseURL: https://ark.../plan/v3
新 URL: https://ark.../plan/v3/chat/completions
```

**理由**: opencode 的请求 URL 总是以 provider 的 baseURL 为前缀。提取前缀后的路径拼接到新 baseURL 即可。

**边界**: 如果 URL 不匹配任何已配置 baseURL（请求发到非配置的 provider），passthrough。

### 决策 2: 全熔断 passthrough 而非兜底随机

**选择**: `next()` 返回 `ProviderEntry | null`。返回 null 时 `patchFetch` passthrough 原始请求。

**理由**: 全部熔断意味着所有 provider 都在 429 冷却中。兜底选一个大概率还是 429。passthrough 让 opencode 用原生 provider 配置发请求，至少不会比兜底更差。

**替代方案**: 兜底选最早熔断的（最可能已恢复）-- 增加复杂度，收益不确定。

### 决策 3: ProviderEntry 扁平结构

**选择**: 用 `ProviderEntry` 替代 `ParsedPool`：

```typescript
interface ProviderEntry {
  key: string
  baseURL: string
  account: string
}
```

`KeyPool`（或改名 `ProviderPool`）持有 `ProviderEntry[]`，cooldown 以 `key` 为标识（每个 provider 一个 key，key 唯一标识 provider）。

**理由**: 一个 provider = 一个 key + 一个 baseURL + 一个 account 名。不需要分组，不需要 match 字段。

### 决策 4: config hook 不再需要读 Config.provider

**选择**: `collectProviders` 只从 `parseOptions` 的结果构建，不需要 `config` hook 读取 opencode 的 `Config.provider`。

**理由**: 当前 `buildPoolsFromProviders` 需要 `config` hook 因为它从 `Config.provider` 读取 `apiKey` 和 `baseURL`。但插件 options 里只配了 provider 名列表，需要从 opencode config 查实际的 key 和 URL。

**修正**: 仍需 `config` hook 读取 `Config.provider`。`collectProviders(config, providerNames)` 返回 `ProviderEntry[]`。与当前 `buildPoolsFromProviders` 类似，但不分组。

### 决策 5: session 截取 8 位

**选择**: `sessionID.slice(0, 8)` -> `ses_065e`（比 `ses_` 有区分度）。

## Risks / Trade-offs

- **[URL 替换可能破坏非标准路径]** 某些 provider 的 API 路径可能不以 baseURL 为前缀。-> 只在 URL 匹配已配置 baseURL 时才替换，否则 passthrough。

- **[全熔断 passthrough 可能用错 key]** passthrough 使用 opencode 原生 provider 配置（model 配置指向的 provider），不是随机选的。-> 这是预期行为，全熔断时回退到 opencode 默认。

- **[跨端点请求可能行为不同]** coding/v3 和 plan/v3 可能返回不同格式的响应。-> 用户已确认所有 provider 服务相同模型（glm-5.2），端点差异由 API 侧处理。
