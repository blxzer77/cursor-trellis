# Platform Compatibility Reference

cursor-trellis is **Cursor-only**. This fork generates `.cursor/` (rules, commands, agents, hooks) and `.cstl/` (workflow, tasks, spec, scripts). Legacy adapter directories from upstream Trellis may remain on disk after `cstl update` but are not extended by new behavior.

> **Historical note:** Upstream [mindfold-ai/Trellis](https://github.com/mindfold-ai/Trellis) targeted multiple AI platforms (Claude Code, Codex, etc.). cursor-trellis converged on Cursor; do not treat removed adapters as current integration paths.

---

## Feature layers (Cursor)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TRELLIS FEATURE LAYERS (Cursor)                  │
├─────────────────────────────────────────────────────────────────────────┤
│  LAYER 3: AUTOMATION — `.cursor/hooks/` + Python scripts                 │
│           Session start, workflow state, subagent prelude, retrieval     │
│                                                                          │
│  LAYER 2: AGENTS — `.cursor/agents/` + Task tool dispatch              │
│           cstl-research / cstl-implement / cstl-check                    │
│                                                                          │
│  LAYER 1: PERSISTENCE — file-based (portable)                          │
│           `.cstl/` workspace, tasks, spec, scripts; `.cursor/commands/` │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Persistence

| Feature | Location | Description |
|---------|----------|-------------|
| Workspace system | `.cstl/workspace/` | Journals, session history |
| Task system | `.cstl/tasks/` | Task tracking, PRDs, verify |
| Spec system | `.cstl/spec/` | Coding guidelines |
| Slash commands | `.cursor/commands/` | User-invoked `/cstl-*` entry points |
| JSONL context | `*.jsonl` in task dirs | Sub-agent spec/research manifests |
| Developer identity | `.cstl/.developer` | Per-machine developer name |
| Selected task | `.cstl/.runtime/sessions/` | Session-scoped task pointer |

---

## Layer 2: Agents (Cursor)

| Feature | Mechanism |
|---------|-----------|
| Agent definitions | `.cursor/agents/cstl-{research,implement,check}.md` |
| Subagent dispatch | Cursor **Task** tool + `generate_dispatch_prompt.py` prelude |
| Context injection | `preToolUse` hook + JSONL manifests |
| Policy rules | `.cursor/rules/*.mdc` (always-on, including triage) |

See `references/platform-files/agents.md` and `.cstl/spec/guides/cursor-subagent-policy.md`.

---

## Layer 3: Automation (Cursor hooks)

| Feature | Entry |
|---------|-------|
| Session context | `sessionStart` → `session-start.py` |
| Workflow breadcrumb | `beforeSubmitPrompt` → `inject-workflow-state.py` |
| Retrieval plan | `beforeSubmitPrompt` → `inject-retrieval-plan.py` |
| Subagent prelude | `preToolUse` (Task) → `inject-subagent-context.py` |
| Research pack | `stop` → `research-end-retrieval-pack.py` |

Configured in `.cursor/hooks.json`. Requires **Python ≥ 3.9** on the machine running Cursor.

---

## What is not supported in this fork

- New installs or updates for `.claude/`, `.codex/`, `.opencode/`, and other legacy adapter trees
- Upstream Claude Code–specific hooks, Ralph Loop, and Multi-Session CLI flows as documented in old Trellis releases

If legacy directories exist from an older upgrade, they are preserved but not the integration surface for new Trellis behavior.

---

## Checking your environment

```bash
cstl --version
python --version    # ≥ 3.9 for hooks
cat .cursor/hooks.json
ls .cursor/rules/
```

For Cursor++ BYOK (optional): `.cstl/local/cursor2plus/` — see `docs/cursor.md`.
