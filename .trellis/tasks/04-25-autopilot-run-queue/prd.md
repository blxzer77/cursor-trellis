# brainstorm: Trellis Autopilot run queue

## Goal

Design a Trellis Autopilot mode that can advance through a queue of already-planned Trellis tasks with minimal user prompting. The goal is not to turn a vague idea into a fully automatic project. The required premise is: the user and AI first brainstorm multiple complete Trellis tasks, then Autopilot coordinates execution across those tasks.

## What I already know

- User wants a new version of the old `autonomous-task-planner` idea, but adapted to Trellis 0.5's single `workflow.md` source of truth.
- Old `autonomous-task-planner` generated `TASK-PROMPT.md` and `PROGRESS.md`; that should not be copied directly because current Trellis already has task dirs, `task.json`, `prd.md`, `implement.jsonl`, `check.jsonl`, hooks, and `workflow.md`.
- User confirmed the hard prerequisite: Autopilot only starts after the user and AI have brainstormed multiple complete tasks.
- Each Autopilot item should be a real Trellis task, not an inline pseudo-task inside the run file.
- The run-level file should coordinate task order and progress only; it must not redefine the per-task workflow.

## Core Design

Autopilot introduces a run queue layer above existing Trellis tasks:

```text
.trellis/runs/<run-id>/run.md     # queue source of truth
.trellis/.current-run             # active run pointer
.trellis/tasks/<task>/prd.md      # per-task requirements source of truth
.trellis/workflow.md              # per-task workflow source of truth
```

### Source of Truth Boundaries

- `workflow.md`: the only source of truth for Plan / Execute / Finish steps.
- `task.json` + `prd.md`: the source of truth for one task's status and requirements.
- `run.md`: the source of truth for task order, current queue item, run-level constraints, and blocked/done markers.
- Hooks and `trellis-continue`: read these files and inject the next action; they should not invent workflow rules.

## Dependency: Session-Scoped Current Task

Autopilot should not ship as a serious execution feature until Trellis solves session-scoped `current-task`.

Reason: Autopilot needs to keep the active AI conversation grounded in "the current run item", and each run item is a real Trellis task. If `.trellis/.current-task` remains a repo-global pointer, one window starting or advancing an Autopilot run can silently change the task context injected into another window. Autopilot would amplify the existing multi-window `current-task` problem because it changes task context automatically as the queue advances.

Required sequencing:

1. Finish `04-21-session-scoped-task-state` or an equivalent active-context mechanism.
2. Make hooks and `trellis-continue` resolve the active task from session scope first, with global file fallback.
3. Build Autopilot `current-run` on the same active-context mechanism, not as a separate global-only pointer.

Allowed pre-work before this dependency lands:

- PRD/design work.
- `run.md` schema design.
- Validation rules for "all run items are complete Trellis tasks".
- Non-mutating prototype scripts that inspect a run file.

Not allowed before this dependency lands:

- Per-turn hook behavior that switches current task automatically.
- A production `autopilot start` that writes only global `.current-run` and `.current-task`.

## Blocker Policy

Default policy: **strict stop**.

When the current task hits a real blocker:

1. Mark the current run item as blocked.
2. Record the blocker reason and the missing input/access/environment.
3. Stop the Autopilot run instead of advancing to the next task.
4. Inject a concise next-action prompt on the next turn so the user knows what is needed to unblock the run.

Rationale: most queued tasks are likely to share assumptions or outputs. Continuing after a blocked task risks compounding bad state. Autopilot should optimize for coherent completion, not maximum unchecked activity.

Future optional mode: explicit fail-forward. It should require both:

- run-level `fail_forward: true`
- per-item `independent: true`

Without both flags, blocked tasks stop the run.

## Optional Notify Hook

Autopilot should support an optional user-owned notification script hook. Trellis should not hardcode notification channels; it only invokes the configured script with structured event data.

Candidate config:

```yaml
notify:
  command: ".trellis/hooks/autopilot-notify.sh"
  events:
    - blocked
    - completed
    - failed
```

Candidate event payload:

