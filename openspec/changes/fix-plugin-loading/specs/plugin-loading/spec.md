## ADDED Requirements

### Requirement: config 目录 package-lock.json 完整性

`~/.config/opencode/package.json` SHALL 声明 `@opencode-ai/plugin` 为 prod dependency,且 `~/.config/opencode/package-lock.json` 的 root package(`""`)dependencies SHALL 同时包含 `@opencode-ai/plugin` 和 `opencode-round-robin`。此确保 opencode 的 checkDirty 逻辑判定 `declared ⊆ locked2`,跳过 reify,避免触发 `@opencode-ai/plugin@local` 解析失败。

#### Scenario: package-lock.json root deps 完整

- **WHEN** 检查 `~/.config/opencode/package-lock.json` 的 `packages[""].dependencies`
- **THEN** SHALL 同时包含 `@opencode-ai/plugin` 和 `opencode-round-robin` 两个键

#### Scenario: config 目录无 install WARN

- **WHEN** opencode 启动并对 `~/.config/opencode/` 执行 install 检查
- **THEN** `opencode.log` 中 SHALL NOT 出现针对 `~/.config/opencode` 目录的 `background dependency install failed` WARN

### Requirement: 插件以路径形式声明

`~/.config/opencode/opencode.jsonc` 的 `plugin` 数组中,`opencode-round-robin` SHALL 以 `file:///` 路径形式声明(而非包名),使 `resolvePluginTarget` 走 `resolvePathPluginTarget` 直接解析,绕过 cache 目录的 `npm.add()` 查找。

#### Scenario: 路径声明被识别为 path plugin

- **WHEN** opencode 解析 `opencode.jsonc` 的 plugin 配置
- **THEN** `isPathPluginSpec("file:///D:/code/projects/opencode-round-robin")` SHALL 返回 true,走 `resolvePathPluginTarget` 而非 `npm.add()`

#### Scenario: 插件入口解析为 JavaScript 文件

- **WHEN** `resolvePathPluginTarget` 读取插件目录的 `package.json`
- **THEN** `main` 字段 SHALL 指向 `.js` 文件(`./dist/index.js`),而非 `.ts` 文件

### Requirement: 插件构建为 JavaScript

项目 `package.json` SHALL 包含 `"build"` 脚本(`bun build src/index.ts --outdir dist --target node --external @opencode-ai/plugin`),`main` SHALL 指向 `"./dist/index.js"`。构建产物 `dist/index.js` SHALL 为单个 ESM JavaScript 文件,`@opencode-ai/plugin` SHALL 保持为 external import。

#### Scenario: 构建成功

- **WHEN** 执行 `bun run build`
- **THEN** `dist/index.js` SHALL 生成,所有 `src/*.ts` 模块打包为单个文件

#### Scenario: 构建产物 Node.js 可导入

- **WHEN** Node.js 执行 `import("file:///.../dist/index.js")`
- **THEN** 导入 SHALL 成功(无 "Unknown file extension .ts" 错误)

#### Scenario: @opencode-ai/plugin 为 external

- **WHEN** 检查 `dist/index.js` 内容
- **THEN** SHALL 包含 `import { tool } from "@opencode-ai/plugin"`(external 保留),SHALL NOT 包含 `@opencode-ai/plugin` 的内联代码

### Requirement: 模块级单例(多项目共享)

插件模块 SHALL 使用模块级变量实现单例:`StatsCollector`、`KeyPool[]`、`Logger`、`patchFetch` 安装标志。`server()` 函数被多次调用时(每项目一次),SHALL 复用已存在的单例,不创建新实例。

#### Scenario: StatsCollector 单例

- **WHEN** opencode 为多个项目调用 `server()`
- **THEN** 所有调用 SHALL 共用同一个 `StatsCollector` 实例(单一 `setInterval` timer,单一 `store`)

#### Scenario: stats.json 不被空实例覆写

- **WHEN** 项目 A 有 LLM 请求(累积统计数据),项目 B 无 LLM 请求(空 store),两者的 `flush()` 依次执行
- **THEN** `round-robin-stats.json` SHALL 保留项目 A 的数据,SHALL NOT 被项目 B 的空 store 覆写为 `{}`

#### Scenario: patchFetch 只安装一次

- **WHEN** opencode 为多个项目调用 `config` hook
- **THEN** `globalThis.fetch` SHALL 只被 patch 一次(首次 `config` hook 执行),后续 `config` hook SHALL 跳过 patchFetch

#### Scenario: KeyPool 跨项目共享

- **WHEN** 项目 A 的请求触发某 key 的 429 cooldown
- **THEN** 项目 B 的请求 SHALL 也跳过该 key(共享 `KeyPool[]`,cooldown 跨项目生效)

#### Scenario: roundrobin_stats 返回全局聚合数据

- **WHEN** 在任意项目中调用 `roundrobin_stats` 工具
- **THEN** 返回的统计数据 SHALL 包含所有项目的聚合用量(非仅当前项目)

### Requirement: 本地开发不受影响

构建脚本和 `main` 改动 SHALL NOT 影响 `bun test` 和 `bun x tsc --noEmit` 的类型解析。`@opencode-ai/plugin` 在 `devDependencies` 中,本地 `bun install` 仍安装到项目 `node_modules`。

#### Scenario: tsc 类型检查通过

- **WHEN** 在项目根目录执行 `bun x tsc --noEmit`
- **THEN** 类型检查 SHALL 通过(无 "找不到模块 @opencode-ai/plugin" 错误)

#### Scenario: 测试通过

- **WHEN** 在项目根目录执行 `bun test`
- **THEN** 所有测试 SHALL 通过

### Requirement: 插件加载后注册 hooks 与工具

插件被 opencode 成功加载后 SHALL 注册 `config` hook(构建 pool 并安装 fetch-patch)、`event` hook(累计统计与 token 日志),以及 `roundrobin_stats` 工具。

#### Scenario: roundrobin_stats 工具可调用

- **WHEN** opencode 启动且插件成功加载,LLM 调用 `roundrobin_stats` 工具
- **THEN** 工具 SHALL 返回按天的 ASCII 柱状图字符串(或"暂无统计数据")

#### Scenario: 匹配 pool 的请求生成 fetch 层日志

- **WHEN** 插件加载后发起一条 URL 匹配某非透传 pool 的 LLM 请求并收到响应
- **THEN** `~/.local/share/opencode/round-robin.log` SHALL 生成,且含一行 fetch 层日志(格式 `YYYY-MM-DD HH:MM:SS [rr] <账号名> key#<序号> <末4位> <状态码>`)

#### Scenario: 统计文件定时刷盘

- **WHEN** 插件加载且 `StatsCollector` 运行达到 60 秒刷盘间隔
- **THEN** `~/.local/share/opencode/round-robin-stats.json` SHALL 生成(内容为按天累计的 JSON,可能为 `{}` 若期间无 usage)
