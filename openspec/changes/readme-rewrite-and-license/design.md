## Context

README 对照源码逐行验证后发现 9 类事实错误(账号泄露、作者路径、架构过时等),同时项目缺少开源必备的 LICENSE 文件。合并为一次重写。

## Goals / Non-Goals

**Goals:**
- README 反映当前代码实际行为(扁平池、不分组)
- README 不泄露账号信息
- README 安装指引面向陌生用户(GitHub clone,非作者本地路径)
- 补齐 Apache 2.0 LICENSE
- README 符合 GitHub 开源项目标准(license badge + 许可证章节 + 贡献章节)

**Non-Goals:**
- 不改源码
- 不补 CHANGELOG.md / CONTRIBUTING.md / .github 模板(小项目,能省就省)
- 不发布 npm
- 不改文章(articles/)

## Decisions

### 决策 1:License 选 Apache 2.0

**选择:** Apache 2.0,版权人 bytesifter。

**理由:** 用户明确要求。Apache 2.0 比 MIT 多专利授权条款,对企业采用更友好。

### 决策 2:配置示例用方案 A(3 个 coding 账号,不提 plan)

**选择:** account-a/b/c 三个账号,同 baseURL,不展示混合端点池。

**理由:** README 首要任务是让人能跑起来。混合池(coding+plan 混轮询)会引发"coding 请求发到 plan 端点不会出错吗"的疑问,属于实现细节,不适合在 README 展示。

### 决策 3:不补 CHANGELOG / CONTRIBUTING / .github

**选择:** 只补 LICENSE + README,不单独建贡献指南文件。

**理由:** 项目还小,README 里一句话"欢迎提 Issue/PR"即可。

## Risks / Trade-offs

- **Apache 2.0 文本较长**(相比 MIT),但 GitHub 会自动识别 LICENSE 文件并在 repo 页面显示。
- **README 重写幅度大**,但当前 README 事实错误多,局部修补不如重写干净。
