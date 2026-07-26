import { test, expect } from "bun:test"
import { parseOptions, buildPoolsFromProviders } from "../src/config"

const fakeConfig = {
  provider: {
    "volxc9208": { options: { apiKey: "k1", baseURL: "https://x/coding/v3" } },
    "volxc5425": { options: { apiKey: "k3", baseURL: "https://x/coding/v3" } },
    "vollqh5426": { options: { apiKey: "k2", baseURL: "https://x/coding/v3" } },
    "volxc9208-agentplan": { options: { apiKey: "k4", baseURL: "https://x/plan/v3" } },
  },
}

test("parseOptions: 缺 providers 抛错", () => {
  expect(() => parseOptions(undefined)).toThrow(/options/)
  expect(() => parseOptions({})).toThrow(/providers/)
  expect(() => parseOptions({ providers: [] })).toThrow(/providers/)
})

test("parseOptions: providers 元素非字符串抛错", () => {
  expect(() => parseOptions({ providers: ["ok", 123 as unknown] })).toThrow(/字符串/)
  expect(() => parseOptions({ providers: ["ok", ""] })).toThrow(/字符串/)
})

test("parseOptions: cooldownMs 默认 60000,可自定义", () => {
  const r = parseOptions({ providers: ["a"] })
  expect(r.cooldownMs).toBe(60000)
  const r2 = parseOptions({ providers: ["a"], cooldownMs: 30000 })
  expect(r2.cooldownMs).toBe(30000)
})

test("parseOptions: statsPath 与 logPath 可选", () => {
  const r = parseOptions({ providers: ["a"] })
  expect(r.statsPath).toBeUndefined()
  expect(r.logPath).toBeUndefined()
  const r2 = parseOptions({ providers: ["a"], statsPath: "/s.json", logPath: "/l.log" })
  expect(r2.statsPath).toBe("/s.json")
  expect(r2.logPath).toBe("/l.log")
})

test("parseOptions: logDir 可选,与 logPath 独立", () => {
  const r = parseOptions({ providers: ["a"] })
  expect(r.logDir).toBeUndefined()
  const r2 = parseOptions({ providers: ["a"], logDir: "/var/log/rr" })
  expect(r2.logDir).toBe("/var/log/rr")
  const r3 = parseOptions({ providers: ["a"], logDir: "/d", logPath: "/p.log" })
  expect(r3.logDir).toBe("/d")
  expect(r3.logPath).toBe("/p.log")
})

test("buildPoolsFromProviders: 按 baseURL 分组", () => {
  const pools = buildPoolsFromProviders(fakeConfig, ["volxc9208", "volxc5425", "vollqh5426"], 60000)
  expect(pools).toHaveLength(1)
  expect(pools[0].match).toBe("https://x/coding/v3")
  expect(pools[0].keys).toEqual(["k1", "k3", "k2"])
  expect(pools[0].passthrough).toBe(false)
})

test("buildPoolsFromProviders: 不同 baseURL 分到不同 pool", () => {
  const pools = buildPoolsFromProviders(
    fakeConfig,
    ["volxc9208", "volxc5425", "vollqh5426", "volxc9208-agentplan"],
    60000,
  )
  expect(pools).toHaveLength(2)
  const coding = pools.find((p) => p.match.includes("coding"))!
  const plan = pools.find((p) => p.match.includes("plan"))!
  expect(coding.keys).toHaveLength(3)
  expect(plan.keys).toHaveLength(1)
  expect(plan.passthrough).toBe(true)
})

test("buildPoolsFromProviders: 单 key 组透传", () => {
  const pools = buildPoolsFromProviders(fakeConfig, ["volxc9208-agentplan"], 60000)
  expect(pools[0].passthrough).toBe(true)
  expect(pools[0].keys).toEqual(["k4"])
})

test("buildPoolsFromProviders: key 去重", () => {
  const cfg = {
    provider: {
      a: { options: { apiKey: "same", baseURL: "https://x" } },
      b: { options: { apiKey: "same", baseURL: "https://x" } },
    },
  }
  const pools = buildPoolsFromProviders(cfg, ["a", "b"], 60000)
  expect(pools[0].keys).toEqual(["same"])
  expect(pools[0].passthrough).toBe(true)
})

test("buildPoolsFromProviders: key->账号名映射", () => {
  const pools = buildPoolsFromProviders(fakeConfig, ["volxc9208", "volxc5425"], 60000)
  expect(pools[0].keyAccounts.get("k1")).toBe("volxc9208")
  expect(pools[0].keyAccounts.get("k3")).toBe("volxc5425")
})

test("buildPoolsFromProviders: provider 名不存在抛错", () => {
  expect(() => buildPoolsFromProviders(fakeConfig, ["nope"], 60000)).toThrow(/不存在/)
})

test("buildPoolsFromProviders: 缺 baseURL 抛错", () => {
  const cfg = { provider: { a: { options: { apiKey: "k" } } } }
  expect(() => buildPoolsFromProviders(cfg, ["a"], 60000)).toThrow(/baseURL/)
})

test("buildPoolsFromProviders: 缺 apiKey 抛错", () => {
  const cfg = { provider: { a: { options: { baseURL: "https://x" } } } }
  expect(() => buildPoolsFromProviders(cfg, ["a"], 60000)).toThrow(/apiKey/)
})
