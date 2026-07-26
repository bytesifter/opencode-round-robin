## Context

火山方舟有 3 个 coding 端点 key、1 个 plan 端点 key。用户已在 `opencode.jsonc` 中按"每个账号一个 provider"的方式配了 4 个 provider(`volxc9208`/`volxc5425`/`vollqh5426` 为 coding 端点,`volxc9208-agentplan` 为 plan 端点),每个 provider 含完整的 `baseURL`+`apiKey`。

已有的 `@thelioo/opencode-balancer` 解决了轮询问题,但过重:`bun:sqlite` 五张表 + `@opentui/solid` + `solid-js` 十几个 tsx 组件 + 优先级/原生模型映射等。源码体积大、维护成本高,违背"太复杂就不做"的原则。

本设计目标是用最小代价实现三件事:随机轮询多 key、按天统计用量、每次请求记日志。约束:无 sqlite、无 TUI、无构建、无重试循环,体量控制在 300-400 行。**配置上复用 provider 已有信息,不让用户重复配 keys/match。**

技术依据来自 `@opencode-ai/plugin@1.18.5` 的类型定义(`dist/index.d.ts`)、`@opencode-ai/sdk` 的 `Event`/`Message` 类型,以及 balancer 源码的先例验证。

## Goals / Non-Goals

**Goals:**
- 插件配置只声明 `providers`(账号名列表),通过 `config` hook 读 opencode 的 provider 配置,按 `baseURL` 自动分组构建 key 池
- 多账号 key 随机轮询(按 URL 前缀匹配 pool,每 pool 独立)
- 429 限流时对 key 标记 cooldown,随机选 key 时跳过,cooldown 时长可配
- 通过 `event` hook 按天累计请求数与 token 消耗(含 input/output/reasoning/cache)
- 统计数据内存累积,60 秒定时刷盘到 JSON 文件,进程退出兜底刷盘
- 注册工具返回按天 ASCII 柱状图(请求数 + token)
- 请求日志分两层:fetch 层(账号/key/状态)+ event 层(token/cost),均写独立文件
- 项目可在 `opencode.jsonc` 中通过 `plugin` 数组自动安装加载

**Non-Goals:**
- 不做模型参数配置(temperature/maxTokens 归 opencode 原生 `provider.options`)
- 不做模型一致性校验(配置者自行保证 `providers` 列表里的 provider 能一起轮询)
- 不做跨服务商同模型轮询(只按 baseURL 分组,同端点才轮询;跨服务商路由复杂,后续再说)
- 不做失败重试循环(429 后只标 cooldown,不自动换 key 重发;失败交 opencode 原生处理)
- 不做 TUI dashboard(用工具返回文本图表即可)
- 不做按 key 粒度的 token **统计聚合**(event 层看不到 key;但 token **日志**通过两层各打一条覆盖,见决策 11)
- 不做轮询位置持久化(随机策略无状态,重启无影响)
- 不做配置热重载(改 options 需重启 opencode)
- 不做 `chat.headers` hook 方案(留作后续优化方向,本期不验证)

## Decisions

### 决策 1:fetch monkey-patch 而非 `chat.headers` hook

**选择**:覆盖 `globalThis.fetch`,在拦截器里匹配 pool、选 key、改 `Authorization` 头。

**理由**:
- balancer 源码已验证 fetch-patch 在 opencode 中可靠工作(其 `dist/server/fetch-patch.ts` 即此方案)
- `chat.headers` hook 能否覆盖 AI SDK 内部注入的 `Authorization` 头未经验证,有风险
- fetch-patch 覆盖所有 HTTP 请求(含子 agent、compact、small model),轮询更彻底

**备选**:`chat.headers` hook(更干净、官方),作为后续 spike 方向,若可行再切换。

### 决策 2:随机选 key 而非 round-robin index

**选择**:`KeyPool.next()` 从可用 key 中随机挑一个,不维护 index 状态。

**理由**:
- 无状态,实现极简
- 大数定律下均匀性与 round-robin 近似
- 项目虽名 `round-robin`,但随机在效果上等价,且更简单

### 决策 3:留 cooldown,砍重试

**选择**:fetch-patch 识别 429 后对该 key 标记冷却(默认 60s,可配),随机选 key 时跳过冷却中的 key;但**不**在 fetch-patch 内部换 key 重发。

