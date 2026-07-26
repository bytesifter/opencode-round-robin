### Requirement: providers 配置必填

`options.providers` SHALL 为非空字符串数组。未配或为空时插件 SHALL 抛出错误且不安装 fetch-patch。

#### Scenario: 缺少 providers

- **WHEN** `options` 未提供 `providers` 或为空数组
- **THEN** 插件 SHALL 抛出配置错误,不安装 fetch-patch

#### Scenario: provider 名不存在

- **WHEN** `providers` 列表中某名字在 `Config.provider` 中不存在
- **THEN** 插件 SHALL 抛出配置错误

### Requirement: 从 provider 配置收集扁平列表

插件 SHALL 通过 `config` hook 读取 opencode 的 `Config.provider`,过滤出 `options.providers` 列表中的 provider,读取各自的 `baseURL` 与 `apiKey`,收集为扁平 `ProviderEntry[]` 列表。SHALL NOT 按 baseURL 分组。key SHALL 去重(相同 key 只保留第一个)。

#### Scenario: 收集所有 provider 为扁平列表

- **WHEN** `options.providers = ["volxc9208","volxc5425","vollqh5426","volxc9208-agentplan"]`
- **THEN** 插件 SHALL 返回 4 个 `ProviderEntry`(各自含 key/baseURL/account),不分组

#### Scenario: key 自动去重

- **WHEN** 同一 `apiKey` 出现在多个 provider 中
- **THEN** 插件 SHALL 去重,只保留第一个

### Requirement: 随机选 provider 并替换 key + URL

插件 SHALL 从所有已配置 provider 中随机选择一个(跳过熔断中的),将其 key 和 baseURL 同时应用到请求上。SHALL NOT 按 baseURL 分组。SHALL NOT 仅替换 Authorization 头。

#### Scenario: 正常请求随机选 provider

- **WHEN** fetch 拦截器收到一个 URL 匹配某已配置 baseURL 的请求
- **THEN** 插件 SHALL 从所有非熔断 provider 中随机选一个
- **AND** SHALL 将请求 URL 替换为选中 provider 的 baseURL + 原始路径
- **AND** SHALL 将 Authorization 头替换为选中 provider 的 key

#### Scenario: URL 不匹配任何已配置 baseURL

- **WHEN** 请求 URL 不以任何已配置 provider 的 baseURL 开头
- **THEN** 插件 SHALL passthrough 原始请求,不修改 URL 和 headers

#### Scenario: 路径提取与拼接

- **WHEN** 原始 URL 为 `https://host/coding/v3/chat/completions`
- **AND** 原始 baseURL 为 `https://host/coding/v3`
- **AND** 选中 provider 的 baseURL 为 `https://host/plan/v3`
- **THEN** 新 URL SHALL 为 `https://host/plan/v3/chat/completions`

### Requirement: 全部熔断时 passthrough

当所有 provider 都处于熔断状态时,插件 SHALL passthrough 原始请求,不修改 URL 和 headers。SHALL NOT 兜底随机选一个 provider。

#### Scenario: 全部 provider 熔断

- **WHEN** 所有 provider 都在熔断冷却中
- **AND** 一个请求进来
- **THEN** 插件 SHALL passthrough 原始请求
- **AND** SHALL NOT 修改 URL 或 Authorization

#### Scenario: providers 列表为空

- **WHEN** providers 配置为空数组
- **THEN** 插件 SHALL passthrough 所有请求

### Requirement: 429 熔断 per-provider

收到 429 响应时,插件 SHALL 标记该 provider 熔断,在 `cooldownMs`(默认 60000ms,可配)内不再选用。熔断到期后自动恢复。

#### Scenario: 429 标记熔断

- **WHEN** 某 provider 的请求返回 429
- **THEN** 该 provider SHALL 被标记熔断 cooldownMs 毫秒
- **AND** 后续 `next()` SHALL 跳过该 provider

#### Scenario: 熔断到期恢复

- **WHEN** 某 provider 的熔断时间已过
- **THEN** 该 provider SHALL 恢复可用
- **AND** `next()` 可能选中该 provider

#### Scenario: 部分 provider 熔断时仍随机选

- **WHEN** 4 个 provider 中 1 个熔断
- **THEN** `next()` SHALL 从剩余 3 个非熔断 provider 中随机选
