# Cursor subagent dispatch policy

> **Purpose:** Cursor-first guidance for when to spawn Trellis custom agents, which mode to use, and how model choice stays on the Cursor side.

**Abstract policy:** `model_policy: cursor-configured` — Trellis workflow, agents, skills, and hooks **must not** hardcode vendor model IDs in **committed** defaults (`gpt-*`, `claude-*`, etc.).

---

## Quick reference: which entry point am I using?

The same `trellis-*` name can be reached via three entry points with **different model routing**. Identify yours before touching model config:

```
How did I reach trellis-research / trellis-implement / trellis-check?
│
├─ Opened a Cursor chat and @mentioned or /slash-invoked it
│  → Agent session. Top-bar model decides. Cursor Settings for trellis-* are
│    largely ineffective under BYOK. Do NOT expect json5 + Method 2.5 here.
│
├─ Main session dispatched Task(subagent_type=trellis-*)
│  → Task dispatch. ONLY path where BYOK json5 + Method 2.5 applies.
│    Context: CLI Layer 2 pre-embed (primary on Cursor); hook is best-effort
│    (<!-- trellis-hook-injected --> marker; skips if already present).
│
└─ Used the trellis-check SKILL in main session (no subagent spawn)
   → Skill form. Main-session model. Only trellis-check has both
     Agent + Skill forms; research/implement are NOT skills.
```

If unsure: Task dispatch is the path Trellis workflow routes through; Agent session and Skill are manual/edge entry points.

---

## Scene matrix

| Scene                                               | Mechanism                                                      | Mode                                | Output / notes                                                                               |
| --------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------------------------------------------- |
| Code, history, or external research                 | `ttrellis-research`                                             | Cursor **Agent** (writable)         | `{TASK}/research/*.md`; smart-search-cli first, Cursor web fallback per skill                |
| Implementation (after `start-execution --approved`) | `ttrellis-implement`                                            | Agent                               | Code edits; no `git commit` in subagent; **CLI Layer 2** dispatch prompt on Cursor |
| Post-implementation verification                    | `ttrellis-check`                                                | Agent                               | Fixes + `verify.md` / gate hints; **CLI Layer 2** on Cursor; main session records gates |
| Parent/Child child worker                           | `generate-child-prompt --mode subagent`                        | **Parent Task** `trellis-implement` (default) | Child delivers `verify.md` + `handoff.md`; rare per-child model → **new writable Agent** session when user names that child |
| Architecture / deep review                          | `ttrellis-check` or documented inline deep review               | Agent or main session               | Model via dispatch strategy (Methods 1–2.5, 3–4 below)                                               |
| PRD Grill (planning)                                | `trellis-micro-grill` contract **inside** `trellis-brainstorm` | **Not** a subagent                  | Single-question business follow-ups only                                                     |
| Small unclear ask (no task)                         | `trellis-micro-grill` skill                                    | Main session                        | No task artifacts by default                                                                 |

---

## Model dispatch strategy (BYOK-aware)

> **Full technical analysis:** .trellis/spec/guides/cursor-subagent-reverse-engineering-report.md

### Environment detection

| Environment           | Custom Task subagent model control                                                                 | Explore subagent model control                     |
| --------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Native Cursor API** | Frontmatter `model:` works (server-side routing)                                                   | Native model picker                                |
| **Cursor++ BYOK**     | ❌ Frontmatter / Cursor Settings per-agent: not wired for `trellis-*`; **✅ Method 2.5** if applied | ✅ Independent model via Cursor++ panel (v0.0.11+) |

Under Cursor++ BYOK, **committed** agent frontmatter `model:` and **Cursor Settings** UI for `trellis-research` / `trellis-implement` / `trellis-check` do **not** populate `subagentModelOverrides` for those types (verified). Without **Method 2.5**, custom Task subagents **inherit** the parent session BYOK model. See `.trellis/spec/guides/cursor-subagent-reverse-engineering-report.md`.

### Dispatch strategy matrix

