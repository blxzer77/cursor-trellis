---
name: pactile-start
description: "Initializes an AI development session by reading workflow guides, developer identity, git status, active tasks, and project guidelines from .pactile/. Classifies incoming tasks and routes to brainstorm, direct edit, or task workflow. Use when beginning a new coding session, resuming work, starting a new task, or re-establishing project context."
---

# Framework Start

Enter or refresh the Pactile Framework Context. This is a dashboard entry surface; it must not select, resume, or start a task by itself.

---

## Step 1: Framework state
Identity, git status, selected task, Task Dashboard, journal location.

```bash
python ./.pactile/scripts/get_context.py
```

If this output includes a line beginning `Pactile update available:`, copy the full line verbatim when summarizing session context. Do not shorten operational command hints.

## Step 2: Workflow overview
Compact Phase Index, request triage rules, planning artifact contract, and the step-detail command.

```bash
python ./.pactile/scripts/get_context.py --mode phase
```

Full guide in `.pactile/workflow.md` (read on demand).

## Step 3: Guideline indexes
Discover packages + spec layers, then read each relevant index file.

```bash
python ./.pactile/scripts/get_context.py --mode packages
cat .pactile/spec/guides/index.md
cat .pactile/spec/<package>/<layer>/index.md   # for each relevant layer
```

Index files list the specific guideline docs to read when you actually start coding.

## Step 4: Decide next action
From Step 1 you know whether a task is selected.

- If `Selected task: none` → show the Task Dashboard; do **not** load `pactile-continue`. For a **small** request without a task, use `pactile-micro-grill` first.
- If a task **is** selected and you need the next workflow step → use `pactile-continue` instead of repeating Steps 1–3 here.

If `Selected task: none`, ask the user to choose: select a task, create a task, inspect details, or continue without a task.

If a task is selected, check the task directory:

- **Selected task status `planning` + no `prd.md`** → Phase 1.1. Load the `pactile-brainstorm` skill.
- **Selected task status `planning` + `prd.md` exists** → stay in Planning / Execution Gate. Lightweight tasks can be PRD-only; complex tasks need `design.md` + `implement.md`. Run `task.py start-execution <task> --check` and request explicit execution approval before execution.
- **Selected task status `in_progress`** → Phase 2 step 2.1. Load the step detail:
  ```bash
  python ./.pactile/scripts/get_context.py --mode phase --step 2.1 --platform cursor
  ```
- **No selected task** → use dashboard routing. Do not auto-select an existing task.

---

## Skill routing (quick reference)

| User intent | Skill |
|---|---|
| Resume **selected** in-progress task | `pactile-continue` |
| New feature / unclear requirements | `pactile-brainstorm` |
| Small request, no task yet | `pactile-micro-grill` |
| About to write code | `pactile-before-dev` |
| Done coding / quality check | `pactile-check` |
| Session wrap-up after Phase 3.4 commit | `pactile-finish-work` |
| Stuck / fixed same bug multiple times | `pactile-break-loop` |
| Learned something worth capturing | `pactile-update-spec` |

Full rules + anti-rationalization table in `.pactile/workflow.md`.
