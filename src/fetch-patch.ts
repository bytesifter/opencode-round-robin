import type { KeyPool } from "./pool"

/**
 * fetch-patch 的回调,用于日志等副作用(与 logger 模块解耦)。
 */
export interface FetchPatchCallbacks {
  /** 选定 key 后、发请求前触发 */
  onPick?: (pool: KeyPool, key: string) => void
  /** 收到响应后触发(429 已标记 cooldown 之后),含请求耗时毫秒 */
  onResponse?: (pool: KeyPool, key: string, status: number, durationMs: number) => void
}

/** 429 状态码:Too Many Requests,触发该 key 冷却 */
const HTTP_TOO_MANY_REQUESTS = 429

/**
 * monkey-patch `globalThis.fetch`,对匹配 pool 的请求随机注入 Authorization。
 *
 * 设计要点(见 design 决策 1、3):
 * - 覆盖所有 HTTP 请求,含子 agent/compact,轮询更彻底
 * - 仅改 Authorization 头,不碰 body,不影响流式响应
 * - 429 仅标记 cooldown,不在内部换 key 重发(失败交 opencode 原生)
 *
 * @param pools - key 池列表
 * @param callbacks - 选 key 与响应的回调(用于日志)
 * @returns unpatch 函数,调用后恢复原始 fetch
 */
export function patchFetch(pools: KeyPool[], callbacks?: FetchPatchCallbacks): () => void {
  const origFetch = globalThis.fetch
  const patchedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = resolveUrl(input)
    const pool = matchPool(pools, url)
    // 不匹配或单 key 透传:不改 headers,直接透传
    if (!pool || pool.passthrough) {
      return origFetch(input, init)
    }
    const key = pool.next()
    callbacks?.onPick?.(pool, key)
    const headers = new Headers(init?.headers)
    headers.set("Authorization", `Bearer ${key}`)
    const startMs = Date.now()
    const response = await origFetch(input, { ...init, headers })
    const durationMs = Date.now() - startMs
    if (response.status === HTTP_TOO_MANY_REQUESTS) {
      pool.markCooldown(key)
    }
    callbacks?.onResponse?.(pool, key, response.status, durationMs)
    return response
  }
  // 透传 Bun fetch 的 preconnect(连接预热),避免丢失优化能力
  const origPreconnect = (origFetch as unknown as { preconnect?: (url: string | URL) => void }).preconnect
  if (typeof origPreconnect === "function") {
    ;(patchedFetch as unknown as { preconnect?: (url: string | URL) => void }).preconnect =
      origPreconnect.bind(origFetch)
  }
  globalThis.fetch = patchedFetch as unknown as typeof globalThis.fetch
  return () => {
    globalThis.fetch = origFetch
  }
}

/**
 * 从 fetch 入参解析 URL 字符串(兼容 string / URL / Request)。
 */
function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input
  if (input instanceof URL) return input.href
  return input.url
}

/**
 * 按 URL 前缀匹配 pool,返回首个匹配项。
 */
function matchPool(pools: KeyPool[], url: string): KeyPool | undefined {
  return pools.find((p) => url.startsWith(p.match))
}
