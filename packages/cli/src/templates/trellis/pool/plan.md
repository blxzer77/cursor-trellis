# Development plan (pool)

> Plan cites **pool item ids** only. Do not paste full item bodies here.
> Update this file when items are accepted, started, or closed.
>
> **Token rule:** `plan-check` treats bare letter-P plus digits as item ids.
> In this file's prose, write attention bands as `priority-0` / `priority-1` /
> `priority-2`. Put illustrative item ids only inside fenced code blocks.

## Conventions

- **Mainline**: `accepted` item ids, grouped by attention band. Same band + isolatable write-set = a parallel group. Serial needs a written reason (shared write-set / HITL / unmet depends / user asked / cannot isolate).
- **Attention ≠ lock**: unlabeled accepted items count as `priority-2` and remain startable. A higher band still open does not block an independent lower-band item.
- **Release tracks** (when this repo ships CSTL): the workflow package and optional BYOK are independent ships. See `.cstl/framework/release-boundary.md`. Do not treat BYOK as a workflow-package gate.
- **Closed**: landed or deliberately dropped ids (keep a one-line pointer to task dir or reason).
- **Not yet specified (fog)**: open directions without an accepted item yet — keep short; empty → delete section.

## Mainline

### Attention band 0 (this batch / release-blocking)

_(empty — add accepted item ids as they enter the plan)_

### Attention band 1 (wanted, not release-blocking)

_(empty)_

### Attention band 2 (unlabeled default; still startable)

_(empty)_

Example shape (ids belong in a fence so they are not scanned):

```text
- <item-id> — short title (link task when created)
  parallel with: <other-id>
```

## Closed

_(empty)_

## Not yet specified (fog)

_(empty — delete this section when unused)_
