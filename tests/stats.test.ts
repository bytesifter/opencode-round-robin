import { test, expect, beforeEach, afterEach } from "bun:test"
import { StatsCollector, todayLocal, type UsageInput } from "../src/stats"
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
    id: "msg-1",
    role: "assistant",
    finish: "stop",
    tokens: { input: 100, output: 50, reasoning: 10, cache: { read: 5, write: 3 } },
    cost: 0.02,
  })
  c.recordUsage({
    id: "msg-2",
    role: "assistant",
    finish: "stop",
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
  c.recordUsage({ id: "msg-1", role: "assistant", finish: "stop" })
  c.recordUsage({ id: "msg-2", role: "user" })
  expect(c.getStore()[todayLocal()]).toBeUndefined()
})

test("按本地日期 YYYY-MM-DD 分组", () => {
  const c = makeCollector()
  c.recordUsage({
    id: "msg-1",
    role: "assistant",
    finish: "stop",
    tokens: { input: 1, output: 1, reasoning: 0, cache: { read: 0, write: 0 } },
  })
  const day = todayLocal()
  expect(c.getStore()[day]).toBeDefined()
  expect(day).toMatch(/^\d{4}-\d{2}-\d{2}$/)
})

test("flush 写入 JSON 且可重新加载", () => {
  const c = makeCollector()
  c.recordUsage({
    id: "msg-1",
    role: "assistant",
    finish: "stop",
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

test("同一消息流式多次更新后终态提交最后快照", () => {
  const c = makeCollector()
  c.recordUsage({ id: "msg-1", tokens: { input: 100, output: 20, reasoning: 0, cache: { read: 0, write: 0 } } })
  c.recordUsage({ id: "msg-1", tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } })
  const committed = c.recordUsage({
    id: "msg-1",
    finish: "stop",
    tokens: { input: 100, output: 500, reasoning: 0, cache: { read: 0, write: 0 } },
  })
  const s = c.getStore()[todayLocal()]
  expect(committed).toBe(true)
  expect(s.req).toBe(1)
  expect(s.in).toBe(100)
  expect(s.out).toBe(500)
})

test("无 finish 不计入 store", () => {
  const c = makeCollector()
  const r1 = c.recordUsage({ id: "msg-1", tokens: { input: 100, output: 20, reasoning: 0, cache: { read: 0, write: 0 } } })
  const r2 = c.recordUsage({ id: "msg-1", tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } })
  expect(r1).toBe(false)
  expect(r2).toBe(false)
  expect(c.getStore()[todayLocal()]).toBeUndefined()
})

test("finish 后迟到 chunk 不重复累计", () => {
  const c = makeCollector()
  c.recordUsage({ id: "msg-1", finish: "stop", tokens: { input: 100, output: 500, reasoning: 0, cache: { read: 0, write: 0 } } })
  c.recordUsage({ id: "msg-1", tokens: { input: 100, output: 999, reasoning: 0, cache: { read: 0, write: 0 } } })
  const s = c.getStore()[todayLocal()]
  expect(s.req).toBe(1)
  expect(s.out).toBe(500)
})

test("重复的终态事件不重复累计", () => {
  const c = makeCollector()
  c.recordUsage({ id: "msg-1", finish: "stop", tokens: { input: 100, output: 100, reasoning: 0, cache: { read: 0, write: 0 } } })
  const ret = c.recordUsage({ id: "msg-1", finish: "stop", tokens: { input: 100, output: 300, reasoning: 0, cache: { read: 0, write: 0 } } })
  expect(ret).toBe(false)
  const s = c.getStore()[todayLocal()]
  expect(s.req).toBe(1)
  expect(s.out).toBe(100)
})

test("不同 id 各计一次", () => {
  const c = makeCollector()
  c.recordUsage({ id: "msg-1", finish: "stop", tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } } })
  c.recordUsage({ id: "msg-2", finish: "stop", tokens: { input: 200, output: 80, reasoning: 0, cache: { read: 0, write: 0 } } })
  const s = c.getStore()[todayLocal()]
  expect(s.req).toBe(2)
  expect(s.in).toBe(300)
  expect(s.out).toBe(130)
})

test("stop 兜底提交 buffer 残留", () => {
  const c = makeCollector()
  c.recordUsage({ id: "msg-1", tokens: { input: 100, output: 500, reasoning: 0, cache: { read: 0, write: 0 } } })
  c.stop()
  const s = c.getStore()[todayLocal()]
  expect(s.req).toBe(1)
  expect(s.in).toBe(100)
  expect(s.out).toBe(500)
})

test("缺 id 忽略", () => {
  const c = makeCollector()
  const ret = c.recordUsage({
    role: "assistant",
    finish: "stop",
    tokens: { input: 100, output: 50, reasoning: 0, cache: { read: 0, write: 0 } },
  } as unknown as UsageInput)
  expect(ret).toBe(false)
  expect(c.getStore()[todayLocal()]).toBeUndefined()
})
