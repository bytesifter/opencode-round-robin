## 1. 层1:config 目录 checkDirty 修复(已完成)

- [x] 1.1 编辑 `~/.config/opencode/package.json`,在 `dependencies` 中加入 `"@opencode-ai/plugin": "1.4.7"`,删除 `overrides` 字段
- [x] 1.2 在 `~/.config/opencode/` 执行 `npm install`,生成完整的 `package-lock.json`
- [x] 1.3 确认 `package-lock.json` 的 `packages[""].dependencies` 同时含 `@opencode-ai/plugin` 和 `opencode-round-robin`
- [x] 1.4 确认 `node_modules/opencode-round-robin` 目录已出现
- [x] 1.5 确认 `node_modules/.package-lock.json` 中出现 `opencode-round-robin` 条目

## 2. 层2:插件加载路径修复(已完成)

- [x] 2.1 编辑 `~/.config/opencode/opencode.jsonc`,将插件声明从包名 `"opencode-round-robin"` 改为路径 `"file:///D:/code/projects/opencode-round-robin"`
- [x] 2.2 确认 `isPathPluginSpec` 识别为路径插件,走 `resolvePathPluginTarget` 而非 `npm.add()`

## 3. 层3:TypeScript 构建修复(已完成)

- [x] 3.1 在项目 `package.json` 中添加 `"build"` 脚本(`bun build src/index.ts --outdir dist --target node --external @opencode-ai/plugin`)
- [x] 3.2 将 `main` 从 `"./src/index.ts"` 改为 `"./dist/index.js"`
- [x] 3.3 执行 `bun run build`,确认 `dist/index.js` 生成(7 模块打包)
- [x] 3.4 确认构建产物中 `@opencode-ai/plugin` 为 external(import 保留),无 `.ts` 导入残留
- [x] 3.5 执行 `bun x tsc --noEmit` 确认类型检查通过
- [x] 3.6 执行 `bun test` 确认 41 个测试全部通过

## 4. 层1-3 部署验证(已完成)

- [x] 4.1 重启 opencode,确认 `opencode.log` 中 `~/.config/opencode` 目录不再出现 `background dependency install failed` WARN
- [x] 4.2 确认 `round-robin.log` 生成,含 fetch 层日志行(格式 `YYYY-MM-DD HH:MM:SS [rr] <账号名> key#<序号> <末4位> <状态码>`)
- [x] 4.3 确认日志中多个 provider 出现(验证轮询生效)
- [x] 4.4 确认 `round-robin.log` 中出现 event 层 token 日志行(格式 `... [rr] token in=.. out=.. reasoning=.. cacheR=.. cacheW=.. cost=..`)
- [x] 4.5 调用 `roundrobin_stats` 工具,确认返回 ASCII 柱状图(含请求数与 token 统计)

## 5. 层4:多实例单例修复(已完成)

- [x] 5.1 在 `src/index.ts` 顶部添加模块级变量:`let globalStats`、`let globalPools`、`let globalLogger`、`let fetchPatched`
- [x] 5.2 修改 `server()` 函数:首次调用时初始化 `globalStats` 和 `globalLogger`(含 `setInterval` timer),后续调用复用
- [x] 5.3 修改 `config` hook:用 `fetchPatched` 守卫,首次调用时构建 `globalPools` 并安装 `patchFetch`,后续调用跳过
- [x] 5.4 修改 `event` hook:使用 `globalStats.recordUsage(info)` 和 `globalLogger.logUsage(...)` 而非局部变量
- [x] 5.5 修改 `tool` hook:使用 `globalStats.getStore()` 而非局部变量
- [x] 5.6 执行 `bun run build` 重新构建 `dist/index.js`(7 模块,11.61 KB)
- [x] 5.7 执行 `bun x tsc --noEmit` 确认类型检查通过
- [x] 5.8 执行 `bun test` 确认所有测试通过(41 pass / 0 fail)

## 6. 层4 部署验证(待实施,需重启)

- [ ] 6.1 重启 opencode,确认插件正常加载(`round-robin.log` 有新日志行)
- [ ] 6.2 切换到另一个项目(无 LLM 请求),等待 60s 以上,确认 `round-robin-stats.json` 不被覆写为 `{}`
- [ ] 6.3 切回原项目,调用 `roundrobin_stats` 工具,确认统计数据仍在(全局聚合)
- [ ] 6.4 确认 `patchFetch` 只安装一次(检查 `round-robin.log` 中同一请求不出现重复 fetch 层日志行)

## 7. 收尾

- [ ] 7.1 将旧的 `fix-plugin-install` change 归档(其修复内容已被本 change 完整覆盖)
- [ ] 7.2 复验 `init-plugin` change 中依赖"插件已加载"的验证类任务,在 `init-plugin` 的 tasks.md 中勾选真实通过项
- [ ] 7.3 若全部验证通过,将本 change 与 `init-plugin` 一起归档(`openspec archive`)
