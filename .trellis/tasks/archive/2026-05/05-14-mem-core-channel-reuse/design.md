# Core mem and channel reuse design

## 功能结论

`trellis mem` 应迁移出 CLI command，成为 `@mindfoldhq/trellis-core` 的可复用历史检索能力；CLI 只负责参数解析和终端展示。`channel` 继续作为协作事件流，`forum` 是一种 channel 类型，`thread` 是 forum 内的单个话题。第一版实现同时完成 mem-core 迁移、channel schema 复用、`threads` 到 `forum` 的破坏式改名。

用户视角的能力分层：

```text
chat channel       = 时间线式协作消息
forum channel      = 话题区
forum thread       = 话题区里的单个问题、需求、反馈或讨论
mem search         = 现有 Claude Code、Codex、OpenCode 会话历史召回入口
```

`mem` 不应该只服务 terminal。它应提供可被 CLI、daemon、SDK、未来 UI 共同调用的现有搜索和上下文抽取能力，并且在重复概念上复用 core/channel 已有 schema，不新建一套并行定义。第一版不把 channel/forum/thread 历史新增为 mem source。

## Forum model

`threads` 旧类型不兼容迁移，新模型只使用 `forum`。

```bash
trellis channel create trellis-issue --scope global --type forum
trellis channel messages trellis-issue --scope global
trellis channel post trellis-issue --scope global --action opened --title "..." --text "..."
trellis channel forum trellis-issue --scope global
trellis channel thread trellis-issue <thread>
```

默认查看 `forum` 时展示 thread 列表；查看单个 `thread` 时展示该 thread 的时间线、评论、状态、labels、assignees、summary、context。普通 `chat` channel 不支持 thread 操作。

破坏式命名迁移规则：

- New writes use `type:"forum"`.
- New parser accepts only `chat | forum`.
- `--type threads` and `--type thread` both throw with a clear error.
- Existing local beta logs are not auto-migrated; users can grep and replace `type:"threads"` with `type:"forum"`.
- New specs, tests, docs, and release changelogs use `forum` only. Historical manifests stay unchanged.
- Plural `threads` is removed from commands, API names, help text, and specs. Keep singular `thread` only for one topic inside a forum.
- `parseChannelType("threads")` throws; `reduceChannelMetadata` does not normalize legacy `thread` / `threads` values to `forum`.
- Legacy `type:"threads"` logs are not treated as forum channels. Thread APIs must reject them or see them as non-forum channels.

GitNexus 查到的实际影响点：

- `parseChannelType` 的直接影响很小，主要由 `registerChannelCommand -> createChannel -> parseChannelType` 使用，并被 `packages/core/test/channel/metadata.test.ts` 覆盖。
- `readThreadsChannelEvents` 是当前真正的 forum/thread 操作入口，影响 `listThreads`、`showThread`、`postThread`、`renameThread`、`addThreadContext`、`deleteThreadContext`、`listThreadContext`，并继续影响 CLI `channelContextAdd/Delete/List` 和 `registerChannelCommand`。
- `reduceThreads` 是当前 forum thread state 的单一投影入口，被 core read/context API、CLI thread show、CLI messages thread board、core/CLI channel tests 使用。

因此实现时不能只改 parser 文案；应先把 `readThreadsChannelEvents` 这类顶层类型断言重命名为 forum 语义，再更新下游错误文案和测试。所有复数 `Threads` / `threads` API 命名都应改成 `Forum` / `forum`，除非它明确指的是单个 `thread` 的内部状态集合且没有 public/user-facing 暴露。

## Mem in core

Core 应暴露历史检索的纯能力，不暴露 CLI 输出样式。

第一批 core 能力保持现有 `trellis mem` 用户能力：

- 列出现有可检索 session source：Claude Code、Codex、OpenCode。
- 支持当前已有的 project、time range、platform 过滤。
- 搜索文本并返回 session-level match、score、hit count、excerpts。
- 按命中位置抽取前后上下文。
- 支持现有 limit 语义；cursor / pagination 不进入第一版，除非实现时能在不改变 CLI 行为的前提下自然暴露。

暂不进入 core 的能力：

- terminal pretty rendering
- CLI flag parsing
- `console.log` / `process.exit`
- shell-specific path discovery side effects
- 新增 task.py phase 能力；只迁移现有 `trellis mem extract --phase` 行为

