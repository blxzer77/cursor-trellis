# review PR #271 (CLAUDE.md root file for claudecode init)

## Goal

Review external contributor PR #271 end-to-end and decide:
1. **Approve / request changes / approve-with-comments**
2. Whether the author's secondary question about destructive uninstall
   needs a separate fix beyond what they already shipped in commit 2.
3. Whether to merge as-is or request follow-ups (rename helpers,
   migration note for existing users, etc.)

## PR summary

**PR**: <https://github.com/mindfold-ai/Trellis/pull/271>
**Author**: kkz-01
**Base/Head**: main → main (contributor's fork, no feature branch)
**Stats**: 10 files, +277 / -53
**Commits**:
- `45e3312` fix(claudecode): 初始化 Claudecode 时使用 CLAUDE.md
- `fc8ba16` fix: 修复初始化 CLAUDE 将 AGENTS.md 写入 .template-hashes.json 问题
  (author's own follow-up addressing the destructive-uninstall concern they raised)

### Core change

- New type `RootInstructionFile = "AGENTS.md" | "CLAUDE.md"`
- `AIToolConfig.rootInstructionFile` per platform:
  - `claude-code` → `"CLAUDE.md"`
  - all others (codex, cursor, opencode, kiro, gemini, antigravity,
    windsurf, qoder, codebuddy, copilot, droid, pi, kilo) → `"AGENTS.md"`
- `init.ts`: `createRootFiles(cwd, fileList)` accepts which root files
  each selected platform needs, dedupes via Set
- `update.ts`: `buildRootInstructionTemplate(cwd, fileName)` /
  `collectMissingRootInstructionHashes` are generic over both files;
  `BACKUP_FILES` includes both
- `template-hash.ts`: `TEMPLATE_FILES = Set{AGENTS.md, CLAUDE.md}`;
  `initializeHashes(cwd, rootTemplateFiles)` only hashes the files
  the active platform actually owns (this is the destructive-uninstall fix)
- `paths.ts`: adds `FILE_NAMES.CLAUDE = "CLAUDE.md"`

### Test coverage in the PR (good)

- `init #2b`: Claude-only init with pre-existing AGENTS.md → user's
  content preserved, NOT hash-tracked
- `init #3c`: re-init adding Claude creates CLAUDE.md
- `init #3`: multi-platform creates both files
- `uninstall #3b`: Claude-only uninstall preserves a pre-existing
  untracked AGENTS.md (key safety test)
- `update #4e`: auto-updates CLAUDE.md preserving outside content
- `ai-tools.test.ts`: registry consistency

## My review findings

### Approve points

- ✅ Author recognized + fixed the destructive-uninstall concern in
  commit 2 (`fc8ba16`). The fix lives in `initializeHashes`: only files
  the active platforms own get hashed → pre-existing user AGENTS.md
  on a Claude-only install is NOT hash-tracked → uninstall won't
  touch it.
- ✅ Tests directly cover the "user had AGENTS.md before Trellis init"
  scenario. The safety guarantee is verified end-to-end.
- ✅ Type-system change is clean and forward-compatible (no breaking
  signatures except `initializeHashes`, which is internal).
- ✅ Backward-compat for existing AGENTS.md-tracked installs:
  `update.ts:collectMissingRootInstructionHashes` accepts either file,
  so existing Claude installs keep their AGENTS.md (no forced
  migration). Reasonable choice.

### Open questions / suggested follow-ups (NOT blockers)

1. **`agentsMdContent` variable name**: The content is now used for
   both AGENTS.md and CLAUDE.md, but the import / variable name still
   says "agents". A rename to `rootInstructionsContent` (or similar)
   would clarify, but it's cosmetic — leave for a separate cleanup.

2. **Migration for existing Claude users**: A user who set up Trellis
   when AGENTS.md was the only option keeps AGENTS.md after upgrade —
   they won't auto-acquire CLAUDE.md. If they want the new convention,
   they'd need to manually `rm AGENTS.md` and re-run `trellis init`
   (or we'd ship a migration manifest later). Document the upgrade
   semantic in CHANGELOG / release notes.

3. **Multi-platform Claude + Codex**: User who selects both gets two
   files with identical content. Is the intent that the two files
   stay in lockstep? If so, document. If not (Claude actually uses
   CLAUDE.md as its preamble while AGENTS.md is for Codex), they may
   eventually diverge. Either way, leave as-is for this PR.

4. **Test coverage gap**: "user has AGENTS.md + selects Codex" — the
   user's AGENTS.md gets adopted by Trellis. This is by design (the
   user explicitly opted into Trellis managing AGENTS.md when picking
   Codex), but a test asserting "this is the intentional behavior"
   would close the safety story. Not required for this PR.

## Recommendation

**Approve, suggest follow-ups in a review comment** — the PR is correct
and well-tested. Author already addressed their own concern. Variable
rename + migration note for changelog can come later.

## Out of scope (explicit)

- Renaming `agentsMdContent` → `rootInstructionsContent` (cosmetic
  cleanup; doable in a follow-up commit)
- Migration manifest to auto-move existing Claude installs from
  AGENTS.md → CLAUDE.md (would need explicit user consent + safer
  semantics; out of this PR's scope)
- Test for "AGENTS.md + Codex" adoption (covered by existing
  AGENTS.md behavior, not regressed)

## Acceptance Criteria

- [ ] PR is reviewed end-to-end (every diff hunk verified)
- [ ] Decision recorded (approve / changes / approve-with-comments)
- [ ] If approving with comments: review comment drafted + posted via
      `gh pr review 271 --approve --body "..."`
- [ ] If user wants to merge: merge done via `gh pr merge 271`

## Open questions for user

1. **Approve as-is** or **request changes** (e.g., rename
   `agentsMdContent`)?
2. After review: who **merges** the PR — you, or do I run
   `gh pr merge 271 --squash`?
3. **Reply to author's comment** (acknowledging their follow-up
   addressed their own concern) in the review body, or as a separate
   PR comment?

## Definition of Done

- Review decision posted to GitHub
- (Optional) Follow-up task opened for any cleanup items decided
  during review
