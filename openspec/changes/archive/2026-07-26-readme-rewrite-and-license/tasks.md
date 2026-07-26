## 1. LICENSE 文件

- [x] 1.1 创建 LICENSE 文件:Apache 2.0 完整文本,版权人 bytesifter
- [x] 1.2 package.json 加 `"license": "Apache-2.0"`

## 2. README 重写

- [x] 2.1 顶部:标题 + license badge + 一句话描述
- [x] 2.2 功能列表:删 L14 "支持 npm 零配置分发",改"零依赖分发"
- [x] 2.3 安装章节:GitHub clone + bun install + bun run build + file:// 指向用户路径,补仓库链接
- [x] 2.4 配置表 + 规则:保持(已验证正确)
- [x] 2.5 配置示例:account-a/b/c,3 个账号,删"3 coding + 1 plan"改为"3 个账号",泛化 baseURL 可保留真实端点
- [x] 2.6 修 L108 架构描述:"扁平池,所有 provider 一起轮询,不分组";修 model 作用:"初始 URL 供插件匹配,替换为随机 provider 的 URL+key"
- [x] 2.7 工具用法 + 日志示例:账号名泛化为 account-a/b
- [x] 2.8 删 balancer 对比(L5 句 + L139-151 整章)
- [x] 2.9 开发章节:保持
- [x] 2.10 底部补许可证章节(Apache-2.0,指向 LICENSE)
- [x] 2.11 底部补贡献章节(一句话"欢迎提 Issue/PR")

## 3. 验证与提交

- [x] 3.1 确认 README 无残留 volxc/账号名
- [x] 3.2 确认 LICENSE 文件存在且 GitHub 能识别
- [x] 3.3 git add + commit + push
