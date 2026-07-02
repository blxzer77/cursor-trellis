# Change Local Skills, Commands, Prompts, And Workflows

When the user wants to change AI entry points, auto-trigger rules, or explicit command behavior, edit skills, commands, prompts, or workflows in local platform directories.

## Read These Files First

1. `.trellis/workflow.md`
2. Target platform skill/command/prompt/workflow directory
3. Related agent or hook files
4. Whether project rules already exist in `.trellis/spec/`

## Which Entry Type To Choose

| Goal | Recommendation |
| --- | --- |
| AI should automatically know a capability | Add or modify a skill. |
| User wants to trigger manually with a command | Add or modify a command/prompt/workflow. |
| Team project conventions | Prefer `.trellis/spec/` or a project-local skill. |
| Change Trellis flow semantics | Synchronize `.trellis/workflow.md`. |

## Modify A Skill

A skill is usually:

```text
<skill-name>/
├── SKILL.md
└── references/
```

`SKILL.md` should be short and responsible for triggering/routing. Put long content in `references/` so AI can read it on demand.

For detailed skill authoring and review rules, use `cstl-skill-creator`. This `cstl-meta` page only identifies where local Trellis skill, command, prompt, and workflow changes belong.

The frontmatter description should specify when to use the skill. Example:

```yaml
description: "Use when customizing this project's deployment workflow and release checklist."
```

Do not write vague descriptions such as "helpful project skill"; they can trigger incorrectly.

## Modify A Command/Prompt/Workflow

Explicit entry points should state:

- How the user triggers it.
- Which `.trellis/` files to read.
- Which scripts to run.
- How to report after completion.

If a command only repeats workflow rules, prefer making it reference/read `.trellis/workflow.md` instead of maintaining a second copy of the flow.

## Common Paths

| Platform | Entry directories |
| --- | --- |
| Cursor | `.cursor/skills/` (preferred); `.cursor/commands/` is legacy compatibility-only |

If a user project still contains legacy platform skill directories (`.claude/skills/`, `.codex/skills/`, etc.), inspect them but route new skill additions to `.cursor/skills/`.

## Add A Project-Local Skill

If the user wants to document team-private customizations, create a project-local skill, for example:

```text
.cursor/skills/project-trellis-local/
└── SKILL.md
```

For shared skill layers across tools, consider `.agents/skills/` on platforms that read that path — but do not extend new Trellis behavior there; new Trellis behavior ships to `.cursor/skills/`.

## Notes

- Do not mix platform-specific syntax from removed adapters into the Cursor skill files.
- Do not change only the dogfooded `.cursor/skills/` copy while forgetting to mirror the published template `packages/cli/src/templates/cursor/skills/` (and vice versa); see `cross-layer-thinking-guide.md.txt` → Cross-Package Template Consistency.
- Do not hide long-term engineering conventions inside a command; write them to `.trellis/spec/`.
