## Why

当前存在两个阻碍分发与可观测性的问题:

1. **构建产物非自包含**: `bun build` 使用 `--external @opencode-ai/plugin`,导致 `dist/index.js` 运行时需要从 `node_modules` 解析 `@opencode-ai/plugin`。而 opencode desktop 的 `OPENCODE_VERSION` 未注入 bug 会使 `@opencode-ai/plugin@local` 安装失败,进而导致插件无法加载。经调查 `@opencode-ai/plugin` 的 `tool()` 函数是纯透传(`function tool(input) { return input; }`),无全局状态,可安全内联打包,从而彻底消除运行时依赖。

2. **日志缺少业务语义且无轮转**: 当前日志仅有 `provider key#0 ..2898 200` 和 `token in=... out=...`,缺少 session/model/mode/agent 等业务上下文,无日志级别区分,单文件无限增长。opencode 的 `message.updated` 事件实际携带 `sessionID`/`modelID`/`providerID`/`mode`/`agent`/`time.created`/`time.completed` 等丰富字段,但当前代码仅提取了 `tokens` 和 `cost`,其余全部丢弃。

## What Changes

### 打包内联

- 从 `package.json` 的 `build` 脚本中移除 `--external @opencode-ai/plugin`
- `dist/index.js` 自包含 `tool()` 函数和 `zod`,运行时不再需要 `node_modules/@opencode-ai/plugin`
- 用户通过 npm 安装后零配置可用,不受 opencode desktop `@local` bug 影响

### 日志改进

- **结构化日志**: event 层日志补充 `sessionID`(截短)/`modelID`/`providerID`/`mode`/`agent`/`duration`(从 `time.created` 与 `time.completed` 计算)
- **去掉 URL**: fetch 层日志不再记录请求 URL(用户要求)
- **日志级别**: INFO(fetch 200/event 正常)/WARN(429 冷却)/ERROR(fetch 非 2xx)
- **按日轮转**: 文件名改为 `round-robin-YYYY-MM-DD.log`,每天一个文件,旧文件保留
- **logDir 配置**: 新增 `logDir` 选项(日志目录),与已有 `logPath`(单文件路径)并存,优先级 `logDir > logPath > 默认`
- **请求耗时**: fetch 层记录请求耗时(从 `Date.now()` 差值计算),event 层记录消息耗时(从 `time.created`/`time.completed` 计算)
- **去重**: 单例模式下 token 行不再重复(根因已由 fix-plugin-loading 层4 修复,此处确保日志层不再产生重复)

## Capabilities

### New Capabilities

- `self-contained-build`: 插件构建产物自包含,`dist/index.js` 内联 `@opencode-ai/plugin` 的 `tool()` 函数及 `zod`,运行时无需 `node_modules` 中存在 `@opencode-ai/plugin`,支持 npm 零配置分发
- `structured-logging`: 结构化日志系统,包含业务上下文(session/model/mode/agent)、日志级别(INFO/WARN/ERROR)、按日轮转、可配置日志目录(`logDir`)、请求耗时,替代原有的简单 append 日志

### Modified Capabilities

无。`request-logging` 能力由 `init-plugin` change 定义但尚未归档(未进入 `openspec/specs/`),本 change 以 `structured-logging` 作为新能力替代,不产生 delta spec。

## Impact

- **package.json**: `build` 脚本移除 `--external @opencode-ai/plugin`;`@opencode-ai/plugin` 从 `devDependencies` 保留(编译期类型),运行时不再依赖
- **src/logger.ts**: 重写 -- 结构化日志格式、日志级别、按日轮转、logDir 支持
- **src/index.ts**: 传递更丰富的 event 数据给 Logger;传递 logDir 选项
- **src/config.ts**: 新增 `logDir` 选项解析
- **src/types.ts**: 新增 `LogLevel`/`LogEntry` 等类型
- **src/fetch-patch.ts**: 回调增加耗时参数;不传递 URL 给日志层
- **dist/index.js**: 体积增大(预计 50-80KB,含 zod),但完全自包含
- **用户配置**: `opencode.jsonc` 新增可选 `logDir` 字段;`logPath` 仍兼容(不轮转模式)
- **运行时产物**: `round-robin-YYYY-MM-DD.log`(轮转模式)或 `round-robin.log`(logPath 兼容模式)
