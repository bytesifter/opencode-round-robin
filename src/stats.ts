import type { StatsStore, DayStats } from "./types"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { dirname } from "node:path"

/**
 * Usage 输入:从 AssistantMessage 提取的字段(与 @opencode-ai/sdk 解耦,便于测试)。
 */
export interface UsageInput {
  role?: string
  tokens?: {
    input: number
    output: number
    reasoning: number
    cache: { read: number; write: number }
  }
  cost?: number
}

/** 默认定时刷盘间隔(毫秒) */
const DEFAULT_FLUSH_MS = 60000

/**
 * 用量统计收集器:内存累积 + 定时刷盘到 JSON。
 *
 * 设计要点(见 design 决策 4、5):
 * - 通过 event hook 的 message.updated 拿 usage,不解析 SSE 流
 * - 内存累积,60s 定时刷盘,崩溃最多丢 1 分钟统计
 */
export class StatsCollector {
  private store: StatsStore = {}
  private readonly path: string
  private readonly flushMs: number
  private timer?: ReturnType<typeof setInterval>

  constructor(
    path: string,
    opts: { flushMs?: number; registerExitHooks?: boolean } = {},
  ) {
    this.path = path
    this.flushMs = opts.flushMs ?? DEFAULT_FLUSH_MS
    this.load()
    if (opts.registerExitHooks !== false) {
      this.timer = setInterval(() => this.flush(), this.flushMs)
      process.on("beforeExit", this.onBeforeExit)
    }
  }

  /**
   * 累计一条 usage。无 tokens 字段时忽略(流式中途更新无 usage)。
   */
  recordUsage(info: UsageInput): void {
    if (!info.tokens) return
    const day = todayLocal()
    const s = this.store[day] ?? newDayStats()
    s.req++
    s.in += num(info.tokens.input)
    s.out += num(info.tokens.output)
    s.reasoning += num(info.tokens.reasoning)
    s.cacheRead += num(info.tokens.cache.read)
    s.cacheWrite += num(info.tokens.cache.write)
    if (typeof info.cost === "number") s.cost += info.cost
    this.store[day] = s
  }

  /** 读取内存 store(图表工具用) */
  getStore(): StatsStore {
    return this.store
  }

  /** 立即刷盘到 JSON 文件 */
  flush(): void {
    mkdirSync(dirname(this.path), { recursive: true })
    writeFileSync(this.path, JSON.stringify(this.store, null, 2))
  }

  /** 从 JSON 加载(文件不存在或损坏则置空) */
  load(): void {
    if (!existsSync(this.path)) {
      this.store = {}
      return
    }
    try {
      this.store = JSON.parse(readFileSync(this.path, "utf8")) as StatsStore
    } catch {
      this.store = {}
    }
  }

  /** 停止定时器并刷盘(测试与卸载用) */
  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.flush()
  }

  private onBeforeExit = () => this.flush()
}

function newDayStats(): DayStats {
  return { req: 0, in: 0, out: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0 }
}

/** 容错数值转换:非数字归零 */
function num(v: unknown): number {
  return typeof v === "number" && !Number.isNaN(v) ? v : 0
}

/** 本地日期 YYYY-MM-DD(按本地时区) */
export function todayLocal(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
