# Platform Task-Artifact Context Audit

Audit of beta (`feat/v0.6.0-beta`) platform templates / spec / tests against the
task-artifact contract:

- `prd.md` — requirements artifact (always created).
- `design.md` — technical design for complex tasks.
- `implement.md` — execution plan for complex tasks.
- `implement.jsonl` / `check.jsonl` — spec/research manifests, **not** a replacement for `implement.md`.

## TL;DR

The contract is fully landed in the **runtime injectors** (shared hook, Pi
extension, OpenCode plugin), the **workflow SOT** (`workflow.md`), the **spec**,
and all **codex skills / copilot prompts**. There is **no `info.md` reference
left anywhere** in active templates.

The drift is concentrated in **agent card bodies** — specifically the
`trellis-check` cards on every platform, plus both Pi agent cards. The
`design.md` / `implement.md` migration updated the `trellis-implement` card
bodies but **never updated the `trellis-check` card bodies**.

---

## 1. Real drift in active source templates

### D1 — All 7 `trellis-check` agent cards omit positive task-artifact review instructions  ★ main finding

Files:
- `packages/cli/src/templates/claude/agents/trellis-check.md`
- `packages/cli/src/templates/cursor/agents/trellis-check.md`
- `packages/cli/src/templates/codebuddy/agents/trellis-check.md`
- `packages/cli/src/templates/opencode/agents/trellis-check.md`
- `packages/cli/src/templates/droid/droids/trellis-check.md`
- `packages/cli/src/templates/gemini/agents/trellis-check.md`
- `packages/cli/src/templates/qoder/agents/trellis-check.md`

In every one, the `## Context`, `## Core Responsibilities`, and
`## Workflow → Step 2` sections reference only `.trellis/spec/` + "Pre-commit
checklist". None of them tell the agent to review changes against `prd.md`,
`design.md`, or `implement.md`.

Contrast: the matching `trellis-implement` cards on the same platforms **were**
migrated — they carry:
- `## Context` → `Task prd.md` / `Task design.md (if exists)` / `Task implement.md (if exists)`
- Core Responsibilities item 2 → "Understand task artifacts - Read prd.md, design.md if present, and implement.md if present"
- Workflow step 2 → "Read the task's prd.md, design.md if present, and implement.md if present"

And `workflow.md` Phase 2.2 explicitly says the check agent must "Review code
changes against `prd.md`, `design.md` if present, and `implement.md` if
present". The check cards contradict / under-specify the SOT.

For the 5 hook platforms (claude/cursor/codebuddy/opencode/droid) the only
place the check card mentions the artifacts is the `Trellis Context Loading
Protocol` *marker-absent fallback* line — i.e. the artifacts are named only on
the degraded path, never as the primary instruction.

### D2 — `gemini` + `qoder` `trellis-check.md` have *zero* task-artifact references  ★ most severe instance of D1

`gemini/agents/trellis-check.md` and `qoder/agents/trellis-check.md` additionally
lack the `## Trellis Context Loading Protocol` section entirely (gemini/qoder
agent cards intentionally don't carry the hook marker — they're excluded from
the `CLASS1_MD_AGENT_FILES` test list). Result: these two check cards never
mention `prd.md` / `design.md` / `implement.md` anywhere. Their sibling
*implement* cards at least list all three in `## Context`, so the check cards
are strictly worse off than implement on the same platform.

### D3 — `pi/agents/trellis-implement.md` Core Responsibilities references only `implement.jsonl`

`packages/cli/src/templates/pi/agents/trellis-implement.md` — terse card; its
`## Core Responsibilities` item 2 says "Read and follow the spec and research
files listed in the task's `implement.jsonl`" and never mentions `prd.md` /
`design.md` / `implement.md`.

Mitigation (not a fix): the Pi extension `buildTrellisContext()` in
`index.ts.txt` *does* inject `prd.md` + `design.md` + `implement.md` into the
prompt, so the Pi agent still receives them. But the card text is inconsistent
with every other implement card and with `workflow.md`.

### D4 — `pi/agents/trellis-check.md` Core Responsibilities omits `design.md` / `implement.md`