这些高阶语义可以后续基于 core search record 组合出来，不放进第一版 public API。

GitNexus 查到的 `mem` 入口关系：

- `runMem` 的上游只有 `packages/cli/src/cli/index.ts` 和 `packages/cli/test/commands/mem-integration.test.ts`，入口迁移风险低。
- `runMem` 下游分发到 `parseArgv`、`cmdList`、`cmdSearch`、`cmdProjects`、`cmdContext`、`cmdExtract`、`cmdHelp`、`die`。
- `cmdSearch` 混合了 core 候选能力和 CLI 展示能力：`buildFilter`、`listAll`、`searchSession`、`searchSessionWithChildren`、`relevanceScore` 应优先拆；`shortDate`、`shortPath`、输出排列仍属 CLI。
- `cmdContext` 同样混合：`buildFilter`、`listAll`、`extractDialogue`、`findSessionById` 是 core 候选；`matchCount`、`shortPath`、输出格式留 CLI。
- `cmdList` 说明 listing 也复用 `buildFilter` / `listAll`，但 `printSessions` 是 CLI-only。

所以 mem 迁移应从 `buildFilter`、source listing、dialogue extraction、search scoring/context extraction 这些纯逻辑开始，不直接搬整个 command。

## Search model

不同 `mem` 会话来源保留自己的原始结构，core v1 的 public model 以 `MemSessionInfo`、`SearchHit`、`MemSearchMatch`、`MemContextResult`、`MemExtractResult` 为中心。不要引入泛化的 `SearchRecord` public API；现有 `trellis mem search` 是 session-level match，不是 record stream。

内部实现可以在 adapter 层使用临时 normalized turn / hit 结构，但这些结构不进入 `@mindfoldhq/trellis-core/mem` public barrel。第一版不做 cursor、pagination、channel/forum/thread history source。

这个模型只服务 `mem` 检索和上下文抽取，不替代 channel event schema。channel 仍然以 event log 为事实来源；第一版 mem 不读取 channel event log。

这样可以避免两个坏模式：

- 不把 channel event 改造成 mem 数据结构，避免 runtime 层被搜索需求污染。
- 不为 mem 和 channel 重复定义同一语义的 schema；同时避免把同名但不同语义的概念合并，例如 mem dialogue context 与 channel `ContextEntry`。

## Package boundaries

目标分层：

```text
packages/core/src/mem/
  index.ts
  types.ts           public input/output types
  filter.ts          project/time/source filters
  search.ts          scoring and text matching
  context.ts         dialogue dispatch, child session merge, session lookup
  phase.ts           task.py command parsing and brainstorm window slicing
  dialogue.ts        injection stripping and dialogue normalization
  sessions.ts        list/search/find/child merge orchestration
  projects.ts        project aggregation
  adapters/
    claude.ts        persisted Claude session JSONL reader
    codex.ts         persisted Codex rollout JSONL reader
    opencode.ts      current degraded no-op adapter
  internal/
    jsonl.ts         streaming JSONL / JSON readers
    paths.ts         default home-based session roots

packages/core/src/internal/
  json.ts            neutral JSON guards such as isPlainObject only

packages/core/src/channel/
  api/               channel/forum/thread public API
  internal/store/    event log, seq, reducer, watch

packages/cli/src/commands/
  mem.ts             CLI wrapper over core mem API
  channel/*.ts       CLI wrapper over core channel API
```

CLI 不深导入 `core/internal/*`。如果 CLI 需要某个能力，应先提升成 core public API。

`packages/core/package.json` 新增唯一 public subpath：

```json
"./mem": {
  "types": "./dist/mem/index.d.ts",
  "import": "./dist/mem/index.js",
  "default": "./dist/mem/index.js"
}
```

不要从 `packages/core/src/index.ts` root barrel re-export mem。调用方应显式使用：

```ts
import { searchMemSessions } from "@mindfoldhq/trellis-core/mem";
```

这样避免根包突然暴露大量 `DialogueTurn`、`SearchHit`、`MemFilter` 等 API。

Do not create a generic `helpers/` directory. Do not create `packages/core/src/shared/` or a top-level `context/` module in this release. There is no real shared context model yet: mem context is dialogue-window context; channel `ContextEntry` is file/raw attached context.

## Reuse inventory

直接复用 core/channel：

