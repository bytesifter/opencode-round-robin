## 1. 删除 passthrough

- [x] 1.1 `src/types.ts`: 删 `ParsedPool.passthrough` 字段
- [x] 1.2 `src/pool.ts`: 删 `readonly passthrough` 属性、构造函数赋值、`next()` 中 `if (this.passthrough) return this.keys[0]`
- [x] 1.3 `src/config.ts`: 删 `passthrough: g.keys.length === 1`
- [x] 1.4 `src/fetch-patch.ts`: `if (!pool || pool.passthrough)` -> `if (!pool)`

## 2. 测试更新

- [x] 2.1 `tests/pool.test.ts`: makePool 删 passthrough 字段；单 key 测试改为验证 next() 返回唯一 key（无 passthrough 属性）
- [x] 2.2 `tests/fetch-patch.test.ts`: makePool 删 passthrough 字段；"单 key pool 透传不拦截"改为"单 key pool 拦截并设置 Authorization"
- [x] 2.3 `tests/config.test.ts`: 删 4 处 passthrough 断言
- [x] 2.4 执行 `bun x tsc --noEmit` + `bun test` 确认通过

## 3. README

- [x] 3.1 删"某组去重后仅 1 个 key -> 该组透传,不拦截"行

## 4. 构建与提交

- [x] 4.1 `bun run build` 重新构建
- [ ] 4.2 重启 opencode 验证 4 个 provider 均出现在日志
- [x] 4.3 git commit + push (commit 完成,push 待网络恢复)
