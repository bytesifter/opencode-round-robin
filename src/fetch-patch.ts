import type { ProviderPool } from "./pool"
import type { ProviderEntry } from "./types"

/**
 * fetch-patch 的回调,用于日志等副作用。
 */
export interface FetchPatchCallbacks {
  /** 收到响应后触发(429 已标记 cooldown 之后),含 provider 信息与耗时 */
  onResponse?: (pool: ProviderPool, entry: ProviderEntry, status: number, durationMs: number) => void
}

/** 429 状态码:Too Many Requests,触发该 provider 熔断 */
const HTTP_TOO_MANY_REQUESTS = 429

/**
 * monkey-patch `globalThis.fetch`,随机选 provider 并替换 URL + Authorization。
 *
 * - 从所有 provider 中随机选一个(跳过熔断中的),替换请求 URL 和 Authorization 头
 * - 全部熔断或 URL 不匹配任何已配置 baseURL 时 passthrough
 * - 429 仅标记熔断,不在内部换 provider 重发
 *
 * @param pool - provider 池
 * @param callbacks - 响应回调(用于日志)
 * @returns unpatch 函数
 */
export function patchFetch(pool: ProviderPool, callbacks?: FetchPatchCallbacks): () => void {
  const origFetch = globalThis.fetch
  const patchedFetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = resolveUrl(input)
    // 找到原始 baseURL,提取路径
    const originalBaseURL = pool.findBaseURL(url)
    if (!originalBaseURL) {
      // URL 不匹配任何已配置 baseURL:passthrough
      return origFetch(input, init)
    }
    const entry = pool.next()
    if (!entry) {
      // 全熔断:passthrough 原始请求
      return origFetch(input, init)
    }
    // 替换 URL:去掉原始 baseURL 前缀,拼接到选中 provider 的 baseURL
    const path = url.slice(originalBaseURL.length)
    const newUrl = entry.baseURL + path
    const headers = new Headers(init?.headers)
    headers.set("Authorization", `Bearer ${entry.key}`)
    const startMs = Date.now()
    const response = await origFetch(newUrl, { ...init, headers })
    const durationMs = Date.now() - startMs
    if (response.status === HTTP_TOO_MANY_REQUESTS) {
      pool.markCooldown(entry.key)
    }
    callbacks?.onResponse?.(pool, entry, response.status, durationMs)
    return response
  }
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
