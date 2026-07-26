## Context

插件 `opencode-round-robin` 在 opencode desktop 中经历了四层问题,每一层都阻塞插件加载或正确运行。前三层已修复并验证,第四层已诊断待实施。

### 根因链(源码确认)

```
层1: OPENCODE_VERSION 未注入 (esbuild define 缺失)
  └─ InstallationVersion = "local" (node-C6YP7moS.js:71670)
  └─ 对每个目录调 npmSvc.install(dir, { add: [{ name: "@opencode-ai/plugin", version: "local" }] })
  └─ Arborist.reify({ add: ["@opencode-ai/plugin@local"] }) -> "local" 非合法版本 -> 失败
  └─ checkDirty: declared ⊄ locked2 (opencode-round-robin 不在 package-lock.json root deps)
  └─ 触发 reify -> 必然失败 -> install 失败 -> 插件不进 node_modules

层2: resolvePluginTarget 对包名走 npm.add() (cache 目录)
  └─ npm.add("opencode-round-robin@latest") 查 ~/.cache/opencode/packages/
  └─ cache 目录为空(reify 失败留下的空壳)
  └─ 尝试从 npm registry 安装 -> 不在 npm 上 -> 失败
  └─ 错误通过 publishPluginError 发为事件(不写 opencode.log) -> 静默失败

层3: main: "./src/index.ts" (TypeScript)
  └─ sidecar 运行在 Electron utilityProcess -> Node.js
  └─ Node.js 不支持 import(".ts") -> "Unknown file extension .ts"
  └─ load62 catch -> report.error -> publishPluginError -> 静默失败
  └─ 对比 superpowers: main = ".js" -> 正常加载

层4: 多实例创建独立对象,写同一文件
  └─ opencode 为每个项目目录创建 Plugin.state (node-C6YP7moS.js:684969-685080)
  └─ 每个实例调 server() -> new StatsCollector() -> new Logger() -> patchFetch()
  └─ 多个 StatsCollector 的 setInterval 每 60s flush 到同一文件
  └─ 无 LLM 请求的项目(空 store)用 {} 覆写有数据的实例
  └─ patchFetch 多层叠加(每次 config hook 都 patch globalThis.fetch)
  └─ KeyPool 独立(429 cooldown 不跨项目共享)
```

### opencode 插件加载架构(两条路径)

```
System 1 (config-plugin, line 196848):
  PluginModule schema (effect/setup) -> npm.add() -> import -> ctx.plugin.add()
  ← 未使用(server API 不匹配 schema)

System 2 (Plugin.state, line 684969):  ← 实际使用
  PluginLoader.loadExternal -> resolvePluginTarget -> createPluginEntry -> load62(import) 
  -> applyPlugin -> readV1Plugin(检测 server) -> plugin.server(input, options) -> hooks
  -> hook.config(cfg) -> 事件监听 -> hook.event({event}) -> hook.tool
```

### 关键源码位置

| 位置 | 行号 | 说明 |
|------|------|------|
| InstallationVersion | 71670 | `typeof OPENCODE_VERSION === "string" ? ... : "local"` |
| npmSvc.install | 184217-184224 | 对每个目录调 install,add @opencode-ai/plugin |
| checkDirty | 183444-183468 | 比较 declared vs locked2,不符则触发 reify |
| resolvePluginTarget | 183705-183711 | 路径走 resolvePathPluginTarget,包名走 npm.add |
| load62 | 465422-465432 | `import(row.entry)` -- Node.js 不支持 .ts |
| readV1Plugin | 183745-183769 | 检测 `server` 属性(支持 server API) |
| Plugin.state | 684969-685080 | 多实例:每项目独立 hooks,事件按目录过滤 |
| event filter | 685066 | `event2.location?.directory !== ctx.directory` |

## Goals / Non-Goals

**Goals:**
- 完整记录四层修复链(层1-3 已完成,层4 待实施)
- 层4:通过模块级单例解决多实例覆写问题
- 确保 `round-robin-stats.json` 持久化全局聚合数据
- 确保 `patchFetch` 只安装一次,`KeyPool` 跨项目共享
- 确保本地开发(`bun test` / `bun x tsc --noEmit`)不受影响

**Non-Goals:**
- 不修复 opencode desktop 的 `OPENCODE_VERSION` 注入缺失(应向上游报告)
- 不改 `src/stats.ts`、`src/logger.ts`、`src/pool.ts`、`src/fetch-patch.ts`(逻辑不变)
- 不改 `~/.config/opencode/opencode.jsonc`(层2 已改)
- 不改 `~/.config/opencode/package.json`(层1 已改)

## Decisions

### 决策 1:层1 -- config 目录声明 @opencode-ai/plugin 为 prod dependency(已完成)

**选择**:在 `~/.config/opencode/package.json` 的 `dependencies` 中声明 `"@opencode-ai/plugin": "1.4.7"`,执行 `npm install` 生成完整 `package-lock.json`。

**理由**:
- checkDirty 的 `declared` 集合始终包含 `@opencode-ai/plugin`(来自 `input.add`),无论 package.json 是否声明
- 只有让 `@opencode-ai/plugin` 出现在 `locked2`(package-lock.json root deps)中,才能使 `declared ⊆ locked2` 成立
- opencode 的 checkDirty 读 `package-lock.json`(npm 的 lockfile),不读 `bun.lock`;必须用 `npm install` 而非 `bun install`

**备选:设置 OPENCODE_VERSION 环境变量**
- `OPENCODE_VERSION` 是 esbuild 构建时 define 的全局变量,非 `process.env`,运行时无法设置
- 放弃

### 决策 2:层2 -- 使用 file:/// 路径声明插件(已完成)

