## Why

插件 `opencode-round-robin` 已在 `~/.config/opencode/opencode.jsonc` 中配置,但经历了四层问题导致从未真正运行。前三层已修复(安装、路径、构建),第四层(多实例覆写)尚未修复。本 change 完整记录全部修复链,前三层标记为已完成,第四层待实施。

## What Changes

### 层1:config 目录 checkDirty 修复(已完成)

- 在 `~/.config/opencode/package.json` 的 `dependencies` 中声明 `@opencode-ai/plugin: "1.4.7"`
- 在 `~/.config/opencode/` 执行 `npm install`,生成完整的 `package-lock.json`
- 使 opencode 的 checkDirty 逻辑判定 `declared ⊆ locked2`,跳过 reify,避免 `@opencode-ai/plugin@local` 解析失败

### 层2:插件加载路径修复(已完成)

- 将 `opencode.jsonc` 中的插件声明从包名 `"opencode-round-robin"` 改为路径 `"file:///D:/code/projects/opencode-round-robin"`
- 使 `resolvePluginTarget` 走 `resolvePathPluginTarget`(直接解析路径)而非 `npm.add()`(在 cache 中找包),绕过 npm registry 解析失败

### 层3:TypeScript 构建修复(已完成)

- 在项目 `package.json` 中添加 `"build"` 脚本(`bun build src/index.ts --outdir dist --target node --external @opencode-ai/plugin`)
- 将 `main` 从 `"./src/index.ts"` 改为 `"./dist/index.js"`
- opencode desktop 的 sidecar 运行在 Node.js(非 Bun),无法原生 import `.ts` 文件;构建为 `.js` 后可正常加载

### 层4:多实例单例修复(待实施)

- 将 `StatsCollector`、`KeyPool[]`、`Logger`、`patchFetch` 改为模块级单例
- opencode 为每个项目目录创建独立 `Plugin.state` 实例,每次调用 `server()` 创建新对象;当前实现中多个 `StatsCollector` 实例的 `flush()` 互相覆写同一文件(空实例用 `{}` 覆写有数据的实例),`patchFetch` 多层叠加
- 单例模式确保:单一 timer(不覆写)、单一 fetch patch(不叠加)、共享 KeyPool(429 cooldown 跨项目生效)、全局聚合统计

## Capabilities

### New Capabilities

- `plugin-loading`: 插件在 opencode desktop 中的完整加载链(config 目录 lockfile 完整性、路径声明方式、TypeScript 构建、多实例单例),确保插件被正确安装、发现、导入、初始化并持续运行

### Modified Capabilities

无。`key-rotation`、`request-logging`、`usage-tracking` 三个能力的 spec 级行为不变,本变更仅修复"使这些能力得以正确运行的前提"。

## Impact

- **代码**:层1-3 仅改动配置文件和 `package.json`;层4 改动 `src/index.ts`(引入模块级单例),`dist/index.js` 需重新构建
- **依赖关系**:项目 `@opencode-ai/plugin` 在 `devDependencies`;config 目录 `@opencode-ai/plugin` 在 `dependencies`
- **用户配置**:`~/.config/opencode/opencode.jsonc` 使用 `file:///` 路径声明插件;`~/.config/opencode/package.json` 含 `@opencode-ai/plugin` 依赖
- **运行时产物**:`round-robin.log`(append,正常)、`round-robin-stats.json`(层4 修复后不再被空实例覆写)
- **已知限制**:层1-3 为 workaround,根因是 opencode desktop 构建缺失 `OPENCODE_VERSION` 注入;层4 为架构改进,解决多实例并发问题
