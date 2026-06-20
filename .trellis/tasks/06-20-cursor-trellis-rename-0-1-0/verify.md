# Verify — pre-execution template/npm audit (2026-06-20)

## Question

Do recent Trellis changes reach `src/templates/` so npm install users get the latest behavior?

## Answer (short)

**Not today.** npm `@blxzer/trellis@latest` is still **1.1.2** (matches git tag `42df4033`). **13 commits** after that tag are in git + templates but **not published**. After the next build + publish (planned `@blxzer/cursor-trellis@0.1.0`), new installs will get template content from HEAD — subject to one sync-guard failure noted below.

## Template pipeline (confirmed OK)

```
packages/cli/src/templates/  →  copy-templates.js  →  dist/templates/  →  npm tarball (files: dist)
```

`copy-templates.js` explicitly does **not** copy Trellis repo dogfood `.trellis/` — only `src/templates/` ships.

## What npm 1.1.2 users are missing (in templates + CLI, committed, unreleased)

| Area | In templates @ HEAD? | In npm 1.1.2? |
|------|---------------------|----------------|
| Router v2 (Python + TS) | Yes | No |
| Retrieval evidence / ranking / platform param | Yes | No |
| `.cursor/rules/trellis-triage.mdc` | Yes | No |
| Cursor commands-only + `cursor2plus-setup` | Yes | No |
| session-start hook Triage breadcrumb fix | Yes | No |
| workflow.md Triage hard gate sync | Yes | No |
| `update.ts` non-interactive fail-fast | CLI only | No |
| `release:publish` script | repo only | No |

CHANGELOG `[Unreleased]` section documents the same set.

## Template sync checks run

### Retrieval Python copies (dogfood ↔ template)

Byte-identical for all runtime retrieval scripts:

- `codebase_retrieval_router.py`, `retrieval_evidence.py`, `retrieval_pack.py`, `retrieval_adapter_metadata.py`, `retrieval_pack_context.py`, `git_context.py`, `route_codebase_retrieval.py`

### `check_router_copy_sync.py`

```
[PASS] python-hash, launcher-hash, ts-golden-smoke, py-golden-smoke
[FAIL] ts-py-intent-parity — O3-chinese-policy-signal: TS ['policy-document'] vs PY ['cross-cutting-discovery', 'policy-document']
```

**Blocker for quality gate:** fix TS/Python intent parity before publish.

### Dogfood `.trellis/` vs templates (Trellis repo)

8 non-retrieval Python files differ (dogfood often **older** than template). This does **not** block npm users — templates are ahead for e.g. `task_gates.py` (planning-gates auto-record).

### Templates vs MyHarness harness `.trellis/`

Minor drift on `workflow.md`, `session_context.py`, `developer.py` (local workspace may have been updated at different times). 35/37 template Python files match harness.

## Migration manifest gap

No manifest after `1.1.2.json` for unreleased work. For `@blxzer/cursor-trellis@0.1.0`, baseline `0.1.0.json` must describe the new package line + summarize bundled changes (see implement checklist).

## Recommendation before rename + publish

1. Fix `ts-py-intent-parity` failure in `check_router_copy_sync.py`.
2. Proceed with rename; ship HEAD templates as `@blxzer/cursor-trellis@0.1.0`.
3. Optional: sync Trellis repo dogfood `.trellis/` from templates (dev ergonomics only).

## Publish approval

**Not approved.** Audit only.
