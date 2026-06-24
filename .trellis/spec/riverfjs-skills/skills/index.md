# RiverFJS Skills Guidelines

This package is a collection of reusable agent skills, not an application runtime. Future work should treat each top-level directory as a self-contained skill package with its own trigger, instructions, optional scripts, examples, and references.

## Source Areas

- `README.md` and `README.zh-CN.md` list the active skills and their status.
- `*/SKILL.md` is the required skill entrypoint.
- `*/scripts/` contains optional deterministic helpers.
- `*/prompts/`, `*/examples/`, `*/reference.md`, and templates provide progressive context.

## Guides

| Guide | Use When |
| --- | --- |
| [Skill Authoring](./skill-authoring.md) | Creating or modifying any `SKILL.md`. |
| [Scripts And Assets](./scripts-and-assets.md) | Adding helper scripts, prompts, examples, templates, or references. |
| [Quality](./quality.md) | Reviewing a skill for trigger quality, determinism, and stale workflows. |

## Pre-Development Checklist

- Read the target skill's `SKILL.md` before editing supporting files.
- Check `README.md` to confirm whether the skill is active, deprecated, or pending update.
- Preserve English `SKILL.md` instructions unless the skill explicitly targets a local-language output.
- Keep helper scripts deterministic and runnable from the skill directory.
- Do not update deprecated skills such as `trd-writer-full` unless the request explicitly targets legacy reference material.

