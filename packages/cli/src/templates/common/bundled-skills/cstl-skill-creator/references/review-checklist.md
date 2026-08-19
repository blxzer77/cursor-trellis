# Skill Review Checklist

Use this checklist before handing off a new or modified skill.

## Frontmatter

- [ ] `name` uses lowercase letters, numbers, and hyphens only.
- [ ] `description` is third-person, specific, and includes trigger terms.
- [ ] `description` includes both what the skill does (WHAT) and when to use it (WHEN).
- [ ] The skill name does not collide with a platform built-in helper unless that is intentional.
- [ ] The skill name is specific (`processing-pdfs`), not vague (`helper`, `utils`, `tools`).

## Scope And Boundaries

- [ ] The skill owns one coherent workflow.
- [ ] `When NOT To Use` or equivalent boundary guidance is present when triggers may overlap.
- [ ] Project-private rules are in `.cstl/spec/` or a project-local skill, not in a public bundled skill.
- [ ] The skill distinguishes local project customization from upstream Trellis source changes.
- [ ] Terminology is consistent throughout.

## Entry File

- [ ] `SKILL.md` is concise and under 500 lines.
- [ ] `SKILL.md` is written in English unless the target platform or user explicitly requires another language.
- [ ] `SKILL.md` contains the minimum routing and workflow needed to start.
- [ ] `## Hard Constraints` appears before `## Workflow` when constraints exist.
- [ ] Hard constraints are imperative one-liners (`Always X. Never Y.`).
- [ ] The same rule is not repeated in multiple sections; Hard Constraints is the only rule list.
- [ ] Workflow has an explicit tool-call sequence and stop conditions.
- [ ] Tool usage limits are stated when applicable.

## References And Assets

- [ ] Long guidance lives in directly linked reference files.
- [ ] Every referenced file, script, prompt, or example exists.
- [ ] Reference paths are relative to the skill directory.
- [ ] Examples demonstrate a complete workflow boundary, not just a fragment.

## Scripts

- [ ] Scripts are necessary for determinism, not decorative.
- [ ] Scripts expose only necessary parameters.
- [ ] Scripts do not rely on shell variables or state from a previous tool call.
- [ ] Scripts return structured JSON to stdout when they mutate files or provide machine-readable status.
- [ ] Syntax checks were run for modified scripts when applicable.

## Trellis Template Integration

- [ ] Bundled skills live under `packages/cli/src/templates/common/bundled-skills/`.
- [ ] Tests or structured checks confirm platform skill installation and template hash tracking where relevant.
- [ ] `cstl-meta` references route to this skill where useful without duplicating full authoring rules.
- [ ] `dist/` was not edited as source.
