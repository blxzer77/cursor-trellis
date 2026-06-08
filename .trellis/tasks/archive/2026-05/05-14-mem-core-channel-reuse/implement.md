# Core mem and channel reuse implementation plan

## Phase 1 — Forum naming

- [x] Replace channel type `threads` with `forum` in core schema and public types.
- [x] Update CLI `channel create --type` help and parser errors to accept only `chat | forum`.
- [x] Rename `readThreadsChannelEvents` to forum-channel terminology and update all seven direct core callers: `listThreads`, `showThread`, `postThread`, `renameThread`, `addThreadContext`, `deleteThreadContext`, `listThreadContext`.
- [x] Rename plural `threads` public/API/CLI names to `forum`: `listThreads` -> `listForumThreads`, CLI `channel threads` -> `channel forum`, `ThreadsOptions` -> `ForumOptions`, and user-facing “threads channel” -> “forum channel”.
- [x] Remove public export aliases for old plural names; do not keep `listThreads`, `readThreadsChannelEvents`, `ThreadsOptions`, or `trellis channel threads`.
- [x] Keep singular `thread`, `ThreadState`, and thread action names where they describe one topic inside a forum.
- [x] Keep `thread` commands and event kind names for individual forum topics.
- [x] Make legacy behavior explicit: `parseChannelType("threads")` throws, new writes emit only `type:"forum"`, reducers do not normalize legacy `thread` / `threads` values to forum, and thread APIs reject legacy logs as non-forum.
- [x] Update tests and fixtures to use `type:"forum"`.
- [x] Update channel spec examples and behavior tables to use `forum`.

Validation:

```bash
pnpm --filter @mindfoldhq/trellis-core test -- test/channel/metadata.test.ts test/channel/threads.test.ts
pnpm --filter @mindfoldhq/trellis test -- test/commands/channel.test.ts
pnpm --filter @mindfoldhq/trellis typecheck
```

## Phase 2 — Mem extraction boundary

- [x] Classify `packages/cli/src/commands/mem.ts` functions into core vs CLI.
- [x] Use GitNexus context results as the first split: `runMem` stays CLI orchestration; `parseArgv`, `die`, `printSessions`, `shortDate`, `shortPath`, terminal row formatting stay CLI.
- [x] Move candidates behind `cmdList` / `cmdSearch` / `cmdContext`: `buildFilter`, `listAll`, `searchSession`, `searchSessionWithChildren`, `extractDialogue`, `findSessionById`, `relevanceScore`, and context chunking helpers.
- [x] Create `packages/core/src/mem/` with `index.ts`, `types.ts`, `filter.ts`, `search.ts`, `dialogue.ts`, `context.ts`, `phase.ts`, `sessions.ts`, `projects.ts`, `adapters/{claude,codex,opencode}.ts`, and `internal/{jsonl,paths}.ts`.
- [x] Move persisted Claude/Codex session JSONL parsing into `core/mem/adapters/claude.ts` and `core/mem/adapters/codex.ts`; keep channel live stdout/RPC adapters separate.
- [x] Extract reusable JSONL line iteration and text-block normalization helpers only where they are protocol-neutral.
- [x] Avoid a generic `helpers/` directory; internal modules must be named for their responsibility.
- [x] Do not import channel `ContextEntry` into mem v1; mem context remains dialogue-window context.
- [x] Move only `isPlainObject` to `packages/core/src/internal/json.ts` if mem parser guards need it. Keep JSONL/path/time/dialogue helpers under `packages/core/src/mem/`.
- [x] Do not reuse channel-only `ChannelScope`, `EventOrigin`, `ThreadAction`, or `ThreadState` for unrelated mem concepts.
- [x] Keep core dependency surface intentional: do not add `zod` to `@mindfoldhq/trellis-core` unless a follow-up design note explicitly accepts that dependency.
- [x] Move pure data types and search/filter/context helpers into core.
- [x] Keep CLI-only rendering, argument parsing, and exit handling in `packages/cli/src/commands/mem.ts`.
- [x] Add `@mindfoldhq/trellis-core/mem` as an explicit package subpath export in `packages/core/package.json`.
- [x] Do not re-export mem from `packages/core/src/index.ts`; callers must import from `@mindfoldhq/trellis-core/mem`.
- [x] Public mem API exports: `listMemSessions`, `searchMemSessions`, `readMemContext`, `extractMemDialogue`, `listMemProjects`.
- [x] Keep internal pure context selection as `selectContextTurns`; do not expose it unless a real external consumer appears.
- [x] Return structured results with warnings from core; CLI decides how to print warnings and whether to exit.
- [x] Delete `SearchRecord` from v1 public design. Keep public results centered on `MemSessionInfo`, `SearchHit`, `MemSearchMatch`, `MemContextResult`, and `MemExtractResult`.
- [x] Move pure helper tests from CLI into `packages/core/test/mem/*`; do not keep CLI helper exports only for old tests.

Validation:

```bash
pnpm --filter @mindfoldhq/trellis-core test -- mem
pnpm --filter @mindfoldhq/trellis-core build
pnpm --filter @mindfoldhq/trellis-core typecheck
pnpm --filter @mindfoldhq/trellis typecheck
```

## Phase 3 — CLI wrapper preservation