`packages/cli/src/templates/pi/agents/trellis-check.md` — `## Core
Responsibilities` references `check.jsonl` + "the task PRD" but not `design.md`
or `implement.md`. Same mitigation/inconsistency note as D3.

### D5 (low confidence) — `kiro/agents/trellis-check.json`

The kiro check JSON `prompt` contains `design.md` / `implement.md` exactly once
(the marker-absent fallback line, confirmed by grep). It very likely shares the
D1 gap — no positive "review against task artifacts" instruction in the prompt
body — but the long single-line JSON wasn't fully expanded in this pass. Verify
when fixing D1.

---

## 2. Verified NOT drift (already migrated — leave alone)

| Area | File(s) | State |
|---|---|---|
| Workflow SOT | `trellis/workflow.md` | Fully migrated — Planning Artifacts, Phase 1.1/1.5, Phase 2.1/2.2, `[workflow-state:*]` blocks all reference prd/design/implement; jsonl explicitly "do not replace implement.md". |
| Shared hook | `shared-hooks/inject-subagent-context.py` | Fully migrated — `get_implement_context` / `get_check_context` / `get_finish_context` all read `prd.md` + `design.md` + `implement.md`; docstring + `build_*_prompt` texts updated. |
| Pi extension (source template) | `pi/extensions/trellis/index.ts.txt` | Fully migrated — `buildTrellisContext()` reads `prd.md` / `design.md` / `implement.md`; no `info.md`. |
| Spec | `.trellis/spec/cli/backend/platform-integration.md` | Fully migrated — task-planning section, lifecycle, contract matrix, validation matrix, "context order" rows all use prd/design/implement; jsonl-not-a-replacement stated. |
| Codex skills | `codex/skills/{brainstorm,before-dev,check,start,onboard,finish-work}/SKILL.md` | Fully migrated. |
| Copilot prompts | `copilot/prompts/{brainstorm,before-dev,check,start,onboard,finish-work,parallel}.prompt.md` | Fully migrated. |
| Implement cards (non-Pi) | claude/cursor/codebuddy/opencode/droid/gemini/qoder `trellis-implement.md` | Migrated (carry the `## Context` artifact list + Core Responsibilities + Workflow step). |
| Codex agent tomls | `codex/agents/trellis-{implement,check}.toml` | Migrated — both say "Read the task's `prd.md`, then `design.md` if present, then `implement.md` if present". |
| `info.md` | (everywhere) | No occurrences in any active template. |

Minor non-issue (not drift): `codex/skills/finish-work/SKILL.md` and
`copilot/prompts/finish-work.prompt.md` list `prd.md` / `implement.jsonl` /
`check.jsonl` as the task-path *detection* heuristic (which files mark a dir as
a task), omitting design/implement. That's a "which dir is a task" detector,
not a context contract — `prd.md` always exists, so it's sufficient. Leave it.

---

## 3. Files to change + tests to add/update

### Source templates to change (production — NOT done in this research task)

1. `claude/agents/trellis-check.md`
2. `cursor/agents/trellis-check.md`
3. `codebuddy/agents/trellis-check.md`
4. `opencode/agents/trellis-check.md`
5. `droid/droids/trellis-check.md`
6. `gemini/agents/trellis-check.md`
7. `qoder/agents/trellis-check.md`
8. `kiro/agents/trellis-check.json` (verify D5 first)
9. `pi/agents/trellis-implement.md`
10. `pi/agents/trellis-check.md`

