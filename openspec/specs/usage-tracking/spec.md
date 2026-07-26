### Requirement: 按天累计请求数与 token

插件 SHALL 通过 `event` hook 监听 `message.updated` 事件。当事件 `properties.info` 为 `AssistantMessage` 且含 `tokens` 字段时,SHALL 按当天日期(本地时区 `YYYY-MM-DD`)累计请求数与 token。

#### Scenario: 收到带 usage 的 AssistantMessage

- **WHEN** `message.updated` 事件的 `info` 含 `tokens` 字段且 `info.role` 为 assistant
- **THEN** 插件 SHALL 在当天统计项中:`req` 加 1,`in` 累加 `tokens.input`,`out` 累加 `tokens.output`,`reasoning` 累加 `tokens.reasoning`,`cacheRead` 累加 `tokens.cache.read`,`cacheWrite` 累加 `tokens.cache.write`,`cost` 累加 `info.cost`

#### Scenario: 收到无 usage 的消息更新

- **WHEN** `message.updated` 事件的 `info` 不含 `tokens` 字段(如流式中途更新)
- **THEN** 插件 SHALL 忽略该事件,不累计

### Requirement: 内存累积与定时刷盘

插件 SHALL 在内存对象上累积统计,定时器每 60 秒将内存统计整体写入 JSON 文件一次。进程退出时 SHALL 兜底刷盘一次。

#### Scenario: 事件触发只改内存

- **WHEN** 统计事件发生
- **THEN** 插件 SHALL 只更新内存对象,不立即写磁盘

#### Scenario: 定时器触发刷盘

- **WHEN** 距上次刷盘已满 60 秒
- **THEN** 插件 SHALL 将内存统计整体写入 JSON 文件

#### Scenario: 进程退出刷盘

- **WHEN** 进程收到 `beforeExit`/`SIGINT`/`SIGTERM`
- **THEN** 插件 SHALL 最后刷盘一次,避免丢失最近统计

### Requirement: JSON 文件存储结构

统计文件 SHALL 为 JSON,路径默认 `~/.local/share/opencode/round-robin-stats.json`(可由 `statsPath` 配置)。结构为以日期为 key 的对象。

#### Scenario: 存储结构

- **WHEN** 读取统计文件
- **THEN** 内容形如 `{ "2026-07-25": { req, in, out, reasoning, cacheRead, cacheWrite, cost } }`,每个日期对应当天累计

### Requirement: 图表查询工具

插件 SHALL 注册名为 `roundrobin_stats` 的工具,执行时返回近 N 天(默认 7)的 ASCII 柱状图,包含请求数与 token 消耗两列。工具参数 SHALL 支持可选 `days` 指定天数。

#### Scenario: 调用工具返回图表

- **WHEN** 调用 `roundrobin_stats` 工具(无参数)
- **THEN** 工具 SHALL 返回近 7 天的 ASCII 柱状图字符串,每行一个日期,含请求数柱与 token 柱

#### Scenario: 指定天数

- **WHEN** 调用 `roundrobin_stats` 工具且参数 `days` 为 30
- **THEN** 工具 SHALL 返回近 30 天的图表

#### Scenario: 无数据

- **WHEN** 统计文件不存在或为空
- **THEN** 工具 SHALL 返回提示"暂无统计数据"