**理由**:
- cooldown 实现成本低(本就要读响应状态码,顺手标记),且显著避免反复撞限流
- 重试循环才是真正的复杂源(换 key、重发、解析 Retry-After、重试次数控制),砍掉后 fetch-patch 退化为"选 key-发-返"三步
- 失败交 opencode 原生处理,体验略降但可接受

### 决策 4:`event` hook 取 token 而非解析 SSE 流

**选择**:监听 `event` hook 的 `message.updated`,从 `AssistantMessage.info.tokens`/`cost` 直接取用量。

**理由**:
- `@opencode-ai/sdk` 的 `AssistantMessage` 类型自带 `tokens: {input, output, reasoning, cache:{read,write}}` 和 `cost`,完全官方
- 解析 SSE 流需 `tee()` 分流并解析最后一帧 usage,有破坏流的风险,且实现复杂
- event hook 零风险、零额外 I/O

**代价**:event 层看不到本次用了哪个 key,无法做"按 key 聚合的统计"。token 日志通过决策 11(两层各打一条)覆盖,但按 key 的统计聚合仍是 Non-Goal。

### 决策 5:内存累积 + 60s 定时刷盘

**选择**:统计在内存对象上累积,定时器每 60 秒整体写一次 JSON,进程退出(`beforeExit`/`SIGINT`/`SIGTERM`)兜底刷盘。

**理由**:
- 每事件都写 = 一次对话几十次磁盘 I/O,过频
- 纯内存 = 重启全丢,无法看趋势
- 60s 刷盘平衡:磁盘 I/O 每分钟 1 次,崩溃最多丢 1 分钟统计(对统计可接受)

### 决策 6:工具返回 ASCII 图表 而非 TUI dashboard

**选择**:注册 `roundrobin_stats` 工具,执行时返回按天 ASCII 柱状图字符串。

**理由**:
- 零额外依赖(不引入 `@opentui/solid`/`solid-js`)
- 用户对 LLM 说"看轮询统计",LLM 调用工具即出图
- balancer 的 TUI 是其复杂度主源,本项目明确回避

### 决策 7:日志写自己文件 而非 console.log

**选择**:每次请求 `appendFile` 一行到 `~/.local/share/opencode/round-robin.log`。

**理由**:
- 调查发现 opencode 的日志(`~/.local/share/opencode/log/opencode.log`)只记 opencode 自身事件,未观测到 plugin 的 `console.log` 被捕获
- balancer 源码 `grep console.log` 为 0 处,印证 plugin 不靠 console 打日志
- 写自己文件可控、可 `tail`、不依赖 opencode 日志机制
- 注:opencode 官方提供 `client.app.log()` 结构化日志 API(见 plugins 文档),但本项目选择独立文件以保可控与可 `tail`;后续可评估切换

### 决策 8:JSON 文件 而非 sqlite

**选择**:统计存 `~/.local/share/opencode/round-robin-stats.json`,结构为 `{ "YYYY-MM-DD": {req, in, out, reasoning, cacheRead, cacheWrite, cost} }`。

**理由**:按天聚合结构简单,JSON 读写够用;sqlite 需引 `bun:sqlite`、建表、迁移,杀鸡用牛刀。

### 决策 9:Bun 原生 TS,无构建

**选择**:`package.json` 的 `main` 指向 `src/index.ts`,不配 build 脚本。

**理由**:opencode 用 Bun 加载插件,原生支持 TS。发布 npm 时再考虑加构建输出 `dist/`。

### 决策 10:`config` hook 读 provider 构建 pool(不配 pools/match/keys)

**选择**:插件 options 只声明 `providers: string[]`(账号/provider 名列表)。通过 `config` hook 接收完整 `Config`,过滤出 `providers` 列表里的 provider,读取各自的 `baseURL`+`apiKey`,按 `baseURL` 分组构建 `KeyPool[]`。`fetch-patch` 在 `config` hook 里安装(而非 plugin 函数体)。

**理由**:
- 用户已在 provider 配置里写全 `baseURL`+`apiKey`,在 plugin options 再配 `pools[].match/keys` 是重复劳动("多此一举")
- 按 `baseURL` 分组天然保证"同端点同模型变体"在一起轮询,不同端点(coding/plan)自动分离
- 模型一致性由配置者保证(插件不校验),`providers` 列表里列哪些是用户的决定

