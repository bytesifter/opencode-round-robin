## Why

README 存在账号信息泄露、安装方式写死作者路径、架构描述过时等问题,且项目缺少 LICENSE 文件,GitHub repo 显示 "No license"。作为开源项目,README 需符合 GitHub 开源标准并补齐许可证。

## What Changes

### README 重写(12 项)

1. 删 balancer 对比(L5 句 + L139-151 整章)
2. 删 "支持 npm 零配置分发"(L14,不发 npm)
3. 安装章节重写:GitHub clone + build + `file://`,不提 npm
4. 账号名泛化:volxc9208/volxc5425/vollqh5426 -> account-a/b/c
5. 删作者路径 file:///D:/code/projects/...,改用户 clone 路径
6. 补 GitHub 仓库链接 https://github.com/bytesifter/opencode-round-robin
7. 配置示例改"3 个账号"(方案 A,不提 plan 账号,避免前后不一致)
8. 修 L108 "自动聚为一组" 架构过时:provider-takeover 后是扁平池不分组
9. 修 L108 model 作用描述:原 URL 是匹配凭证,插件替换为随机 provider 的 URL+key
10. 补 license badge(顶部,shields.io)
11. 补许可证章节(底部,Apache-2.0 + 指向 LICENSE)
12. 补贡献章节(一句话"欢迎提 Issue/PR")

### 新增文件

- **LICENSE**:Apache 2.0,版权人 bytesifter
- **package.json** 加 `"license": "Apache-2.0"`

## Capabilities

无 spec 变更(文档+许可证,非功能变更)。

## Impact

- **README.md**:全文重写
- **LICENSE**:新建
- **package.json**:加 license 字段
