## 1. 类型重构

- [ ] 1.1 `src/types.ts`: 删 `ParsedPool`，新增 `ProviderEntry`（key: string, baseURL: string, account: string）
- [ ] 1.2 `src/types.ts`: 删 `LogMode`（已无用，Logger 内部实现细节不需要导出类型）

## 2. Provider 列表重构

- [ ] 2.1 `src/config.ts`: `buildPoolsFromProviders` 改为 `collectProviders`，返回 `ProviderEntry[]`（不分组，扁平列表，key 去重）
- [ ] 2.2 `src/pool.ts`: `KeyPool` 重构为持有 `ProviderEntry[]`；`next()` 返回 `ProviderEntry | null`（全熔断返回 null）；`markCooldown(provider)` 以 key 为标识；删 `match`/`name`/`passthrough` 相关代码
- [ ] 2.3 `src/pool.ts`: 保留 `keyIndex(key)` 和 `accountName(key)` 方法（日志用），改为从 `ProviderEntry[]` 查找

## 3. fetch-patch 重构

- [ ] 3.1 `src/fetch-patch.ts`: `patchFetch` 接收单个 `ProviderPool`（非数组），回调增加 `baseURL` 参数
- [ ] 3.2 `src/fetch-patch.ts`: 请求进来时，找到 URL 匹配的原始 baseURL（从 pool 的 entries 中查找），提取路径
- [ ] 3.3 `src/fetch-patch.ts`: `pool.next()` 返回 null 时 passthrough；返回 entry 时替换 URL + Authorization
- [ ] 3.4 `src/fetch-patch.ts`: 删 `matchPool` 函数（不再需要，URL 匹配逻辑内联到 patchedFetch）
- [ ] 3.5 `src/fetch-patch.ts`: `FetchPatchCallbacks.onResponse` 回调增加 `baseURL` 和 `account` 参数（日志用）

## 4. index.ts 改造

- [ ] 4.1 删除 `try-catch` + `console.error` 调试代码，恢复直接创建 Logger
- [ ] 4.2 `config` hook: 改用 `collectProviders`，创建单个 `ProviderPool`（非数组）
- [ ] 4.3 `config` hook: `onResponse` 回调适配新签名（含 account/baseURL）
- [ ] 4.4 `event` hook: sessionID 截取从 4 位改为 8 位

## 5. 测试重写

- [ ] 5.1 `tests/pool.test.ts`: 重写 -- ProviderPool 扁平列表，next() 返回 entry 或 null，429 熔断跳过，全熔断返回 null
- [ ] 5.2 `tests/config.test.ts`: `buildPoolsFromProviders` 测试改为 `collectProviders`，不分组
- [ ] 5.3 `tests/fetch-patch.test.ts`: 重写 -- 验证 URL + Authorization 同时替换，全熔断 passthrough，URL 不匹配 passthrough
- [ ] 5.4 执行 `bun x tsc --noEmit` + `bun test` 确认通过

## 6. README 更新

- [ ] 6.1 功能描述: 改为"随机选 provider，key 和端点一起换"
- [ ] 6.2 配置说明: 去掉分组相关描述
- [ ] 6.3 日志示例: 更新为新格式（含不同 baseURL 的 provider）

## 7. 构建与提交

- [ ] 7.1 `bun run build` 重新构建
- [ ] 7.2 重启 opencode 验证：4 个 provider 均出现在日志（含跨端点）
- [ ] 7.3 git commit + push