| Subagent type                       | Independent model? (BYOK)            | Method                                                                  | Fallback             |
| ----------------------------------- | ------------------------------------ | ----------------------------------------------------------------------- | -------------------- |
| **Explore** (built-in)              | ✅ Yes                               | Cursor++ panel (built-in override row)                                  | Inherit parent model |
| **trellis-research** (custom Task)  | ✅ Yes if **Method 2.5** map applied | **Method 2.5** (machine-local); else Method 1 or **Method 3** (manual) | Inherit parent model |
| **trellis-implement** (custom Task) | ✅ Yes if **Method 2.5** map applied | **Method 2.5**; else Method 1 or **Method 3**                           | Inherit parent model |
| **trellis-check** (custom Task)     | ✅ Yes if **Method 2.5** map applied | **Method 2.5**; else Method 1 or **Method 3**                           | Inherit parent model |
| **generalPurpose** / **shell** / **best-of-n-runner** | ✅ Yes if map includes keys | **Method 2.5 / 2.6** JSON map | Inherit parent model |

### When to ask (and when not)

**Ask** when a subagent dispatch is imminent AND the dispatch method depends on user choice.

**Do not ask** for: planning-only turns, PRD Grill / micro-grill, inline edits in the main session, trellis-check **skill** without spawning the check agent, or any turn where no Trellis subagent will run this round.

Task mode (Lite / Full / Parent) does **not** by itself trigger the question — only **impending subagent dispatch** does.

### Method 1: Inherit (default, zero-friction)

- Custom Task subagents inherit the parent session model.
- No model question asked. No frontmatter edit.
- **Use when:** The parent model is appropriate for the subagent's work, or the user has said "用当前模型派发" / "inherit" / "跟上次一样" in this turn.

### Method 2: Explore subagent with custom model (read-only research)

When research is purely **codebase exploration** (no external web search, no file writing outside exploration scope), dispatch an **Explore subagent** instead of trellis-research. The Explore type gets independent model selection via the Cursor++ panel.

**Constraints:**

- Explore subagent is **read-only** — it cannot Write or Edit files.
- Cannot persist to {TASK}/research/\*.md directly — must return findings in chat, then main session persists.
- Cannot use smart-search-cli or external tools — limited to Glob, Grep, Read, and terminal.

**Use when:** Pure codebase search/understanding tasks where a different model adds value. Main session receives findings and writes the research files.

### Method 2.5: Cursor++ BYOK proxy map (publishable bundle)

**What it is:** A reversible patch to Cursor++ `extension.js` resolver `WPeLc8` that maps `subagentType` → BYOK catalog **slug** (`model-xxxxx`), evaluated **before** the inherit-parent branch. Verified 2026-06-18 (Cursor++ v0.0.11).

**Trellis ships (every `trellis init` / `trellis update`, strategy C):** `.trellis/local/cursor2plus/` — `patch_wpelc8.py`, `README.md`, `config.local.json.example`. Native Cursor API users can ignore this directory.

**Operator workflow (Cursor++ BYOK only):**

1. Fill **`~/.ccursor/trellis-task-models.json`** (user-wide) with `subagent_type` → slug from **`~/.ccursor/providers.json`** `id` fields.
2. Optionally override per repo: **`.trellis/local/subagent-models.json`** (project wins on same key).
3. If paths are not auto-detected: copy `config.local.json.example` → `config.local.json`, or run `python patch_wpelc8.py --bootstrap`, or set `TRELLIS_CCURSOR_HOME` / `TRELLIS_CURSOR2PLUS_EXTENSION`.
4. From `.trellis/local/cursor2plus/`: `python patch_wpelc8.py --print-map` → `python patch_wpelc8.py` → **Developer: Reload Window**.
5. **Verify:** `taskToolCall dispatching` → `resolvedModelId` matches slug.

**Revert:** `python patch_wpelc8.py --revert`; Reload Window. Re-run patch after Cursor / Cursor++ upgrades.

**Cursor++ sidebar / Cursor Settings:** Do **not** wire `trellis-*` BYOK routing; use JSON + patch.

