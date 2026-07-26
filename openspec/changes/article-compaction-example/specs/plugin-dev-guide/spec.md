## MODIFIED Requirements

### Requirement: 覆盖 Hooks 全览

文章 SHALL 列出 `Hooks` 接口的全部 hook,每个含用途说明;其中 `config`、`event`、`tool`、`chat.headers`、`experimental.session.compacting` SHALL 配代码示例。文章 SHALL 明确指出 `config` hook 存在于类型定义但官方文档未展示。

#### Scenario: config hook 被覆盖且标注文档缺失

- **WHEN** 读者查阅 Hooks 章节
- **THEN** 文章 SHALL 讲解 `config` hook 的签名与用途,并注明"此 hook 存在于类型定义但官方 plugins 文档未展示"

#### Scenario: 核心 hooks 有代码示例

- **WHEN** 读者查阅 config/event/tool/chat.headers 的讲解
- **THEN** 每个 hook SHALL 配一段可读的代码示例(非伪代码,可对照类型定义)

#### Scenario: compacting hook 有代码示例

- **WHEN** 读者查阅 `experimental.session.compacting` 的讲解
- **THEN** 文章 SHALL 配一段代码示例,展示 `output.context.push()` 追加上下文的用法,并提及 `output.prompt` 可整体替换 compaction prompt
