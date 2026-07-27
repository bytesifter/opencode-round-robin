## 1. 类型定义

- [x] 1.1 在 `src/stats.ts` 的 `UsageInput` 接口新增必填 `id: string` 字段(置于 `role` 前);同时新增 `finish?: string`(task 2.2 需要)
- [x] 1.2 确认 `src/types.ts` 无需改动(`EventContext` 已存在)

## 2. StatsCollector 改造

- [x] 2.1 在 `StatsCollector` 类新增私有成员 `buffer: Map<string, UsageInput> = new Map()` 与 `committed: Set<string> = new Set()`
- [x] 2.2 改写 `recordUsage(info)`:返回类型 `boolean`;缺 `info.id`/`info.tokens` 或 `committed.has(id)` 返回 `false`;否则 `buffer.set(id, info)`;若 `info.finish` 存在,调用 `commitToStore(info)`(`buffer.get(id)` 与刚 set 的 `info` 等价,直接用 `info` 避免非空断言),`buffer.delete(id)`,`committed.add(id)`,返回 `true`;否则返回 `false`
- [x] 2.3 新增私有 `commitToStore(info: UsageInput)`:把单条快照合并进 `this.store[day]`(逻辑同原 `recordUsage` 的累计部分:`req++`、`in/out/reasoning/cacheRead/cacheWrite/cost` 累加);附带 `drainBuffer()` 私有方法供 stop/onBeforeExit 调用
- [x] 2.4 `flush()` 保持不变(只刷盘 store,不动 buffer)
- [x] 2.5 修改 `stop()` 与 `onBeforeExit`:刷盘前先调用 `drainBuffer()`(遍历 `this.buffer` 调用 `commitToStore` 兜底提交全部残留),再 `flush()`
- [x] 2.6 `buffer`/`committed` 通过字段初始化器为空(`= new Map()`/`= new Set()`),`load()` 只加载 `store`,不触碰两者(内存态,不持久化)

## 3. index.ts event handler 改造

- [x] 3.1 `event` hook 中 `info` 类型为 `UsageInput & { sessionID?, ... }`,`UsageInput` 已含必填 `id` 与可选 `finish`,无需额外声明
- [x] 3.2 `recordUsage` 调用改为接收返回值:`const committed = globalStats!.recordUsage(info)`
- [x] 3.3 `logUsage` 调用包裹在 `if (committed)` 内(仅在实际提交时记日志);移除独立的 `if (info.tokens)` 判断(已在 recordUsage 内部处理)
- [x] 3.4 修正 sessionID 取值:从 `info.sessionID`(而非 `e.properties.sessionID`)取,截短为前 8 位传入 `EventContext.sessionID`;同时从类型签名的 `properties` 移除 `sessionID`(SDK 类型确认其在 `info` 内)
- [x] 3.5 `info` 类型签名通过 `UsageInput & { sessionID?: string, ... }` 包含 `sessionID`(从 `AssistantMessage.sessionID`)

## 4. 测试更新(tests/stats.test.ts)

- [x] 4.1 现有四个用例("带 tokens 累计所有字段"、"无 tokens 忽略"、"按本地日期分组"、"flush 写入 JSON 且可重新加载")的 `recordUsage` 调用补 `id` 字段(每条用唯一 id);并补 `finish: "stop"`(新设计下需 finish 才提交到 store)
- [x] 4.2 新增用例"同一消息流式多次更新后终态提交最后快照":同一 id 前两次无 finish(out=20,50),第三次带 finish(out=500),断言 `req=1`、`out=500`(取最后快照,非首次或累加)。另增"重复的终态事件不重复累计"用例:三次带 finish,断言 `req=1`、`out=100`(首次提交后 committed 拦截)
- [x] 4.3 新增用例"无 finish 不计入 store":同一 id 调用两次均不带 `finish`,断言 `getStore()[day]` 为 undefined,且 `recordUsage` 返回 `false`
- [x] 4.4 新增用例"finish 后迟到 chunk 不重复":同一 id 先带 `finish` 调用一次,再不带 `finish` 调用一次,断言 `req=1`、`out=500`(迟到 chunk 被拦截)
- [x] 4.5 新增用例"不同 id 各计一次":两个不同 id 各带 `finish` 调用一次,断言 `req=2`、token 为两者之和
- [x] 4.6 新增用例"stop 兜底提交 buffer 残留":同一 id 不带 `finish` 调用一次后 `stop()`,断言 `getStore()[day].req=1`、token 为该次快照值
- [x] 4.7 新增用例"缺 id 忽略":调用 `recordUsage({ role, finish, tokens } as unknown as UsageInput)`(无 id),断言返回 `false` 且 store 为空
- [x] 4.8 执行 `bun test` 确认全部通过(12 pass, 0 fail)

## 5. 构建与端到端验证

- [x] 5.1 执行 `bun run typecheck`(`bun x tsc --noEmit`)确认类型检查通过(含 `recordUsage` 返回值变更、`UsageInput.id` 必填)
- [x] 5.2 执行 `bun run build` 确认构建成功,`dist/index.js` 自包含(0.42 MB,79 模块)
- [ ] 5.3 重启 opencode 发一条普通请求,观察:
  - 5.3.1 统计文件中该请求 `req=1`、`in/out` 为合理值(非百万级)
  - 5.3.2 日志文件中该请求只有一行 `usage` 记录(非 N 行)
  - 5.3.3 日志行的 `session` 字段非空(为 8 位 sessionID 前缀)
  - 5.3.4 验证 `finish` 字段在消息完成时确实存在(spike 确认决策 2 的前提)
- [ ] 5.4 调用 `roundrobin_stats` 工具,确认图表数据合理
