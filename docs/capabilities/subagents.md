# Subagents and worktrees

English | [简体中文](subagents.zh-CN.md)

Subagents are host dispatch surfaces over the shared Pactile Task contract.
They are not an unbounded agent pool and do not create a second canonical
workflow. The host may provide an isolated context or worktree; the Parent
still owns integration and the Kernel still owns durable transitions.

## Safe dispatch

1. Select or create a Task with a bounded write set.
2. Generate the CLI dispatch prompt so the child receives PRD, design,
   implementation contract, and evidence requirements.
3. Let the child report `working`, `review`, or `blocked`; it cannot self-claim
   Parent integration.
4. Review the change set and Evidence in a fresh context when independence is
   required.
5. Parent integrates one reviewed ref at a time and records the decision.

Cursor commonly exposes `.cursor/agents/` and Task subagents; Codex may use its
own project tools or a normal task conversation. The shared contract is the
same even when the UI and context injection differ. Hooks are best-effort; the
CLI dispatch prompt and `.pactile/workflow.md` are the dependable fallback.

Do not ask a subagent to commit, publish, mutate a remote, or broaden its write
set without an explicit change to the task contract.
