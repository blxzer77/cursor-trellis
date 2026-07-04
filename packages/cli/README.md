# @blxzer/cursor-trellis

[English](README.md) | 简体中文

npm package for the Trellis CLI. Repository overview: [../../README.md](../../README.md). Cursor workflow: [../../docs/workflow.md](../../docs/workflow.md).

**Why `cstl` and `.cstl/`?** The CLI is `cstl` (not `trellis`), and the runtime directory is `.cstl/` (not `.trellis/`), so cursor-trellis can coexist with upstream Trellis in the same repository. See [repository README](../../README.md#why-cstl-and-cstl).

## Install

```bash
npm install -g @blxzer/cursor-trellis
```

Requires **Node.js ≥ 18.17**. Hooks materialized in generated projects need **Python ≥ 3.9** on the machine running Cursor.

## Upgrade from 0.3.0 (v0.3.1)

v0.3.1 moves the cursor-trellis **runtime directory** from `.trellis/` to **`.cstl/`**.

```bash
npm install -g @blxzer/cursor-trellis@latest
cd /path/to/your-app
cstl update --migrate
```

`--migrate` is **required** — history is preserved via directory rename. Script paths become `python ./.cstl/scripts/...`.

## Upgrade from 0.2.x (v0.3.0)

v0.3.0 is a **breaking rename**. The CLI is **`cstl` only** — the `trellis` and `tl` bin aliases are removed.

| Changed | Unchanged |
| --- | --- |
| CLI: `trellis` / `tl` → `cstl` | (0.3.1+) runtime dir is `.cstl/` |
| Skills, commands, agents, rules: `trellis-*` → `cstl-*` | `trellis-task-models.json5` filename |

**Migration steps** (run in each project):

```bash
npm install -g @blxzer/cursor-trellis@latest
cd /path/to/your-app
cstl update --migrate
```

`--migrate` is **required** for the `trellis-*` → `cstl-*` renames under `.cursor/`. Renames are hash-verified; locally modified files are preserved with a warning — manually rename or re-apply customizations to the new `cstl-*` paths.

After 0.3.0, routine CLI bumps can use `cstl upgrade`. The old `trellis upgrade` command no longer exists once you are on 0.3.0.

**Cursor++ BYOK** (optional, `.cstl/local/cursor2plus/` only): update `trellis-task-models.json5` keys from `trellis-research/implement/check` to `cstl-research/implement/check`, then re-run `patch_wpelc8.py --apply`. Use `/cstl-cursor2plus-setup` in Agent mode.

Details: [CHANGELOG](./CHANGELOG.md#030---2026-07-01).

## Executables

| Bin | Purpose |
| --- | --- |
| `cstl` | Initialize, update, and manage Trellis in a project |
| `smart-search` | Bundled web-research CLI (see [smart-search](#smart-search-integration)) |

```bash
cstl --version
smart-search --version
```

## Command summary

| Command | Purpose |
| --- | --- |
| `init` | Create `.cstl/` and platform directories |
| `update` | Sync templates to the installed CLI version |
| `uninstall` | Remove Trellis-managed files from the project |
| `upgrade` | Upgrade the global CLI npm package |
| `rollout` | Batch `update` across multiple project paths |
| `workflow` | Workflow template tooling (advanced) |

**Channel** commands serve advanced multi-agent workflows and are outside Cursor-first public docs. Full list: `cstl --help`.

The sections below detail **`init`**, **`update`**, and **`uninstall`**.

---

## `cstl init`

Run at the **target project root**:

```bash
cstl init --cursor
```

### Platform flags

| Flag | Platform |
| --- | --- |
| `--cursor` | Cursor (`.cursor/`) — default documented path |
| `--cursor2plus` | Cursor++ BYOK local bundle (requires `--cursor`) |

This fork's `init` and public docs are **Cursor-only**: [../../docs/cursor.md](../../docs/cursor.md).

### Common flags

| Flag | Description |
| --- | --- |
| `-y, --yes` | Non-interactive defaults |
| `-f, --force` | Overwrite existing managed files |
| `-s, --skip-existing` | Skip files that already exist |
| `--cursor2plus` | Materialize Cursor++ BYOK bundle (requires `--cursor`) |
| `-u, --user <name>` | Developer identity |
| `--skip-readiness` | Skip smart-search / capability readiness |
| `--capability <id>` | Enable optional capability (repeatable; `all` = all optional) |
| `--workflow <id>` | `.cstl/workflow.md` workflow template |
| `-t, --template <name>` | Remote spec template |
| `-r, --registry <source>` | Custom template registry |
| `--monorepo` / `--no-monorepo` | Monorepo detection override |

### Generated layout

- `.cstl/` — workflow, spec, tasks, workspace, scripts, template hashes
- `AGENTS.md` — managed instruction block
- Platform directory — under Cursor: `.cursor/commands`, `rules`, `agents`, `hooks`, `hooks.json`, `worktrees.json`

---

## `cstl update`

At a project root that already has `.cstl/`:

```bash
cstl update
cstl update --dry-run
```

### Flags

| Flag | Description |
| --- | --- |
| `--dry-run` | Preview only; no writes |
| `-f, --force` | Overwrite all changed managed files |
| `-s, --skip-all` | Skip all changed files |
| `-n, --create-new` | Write `.new` copies for changed files |
| `--migrate` | Apply pending path migrations (rename/delete) |
| `--allow-downgrade` | Allow template version below recorded version |
| `--skip-readiness` | Skip readiness re-check |
| `--json` | Single-line JSON rollout evidence |
| `--skip-post-update-smoke` | Skip post-apply Python smoke script |

Typical flow: upgrade global CLI → enter project → `cstl update` (first jump from 0.2.x to 0.3.0 requires `--migrate`) → review diff if you customized workflow or rules.

---

## `cstl uninstall`

```bash
cstl uninstall
cstl uninstall --dry-run
cstl uninstall -y
```

### Flags

| Flag | Description |
| --- | --- |
| `-y, --yes` | Skip confirmation |
| `--dry-run` | List files that would be deleted/scrubbed only |

Removes managed platform files and `.cstl/` via hash manifest and structured scrubbers. **Back up** custom workflow or rules before uninstalling.

---

## smart-search integration

Trellis integrates with [smart-search](https://github.com/blxzer77/smart-search), a CLI for agents to retrieve current information from the web. smart-search is installed automatically as a dependency when you install cursor-trellis.

**Installation:**

When you install cursor-trellis, smart-search is installed automatically:

```bash
npm install -g @blxzer/cursor-trellis
# smart-search is now available
smart-search --version
```

**Links:**

- npm package: https://www.npmjs.com/package/@blxzer/smart-search
- GitHub repository: https://github.com/blxzer77/smart-search

The workflow routes external fact queries to smart-search when available. See the repository for configuration and usage details.

---

## Maintainer scripts (this package)

For **contributors editing this repository** — end users do not need these:

| Script | Purpose |
| --- | --- |
| `pnpm build` | `tsc` + copy templates |
| `pnpm test` | Vitest |
| `pnpm mirror-check` | Dogfood `.cursor` / `.agents` vs templates |
| `pnpm run sync:smart-search` | Refresh vendor |

Release and npm publish procedures are **not** in the public README; see internal maintainer docs.

---

## Further reading

- [Repository README](../../README.md)
- [Cursor integration](../../docs/cursor.md)
- [Architecture overview](../../docs/architecture.md)
- [CHANGELOG](./CHANGELOG.md)