**SOT discipline:** there is no codegen SOT for agent-card bodies — they are
hand-maintained parallel files that already drift in style (Family A "verbose"
cards vs. Pi "terse" cards). Do **not** invent new per-platform wording. The fix
is to **mirror the wording the sibling `trellis-implement` card on the same
platform already uses** into the `trellis-check` card:
- Family A check cards (1–7): add the three artifacts to `## Context`, add a
  Core Responsibilities item ("Review against task artifacts — prd.md, design.md
  if present, implement.md if present"), and extend Workflow Step 2.
- Pi cards (9–10): add `prd.md` / `design.md` / `implement.md` to the
  `## Core Responsibilities` list, matching the terse-card style.

### Tests to add/update (`packages/cli/test/regression.test.ts`)

- **`CLASS1_MD_AGENT_FILES` content test (~line 5522)** — currently asserts only
  `content.toContain("prd.md")`. Extend to also assert `design.md` and
  `implement.md` for **both** implement and check agents. This test is exactly
  why D1 slipped through — it would have caught it.
- **kiro JSON test (~line 5538)** — currently asserts only `prd.md`; extend to
  `design.md` / `implement.md`.
- **New content test for gemini/qoder agent cards** — they're not in
  `CLASS1_MD_AGENT_FILES` and no existing test asserts they reference the task
  artifacts. Add a small test asserting all four gemini/qoder
  implement+check cards mention `prd.md` / `design.md` / `implement.md`.
- **New content test for Pi agent cards** — assert
  `pi/agents/trellis-{implement,check}.md` reference `prd.md` / `design.md` /
  `implement.md`.

Existing tests already locking the contract elsewhere (keep, they pass):
`regression.test.ts:2362/2439-2441` (hook context), `:3747` (`{TASK_DIR}/prd.md`),
`codex.test.ts:116`, `shared-hooks.test.ts:136`.

---

## 4. PR #281 review guidance

PR #281 metadata: `title: feat(extensions): 新增子代理实时进度显示与结果覆层`,
`baseRefName: main`, `headRefName: main`, **changes exactly one file:
`.pi/extensions/trellis/index.ts`** (+1284 / −54).

Key facts:
- `.pi/extensions/trellis/index.ts` is the **generated / distributed local
  file**. The **source template** is
  `packages/cli/src/templates/pi/extensions/trellis/index.ts.txt`. `trellis
  update` / `trellis init` regenerate the former from the latter.
- PR #281 bundles **three distinct changes** into the generated file:
  - **(a) `info.md` → `design.md` / `implement.md` migration** in
    `buildTrellisContext()`. This is **already done on `feat/v0.6.0-beta`** in
    the `.txt` source template. On beta this part of #281 is redundant; relative
    to `main` it's a legitimate forward-port — but it's editing the generated
    artifact, not the SOT.
  - **(b) the live subagent progress widget + result overlay feature**
    (~1200 new lines: `LiveWidgetState`, `SubagentRunState`, grapheme/width
    helpers, `setWidget`/`custom` UI surface, throttled progress callbacks).
    This is **new** — not present on beta, in source or generated form.
  - **(c) Pi CLI package-name probe update** `@mariozechner` →
    `@earendil-works` (`PI_CLI_JS_SEGMENTS` → `PI_CLI_JS_SEGMENTS_LIST`). This
    is a real fix and is **also missing from beta's `.txt` source template**
    (beta still only probes `@mariozechner`).

Recommendation:
1. **Do not merge #281 as-is.** It edits a generated artifact; the next
   `trellis update` / `init` will overwrite the widget feature and the
   package-name fix. Changes (b) and (c) must be ported into the SOT
   `packages/cli/src/templates/pi/extensions/trellis/index.ts.txt`, then the
   generated `.pi/extensions/trellis/index.ts` regenerated from it.
2. **Drop / rebase change (a).** The `info.md` → `design.md`/`implement.md`
   migration is already in beta's source template. If #281 must land on `main`
   independently of beta, keep (a) only as the minimal artifact-migration lines
   and confirm the wording matches beta's `index.ts.txt` `buildTrellisContext()`
   verbatim, so beta merging into main later is a clean no-op rather than a
   conflict.
3. **Treat (b) the widget feature as the actual payload of #281** and review it
   on its own merits — but require it to land in the `.txt` template. Its size
   (~1200 lines) and the new `PiExtensionContext.ui` surface also warrant
   checking whether the Pi extension contract / `platform-integration.md`
   ("Class-3 injection points") needs a doc update.
4. **(c) is independently worth landing on beta** regardless of #281's fate —
   beta's source template is missing the `@earendil-works` Pi package probe.

Net: #281's artifact-context portion is *duplicated* beta work applied to the
wrong (generated) layer; its real new value (the widget) and an unrelated
package-name fix both need to be relocated to the source template before
anything merges.
