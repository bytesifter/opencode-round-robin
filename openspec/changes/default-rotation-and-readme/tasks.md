## 1. 默认轮转

- [ ] 1.1 修改 `src/index.ts` Logger 构造逻辑:`logPath` 存在 -> simple(logPath),否则 -> rotation(logDir ?? defaultDir)
- [ ] 1.2 修改 `src/index.ts` defaultPath 辅助函数或内联:默认目录为 `~/.local/share/opencode/`(rotation 模式用目录,非文件路径)
- [ ] 1.3 删除 `src/logger.ts` 中 `currentDate` 实例变量及 `write()` 中的日期比较死代码
- [ ] 1.4 执行 `bun x tsc --noEmit` 确认类型检查通过

## 2. 测试更新

- [ ] 2.1 更新 `tests/logger.test.ts`:补充默认轮转模式测试(不传 rotation opts 时默认 simple,传 rotation 时轮转)
- [ ] 2.2 执行 `bun test` 确认全部通过

## 3. package.json

- [ ] 3.1 在 `package.json` 中加 `"files": ["dist"]`(npm 发布内容)

## 4. README 重写

- [ ] 4.1 功能部分:加结构化日志(级别/业务上下文/按日轮转)、自包含构建
- [ ] 4.2 安装部分:npm 包名方式 + `file:///` 路径方式;删除旧 `file:` 依赖方式;去掉 "Bun 自动安装" 描述
- [ ] 4.3 配置表:加 `logDir` 选项;`logPath` 描述改为"强制单文件模式";默认日志路径改为轮转格式
- [ ] 4.4 日志示例:更新为新格式(级别/duration/model/mode/agent/session)
- [ ] 4.5 开发部分:加 `bun run build`;`main` 指向 `./dist/index.js`;去掉"无构建"
- [ ] 4.6 体量:更新为 ~740 行;与 balancer 对比表更新

## 5. 仓库清理

- [ ] 5.1 删除 `console.error('FAILED`(0 字节垃圾文件)
- [ ] 5.2 移除 `agents` submodule:`git rm --cached agents`,删除 `.gitmodules`
- [ ] 5.3 删除 `DESIGN.md`(旧设计文档,已被 openspec/ 取代)

## 6. 构建验证

- [ ] 6.1 执行 `bun run build` 确认构建成功
- [ ] 6.2 重启 opencode,确认默认轮转生效(日志写入 `round-robin-YYYY-MM-DD.log`)
- [ ] 6.3 确认 `session=` 字段出现在 usage 日志中(sessionID 修复验证)

## 7. Git 提交

- [ ] 7.1 `git add` 暂存所有需要的文件(排除 agents/.gitmodules/DESIGN.md/console.error)
- [ ] 7.2 写提交信息并提交
- [ ] 7.3 `git push` 到 GitHub
