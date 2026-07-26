# opencode-round-robin

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

opencode 插件:对多个账号 API key 做**随机轮询**,附带按天用量统计与结构化请求日志。

## 功能

- **随机轮询**:声明 `providers`(账号名列表),插件通过 `config` hook 读 opencode 的 provider 配置,收集所有 key + baseURL,每次请求随机选一个 provider,同时替换 Authorization 头和请求 URL--**所有 provider 都参与轮询,不分组**
- **429 熔断**:某 provider 被限流后默认 60 秒不再选用,时长可配;全部熔断时 passthrough 回退到 opencode 原生请求
- **用量统计**:通过 `event` hook 按天累计请求数与 token 消耗(input/output/reasoning/cache),内存累积 60 秒刷盘到 JSON
- **图表查看**:注册 `roundrobin_stats` 工具,返回按天 ASCII 柱状图
- **结构化日志**:按日轮转,含日志级别(INFO/WARN/ERROR)、业务上下文(session/model/provider/mode/agent/duration)、请求耗时;key 脱敏(仅记序号与末 4 位)
- **自包含构建**:`dist/index.js` 内联 `@opencode-ai/plugin` 的 `tool()` 函数及 `zod`,运行时无需 `node_modules` 中存在 `@opencode-ai/plugin`,零依赖分发

## 安装

```bash
git clone https://github.com/bytesifter/opencode-round-robin.git
cd opencode-round-robin
bun install
bun run build
```

在 `~/.config/opencode/opencode.jsonc` 的 `plugin` 数组中用 `file:///` 指向你 clone 的路径:

```jsonc
"plugin": [
  ["file:///path/to/opencode-round-robin", { "providers": ["account-a", "account-b", "account-c"] }]
]
```

> 插件的 `main` 指向 `./dist/index.js`(预构建产物),opencode 通过 `import()` 加载。如需修改源码,执行 `bun run build` 重新构建。

## 配置

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `providers` | `string[]` | 是 | - | 参与轮询的 provider 名(账号名)列表 |
| `cooldownMs` | `number` | 否 | `60000` | 429 后 key 冷却时长(毫秒),全局 |
| `statsPath` | `string` | 否 | 见下 | 统计文件路径 |
| `logDir` | `string` | 否 | 见下 | 日志目录(按日轮转,默认启用) |
| `logPath` | `string` | 否 | - | 日志文件路径(强制单文件模式,禁用轮转) |

默认产物路径(`~/.local/share/opencode/`):
- 统计:`~/.local/share/opencode/round-robin-stats.json`
- 日志:`~/.local/share/opencode/round-robin-YYYY-MM-DD.log`(按日轮转)

日志模式优先级:`logPath > logDir > 默认(轮转)`。配置 `logPath` 时强制单文件模式并忽略 `logDir`;不配 `logPath` 时启用按日轮转,目录为 `logDir` 或默认路径。

规则:
- 插件通过 `config` hook 读取 `opencode.jsonc` 中 `providers` 列表对应的 provider,收集所有 key + baseURL 形成扁平列表
- 每次请求随机选一个 provider,同时替换 Authorization 头和请求 URL(key 和端点配对,不会错配)
- 全部 provider 熔断(429)时 passthrough 回退到 opencode 原生请求
- key 去重(相同 key 只保留第一个 provider)

## 配置示例

以 3 个同端点账号为例。先在 `provider` 里按"每个账号一个 provider"配好:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "account-a/glm-5.2",
  "provider": {
    "account-a": {
      "name": "account-a",
      "npm": "@ai-sdk/openai-compatible",
      "models": { "glm-5.2": { "name": "glm-5.2" } },
      "options": {
        "apiKey": "ark-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-22898",
        "baseURL": "https://ark.cn-beijing.volces.com/api/coding/v3"
      }
    },
    "account-b": {
      "name": "account-b",
      "npm": "@ai-sdk/openai-compatible",
      "models": { "glm-5.2": { "name": "glm-5.2" } },
      "options": {
        "apiKey": "ark-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-32a5b",
        "baseURL": "https://ark.cn-beijing.volces.com/api/coding/v3"
      }
    },
    "account-c": {
      "name": "account-c",
      "npm": "@ai-sdk/openai-compatible",
      "models": { "glm-5.2": { "name": "glm-5.2" } },
      "options": {
        "apiKey": "ark-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-48199",
        "baseURL": "https://ark.cn-beijing.volces.com/api/coding/v3"
      }
    }
  },
  "plugin": [
    ["file:///path/to/opencode-round-robin", {
      "providers": ["account-a", "account-b", "account-c"],
      "cooldownMs": 60000
    }]
  ]
}
```

`model` 指向的 provider 决定 opencode 发出的初始请求 URL,插件拦截 fetch 后用 `pool.findBaseURL()` 识别该请求归属,然后替换为随机选中 provider 的 URL + key。所有 provider 在一个扁平池中随机轮询,不按 baseURL 分组。

## 工具用法

对 LLM 说"看轮询统计",LLM 会调用 `roundrobin_stats` 工具,返回近 7 天 ASCII 柱状图:

```
round-robin 近 7 天统计
日期      请求                 token
07-25  ████████████·····    34   ████████████·····   19.7k
07-24  ████████·········    23   ██████············   15.3k
07-23  █████████████████    67   █████████████████   38.3k
...
```

可选参数 `days` 指定天数(如"看近 30 天统计")。

## 日志示例

```
2026-07-26 18:51:40.123 INFO  fetch provider=account-a key=#0(..2898) status=200 duration=342ms
2026-07-26 18:52:08.456 INFO  usage in=4556 out=2182 reasoning=0 cacheR=312384 cacheW=0 cost=0.0021 session=a3f2 model=glm-5.2 provider=account-a mode=code agent=opencode duration=1283ms
2026-07-26 18:53:00.789 WARN  cooldown provider=account-b key=#1(..2a5b) 60000ms
```

- 第一行(fetch 层):用了 account-a 账号的 key#0,HTTP 200,耗时 342ms
- 第二行(event 层):本次消息 token 用量,含 session/model/provider/mode/agent/duration 等业务上下文
- 第三行(429):account-b 被限流,冷却 60 秒

日志按日轮转,文件名 `round-robin-YYYY-MM-DD.log`。配置 `logPath` 可强制单文件模式(禁用轮转)。

## 开发

```bash
bun install          # 安装依赖
bun run build        # 构建自包含产物到 dist/index.js
bun test             # 运行测试
bun x tsc --noEmit   # 类型检查
```

技术栈:Bun + TypeScript;`bun build` 打包为 Node.js ESM(`--target node`),`main` 指向 `./dist/index.js`。`@opencode-ai/plugin` 在 `devDependencies`(编译期类型),运行时已内联到 `dist/index.js`。

## 贡献

欢迎提 Issue 或 Pull Request。

## 许可证

[Apache License 2.0](LICENSE)。
