# Marketplace workflow layout

## Target tree

```text
marketplace/
  workflows/
    native/
      workflow.md
    tdd/
      workflow.md
    channel-driven-subagent-dispatch/
      workflow.md
```

## Marketplace index entries

Add `type: "workflow"` entries to `marketplace/index.json`:

```json
{
  "id": "native",
  "type": "workflow",
  "name": "Native Trellis Workflow",
  "description": "Default Trellis Plan / Execute / Finish workflow with native sub-agent and inline platform branches",
  "path": "workflows/native/workflow.md",
  "tags": ["workflow", "native", "default"]
}
```

```json
{
  "id": "tdd",
  "type": "workflow",
  "name": "TDD Workflow",
  "description": "Trellis workflow variant that drives Phase 2 with one red / green / refactor behavior slice at a time",
  "path": "workflows/tdd/workflow.md",
  "tags": ["workflow", "tdd", "testing"]
}
```

```json
{
  "id": "channel-driven-subagent-dispatch",
  "type": "workflow",
  "name": "Channel-Driven Sub-Agent Dispatch",
  "description": "Trellis workflow variant where the main session coordinates implement/check workers through trellis channel",
  "path": "workflows/channel-driven-subagent-dispatch/workflow.md",
  "tags": ["workflow", "channel", "sub-agent", "dogfood"]
}
```

## Source-of-truth policy

`native` must remain byte-identical to `packages/cli/src/templates/trellis/workflow.md` until the workflow command has a resolver that can point `native` directly at the bundled template.

Initial implementation can choose either:

1. Duplicate native into `marketplace/workflows/native/workflow.md` and add a regression test that compares it with the bundled template.
2. Treat `native` as a virtual workflow entry resolved from `workflowMdTemplate`, with no duplicate marketplace file.

Option 2 avoids drift and is preferable for the CLI implementation. Option 1 is acceptable only if the test fails on drift.

## Draft-to-marketplace mapping

| Workflow id | Source draft | Marketplace target |
| --- | --- | --- |
| `native` | `packages/cli/src/templates/trellis/workflow.md` | `marketplace/workflows/native/workflow.md` or virtual resolver |
| `tdd` | `.trellis/tasks/05-15-workflow-marketplace-feature-flag/research/tdd-workflow-en-draft.md` | `marketplace/workflows/tdd/workflow.md` |
| `channel-driven-subagent-dispatch` | `.trellis/tasks/05-15-workflow-marketplace-feature-flag/research/channel-driven-subagent-dispatch-workflow-en-draft.md` | `marketplace/workflows/channel-driven-subagent-dispatch/workflow.md` |

## Required parser contract

Every workflow template must preserve:

- `## Phase Index`
- `## Phase 1: Plan`
- `## Phase 2: Execute`
- `## Phase 3: Finish`
- `#### X.Y` step headings used by `get_context.py --mode phase --step`
- platform marker blocks like `[codex-inline, Kilo, Antigravity, Windsurf]`
- `[workflow-state:no_task]`
- `[workflow-state:planning]`
- `[workflow-state:planning-inline]`
- `[workflow-state:in_progress]`
- `[workflow-state:in_progress-inline]`
- `[workflow-state:completed]`

## Validation matrix

For each workflow template:

```bash
python3 ./.trellis/scripts/get_context.py --mode phase
python3 ./.trellis/scripts/get_context.py --mode phase --step 1.1
python3 ./.trellis/scripts/get_context.py --mode phase --step 2.1
python3 ./.trellis/scripts/get_context.py --mode phase --step 2.2
```

Also validate extraction behavior without replacing the project workflow:

- SessionStart overview extraction reads `## Phase Index` and strips `[workflow-state:*]`.
- Per-turn workflow-state extraction reads all required tags.
- TDD template has red / green / refactor in Phase Index, `in_progress`, and `2.1`.
- Channel-driven template has `trellis channel spawn` in `2.1` and `2.2`, and channel worker flow in `in_progress`.
- TDD template does not contain `trellis channel` or `channel-driven`.
- Channel-driven template does not contain TDD red / green copy.

