# Framework Start

Enter or refresh the Trellis Framework Context. This is a dashboard entry surface; it must not select, resume, or start a task by itself.

On **agent-capable Cursor** this command is **not** installed as a `/` slash (SessionStart + `/cstl-continue` cover entry). Keep this template for agent-less platforms only.

---

## Step 1: Framework state
Identity, git status, selected task, Kernel / Task Dashboard, journal location.

```bash
{{PYTHON_CMD}} ./.cstl/scripts/get_context.py
```

If this output includes a line beginning `Trellis update available:`, copy the full line verbatim when summarizing session context. Do not shorten operational command hints.

If a compiled session pack is already in context, use it. Do **not** implement the Session compiler. Do **not** treat `get_context.py --mode phase` Phase Index as runtime SSOT.

## Step 2: Guideline indexes
Discover packages + spec layers, then read each relevant index file.

```bash
{{PYTHON_CMD}} ./.cstl/scripts/get_context.py --mode packages
cat .cstl/spec/guides/index.md
cat .cstl/spec/<package>/<layer>/index.md   # for each relevant layer
```

Index files list the specific guideline docs to read when you actually start coding. Human overview: `.cstl/workflow.md` (read on demand; not runtime SSOT).

## Step 3: Decide next action
From Step 1 you know whether a task is selected. Route by Kernel human phase (Open / Define / Approve / Execute / Verify / Integrate? / Close), not by Phase Index step ids.

- If `Selected task: none` → show the Task Dashboard; do **not** load `cstl-continue`. For read-only Q&A, stay no-task (Ask if the user is already there).
- If a task **is** selected and you need the next lifecycle step → use `cstl-continue` instead of repeating Steps 1–2 here.

If `Selected task: none`, ask the user to choose: select a task, create a task, inspect details, or continue without a task.

If a task is selected, check Kernel / Dashboard:

- **Open / Define** → stay in definition until AC exists; prefer Plan for Define when useful
- **Approve** → Execution gate (`task.py start-execution <task> --check`); `--check` is not approval
- **Execute** → implement under contract
- **Verify / Close** → evidence then wrap-up (`cstl-finish-work`)
- **No selected task** → use dashboard routing. Do not auto-select an existing task

Official `/goal` / CreateGoal is not a Trellis Task.

---

## Skill routing (quick reference)

Internal names below are **workflow routing**, not a `/` palette. On Cursor, user slash commands are only Continue / Finish-work / Handoff.

| User intent | Route |
|---|---|
| Resume **selected** in-progress task | `cstl-continue` |
| New feature / unclear requirements | Define / brainstorm discipline (on-demand) |
| Small request, no task yet | no-task read-only or Open Proposal |
| About to write code | Execute (after Execute gate) |
| Done coding / quality check | Verify |
| Session wrap-up after Close / Finalize commit | `cstl-finish-work` |
| Stuck / fixed same bug multiple times | Debug → `verify.md`; break-loop when looped |
| Learned something worth capturing | learning disposition in `verify.md` |

Full human overview in `.cstl/workflow.md`. Native mode bindings: `.cstl/framework/cursor-native-modes-guide.md`.
