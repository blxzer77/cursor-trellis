# Cursor platform limitations and cursor-trellis adaptation (users & developers)

[简体中文](cursor-platform-limitations-and-trellis-adaptation.zh-CN.md)

> **Document type**: Standalone guide for end users and contributors.  
> **Last reviewed**: 2026-06-26  
> **Evidence**: Cursor official docs/blogs, community forum threads, this repo’s local tests, and six successful Trellis-wrapped smart-search deep-research runs (2026-06-25).  
> **Honesty note**: Cursor and Cursor++ change quickly. This describes **verified behavior today**. If your version differs, use the checklists below to re-test.

---

## What this document is for

When you use **cursor-trellis** (the CLI and templates that run the Trellis workflow inside Cursor), you may see:

- Hooks run successfully, but the Agent ignores your workflow text;
- Under **Cursor++ (bring your own API key / model)**, research / implement / check subtasks do not switch models as expected;
- Retrieval plans mention “semantic search,” but the Agent keeps doing text search only;
- Unclear whether **Cursor Native (official subscription)** and **Cursor++** should share the same configuration.

This guide is split into four parts (plain language, minimal internal jargon):

1. **Reported Cursor platform issues** (with external links)
2. **Cursor Native**: what breaks for cursor-trellis, how we mitigate it, what you should do step by step
3. **Cursor++ BYOK**: same structure
4. **Remaining gaps** (platform + cursor-trellis)

Day-to-day integration: [Cursor integration](cursor.md). Subagent dispatch details: [Subagent dispatch](subagents.md).

---

## Two environments you must distinguish

| Name | Meaning | How to tell |
| --- | --- | --- |
| **Cursor Native** | Official Cursor models and API path (typical Cursor subscription). | No Cursor++ / no `TRELLIS_CURSOR_BYOK=1`. |
| **Cursor++ BYOK** | **Cursor++** (community name: ccursor) routes requests through your own API keys and providers. Config usually under `~/.ccursor/`. | `~/.ccursor/providers.json` exists, or `routes.json` has `byokMode`, or `TRELLIS_CURSOR_BYOK=1`. |

In both environments, `.cursor/agents`, `.cursor/hooks`, and `.cursor/rules` in your project **usually still load**. Differences matter for: **which model subtasks use**, **whether built-in semantic search is available to the Agent**, and **whether an optional local patch is needed**.

Initialize:

```bash
npm install -g @blxzer/cursor-trellis
cd /path/to/your-project
trellis init --cursor

# Only if you use Cursor++ and need fixed per-role models:
trellis init --cursor --cursor2plus
```

---

## Part 1: Reported Cursor platform issues

These are **Cursor or community-reported behaviors**, not bugs cursor-trellis can fix alone. cursor-trellis works around them with rules files, CLI-generated dispatch text, and environment-specific routing.

### 1. Hook `additional_context` may not reach the Agent

**What users see**

- `sessionStart` or `postToolUse` hooks return large `additional_context` blocks (e.g. full workflow).
- Logs show success, but the **Agent does not follow that content**.

**Why it matters**

- If “must triage every request” or “must follow retrieval plan” exists **only** in hook injection, the Agent may skip it every turn.

**External evidence (Cursor forum)**

