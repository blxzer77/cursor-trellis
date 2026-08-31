# Review Pool（审核池）

> Purpose: one place for product ideas, directions, and review gaps — enter the pool for triage, leave via a development plan.
> The pool holds candidates; the plan holds commitments.

## Directory layout

```
.cstl/pool/
├── README.md            ← this file (mechanism)
├── plan.md              ← development plan (references item ids only)
├── items/               ← one small markdown file per adjudicable item
├── knowledge-base/      ← optional: rejected rationale by concept (lazy)
└── archive/             ← optional: terminal home for rejected items (lazy)
```

## State machine

```
inbox ──► review ──► accepted (enter development plan)
          │
          ├──► rejected (move to archive + knowledge-base; reason required)
          └──► rework (missing info / not shippable → rewrite with user → back to inbox)
```

- `accepted`: Agent proposes; user confirms before the status flips. **Does not mean the work is done.** Completion is `delivery` (see below).
- `rejected`: terminal; item moves under `archive/`; rationale goes to `knowledge-base/` (one file per concept; Prior requests for dedupe).
- `rework`: transit state, not terminal; after rewrite, return to `inbox`.
- **Exception**: “already implemented / duplicate” items do **not** enter knowledge-base (that would poison dedupe). Point at the existing implementation and close.

## Item fields (adjudicable four-pack + type + links)

Each file under `items/` needs frontmatter:

```yaml
---
id: P01            # item id (plan.md references this only)
title: Short title
status: accepted   # inbox | review | accepted | rejected | rework
type: mechanism    # research | prototype | grilling | task (decision-type tag)
locale: zh
created: 2026-08-08
approved: 2026-08-08  # only when accepted
priority: P1       # optional; accepted only. P0 | P1 | P2. Missing → treat as P2
delivery: standing  # accepted only. open | in-slice | landed | standing | deferred
linked_tasks:      # optional: task directory names (slice index, not completion)
  - 08-08-example-task
---
```

Body must include four sections: **Intent (one line) / Motivation / Coarse acceptance / Non-goals**. Notes that fail the four-pack stay notes; they are not “ready for review”.

## Delivery (orthogonal to status)

`status` is adjudication. `delivery` is remaining obligation. Do not collapse them.

| delivery | Meaning | Attention board |
| --- | --- | --- |
| `open` | Accepted; work not started or remaining obligation exists | Yes |
| `in-slice` | Linked tasks currently executing | Yes |
| `landed` | Finite deliverable discharged | Closed, not a queue |
| `standing` | Live rule / discipline; never a todo | Standing list, not a queue |
| `deferred` | Accepted but explicitly not doing now | Closed, not a queue |

- Required on `accepted`. `inbox` / `review` / `rejected` omit it.
- `pool.py status` prints the groups. `plan.md` Mainline only cites `open` / `in-slice`.
- `depends_on: ["pool:Pxx"]` uses `delivery`, not linked-task Close: standing / landed / deferred → SATISFIED; open / in-slice → NOT_SATISFIED; missing `.cstl/pool/` (no Capture) → ignored (does not block Close); missing item → UNRESOLVED.

## Links and validation (pool CLI)

Item ↔ task links use the CLI as the authoritative write path (both sides in one call):

- Item side: frontmatter `linked_tasks` (task directory name) — **slice index for humans**, not completion
- Task side: `task.json` → `meta.pool_items` (pool item id, e.g. `"P01"`)
- Many-to-many; de-duplicated, order-preserving
- Hand-editing one side is caught by `validate` (`link-missing-task-side` / `link-missing-item-side`)

| Command | Role | Exit |
| --- | --- | --- |
| `python3 ./.cstl/scripts/pool.py validate` | Four-pack / required keys / status / delivery / unique id / dangling links / bidirectional consistency | error-level → 1 |
| `python3 ./.cstl/scripts/pool.py plan-check` | plan.md referenced ids exist (ghost id → error) | same |
| `python3 ./.cstl/scripts/pool.py link <item-id> <task-ref>` | Bidirectional link (idempotent) | missing → 1 |
| `python3 ./.cstl/scripts/pool.py unlink <item-id> <task-ref>` | Bidirectional unlink | item missing → 1 |
| `python3 ./.cstl/scripts/pool.py show <item-id>` | Print item + delivery + linked task status summary | missing → 1 |
| `python3 ./.cstl/scripts/pool.py status` | Print delivery groups (queue / standing / closed) | 0 |

- WARN-only issues exit 0 (same discoverability stance as depends_on Plan A).
- `depends_on: ["pool:Pxx"]` satisfaction is `delivery` via `pool_refs` (not `pool_store`). See Delivery above.

All commands accept `--root <path>` when the Trellis root is not the current working directory.

## Process rules

1. New idea / gap → write an `items/` entry with status `inbox`.
2. Review: Agent proposes a decision; user adjudicates → `accepted` / `rejected` / `rework`.
3. `accepted` → add to `plan.md` (plan cites item ids only; do not rewrite a second narrative).
4. When a planned item starts work → Task Ladder (`task.py create`).

## Choosing the next item (attention, not a serial lock)

Priority is **attention + start preference**, not a queue lock. Isolatable write-sets still run in parallel (see `.cstl/workflow.md` Parallel-first). Agent proposes; user chooses. Agent must not auto-start, and must not refuse an independent item because a higher band is unfinished.

1. Run `python3 ./.cstl/scripts/pool.py status`. Rank **only** `open` and `in-slice`.
2. Within the queue, group by attention band: `priority: P0` → `P1` → unlabeled/`P2`.
3. `standing` / `landed` / `deferred` / inbox hold / `rejected` do not rank. `rework` drops until re-accepted.
4. Show the band order **and** the parallel groups → **ask the user**.

`inbox` hold items are not ranked. Do not invent a scheduler CLI. Serial exceptions are the same set as Parallel-first (`serial_reason`).

When this repo is CSTL itself: the workflow package and optional BYOK are **independent ships**. See `.cstl/framework/release-boundary.md`. BYOK readiness is not a workflow-package gate.

## Fog hygiene

- Once an item or mechanism lands, **move it out** of “Not yet specified” into closed/mainline and keep the task id. Do not leave shipped work in fog.
- Fog holds only truly open, uncommitted directions; if fog is empty, delete the whole section.

## Boundary with the Task Ladder

- **In-session requests** (clear, directly actionable) → Lite / Full / Parent task creation — **not** the pool.
- **Ideas / directions / gaps / unformed thoughts** → pool.
- Pool = candidates; Task = commitment. Only `accepted` items should become tasks.

## Language

Items and plans are human-reviewed artifacts and follow `artifact_locale`. Frontmatter keys and status values stay English (infrastructure).

## Maintenance

- Record adjudication notes on the item (decision log) so rationale is not lost.
- After terminology-related items land, consider adding consistency checks at archive / check time when the project cares about glossary drift.
