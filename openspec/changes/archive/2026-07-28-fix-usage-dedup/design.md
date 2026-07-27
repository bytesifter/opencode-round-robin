## Context

插件 `opencode-round-robin` 的统计与日志在 `message.updated` 事件层存在去重缺失。用户实际观测:一个普通请求被统计为几百万 token。

根因调查:

- opencode 流式生成期间,每收到一个 SSE chunk 都会更新内存中的 `AssistantMessage` 对象并发出一次 `message.updated` 事件(见 `EventMessageUpdated` schema,`@opencode-ai/sdk/dist/gen/types.gen.d.ts:129-132`)。
- `AssistantMessage.tokens` 是**必填**字段(`types.gen.d.ts:117-125`),且每次更新都是**截至此刻的累计快照**(非增量)。这推翻了归档 change `init-plugin/design.md:161` 的核心假设("流式中途的更新可能无 tokens,只在 tokens 存在时累计")。
- 当前 `recordUsage`(`src/stats.ts:51-63`)每次调用都 `req++` 并累加 `tokens.*`,无任何幂等键。`if (!info.tokens) return` 实际只挡住 `UserMessage`(`UserMessage` 无 tokens 字段),所有 assistant 流式快照全部被重复累加。
- 后果量化(假设一条消息触发 N=10 次更新):`req` = 10(应=1);`in` = 100×10(每次快照累加,应=100);`out` = 20+50+80+...+500(等差数列和,应=500)。
- 同源的 `logUsage`(`src/index.ts:81-93`)在无守卫的情况下被调用,日志产生 N 行重复。
- 附带 bug: `src/index.ts:79` 的 `e.properties.sessionID` 取错位置(SDK 类型显示 `properties` 内只有 `info`),sessionID 应从 `info.sessionID` 取。

关键事实(SDK 类型确认):

```ts
// types.gen.d.ts:98-127
export type AssistantMessage = {
    id: string;            // ← 稳定主键,可用作幂等键
    sessionID: string;     // ← sessionID 在 info 内,非 properties 顶层
    role: "assistant";
    time: { created: number; completed?: number };
    cost: number;
    tokens: { ... };       // ← 必填,累计快照
    finish?: string;       // ← 完成信号(可选,"stop"/"length"/...)
};
```

## Goals / Non-Goals

**Goals:**

- 同一条 assistant 消息(`info.id` 相同)在统计与日志中只产生一次记录,且记录的是**终态完整快照**
- 修复 sessionID 取值,日志的 `session` 字段不再恒为 undefined
- 不破坏现有统计文件格式(`StatsStore` 结构不变)
- 测试覆盖去重、finish 触发、beforeExit 兜底三个关键路径

**Non-Goals:**

- 不回溯修正历史虚高数据(用户自行决定是否删除 `round-robin-stats.json`)
- 不处理 `UserMessage`(本就无 tokens,不在统计范围)
- 不引入 stale 超时机制(见决策 2)
- 不重构 `Logger` / `ProviderPool` / `chart` 模块

## Decisions

### 决策 1: 去重键用 `info.id`(message id)

**选择**: 以 `AssistantMessage.id`(string,稳定主键)作为幂等键。

**理由**: `id` 是 opencode 为每条消息分配的稳定标识,同一消息的所有 `message.updated` 事件 `info.id` 相同。语义清晰("同一条消息只统计一次")。

**替代方案**: (1) `sessionID + 时间窗口` -- 不稳定,同 session 多条消息会冲突。(2) `time.created` -- 同一消息的 `time.created` 在所有更新中一致(可用),但语义不如 `id` 直观。(3) 不去重,改在 fetch 层从 SSE 末尾 chunk 提取 usage -- 违背"决策 4:用 event hook 而非解析 SSE"的历史设计。

### 决策 2: 提交时机 -- `finish` 触发为主,`beforeExit` 兜底(不引入 stale 超时)

**选择**: `recordUsage` 内部维护 `buffer: Map<id, UsageInput>` 与 `committed: Set<id>`:

```
recordUsage(info):
  if !info.id or committed.has(info.id): return false
  buffer.set(info.id, info)              // 始终覆盖最新快照
  if info.finish:
    commitToStore(buffer.get(info.id))   // 提交最新快照
    buffer.delete(info.id)
    committed.add(info.id)
    return true
  return false

flush():           只刷盘 store,不动 buffer
stop/beforeExit:   提交 buffer 全部残留 -> 刷盘   // 兜底
```

**理由**:

- `tokens` 是**累计快照**,必须取终态值。"首次见即锁定"会记到流式早期的部分快照(`out=20` 而非最终的 `out=500`),错误。buffer 保留最新快照,`finish` 出现时提交,确保取到完整值。
- buffer 的额外价值:即使 `finish` 那次事件的快照理论上不完整(实际不会发生,因为 opencode 持有整个 Message 对象,finish 与最终 tokens 同在一次快照),仍取最新值。这是相对"纯 A-finish"(首次见 finish 即记录)的保险。
- `beforeExit` 兜底抓住正常关闭时的进行中消息(取最后看到的快照)。
- **不引入 stale 超时**(如"30 秒无新 chunk 视为完成"):为低概率的 abort 场景引入魔法数与定时扫描复杂度,性价比低。

