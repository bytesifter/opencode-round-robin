# opencode-round-robin

opencode 插件:对同一服务商的多个账号 API key 做**随机轮询**,附带按天用量统计与结构化请求日志。

与 `@thelioo/opencode-balancer` 的核心区别:主动随机轮询(每次请求换 key),而非被动失败重试;且不依赖 sqlite/TUI,体量极简。

## 功能

- **随机轮询**:声明 `providers`(账号名列表),插件通过 `config` hook 读 opencode 的 provider 配置,按 `baseURL` 自动分组,每组随机选 key--**复用 provider 已有的 baseURL+apiKey,无需重复配置**
- **429 cooldown**:某 key 被限流后默认 60 秒不再选用,时长可配;全部冷却时兜底随机
- **用量统计**:通过 `event` hook 按天累计请求数与 token 消耗(input/output/reasoning/cache),内存累积 60 秒刷盘到 JSON
- **图表查看**:注册 `roundrobin_stats` 工具,返回按天 ASCII 柱状图
- **结构化日志**:按日轮转,含日志级别(INFO/WARN/ERROR)、业务上下文(session/model/mode/agent)、请求耗时;key 脱敏(仅记序号与末 4 位)
- **自包含构建**:`dist/index.js` 内联 `@opencode-ai/plugin` 的 `tool()` 函数及 `zod`,运行时无需 `node_modules` 中存在 `@opencode-ai/plugin`,支持 npm 零配置分发

## 安装

### 方式一:npm(发布后)

在 `~/.config/opencode/opencode.jsonc` 的 `plugin` 数组中加入:

```jsonc
"plugin": [
  ["opencode-round-robin", { "providers": ["volxc9208", "volxc5425", "vollqh5426"] }]
]
```

### 方式二:本地路径(开发/未发布时)

在 `~/.config/opencode/opencode.jsonc` 的 `plugin` 数组中用 `file:///` 路径声明:

```jsonc
"plugin": [
  ["file:///D:/code/projects/opencode-round-robin", { "providers": ["volxc9208", "volxc5425", "vollqh5426"] }]
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
- 插件通过 `config` hook 读取 `opencode.jsonc` 中 `providers` 列表对应的 provider,按 `baseURL` 自动分组构建 key 池
- 同一 `baseURL` 下的多个账号聚为一组随机轮询;不同 `baseURL`(如 coding/plan 端点)自动分到不同组
- 模型一致性由配置者保证(插件不校验,只按 `baseURL` 分组)

## 配置示例

以火山方舟 3 个 coding 账号 + 1 个 plan 账号为例。先在 `provider` 里按"每个账号一个 provider"配好:

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "model": "volxc9208/glm-5.2",            // 引用任一 coding provider 即可,插件按 URL 轮询覆盖 key
  "provider": {
    "volxc9208": {
      "name": "volxc9208",
      "npm": "@ai-sdk/openai-compatible",
      "models": { "glm-5.2": { "name": "glm-5.2" } },
      "options": {
        "apiKey": "ark-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-22898",
        "baseURL": "https://ark.cn-beijing.volces.com/api/coding/v3"
      }
    },
    "volxc5425": {
      "name": "volxc5425",
      "npm": "@ai-sdk/openai-compatible",
      "models": { "glm-5.2": { "name": "glm-5.2" } },
      "options": {
        "apiKey": "ark-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-32a5b",
        "baseURL": "https://ark.cn-beijing.volces.com/api/coding/v3"
      }
    },
    "vollqh5426": {
      "name": "vollqh5426",
      "npm": "@ai-sdk/openai-compatible",
      "models": { "glm-5.2": { "name": "glm-5.2" } },
      "options": {
        "apiKey": "ark-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx-48199",
        "baseURL": "https://ark.cn-beijing.volces.com/api/coding/v3"
      }
    }
  },
  "plugin": [
    ["file:///D:/code/projects/opencode-round-robin", {
      "providers": ["volxc9208", "volxc5425", "vollqh5426"],
      "cooldownMs": 60000
    }]
  ]
}
```

插件启动后:3 个 coding 账号同 `baseURL`,自动聚为一组随机轮询;`model` 引用 `volxc9208` 只是让 opencode 知道用哪个 `baseURL` 发请求,实际用哪个账号的 key 由插件随机决定。

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
2026-07-26 18:51:40.123 INFO  fetch provider=volxc9208 key=#0(..2898) status=200 duration=342ms
2026-07-26 18:52:08.456 INFO  usage in=4556 out=2182 reasoning=0 cacheR=312384 cacheW=0 cost=0.0021 session=a3f2 model=glm-5.2 provider=volxc9208 mode=code agent=opencode duration=1283ms
2026-07-26 18:53:00.789 WARN  cooldown provider=volxc5425 key=#1(..2a5b) 60000ms
```

- 第一行(fetch 层):用了 volxc9208 账号的 key#0,HTTP 200,耗时 342ms
- 第二行(event 层):本次消息 token 用量,含 session/model/mode/agent/duration 等业务上下文
- 第三行(429):volxc5425 被限流,冷却 60 秒

日志按日轮转,文件名 `round-robin-YYYY-MM-DD.log`。配置 `logPath` 可强制单文件模式(禁用轮转)。

## 与 balancer 的区别

| 维度 | balancer(已停用) | round-robin |
|------|-------------------|-------------|
| 策略 | 被动失败重试 | 主动随机轮询 |
| key 利用 | 1 个干活,其余备份 | 全部均匀使用 |
| 配置 | 独立账号管理 | 复用 opencode provider,只列 `providers` |
| 持久化 | sqlite 五张表 | 单 JSON 文件 |
| 界面 | solid-js TUI dashboard | 工具返回 ASCII 图表 |
| 失败处理 | 重试下一个 key | 标 cooldown,不重试 |
| 日志 | 无 | 结构化(级别/业务上下文/按日轮转) |
| 构建 | - | 自包含(无运行时依赖) |
| 体量 | 大 | 极简(~740 行) |

## 开发

```bash
bun install          # 安装依赖
bun run build        # 构建自包含产物到 dist/index.js
bun test             # 运行测试
bun x tsc --noEmit   # 类型检查
```

技术栈:Bun + TypeScript;`bun build` 打包为 Node.js ESM(`--target node`),`main` 指向 `./dist/index.js`。`@opencode-ai/plugin` 在 `devDependencies`(编译期类型),运行时已内联到 `dist/index.js`。
