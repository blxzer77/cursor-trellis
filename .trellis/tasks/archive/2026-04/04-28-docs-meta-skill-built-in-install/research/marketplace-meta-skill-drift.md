# Research: marketplace trellis-meta drift

- **Query**: 审查 marketplace 里的 `trellis-meta` 示例/说明相对最新版本的误差，并给出更新迭代路径。
- **Scope**: mixed, repo + official GitHub/npm checks.
- **Date**: 2026-04-28

## Sources Checked

| Source | Finding |
|---|---|
| `gh api repos/mindfold-ai/marketplace/commits/main` | Official marketplace `main` is `76a36ea573ed1ff00712f91a326061cc59d34958`, dated 2026-04-03. Local `marketplace` submodule points to the same commit. |
| `gh api repos/mindfold-ai/Trellis/commits/main` | Trellis `main` is `b3fe644a0d9a4ae4180cde61d5818d002333465e`, dated 2026-04-20. |
| `npm view @mindfoldhq/trellis version dist-tags --json` | npm `latest` is `0.4.0`; npm `beta` is `0.5.0-beta.16`. |
| `packages/cli/package.json` | Current branch package version is `0.5.0-beta.16`. |
| `marketplace/skills/trellis-meta/SKILL.md` | Meta-skill still declares `0.4.0-beta.8`, last updated 2026-03-24. |

## Drift Summary

The official marketplace copy is current as a repository snapshot, but the `trellis-meta` content inside it is not current. It mostly documents the 0.4-era Trellis architecture while the active beta line is 0.5.0-beta.16.

Estimated severity:

| Area | Drift | Severity |
|---|---:|---|
| Version header | `0.4.0-beta.8` vs current beta `0.5.0-beta.16`; semantically 22 release entries after beta.8 when including `0.4.0` stable and `0.5.0-beta.0..16`. | High |
| Platform list | Documents 11 platforms, includes removed iFlow, omits Windsurf, GitHub Copilot, Droid, and Pi. Current source has 14 supported tools. | Critical |
| Hook/support matrix | Says Cursor/Kiro/Gemini/Qoder/CodeBuddy have no hooks and manual agents; current 0.5 architecture makes most of them agent-capable and hook-integrated. | Critical |
| Workflow architecture | Still describes dispatch/plan/debug agents, Ralph Loop, `/parallel`, multi-agent pipeline, and `.trellis/worktree.yaml`; these were removed in 0.5. | Critical |
| Task state | Still treats `.trellis/.current-task`, `current_phase`, and `next_action` as active architecture; current source uses session-scoped `.trellis/.runtime/sessions/` and `task.json.status`. | Critical |
| Context setup | Still recommends `task.py init-context`; the subcommand was removed in `0.5.0-beta.12`. Current flow is AI-curated `implement.jsonl` / `check.jsonl`. | Critical |
| Script inventory | Lists removed files: `create_bootstrap.py`, `multi_agent/*`, `phase.py`, `registry.py`, `worktree.py`; misses current `active_task.py` and `workflow_phase.py`. | High |
| Marketplace/docs index | `marketplace/index.json` includes `frontend-fullchain-optimization`; `docs-site/marketplace/index.json` does not. Install pages list it, but the docs-site copied index is stale. | Medium |
| Installation examples | `docs-site/skills-market/trellis-meta.mdx` uses `npx skills add mindfold-ai/marketplace --skill trellis-meta`, which matches the standalone marketplace repo. Main issue is not the install command, but the content installed. | Low |

## Specific Evidence

