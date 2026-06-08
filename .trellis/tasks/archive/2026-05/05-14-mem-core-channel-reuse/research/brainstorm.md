# Brainstorm evidence and rounds

## Evidence Pass

Files inspected:

- `packages/cli/src/commands/mem.ts`
- `packages/core/src/channel/api/types.ts`
- `packages/core/src/channel/internal/store/schema.ts`
- `packages/core/src/channel/api/post-thread.ts`
- `packages/core/src/channel/api/assert.ts`
- `packages/core/src/channel/internal/store/thread-state.ts`
- `packages/cli/src/commands/channel/threads.ts`
- `.trellis/spec/cli/backend/commands-channel.md`
- `.trellis/tasks/05-13-trellis-core-sdk-package/design.md`

Repository index evidence:

- GitNexus `runMem` context: upstream callers are `packages/cli/src/cli/index.ts` and `packages/cli/test/commands/mem-integration.test.ts`; downstream dispatch goes to `parseArgv`, `cmdList`, `cmdSearch`, `cmdProjects`, `cmdContext`, `cmdExtract`, `cmdHelp`, and `die`.
- GitNexus `cmdSearch` context: mixes reusable search/filter logic (`buildFilter`, `listAll`, `searchSession`, `searchSessionWithChildren`, `relevanceScore`) with CLI output helpers (`shortDate`, `shortPath`).
- GitNexus `cmdContext` context: mixes reusable context extraction (`buildFilter`, `listAll`, `extractDialogue`, `findSessionById`) with CLI formatting (`matchCount`, `shortPath`).
- GitNexus `parseChannelType` context: low direct impact; primary flow is `registerChannelCommand -> createChannel -> parseChannelType`.
- GitNexus `readThreadsChannelEvents` context/impact: high-impact forum/thread assertion point; direct callers are `listThreads`, `showThread`, `postThread`, `renameThread`, `addThreadContext`, `deleteThreadContext`, `listThreadContext`.
- GitNexus `reduceThreads` context: thread state projection SOT for core read/context APIs, CLI thread show, CLI messages thread board, and channel tests.
- abcoder was reindexed for `packages/core` and `packages/cli`; `core` is usable through MCP, while `cli` JSON exists but MCP display is partially distorted by nested `src/templates/opencode` package boundaries.

Confirmed facts:

- `mem` is still implemented as one large CLI command file, with reusable parsing/search/context logic mixed with terminal rendering and process-level exit behavior.
- `@mindfoldhq/trellis-core/channel` already owns channel storage, thread reducers, context entries, public channel APIs, and type parsing.
- Existing beta code uses `ChannelType = "chat" | "threads"` and stores `type:"threads"` for thread-list-first channels.
- Thread as an inner primitive is already a real concept: event kind `thread`, `ThreadAction`, `ThreadState`, `postThread`, `renameThread`, thread context APIs, and `reduceThreads`.
- `mem.ts` currently uses `zod` for runtime schemas; `@mindfoldhq/trellis-core` currently has no `zod` dependency and uses hand-written lightweight parsers for task records.
- `packages/core/src/channel/index.ts` already exports `ContextEntry`, `FileContextEntry`, `RawContextEntry`, `ChannelScope`, `EventOrigin`, `asContextEntries`, `asStringArray`, `contextEntryKey`, and related channel primitives.
- `mem.ts` exports or defines its own `Platform`, `SessionInfo`, `DialogueRole`, `DialogueTurn`, `SearchHit`, `Filter`, task.py parsing, JSONL reading, injection stripping, dialogue chunking, source adapters, and CLI formatting.

Repository-answerable decisions already resolved:

- The forum rename must update `readThreadsChannelEvents` and its callers, not only `parseChannelType`.
- `reduceThreads` should keep the word `thread` because it models the inner forum topic, not the top-level channel type.
- `runMem` can remain the CLI entry point while reusable internals move below it; the external blast radius of that wrapper is low.
- `ContextEntry` should be reused from core/channel for any file/raw context concept; do not define a mem-only duplicate.
- `EventOrigin` and `ChannelScope` are channel-specific and should not be forced into mem unless mem truly needs that exact domain meaning.
- `TaskPyEvent` / `BrainstormWindow` are not channel concepts; if moved, they belong under `core/mem` or possibly a future task-session analysis module, not under `channel`.
- Shared low-level helpers like `readJsonl`, `readJsonFile`, `isPlainObject`, `inRangeOverlap`, and `sameProject` are broader than channel. If reused, they should move to a neutral core utility/internal module, not to channel.
- Claude/Codex session JSONL readers in `mem.ts` are not currently duplicated elsewhere in reusable form. Channel adapters parse live process stdout (`claude --input-format stream-json`, Codex app-server JSON-RPC), not persisted session rollout JSONL.
- `parseClaudeLine` / `parseCodexLine` can share small block/summary helpers with mem eventually, but should not be reused directly as session history parsers because their output is channel runtime events rather than dialogue turns.

Remaining user/product decisions:

- Whether forum naming should also rename CLI list command shape from `threads` to `forum` / `forums`, beyond `--type forum`.
- Which duplicated `mem` concepts should be aligned to existing channel/core schema names versus kept as mem-specific concepts.
- Whether first extraction should preserve the current one-file CLI behavior exactly at the command surface, or allow small output wording changes where package boundaries force renames.

