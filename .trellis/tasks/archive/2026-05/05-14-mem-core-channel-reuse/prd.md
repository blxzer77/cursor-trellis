# Core mem and channel reuse

## Goal

讨论 `trellis mem` 现有核心能力如何迁移到 `@mindfoldhq/trellis-core`，并明确它和 `channel` / `forum` / `thread` 之间哪些 schema / 类型 / 工具函数可以复用，避免重复定义。

## Requirements

- `trellis mem` 目前在 CLI 内部承载跨 Claude Code、Codex、OpenCode 会话的历史检索、时间范围过滤、项目过滤、文本召回、上下文片段提取等能力；需要判断哪些能力应进入 `@mindfoldhq/trellis-core`，哪些仍应保留在 CLI 层。
- 第一版实现必须一块做三件事：把当前 `mem` 核心能力搬到 `@mindfoldhq/trellis-core`；让 `mem` 与 channel/forum/thread 在重复概念上复用 schema / 类型 / 工具函数；把顶层 channel 类型从 `threads` 改成 `forum`。
- 保持 `mem` 用户能力不变；不要把 channel/forum/thread 历史新增为 `mem` 的搜索 source，不新增 `trellis mem --channel` / `--thread` 这类功能。
- 不允许为 mem 和 channel 各自定义一套重复的上下文、来源、过滤字段。需要有单一来源或明确的复用边界。
- 命名模型改为：`chat` 是普通聊天 channel；`forum` 是话题区类型的 channel；`thread` 是 `forum` 里的单个话题。不要再把顶层 channel 类型命名为 `threads`。
- 新建话题区应使用 `trellis channel create <name> --type forum`；在 forum 中创建或更新单个话题仍使用 thread 语义，例如 opened/comment/status/rename/context。
- 默认查看 forum 时应展示 thread 列表；进入某个 thread 后再看该 thread 的时间线、评论、状态、context。
- `threads` 旧命名不做兼容；beta 期间本地已有 `type:"threads"` 数据可通过 grep 后手动替换为 `type:"forum"`。新代码、新 CLI、新 spec、新测试只使用 `forum`。
- 已发布历史 manifest 不重写；只有新 manifest / 新 changelog 使用 `forum` 术语。
- 删除所有复数 `threads` 命名。保留单数 `thread` 概念；复数集合、顶层类型、列表命令、文案统一用 `forum`。现有 `trellis channel threads <name>` 应改为 `trellis channel forum <name>`。
- 核心能力迁移后，CLI 应作为薄壳调用 core API；业务系统或未来 SDK 应能直接调用 core API，而不需要 subprocess 调 `trellis mem`。
- `@mindfoldhq/trellis-core/mem` 作为显式 subpath export 发布；不要从 root barrel 导出 mem，避免扩大根包 API。
- 设计必须保持高内聚、低耦合、可复用：会话源解析、事件规范化、搜索排序、上下文片段、终端展示、CLI 参数解析应有清晰边界。
- 不把平台私有项目、外部业务背景或临时沟通内容写进公开代码、公开 spec 或发布文档。
- 需要先以功能视角讨论清楚用户能做什么，再进入技术设计；不要直接从文件搬迁或模块拆分开始。

## Resolved Decisions

- `mem` core public API 第一版包含 `listMemSessions`、`searchMemSessions`、`readMemContext`、`extractMemDialogue`、`listMemProjects`，覆盖现有 `trellis mem` 数据能力。
- 第一版不新增 streaming / cursor；保留现有 limit 行为。
- CLI 输出格式、terminal rendering、pretty/raw 展示、exit code 继续留在 CLI 包。

## Acceptance Criteria

- [ ] 形成一份中文 PRD，明确 `mem` 迁移到 core 的用户价值、范围、非目标和验收标准。
- [ ] 形成一份中文设计草案，说明 `mem`、`channel`、`forum`、`thread` 的 schema / 类型 / 工具函数复用边界、数据流、API 形态和兼容策略。
- [ ] 明确哪些现有 `packages/cli/src/commands/mem.ts` 能力应抽入 `packages/core/src/mem/`，哪些必须留在 CLI。
- [ ] 明确 `mem` 保持现有功能，不新增 channel/forum/thread 历史检索入口。
- [ ] 明确 `threads` 到 `forum` 的破坏式命名迁移策略：不保留 alias，不保留读取兼容，本地 beta 数据手动 grep 替换。
- [ ] 明确历史 manifest 不修改；grep gate 排除已发布 manifest，只检查当前代码/spec/user-facing 新内容。
- [ ] 明确复数 `threads` 命令和 public API 命名的替换策略：保留单数 `thread`，删除复数 `threads`。
- [ ] 明确 `trellis mem` CLI 行为保持现状：`search` 使用 `<keyword>` 和 `--platform`，`context` 使用 `<session-id>` 和 `--grep`，不引入 hit id。
- [ ] 明确 core mem package export：只新增 `@mindfoldhq/trellis-core/mem` subpath，不从 `@mindfoldhq/trellis-core` 根导出。
- [ ] 更新相关 spec，记录 core/CLI 分层规则，防止后续继续把可复用业务逻辑堆进 CLI command 文件。

## Notes

- 已完成 GitNexus 重索引；abcoder 已为 `packages/core` 和 `packages/cli` 重新生成本机 AST JSON。
- 已用 GitNexus 查看 `runMem`、`cmdSearch`、`cmdContext`、`cmdList`、`parseChannelType`、`postThread`、`readThreadsChannelEvents`、`reduceThreads` 的调用关系和影响面；设计与实现计划已按结果修正。
- 当前讨论先停留在规划阶段；最终 architecture opposition review 已完成，发现的 manifest、CLI 示例、legacy event-log、export-map blocker 已写回 `design.md` 和 `implement.md`。