- 当前 v1 不直接复用 channel `ContextEntry`。`trellis mem context` 是 dialogue-window context，不是 channel file/raw attached context。
- `ContextEntry`, `FileContextEntry`, `RawContextEntry`, `asContextEntries`, `contextEntryKey`, `buildContextEntries` 继续由 channel 拥有，并从 `@mindfoldhq/trellis-core/channel` 公开导出。
- `GLOBAL_PROJECT_KEY` 当前不引入 mem；只有 mem 真要表达 channel global bucket marker 时再复用。

不应强行复用 channel：

- `ChannelScope`: mem 当前 `--global` / `cwd` 是 session search filter，不等同 channel storage scope。
- `EventOrigin`: mem source 是 `claude | codex | opencode`，不是 channel write origin `cli | api | worker`。
- `ThreadAction`, `ThreadState`, `reduceThreads`: 这些属于 forum thread，不属于当前 mem 功能。
- Channel event schema: 第一版 mem 不读取 channel events。

应抽到 core neutral utility / mem module：

- `Platform` / `MemSourceKind`: 保持 `claude | codex | opencode`，放在 `core/mem/types.ts`。
- `SessionInfo`, `DialogueRole`, `DialogueTurn`, `SearchHit`, `Filter`: 现有 mem domain 类型，迁到 `core/mem/types.ts`。
- `inRangeOverlap`, `sameProject`: 当前属于 mem session filtering，放在 `core/mem/filter.ts`；只有另一个 core 子域需要完全相同语义时再提升。
- `readJsonl`, `readJsonlFirst`, `findInJsonl`, `readJsonFile`: 当前属于 mem persisted session adapter mechanics，放在 `core/mem/internal/jsonl.ts`；不要放到公共或 cross-domain internal。
- `stripInjectionTags`, `isBootstrapTurn`, `chunkAround`, `searchInDialogue`, `relevanceScore`: mem dialogue/search 核心逻辑，放在 `core/mem/search.ts` / `core/mem/dialogue.ts`。
- `parseTaskPyCommandsAll`, `TaskPyEvent`, `buildBrainstormWindows`: mem phase slicing 逻辑，放在 `core/mem/phase.ts`；不放 channel。
- Claude/Codex session JSONL parsing: 迁到 `core/mem/adapters/claude.ts` 和 `core/mem/adapters/codex.ts`，作为 persisted session history reader。不要复用 channel 的 `parseClaudeLine` / `parseCodexLine` 作为主解析器，因为它们解析的是实时 stdout/app-server RPC 并输出 channel runtime events。
- Shared parser fragments: 可以抽出小型 helper，例如 `extractTextBlocks`、`summarizeInput`、`buildTurnFromMessage`、JSONL line iterator。channel adapter 和 mem adapter 可逐步复用这些 helper，但第一版不强行合并两套不同协议的 parser。

保留在 CLI：

- `parseArgv`, `buildFilter(flags)` as CLI flag parser, `die`, `warnOpencodeUnavailable`, `shortDate`, `shortPath`, `printSessions`, `cmd*`, `runMem`.
- CLI wrapper 可把 flags 转成 core `MemFilter`，但 core 不接收 raw CLI flags。

Schema dependency decision:

- `packages/cli` currently depends on `zod`; `packages/core` does not.
- Core task schema uses zero-dependency hand-written parse/safeParse style.
- Preferred implementation is to avoid adding `zod` to `@mindfoldhq/trellis-core` for this extraction. Move TypeScript types plus lightweight runtime guards into core, or keep platform-file zod parsing inside CLI only if a parser cannot be moved cleanly.
- If implementation finds zod would materially reduce risk, that must be an explicit design change because it changes core's dependency surface.

## Channel and forum reuse

channel/forum/thread 侧继续只负责协作事实：

- create channel/forum
- send chat message
- post thread event
- mutate context
- read events
- reduce forum thread list
- watch/stream event log

mem 侧负责历史召回：

- 把 Claude/Codex/OpenCode session 历史规范化为 searchable sessions and dialogue hits
- 按现有 project/time/source 过滤
- 搜索 session text 并返回可以定位回原始 session 的 reference

`context` 字段应继续作为 channel/thread 的业务上下文。第一版 mem 不读取 channel/thread context，也不导入 channel `ContextEntry`。如果未来 mem 增加 file/raw attached context，再单独提升 channel-owned schema 到更明确的公共 primitive；不要现在制造假共享。

## API shape

Core public API 草案：

