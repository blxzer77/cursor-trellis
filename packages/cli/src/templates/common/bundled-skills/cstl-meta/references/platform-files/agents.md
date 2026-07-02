# Agents

Trellis agent files define specialized roles. Common Trellis agents in a user project are:

- `cstl-research`
- `cstl-implement`
- `cstl-check`

Responsibility boundaries should stay consistent regardless of file format.

> Trellis previously shipped agent files in per-platform directories for many AI tools (`.claude/agents/`, `.codex/agents/`, `.kiro/agents/`, etc.). The project has converged on **Cursor-only**. New agent definitions ship into `.cursor/agents/`; legacy agent directories in upgraded projects are preserved but not extended.

## Agent Responsibilities

| Agent | Responsibility |
| --- | --- |
| `cstl-research` | Investigate the question and write findings into the selected task's `research/`. |
| `cstl-implement` | Implement against `prd.md`, optional `design.md` / `implement.md`, `implement.jsonl`, and related spec/research. |
| `cstl-check` | Review changes, fix discovered issues, and run necessary checks. |

Agent files should not become generic chat prompts. They should define input sources, write boundaries, whether code may be changed, and how results are reported.

## Common Paths (Cursor)

| Platform | Agent path |
| --- | --- |
| Cursor | `.cursor/agents/cstl-*.md` |

Agent files are dispatched via the Cursor Task tool, opened as Agent sessions, or invoked inline as Skill forms depending on the entry point. See `cursor-subagent-policy.md.txt` for the full entry-point matrix and Method 1–2.6 model dispatch strategy.

## Two Context Loading Modes

### hook push

The Cursor hook (`inject-subagent-context.py`, registered in `.cursor/hooks.json`) injects task context before the agent starts. The agent file itself can focus more on responsibilities and boundaries.

### agent pull

The agent file instructs the agent to read after startup:

- `python3 ./.trellis/scripts/task.py selected --source`
- `implement.jsonl` or `check.jsonl`
- spec/research files referenced by JSONL
- selected task `prd.md`
- `design.md` if present
- `implement.md` if present

This mode fits cases where the hook cannot reliably rewrite the sub-agent prompt or the entry point is an Agent session that bypasses the Task hook path.

## Local Change Scenarios

| User need | Edit location |
| --- | --- |
| Implement agent must follow extra restrictions | `.cursor/agents/cstl-implement.md`. |
| Check agent must run project-specific commands | `.cursor/agents/cstl-check.md`, and `.trellis/spec/` if needed. |
| Research agent must output a fixed format | `.cursor/agents/cstl-research.md`. |
| Agent cannot read task context | Agent prelude in the agent file, or the `inject-subagent-context` hook registration in `.cursor/hooks.json`. |
| Add a project-specific agent | `.cursor/agents/` + related skill/command entry point that invokes it. |

## Modification Principles

1. **Keep responsibilities single-purpose**. Do not mix research, implement, and check responsibilities into one agent.
2. **Specify the read order**. Agents must know to start from the selected task, read jsonl/spec context, then read `prd.md`, `design.md` if present, and `implement.md` if present.
3. **Specify write boundaries**. Research usually only writes `research/`; implement can write code; check can fix issues.
4. **Treat dogfood + published copies consistently**. `.cursor/agents/cstl-*.md` (dogfooded) and `packages/cli/src/templates/cursor/agents/cstl-*.md` (published template) must stay in sync — see `cross-layer-thinking-guide.md.txt` → Cross-Package Template Consistency.

## Do Not Default To Editing Upstream Templates

Local AI should default to modifying agent files inside the user project's `.cursor/agents/`. Discuss upstream template source (`packages/cli/src/templates/cursor/agents/`) only when the user explicitly wants to contribute the change back to Trellis.
