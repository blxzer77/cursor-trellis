# Research: D-2 Self-Load Check (Verification Test #13)

- **Query**: Verify whether trellis-research.md agent definition contains a "Trellis Context Loading Protocol" section and whether the mandatory self-load steps were executed.
- **Scope**: internal
- **Date**: 2026-06-24

## Findings

### Summary Table

| Check | Result |
|---|---|
| Protocol section present in `trellis-research.md` | **NO** |
| Self-load step 1 (find task path from `Selected task:` line) | **YES** (parsed manually, not driven by a protocol section) |
| Self-load step 2 (run `get_context.py --mode packages` / equivalent) | **NO** |

### Protocol section presence

Searched the active research agent definition
`d:\MyHarness\Trellis\.cursor\agents\trellis-research.md` (full Read) — it does
**not** contain a `## Trellis Context Loading Protocol` heading, nor any
`Mandatory self-load` phrase.

Workspace-wide grep for `Trellis Context Loading Protocol` shows the section
exists only in:

- `Trellis\.cursor\agents\trellis-check.md`
- `Trellis\.cursor\agents\trellis-implement.md`
- `Trellis\.claude\agents\trellis-check.md`
- `Trellis\.claude\agents\trellis-implement.md`
- template sources under `Trellis\packages\cli\src\templates\*\agents\trellis-{check,implement}.md`

A grep for the exact phrase `Mandatory self-load` across `d:\MyHarness\Trellis`
returned **zero matches**.

### Self-load step 1 — find task path

The task path was not self-loaded by an in-definition protocol; it was parsed
from the `Selected task:` line in the dispatch prompt:

```
d:\MyHarness\Trellis\.trellis\tasks\06-23-subagent-smoke
```

Verified via PowerShell `Test-Path` → both the task dir and its `research/`
subdir exist. Result: **YES** (manual parse), but **not** driven by a protocol
section because none is present in `trellis-research.md`.

### Self-load step 2 — get spec structure

`get_context.py` is present at
`d:\MyHarness\Trellis\.trellis\scripts\get_context.py` (also distributed via
template and `node_modules`), but it was **not** invoked in any mode
(`--mode packages` or otherwise) during this run. The protocol section that
would mandate this step is absent from the research agent definition.
Result: **NO**.

## Obstacles Encountered

- **Premise mismatch**: The dispatch prompt asserts
  "Your agent definition (trellis-research.md) now contains a 'Trellis Context
  Loading Protocol' section." This is **not true** for the on-disk
  `trellis-research.md` definition. The research agent has no such section;
  only `trellis-check`, `trellis-implement`, and (claude-side) their mirrors
  carry it.
- The `Mandatory self-load` label referenced in the dispatch prompt is not
  present anywhere in the Trellis tree, so the sub-step naming cannot be
  confirmed against any research-agent source file.
- No fallback instruction in the research agent definition triggers
  `get_context.py`, so step 2 was not actioned.

## Caveats / Not Found

- This report reflects only the `d:\MyHarness\Trellis` tree (the active
  workspace). Backup snapshots under `.trellis\.backup-*` and the
  `.tmp\Trellis-Herbivore` clone also contain `trellis-research.md` copies but
  are not the active agent definitions; they were not reassessed.
- Cannot introspect my own runtime system prompt directly; the determination
  of "section present" is based on the on-disk agent definition file that
  Cursor loads as the research subagent, which is the canonical source.