**边界**:
- `providers` 未配或为空 -> 报错(强制显式声明,防误轮询)
- `providers` 里的名字在 `config.provider` 中不存在 -> 报错(配置错误)
- 同一 `baseURL` 下 key 去重;去重后仅 1 个 -> 该组透传
- `cooldownMs` 为全局配置(新设计无 pool 级配置概念,因 pool 由 provider 自动分组而来)

**备选**:plugin options 配 `pools[{match,keys}]`(初版设计),已弃--重复配置。

### 决策 11:token 日志两层各打一条(不打通)

**选择**:fetch 层与 event 层各打一条日志,不强行合并为一行。
- fetch 层(onResponse):`时间 [rr] 账号名 key#序号 末4位 状态码`
- event 层(message.updated):`时间 [rr] token in=.. out=.. cost=..`
- 429 额外一行 cooldown

**理由**:
- token 在 event 层(决策 4),key/状态在 fetch 层,两者处不同时刻、不同 hook,无现成 ID 关联(fetch 层没有 messageID)
- 打通两层需 buffer+查最近 key,并发(子 agent/compact)时 key 可能错配,不可靠
- 解析流拿 token 违背决策 4
- 两条日志时间戳相近,人工对应足够;统计聚合(按天)本就在 event 层,日志只是明细

**备选**:buffer+查最近 key(并发错配风险)/ 解析流(违背决策 4),均不取。

### 决策 12:key->账号名映射(日志显示账号)

**选择**:构建 pool 时保留 `key -> provider名(账号名)` 映射。fetch 层日志除 key 序号+末4位外,额外显示账号名(如 `volxc9208`)。

**理由**:
- 用户要看"用了哪个账号",仅有 key 序号+末4位不够直观
- 新设计下 pool 按 baseURL 分组,一个 pool 含多个 key 来自不同 provider(账号),需保留来源
- 账号名不是敏感信息(provider 名),可明文记

## Risks / Trade-offs

- **[config hook 时机]** -> fetch-patch 须在第一次 LLM 请求前装好;`config` hook 是否一定先于请求触发待 spike。若不行,fallback:plugin 函数体里另寻读 config 途径(`PluginInput` 无 config 字段,需查 `client` 能否取)
- **[SSE 流式响应被 fetch-patch 影响]** -> 拦截器只改 header 不碰 body,理论无影响;上线前发消息观察流式输出是否正常
- **[event message.updated 是否一定带 usage]** -> `AssistantMessage` 类型含 tokens,但流式中途的更新可能无;应只在 `tokens` 字段存在时累计,避免半成品消息
- **[所有 key 都在 cooldown]** -> 兜底:忽略 cooldown 随机返回一个,不阻塞用户
- **[砍重试后 429 直接返给用户]** -> opencode 原生对 429 的处理可能不够优雅;接受体验略降,换取 fetch-patch 极简
- **[日志/统计文件并发写]** -> JS 单线程事件循环 + append/定时整体写,无锁安全;`appendFile` 自带排队
- **[随机选 key 短时可能不均]** -> 大数定律下均匀,可接受;若观测到严重不均再加加权
- **[两层日志人工对应]** -> fetch 层与 event 层两条日志时间相近但非同一行;并发场景对应稍难,接受

## Migration Plan

1. 卸载 balancer:从 `opencode.jsonc`/`tui.json` 的 `plugin` 数组删除 `@thelioo/opencode-balancer`;删除 `~/.config/opencode/balancer.sqlite`
2. 在 `opencode.jsonc` 的 `plugin` 数组加入 `["opencode-round-robin", { "providers": ["volxc9208","volxc5425","vollqh5426"], "cooldownMs": 60000 }]`
3. 将 `model` 改为真实 provider(如 `"volxc9208/glm-5.2"`),不再用虚拟 `ark-coding`
4. 重启 opencode,观察日志与统计
5. 回滚:从 `plugin` 数组移除本插件,恢复 balancer 配置(若需)

## Open Questions

- `config` hook 是否一定先于第一次 LLM 请求触发(待 spike;若不然需 fallback)
- 本地开发加载方式:官方推荐 npm 包名 / 本地 plugin 目录 / config 目录 `package.json`+`file:`依赖三种,`file:///` 直接引用目录未在官方文档出现。README 按 `file:` 依赖写,6.2 验证时确认
