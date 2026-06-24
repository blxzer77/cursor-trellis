# Skill Authoring

## Required Shape

Every active skill directory must contain a `SKILL.md` with YAML frontmatter:

```markdown
---
name: skill-name
description: Specific capability and trigger scenarios.
---
```

Reference examples:

- `skill-creator/SKILL.md` defines the house rules for skill metadata, hard constraints, and workflow shape.
- `chrome-cdp/SKILL.md` shows a concise tool skill with commands, constraints, examples, and a "When NOT to use" boundary.
- `trd-planner/SKILL.md` and `trd-writer-v2/SKILL.md` show multi-phase workflows with explicit gates.

## Local Rules

- Use lowercase letters, numbers, and hyphens in `name`.
- Write `description` in third person and include both what the skill does and when it should trigger.
- Keep `SKILL.md` in English for reliable runtime discovery.
- Put hard constraints before the workflow when the skill has safety or sequencing requirements.
- Prefer imperative one-line rules over buried prose.
- Use progressive disclosure: keep essential routing in `SKILL.md`; move long prompts, examples, and reference material into files directly linked from `SKILL.md`.

## Boundary Rules

- One skill should own one workflow. Split unrelated capabilities into separate directories.
- State when not to use the skill if the trigger could overlap with broader tools.
- For browser or external-session tools, keep user approval boundaries explicit. `chrome-cdp/SKILL.md` is the local pattern: it only applies after the user explicitly asks to inspect or drive a Chrome session.
- Do not duplicate the same rule in several sections. Pick one source of truth.

## Anti-Patterns

- Vague descriptions such as "helps with research" or "utility skill".
- Cross-step shell variables that assume state persists between tool calls.
- Long pasted scripts inside `SKILL.md` when a `scripts/` helper would be more deterministic.
- Skill files that reference missing prompts, examples, or scripts.

