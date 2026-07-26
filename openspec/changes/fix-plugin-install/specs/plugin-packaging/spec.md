## ADDED Requirements

### Requirement: `@opencode-ai/plugin` 声明为 devDependency

插件 `package.json` SHALL 将 `@opencode-ai/plugin` 声明在 `devDependencies` 中,且 SHALL NOT 同时出现在 `dependencies` 中。版本范围保留 `^1.3.9`。

#### Scenario: package.json 声明位置检查

- **WHEN** 检查项目根目录 `package.json`
- **THEN** `@opencode-ai/plugin` 出现在 `devDependencies` 字段,且 `dependencies` 字段中不含 `@opencode-ai/plugin`

### Requirement: config 目录 package-lock.json 完整性

`~/.config/opencode/package.json` SHALL 声明 `@opencode-ai/plugin` 为 prod dependency(版本 `1.4.7`),且 `~/.config/opencode/package-lock.json` 的 root package(`""`)dependencies SHALL 同时包含 `@opencode-ai/plugin` 和 `opencode-round-robin`。此确保 opencode 的 checkDirty 逻辑判定 `declared ⊆ locked2`,跳过 reify,避免触发 `@opencode-ai/plugin@local` 解析失败。

#### Scenario: package-lock.json root deps 完整

- **WHEN** 检查 `~/.config/opencode/package-lock.json` 的 `packages[""].dependencies`
- **THEN** SHALL 同时包含 `@opencode-ai/plugin` 和 `opencode-round-robin` 两个键

#### Scenario: checkDirty 通过,不触发 reify

- **WHEN** opencode 启动并对 `~/.config/opencode/` 执行 install 检查
- **THEN** `declared`(package.json deps ∪ input.add names)SHALL 是 `locked2`(package-lock.json root deps)的子集,checkDirty 通过,不调用 `Arborist.reify()`,不出现 `background dependency install failed` WARN

### Requirement: 作为 `file:` 依赖可安装

当 `~/.config/opencode/package.json` 含 `"opencode-round-robin": "file:<path>"` 且执行 `npm install` 时,install SHALL 成功完成,`opencode-round-robin` SHALL 出现在 `node_modules` 中。

#### Scenario: npm install 成功

- **WHEN** 在 `~/.config/opencode/` 执行 `npm install`,且其 `package.json` 含 `"opencode-round-robin": "file:<项目路径>"` 和 `"@opencode-ai/plugin": "1.4.7"`
- **THEN** install 成功完成,`~/.config/opencode/node_modules/opencode-round-robin` 目录出现

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

### Requirement: 本地开发类型解析不受影响

将 `@opencode-ai/plugin` 移至 `devDependencies` 后,项目根目录的 `bun install` SHALL 仍安装 `@opencode-ai/plugin` 到项目 `node_modules`,供 `bun x tsc --noEmit` 与 `bun test` 解析类型。

#### Scenario: tsc 类型检查通过

- **WHEN** 在项目根目录执行 `bun install` 后执行 `bun x tsc --noEmit`
- **THEN** TypeScript 编译器 SHALL 能解析 `import ... from "@opencode-ai/plugin"`,类型检查通过(无"找不到模块 @opencode-ai/plugin"错误)

#### Scenario: 测试通过

- **WHEN** 在项目根目录执行 `bun install` 后执行 `bun test`
- **THEN** 现有测试 SHALL 全部通过(类型与运行时解析正常)