- [sessionStart: additional_context never enters initial Agent context #158452](https://forum.cursor.com/t/sessionstart-hook-additional-context-is-never-injected-into-agents-initial-system-context/158452)
- [sessionStart: merged but not shown in Agent window #157141](https://forum.cursor.com/t/sessionstart-hook-output-is-accepted-and-merged-but-the-injected-context-does-not-reach-agent-window/157141)
- [postToolUse: additional_context not injected #156157](https://forum.cursor.com/t/cursor-hooks-additional-context-not-injected-in-agent-context-in-posttooluse/156157)
- [Cursor Hooks documentation](https://cursor.com/docs/hooks) (hooks exist; does not prove the above bugs are fixed)

**What cursor-trellis does**

- Hooks are **best-effort** helpers (terminal session, retrieval plan blocks, etc.).
- **Mandatory every-turn rules** live in `.cursor/rules/*.mdc` (`alwaysApply: true`) and `AGENTS.md`, not only in hooks.

---

### 2. Custom subagents (Task tool) and model routing

**What users see**

- You set models for `trellis-research`, `trellis-implement`, `trellis-check`, or use Cursor Settings “per-agent model.”
- Subtasks still **inherit the parent session model**.

**External evidence**

- [SubAgent Task ignores type-specific model routing #151917](https://forum.cursor.com/t/subagent-task-tool-ignores-model-specific-subagent-type-routing-all-subagents-inherit-parent-model-instead-of-using-their-designated-models-opus-codex/151917)
- [Cursor 2.4 changelog: Subagents, Skills](https://cursor.com/changelog/2-4)

Native vs BYOK split: Parts 2 and 3 below.

---

### 3. Code retrieval: strong literal search; semantic and LSP are hard to promise for Agents

**Literal search**

- Cursor official post on fast regex indexing for agent tools: [Fast regex search](https://cursor.com/blog/fast-regex-search)

**Semantic search (@codebase, etc.)**

- Product narrative includes semantic/codebase search, but **whether the Agent actually calls it and whether you can observe it** varies by version and environment.
- cursor-trellis may **suggest** built-in semantic on Native in retrieval plans, with an explicit caveat: **plan ≠ verified execution**.

**LSP (go to definition, find references)**

- Usually fine in the editor; **do not promise** stable LSP tools on every Agent turn.
- Prefer exact search + read files; use project index tools (e.g. codegraph) for call relationships when configured.

---

### 4. Cursor++ is a third-party layer, not an official Cursor API

- Cursor++ routes at the **API layer** and generally **does not block** loading `.cursor/` agents/hooks/rules.
- Under BYOK, agent file `model:` frontmatter and Cursor Settings “per-agent model” **often fail** for custom `trellis-*` Task subagents (local E2E + community reports).
- Fixed per-role BYOK models require an **optional, user-approved local patch** (Part 3)—**not** a default install step.
- Patches touch installed Cursor/Cursor++ files and may break on upgrade; `~/.ccursor/` may contain API keys—**never commit or publish** those files.

---

### 5. Automations / SDK: evolving, not Trellis default workflow

- [Build agents that run automatically (Cursor blog)](https://cursor.com/blog/automations)
- We track this; **Trellis default workflow does not depend on Automations** until a separate design and safety review exists.

---

### 6. Hooks and security (separate from injection bugs)

- Community discussion of Agent + Git hook risks, e.g. [Hackread article](https://hackread.com/cursor-ai-ide-vulnerability-code-execution-git-hooks)
- Use hooks only in trusted repos; review `.cursor/hooks/` changes.

---

## Part 2: Cursor Native

### 2.1 Common problems

| Problem | Symptom | Platform cause |
| --- | --- | --- |
| Triage / workflow skipped | Agent edits code without classifying the request | Unreliable hook `additional_context` (§1) |
| Thin subtask context | implement agent unaware of prd/design | Task prompt too short |
| Retrieval mismatch | Plan says semantic, run is all Grep | Agent semantic tools not observable (§3) |
| Noisy slash palette | Wrong internal skills invoked | Too many exposed entries |

### 2.2 cursor-trellis mitigations

| Measure | Explanation |
| --- | --- |
| Always-on rules | `trellis-triage.mdc`, `retrieval-routing.mdc`, `alwaysApply: true` |
| AGENTS.md | Project layout, smart-search-first for external facts, remote policy |
| Small slash surface | `/trellis-continue`, `/trellis-finish-work`; no default `.cursor/skills/` dump |
| **CLI full dispatch prompt** | Before research/implement/check Task dispatch, run `generate_dispatch_prompt.py`, paste **entire output** into Task `prompt`. **This is the reliable primary path** for subtask context. |
| Hooks demoted | sessionStart helper; beforeSubmitPrompt may inject retrieval plan; hooks do not carry hard gates alone |
| Native semantic | Plans may suggest Cursor built-in semantic; distinguish plan vs execution |

### 2.3 Recommended steps (Native)

**A. Initialize**

```bash
trellis init --cursor
```

Confirm `.trellis/workflow.md`, `.cursor/rules/trellis-triage.mdc`, `.cursor/agents/trellis-*.md`.

**B. Triage**

Rules require a classification line at the start of replies; do not rely on hook-injected workflow alone.

**C. Dispatch subtasks (critical)**

```bash
python ./.trellis/scripts/generate_dispatch_prompt.py --agent research --task ".trellis/tasks/your-task-dir"
```

Use `--agent implement` or `check`. Copy the **full** output; in Cursor Task set `subagent_type` to `trellis-research` (etc.) and paste into `prompt`.  
**Do not** assume `preToolUse` always injects the same payload.

**D. Temporary subtask model (Native only; revert after)**

Add `model: <id>` to the agent file frontmatter, dispatch, then remove the line before committing.

**E. External facts**

```bash
python ./.trellis/scripts/run_smart_search.py "your question" --intent deep-research --json
```

Use other web search only when smart-search is unavailable.

---

## Part 3: Cursor++ BYOK

### 3.1 Extra problems (on top of Native)

| Problem | Symptom |
| --- | --- |
| Subagent model follows parent | Cannot use model A for research and B for implement |
| frontmatter `model:` ignored | Editing agent file does not help |
| Cursor Settings per-agent model ignored | Logs still show inherit parent |
| No built-in @codebase semantic | Plans that assume built-in semantic fail |
| Patch breaks on upgrade | Models revert to inherit after updates |

### 3.2 cursor-trellis mitigations

| Measure | Explanation |
| --- | --- |
| Env detection | `TRELLIS_CURSOR_BYOK` or `~/.ccursor/routes.json` |
| BYOK semantic | Retrieval plans use **fast-context MCP** (`fast_context_search`), not built-in semantic |
| Optional bundle | `trellis init --cursor --cursor2plus` → `.trellis/local/cursor2plus/` |
| Subtask context | Same as Native: CLI dispatch prompt is primary |
| Mapping files | `~/.ccursor/trellis-task-models.json5` or `.trellis/local/subagent-models.json` |
| Optional patch | `patch_wpelc8.py` only with your explicit consent |

### 3.3 Recommended steps (BYOK)

**1. Initialize**

```bash
trellis init --cursor --cursor2plus
```

Native users can ignore the entire `cursor2plus` directory.

**2. Configure mapping (preview first)**

Edit `~/.ccursor/trellis-task-models.json5` (slugs from `providers.json` `id` fields—**do not publish that file**):

```json5
{
  "trellis-research": "model-xxx",
  "trellis-implement": "model-yyy",
  "trellis-check": "model-zzz"
}
```

```bash
cd .trellis/local/cursor2plus
python patch_wpelc8.py --print-map
```

**3. Apply patch (high risk; your consent required)**

```bash
python patch_wpelc8.py
```

Then **Developer: Reload Window**. Dispatch a test Task; subagent should report a different model than parent when slugs differ.

**4. After upgrades**

Re-run print-map / patch, or `python patch_wpelc8.py --revert` and reload.

**5. Without patching**

| Option | When |
| --- | --- |
| Inherit parent model | One model is enough |
| Explore subagent | Read-only exploration; pick model in Cursor++ panel |
| Manual dispatch | New chat, pick model, paste CLI dispatch prompt |

Slash command `/trellis-cursor2plus-setup` can guide setup.

---

## Part 4: Remaining gaps

### 4.1 Platform

- Hook injection issues affect any product that depends on them until Cursor fixes them.
- Subagent model routing complaints continue; watch changelog.
- Hard to prove Agent “always ran semantic search.”
- Cursor++ lags Cursor versions; patches go stale.
- Automations vs Trellis task lifecycle not fully designed.

### 4.2 cursor-trellis

| Gap | Direction |
| --- | --- |
| Native frontmatter `model:` E2E on latest Cursor | Dedicated test + doc update |
| Retrieval plan vs execution telemetry | Reports and tests |
| Three subtask entry points confusing | Decision-tree docs |
| `task.py select` fails without session identity | Docs stress `--task` path |
| retrieval-pack consumer chain incomplete | finish/check integration |
| Patch never auto-run | smoke command + setup skill |

### 4.3 Do not tell others

- “Hooks automatically inject workflow into the Agent” — **false**
- “On BYOK, one line `model:` in the agent file switches subtask models” — **usually false**
- “Agent always runs semantic search” — **cannot guarantee**
- “Patching is required for `trellis init`” — **false**

---

## Part 5: Self-check checklist

**After each `trellis update`**

- [ ] `trellis-triage.mdc` exists with `alwaysApply: true`
- [ ] Subtask dispatch uses full `generate_dispatch_prompt.py` output

**Native**

- [ ] No accidental Cursor++ patch
- [ ] External facts via smart-search first

**BYOK**

- [ ] Retrieval uses fast-context, not built-in @codebase
- [ ] After upgrades, verify patch; never leak `providers.json`

---

## Part 6: External evidence links

| Topic | Link |
| --- | --- |
| sessionStart #158452 | https://forum.cursor.com/t/sessionstart-hook-additional-context-is-never-injected-into-agents-initial-system-context/158452 |
| sessionStart #157141 | https://forum.cursor.com/t/sessionstart-hook-output-is-accepted-and-merged-but-the-injected-context-does-not-reach-agent-window/157141 |
| postToolUse #156157 | https://forum.cursor.com/t/cursor-hooks-additional-context-not-injected-in-agent-context-in-posttooluse/156157 |
| Hooks docs | https://cursor.com/docs/hooks |
| SubAgent routing #151917 | https://forum.cursor.com/t/subagent-task-tool-ignores-model-specific-subagent-type-routing-all-subagents-inherit-parent-model-instead-of-using-their-designated-models-opus-codex/151917 |
| Changelog 2.4 | https://cursor.com/changelog/2-4 |
| Fast regex search | https://cursor.com/blog/fast-regex-search |
| Automations | https://cursor.com/blog/automations |

Maintainer traces: harness research task `06-26-cursor-platform-adaptation-research`, smart-search manifests under `20260625t*/manifest.json`.

---

## Related docs

| Doc | Topic |
| --- | --- |
| [cursor.md](cursor.md) | Init and generated files |
| [subagents.md](subagents.md) | Three trellis subagents |
| [retrieval.md](retrieval.md) | Retrieval and Native/BYOK |
| [workflow.md](workflow.md) | Task lifecycle |

**Feedback**: [cursor-trellis Issues](https://github.com/blxzer77/cursor-trellis/issues) (include Cursor version, Native/BYOK, repro steps).

**Document version**: 1.0 (2026-06-26)