### Method 2.6: Temporary Task types (advanced, BYOK)

For rare per-dispatch models on the Task channel without changing global slots:

1. Add `.cursor/agents/trellis-worker-<id>.md` (role prompt only; no committed `model:`).
2. Add `"trellis-worker-<id>": "model-xxxxx"` to **project** `.trellis/local/subagent-models.json`.
3. Re-run `patch_wpelc8.py`; dispatch `Task(subagent_type=trellis-worker-<id>)`.
4. Remove agent file and JSON key when done.

Parent/Child **default** does not use 2.6 — it uses `trellis-implement` from the user map. Per-child manual model → **new writable Agent** session (user-named exception).

### Method 3: Manual dispatch (different model for Task subagent)

When a custom Task subagent (`trellis-research`, `trellis-implement`, `trellis-check`) needs a **different model** than the parent under BYOK **and Method 2.5 is not available**:

1. **Main session prepares the dispatch prompt** — full text with:
   - First line: Selected task: <path> (e.g. .trellis/tasks/06-17-my-task)
   - Task context from inject-subagent-context.py content (PRD, design, implement docs)
   - Agent role instructions (from the corresponding .cursor/agents/trellis-<role>.md)
   - Specific work assignment
2. **Main session presents the prompt** to the user in a clearly marked block:
   `── Manual Dispatch Prompt ──
Target model: <recommended model>
Agent role: trellis-<role>
── Prompt Start ──
<full prompt text>
── Prompt End ──`
3. **User actions:**
   a. Open a new Cursor chat tab
   b. Select the desired model in the model picker
   c. Paste the prompt and send
   d. Wait for completion
   e. Copy relevant results back to the main session

4. **Main session** receives results from user and integrates them (persists research, reviews implementation, etc.)

**Use when:** The subagent work benefits significantly from a different model's strengths, and the manual overhead is justified.

### Method 4: Ephemeral model overlay (native API only)

Under **native Cursor API** (non-BYOK), frontmatter model: on agent files works for model routing. The original ephemeral overlay mechanism applies:

1. Before dispatch: edit .cursor/agents/trellis-<role>.md frontmatter — add model: <id>.
2. Dispatch the subagent.
3. After dispatch: restore frontmatter — remove model: line.

**Under BYOK: this method does NOT work.** Do not attempt ephemeral overlay in BYOK environments.

### Decision flow

```text
Subagent dispatch needed
├─ Cursor++ BYOK + trellis-* needs fixed per-role models?
│  └─ Method 2.5 applied on this machine? → dispatch Task normally (map handles routing)
├─ Parent model appropriate for trellis-*? → Method 1 (inherit)
├─ Read-only codebase exploration only? → Method 2 (Explore + Cursor++ panel)
├─ Native Cursor API (non-BYOK)? → Method 4 (ephemeral frontmatter overlay)
└─ BYOK, no Method 2.5, different model required? → Method 3 (manual dispatch)
```

### Main-session contract

When a dispatch is imminent:

1. Assess which method applies based on the decision flow.
2. If **Method 2.5** is active on this machine: dispatch `trellis-research` / `trellis-implement` / `trellis-check` via Task tool as usual — **do not** ask model each time; **do not** edit agent frontmatter.
3. If Method 1 (inherit): dispatch directly, no model question.
4. If Method 2 (Explore): set Explore model in Cursor++ panel if needed, dispatch `explore`.
5. If Method 3 (manual): prepare the full dispatch prompt, present to user.
6. If Method 4 (overlay, native API): ask model preference, apply overlay, dispatch, restore.

### Rules

- **Never** commit long-lived model: in shared Trellis templates or team repo defaults.
- **Never** inject model IDs via hooks (inject-subagent-context.py stays task-only).
- **Do not** attempt ephemeral model overlay under BYOK — it silently fails for routing (Method 4).
- **Do not** rely on Cursor Settings per `trellis-*` agent for BYOK routing — use Method 2.5 map or Method 3.
- Method 2.5 map lives **outside** committed Trellis templates (machine-local); never commit patched `extension.js` into the Trellis repo.
- **Do not** assume Explore subagent can replace trellis-research for all scenarios — it is read-only and cannot persist files.
- Workflow and skills **must not** hardcode vendor model IDs.