```ts
export function listMemSessions(options?: ListMemSessionsOptions): Promise<MemSessionInfo[]>;
export function searchMemSessions(options: SearchMemSessionsOptions): Promise<MemSearchResult>;
export function readMemContext(options: ReadMemContextOptions): Promise<MemContextResult>;
export function extractMemDialogue(options: ExtractMemDialogueOptions): Promise<MemExtractResult>;
export function listMemProjects(options?: ListMemProjectsOptions): Promise<MemProjectSummary[]>;
```

Types:

```ts
export type MemSourceKind = "claude" | "codex" | "opencode";
export type MemSourceFilter = MemSourceKind | "all";
export type MemPhase = "brainstorm" | "implement" | "all";

export interface MemFilter {
  platform?: MemSourceFilter;
  since?: Date;
  until?: Date;
  cwd?: string;
  limit?: number;
}

export interface MemSessionInfo {
  platform: MemSourceKind;
  id: string;
  title?: string;
  cwd?: string;
  created?: string;
  updated?: string;
  filePath: string;
  parent_id?: string;
}

export interface DialogueTurn {
  role: "user" | "assistant";
  text: string;
}

export interface MemWarning {
  code: string;
  message: string;
}
```

Result shapes:

```ts
export interface MemSearchResult {
  matches: MemSearchMatch[];
  totalMatches: number;
  warnings: MemWarning[];
}

export interface MemContextResult {
  session: MemSessionInfo;
  query?: string;
  totalTurns: number;
  totalHitTurns: number;
  mergedChildren: number;
  budgetUsed: number;
  maxChars: number;
  turns: MemContextTurn[];
  warnings: MemWarning[];
}

export interface MemExtractResult {
  session: MemSessionInfo;
  phase: MemPhase;
  windows: BrainstormWindow[];
  totalTurns: number;
  groups: MemDialogueGroup[];
  turns: DialogueTurn[];
  warnings: MemWarning[];
}
```

Keep current JSON field names where they are user-visible: `platform`, `by_platform`, `parent_id`, `is_hit`, and `total_turns` can be preserved in CLI JSON output even if core TypeScript result fields use camelCase internally.

CLI 对应关系：

```bash
trellis mem search <keyword> --platform codex
trellis mem context <session-id> --grep <keyword>
```

`context` 当前按 session id / prefix 找 session，不存在 hit id 概念。core API 不引入 hit id。

Naming decisions:

- Use `searchMemSessions`, not `searchMem`, because v1 searches persisted sessions only.
- Use `readMemContext` as public API because it reads a session and returns selected dialogue context. Name the pure selection helper `selectContextTurns` internally.
- Use `extractMemDialogue`, but return structured `MemExtractResult`, not raw turns.
- Use `listMemProjects`; it is a core data aggregation over sessions, not terminal-only rendering.

## Compatibility and migration

`forum` 命名不做 beta 兼容层；这是 beta 功能的语义修正。

需要更新：

- core `ChannelType`
- CLI `--type` help/error
- `readThreadsChannelEvents` 类 forum-channel 断言和错误文案
- forum list command help text
- specs and tests
- local global forum data by manual grep/replace

不需要迁移历史 manifest；这是 beta 内部数据模型变更，不承诺旧 beta 本地 event log 自动升级。已发布 manifest 是 release record，不能重写。新 manifest / 新 changelog 应使用 `forum` 术语。

非目标：

- 不把 channel/forum/thread 历史新增为 `trellis mem` 搜索来源。
- 不新增 `trellis mem --channel`、`--thread`、`--include-runtime` 等 CLI 能力。
- 不索引 agent runtime progress delta、tool call、tool result。

## Risks

- `packages/cli/src/commands/mem.ts` 目前过大，拆分时容易把 terminal rendering 混进 core。实现时先提纯 types/filter/search/context，再迁移 source adapters。
- `forum` 命名变更会影响已有本机 global channel。接受手动 grep 替换，不在代码里承载旧名。
- `@mindfoldhq/trellis-core/mem` subpath export 是新增公开面，需要 build 或 smoke test 验证 package export 可被 Node 导入。
- 旧 CLI helper tests 不能倒逼 `packages/cli/src/commands/mem.ts` 继续导出 pure helpers；pure tests 应迁移到 `packages/core/test/mem/*`，CLI tests 只覆盖 command behavior / JSON output / exit behavior。
