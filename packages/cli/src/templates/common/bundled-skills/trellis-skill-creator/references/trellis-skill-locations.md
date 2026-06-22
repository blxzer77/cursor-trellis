# Trellis Skill Locations

Choose the target directory before writing content. Local files are authoritative when they already exist.

## Location Decision Table

| User goal | Default location | Notes |
| --- | --- | --- |
| Add a skill for one Trellis project on Cursor | `.cursor/skills/<skill-name>/` | Default target — Trellis is Cursor-only. |
| Add a skill shared across tools that read the agentskills.io convention | `.agents/skills/<skill-name>/` | Use only when explicitly sharing with a non-Trellis tool that reads the shared agentskills layer. New Trellis behavior stays in `.cursor/skills/`. |
| Change an existing local Trellis skill | The existing skill directory in the user's project | Preserve local customizations and read the current `SKILL.md` first. |
| Add a public Trellis bundled skill | `packages/cli/src/templates/common/bundled-skills/<skill-name>/` | Only when working in the Trellis source repository. Update tests that assert bundled skill installation and template tracking. |
| Add a personal cross-project skill | User's configured global skills directory | Requires explicit user approval because it changes global behavior outside the project. |

## Relationship To `trellis-meta`

Use `trellis-meta` to understand where local Trellis files live and which platform entry point should be changed.

Use `trellis-skill-creator` after the task is clearly about authoring or reviewing the content of a skill:

- frontmatter quality
- trigger descriptions
- hard constraints
- workflow shape
- references
- examples
- deterministic scripts
- final quality review

Do not copy the full skill-writing guide into `trellis-meta`. `trellis-meta` should route to this skill for detailed authoring guidance.

## Relationship To Cursor `create-skill`

Cursor may provide its own built-in `create-skill` helper. Treat it as a platform-owned helper, not as Trellis source material to edit.

For Trellis work:

- Use `trellis-skill-creator` for Trellis-compatible content and multi-platform boundaries.
- Keep the skill name `trellis-skill-creator` to avoid colliding with Cursor's built-in skill.
- If a user explicitly asks for Cursor-only behavior, write to the local `.cursor/skills/` directory and follow the platform's current file format.

## Upstream Bundled Skill Notes

When adding or modifying a bundled skill in the Trellis source repository:

- Do not edit `dist/` directly.
- Keep the bundled skill public and project-agnostic.
- Put the skill under `packages/cli/src/templates/common/bundled-skills/`.
- Include a short `SKILL.md` and lazy-loadable references when the guidance is long.
- Search for hard-coded bundled skill lists or tests before editing.
- Update `trellis-meta` only to route users to the new skill where appropriate.
- Validate template collection, platform installation, and hash tracking with focused tests.