## Brainstorm Rounds

1. Decision: Top-level thread-list channel naming.
   Evidence: Existing code uses `type:"threads"` while individual topic primitives are already named `thread`.
   User answer: Rename top-level type to `forum`; a forum contains threads.
   Resulting requirement: New writes and CLI use `forum`; `thread` remains the inner topic primitive.

2. Decision: Compatibility for existing beta `threads` logs.
   Evidence: Current parser and metadata reducers contain `threads` and legacy `thread` compatibility, but the feature is still beta.
   User answer: Do not preserve compatibility; local beta data can be manually grep/replaced.
   Resulting requirement: New parser accepts only `chat | forum`; no `threads` alias or auto-migration.

3. Decision: Brainstorm quality gate.
   Evidence: The initial planning draft skipped full evidence and multi-round questioning.
   User answer: Improve the `trellis-brainstorm` skill so agents must evidence-gate and record multiple rounds.
   Resulting requirement: The skill now requires evidence notes, a brainstorm ledger, GitNexus/abcoder use when structural relationships matter, and multiple rounds before final design.

4. Decision: First implementation slice scope.
   Evidence: `mem` currently mixes reusable search/context logic in CLI; channel already owns event schema, context entries, and thread reducers in core; forum rename touches the same channel/thread schema surface.
   User answer: Do these together: move current `mem` core capabilities into `@mindfoldhq/trellis-core`, reuse channel schema where duplicate definitions exist, and rename `threads` to `forum`. Do not expand `mem` product capability by making channel/forum/thread history a new mem source.
   Resulting requirement: The task is one cohesive core/channel release slice, not separate follow-up work. Implementation must avoid parallel duplicate schemas between mem and channel while preserving current `mem` behavior.

5. Decision: Core mem source layout and helper naming.
   Evidence: Claude/Codex persisted session parsing is currently in `mem.ts`; channel adapters parse different live protocols. Generic `helpers/` would hide boundaries.
   User answer: Use the proposed `packages/core/src/mem/` structure with `adapters/` and `internal/`; do not create a vague `helpers/` directory.
   Resulting requirement: Implement `mem` as a public module with narrow barrels and internal modules named by responsibility (`jsonl`, `text`, `paths`) rather than generic helpers.

6. Decision: Where channel/mem shared pieces live.
   Evidence: Trellis channel architect review in `brainstorm-mem-core-forum` rejected `shared/` and top-level `context/` for this scope. `mem context` means dialogue-window context; channel `ContextEntry` means file/raw attached context. No current mem v1 code needs `ContextEntry`.
   User answer: Discussed through architect worker; accept minimal boundary.
   Resulting requirement: Do not create `packages/core/src/shared/` or `packages/core/src/context/` in this release. Keep `ContextEntry` channel-owned and publicly re-exported from `@mindfoldhq/trellis-core/channel`. Move only truly cross-domain `isPlainObject` to `packages/core/src/internal/json.ts` if mem parser guards need it. Keep JSONL/path/time/dialogue helpers under `packages/core/src/mem/`.

7. Decision: Remove plural `threads` terminology.
   Evidence: Current CLI has `trellis channel threads <name>` for listing all thread topics in a `type:"threads"` channel; current code also has `listThreads`, `readThreadsChannelEvents`, `ThreadsOptions`, and many user-facing “threads channel” strings.
   User answer: Preserve the single `thread` concept, but remove all plural `threads` naming. Replace plural `threads` with `forum`.
   Resulting requirement: Top-level channel type is `forum`; list command becomes `trellis channel forum <name>`; public/user-facing wording says forum, not threads. Single-thread commands and event/action names remain singular `thread` where they refer to one topic.

8. Decision: Mem core public API names.
   Evidence: Architect review round 3 inspected current `trellis mem` behavior and tests. `context` ranks/selects turns and surrounding windows; `extract` returns structured phase/window/group data; `projects` is data aggregation over sessions, not terminal-only rendering.
   User answer: Delegate to architect review; accept behavior-shaped public API.
   Resulting requirement: Public API uses `listMemSessions`, `searchMemSessions`, `readMemContext`, `extractMemDialogue`, and `listMemProjects`. `readMemContext` remains public; internal pure selection helper may be named `selectContextTurns`. `extractMemDialogue` returns structured `MemExtractResult`. `listMemProjects` belongs in core v1.

9. Decision: Final implementation-readiness blockers.
   Evidence: Architect opposition review round 4 found no remaining product questions, but identified planning blockers around historical manifests, current mem CLI command semantics, legacy `type:"threads"` log behavior, core package export shape, and validation gates.
   User answer: No new product decision required; incorporate review.
   Resulting requirement: Do not rewrite historical manifests; exclude published manifest JSON from grep gates. Preserve existing `trellis mem search <keyword> --platform ...` and `trellis mem context <session-id> --grep ...` behavior, with no hit id concept. Define legacy `threads` as rejected/non-forum, not half-compatible. Add only `@mindfoldhq/trellis-core/mem` subpath export and do not root-export mem. Add validation gates for package export smoke, no core zod dependency, no CLI deep imports, and forum terminology cleanup.
