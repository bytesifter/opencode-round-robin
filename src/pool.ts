import type { ProviderEntry } from "./types"

/** 冷却记录:记录到期时间戳 */
interface CooldownEntry {
  /** 到期时间戳(毫秒) */
  until: number
}

/**
 * provider 池:负责随机选 provider 与 cooldown 管理。
 *
 * - 随机选择无状态,不维护轮询位置
 * - cooldown 仅标记不重试,失败交 opencode 原生
 * - 全部 provider 冷却时返回 null(passthrough)
 */
export class ProviderPool {
  private readonly entries: ProviderEntry[]
  readonly cooldownMs: number
  readonly quotaCooldownMs: number
  private readonly cooldowns = new Map<string, CooldownEntry>()

  constructor(entries: ProviderEntry[], cooldownMs: number, quotaCooldownMs: number = 3600000) {
    this.entries = entries
    this.cooldownMs = cooldownMs
    this.quotaCooldownMs = quotaCooldownMs
  }

  /**
   * 随机选一个非熔断 provider;全部熔断时返回 null(passthrough)。
   *
   * @returns 选中的 ProviderEntry,或 null(全熔断)
   */
  next(): ProviderEntry | null {
    const now = Date.now()
    const available = this.entries.filter((e) => !this.isCoolingDown(e.key, now))
    if (available.length === 0) return null
    const idx = Math.floor(Math.random() * available.length)
    return available[idx]
  }

  /**
   * 标记某 provider 熔断(收到 429 后调用)。
   *
   * @param key - 被限流的 provider 的 key
   * @param ms - 自定义冷却时长(毫秒),不传时用 pool 默认 cooldownMs
   */
  markCooldown(key: string, ms?: number): void {
    this.cooldowns.set(key, { until: Date.now() + (ms ?? this.cooldownMs) })
  }

  /**
   * 查询某 key 是否在冷却中。已过期的记录会被惰性清理。
   */
  isCoolingDown(key: string, now: number = Date.now()): boolean {
    const entry = this.cooldowns.get(key)
    if (!entry) return false
    if (now >= entry.until) {
      this.cooldowns.delete(key)
      return false
    }
    return true
  }

  /**
   * 返回 key 在列表中的序号(用于日志脱敏)。
   */
  keyIndex(key: string): number {
    return this.entries.findIndex((e) => e.key === key)
  }

  /**
   * 返回 key 对应的账号名(用于日志)。未找到返回 "unknown"。
   */
  accountName(key: string): string {
    return this.entries.find((e) => e.key === key)?.account ?? "unknown"
  }

  /**
   * 查找 URL 匹配的已配置 baseURL(用于提取路径前缀)。
   * 返回首个匹配的 baseURL,不匹配返回 null。
   */
  findBaseURL(url: string): string | null {
    for (const e of this.entries) {
      if (url.startsWith(e.baseURL)) return e.baseURL
    }
    return null
  }
}
