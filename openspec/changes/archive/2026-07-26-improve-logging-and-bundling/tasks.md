## 1. 打包内联

- [x] 1.1 从 `package.json` 的 `build` 脚本中移除 `--external @opencode-ai/plugin`,改为 `bun build src/index.ts --outdir dist --target node`
- [x] 1.2 执行 `bun run build`,确认 `dist/index.js` 中包含 `tool` 函数实现(非外部 import),且体积增大至 50-80KB
- [x] 1.3 删除 `node_modules/@opencode-ai/plugin` 后验证 `dist/index.js` 可被 `node -e "import('./dist/index.js')"` 正常加载(无 MODULE_NOT_FOUND)
- [x] 1.4 恢复 `node_modules`(执行 `bun install`),确认 `tsc --noEmit` 类型检查通过

## 2. 类型定义

- [x] 2.1 在 `src/types.ts` 中新增 `LogLevel` 类型(`"INFO" | "WARN" | "ERROR"`)
- [x] 2.2 在 `src/types.ts` 中新增 `LogMode` 类型(`"simple" | "rotation"`)
- [x] 2.3 在 `src/types.ts` 的 `ParsedOptions` 接口中新增 `logDir?: string` 字段
- [x] 2.4 在 `src/types.ts` 中新增 `EventContext` 接口,包含 `sessionID`/`modelID`/`providerID`/`mode`/`agent`/`durationMs` 字段(均 optional)

## 3. Logger 重写

- [x] 3.1 重写 `src/logger.ts` 的 `Logger` 类:构造函数接收 `logDir`(可选) 或 `logPath`(可选),决定 `LogMode`
- [x] 3.2 实现按日轮转: `rotation` 模式下文件名为 `round-robin-YYYY-MM-DD.log`,每次写入前检查日期是否变化,变化则切换文件;`simple` 模式下文件名固定
- [x] 3.3 实现日志级别: `INFO`/`WARN`/`ERROR`,每条日志行格式为 `YYYY-MM-DD HH:MM:SS.mmm LEVEL tag key=value ...`
- [x] 3.4 实现 `logFetch(accountName, keyIndex, keyTail, status, durationMs)`: fetch 层日志,INFO(2xx)/WARN(429)/ERROR(5xx),不含 URL
- [x] 3.5 实现 `logCooldown(accountName, keyIndex, keyTail, cooldownMs)`: 429 冷却日志,WARN 级别
- [x] 3.6 实现 `logUsage(tokens, cost, ctx: EventContext)`: event 层日志,INFO 级别,包含 session(截短 4 位)/model/provider/mode/agent/duration
- [x] 3.7 实现时间戳精度到毫秒(`YYYY-MM-DD HH:MM:SS.mmm`)
- [x] 3.8 key 脱敏逻辑保留(末 4 位 + `..` 前缀),不变

## 4. fetch-patch 改造

- [x] 4.1 在 `FetchPatchCallbacks` 的 `onResponse` 回调中增加 `durationMs` 参数
- [x] 4.2 在 `patchedFetch` 函数中用 `Date.now()` 记录请求开始时间,响应后计算 `durationMs = end - start`
- [x] 4.3 确认 `onResponse` 回调不传递 URL(回调签名本就无 URL 参数,无需改动,验证即可)

## 5. config 改造

- [x] 5.1 在 `src/config.ts` 的 `parseOptions` 函数中解析 `logDir` 字段(`typeof options.logDir === "string" ? options.logDir : undefined`)
- [x] 5.2 确认 `logPath` 解析保留不变(向后兼容)

## 6. index.ts 改造

- [x] 6.1 `server` 函数中 Logger 构造改为:若 `opts.logDir` 存在则传 `logDir`,否则传 `logPath`(向后兼容)
- [x] 6.2 `config` hook 中 `onResponse` 回调增加 `durationMs` 参数传递给 `globalLogger.logFetch`
- [x] 6.3 `event` hook 中从 `event.properties.info` 提取 `sessionID`(从 event 外层)、`modelID`/`providerID`/`mode`/`agent`(从 info)、`time.created`/`time.completed`(从 info) 构建 `EventContext`
- [x] 6.4 `event` hook 中从 `event` 对象提取 `sessionID`(event schema 为 `{ sessionID, info }`),截短为前 4 位传入 `EventContext`
- [x] 6.5 `event` hook 中 `durationMs` 从 `time.completed - time.created` 计算;`time.completed` 不存在时为 0
- [x] 6.6 `onResponse` 回调中根据 status 选择日志级别(2xx=INFO, 429=WARN, 5xx=ERROR),由 `logFetch` 内部处理

## 7. 测试

- [x] 7.1 更新 `test/logger.test.ts`: 测试结构化日志格式(级别标签、KV 字段、毫秒时间戳)
- [x] 7.2 新增测试: `rotation` 模式下文件名含日期,跨天切换文件
- [x] 7.3 新增测试: `simple` 模式下文件名固定,不轮转
- [x] 7.4 新增测试: fetch 层日志不含 URL,包含 duration 字段
- [x] 7.5 新增测试: event 层日志包含 session(截短)/model/provider/mode/agent 字段
- [x] 7.6 新增测试: 日志级别正确(INFO 200 / WARN 429 / ERROR 5xx)
- [x] 7.7 更新 `test/config.test.ts`: 测试 `logDir` 解析
- [x] 7.8 执行 `bun test` 确认全部通过

## 8. 构建与验证

- [x] 8.1 执行 `tsc --noEmit` 确认类型检查通过
- [x] 8.2 执行 `bun run build` 确认构建成功,`dist/index.js` 自包含
- [x] 8.3 重启 opencode,确认插件正常加载(log 有新格式日志、stats 正常)
- [x] 8.4 确认 `round-robin.log` 或 `round-robin-YYYY-MM-DD.log` 格式符合 design 决策 2
