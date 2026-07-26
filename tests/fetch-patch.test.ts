import { test, expect, beforeEach, afterEach } from "bun:test"
import { patchFetch } from "../src/fetch-patch"
import { KeyPool } from "../src/pool"
import type { ParsedPool } from "../src/types"

let origFetch: typeof globalThis.fetch

beforeEach(() => {
  origFetch = globalThis.fetch
})
afterEach(() => {
  globalThis.fetch = origFetch
})

function makePool(keys: string[], match = "https://x.example/api"): KeyPool {
  const keyAccounts = new Map<string, string>()
  keys.forEach((k, i) => keyAccounts.set(k, `account${i}`))
  const p: ParsedPool = {
    match,
    keys,
    cooldownMs: 60000,
    keyAccounts,
  }
  return new KeyPool(p)
}

test("URL 匹配 pool 注入 Authorization", async () => {
  let receivedAuth: string | null = null
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    receivedAuth = new Headers(init?.headers).get("Authorization")
    return new Response("ok", { status: 200 })
  }) as unknown as typeof globalThis.fetch

  const unpatch = patchFetch([makePool(["k1", "k2"])])
  await fetch("https://x.example/api/chat", {})
  unpatch()

  expect(receivedAuth).toMatch(/^Bearer (k1|k2)$/)
})

test("URL 不匹配透传不改 headers", async () => {
  let receivedAuth: string | null = "sentinel"
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    receivedAuth = init?.headers ? new Headers(init.headers).get("Authorization") : null
    return new Response("ok", { status: 200 })
  }) as unknown as typeof globalThis.fetch

  const unpatch = patchFetch([makePool(["k1", "k2"], "https://x.example/api")])
  await fetch("https://other.example/chat", {})
  unpatch()

  expect(receivedAuth).toBeNull()
})

test("429 响应触发 markCooldown", async () => {
  const pool = makePool(["k1", "k2", "k3"])
  globalThis.fetch = (async () => new Response("rate limited", { status: 429 })) as unknown as typeof globalThis.fetch

  const unpatch = patchFetch([pool])
  // 50 次 429,3 个 key,必然有 key 被标记冷却
  for (let i = 0; i < 50; i++) {
    await fetch("https://x.example/api/chat", {})
  }
  unpatch()

  const anyCooling = pool.isCoolingDown("k1") || pool.isCoolingDown("k2") || pool.isCoolingDown("k3")
  expect(anyCooling).toBe(true)
})

test("单 key pool 拦截并设置 Authorization", async () => {
  let receivedAuth: string | null = null
  globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
    receivedAuth = new Headers(init?.headers).get("Authorization")
    return new Response("ok", { status: 200 })
  }) as unknown as typeof globalThis.fetch

  const unpatch = patchFetch([makePool(["only"])])
  await fetch("https://x.example/api/chat", {})
  unpatch()

  expect(receivedAuth!).toBe("Bearer only")
})

test("onPick 与 onResponse 回调触发", async () => {
  globalThis.fetch = (async () => new Response("ok", { status: 200 })) as unknown as typeof globalThis.fetch

  const picks: string[] = []
  const statuses: number[] = []
  const unpatch = patchFetch([makePool(["k1", "k2"])], {
    onPick: (_pool, key) => picks.push(key),
    onResponse: (_pool, _key, status, _durationMs) => statuses.push(status),
  })
  await fetch("https://x.example/api/chat", {})
  unpatch()

  expect(picks).toHaveLength(1)
  expect(["k1", "k2"]).toContain(picks[0])
  expect(statuses).toEqual([200])
})

test("unpatch 恢复原始 fetch", async () => {
  const mockFetch = (async () => new Response("mock")) as unknown as typeof globalThis.fetch
  globalThis.fetch = mockFetch

  const unpatch = patchFetch([makePool(["k1", "k2"])])
  unpatch()

  expect(globalThis.fetch).toBe(mockFetch)
})