**代价 / 已知限制**:

- 若消息被 abort(无 `finish` 且进程不退出),该消息卡在 buffer 永不提交 -> 漏统计。概率极低(异常路径,且 abort 本就不产生正常用量),接受。
- `beforeExit` 兜底提交时,日志无法同步记录(进程即将退出,Logger 同步写不可靠) -> 该路径日志丢失,仅统计入库。接受。

**替代方案**: (1) 纯 A-finish(`if (info.finish && !seen.has(id))` 单行,无 buffer) -- 实现最简,但失去 buffer 的"取最新"保险与 beforeExit 兜底能力。(2) 纯 stale 超时(buffer 项带 lastSeenAt,flush 时提交超时项)-- 鲁棒性最高但需选 N 值且增加扫描逻辑,过度设计。

### 决策 3: 去重状态封装在 `StatsCollector`,通过返回值驱动日志

**选择**: `recordUsage` 返回 `boolean`(本次是否触发提交)。`index.ts` 据此决定是否调用 `logUsage`:

```
if (globalStats.recordUsage(info)) {
  globalLogger.logUsage(info.tokens, info.cost, ctx)
}
```

**理由**: 去重真相源唯一(`StatsCollector` 的 `committed` 集合),避免在 `Logger` 里复制一套 buffer/committed。日志与统计自然同步,不会出现"统计了但没记日志"或反之。

**代价**: `beforeExit` 兜底提交的路径无法触发 `logUsage`(返回值无人接收) -> 该路径仅统计入库,日志丢失。与决策 2 的已知限制一致。

**替代方案**: (1) `Logger` 内部也维护一份 committed 集合 -- 逻辑重复,且两份状态可能不一致。(2) 在 `index.ts` event handler 层维护 committed 集合,`recordUsage` 仅接收 id 做幂等 -- 职责错位,且 buffer 暂存逻辑被迫上浮到入口层。

### 决策 4: `UsageInput` 新增必填 `id`

**选择**: `UsageInput`(`src/stats.ts`)接口增加 `id: string`(必填)。

**理由**: 去重依赖 id,缺 id 的事件无法安全统计(要么漏去重导致重复,要么按"无 id"统一处理会丢失)。强制必填让类型系统在编译期守住入口。`AssistantMessage.id` 始终存在,实际不会缺。

**兼容性**: 现有 `tests/stats.test.ts` 的 `recordUsage` 调用未传 id,需在实现阶段补全(已在 tasks 列出)。

### 决策 5: sessionID 来源修正(`info.sessionID` 而非 `e.properties.sessionID`)

**选择**: 从 `info.sessionID` 取值并截短为前 8 位,而非当前的 `e.properties.sessionID`。

**理由**: SDK 类型 `EventMessageUpdated`(`types.gen.d.ts:129-132`)显示 `properties` 仅含 `info`,`sessionID` 在 `info.sessionID`(`types.gen.d.ts:100`)。当前取法恒为 undefined。

**截短长度**: 沿用现状的 8 位(`index.ts:83` 当前代码与 `structured-logging` spec 均为 8 位),本 change 不改动长度策略,仅修正取值来源。

### 决策 6: 历史数据不回溯修正

**选择**: 不编写脚本回溯修正 `round-robin-stats.json` 中的虚高历史数据。

**理由**: 历史数据已被污染且无法精确还原(无法从"等差数列和 + 虚高 req"反推真实值)。用户可自行决定是否删除统计文件重计。`proposal.md` 的 Impact 段会说明这一点。

## Risks / Trade-offs

- **[abort 漏统计]** 消息被中断(无 `finish` 且进程不退出)时,该消息卡在 buffer 永不入库。-> 接受。abort 是异常路径,本就不产生正常用量。若未来证明是问题,可独立小 change 增加 stale 超时兜底。

- **[beforeExit 路径日志丢失]** 进程退出时 buffer 兜底提交,但对应日志行无法同步写入。-> 接受。统计入库优先于日志,且进程退出场景本就异常。

- **[committed 集合无限增长]** 长时间运行的进程,`committed` Set 持续累积 id。-> 单进程一天几百到几千条消息,UUID 字符串内存占用 KB 级,可忽略。若需清理可在 flush 后重置(因已落盘的不会再来,但为防迟到 chunk 建议保留至进程结束)。

- **[buffer 在崩溃时丢失]** 进行中消息(buffer 内未提交)在进程异常崩溃(SIGKILL/段错误)时丢失。-> 原设计就有"崩溃最多丢 60s 统计"的承诺,buffer 丢失与之同量级,可接受。

- **[finish 字段语义依赖 opencode 实现]** 本方案依赖"opencode 在消息正常完成时一定填 `finish`"。-> 这是 OpenAI/Anthropic 标准 finish_reason 的对应物,opencode 必然填入。实现阶段需在真实环境验证(spike)。
