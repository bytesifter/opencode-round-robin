## MODIFIED Requirements

### Requirement: 单 key 组不再透传

所有匹配 pool 的请求（含单 key 组）SHALL 被拦截、注入 Authorization 头、记日志。SHALL NOT 存在 `passthrough` 概念。仅 URL 不匹配任何 pool 时才透传原始 fetch。

#### Scenario: 单 key pool 正常拦截并记日志

- **WHEN** 请求 URL 匹配某单 key pool
- **THEN** 插件 SHALL 注入 `Authorization: Bearer <key>` 头
- **AND** SHALL 调用 `onResponse` 回调记日志

#### Scenario: URL 不匹配任何 pool 时透传

- **WHEN** 请求 URL 不匹配任何 pool
- **THEN** 插件 SHALL 透传原始 fetch，不修改 headers
- **AND** SHALL NOT 调用 `onResponse` 回调

#### Scenario: 单 key next() 返回唯一 key

- **WHEN** 调用单 key pool 的 `next()`
- **THEN** SHALL 返回该 pool 的唯一 key
- **AND** SHALL NOT 存在 `passthrough` 属性