### Child worker

- **Default (BYOK + map):** Parent session dispatches **Task** `trellis-implement` with prompt from `generate-child-prompt --mode subagent`; model from user/project JSON map.
- **Exception:** User or `child-prompts.md` names a child for **separate writable Agent** → new chat, manual model, paste prompt (Method 3).
- **Native API:** ephemeral overlay on `trellis-implement` (Method 4) still valid.

### Technical note

Client layer still only builds override rows for built-in types such as `explore`. Cursor Settings entries for custom agent **names** do not reach the BYOK proxy override list for `trellis-*`. **Method 2.5** patches Cursor++ `WPeLc8` so `taskToolCall` sets `resolvedModelId` from a local `subagentType → slug` table before inherit-parent. **Method 3** bypasses Task routing (user picks model in a new chat).

---


## Trellis workflow: using per-agent models (BYOK + Method 2.5)

Operational contract between the Trellis task ladder and Cursor++ BYOK.

### Roles and who picks the model

| Layer | Picks model for… | Mechanism |
| ----- | ---------------- | --------- |
| **You (operator)** | Main orchestration chat | Cursor model picker (parent BYOK route) |
| **You (operator)** | `trellis-research` / `trellis-implement` / `trellis-check` (+ optional built-in Task types) | **Method 2.5 / 2.6** JSON maps + `.trellis/local/cursor2plus/patch_wpelc8.py` — **not** repo agent files |
| **You (operator)** | `explore` | Cursor++ panel |
| **Main Agent session** | When to spawn which agent | `workflow.md`, skills, scene matrix |
| **Hooks** | Never | `inject-subagent-context.py` — task context only |

### Normal Full / Lite task flow

1. **Select task** — `task.py select`; dispatch prompts include `Selected task: .trellis/tasks/<id>` when hooks need it.
2. **Main session model** — your choice for planning and orchestration.
3. **Research** — Task `subagent_type=trellis-research` → mapped research slug (Method 2.5).
4. **Implement** — after `start-execution --approved`, Task `trellis-implement` → mapped implement slug.
5. **Check** — Task `trellis-check` → mapped check slug.
6. **Gates / finish** — main session `record-gate`, `trellis-finish-work`.

No model field in dispatch prompt under Method 2.5. Task `model: fast` does **not** override custom types under BYOK.

### When to use which method

| Setup | Research | Implement | Check |
| ----- | -------- | --------- | ----- |
| Method 2.5 configured | `trellis-research` Task | `trellis-implement` Task | `trellis-check` Task |
| No map; one parent model | Task (inherit) | Task (inherit) | Task (inherit) |
| No map; different models | Method 3 | Method 3 | Method 3 |
| Repo read-only only | Method 2 Explore | — | — |

### Parent/Child

- **Default:** Parent dispatches **Task** `trellis-implement` (BYOK map applies to `subagentType`).
- **Rare per-child model:** new writable Agent session when user names that child — not a separate Trellis subagent type by default.
- Parent retains `review-child` / `integrate-child`; serial integration and worktree rules unchanged.

### Maintainer checklist (BYOK)

1. Resolve slugs in `~/.ccursor/providers.json` (or path in `config.local.json`).
2. Edit user and/or project JSON maps; include `generalPurpose`, `shell`, `best-of-n-runner` if you use those Task types.
3. Run `patch_wpelc8.py` from `.trellis/local/cursor2plus/` → Reload Window.
4. Re-apply after Cursor / Cursor++ upgrades.

### What stays in the Trellis repo

- `.cursor/agents/trellis-*.md` — no committed `model:`; link to this policy.
- Skills/workflow — **which** agent to spawn, not BYOK slugs.

---

## Model and reuse (baseline)

