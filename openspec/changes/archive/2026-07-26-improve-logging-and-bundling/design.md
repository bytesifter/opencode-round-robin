## Context

插件 `opencode-round-robin` 已运行(plugin 日志有数据,stats.json 有 5 条请求),但存在两个阻碍分发与可观测性的问题:

1. **构建产物依赖 `@opencode-ai/plugin` 运行时**: `bun build` 使用 `--external @opencode-ai/plugin`,导致 `dist/index.js` 需要 `node_modules` 中存在 `@opencode-ai/plugin`。opencode desktop 的 `OPENCODE_VERSION` 未注入 bug 使 `@opencode-ai/plugin@local` 安装失败,影响所有项目。经调查 `@opencode-ai/plugin/dist/tool.js` 的完整源码为 `export function tool(input) { return input; } tool.schema = z;`,纯透传无状态,可安全内联。

2. **日志缺乏业务语义且无轮转**: 当前日志格式为 `volxc9208 key#0 ..2898 200` 和 `token in=4556 out=2182 ...`,缺少 session/model/mode/agent 上下文,无级别区分,单文件无限增长。opencode `message.updated` 事件携带 `sessionID`/`modelID`/`providerID`/`mode`/`agent`/`time.created`/`time.completed` 等字段(见 `Assistant2` schema, `node-C6YP7moS.js:86933`),但当前代码仅取 `tokens` 和 `cost`。

当前模块结构: `index.ts`(入口/server hooks) → `config.ts`(options 解析) → `logger.ts`(append 日志) → `fetch-patch.ts`(monkey-patch fetch) → `stats.ts`(用量统计) → `pool.ts`(key 池) → `chart.ts`(ASCII 图表) → `types.ts`(类型定义)。

## Goals / Non-Goals

**Goals:**

- `dist/index.js` 自包含,内联 `tool()` + `zod`,运行时无需 `@opencode-ai/plugin`
- 日志包含业务上下文(session/model/mode/agent/duration)
- 日志按级别(INFO/WARN/ERROR)区分
- 日志按日轮转,支持 `logDir` 配置
- fetch 层不记录 URL,记录耗时
- `logPath` 向后兼容(不轮转模式)

**Non-Goals:**

- 不修复 opencode desktop 的 `OPENCODE_VERSION` 注入 bug(非本项目可控)
- 不实现日志自动清理/压缩(旧文件保留,手动管理)
- 不重构 stats/pool/chart 模块(仅改 logger/fetch-patch/index/config/types)
- 不添加远程日志收集或监控集成

## Decisions

### 决策 1: 移除 `--external`,内联 `@opencode-ai/plugin`

**选择**: 从 `build` 脚本移除 `--external @opencode-ai/plugin`,让 bun 将 `tool()` 和 `zod` 打包进 `dist/index.js`。

**理由**: `tool()` 是纯透传函数(`function tool(input) { return input; }`),无全局状态、无注册机制、无 `instanceof` 检查。`tool.schema = z` 仅是 zod 别名,用于定义工具参数 schema。opencode 的 `readV1Plugin` 读取 tool 定义时只检查对象结构(description/args/execute),不检查 `tool()` 的函数身份。因此内联安全。

**替代方案**: (1) 在 `dependencies` 中声明 `@opencode-ai/plugin` 让 opencode 自动安装 -- 被 `@local` 版本 bug 阻断。(2) 发布时附带 `install` 脚本 -- 增加复杂度。(3) 不用 `tool()` 函数,直接返回 plain object -- 可行但失去类型安全。内联是最简方案。

**代价**: `dist/index.js` 从 ~12KB 增至 ~50-80KB(zod 体积)。对插件加载性能影响可忽略(一次性加载)。

### 决策 2: 日志格式 -- 结构化 KV 而非 JSON

**选择**: 采用 `YYYY-MM-DD HH:MM:SS.mmm LEVEL tag key=value key=value` 格式,而非 JSON。

