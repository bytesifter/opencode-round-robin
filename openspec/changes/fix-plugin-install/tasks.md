## 1. 修复项目 package.json 声明(规范化,已完成)

- [x] 1.1 在项目 `package.json` 中将 `@opencode-ai/plugin`(`^1.3.9`)从 `dependencies` 移到 `devDependencies`,确保 `dependencies` 不再含该项
- [x] 1.2 确认 `package.json` 仍为合法 JSON,其余字段(`name`/`version`/`main`/`scripts`/`type`/`devDependencies` 其它项)不变

## 2. 重新生成项目 lockfile(已完成)

- [x] 2.1 在项目根目录执行 `bun install`,更新 `bun.lock`
- [x] 2.2 确认 `bun.lock` 中 `@opencode-ai/plugin` 的归属从 dependencies 区移到 devDependencies 区(或对应 lock 结构反映新声明)

## 3. 本地开发验证(已完成)

- [x] 3.1 在项目根目录执行 `bun x tsc --noEmit`,确认类型检查通过(无 "找不到模块 @opencode-ai/plugin" 错误)
- [x] 3.2 在项目根目录执行 `bun test`,确认现有测试全部通过

## 4. 修复 config 目录 package-lock.json(层1:checkDirty 修复,已完成)

- [x] 4.1 编辑 `~/.config/opencode/package.json`,在 `dependencies` 中加入 `"@opencode-ai/plugin": "1.4.7"`,删除 `overrides` 字段
- [x] 4.2 在 `~/.config/opencode/` 执行 `npm install`(非 `bun install`),生成完整的 `package-lock.json`
- [x] 4.3 确认 `~/.config/opencode/package-lock.json` 的 `packages[""].dependencies` 同时含 `@opencode-ai/plugin` 和 `opencode-round-robin`
- [x] 4.4 确认 `~/.config/opencode/node_modules/opencode-round-robin` 目录已出现(插件被成功安装)
- [x] 4.5 确认 `~/.config/opencode/node_modules/.package-lock.json` 中出现 `opencode-round-robin` 条目

## 5. 修复插件加载路径(层2:路径声明,已完成)

- [x] 5.1 编辑 `~/.config/opencode/opencode.jsonc`,将插件声明从 `"opencode-round-robin"`(包名)改为 `"file:///D:/code/projects/opencode-round-robin"`(路径),使 `resolvePluginTarget` 走 `resolvePathPluginTarget` 而非 `npm.add()`(cache)

## 6. 构建修复(层3:TS -> JS,已完成)

- [x] 6.1 在项目 `package.json` 中添加 `"build"` 脚本(`bun build src/index.ts --outdir dist --target node --external @opencode-ai/plugin`),将 `main` 从 `"./src/index.ts"` 改为 `"./dist/index.js"`
- [x] 6.2 执行 `bun run build`,确认 `dist/index.js` 生成(7 模块打包,11.38 KB)
- [x] 6.3 确认构建产物中 `@opencode-ai/plugin` 为 external(import 保留),无 `.ts` 导入残留(仅注释)
- [x] 6.4 执行 `bun x tsc --noEmit` 确认类型检查通过
- [x] 6.5 执行 `bun test` 确认 41 个测试全部通过

## 7. 部署验证(opencode 实际加载,需重启)

- [x] 7.1 重启 opencode,检查 `~/.local/share/opencode/log/opencode.log`,确认启动时不再出现 `background dependency install failed` 的 WARN(针对 `~/.config/opencode` 目录)

## 8. 运行时行为验证(需重启后交互)

- [ ] 8.1 发送一条 LLM 消息,确认 `~/.local/share/opencode/round-robin.log` 生成,且含 fetch 层日志行(格式 `YYYY-MM-DD HH:MM:SS [rr] <账号名> key#<序号> <末4位> <状态码>`)
- [ ] 8.2 发送多条消息,确认日志中账号名在 `providers` 列表(coding 端点组)中随机出现(验证轮询生效)
- [ ] 8.3 等待 60 秒后,确认 `~/.local/share/opencode/round-robin-stats.json` 生成,且含当日条目(`req`/`in`/`out` 等字段)
- [ ] 8.4 确认 `round-robin.log` 中出现 event 层 token 日志行(格式 `... [rr] token in=.. out=.. reasoning=.. cacheR=.. cacheW=.. cost=..`)
- [ ] 8.5 对 LLM 说"看轮询统计",确认 `roundrobin_stats` 工具被调用并返回 ASCII 柱状图(或"暂无统计数据")

## 9. 收尾

- [ ] 9.1 复验 `init-plugin` change 中依赖"插件已加载"的验证类任务(日志/统计/工具),在 `init-plugin` 的 tasks.md 中勾选真实通过项
- [ ] 9.2 若验证全部通过,考虑将本 change 与 `init-plugin` 一起归档(`openspec archive`)
