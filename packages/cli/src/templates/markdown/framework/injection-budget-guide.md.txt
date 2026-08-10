# Injection Budget Guide

> **Purpose**: Allocate context injection across **reliable Cursor channels** with measurable caps —「完整 = 证据密度」, not unbounded prose.

**Matrix input:** `08-06-cstl-p0-channel-baseline-matrix` → `research/channel-matrix.md` (C01–C04, C16).

---

## 1. Non-goals

- **No `beforeSubmitPrompt` injection** — C04 stays telemetry-only until Cursor changelog proves otherwise.
- **No black-box silent injection** — Layer 2 and jsonl loads emit stderr manifest lines.
- **No weakening gates** — Triage (`cstl-triage.mdc`), execution approval, and retrieval policy remain always-on.
- **No Auto-Trigger Skill as retrieval primary** — C16 stays Rules + `route_codebase_retrieval.py --instructions`.

---

## 2. Channel budget tiers

| Tier | Channels | When | Budget |
| --- | --- | --- | --- |
| **Per-turn hard** | C01 Rules, C02 AGENTS | Every agent turn | Rules total warn 20 KiB / fail 32 KiB; AGENTS CSTL block warn 4 KiB |
| **Session once** | C03 sessionStart | New session | Keep dashboard/workflow summary compact; not a substitute for per-turn rules |
| **Zero** | C04 beforeSubmit | Every message | **0** — log only |
| **Subagent only** | C06 Layer 2 | `generate_dispatch_prompt` → Task | Role default `max_chars` + jsonl caps (§3) |
| **On demand** | C16 retrieval | When agent needs a plan | Rules default order or router CLI; no per-message plan block |

---

## 3. JSONL manifest budgets (implement / check)

Curate **spec/research only** — never pre-register code paths you will edit.

| Limit | Value | Enforcement |
| --- | --- | --- |
| Max entries | 8 | Skip excess at Layer 2 load; `task.py validate` WARN |
| Max single expansion | 12,000 chars | Skip file/directory block |
| Max total jsonl body | 48,000 chars | Skip when cumulative would exceed |

**Curator rules:**

1. Prefer **index + one layer spec** over whole package trees.
2. Use `task.py add-context` with a one-line **reason** (replayable intent).
3. Delete the seed `_example` row when adding real entries.
4. Full task artifacts (`prd.md`, `design.md`, `implement.md`) are **always** embedded separately — do not duplicate them in jsonl.

**Dispatch manifest (stderr):**

```text
[subagent-dispatch] injection-budget: .cstl/tasks/.../implement.jsonl loaded 2 entries (8421 chars): ...
[subagent-dispatch] injection-budget: skipped path: total cap (...)
```

---

## 4. Layer 2 role defaults

When `--max-chars` is omitted, `generate_dispatch_prompt.py` uses:

| Role | Default `max_chars` |
| --- | --- |
| implement | 96,000 |
| check | 64,000 |
| research | 48,000 |

Override per dispatch when a task truly needs more — document the override in `implement.md` DSC and `verify.md`.

Truncation order after jsonl budget: whole context string tail-truncated with `...[truncated]...` warning.

---

## 5. alwaysApply rule hygiene

Before adding a new `.cursor/rules/*.mdc` with `alwaysApply: true`:

1. Confirm the content **must** be visible **every turn** (see `cursor-context-injection-guide.md`).
2. Run `python ./.cstl/scripts/injection_budget_probe.py --repo-root .`.
3. If total alwaysApply exceeds **20 KiB**, trim or move detail to on-demand spec / `get_context.py`.

**Rollback:** remove or scope the new rule; re-run probe.

---

## 6. Observability probe

```powershell
# Workspace surfaces
python ./.cstl/scripts/injection_budget_probe.py --repo-root .

# Task jsonl + dispatch size
python ./.cstl/scripts/injection_budget_probe.py --repo-root . --task .cstl/tasks/<task-dir> --dispatch-role implement

# CI / gate style (fail on WARN or rules >32KiB)
python ./.cstl/scripts/injection_budget_probe.py --repo-root . --strict
```

Constants live in `.cstl/scripts/common/injection_budget.py` (single source).

---

## 7. Related

- [Cursor context injection guide](./cursor-context-injection-guide.md) — channel reliability matrix
- [Cursor subagent policy](./cursor-subagent-policy.md) — Layer 2 dispatch contract
- [Verification strength guide](./verification-strength-guide.md) — evidence density for closeout (orthogonal axis)

---

## 8. Rollback

Revert `injection_budget.py`, probe script, `subagent_dispatch` budget branch, validate WARNs, and this guide. Layer 2 returns to unbounded jsonl expansion; C04 remains telemetry-only.
