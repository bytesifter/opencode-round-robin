## MODIFIED Requirements

### Requirement: logDir 配置

插件 options SHALL 支持可选 `logDir` 字段(日志目录路径)。日志模式由 `logPath` 和 `logDir` 共同决定,优先级: `logPath > logDir > 默认`。当 `logPath` 存在时,使用 `logPath` 单文件模式(不轮转),忽略 `logDir`。当 `logPath` 不存在时,使用 `logDir`(若存在)或默认目录(`~/.local/share/opencode/`)启用按日轮转模式。

#### Scenario: 均未配置 -- 默认轮转

- **WHEN** `opencode.jsonc` 中未配置 `logDir` 和 `logPath`
- **THEN** 日志 SHALL 写入 `~/.local/share/opencode/round-robin-YYYY-MM-DD.log`(按日轮转)

#### Scenario: 配置 logDir 自定义轮转目录

- **WHEN** `opencode.jsonc` 中配置 `"logDir": "/var/log/opencode"`(无 `logPath`)
- **THEN** 日志 SHALL 写入 `/var/log/opencode/round-robin-YYYY-MM-DD.log`

#### Scenario: 配置 logPath 强制单文件

- **WHEN** `opencode.jsonc` 中配置 `"logPath": "/tmp/rr.log"`(无论是否配 `logDir`)
- **THEN** 日志 SHALL 追加到 `/tmp/rr.log`(单文件,不轮转)
- **AND** `logDir` SHALL 被忽略

#### Scenario: logPath 优先于 logDir

- **WHEN** `opencode.jsonc` 中同时配置 `"logDir": "/d"` 和 `"logPath": "/p.log"`
- **THEN** 日志 SHALL 使用 `logPath` 单文件模式
- **AND** `logDir` SHALL 被忽略
