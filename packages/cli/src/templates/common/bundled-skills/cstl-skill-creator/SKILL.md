---
name: cstl-skill-creator
description: "Create or improve Trellis-compatible agent skills. Use when the user asks to author a project-local skill, shared .agents skill, platform-specific skill, or upstream Trellis bundled skill."
---

# Trellis Skill Creator

Create high-quality skills for Trellis-managed projects and Trellis bundled templates.

This skill is the authoring and review guide for skill files. It is not the local Trellis architecture map. Use `cstl-meta` first when the user needs to understand or customize `.trellis/`, hooks, settings, commands, prompts, workflows, agents, or platform directory layout.

## Hard Constraints

- Always inspect existing skill directories and platform conventions before creating or changing a skill.
- Always keep `SKILL.md` short, English-language, and focused on trigger, constraints, workflow, references, and boundaries.
- Always use lowercase letters, numbers, and hyphens in the frontmatter `name`.
- Always write a trigger-rich frontmatter `description` that states what the skill does and when it should trigger.
- Always place safety, sequencing, and reliability rules in a `## Hard Constraints` section before `## Workflow`.
- Always move long guidance, examples, prompts, and reference material into directly linked files.
- Always make helper scripts deterministic, runnable from the skill directory, and explicit about inputs and outputs.
- Never duplicate `cstl-meta` architecture guidance or project-private conventions inside a public Trellis skill.
- Never edit Cursor's built-in `create-skill`; create or update Trellis-compatible skill files instead.

## Workflow

1. Classify the target skill location and read `references/cstl-skill-locations.md`.
2. Gather the skill purpose, trigger scenarios, target users, required tools, output shape, and existing local patterns.
3. Draft or revise `SKILL.md` using `references/authoring-rules.md`.
4. Add `references/`, `examples/`, `prompts/`, or `scripts/` only when they reduce entry-file size or make execution more deterministic.
5. Verify the result with `references/review-checklist.md`.
6. Report changed files, validation performed, and any boundaries or follow-up work.

## References

- `references/cstl-skill-locations.md`: Choose project-local, shared, platform-specific, or upstream bundled skill locations.
- `references/authoring-rules.md`: Frontmatter, trigger descriptions, hard constraints, progressive disclosure, deterministic scripts, and anti-patterns.
- `references/review-checklist.md`: Final quality checklist before handing off a skill change.

## When NOT To Use

- Do not use for general Trellis architecture discovery; use `cstl-meta`.
- Do not use for project coding conventions that belong in `.trellis/spec/`.
- Do not use for one-off commands or prompts unless the user wants a durable auto-triggered capability.
- Do not use for non-Trellis global skill installation or platform configuration unless the user explicitly asks for that scope.
