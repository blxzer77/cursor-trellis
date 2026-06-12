# Skill Review Checklist

Use this checklist before handing off a new or modified skill.

## Frontmatter

- [ ] `name` uses lowercase letters, numbers, and hyphens only.
- [ ] `description` is third-person and trigger-rich.
- [ ] `description` includes both what the skill does and when to use it.
- [ ] The skill name does not collide with a platform built-in helper unless that is intentional.

## Scope And Boundaries

- [ ] The skill owns one coherent workflow.
- [ ] `When NOT To Use` or equivalent boundary guidance is present when triggers may overlap.
- [ ] Project-private rules are in `.trellis/spec/` or a project-local skill, not in a public bundled skill.
- [ ] The skill distinguishes local project customization from upstream Trellis source changes.

## Entry File

- [ ] `SKILL.md` is concise and under 500 lines.
- [ ] `SKILL.md` contains the minimum routing and workflow needed to start.
- [ ] `## Hard Constraints` appears before `## Workflow` when constraints exist.
- [ ] Hard constraints are imperative one-liners.
- [ ] The same rule is not repeated in multiple sections.

## References And Assets

- [ ] Long guidance lives in directly linked reference files.
- [ ] Every referenced file, script, prompt, or example exists.
- [ ] Reference paths are relative to the skill directory.
- [ ] Examples demonstrate a complete workflow boundary, not just a fragment.

## Scripts

- [ ] Scripts are necessary for determinism, not decorative.
- [ ] Scripts expose only necessary parameters.
- [ ] Scripts do not rely on shell variables or state from a previous tool call.
- [ ] Scripts return structured JSON when they mutate files or provide machine-readable status.
- [ ] Syntax checks were run for modified scripts when applicable.

## Trellis Template Integration

- [ ] Bundled skills live under `packages/cli/src/templates/common/bundled-skills/`.
- [ ] Tests or structured checks confirm platform skill installation and template hash tracking where relevant.
- [ ] `trellis-meta` references route to this skill where useful without duplicating full authoring rules.
- [ ] `dist/` was not edited as source.