```json
{
  "event": "blocked",
  "run_id": "frontend-api-buildout",
  "run_path": ".trellis/runs/frontend-api-buildout/run.md",
  "item_id": "T2",
  "task": ".trellis/tasks/04-25-build-frontend-pages",
  "reason": "Missing API credentials",
  "next_action": "Provide local credentials or mark this item skipped manually."
}
```

Rules:

- Notify hook is optional and disabled by default.
- Hook failure must never corrupt run state.
- Hook stdout/stderr should be captured into the run log when available.
- The hook receives no secrets from Trellis; users are responsible for reading their own environment if their script needs credentials.

## Hard Prerequisites

Autopilot can start only when all of these are true:

- Session-scoped current-task/current-run resolution is available, or the command is explicitly running in a documented single-window fallback mode.
- The run has 2+ linked Trellis task directories.
- Every task in the run has a `prd.md`.
- Every task has enough context to enter the normal Trellis workflow.
- For agent-capable platforms, every implementation-ready task has curated `implement.jsonl` / `check.jsonl` entries before execution.
- The user has explicitly approved entering Autopilot for this task queue.

If these prerequisites are not met, the system must route back to `trellis-brainstorm` and task planning rather than pretending the run is executable.

## Candidate `run.md` Shape

```md
---
id: frontend-api-buildout
status: running
current: T2
created_at: 2026-04-25
---

# Autopilot Run: Frontend API Buildout

## Run Rules

- Execute tasks in listed order unless a task is blocked.
- Do not skip Trellis workflow phases inside a task.
- If a task is blocked, mark it blocked with reason and move to the next unblocked task only when the run policy allows fail-forward.

## Tasks

- [x] T1: Audit backend API shape
  task: .trellis/tasks/04-25-audit-backend-api
  status: completed

- [ ] T2: Build frontend pages from backend API
  task: .trellis/tasks/04-25-build-frontend-pages
  status: in_progress

- [ ] T3: Browser verification
  task: .trellis/tasks/04-25-browser-verification
  status: pending
```

## Hook / Continue Behavior

When `.trellis/.current-run` exists, per-turn hook injection should include an additional Autopilot block:

```text
You are in Autopilot Run <id>.
Current queue item: T2 of 3.
Current Trellis task: .trellis/tasks/04-25-build-frontend-pages.
Current task status: in_progress.
According to workflow.md, next action is <derived next action>.
After this task completes, mark T2 complete and advance to the next queued task unless blocked.
```

Important boundary: hook injection should primarily read state. Mutating `run.md`, switching `.current-task`, or marking tasks done should happen through explicit scripts/skills such as `trellis-autopilot` or enhanced `trellis-continue`, not as a side effect of every user prompt.

## Requirements (Evolving)

- [ ] Depend on session-scoped current-task/current-run resolution before production Autopilot execution.
- [ ] Add an Autopilot run model under `.trellis/runs/`.
- [ ] Add `.trellis/.current-run` as the active run pointer.
- [ ] Add scripts for `create`, `start`, `status`, `next`, `mark-done`, `mark-blocked`, and `validate`.
- [ ] Add or enhance a skill so AI can create a run only from existing complete Trellis tasks.
- [ ] Enhance `trellis-continue` to detect active run and resume the current queue item.
- [ ] Enhance per-turn workflow hook to inject Autopilot context when a run is active.
- [ ] Add strict-stop blocker handling as the default run policy.
- [ ] Add optional user-owned notify script hook for blocked/completed/failed run events.
- [ ] Preserve existing behavior when no run is active.

## Non-Goals

- Do not execute vague natural-language goals directly as Autopilot runs.
- Do not replace `workflow.md`.
- Do not store full per-task PRDs inside `run.md`.
- Do not let hooks perform surprising write operations on normal user prompts.
- Do not promise wake-from-idle execution after the AI runtime stops; Autopilot resumes when the platform continues or the user sends another prompt.

## Open Questions

- Should Autopilot be a core Trellis feature or an optional plugin once the plugin mechanism exists?
- What is the minimal MVP: queue/status scripts only, or hook + continue integration from day one?
