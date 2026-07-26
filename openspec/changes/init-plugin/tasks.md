## 1. 项目脚手架

- [x] 1.1 创建 `package.json`(`name=opencode-round-robin`、`type=module`、`main=./src/index.ts`、依赖 `@opencode-ai/plugin`、`scripts.test=bun test`)
- [x] 1.2 创建 `tsconfig.json`(Bun 原生 TS,strict)
- [x] 1.3 创建 `.gitignore`(忽略 `.vscode/`、`node_modules/`、`temp/`、`*.log`、`round-robin-stats.json`;`agents/` 为 submodule 不需忽略)
- [x] 1.4 `git init` 并设置远程 `github.com/bytesifter/opencode-round-robin`

## 2. 类型与配置(重写:providers + config hook 读 provider)

- [x] 2.1 编写 `tests/config.test.ts`:`providers` 缺失/空数组抛错、provider 名不存在抛错、`cooldownMs` 默认 60000、`statsPath`/`logPath` 可选解析;`buildPoolsFromProviders` 按 baseURL 分组、key 去重、单 key 透传、保留 key->账号名映射
- [x] 2.2 更新 `src/types.ts`:`ParsedOptions` 改为 `{providers, cooldownMs, statsPath?, logPath?}`;`ParsedPool` 增加 `keyAccounts: Map<string,string>`(key->provider 名)
- [x] 2.3 重写 `src/config.ts`:`parseOptions` 只解析 `providers`(必填非空)+ 可选项;新增 `buildPoolsFromProviders(config, providers, cooldownMs)` 读 `Config.provider`、按 baseURL 分组、去重、构建含 `keyAccounts` 的 `ParsedPool[]`
- [x] 2.4 运行 `bun test tests/config.test.ts` 确认通过

## 3. KeyPool 与 fetch-patch

- [x] 3.1 编写 `tests/pool.test.ts`:随机选 key、429 标记 cooldown 后跳过、cooldown 到期恢复、全部冷却兜底随机返回、单 key 透传不参与
- [x] 3.2 实现 `src/pool.ts`:`KeyPool` 类(`next()`、`markCooldown()`、`isCoolingDown()`、`passthrough` 标记)
- [x] 3.3 运行 `bun test tests/pool.test.ts` 确认通过
- [x] 3.4 扩展 `KeyPool`:构造接收 `keyAccounts` 映射,新增 `accountName(key)` 方法返回账号名;补对应测试
- [x] 3.5 编写 `tests/fetch-patch.test.ts`:URL 匹配 pool 注入 `Authorization`、URL 不匹配透传不改、429 响应触发 `markCooldown`、单 key pool 透传不拦截
- [x] 3.6 实现 `src/fetch-patch.ts`:monkey-patch `globalThis.fetch`,匹配->选 key->设头->发请求->读状态码->429 标记
- [x] 3.7 运行 `bun test tests/fetch-patch.test.ts` 确认通过

## 4. 用量统计与图表(usage-tracking)

- [x] 4.1 编写 `tests/stats.test.ts`:`message.updated` 带 `tokens` 按天累计 req/in/out/reasoning/cacheRead/cacheWrite/cost、无 `tokens` 忽略、按本地日期 `YYYY-MM-DD` 分组
- [x] 4.2 实现 `src/stats.ts`:内存累积、60s 定时刷盘、`beforeExit`/`SIGINT`/`SIGTERM` 兜底刷盘、JSON 读写(`~/.local/share/opencode/round-robin-stats.json`,可配 `statsPath`)
- [x] 4.3 运行 `bun test tests/stats.test.ts` 确认通过
- [x] 4.4 编写 `tests/chart.test.ts`:默认返回近 7 天 ASCII 柱状图(请求数 + token 两列)、`days` 参数控制天数、无数据返回"暂无统计数据"
- [x] 4.5 实现 `src/chart.ts`:由 stats 生成 ASCII 柱状图字符串
- [x] 4.6 运行 `bun test tests/chart.test.ts` 确认通过

## 5. 请求日志(重写:加账号名 + event 层 token 日志)

- [x] 5.1 更新 `tests/logger.test.ts`:fetch 层日志含账号名;新增 event 层 token 日志(in/out/cost)测试
- [x] 5.2 更新 `src/logger.ts`:`log` 加 `accountName` 参数;新增 `logUsage(tokens, cost)` 方法写 token 日志行
- [x] 5.3 运行 `bun test tests/logger.test.ts` 确认通过

## 6. 插件入口(重写:config hook 构建 pool + event token 日志)

- [x] 6.1 重写 `src/index.ts`:`config` hook 里调 `buildPoolsFromProviders` 构建 `KeyPool[]` 并安装 `patchFetch`;`onResponse` 传账号名调 `logger.log`;`event` hook 除累计 stats 外调 `logger.logUsage`
- [ ] 6.2 在 `~/.config/opencode/opencode.jsonc` 配置本插件(`providers` + 可选 `cooldownMs`),`model` 改为真实 provider(如 `volxc9208/glm-5.2`),重启 opencode,发消息验证:日志写入(含账号名 + token 行)、统计累计、流式输出正常、Spike 验证 `config` hook 时机与本地加载方式

## 7. 文档与收尾

- [x] 7.1 更新 `README.md`:配置示例由 `pools` 改为 `providers`(账号名列表),说明"从 provider 读 baseURL+apiKey,按 baseURL 分组",`model` 引用真实 provider
- [x] 7.2 查 `https://opencode.ai/docs/plugins` 确认自动安装措辞,在 README 补全"opencode 自动安装方式"章节
- [ ] 7.3 卸载 balancer:从 `opencode.jsonc`/`tui.json` 的 `plugin` 删除 `@thelioo/opencode-balancer`,删除 `~/.config/opencode/balancer.sqlite`
- [ ] 7.4 `git add`/`commit` 初始版本,push 到 GitHub
- [x] 7.5 归档前运行 `bun test` 全量测试,确认无回归