- [x] Wire CLI `trellis mem` to call the core mem API while preserving current command behavior.
- [x] Preserve current flags and arguments: `trellis mem search <keyword> --platform codex`, `trellis mem context <session-id> --grep <keyword>`, and existing `extract`, `list`, `projects` behavior.
- [x] Do not introduce hit ids; `context` remains session-id based.
- [x] Keep the current `trellis mem` source set: Claude Code, Codex, OpenCode.
- [x] Do not add channel/forum/thread history as a mem source in this task.
- [x] Do not add `--channel`, `--thread`, or runtime-event indexing flags.
- [x] Preserve existing mem integration tests or update them only for package-boundary-neutral wording changes. CLI tests should cover command behavior, JSON output, and exit behavior rather than pure helper internals.

Validation:

```bash
pnpm --filter @mindfoldhq/trellis test -- test/commands/mem-helpers.test.ts test/commands/mem-since-cross-day.test.ts test/commands/mem-platforms.test.ts test/commands/mem-phase-slice.test.ts test/commands/mem-integration.test.ts
pnpm --filter @mindfoldhq/trellis typecheck
```

## Review gates

- [x] Run a Trellis architecture/check review after Phase 1 before starting mem extraction.
- [x] Run another review after Phase 2 because the package boundary is the main risk.
- [x] Re-run GitNexus impact on the renamed forum assertion and on `runMem` after each phase.
- [x] Update `.trellis/spec/cli/backend/commands-channel.md` and core/CLI package specs before commit.
- [ ] Do not edit historical release manifests. New manifests/changelogs use `forum`; published manifests keep historical `threads` text.
- [x] Run grep gate: `rg -n 'type: "threads"|--type threads|channel threads|threads channel|thread channel|listThreads|readThreadsChannelEvents|ThreadsOptions' packages/core packages/cli .trellis/spec -g '!packages/cli/src/migrations/manifests/*.json'`.
- [x] Run no-deep-import gate: `rg -n '@mindfoldhq/trellis-core/.*/internal|@mindfoldhq/trellis-core/internal|packages/core/src/internal|packages/core/src/mem/internal' packages/cli/src packages/cli/test`.
- [x] Run no-zod-core gate: `rg -n '"zod"|from "zod"|from '\''zod'\''' packages/core/package.json packages/core/src`.
- [x] Run package export smoke after build: `node -e 'await import("@mindfoldhq/trellis-core/mem")'` from a context that resolves the built package, or add equivalent core package smoke coverage.
- [ ] Commit as one coherent change only if forum rename and mem-core extraction both fit the same release slice; otherwise split into two commits.

## Release-blocking validation

```bash
pnpm --filter @mindfoldhq/trellis-core build
pnpm --filter @mindfoldhq/trellis-core test -- test/mem
pnpm --filter @mindfoldhq/trellis-core test -- test/channel/metadata.test.ts test/channel/threads.test.ts
pnpm --filter @mindfoldhq/trellis test -- test/commands/channel.test.ts
pnpm --filter @mindfoldhq/trellis test -- test/commands/mem-helpers.test.ts test/commands/mem-since-cross-day.test.ts test/commands/mem-platforms.test.ts test/commands/mem-phase-slice.test.ts test/commands/mem-integration.test.ts
pnpm --filter @mindfoldhq/trellis-core typecheck
pnpm --filter @mindfoldhq/trellis typecheck
rg -n '"zod"|from "zod"|from '\''zod'\''' packages/core/package.json packages/core/src
rg -n '@mindfoldhq/trellis-core/.*/internal|@mindfoldhq/trellis-core/internal|packages/core/src/internal|packages/core/src/mem/internal' packages/cli/src packages/cli/test
rg -n 'type: "threads"|--type threads|channel threads|threads channel|thread channel|listThreads|readThreadsChannelEvents|ThreadsOptions' packages/core packages/cli .trellis/spec -g '!packages/cli/src/migrations/manifests/*.json'
```

Latest validation (2026-05-14):

- `pnpm --filter @mindfoldhq/trellis-core build` — passed.
- `pnpm --filter @mindfoldhq/trellis-core typecheck` — passed.
- `pnpm --filter @mindfoldhq/trellis-core test -- test/mem` — passed, 178 tests.
- `pnpm --filter @mindfoldhq/trellis typecheck` — passed.
- `pnpm --filter @mindfoldhq/trellis exec vitest run test/commands/mem-helpers.test.ts test/commands/mem-integration.test.ts` — passed, 37 tests.
- `pnpm --filter @mindfoldhq/trellis-core lint` — passed.
- `pnpm --filter @mindfoldhq/trellis lint` — passed.
- `@mindfoldhq/trellis-core/mem` subpath smoke import passed; root barrel does not export mem.
- Core mem grep gates passed: no `zod`, no `console.*`, no `process.exit`.
- CLI deep-import gate passed: CLI imports only public `@mindfoldhq/trellis-core/mem`.

Trellis channel checks:

- Phase 1 check: `check-mem-core-forum` / `check-forum-r2` — `[VERDICT] ship`.
- Phase 2 first check: `check-mem-core-forum` / `check-mem` — `fix-required`; found stale mem spec and missing Codex `argv[]` support.
- Phase 2 fix worker: `implement-mem-core-forum` / `implement-mem-fixes` — fixed both major findings.
- Phase 2 second check: `check-mem-core-forum` / `check-mem-r2` — `[VERDICT] ship`.

## Rollback points

- Forum rename can be reverted independently if tests fail before mem extraction starts.
- Mem extraction should preserve existing CLI behavior through wrapper tests before deleting old helper code.
- Do not migrate local beta event logs automatically; manual grep/replace is an operator step outside code.