- `marketplace/skills/trellis-meta/SKILL.md:12-13` declares CLI `0.4.0-beta.8` and update date 2026-03-24.
- `marketplace/skills/trellis-meta/SKILL.md:25-42` has an 11-platform matrix including iFlow.
- `packages/cli/src/types/ai-tools.ts:10-24` defines 14 current platforms: Claude Code, Cursor, OpenCode, Codex, Kilo, Kiro, Gemini, Antigravity, Windsurf, Qoder, CodeBuddy, Copilot, Droid, Pi.
- `packages/cli/src/migrations/manifests/0.5.0-beta.0.json:3-6` says 0.5 removes iFlow, the multi-agent pipeline, Ralph Loop, dispatch/debug/plan agents, and six retired commands.
- `marketplace/skills/trellis-meta/SKILL.md:241-256` still lists `/trellis:start`, `/trellis:parallel`, 17 slash commands, 6 agents, and `ralph-loop.py`.
- `marketplace/skills/trellis-meta/SKILL.md:360-374` still documents dispatch/plan/debug and `plan.py → start.py → Dispatch → implement → check → create-pr`.
- `marketplace/skills/trellis-meta/SKILL.md:481-494` still lists `create_bootstrap.py`, `multi_agent/*`, `.current-task`, and `worktree.yaml`.
- `packages/cli/src/templates/trellis/workflow.md:76` documents the current session-scoped task pointer under `.trellis/.runtime/sessions/`.
- `packages/cli/src/templates/trellis/workflow.md:253-289` documents current Phase 1.3 JSONL curation.
- `packages/cli/src/templates/trellis/scripts/task.py:337-343` explicitly errors on `task.py init-context`.

## Recommended Update Strategy

### 1. Replace stale architecture, not patch individual lines

The drift is architectural, not a handful of typos. Rewriting `trellis-meta` around 0.5 is safer than incrementally editing the old 0.4 doc.

Target structure:

- `Version Compatibility`: split stable (`0.4.0`) and beta (`0.5.0-beta.16`) expectations.
- `Platform Compatibility`: generate from `packages/cli/src/types/ai-tools.ts` concepts, not hand-maintained counts.
- `Workflow`: mirror `packages/cli/src/templates/trellis/workflow.md`.
- `Tasks`: mirror current `task.json` shape from `task_store.py`, session-scoped active task behavior from `active_task.py`, and Phase 1.3 JSONL curation.
- `Agents`: document only current `trellis-research`, `trellis-implement`, `trellis-check` defaults plus skill routing.
- `Removed/Legacy`: move Ralph Loop, multi-agent pipeline, iFlow, dispatch/plan/debug into a migration appendix instead of presenting them as current.

### 2. Delete or quarantine obsolete reference docs

High-risk obsolete files:

- `references/claude-code/multi-session.md`
- `references/claude-code/ralph-loop.md`
- `references/claude-code/worktree-config.md`
- `references/claude-code/scripts.md`
- `references/claude-code/agents.md`
- `references/how-to-modify/add-phase.md`
- `references/how-to-modify/modify-hook.md`

Do not keep them under current reference names. Either remove them or move them to `references/legacy/0.4/` with a clear warning.

### 3. Update install/docs metadata after content correction

- Keep `npx skills add mindfold-ai/marketplace --skill trellis-meta` as the primary install command.
- Update `marketplace/README.md`, which still says "Claude Code users" and old `mindfold-ai/Trellis/marketplace` install.
- Sync `docs-site/marketplace/index.json` with `marketplace/index.json`, including `frontend-fullchain-optimization`.
- Add a "tested against Trellis beta" note to `docs-site/skills-market/trellis-meta.mdx`.

### 4. Add automated drift checks

Add a lightweight audit script or test that fails when:

- `trellis-meta` platform count/names differ from `AI_TOOLS`.
- `trellis-meta` version is older than `packages/cli/package.json`.
- reference docs mention known removed primitives: `.iflow`, `ralph-loop.py`, `multi_agent/`, `worktree.yaml`, `dispatch`, `plan`, `debug`, `task.py init-context`, `.trellis/.current-task` as the active pointer.
- docs-site marketplace index differs from marketplace index after path-prefix normalization.

## Caveats

- npm `latest` remains `0.4.0`; npm `beta` is `0.5.0-beta.16`. If the product decision is to keep marketplace `trellis-meta` stable-only until 0.5.0 stable, then the skill still needs a prominent "0.4 stable" label and a separate beta branch or beta warning. Current wording does neither.
- The installed marketplace repo is official/latest as of 2026-04-28; the issue is content drift inside that repo, not submodule lag.
