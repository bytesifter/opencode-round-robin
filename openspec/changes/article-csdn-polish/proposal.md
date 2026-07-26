## Why

文章 `articles/opencode-plugin-dev-guide.md` 准备发布到 CSDN，但当前缺少背景动机、包含厂商信息、开头风格过于学术，不适合 CSDN 读者。需要润色后发布。

## What Changes

- **删学术 header**: 移除开头 3 行引用块（类型来源/文档来源/version 标注）
- **加背景章节**: 在"一、opencode 插件能做什么"前加"背景"章节，讲清痛点（单 provider 频繁 429 限流、6 个高级版账号无法自动轮换）、解决方案（插件自动随机选 provider、key 和端点一起换、429 熔断）、GitHub 链接
- **泛化厂商名**: `volxc9208`/`volxc5425` -> `account1`/`account2`；`ark.cn-beijing.volces.com` -> `api.example.com`
- **实战章节更新**: 标注"简化版，完整实现见 GitHub"，泛化示例
- **结尾加 GitHub 引导**: 加"完整代码"链接和星标引导
- **标题调整**: 适合 CSDN 的标题风格

## Capabilities

### New Capabilities

无。

### Modified Capabilities

无。文章内容不属于 spec 管辖范围。

## Impact

- **articles/opencode-plugin-dev-guide.md**: 润色（加背景/删 header/泛化厂商名/加 GitHub 链接）