- **Baseline:** `.cursor/agents/trellis-*.md` in repo have **no** `model:` → **inherit** parent Agent session model when no overlay is applied.
- **`preToolUse` (Task/Subagent):** injects task context only (`inject-subagent-context.py`). Never inject model IDs.

Optional team paste (comments only — not Cursor product settings):

```yaml
model_policy: cursor-configured
dispatch_model: inherit_or_method25_or_manual
child_worker:
  mode: separate_writable_agent_session
explore_subagent:
  model: independent # Cursor++ panel
trellis_task_subagents:
  model: method_2_5_proxy_map # machine-local; not in git
```

---

## Hooks (Cursor)

| Event                      | Role                                                                    |
| -------------------------- | ----------------------------------------------------------------------- |
| `sessionStart`             | Task dashboard, phase index, next-action                                |
| `preToolUse` Task/Subagent | PRD/jsonl + `<!-- trellis-hook-injected -->`                            |
| `beforeShellExecution`     | Short-lived ticket for `task.py select` / `selected` / `exit` in shells |
| `stop`                     | Optional `retrieval-pack-latest.json` when task has `research/`         |

**Per-turn workflow-state on Cursor:** deferred — use `sessionStart` + `/trellis-continue` / `get_context.py --mode phase` instead of Claude `UserPromptSubmit` injection.

---

## Parent/Child alignment

- `generate-child-prompt --mode subagent` → Parent **Task** `trellis-implement` by default; inline mode remains the portable default for non-Cursor platforms.
- Child workers call `task.py set-child-state <parent> <child> <open|working|blocked|review> --evidence <ref>` — **no** session identity required for this command.
- Integration states (`accepted`, `integrating`, `integrated`, …) are **Parent-only** via `integrate-child` / `review-child`.

---

## Anti-patterns

- Do not use generic `generalPurpose` / default agents for Trellis research, implement, or check.
- Do not spawn `ttrellis-implement` from inside `ttrellis-implement` (recursion guard in agent defs).
- Do not spawn a subagent for PRD Grill — use brainstorm Phase B + micro-grill contract.
- Do not leave `model:` on agent files after dispatch (always restore).

---

## Maintainer: subagent missing task context (Cursor)

If a dispatched subagent cannot answer from `prd.md` / jsonl (empty or generic replies):

1. Confirm the main session used **CLI Layer 2** before `Task(...)` (workflow Phase 2.1 / 2.2).
2. **Manual fallback (Method 3):** run `python ./.trellis/scripts/task.py generate-dispatch-prompt <task-dir> <role> [--scope "..."]`, paste stdout into `Task(subagent_type=..., prompt=...)`.
3. Hook-only injection is best-effort on Cursor; do not treat `preToolUse` as the sole source.

This command is **Agent-facing** — not listed in user README or slash command surface.

---

## Hook fallback (no selected-task pointer)

When `preToolUse` cannot resolve a selected task, the subagent should read **`Selected task:`** from the first line of its dispatch prompt, then load `implement.jsonl` / `check.jsonl`, `prd.md`, `design.md`, and `implement.md` manually. Trellis does **not** document or depend on Cursor `/multitask` for workflow orchestration.

## Cursor++ (BYOK) compatibility

