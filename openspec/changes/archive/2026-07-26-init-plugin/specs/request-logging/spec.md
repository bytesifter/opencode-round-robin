## ADDED Requirements

### Requirement: fetch 层请求日志

插件 SHALL 在每次匹配 pool 的 fetch 请求收到响应后,向日志文件 append 一行结构化日志,包含:时间戳、账号名(provider 名)、key 序号、key 末 4 位、HTTP 状态码。

#### Scenario: 请求响应后记日志

- **WHEN** 匹配 pool 的请求被拦截并收到响应
- **THEN** 插件 SHALL append 一行,含时间戳、账号名、`key#序号`、末 4 位、状态码

#### Scenario: 不匹配 pool 的请求不记日志

- **WHEN** 请求不匹配任何 pool(透传)
- **THEN** 插件 SHALL 不写日志

### Requirement: event 层 token 日志

插件 SHALL 在 `event` hook 收到带 `tokens` 的 `message.updated` 时,向同一日志文件 append 一行 token 日志,包含:时间戳、`in`/`out`/`reasoning`/`cacheRead`/`cacheWrite`、`cost`。

#### Scenario: 消息完成记 token 日志

- **WHEN** `message.updated` 的 `info` 含 `tokens` 字段
- **THEN** 插件 SHALL append 一行,含时间戳与各 token 分量及 cost

#### Scenario: 无 tokens 的更新不记 token 日志

- **WHEN** `message.updated` 的 `info` 不含 `tokens`(流式中途更新)
- **THEN** 插件 SHALL 不写 token 日志

### Requirement: 日志文件位置

日志文件 SHALL 默认位于 `~/.local/share/opencode/round-robin.log`,路径可由 `logPath` 配置覆盖。

#### Scenario: 默认路径

- **WHEN** 未配置 `logPath`
- **THEN** 日志写入 `~/.local/share/opencode/round-robin.log`

#### Scenario: 自定义路径

- **WHEN** 配置了 `logPath`
- **THEN** 日志写入配置指定路径

### Requirement: 不记录 key 明文

日志 SHALL 只记录 key 的序号与末 4 位,禁止记录完整 API key。账号名(provider 名)非敏感信息,可明文记录。

#### Scenario: 日志中的 key 信息

- **WHEN** 写入 fetch 层日志行
- **THEN** key 相关字段只含序号(如 `key#0`)与末 4 位(如 `..a5b`),不含完整 key 字符串;账号名明文记录

### Requirement: 429 事件记日志

当 key 收到 429 并被标记 cooldown 时,SHALL 额外 append 一行日志记录冷却事件。

#### Scenario: 429 冷却日志

- **WHEN** 某 key 的请求返回 429 触发 cooldown
- **THEN** 插件 SHALL append 一行日志,标注 `429` 与 cooldown 时长
