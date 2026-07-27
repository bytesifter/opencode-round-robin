## MODIFIED Requirements

### Requirement: event 层业务上下文

event 层日志 SHALL 包含以下业务字段: `session`(从 `info.sessionID` 截短为前 8 位)、`model`(modelID)、`provider`(providerID)、`mode`(模式)、`agent`(agent 名)。SHALL NOT 记录完整 sessionID(隐私)。`session` 字段 SHALL 从 `info.sessionID`(`AssistantMessage.sessionID`)提取,SHALL NOT 从 `event.properties` 顶层提取(后者不存在该字段)。同一 `info.id` 的消息 SHALL 至多产生一行 event 层日志(与统计的去重真相源同步)。

#### Scenario: 终态消息记一行日志且含完整业务上下文

- **WHEN** `message.updated` 事件的 `info.role` 为 `assistant`、`info.tokens` 存在、`info.finish` 存在,且 `info.id` 未被记过日志
- **THEN** 日志行 SHALL 写入一行,包含 `session`/`model`/`provider`/`mode`/`agent` 字段
- **AND** `session` 字段 SHALL 为 `info.sessionID` 的前 8 位(非完整值)

#### Scenario: 流式中途更新不记日志

- **WHEN** `message.updated` 事件的 `info` 不含 `finish`(流式中途更新)
- **THEN** SHALL NOT 写入 event 层日志行

#### Scenario: 同一消息 id 不重复记日志

- **WHEN** `message.updated` 事件的 `info.id` 已被记过日志(统计层已提交该 id)
- **THEN** SHALL NOT 再次写入 event 层日志行

#### Scenario: sessionID 来源为 info.sessionID

- **WHEN** `message.updated` 事件触发且 `info.finish` 存在
- **THEN** `session` 字段 SHALL 取自 `info.sessionID`
- **AND** SHALL NOT 取自 `event.properties.sessionID`(该字段不存在)