[Cursor++](https://ccursor.cometix.dev) (ccursor by cometix) is a third-party Patch that intercepts Cursor API traffic via a local server (`127.0.0.1:39831`). It does **not** modify `.cursor/` files — it intercepts at the API/gRPC layer (`AgentService/RunSSE`, `AvailableModels`, etc.) and routes requests to BYOK providers.

### Confirmed compatibility (v0.0.11+, Cursor 3.7.27)

Verified by local testing on `D:\MyHarness` workspace:

| Trellis component     | Status under Cursor++ | Evidence                                                                            |
| --------------------- | --------------------- | ----------------------------------------------------------------------------------- |
| `.cursor/agents/`     | Normal                | Agent files not intercepted; `model:` frontmatter read by Cursor at spawn           |
| `.cursor/hooks/`      | Normal                | Agent log `requestContextKeys` contains `hooksConfig`                               |
| `.cursor/skills/`     | Normal                | Agent log `requestContextKeys` contains `agentSkills`                               |
| `.cursor/mcp.json`    | Normal                | 4+ MCP servers, 300+ tools load normally                                            |
| SubAgent write access | **Fixed in v0.0.11**  | Prior versions defaulted SubAgent to readonly; `ttrellis-implement` now writes files |

**Minimum version: v0.0.11.** Earlier versions break `ttrellis-implement` due to SubAgent readonly bug.

### Model routing under BYOK (verified 2026-06-18)

- **Explore subagent:** Independent model selection works via Cursor++ panel (v0.0.11+). Cursor++ intercepts and routes the selected BYOK model for Explore-type requests.
- **Custom Task subagents:** Frontmatter `model:` and Cursor Settings per-agent names are **not** applied for `trellis-*` BYOK routing. Use **Method 2.5** or **Method 3**. **Explore** uses Cursor++ panel.
- The `model:` ID **must match** a model configured in Cursor++ provider settings (`~/.ccursor/providers.json`). If it doesn't match, the request will fail with a provider error.
- Cursor++ intercepts `AvailableModels`/`GetDefaultModel` - the model picker and model list are determined by BYOK provider config, not Cursor's official model catalog.
- Under Cursor++, "inherit" means the parent session's BYOK-routed model, which may differ from what the Cursor UI label suggests.
- **Full technical analysis:** `.trellis/spec/guides/cursor-subagent-reverse-engineering-report.md`

### Safety boundary

- Cursor++ patches Cursor internal modules at runtime. Strongest recovery: reinstall Cursor.
- API keys are stored in **plaintext** in `~/.ccursor/providers.json` — restrict file permissions (`chmod 600` / Windows ACL).
- Cursor++ stores rules in `~/.ccursor/knowledge-base.json`, independent of `.cursor/rules/` and Trellis rules.
- Version updates lag behind Cursor releases — after a Cursor update, BYOK routing may break until Cursor++ catches up. Trellis hooks/agents/skills survive the window (they don't depend on API routing).
- Do not mix Cursor++ BYOK sessions with Cursor official sessions — they cannot be continued across each other.
- Cursor++ may violate Cursor ToS; use at own risk. Not recommended for enterprise/compliance environments.

### Anti-patterns for Cursor++

- Do not use Cursor++ older than v0.0.11 with Trellis (SubAgent readonly bug).
- Do not assume Cursor official model IDs work under BYOK — use model IDs from your provider config.
- Do not mix Cursor++ and Cursor official sessions for the same conversation.

## Worktree template

When Parent/Child children use `isolation: git-worktree`, configure `.cursor/worktrees.json` and `task.py prepare-child-worktree` so each child edits in an isolated Git checkout:

```json
{
  "setup-worktree": ["<install-command>"],
  "setup-worktree-unix": ["<install-command>"],
  "setup-worktree-windows": ["<install-command>"]
}
```

Replace `<install-command>` with the project's dependency install command (e.g. `pnpm install --frozen-lockfile`, `npm ci`, `pip install -e .`). Platform-specific keys (`setup-worktree-unix`, `setup-worktree-windows`) are optional; `setup-worktree` is the cross-platform fallback.

For multi-package workspaces, list all install commands needed after a fresh checkout.

## References

- `.cursor/agents/ttrellis-research.md`, `ttrellis-implement.md`, `ttrellis-check.md`
- `.cursor/agents/.trellis-model-overlay.local.md` — optional overlay audit stub (native API)
- Reference `patch_wpelc8.py` in task `06-18-byok-manual-dispatch-automation/research/` — copy locally; not a runtime git dependency
- `.trellis/workflow.md` — Task Ladder + Parent orchestration
- [Cursor Subagents](https://cursor.com/docs/subagents) — `model: inherit | <id>`
- [Cursor Multitask changelog](https://cursor.com/changelog/04-24-26) — `/multitask`, Worktrees, Multi-root Workspaces
- `.cursor/worktrees.json` — Cursor native worktree setup configuration
