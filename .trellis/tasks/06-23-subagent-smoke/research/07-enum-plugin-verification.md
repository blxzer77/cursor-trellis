# R3 — Enum + Hook + Path Anchoring (Plugin Path Smoke Test)

Smoke verification for Route 3: plugin-loaded subagent dispatch via
`~/.cursor/plugins/local/trellis-agents/`.

## R3.1 — Enum acceptance

**Yes.** Dispatched as `trellis-research` via the plugin path.

Evidence:
- Plugin manifest `C:\Users\blaze\.cursor\plugins\local\trellis-agents\.cursor-plugin\plugin.json`
  declares `"agents": "agents/"` and name `trellis-agents`.
- Agent definition `agents/trellis-research.md` exists alongside
  `trellis-implement.md` and `trellis-check.md`.
- The parent agent's `Task` tool accepted `trellis-research` as a
  `subagent_type` and this agent activated under that identity.

=> Plugin successfully registered `trellis-research` into the Task enum.

## R3.2 — Hook injection

**No.** The `<!-- trellis-hook-injected -->` marker was NOT present in the
input prompt received by this subagent.

Evidence:
- `.cursor/hooks.json` registers a `preToolUse` hook with matcher `Task|Subagent`
  pointing to `python .cursor/hooks/inject-subagent-context.py` (timeout 30s).
- `inject-subagent-context.py` emits `<!-- trellis-hook-injected -->` as the
  first line of all four prompt builders (implement/check/finish/research).
- The actual input to this subagent carried no such marker and no injected
  `<trellis-context>` block — only the parent's literal task instructions.

=> Hook is wired but did NOT fire (or its output did not reach this
subagent's input). Plugin-provided subagents may bypass the `preToolUse`
Task matcher, or the parent's inline prompt path skipped hook augmentation.

## R3.3 — Path anchoring

**Inconclusive — primitive works, resolver returns none.**

Evidence:
- `python .trellis/scripts/task.py selected --source` returns
  `Selected task: (none)` / `Source: none` — no live session selection.
- `$env:TRELLIS_CONTEXT_ID` and `$env:TRELLIS_TASK_DIR` are both unset in the
  subagent shell, so the resolver has no anchor to resolve.
- Subagent shell cwd is `D:\MyHarness` (workspace root), NOT
  `D:\MyHarness\Trellis`; relative `.trellis/...` lookups in PowerShell
  resolve to the (nonexistent) `D:\MyHarness\.trellis\tasks\...`.
- Glob with an absolute subproject path DOES find the task dir
  `D:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke\` (21 files),
  and `task.json` confirms `id: subagent-smoke`. So the absolute-path
  anchor itself is correct; the failure is the missing env var / cwd
  inheritance, not the anchoring logic.

=> The `Selected task:` absolute-line anchor design is sound, but the
subagent environment does not inherit `TRELLIS_CONTEXT_ID`, so the
resolver cannot resolve without an explicit `select` or pre-set env var.
Path-anchoring contract partially upheld (absolute path resolves to
subproject); runtime inheritance contract broken.
