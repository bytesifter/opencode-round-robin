import { tool, type Plugin, type PluginModule } from "@opencode-ai/plugin"
import { homedir } from "node:os"
import { join } from "node:path"
import { parseOptions, buildPoolsFromProviders } from "./config"
import { KeyPool } from "./pool"
import { patchFetch } from "./fetch-patch"
import { StatsCollector, type UsageInput } from "./stats"
import { renderChart } from "./chart"
import { Logger, tail, type UsageTokens } from "./logger"
import type { EventContext } from "./types"

/** 图表默认展示天数 */
const DEFAULT_CHART_DAYS = 7

/** HTTP 429 状态码 */
const HTTP_TOO_MANY_REQUESTS = 429

let globalStats: StatsCollector | null = null
let globalLogger: Logger | null = null
let globalPools: KeyPool[] = []
let fetchPatched = false

/**
 * 插件 server 入口。
 *
 * 使用模块级单例:opencode 为每个项目目录调用 server(),但 StatsCollector、Logger、
 * KeyPool[]、patchFetch 全局共享(单一 timer、不覆写文件、cooldown 跨项目生效)。
 *
 * @param _input - opencode 注入的 PluginInput(未使用)
 * @param options - 来自 opencode.jsonc 的 plugin options(含 providers)
 * @returns Hooks(config + event + tool)
 */
const server: Plugin = async (_input, options) => {
  const opts = parseOptions(options as Record<string, unknown> | undefined)

  if (!globalStats) {
    const statsPath = opts.statsPath ?? defaultPath("round-robin-stats.json")
    globalStats = new StatsCollector(statsPath)
    if (opts.logPath) {
      globalLogger = new Logger(opts.logPath)
    } else {
      const logDir = opts.logDir ?? defaultDir()
      globalLogger = new Logger(logDir, { rotation: true })
    }
  }

  return {
    config: async (config) => {
      if (fetchPatched) return
      const parsedPools = buildPoolsFromProviders(
        config as unknown as { provider?: Record<string, { options?: { apiKey?: string; baseURL?: string } }> },
        opts.providers,
        opts.cooldownMs,
      )
      globalPools = parsedPools.map((p) => new KeyPool(p))
      patchFetch(globalPools, {
        onResponse: (pool, key, status, durationMs) => {
          const idx = pool.keyIndex(key)
          const account = pool.accountName(key)
          globalLogger!.logFetch(account, idx, tail(key), status, durationMs)
          if (status === HTTP_TOO_MANY_REQUESTS) {
            globalLogger!.logCooldown(account, idx, tail(key), pool.cooldownMs)
          }
        },
      })
      fetchPatched = true
    },
    event: async ({ event }) => {
      const e = event as {
        type?: string
        properties?: {
          sessionID?: string
          info?: UsageInput & {
            modelID?: string
            providerID?: string
            mode?: string
            agent?: string
            time?: { created?: number; completed?: number }
          }
        }
      }
      if (e.type === "message.updated" && e.properties?.info) {
        const info = e.properties.info
        const rawSession = e.properties.sessionID
        globalStats!.recordUsage(info)
        if (info.tokens) {
          const ctx: EventContext = {
            sessionID: rawSession ? rawSession.slice(0, 4) : undefined,
            modelID: info.modelID,
            providerID: info.providerID,
            mode: info.mode,
            agent: info.agent,
            durationMs:
              typeof info.time?.created === "number" && typeof info.time?.completed === "number"
                ? info.time.completed - info.time.created
                : 0,
          }
          globalLogger!.logUsage(info.tokens as UsageTokens, typeof info.cost === "number" ? info.cost : 0, ctx)
        }
      }
    },
    tool: {
      roundrobin_stats: tool({
        description: "查看 opencode-round-robin 按天统计(请求数与 token 消耗)",
        args: { days: tool.schema.number().optional() },
        execute: async (args) => {
          const days = typeof args.days === "number" ? args.days : DEFAULT_CHART_DAYS
          return renderChart(globalStats!.getStore(), days)
        },
      }),
    },
  }
}

const pluginModule: PluginModule = {
  id: "opencode-round-robin",
  server,
}

export default pluginModule

/**
 * 解析默认数据文件路径:优先 XDG_DATA_HOME,否则 ~/.local/share/opencode。
 *
 * @param filename - 文件名(stats json)
 * @returns 完整路径
 */
function defaultPath(filename: string): string {
  const xdg = process.env.XDG_DATA_HOME
  const base = xdg ? join(xdg, "opencode") : join(homedir(), ".local", "share", "opencode")
  return join(base, filename)
}

/**
 * 解析默认日志目录:优先 XDG_DATA_HOME,否则 ~/.local/share/opencode。
 *
 * @returns 目录路径
 */
function defaultDir(): string {
  const xdg = process.env.XDG_DATA_HOME
  return xdg ? join(xdg, "opencode") : join(homedir(), ".local", "share", "opencode")
}
