# Skill Authoring Rules

Use these rules when creating or reviewing a Trellis-compatible skill.

## Required Shape

Every active skill directory needs a `SKILL.md` with YAML frontmatter:

```markdown
---
name: skill-name
description: Specific capability and trigger scenarios.
---
```

Rules:

- Use lowercase letters, numbers, and hyphens in `name`.
- Write `description` in third person because platforms inject it into tool or skill discovery prompts.
- Include both what the skill does and when it should trigger.
- Keep `SKILL.md` under 500 lines and usually far shorter.
- Keep `SKILL.md` in English unless the target platform or user explicitly requires another language.

## Description Quality

The description is the trigger surface. It should contain concrete task nouns and user-intent phrases.

Good:

```yaml
description: "Create or improve Trellis-compatible agent skills. Use when the user asks to author a project-local skill, shared .agents skill, platform-specific skill, or upstream Trellis bundled skill."
```

Avoid:

```yaml
description: "Helps with skills."
```

Checklist:

- Names the capability.
- Names common trigger situations.
- Avoids first person.
- Avoids broad utility wording such as "helper", "tools", or "useful".
- Does not claim support for platforms or files the skill does not cover.

## Hard Constraints

Put a `## Hard Constraints` section near the top, before `## Workflow`, when the skill has safety, sequencing, scope, or reliability rules.

Write constraints as imperative one-liners:

- Always inspect local files before editing.
- Never modify global configuration without explicit user approval.
- Always run the validator before final output.

Do not bury constraints in paragraphs. Do not repeat the same rule in another section; make Hard Constraints the single source of truth.

## Progressive Disclosure

`SKILL.md` should route, not carry every detail.

Good candidates for references:

- Detailed authoring rules.
- Domain background.
- Long examples.
- Output templates.
- Platform-specific notes.
- Review checklists.

Keep references one level deep and link them directly from `SKILL.md`. Avoid reference chains where one reference requires reading another reference before it is useful.

## Deterministic Scripts

Add scripts only when they make the skill more reliable than generated ad hoc code.

Script rules:

- Put scripts under the owning skill directory, usually `scripts/`.
- Expose only parameters the agent must supply.
- Let the script decide internal paths, timestamps, defaults, and output filenames when possible.
- Return structured JSON to stdout when the script mutates files or produces machine-readable status.
- State whether the agent should execute the script or read it as reference.
- Avoid shell variables or cross-step state that would not survive separate tool calls.

## Common Anti-Patterns

- Vague frontmatter descriptions that can trigger on unrelated work.
- A single skill that mixes unrelated workflows.
- `SKILL.md` files that paste long prompts or full scripts instead of linking references.
- Rules repeated in several sections with slightly different wording.
- Missing stop conditions for broad search or expensive loops.
- Commands that rely on shell variables set by a previous tool call.
- References to files, scripts, or examples that do not exist.
- Project-private conventions added to public Trellis bundled skills.
