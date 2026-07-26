## Context

`init-plugin` change 已完成 28/31 任务,但实际部署后插件从未运行。经 opencode 源码调查(`node-C6YP7moS.js`),定位到根因在 opencode desktop 的 install 机制:

### 根因链(源码确认)

```
OPENCODE_VERSION 未注入 (esbuild define 缺失)
  └─ InstallationVersion = "local"  (line 71670)
  └─ InstallationLocal = false       (line 71671, InstallationChannel="prod")
      └─ npmSvc.install(dir, { add: [{ name: "@opencode-ai/plugin", version: "local" }] })  (line 184217-184224)
          └─ add82 = ["@opencode-ai/plugin@local"]  (line 183434)
          └─ Arborist.reify({ add: ["@opencode-ai/plugin@local"] })  (line 183393)
              └─ "local" 不是合法 npm 版本 -> NpmInstallFailedError
```

### checkDirty 机制(line 183444-183468)

当 `node_modules` 已存在时,opencode 比较:
- `declared` = package.json deps ∪ input.add names = { "opencode-round-robin", "@opencode-ai/plugin" }
- `locked2` = package-lock.json root deps
- 只要 declared 中有包不在 locked2 中,就触发 reify(带 `@opencode-ai/plugin@local`,必然失败)

### 三次失败 spike

| Spike | 做法 | 结果 | 原因 |
|-------|------|------|------|
| 1. 移到 devDependencies | 项目 package.json 移 @opencode-ai/plugin | 无效 | @local 来自 input.add,与插件 package.json 无关 |
| 2. Junction | node_modules 建 junction | 无效 | install 仍失败,opencode 跳过加载 |
| 3. 删除 config package.json 里的 @opencode-ai/plugin | 去掉依赖声明 | 无效 | @local 通过 add 参数注入,不依赖声明 |
| 4. bun overrides | 加 overrides 字段 | 无效 | overrides 对 Arborist add 参数无效 |

### 实证对照

cache 中两个能正常加载的同类插件 `opencode-anthropic-auth`、`opencode-autognosis` 都是 string-form 插件,走 cache 目录的 `add72` 路径(line 183408),不经过 `install2` 的 checkDirty 逻辑,因此不受 @local 问题影响。

## Goals / Non-Goals

**Goals:**
- 让 opencode 在 `~/.config/opencode/` 的 checkDirty 通过,不触发 reify
- 让 `opencode-round-robin` 进入 `node_modules` 并被 opencode 成功加载
- 运行时 `import "@opencode-ai/plugin"` 正确解析到 opencode 提供的副本
- 本地开发的类型检查与测试不受影响

**Non-Goals:**
- 不改 `src/` 任何代码
- 不改 `~/.config/opencode/opencode.jsonc`
- 不修复 opencode desktop 的 `OPENCODE_VERSION` 注入缺失(应向上游报告)
- 不为 `init-plugin` 已完成的验证任务补打勾(在 `init-plugin` change 中处理)

## Decisions

### 决策 1:config 目录 package.json 声明 @opencode-ai/plugin 为 prod dependency

**选择**:在 `~/.config/opencode/package.json` 的 `dependencies` 中声明 `"@opencode-ai/plugin": "1.4.7"`,与 `opencode-round-robin: "file:..."` 并列。

**理由**:
- checkDirty 的 `declared` 集合始终包含 `@opencode-ai/plugin`(来自 `input.add`),无论 package.json 是否声明
- 只有让 `@opencode-ai/plugin` 也出现在 `locked2`(package-lock.json root deps)中,才能使 declared ⊆ locked2 成立
- 声明为 prod dependency 后,`npm install` 会将其写入 package-lock.json root deps
- `@opencode-ai/plugin@1.4.7` 已在 node_modules 中存在,不会引入新文件

**备选 A:设置 OPENCODE_VERSION 环境变量**
- 可使 InstallationVersion 变为合法版本,从根源修复
- 但 `OPENCODE_VERSION` 是 esbuild 构建时 define 的全局变量,非 `process.env`,运行时无法通过环境变量设置
- `sidecar.js` 的 `prepareSidecarEnv()` 不设此变量,`createSidecarEnv()` 仅复制 `process.env`
- 放弃(无法在不修改 opencode 二进制的情况下实现)

