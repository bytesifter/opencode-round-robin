## Why

两个阻碍 GitHub 发布的问题:

1. **轮转非默认**: `improve-logging-and-bundling` change 实现了按日轮转,但需要用户手动配置 `logDir` 才启用。用户期望"开箱即用"的轮转,当前默认仍是单文件追加模式。

2. **README 全面过时**: README 仍描述旧日志格式(`[rr] volxc9208 key#0 ..2898 200`)、旧安装方式(`file:` 依赖)、旧开发流程("无构建,main 指向 src/index.ts"),与当前代码(结构化日志、打包内联、`dist/index.js`、`bun run build`)严重脱节。

## What Changes

### 默认轮转

- **BREAKING**: 默认日志模式从 `simple`(单文件)改为 `rotation`(按日轮转)
- `logPath` 语义变更:从"默认选项"降级为"覆盖选项"--仅当用户想禁用轮转时才配 `logPath`
- `logDir` 保持可选:不配时使用默认目录 `~/.local/share/opencode/`,配了则用自定义目录
- 优先级: `logPath > logDir > 默认(轮转)`
- 删除 `Logger` 中的死代码 `currentDate` 变量(被更新但从未用于文件路径选择)

### README 重写

- **功能**: 加结构化日志(级别/业务上下文/按日轮转)、自包含构建(无运行时依赖 `@opencode-ai/plugin`)
- **安装**: npm 包名方式(打包内联后可行) + `file:///` 路径方式;删除旧的 `file:` 依赖方式
- **配置表**: 加 `logDir` 选项;`logPath` 描述改为"强制单文件模式";默认日志路径改为轮转格式
- **日志示例**: 新格式(`INFO  fetch provider=... duration=342ms` / `INFO  usage session=... model=... mode=... agent=...`)
- **开发**: 加 `bun run build` 步骤;`main` 指向 `./dist/index.js`;去掉"无构建"描述
- **体量**: 更新为实际行数(~740 行)

### 仓库清理

- 删除 `console.error('FAILED`(0 字节垃圾文件)
- 移除 `agents` submodule + `.gitmodules`(个人内容,不该进公开仓库)
- 删除 `DESIGN.md`(旧设计文档,已被 openspec/ 取代)
- `package.json` 加 `"files": ["dist"]`(npm 发布内容)

## Capabilities

### New Capabilities

无。本变更仅修改 `structured-logging` 能力的默认行为和文档,不引入新能力。

### Modified Capabilities

- `structured-logging`: 默认日志模式从 simple 改为 rotation;`logPath` 语义从"默认选项"改为"覆盖选项"

## Impact

- **src/index.ts**: Logger 构造逻辑改为 `logPath` -> simple, 否则 -> rotation(logDir ?? 默认目录)
- **src/logger.ts**: 删除 `currentDate` 变量和相关赋值
- **package.json**: 加 `"files": ["dist"]`
- **README.md**: 全面重写(6 处过时内容)
- **删除文件**: `console.error('FAILED`、`.gitmodules`、`DESIGN.md`;移除 `agents` submodule
- **用户配置**: 现有用户如未配 `logDir` 或 `logPath`,日志文件从 `round-robin.log` 变为 `round-robin-YYYY-MM-DD.log`(breaking)
