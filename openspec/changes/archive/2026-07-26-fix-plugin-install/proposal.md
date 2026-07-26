## Why

插件 `opencode-round-robin` 已在 `~/.config/opencode/opencode.jsonc` 的 `plugin` 数组中配置(tuple 形式),但**从未被 opencode 实际加载**。启动时 opencode 在 `~/.config/opencode/` 执行 install,日志连续出现 20+ 条 WARN:

```
background dependency install failed
error="NpmInstallFailedError (cause: @opencode-ai/plugin: No matching version found for @opencode-ai/plugin@local.)"
```

**根因**(经 opencode 源码调查确认):

1. opencode desktop 构建时未注入 `OPENCODE_VERSION` 全局变量(esbuild `define` 缺失)
2. `node-C6YP7moS.js:71670` 中 `InstallationVersion = typeof OPENCODE_VERSION === "string" ? OPENCODE_VERSION : "local"`,结果为 `"local"`
3. `InstallationChannel = "prod"`(默认),`InstallationLocal = false`
4. opencode 对每个目录(config 目录 + 每个项目的 `.opencode` 目录)调用 `npmSvc.install(dir, { add: [{ name: "@opencode-ai/plugin", version: "local" }] })`(`node-C6YP7moS.js:184217-184224`)
5. `install2()` 将 `{ name, version }` 转为字符串 `"@opencode-ai/plugin@local"`(`node-C6YP7moS.js:183434`),传给 npm `Arborist.reify({ add: ["@opencode-ai/plugin@local"] })`
6. `"local"` 不是合法 npm 版本,Arborist 解析失败,`NpmInstallFailedError`
7. install 失败后,`opencode-round-robin`(`file:` 依赖)不进入 `node_modules`,插件代码从未执行

**checkDirty 机制**(`node-C6YP7moS.js:183444-183468`):当 `node_modules` 已存在时,opencode 比较 `declared`(package.json deps + input.add names)与 `locked2`(package-lock.json root deps)。只要有一个 declared 包不在 locked2 中,就触发 reify。reify 总是带 `@opencode-ai/plugin@local`,必然失败。

原始诊断(将 `@opencode-ai/plugin` 放在 dependencies 导致 @local 改写)已被三次 spike 推翻:@local 来自 opencode 代码的 `input.add` 参数,与插件自身 package.json 的声明位置无关。

后果:`fetch-patch` 未安装(无 key 轮询、无 429 cooldown)、`StatsCollector` 未启动(无统计、`roundrobin_stats` 工具未注册)、`Logger` 未实例化(无日志)。`init-plugin` change 中标记完成的"验证"类任务均为假性通过。

## What Changes

**两部分修复:**

### 部分 A:项目 package.json 规范化(已完成)

- 将 `@opencode-ai/plugin` 从项目 `package.json` 的 `dependencies` 移到 `devDependencies`(版本范围 `^1.3.9` 保留)
- 与两个已验证可加载的同类插件(`opencode-anthropic-auth`、`opencode-autognosis`)声明方式一致
- 此部分虽非根因修复,但符合最佳实践,且本地开发的类型检查与测试不受影响

### 部分 B:config 目录 package-lock.json 修复(根因修复)

- 在 `~/.config/opencode/package.json` 的 `dependencies` 中声明 `@opencode-ai/plugin: "1.4.7"`(与 `opencode-round-robin: "file:..."` 并列)
- 在 `~/.config/opencode/` 执行 `npm install`,生成完整的 `package-lock.json`,使 root package 的 `dependencies` 同时包含 `@opencode-ai/plugin` 和 `opencode-round-robin`
- 重启 opencode 后,checkDirty 判定 `declared ⊆ locked2`,跳过 reify,插件正常加载
- 删除无效的 `overrides` 字段(Arborist 的 `add` 参数不走 overrides 解析)

## Capabilities

### New Capabilities

- `plugin-packaging`: 插件作为 `file:` 依赖被 opencode 安装时的可安装性与可加载性契约(config 目录 package-lock.json 完整性、checkDirty 通过、插件进程成功启动并注册 hooks/tools)

### Modified Capabilities

无。`key-rotation`、`request-logging`、`usage-tracking` 三个能力的 spec 级行为(随机轮询、429 cooldown、日志格式、统计聚合)均不变,本变更仅修复"使这些能力得以运行的前提"。

## Impact

- **代码**:项目 `package.json` 单文件改动(@opencode-ai/plugin 移到 devDependencies);config 目录 `package.json` + `package-lock.json` 更新
- **依赖关系**:项目 `@opencode-ai/plugin` 由运行时 `dependency` 降级为 `devDependency`;config 目录显式声明 `@opencode-ai/plugin: "1.4.7"` 作为 prod dependency
- **init-plugin 验收**:`init-plugin` change 中依赖"插件已加载"的验证任务需在本修复后重新验证(日志生成、统计文件生成、工具可调用)
- **用户配置**:`~/.config/opencode/opencode.jsonc` 无需改动;`~/.config/opencode/package.json` 需加入 `@opencode-ai/plugin` 依赖
- **运行时产物**:修复后首次发消息将生成 `~/.local/share/opencode/round-robin.log` 与 `round-robin-stats.json`
- **已知限制**:此为 workaround,非根治。根因是 opencode desktop 构建缺失 `OPENCODE_VERSION` 注入,应向上游报告 bug
