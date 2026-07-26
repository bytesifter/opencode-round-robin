## Context

`passthrough` 是 `init-plugin` change 中引入的概念：单 key 组（去重后仅 1 个 key）标记 `passthrough=true`，`patchFetch` 跳过拦截，直接透传原始 fetch。设计意图是"单 key 无需轮询，不值得拦截"。但实际导致用户配置的 provider 在日志中不可见，且单 key 拦截的运行时代价为零（`next()` 对 1 元素数组的随机选择 = 直接返回），passthrough 纯属多余复杂度。

## Goals / Non-Goals

**Goals:**

- 删除 `passthrough` 概念，所有匹配 pool 的请求均拦截并记日志
- 保持 baseURL 分组逻辑不变（正确性要求，非用户可见概念）

**Non-Goals:**

- 不修改 baseURL 分组逻辑
- 不修改 cooldown 机制
- 不修改日志格式

## Decisions

### 决策 1: 仅删 passthrough，保留分组

**选择**: 保留 `buildPoolsFromProviders` 按 baseURL 分组的逻辑，仅删除 `passthrough` 字段和检查。

**理由**: 分组是正确性要求（coding 端点的 key 不能用于 plan 端点）。但分组是内部实现，用户不需要感知。删除 passthrough 后，用户视角简化为"配 N 个 provider -> 全部参与轮询 -> 全部有日志"。

### 决策 2: 单 key next() 走通用随机路径

**选择**: 删除 `next()` 中 `if (this.passthrough) return this.keys[0]`，单 key 走通用 `filter + random` 路径。

**理由**: 对 1 元素数组，`Math.floor(Math.random() * 1) = 0`，必然返回 `candidates[0]`，即唯一 key。数学等价，无需特判。

## Risks / Trade-offs

- 无已知风险。单 key 拦截会额外设置一次 `Authorization` 头（值与 opencode 原始配置相同），无功能影响。
