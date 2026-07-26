## ADDED Requirements

### Requirement: 从 provider 配置构建 pool

插件 SHALL 通过 `config` hook 读取 opencode 的 `Config.provider`,过滤出 `options.providers` 列表中的 provider,读取各自的 `baseURL` 与 `apiKey`,按 `baseURL` 分组构建 `KeyPool[]`。每个 key SHALL 保留其来源 provider 名(账号名)用于日志。

#### Scenario: providers 列表按 baseURL 分组

- **WHEN** `options.providers = ["volxc9208","volxc5425","vollqh5426"]` 且这些 provider 的 `baseURL` 均为 `.../coding/v3`
- **THEN** 插件 SHALL 构建一个 pool(`match=.../coding/v3`,`keys` 为 3 个 `apiKey` 去重后的列表)

#### Scenario: 不同 baseURL 分到不同 pool

- **WHEN** `providers` 含 coding 端点与 plan 端点的 provider
- **THEN** 插件 SHALL 按 `baseURL` 分到不同 pool,各自独立轮询

#### Scenario: 单 key 组透传

- **WHEN** 某 `baseURL` 分组去重后仅 1 个 key
- **THEN** 插件 SHALL 标记该 pool 为 passthrough,匹配该 pool 的请求不拦截

#### Scenario: key 自动去重

- **WHEN** 同一 `baseURL` 下多个 provider 的 `apiKey` 有重复
- **THEN** 插件 SHALL 去重后再判断数量

### Requirement: providers 配置必填

`options.providers` SHALL 为非空字符串数组。未配或为空时插件 SHALL 抛出错误且不安装 fetch-patch。

#### Scenario: 缺少 providers

- **WHEN** `options` 未提供 `providers` 或为空数组
- **THEN** 插件 SHALL 抛出配置错误,不安装 fetch-patch

#### Scenario: provider 名不存在

- **WHEN** `providers` 列表中某名字在 `Config.provider` 中不存在
- **THEN** 插件 SHALL 抛出配置错误

### Requirement: URL 前缀匹配 pool

拦截 fetch 请求时,插件 SHALL 用 `request.url.startsWith(pool.match)` 匹配 pool(`match` 即该 pool 的 `baseURL`)。

#### Scenario: 请求 URL 匹配某 pool

- **WHEN** fetch 请求的 URL 以某 pool 的 `match` 为前缀
- **THEN** 该请求由该 pool 处理(进入选 key 流程)

#### Scenario: 请求 URL 不匹配任何 pool

- **WHEN** fetch 请求的 URL 不以任何 pool 的 `match` 为前缀
- **THEN** 插件 SHALL 透传原始 fetch,不修改任何内容

### Requirement: 随机选择 key

对于非透传 pool,插件 SHALL 在每次匹配请求时从可用 key 中随机选择一个,不维护轮询位置状态。

#### Scenario: pool 有多个可用 key

- **WHEN** pool 有 ≥2 个 key 且至少 1 个未在 cooldown 中
- **THEN** 插件 SHALL 从未冷却的 key 中随机选一个

#### Scenario: 所有 key 都在 cooldown

- **WHEN** pool 所有 key 都在 cooldown 中
- **THEN** 插件 SHALL 忽略 cooldown,从全部 key 中随机选一个(兜底,不阻塞)

### Requirement: 429 cooldown 标记

插件 SHALL 在请求收到 HTTP 429 响应时,对所用 key 标记冷却。冷却时长由全局 `cooldownMs` 配置,默认 60000 毫秒。

#### Scenario: key 收到 429

- **WHEN** 使用某 key 的请求返回 HTTP 429
- **THEN** 插件 SHALL 标记该 key 冷却 `cooldownMs` 毫秒,期间随机选 key 时跳过它

#### Scenario: cooldown 到期

- **WHEN** 某 key 的冷却时间到达
- **THEN** 该 key 重新可用,可被随机选中

### Requirement: Authorization 头注入

对于匹配 pool 的请求,插件 SHALL 设置 `Authorization: Bearer <selected-key>` 头,覆盖原值。

#### Scenario: 匹配 pool 的请求设置 Authorization

- **WHEN** 请求匹配到某非透传 pool
- **THEN** 插件 SHALL 将请求的 `Authorization` 头设为 `Bearer <随机选中的 key>`,再发起原始 fetch
