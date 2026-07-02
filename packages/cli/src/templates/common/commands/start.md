# Framework Start

Enter or refresh the Trellis Framework Context. This is a dashboard entry surface; it must not select, resume, or start a task by itself.

---

## Step 1: Framework state
Identity, git status, selected task, Task Dashboard, journal location.

```bash
{{PYTHON_CMD}} ./.trellis/scripts/get_context.py
```

If this output includes a line beginning `Trellis update available:`, copy the full line verbatim when summarizing session context. Do not shorten operational command hints.

## Step 2: Workflow overview
Compact Phase Index, request triage rules, planning artifact contract, and the step-detail command.

```bash
{{PYTHON_CMD}} ./.trellis/scripts/get_context.py --mode phase
```

Full guide in `.trellis/workflow.md` (read on demand).

## Step 3: Guideline indexes
Discover packages + spec layers, then read each relevant index file.

```bash
{{PYTHON_CMD}} ./.trellis/scripts/get_context.py --mode packages
cat .trellis/spec/guides/index.md
cat .trellis/spec/<package>/<layer>/index.md   # for each relevant layer
```

Index files list the specific guideline docs to read when you actually start coding.

## Step 4: Decide next action
From Step 1 you know whether a task is selected.

- If `Selected task: none` → show the Task Dashboard; do **not** load `cstl-continue`. For a **small** request without a task, use `cstl-micro-grill` first.
- If a task **is** selected and you need the next workflow step → use `cstl-continue` instead of repeating Steps 1–3 here.

If `Selected task: none`, ask the user to choose: select a task, create a task, inspect details, or continue without a task.

If a task is selected, check the task directory:

- **Selected task status `planning` + no `prd.md`** → Phase 1.1. Load the `cstl-brainstorm` skill.
- **Selected task status `planning` + `prd.md` exists** → stay in Planning / Execution Gate. Lightweight tasks can be PRD-only; complex tasks need `design.md` + `implement.md`. Run `task.py start-execution <task> --check` and request explicit execution approval before execution.
- **Selected task status `in_progress`** → Phase 2 step 2.1. Load the step detail:
  ```bash
  {{PYTHON_CMD}} ./.trellis/scripts/get_context.py --mode phase --step 2.1 --platform {{CLI_FLAG}}
  ```
- **No selected task** → use dashboard routing. Do not auto-select an existing task.

---

## Skill routing (quick reference)

| User intent | Skill |
|---|---|
| Resume **selected** in-progress task | `cstl-continue` |
| New feature / unclear requirements | `cstl-brainstorm` |
| Small request, no task yet | `cstl-micro-grill` |
| About to write code | `cstl-before-dev` |
| Done coding / quality check | `cstl-check` |
| Session wrap-up after Phase 3.4 commit | `cstl-finish-work` |
| Stuck / fixed same bug multiple times | `cstl-break-loop` |
| Learned something worth capturing | `cstl-update-spec` |

Full rules + anti-rationalization table in `.trellis/workflow.md`.
