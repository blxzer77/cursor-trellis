# cursor-trellis Release & Coexistence Guide

> **Audience**: Maintainers and agents working on `@blxzer/cursor-trellis` in `D:\MyHarness\cursor-trellis`.  
> **Scope**: npm publish runbook, git tag naming (`cstl-v*`), and upstream Trellis coexistence semantics (0.3.2+).

---

## 1. npm publish runbook (mandatory)

cursor-trellis ships **two** npm packages at the **same version**:

| Package | Role |
| --- | --- |
| `@blxzer/cursor-trellis-core` | SDK (must publish **first**) |
| `@blxzer/cursor-trellis` | CLI (depends on core) |

### Do

```bash
cd D:\MyHarness\cursor-trellis\packages\cli

# 1. Version parity (cli + core package.json must match)
cd ../.. && pnpm release:check

# 2. Optional: dry-run pack shape (rewrites workspace:* in tarball)
node packages/cli/scripts/publish-packages.js --dry-run

# 3. Publish both packages in dependency order
node packages/cli/scripts/publish-packages.js

# 4. Verify registry visibility
node packages/cli/scripts/release-preflight.js verify-npm --package all
```

`publish-packages.js` uses **`pnpm publish`** (not bare `npm publish`). pnpm rewrites `workspace:*` dependencies to the resolved semver (e.g. `"@blxzer/cursor-trellis-core": "0.3.3"`). Bare `npm publish` leaves `workspace:*` in the tarball → **`EUNSUPPORTEDPROTOCOL`** on install.

### Do not

- **`npm publish`** from `packages/cli` alone (0.3.1 incident: cli tarball had `workspace:*`, core was missing).
- Publish cli before core (cli install fails with ETARGET until core exists).
- Skip `prepublishOnly` (runs test + build + copy-release-assets on cli).

### Preflight commands

| Command | Purpose |
| --- | --- |
| `release-preflight.js check-versions` | cli/core version match |
| `release-preflight.js verify-packed-cli` | Packed cli resolves core to exact semver (not `workspace:*`) |
| `release-preflight.js verify-npm` | Post-publish registry check |
| `release-preflight.js publish-plan` | Idempotent CI plan (skip already-published versions) |

### Withdrawn / deprecated versions

- **0.3.1 cli**: withdrawn (unpublish); use **0.3.2+**.
- **0.3.1 core**: cannot unpublish (npm policy); **`npm deprecate`** applied — use `@latest`.

---

## 2. Git tags (`cstl-v*` prefix)

This repo shares git history with legacy `@blxzer/trellis` (1.x). Old tags `v0.3.x`–`v0.6.x` point at **trellis** commits, not cursor-trellis releases.

| Tag pattern | Product | Example |
| --- | --- | --- |
| `v*` (legacy) | `@blxzer/trellis` | `v0.3.2` @ 2026-03 trellis commit |
| **`cstl-v*`** | `@blxzer/cursor-trellis` | `cstl-v0.3.2` @ cursor-trellis release commit |

`packages/cli/scripts/release.js` tags releases as **`cstl-v${version}`** (since 0.3.2 tag-hygiene commit).

`release-preflight tagVersionFromEnv` extracts semver from tag suffix (`cstl-v0.3.2` → `0.3.2`).

**CI publish workflow** (`.github/workflows/publish.yml`): triggers on `push.tags: cstl-v*`. Requires repo secret `NPM_TOKEN`.

Do **not** delete legacy `v*` tags — they are historical trellis releases.

---

## 3. Coexistence with upstream mindfold-ai/Trellis

**Product decision**: Both are workflow frameworks. **Cursor configuration belongs to cursor-trellis**. Upstream Trellis keeps `.trellis/` and non-Cursor platform dirs; cursor-trellis uses `.cstl/` + `.cursor/cstl-*`.

### Scenario matrix

| Scenario | User state | Action |
| --- | --- | --- |
| 1 Pure cstl | Only cursor-trellis (legacy `.trellis/` runtime) | `cstl update --migrate` → rename `.trellis/` → `.cstl/` |
| 2 Coexistence | Upstream `.trellis/` + wants Cursor cstl | `cstl init --cursor` → creates `.cstl/`, **takes over `.cursor/`**, AGENTS dual-block |
| 3 Fresh | Never used either | `cstl init --cursor` → `.cstl/` only |

### `cstl init` coexistence mode

When `.trellis/` exists and `.cstl/` does not:

1. Creates `.cstl/` (does not touch `.trellis/`).
2. **Force-writes** `.cursor/` (hooks, rules, commands) even under `-y`.
3. **AGENTS.md dual-block**: preserves `<!-- TRELLIS:START -->`, adds/refreshes `<!-- CSTL:START -->` (`insertCstlManagedBlock`).
4. Prints banner: do **not** run `cstl update --migrate` (would rename upstream `.trellis/`).

### Migrate gate (`assessCstlDirectoryMigrate`)

Conservative by default for `.trellis/` → `.cstl/` rename:

| Signal | Meaning |
| --- | --- |
| F1 | `.cursor/commands/cstl-*.md` |
| F2 | `.cursor/rules/cstl-triage.mdc` |
| F3 | `.trellis/scripts/common/cli_adapter.py` contains `cstl` |
| U1 | `.claude/agents/trellis-implement.md` |
| U2 | Non-Cursor platform `trellis-*` agents/skills |
| U4 | `.cursor/commands/trellis-*.md` without cstl fingerprint |

- No F fingerprint → **abort** (protect scenario 2).
- F + U mixed → **abort** (manual split).
- Escape: `cstl update --force-cstl-migrate`.

### AGENTS.md hash tracking (block-level)

`.template-hashes.json` stores **CSTL block hash only** for `AGENTS.md`, not the whole file. Upstream edits to TRELLIS block or user content outside CSTL block do **not** trigger "modified" on `cstl update`.

Implementation: `template-hash.ts` → `hashContentForPath` + `extractBlock(CSTL:START/END)`.

### `cstl uninstall` in coexistence repos

- Strips **CSTL block only** (`removeCstlManagedBlock`); keeps TRELLIS block + user content.
- If file was only the CSTL block → deletes `AGENTS.md`.
- Does **not** restore upstream `.cursor/` files overwritten during init (by design: cstl owned Cursor).

---

## 4. Post-release dogfood checklist

```bash
npm install -g @blxzer/cursor-trellis@latest
cstl --version

# Each dogfood project (no --migrate unless upgrading from pre-0.3.1):
cd <project>
cstl update --skip-readiness --skip-all
# Confirm .cstl/.version matches npm latest
```

Sandbox smoke (from empty dir):

```bash
npm init -y && npm install @blxzer/cursor-trellis@latest
npx cstl init --yes --skip-readiness --cursor
```

---

## 5. Related files (source of truth)

| Topic | Path |
| --- | --- |
| Publish orchestration | `cursor-trellis/packages/cli/scripts/publish-packages.js` |
| Release preflight | `cursor-trellis/packages/cli/scripts/release-preflight.js` |
| Tag prefix | `cursor-trellis/packages/cli/scripts/release.js` |
| Coexistence init | `packages/cli/src/commands/init.ts` |
| Migrate gate | `packages/cli/src/utils/workflow-ownership.ts` |
| AGENTS helpers | `packages/cli/src/utils/agents-md.ts` |
| Block-level hash | `packages/cli/src/utils/template-hash.ts` |
| Uninstall strip | `packages/cli/src/commands/uninstall.ts` |

---

**Last updated**: 2026-07-04 (0.3.3 follow-up: uninstall CSTL strip + block hash + this guide).