**理由**: 日志文件主要供人阅读(用户用文本编辑器或 `tail` 查看),KV 格式可读性好且仍可 grep。JSON 格式虽可机器解析但单行过长不便阅读。

**示例**:
```
2026-07-26 18:51:40.123 INFO  fetch provider=volxc9208 key=#0(..2898) status=200 duration=342ms
2026-07-26 18:52:08.456 INFO  usage session=a3f2 model=glm-5.2 provider=volxc9208 mode=code agent=opencode in=4556 out=2182 reasoning=0 cacheR=312384 cacheW=0 cost=0.0021 duration=1283ms
2026-07-26 18:53:00.789 WARN  cooldown provider=volxc5425 key=#1(..2a5b) 60000ms
```

**替代方案**: JSON Lines 格式 -- 适合 ELK 等日志系统,但本项目面向个人开发者,优先可读性。

### 决策 3: 按日轮转策略 -- 日期后缀,无自动清理

**选择**: 文件名 `round-robin-YYYY-MM-DD.log`(本地时区),每天一个文件,旧文件不自动删除。

**理由**: 个人开发者日志量不大(每天几十 KB),无需自动清理。日期后缀让用户自行 `rm` 旧文件或用 `logrotate`。实现简单:每次写日志时检查当前日期是否与当前文件日期一致,不一致则切换文件。

**替代方案**: (1) size-based rotation + 编号 -- 更复杂,对个人开发者无必要。(2) Winston/pino 等日志库 -- 引入重依赖,违背极简原则。

### 决策 4: logDir 与 logPath 并存,优先级 logDir > logPath > 默认

**选择**: `logDir` 启用轮转模式(按日生成文件),`logPath` 保持单文件追加模式(向后兼容),两者均不存在时使用默认路径。

**理由**: 已有用户配置了 `logPath`,不能破坏兼容性。`logDir` 是新选项,用户主动选择即启用轮转。

**实现**: `parseOptions` 解析 `logDir`(string | undefined) 和 `logPath`(string | undefined)。Logger 构造时:若 `logDir` 存在,模式为 `rotation`,文件名按日期生成;否则模式为 `simple`,文件名固定。

### 决策 5: fetch 层耗时测量

**选择**: 在 `patchFetch` 的 `patchedFetch` 函数内用 `Date.now()` 记录请求开始与响应时间,差值为耗时。

**理由**: fetch 拦截器已包裹 `origFetch` 调用,在调用前后取 `Date.now()` 即可。精度毫秒级,足够。

**event 层耗时**: 从 `info.time.created` 和 `info.time.completed` 计算(均为 Unix 毫秒时间戳)。`time.completed` 可能在流式更新中途不存在,此时 duration 缺省为 0。

### 决策 6: sessionID 截短为前 4 位

**选择**: 日志中 sessionID 截取前 4 位(如 `a3f2`),不记录完整值。

**理由**: sessionID 是 UUID,完整值过长(36 字符)且可能敏感。前 4 位足以在单次会话中区分不同 session,便于 grep 关联。完整 sessionID 可从 opencode 的 session 文件获取。

## Risks / Trade-offs

- **[zod 版本不一致]** 内联的 zod 版本可能与 opencode 内部使用的版本不同。-> `tool()` 是透传函数,opencode 读取 tool 定义时只看对象结构,不依赖 zod 实例身份。风险极低。

- **[dist 体积增大]** 从 ~12KB 到 ~50-80KB。-> 一次性加载,对运行时性能无影响。npm 包体积可接受。

- **[轮转文件累积]** 旧日志文件不自动删除。-> 个人开发者日志量小,手动清理即可。可在 README 中说明。

- **[logDir 目录不存在]** 用户配置了 `logDir` 但目录不存在。-> Logger 构造时 `mkdirSync(dir, { recursive: true })` 自动创建。

- **[时间戳精度]** fetch 层用 `Date.now()`(毫秒),event 层用 `time.created`/`time.completed`(也是毫秒)。-> 精度一致,无问题。
