## Why

当前插件只替换 Authorization 头，按 baseURL 分组后在组内随机选 key。这导致：coding 请求只能用 coding 端点的 key，plan 请求只能用 plan 端点的 key，4 个 provider 被拆成 2 组无法跨端点轮询。用户期望"配 N 个 provider，每次请求随机选一个，key 和端点一起换"，让所有 provider 都参与轮询。同时当前全部 key 熔断时仍兜底选一个（可能持续 429），应该改为 passthrough 回退到 opencode 原生请求。

## What Changes

### 插件接管 provider 选择

- **BREAKING**: `patchFetch` 不仅替换 Authorization 头，还替换请求 URL。从所有 provider 中随机选一个，将其 key 和 baseURL 一起应用到请求上
- 请求 URL 处理：提取原始 baseURL 之后路径（如 `/chat/completions`），拼接到选中 provider 的 baseURL 上
- 不再按 baseURL 分组，所有 provider 在一个扁平列表中

### 熔断 fallback 改为 passthrough

- **BREAKING**: 全部 provider 熔断时，不再兜底随机选一个，而是 passthrough 原始请求（用 opencode 原生的 provider 配置）
- providers 列表为空时也 passthrough
- 429 标记该 provider 熔断，冷却时长 `cooldownMs`（可配，默认 60000ms，已实现）

### 清理调试代码

- 删除 `src/index.ts` 中的 `try-catch` + `console.error` 调试代码（上次调试遗留）

### session 截取长度

- sessionID 截取从 4 位改为 8 位（`ses_` 前缀无区分度）

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `key-rotation`: 插件接管 provider 选择（换 key + 换 URL），不再按 baseURL 分组；全部熔断时 passthrough 而非兜底随机

## Impact

- **src/types.ts**: `ParsedPool` 替换为 `ProviderEntry`（key + baseURL + account）；删除 `match`/`keys`/`keyAccounts` 分组字段
- **src/pool.ts**: `KeyPool` 重构为扁平 provider 列表；`next()` 返回 `ProviderEntry | null`（null = 全熔断）；删除 `match`/`passthrough` 相关代码
- **src/config.ts**: `buildPoolsFromProviders` 改为 `collectProviders`（不分组，返回扁平列表）
- **src/fetch-patch.ts**: `patchFetch` 改为替换 URL + Authorization；全熔断时 passthrough；删除 `matchPool`
- **src/index.ts**: 删除调试代码；session 截取改 8 位；适配新类型
- **tests/**: 全面更新（pool/config/fetch-patch 测试重写）
- **README.md**: 更新功能描述和配置说明
