## Context

`improve-logging-and-bundling` change 实现了结构化日志和按日轮转,但轮转需要用户配置 `logDir` 才启用。用户期望默认轮转("开箱即用")。同时 README 仍描述旧格式、旧安装方式、旧开发流程,需要全面重写以反映当前代码状态。

当前 Logger 构造逻辑(`src/index.ts:35-40`):
```
if (opts.logDir) -> rotation(logDir)
else -> simple(logPath ?? defaultPath("round-robin.log"))
```

当前 `Logger.write()` 方法中 `this.currentDate` 变量被更新但未用于文件路径选择(文件路径用的是 fresh `day`),是死代码。

## Goals / Non-Goals

**Goals:**

- 默认轮转:不配任何日志选项时,自动按日轮转到 `~/.local/share/opencode/round-robin-YYYY-MM-DD.log`
- `logPath` 降级为覆盖项:仅当用户想禁用轮转时才配
- README 反映当前代码状态
- 仓库清理:删除垃圾文件和个人内容

**Non-Goals:**

- 不实现日志自动清理/压缩
- 不修改 `logger.ts` 的日志格式或级别逻辑(已在 `improve-logging-and-bundling` 完成)
- 不修改测试框架或测试策略

## Decisions

### 决策 1: logPath 优先级高于 logDir

**选择**: `logPath` 存在时走 simple 模式,忽略 `logDir`。否则走 rotation 模式,目录为 `logDir ?? 默认目录`。

**理由**: `logPath` 是"我要单文件"的显式声明,应优先。`logDir` 只是"换个轮转目录",不影响模式选择。两者同时配时 `logPath` 胜出,行为可预期。

```
logPath 配置? ──是──▶ simple(logPath)
     │
     否 ──▶ rotation(logDir ?? defaultDir)
```

**替代方案**: `logDir` 优先于 `logPath` -- 但这会让"想禁用轮转"的用户困惑(配了 `logPath` 还在轮转)。

### 决策 2: 默认目录用 ~/.local/share/opencode/,不加子目录

**选择**: 默认轮转目录为 `~/.local/share/opencode/`(与当前 stats.json 同目录)。

**理由**: 文件名已含 `round-robin-` 前缀,不会与 opencode 其他文件冲突。加子目录(如 `logs/`)增加路径深度但不增加清晰度。

**替代方案**: `~/.local/share/opencode/logs/` 子目录 -- 更整洁但非必要。

### 决策 3: 删除 currentDate 死代码

**选择**: 删除 `Logger` 类的 `currentDate` 实例变量和 `write()` 中的日期比较逻辑。

**理由**: `write()` 中文件路径用的是 `const day = todayLocal()`(每次 fresh 计算),不是 `this.currentDate`。`this.currentDate` 被赋值但从未被读取用于文件路径。删除减少认知负担。

### 决策 4: README 结构保持不变,逐段更新

**选择**: 保持现有 README 章节结构(功能/安装/配置/示例/工具/日志/对比/开发),逐段更新内容。

**理由**: 现有结构合理,无需重构。只需更新过时内容。

## Risks / Trade-offs

- **[Breaking: 默认日志文件名变化]** 现有用户的 `round-robin.log` 不再被写入,新日志写入 `round-robin-YYYY-MM-DD.log`。-> 插件早期阶段,用户仅开发者本人,breaking 可接受。README 会说明。

- **[agents submodule 移除]** 移除后 `agents/` 目录消失。-> 这是个人内容,不该在公开仓库。如有需要可单独 clone。
