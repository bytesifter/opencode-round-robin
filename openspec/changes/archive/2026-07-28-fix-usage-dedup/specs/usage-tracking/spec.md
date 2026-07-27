## MODIFIED Requirements

### Requirement: 按天累计请求数与 token

插件 SHALL 通过 `event` hook 监听 `message.updated` 事件。同一 `info.id` 的消息 SHALL 至多累计一次,且取**终态完整快照**(由 `info.finish` 存在判定)。统计 SHALL 在内存对象上累积,定时器每 60 秒整体刷盘一次;进程退出时 SHALL 兜底刷盘,且在刷盘前 SHALL 把暂存区中未提交的进行中消息(无 `finish` 的残留快照)一并合并提交。

#### Scenario: 终态消息累计一次

- **WHEN** `message.updated` 事件的 `info` 含 `tokens` 字段、`info.role` 为 `assistant`、`info.finish` 存在,且 `info.id` 未被累计过
- **THEN** 插件 SHALL 在当天统计项中:`req` 加 1,`in` 累加 `tokens.input`,`out` 累加 `tokens.output`,`reasoning` 累加 `tokens.reasoning`,`cacheRead` 累加 `tokens.cache.read`,`cacheWrite` 累加 `tokens.cache.write`,`cost` 累加 `info.cost`
- **AND** 累计的 SHALL 是该 `info.id` 暂存的**最新快照**(流式期间多次更新取最后一次,而非首次部分快照)

#### Scenario: 同一消息 id 的流式中途更新不立即累计

- **WHEN** `message.updated` 事件的 `info` 不含 `finish`(流式中途更新)
- **THEN** 插件 SHALL 更新该 `info.id` 的内存暂存快照(覆盖为最新值),SHALL NOT 立即累计到当天统计

#### Scenario: 同一消息 id 重复的终态事件不重复累计

- **WHEN** `message.updated` 事件的 `info.id` 已被累计过(已在 committed 集合中)
- **THEN** 插件 SHALL 忽略该事件,SHALL NOT 再次累计(防止 `finish` 后迟到 chunk 重复触发)

#### Scenario: 缺 id 的事件忽略

- **WHEN** `message.updated` 事件的 `info` 缺 `id` 字段
- **THEN** 插件 SHALL 忽略该事件(无法幂等,不累计)

#### Scenario: 进程退出兜底提交进行中消息

- **WHEN** 进程收到 `beforeExit` / `SIGINT` / `SIGTERM`,且内存暂存区存在未提交的进行中消息(无 `finish` 的残留快照)
- **THEN** 插件 SHALL 把这些残留快照按其最新值合并进当天统计,再刷盘
- **AND** 该路径 SHALL NOT 产生对应的事件层日志(日志丢失为已知限制)

#### Scenario: 事件触发只改内存

- **WHEN** 统计事件发生(含终态累计)
- **THEN** 插件 SHALL 只更新内存对象,SHALL NOT 立即写磁盘

#### Scenario: 定时器触发刷盘

- **WHEN** 距上次刷盘已满 60 秒
- **THEN** 插件 SHALL 将内存统计整体写入 JSON 文件
- **AND** 插件 SHALL NOT 在刷盘时把进行中的暂存快照(无 `finish`)合并提交(仅进程退出兜底路径才提交残留)

## ADDED Requirements

### Requirement: 历史数据不回溯

本 change 不提供历史统计数据修正能力。已写入 `round-robin-stats.json` 的虚高历史数据(由去重缺陷导致)SHALL 保持原样,由用户自行决定是否删除文件后重新累计。

#### Scenario: 不自动修正历史

- **WHEN** 插件加载时读取到含有虚高历史数据的统计文件
- **THEN** 插件 SHALL 正常加载,SHALL NOT 自动修正或删除历史数据