**备选 B:转为 string-form 插件**
- `"opencode-round-robin@file:D:/code/projects/opencode-round-robin"` 走 cache 路径,绕过 checkDirty
- 但丢失 tuple-form 的 `options` 参数(providers 列表),需改插件代码从 `client.config.get()` 读取
- 改动范围大,放弃(保留为备选方案)

### 决策 2:使用 npm install 而非 bun install 生成 package-lock.json

**选择**:在 `~/.config/opencode/` 执行 `npm install`(不是 `bun install`)。

**理由**:
- opencode 的 checkDirty 读取 `package-lock.json`(npm 的 lockfile),不读 `bun.lock`
- `bun install` 只更新 `bun.lock`,不影响 `package-lock.json`,对 checkDirty 无效
- `npm install` 会读取 `package.json` 中的两个依赖,安装 `opencode-round-robin`(file: 依赖)并更新 `package-lock.json` root deps

### 决策 3:项目 package.json 将 @opencode-ai/plugin 移到 devDependencies(保留)

**选择**:项目 `package.json` 的 `@opencode-ai/plugin` 保留在 `devDependencies`(`^1.3.9`)。

**理由**:
- 虽非根因修复,但与两个同类插件(`opencode-anthropic-auth`、`opencode-autognosis`)一致
- 本地开发(`bun test` / `bun x tsc --noEmit`)类型解析正常
- `file:` 依赖安装时不处理 devDependencies,不会引入额外解析

### 决策 4:删除 overrides 字段

**选择**:删除 `~/.config/opencode/package.json` 中的 `overrides` 字段。

**理由**:
- Arborist.reify() 的 `add` 参数是直接指定包,不走 package.json 的 overrides/resolutions 解析
- overrides 对此问题无效,删除以避免误导

## Risks / Trade-offs

- **[opencode 覆盖 package.json]** -> opencode 在 reify 成功时会用 `save: true` 写 package.json。但本修复使 checkDirty 通过,不触发 reify,因此 package.json 不会被覆盖。风险低。
- **[package-lock.json 过时]** -> 如果用户手动修改 config package.json 后忘记跑 `npm install`,checkDirty 可能再次触发 reify。需在 README 中注明。
- **[opencode 未来修复 OPENCODE_VERSION]** -> 若上游修复了 `OPENCODE_VERSION` 注入,`InstallationVersion` 将变为合法版本,reify 不再失败。本修复仍然兼容(declared ⊆ locked2 继续成立)。
- **[npm 与 bun lockfile 共存]** -> config 目录将同时有 `package-lock.json`(npm)和 `bun.lock`(bun)。opencode 只读 `package-lock.json`,bun 只读 `bun.lock`,互不干扰。但可能造成用户困惑,需在 README 中说明。
- **[`init-plugin` 的验证任务假性通过]** -> 本修复使插件首次真正运行,`init-plugin` 中验证类任务需重新执行。

## Migration Plan

1. 项目 `package.json`:`@opencode-ai/plugin` 从 `dependencies` 移到 `devDependencies`(**已完成**)
2. 项目根目录跑 `bun install` 更新 `bun.lock`(**已完成**)
3. 跑 `bun x tsc --noEmit` 确认类型解析正常(**已完成,通过**)
4. 跑 `bun test` 确认测试通过(**已完成,41 pass**)
5. 编辑 `~/.config/opencode/package.json`:加入 `@opencode-ai/plugin: "1.4.7"`,删除 `overrides`(**已完成**)
6. 在 `~/.config/opencode/` 跑 `npm install`(**已完成**)
7. 确认 `package-lock.json` root deps 含 `@opencode-ai/plugin` 和 `opencode-round-robin`(**已验证**)
8. 确认 `node_modules/opencode-round-robin` 出现(**已验证**)
9. 重启 opencode,确认日志中无 `background dependency install failed` WARN(**待验证**)
10. 发一条消息,确认 `round-robin.log` 生成且含 fetch 层日志行(**待验证**)
11. 等 60s,确认 `round-robin-stats.json` 生成(**待验证**)
12. 对 LLM 说"看轮询统计",确认 `roundrobin_stats` 工具可调用(**待验证**)

**回滚**:从 config package.json 删除 `@opencode-ai/plugin` 依赖,跑 `npm install`。但回滚后插件再次无法加载,无实际意义。

## Open Questions

无。根因与修复方向均有源码实证支撑。向上游报告 `OPENCODE_VERSION` 缺失为可选的长期行动。
