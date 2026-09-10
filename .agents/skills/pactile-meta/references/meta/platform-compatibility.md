# Platform Compatibility Reference

pactile is **Cursor-only**. This fork generates `.cursor/` (rules, commands, agents, hooks) and `.pactile/` (workflow, tasks, spec, scripts). Legacy adapter directories from upstream Pactile may remain on disk after `pactile update` but are not extended by new behavior.

> **Historical note:** Upstream [mindfold-ai/Pactile](https://github.com/mindfold-ai/Pactile) targeted multiple AI platforms (Claude Code, Codex, etc.). pactile converged on Cursor; do not treat removed adapters as current integration paths.

---

## Feature layers (Cursor)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         PACTILE FEATURE LAYERS (Cursor)                  │
├─────────────────────────────────────────────────────────────────────────┤
│  LAYER 3: AUTOMATION — `.cursor/hooks/` + Python scripts                 │
│           Session start, workflow state, subagent prelude, retrieval     │
│                                                                          │
│  LAYER 2: AGENTS — `.cursor/agents/` + Task tool dispatch              │
│           pactile-research / pactile-implement / pactile-check                    │
│                                                                          │
│  LAYER 1: PERSISTENCE — file-based (portable)                          │
│           `.pactile/` workspace, tasks, spec, scripts; `.cursor/commands/` │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Layer 1: Persistence

| Feature | Location | Description |
|---------|----------|-------------|
| Workspace system | `.pactile/workspace/` | Journals, session history |
| Task system | `.pactile/tasks/` | Task tracking, PRDs, verify |
| Spec system | `.pactile/spec/` | Coding guidelines |
| Slash commands | `.cursor/commands/` | User-invoked `/pactile-*` entry points |
| JSONL context | `*.jsonl` in task dirs | Sub-agent spec/research manifests |
| Developer identity | `.pactile/.developer` | Per-machine developer name |
| Selected task | `.pactile/.runtime/sessions/` | Session-scoped task pointer |

---

## Layer 2: Agents (Cursor)

| Feature | Mechanism |
|---------|-----------|
| Agent definitions | `.cursor/agents/pactile-{research,implement,check}.md` |
| Subagent dispatch | Cursor **Task** tool + `generate_dispatch_prompt.py` prelude |
| Context injection | `preToolUse` hook + JSONL manifests |
| Policy rules | `.cursor/rules/*.mdc` (always-on, including triage) |

See `references/platform-files/agents.md` and `.pactile/spec/guides/cursor-subagent-policy.md`.

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
- Upstream Claude Code–specific hooks, Ralph Loop, and Multi-Session CLI flows as documented in old Pactile releases

If legacy directories exist from an older upgrade, they are preserved but not the integration surface for new Pactile behavior.

---

## Checking your environment

```bash
pactile --version
python --version    # ≥ 3.9 for hooks
cat .cursor/hooks.json
ls .cursor/rules/
```
