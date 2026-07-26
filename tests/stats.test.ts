import { test, expect, beforeEach, afterEach } from "bun:test"
import { StatsCollector, todayLocal } from "../src/stats"
import { mkdirSync, rmSync, existsSync } from "node:fs"
import { join } from "node:path"

const tmpDir = join(import.meta.dir, ".tmp-stats")
const statsPath = join(tmpDir, "stats.json")

beforeEach(() => {
  mkdirSync(tmpDir, { recursive: true })
})
afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

function makeCollector() {
  return new StatsCollector(statsPath, { registerExitHooks: false })
}

test("带 tokens 累计所有字段", () => {
  const c = makeCollector()
  c.recordUsage({
    role: "assistant",
    tokens: { input: 100, output: 50, reasoning: 10, cache: { read: 5, write: 3 } },
    cost: 0.02,
  })
  c.recordUsage({
    role: "assistant",
    tokens: { input: 200, output: 80, reasoning: 20, cache: { read: 8, write: 2 } },
    cost: 0.05,
  })
  const s = c.getStore()[todayLocal()]
  expect(s.req).toBe(2)
  expect(s.in).toBe(300)
  expect(s.out).toBe(130)
  expect(s.reasoning).toBe(30)
  expect(s.cacheRead).toBe(13)
  expect(s.cacheWrite).toBe(5)
  expect(s.cost).toBeCloseTo(0.07)
})

test("无 tokens 忽略", () => {
  const c = makeCollector()
  c.recordUsage({ role: "assistant" })
  c.recordUsage({ role: "user" })
  expect(c.getStore()[todayLocal()]).toBeUndefined()
})

test("按本地日期 YYYY-MM-DD 分组", () => {
  const c = makeCollector()
  c.recordUsage({
    role: "assistant",
    tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
  })
  const day = todayLocal()
  expect(c.getStore()[day]).toBeDefined()
  expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test("flush 写入 JSON 且可重新加载", () => {
  const c = makeCollector()
  c.recordUsage({
    role: "assistant",
    tokens: { input: 10, output: 5, reasoning: 0, cache: { read: 0, write: 0 } },
  })
  c.flush()
  expect(existsSync(statsPath)).toBe(true)

  const c2 = makeCollector()
  expect(c2.getStore()[todayLocal()].req).toBe(1)
  expect(c2.getStore()[todayLocal()].in).toBe(10)
})

test("文件不存在时 load 置空不报错", () => {
  const c = new StatsCollector(join(tmpDir, "noexist.json"), { registerExitHooks: false })
  expect(c.getStore()).toEqual({})
})
