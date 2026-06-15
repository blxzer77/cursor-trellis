# PRD: Clean CLI npm pack Smart Search artifacts

## Problem

`npm pack --dry-run` for `packages/cli` includes generated Smart Search artifacts under `vendor/smart-search/` because `package.json` `files` lists the whole directory recursively.

## Goals

- Pack only vendored Smart Search **source** required by `scripts/postinstall.js` and `vendor/smart-search/npm/scripts/postinstall.js`.
- Exclude runtime venv (`.smart-search-python`), `build/`, `*.egg-info`, `__pycache__/`, `*.pyc`.

## Non-goals

- No publish, tag, push, or version bump.
- No change to postinstall behavior or vendor sync semantics.

## Acceptance criteria

- `npm pack --dry-run` lists none of the excluded artifact patterns.
- Required vendor paths (pyproject, npm postinstall, Python package source) remain in the tarball.
- `verify-packed-cli`, build, typecheck pass.
- Regression test or pack-file guard aligned with `collectSmartSearchVendorFiles`.

## Package

`@blxzer/trellis` (`packages/cli`)