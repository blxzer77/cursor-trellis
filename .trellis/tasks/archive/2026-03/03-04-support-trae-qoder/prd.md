# Task: support-trae-qoder

## Overview
Add Qoder as a new skills-based platform in Trellis. Trae was originally planned but dropped after research.

## Result

### Qoder (completed)
- Skills-based platform (like Codex/Kiro), configDir: `.qoder`, CLI: `qodercli`
- Template structure: `src/templates/qoder/skills/{name}/SKILL.md` (YAML frontmatter)
- `getAllSkills()` + `collectTemplates` returns `.qoder/skills/{name}/SKILL.md` paths
- Added to cli_adapter.py, plan.py/start.py `--platform` choices
- PR: #71

### Trae (dropped)
Trae was dropped after research revealed it's unsuitable for Trellis:

1. **No deterministic invocation trigger**: Trae skills (`.trae/skills/{name}/SKILL.md`) are invoked by AI-automatic matching or manual mention in chat — no slash command syntax like `/trellis:start`
2. **IDE-only**: No CLI executable, cannot run headless agents for multi-agent pipeline
3. **Incompatible workflow model**: Trellis relies on deterministic command triggers to enforce workflow (e.g., `/trellis:start` before coding, `/trellis:finish-work` before commit). Without deterministic triggers, the workflow cannot be enforced

**Research sources**:
- Official docs: `docs.trae.ai/ide/skills` — confirms skills are AI-matched, no slash command
- GitHub: No official CLI tool or command extension mechanism found
- The `.trae/commands/` pattern seen in some repos (e.g., OpenSpec) is a third-party convention, not official Trae support

**Lesson learned**: Always research platform capabilities from official docs before writing PRD. The original PRD assumed Trae uses commands (like Kilo) and Qoder uses commands — both assumptions were wrong. Trae uses skills (but non-deterministic), Qoder uses skills (with YAML frontmatter).

## Original Requirements (for reference)

### Files Created
- `src/configurators/qoder.ts` — skills-based configurator
- `src/templates/qoder/index.ts` — `getAllSkills()`
- `src/templates/qoder/skills/*/SKILL.md` — 14 skills
- `test/templates/qoder.test.ts` — skills test

### Files Modified
- `src/types/ai-tools.ts` — `qoder` in unions + AI_TOOLS record
- `src/configurators/index.ts` — import + PLATFORM_FUNCTIONS entry
- `src/templates/extract.ts` — `getQoderTemplatePath()`
- `src/cli/index.ts` — `--qoder` option
- `src/commands/init.ts` — `qoder?` in InitOptions
- `src/templates/trellis/scripts/common/cli_adapter.py` — all method branches
- `src/templates/trellis/scripts/multi_agent/plan.py` — `--platform` choices
- `src/templates/trellis/scripts/multi_agent/start.py` — `--platform` choices
- `README.md` / `README_CN.md` — updated tool count
- Tests: platforms.test.ts, init.integration.test.ts, extract.test.ts, regression.test.ts

## Acceptance Criteria
- [x] `pnpm build` compiles without errors
- [x] `pnpm lint` + `pnpm typecheck` pass
- [x] `pnpm test` — 397 passed (2 pre-existing failures unrelated)
- [x] `trellis init --qoder` creates `.qoder/skills/` with SKILL.md files
- [x] No compiled artifacts in output
- [x] collectTemplates returns correct `.qoder/skills/` paths
- [x] cli_adapter.py has explicit qoder branches in all methods
- [x] Trae fully removed from codebase
