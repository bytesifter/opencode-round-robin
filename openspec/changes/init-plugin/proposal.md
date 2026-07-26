## Why

火山方舟有多个 coding 端点 API key,但 `opencode.jsonc` 当前只用 1 个,其余闲置,既浪费配额也无法在单 key 被限流时自动换用。已有的 `@thelioo/opencode-balancer` 过重(sqlite + solid-js TUI + 五张表),违背"太复杂就不做"的原则。需要一个极简插件:随机轮询多 key、记录用量、按天看图表,保持在一个能写完的周末项目体量。

## What Changes

- 新建 opencode 插件 `opencode-round-robin`,从零初始化项目(Bun 原生 TS,无构建)
- 插件配置只声明 `providers`(账号/provider 名列表);通过 `config` hook 读取 opencode 已有的 provider 配置,按 `baseURL` 自动分组构建 key 池--**复用 provider 里的 baseURL+apiKey,不让用户重复配 keys/match**
- 通过 monkey-patch `globalThis.fetch` 拦截 LLM 请求,按 URL 前缀匹配 pool,**随机**选择 key 注入 `Authorization` 头
- 429 限流时对该 key 标记 cooldown(默认 60 秒,可配),随机选 key 时跳过冷却中的 key
- 通过 `event` hook 监听 `message.updated`,从 `AssistantMessage` 提取 `tokens`/`cost`,按天累计
- 统计数据内存累积,60 秒定时刷盘到一个 JSON 文件(`~/.local/share/opencode/round-robin-stats.json`)
- 注册 `roundrobin_stats` 工具,返回按天的 ASCII 柱状图(请求数 + token 消耗)
- 请求日志分两层:fetch 层每次请求一行(账号名/key 序号/末4位/状态码),event 层补一条 token 日志(in/out/cost);均写入 `~/.local/share/opencode/round-robin.log`
- 配套工程:README(含 opencode 自动安装说明)、`.gitignore`、`package.json`、`tsconfig.json`、git 初始化并推到 GitHub

## Capabilities

### New Capabilities

- `key-rotation`: `providers` 配置(账号名列表)+ `config` hook 读 provider 按 baseURL 分组 + 随机轮询 + 单 key 组透传 + 429 cooldown 跳过
- `usage-tracking`: 按天累计请求数与 token 消耗,内存累积 + 定时刷盘到 JSON,通过工具返回按天 ASCII 图表
- `request-logging`: fetch 层请求日志(含账号名/key/状态码)+ event 层 token 日志(in/out/cost)+ 429 冷却日志,均写独立文件,key 脱敏

### Modified Capabilities

无(本项目为全新仓库,`openspec/specs/` 当前为空)。

## Impact

- **新增代码**: `src/` 下 index/config/pool/fetch-patch/stats/logger/chart 等模块,预计 300-400 行
- **新增工程文件**: `package.json`、`tsconfig.json`、`README.md`、`.gitignore`、`tests/`
- **opencode 配置**: 用户需在 `~/.config/opencode/opencode.jsonc` 的 `plugin` 数组加入 `["opencode-round-robin", { "providers": [...] }]`;并将 `model` 改为真实 provider(如 `volxc9208/glm-5.2`,不再用 balancer 造的虚拟 `ark-coding`)
- **运行时产物**: `~/.local/share/opencode/round-robin-stats.json`(统计)、`~/.local/share/opencode/round-robin.log`(日志)
- **依赖**: `@opencode-ai/plugin`(运行时,由 opencode 提供);无 sqlite、无 solid-js、无构建工具
- **前置清理**: 上线前需卸载 `@thelioo/opencode-balancer`(已停用),删除 `~/.config/opencode/balancer.sqlite`
