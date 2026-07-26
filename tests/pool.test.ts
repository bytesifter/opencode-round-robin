import { test, expect } from "bun:test"
import { KeyPool } from "../src/pool"
import type { ParsedPool } from "../src/types"

function makePool(keys: string[], cooldownMs = 60000): KeyPool {
  const keyAccounts = new Map<string, string>()
  keys.forEach((k, i) => keyAccounts.set(k, `account${i}`))
  const pool: ParsedPool = {
    match: "https://x.example/api",
    keys,
    cooldownMs,
    passthrough: keys.length === 1,
    keyAccounts,
  }
  return new KeyPool(pool)
}

test("随机选 key 返回池中的 key", () => {
  const pool = makePool(["k1", "k2", "k3"])
  for (let i = 0; i < 50; i++) {
    expect(["k1", "k2", "k3"]).toContain(pool.next())
  }
})

test("随机性:多 key 都会被选中", () => {
  const pool = makePool(["k1", "k2", "k3"])
  const counts = { k1: 0, k2: 0, k3: 0 }
  for (let i = 0; i < 300; i++) {
    counts[pool.next() as "k1" | "k2" | "k3"]++
  }
  expect(counts.k1).toBeGreaterThan(0)
  expect(counts.k2).toBeGreaterThan(0)
  expect(counts.k3).toBeGreaterThan(0)
})

test("429 标记 cooldown 后跳过该 key", () => {
  const pool = makePool(["k1", "k2", "k3"])
  pool.markCooldown("k1")
  for (let i = 0; i < 50; i++) {
    expect(pool.next()).not.toBe("k1")
  }
})

test("cooldown 到期恢复可用", async () => {
  const pool = makePool(["k1", "k2"], 50)
  pool.markCooldown("k1")
  expect(pool.isCoolingDown("k1")).toBe(true)
  await new Promise((r) => setTimeout(r, 70))
  expect(pool.isCoolingDown("k1")).toBe(false)
  let k1Selected = false
  for (let i = 0; i < 100; i++) {
    if (pool.next() === "k1") k1Selected = true
  }
  expect(k1Selected).toBe(true)
})

test("全部冷却兜底随机返回", () => {
  const pool = makePool(["k1", "k2"])
  pool.markCooldown("k1")
  pool.markCooldown("k2")
  for (let i = 0; i < 20; i++) {
    expect(["k1", "k2"]).toContain(pool.next())
  }
})

test("单 key pool passthrough 为 true 且 next 返回唯一 key", () => {
  const pool = makePool(["only"])
  expect(pool.passthrough).toBe(true)
  expect(pool.next()).toBe("only")
})

test("isCoolingDown 未标记的 key 返回 false", () => {
  const pool = makePool(["k1", "k2"])
  expect(pool.isCoolingDown("k1")).toBe(false)
})

test("accountName 返回 key 对应的账号名", () => {
  const pool = makePool(["k1", "k2"])
  expect(pool.accountName("k1")).toBe("account0")
  expect(pool.accountName("k2")).toBe("account1")
  expect(pool.accountName("not-exist")).toBe("unknown")
})
