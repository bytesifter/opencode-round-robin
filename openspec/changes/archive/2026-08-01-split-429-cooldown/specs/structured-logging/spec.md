## ADDED Requirements

### Requirement: 冷却日志区分类型

429 冷却日志 SHALL 包含类型标签(`rate-limit` 或 `quota-exhausted`)与实际冷却时长(毫秒)。类型标签 SHALL 基于响应体判断:配额耗尽(`error.message` 含 `exceeded` 与 `quota`)记为 `quota-exhausted`,其他 429(含响应体不可读)记为 `rate-limit`。日志格式 SHALL 为 `WARN  cooldown provider=<账号> key=#<序号>(..<末4位>) <类型> <时长>ms`。

#### Scenario: 请求太快冷却日志

- **WHEN** 某 provider 收到请求太快 429 并被标记短熔断
- **THEN** 冷却日志 SHALL 包含 `rate-limit` 标签与 `cooldownMs` 时长

#### Scenario: 配额耗尽冷却日志

- **WHEN** 某 provider 收到配额耗尽 429 并被标记长熔断
- **THEN** 冷却日志 SHALL 包含 `quota-exhausted` 标签与 `quotaCooldownMs` 时长

#### Scenario: 响应体不可读时记 rate-limit

- **WHEN** 某 provider 收到 429 但响应体无法读取或 JSON 解析失败
- **THEN** 冷却日志 SHALL 记为 `rate-limit` 标签与 `cooldownMs` 时长
