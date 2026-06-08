## Bug Analysis: workflow.md upgrade drift for Codex inline

### 1. Root Cause Category

- **Category**: B. Cross-Layer Contract + C. Change Propagation Failure + D. Test Coverage Gap
- **Specific Cause**: `workflow.md` was treated as prose with a small managed
  `[workflow-state:*]` region, but it is also runtime input for phase extraction
  and platform routing. The Codex inline change updated template markers and
  scripts, while `trellis update` preserved stale marker prose outside
  `[workflow-state:*]` blocks.

### 2. Why Existing Fixes Failed

1. Fresh-init validation passed because the packaged `workflow.md` template
   already contained `[codex-inline]` and `[codex-sub-agent]`.
2. Update validation was incomplete because the regression protected partial
   tag-block merging and did not simulate an older hash-tracked `workflow.md`.
3. The updater's mental model was too narrow: it saw breadcrumb tags as the
   managed runtime surface, but `workflow_phase.py` also consumes headings and
   platform marker blocks outside those tags.

### 3. Prevention Mechanisms

| Priority | Mechanism | Specific Action | Status |
|----------|-----------|-----------------|--------|
| P0 | Architecture | Keep `workflow.md` on the normal whole-file template update path when hash-tracked | DONE |
| P0 | Test Coverage | Add a versioned update scenario that writes the older `.trellis/.version`, stages older pristine template hashes, checks additive config behavior, and preserves skipped user modifications | DONE |
| P1 | Documentation | Document the whole-file update contract in migration and workflow-state specs | DONE |
| P1 | Process | Add cross-layer guide checklist for generated runtime templates: test fresh init and upgrade | DONE |

### 4. Systematic Expansion

- **Similar Issues**: Any template that is both human-facing documentation and
  parser input can drift if the updater preserves prose outside obvious managed
  regions.
- **Design Improvement**: Runtime-parsed templates should default to whole-file
  hash-managed updates. Partial merge needs an explicit parser-by-parser
  compatibility design and upgrade regression.
- **Process Improvement**: Template structure changes must include at least one
  upgrade-path test, not only current-template or fresh-init assertions.

### 5. Knowledge Capture

- [x] Update `.trellis/spec/cli/backend/migrations.md`
- [x] Update `.trellis/spec/cli/backend/workflow-state-contract.md`
- [x] Update `.trellis/spec/guides/cross-layer-thinking-guide.md`
- [x] Sync cross-layer guide template under `packages/cli/src/templates/markdown/spec/guides/`
- [x] Replace obsolete partial-merge regression with whole-file workflow update regression
- [x] Add a broader versioned upgrade scenario test for 0.5.10 -> current behavior
