## Why

当前统计与日志在 `message.updated` 事件层存在三个同源缺陷,导致统计数据严重失真(用户观测到"一个普通请求统计为几百万 token"):

1. **统计无去重(主 bug)**: `StatsCollector.recordUsage`(`src/stats.ts:51-63`)无任何幂等机制。opencode 在流式生成期间对同一条 assistant 消息触发 N 次 `message.updated`(每个 SSE chunk 一次),且 `AssistantMessage.tokens` 是**必填的累计快照**(见 `@opencode-ai/sdk` 的 `types.gen.d.ts:98-127`,并非原 design 假设的"流式中途可能无 tokens")。当前 `if (!info.tokens) return` 实际只挡住了 `UserMessage`,一条 assistant 消息的全部流式快照被重复累加。后果:`req` 虚高 N 倍,`in` 虚高 N 倍(每次都是累计快照),`out` 变成等差数列和(20+50+...+500),长回复轻松破百万。

2. **日志同样重复(同源 bug)**: `globalLogger.logUsage`(`src/index.ts:81-93`)在同一 event handler 内被无守卫调用,日志同样产生 N 行重复 token 记录。

3. **sessionID 取错位置(次 bug)**: `src/index.ts:79` 取 `e.properties.sessionID`,但 SDK 类型 `EventMessageUpdated`(`types.gen.d.ts:129-132`)显示 `properties` 内只有 `info`,`sessionID` 在 `info.sessionID`。导致日志的 `session` 字段恒为 undefined。

## What Changes

### 去重核心(A-buffer 方案)

- `StatsCollector` 内部引入按消息 id 的暂存区与已提交集合:
  - `buffer: Map<messageId, UsageInput>` -- 进行中消息的**最新快照**(每次覆盖)
  - `committed: Set<messageId>` -- 已提交 id,防止 `finish` 后迟到 chunk 重复触发
- `recordUsage(info)` 行为:
  - 缺 `info.id` 或已在 `committed` 中 -> 忽略
  - 否则覆盖 `buffer[id] = info`
  - 若 `info.finish` 存在 -> 把该 id 的 buffer 快照合并进 store,移出 buffer,加入 committed,返回 `true`(表示本次实际提交)
  - 否则返回 `false`
- `flush()`:只刷盘 store,**不动** buffer(进行中的消息不在 flush 时部分提交)
- `beforeExit` / `stop()`:先把 buffer 全部残留合并进 store(兜底),再刷盘

### 类型与接口

- `UsageInput`(`src/stats.ts`)新增必填 `id: string` 字段
- `recordUsage` 返回类型由 `void` 改为 `boolean`(供 index.ts 决定是否同步记日志)

### index.ts event handler 改造

- 从 `info.id` 取消息 id 传入 `recordUsage`
- `logUsage` 改为仅在 `recordUsage` 返回 `true` 时调用(共享同一去重真相源)
- sessionID 来源从 `e.properties.sessionID` 修正为 `info.sessionID`

## Capabilities

### Modified Capabilities

- `usage-tracking`: "按天累计"的 SHALL 语义从"收到带 tokens 即累计"改为"同一 message id 的终态消息累计一次",补充 id 去重、finish 终态触发、beforeExit 兜底三个场景
- `structured-logging`: "event 层业务上下文"补充"同 id 仅记一次日志"约束;sessionID 来源从 `event.properties` 修正为 `info.sessionID`

## Impact

- **src/stats.ts**: `UsageInput` 加 `id`;`StatsCollector` 新增 `buffer`/`committed` 成员;`recordUsage` 改返回 `boolean`;`stop`/`onBeforeExit` 增加 buffer 兜底提交
- **src/index.ts**: event handler 传 `info.id`;`logUsage` 条件化;sessionID 取值修正(从 `info.sessionID` 截短)
- **tests/stats.test.ts**: 现有用例补 `id` 字段;新增"同 id 多次仅计一次""无 finish 不计""finish 触发提交""beforeExit 兜底"用例
- **openspec/specs/usage-tracking/spec.md**: 归档时合并 delta
- **openspec/specs/structured-logging/spec.md**: 归档时合并 delta
- **向后兼容**: 统计文件格式 (`StatsStore`) 不变;已有用户数据无需迁移(历史虚高数据不回溯修正,由用户判断是否删除 `round-robin-stats.json` 重计)
