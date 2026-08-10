# Continue Selected Task

Resume work only when this live session already has a `selected_task`. If no task is selected, show the Task Dashboard and ask for an explicit route.

---

## Step 1: Load Framework Context

```bash
{{PYTHON_CMD}} ./.cstl/scripts/get_context.py
```

Confirms: selected task, Task Dashboard, git state, recent commits.

If the output says `Selected task: none`, do not auto-resume a previous or unique task. Show the dashboard and ask the user to choose one route:

- select a task with `{{PYTHON_CMD}} ./.cstl/scripts/task.py select <task>`
- create a task
- inspect details
- continue without a task for No Task / Micro-Grill work

## Step 2: Search Session Memory

**Skip this step** if Step 1 reported `Selected task: none`.

When a task is selected, search past session memory so resume work can reuse journal context instead of re-asking the user:

```bash
{{PYTHON_CMD}} ./.cstl/scripts/search_memory.py --query "<task topic or title>" --json
```

Use the selected task's title or topic as the query. From the JSON results, summarize **1–3** most relevant hits for the user (title, summary, and next steps when present). Carry that context into the rest of the continue flow.

## Step 3: Load the Phase Index

```bash
{{PYTHON_CMD}} ./.cstl/scripts/get_context.py --mode phase
```

Shows the Phase Index (Plan / Execute / Finish) with routing + skill mapping.

## Step 4: Decide Where You Are

When a task is selected, `get_context.py` shows the selected task's `status` field. Route by `status` + artifact presence. This command replaces the user needing to remember the Trellis flow; it does not itself approve implementation.

- `status=planning` + no `prd.md` → **1.1** (Read `.cstl/framework/prd-grill-frontier.md` for PRD Grill discipline)
- `status=planning` + `prd.md` only → decide whether the task is lightweight or complex. Lightweight can move to **1.4** review; complex returns to **1.1** to add `design.md` + `implement.md`.
- `status=planning` + complex artifacts complete + sub-agent jsonl not curated (only the seed `_example` row) → **1.3**
- `status=planning` + required artifacts complete + required jsonl curated or inline mode → execution gate (run `task.py start-execution <task> --check`, report PASS, ask for explicit execution approval, then run `task.py start-execution <task> --approved`)
- `status=in_progress` + implementation not started → **2.1**
- `status=in_progress` + implementation done, not yet checked → **2.2**
- `status=in_progress` + check passed → **3.1**
- `status=completed` (rare; usually archived immediately) → archive flow

Phase rules (full detail in `.cstl/workflow.md`):

1. Run steps **in order** within a phase — `[required]` steps must not be skipped
2. `[once]` steps are already done if the required output exists. `prd.md` alone can be enough only for lightweight tasks; complex tasks also need `design.md` and `implement.md`.
3. You may go back to an earlier phase if discoveries require it

## Step 5: Load the Specific Step

Once you know which step to resume at:

```bash
{{PYTHON_CMD}} ./.cstl/scripts/get_context.py --mode phase --step <X.X> --platform {{CLI_FLAG}}
```

Follow the loaded instructions. After each `[required]` step completes, move to the next.

---

## Reference

Full workflow and detailed phase steps live in `.cstl/workflow.md`. This command is only an entry point — the canonical guidance is there.
