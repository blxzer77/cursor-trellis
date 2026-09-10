# Change Local Agents

When the user wants to change `pactile-research`, `pactile-implement`, or `pactile-check` behavior, edit platform agent files in the user project.

## Read These Files First

1. Target platform agent directory
2. `.pactile/workflow.md` Phase 2 / research routing
3. Selected task `prd.md`
4. Selected task `implement.jsonl` / `check.jsonl`
5. Relevant hook or agent prelude

## Common Paths

| Platform | Path |
| --- | --- |
| Cursor | `.cursor/agents/pactile-*.md` |

If a user project still contains legacy platform agent directories (`.claude/agents/`, `.codex/agents/`, etc.), inspect them but route new agent definitions to `.cursor/agents/`.

Use the actual paths in the user project as authoritative.

## Common Needs

| Need | Which agent to edit |
| --- | --- |
| Research must write files, not only reply in chat | `pactile-research` |
| Certain local specs must be read before implementation | `pactile-implement` + `implement.jsonl` configuration rules |
| Specific commands must run during checking | `pactile-check` |
| Agent must not modify certain directories | The corresponding agent's write boundary instructions |
| Agent output format must be fixed | The corresponding agent's final/reporting instructions |

## Modification Principles

1. **Preserve role boundaries**: research investigates and persists; implement writes implementation; check reviews and fixes.
2. **Do not hard-code project specs into agents**: long-term specs belong in `.pactile/spec/`; agents are responsible for reading them.
3. **Make read order explicit**: selected task -> PRD -> info -> JSONL -> spec/research.
4. **Make write boundaries explicit**: which directories may be written and which may not.
5. **Treat dogfood + published copies consistently**: `.cursor/agents/pactile-*.md` (dogfooded) and `packages/cli/src/templates/cursor/agents/pactile-*.md` (published template) must stay in sync — see `cross-layer-thinking-guide.md.txt` → Cross-Package Template Consistency.

## Agent Pull Mode

If an agent file contains a prelude for "read task/context after startup," do not remove those steps when editing. Otherwise the agent will work only from chat context and bypass Pactile's core mechanism.

## Hook Push Mode

If context is injected by a hook, the agent file should still retain responsibility boundaries. Do not remove PRD/spec requirements from the agent just because a hook injects context.
