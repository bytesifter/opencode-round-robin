import type { ParsedPool } from "./types"

/** 冷却记录:记录到期时间戳 */
interface CooldownEntry {
  /** 到期时间戳(毫秒) */
  until: number
}

/**
 * key 池:负责随机选 key 与 cooldown 管理。
 *
 * 设计要点:
 * - 随机选择无状态,不维护轮询位置(见 design 决策 2)
 * - cooldown 仅标记不重试,失败交 opencode 原生(见 design 决策 3)
 * - 全部 key 冷却时兜底返回,不阻塞用户
 */
export class KeyPool {
  /** URL 前缀匹配串 */
  readonly match: string
  /** 池名称(用于日志) */
  readonly name: string
  /** 单 key 时为 true,匹配该 pool 的请求透传不拦截 */
  readonly passthrough: boolean
  private readonly keys: string[]
  readonly cooldownMs: number
  private readonly keyAccounts: Map<string, string>
  private readonly cooldowns = new Map<string, CooldownEntry>()

  constructor(pool: ParsedPool) {
    this.match = pool.match
    this.name = safeHost(pool.match)
    this.keys = pool.keys
    this.cooldownMs = pool.cooldownMs
    this.passthrough = pool.passthrough
    this.keyAccounts = pool.keyAccounts
  }

  /**
   * 随机选一个 key,跳过冷却中的 key;全部冷却时兜底忽略冷却。
   *
   * @returns 选中的 API key
   */
  next(): string {
    if (this.passthrough) return this.keys[0]
    const now = Date.now()
    const available = this.keys.filter((k) => !this.isCoolingDown(k, now))
    // 全部冷却时兜底:忽略 cooldown,避免无 key 可用而阻塞
    const candidates = available.length > 0 ? available : this.keys
    const idx = Math.floor(Math.random() * candidates.length)
    return candidates[idx]
  }

  /**
   * 标记某 key 冷却(收到 429 后调用)。
   *
   * @param key - 被限流的 key
   */
  markCooldown(key: string): void {
    this.cooldowns.set(key, { until: Date.now() + this.cooldownMs })
  }

  /**
   * 查询某 key 是否在冷却中。已过期的记录会被惰性清理。
   *
   * @param key - 待查询的 key
   * @param now - 当前时间戳(默认 Date.now(),可注入便于测试)
   * @returns 是否在冷却中
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
   * 返回 key 在池中的序号(用于日志脱敏)。
   *
   * @param key - 待查询的 key
   * @returns 序号,未找到为 -1
   */
  keyIndex(key: string): number {
    return this.keys.indexOf(key)
  }

  /**
   * 返回 key 对应的账号名(provider 名),用于日志。未找到返回 "unknown"。
   *
   * @param key - 选中的 key
   * @returns 账号名
   */
  accountName(key: string): string {
    return this.keyAccounts.get(key) ?? "unknown"
  }
}

/**
 * 从 URL 前缀提取 host 作为默认池名,失败时回退原串。
 */
function safeHost(match: string): string {
  try {
    return new URL(match).host
  } catch {
    return match
  }
}