**选择**:在 `opencode.jsonc` 中使用 `"file:///D:/code/projects/opencode-round-robin"` 而非包名 `"opencode-round-robin"`。

**理由**:
- `isPathPluginSpec("file:///...")` 返回 true,走 `resolvePathPluginTarget`(直接读 package.json 找入口)
- 包名走 `npm.add()`(在 cache 目录找包),`opencode-round-robin` 不在 npm 上,必然失败
- 路径方式绕过 cache,直接从源目录加载

### 决策 3:层3 -- 构建为 JavaScript,main 指向 dist/index.js(已完成)

**选择**:添加 `"build": "bun build src/index.ts --outdir dist --target node --external @opencode-ai/plugin"`,将 `main` 改为 `"./dist/index.js"`。

**理由**:
- sidecar 运行在 Node.js(Electron utilityProcess),不支持 `import(".ts")`
- `bun build` 将 7 个 TypeScript 模块打包为单个 11.38 KB JavaScript 文件
- `--external @opencode-ai/plugin` 保留 import(运行时由 opencode 提供)
- `--target node` 确保 Node.js 兼容
- 对比 `superpowers`:`main = ".opencode/plugins/superpowers.js"`(.js 文件,正常加载)

### 决策 4:层4 -- 模块级单例模式(待实施)

**选择**:在 `src/index.ts` 中使用模块级变量(`let globalStats`、`let globalPools`、`let globalLogger`、`let fetchPatched`)实现单例。

**理由**:
- 插件模块通过 `import(entrypoint)` 只加载一次,模块级变量跨 `server()` 调用持久化
- opencode 为每个项目目录调用 `server()`,每次创建新 `StatsCollector`/`Logger`/`KeyPool[]`/`patchFetch`
- 单例确保:单一 timer(不覆写文件)、单一 fetch patch(不叠加)、共享 KeyPool(429 cooldown 跨项目)

**为何 event hook 的目录过滤不影响全局聚合**:
- 每个实例的 event hook 只接收当前项目目录的事件
- 但所有实例的 `recordUsage` 写入同一个 `globalStats.store`
- 项目 A 的事件 + 项目 B 的事件 = 全局聚合数据
- 无事件的项目不调用 `recordUsage`(正确,无请求=无数据)

**备选 A:flush() 时合并文件**
- `flush()` 先读文件再合并,而非覆写
- 问题:load() 已将文件数据读入 store,flush() 合并会导致已 flush 的数据被重复计算
- 需要 delta 追踪,复杂度高
- 放弃

**备选 B:flush() 空 store 时跳过**
- `if (Object.keys(this.store).length === 0) return`
- 问题:只解决覆写,不解决 patchFetch 叠加和 KeyPool 隔离
- 不够彻底
- 放弃

**备选 C:每个项目用不同文件路径**
- `statsPath` 含项目目录名
- 问题:统计变成项目级而非全局,不符合 key 轮询需跨项目聚合的设计意图
- 放弃

## Risks / Trade-offs

- **[单例初始化竞争]** -> 首次 `server()` 调用时初始化单例,后续调用复用。`server()` 是 async 函数,但 JS 事件循环单线程,无真竞争。风险低。

- **[config hook 跳过后续实例]** -> `fetchPatched = true` 后,后续实例的 `config` hook 跳过 pool 构建。若后续实例有不同 provider 配置,会被忽略。用户配置在全局 `opencode.jsonc` 中,所有项目相同。风险低。

- **[options 差异]** -> `server()` 的 `options` 参数来自插件配置。若不同项目有不同的 plugin options,首个实例的 options 会被使用。用户配置在全局,所有项目相同。风险低。

- **[模块重新导入]** -> 若 opencode 热重载插件模块,模块级变量会重置。实际不会发生(sidecar 进程不热重载)。风险极低。

- **[层1-3 为 workaround]** -> 根因是 opencode desktop 缺失 `OPENCODE_VERSION` 注入。若上游修复,层1 的 `@opencode-ai/plugin` 在 config dependencies 仍兼容(declared ⊆ locked2 继续成立)。风险低。

- **[npm 与 bun lockfile 共存]** -> config 目录同时有 `package-lock.json`(npm)和 `bun.lock`(bun)。互不干扰(opencode 读前者,bun 读后者)。可能造成用户困惑,需在 README 说明。

## Migration Plan

### 层1-3(已完成)

1. ✅ 项目 `package.json`:`@opencode-ai/plugin` 移到 `devDependencies`
2. ✅ 项目 `bun install` + `tsc` + `test` 通过
3. ✅ config `package.json`:加 `@opencode-ai/plugin: "1.4.7"`,删 `overrides`
4. ✅ config 目录 `npm install`
5. ✅ `opencode.jsonc`:改用 `file:///D:/code/projects/opencode-round-robin`
6. ✅ 项目 `package.json`:加 `build` 脚本,`main` 改 `./dist/index.js`
7. ✅ `bun run build` 成功
8. ✅ 重启验证:`round-robin.log` 生成,fetch 层日志正常,token 层日志正常

### 层4(待实施)

1. 编辑 `src/index.ts`:引入模块级单例变量
2. `server()` 函数:首次调用初始化单例,后续复用
3. `config` hook:`fetchPatched` 守卫,只首次建 pools + patchFetch
4. `event` hook:使用 `globalStats.recordUsage(info)`
5. `tool`:使用 `globalStats.getStore()`
6. `bun run build` 重新构建
7. `bun x tsc --noEmit` + `bun test` 验证
8. 重启 opencode,验证 stats.json 不再被覆写

**回滚**:还原 `src/index.ts` 为非单例版本,`bun run build`。但回滚后多实例覆写问题恢复。

## Open Questions

无。四层根因均有源码实证,修复方向明确。
