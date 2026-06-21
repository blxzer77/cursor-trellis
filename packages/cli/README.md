# @blxzer/cursor-trellis

English | [简体中文](README.zh-CN.md)

npm package for the Trellis CLI. Project overview: [../../README.md](../../README.md). Cursor workflow: [../../docs/workflow.md](../../docs/workflow.md).

## Install

```bash
npm install -g @blxzer/cursor-trellis
```

Requires **Node.js ≥ 18.17**. Generated project hooks expect **Python ≥ 3.9** on the machine where Cursor runs hooks.

## Binaries

| Bin | Alias | Role |
| --- | --- | --- |
| `trellis` | `tl` | Initialize, update, and manage Trellis in a project |
| `smart-search` | — | Vendored web-research CLI (see [smart-search](#smart-search)) |

```bash
trellis --version
smart-search --version
```

## Command reference (summary)

| Command | Purpose |
| --- | --- |
| `init` | Create `.trellis/` and selected platform trees |
| `update` | Sync templates to the installed CLI version |
| `uninstall` | Remove Trellis-managed files from the project |
| `upgrade` | Upgrade the global CLI npm package |
| `rollout` | Run `update` across multiple project paths |
| `workflow` | Workflow template utilities (advanced) |

Commands related to **mem** and **channel** exist for other workflows; they are not part of the Cursor-first public docs. Use `trellis --help` for the full list.

The sections below detail **`init`**, **`update`**, and **`uninstall`**.

---

## `trellis init`

Run from the **target project root**.

```bash
trellis init --cursor
```

### Platform flags (selection)

| Flag | Platform |
| --- | --- |
| `--cursor` | Cursor (`.cursor/`) |
| `--claude` | Claude Code |
| `--codex` | Codex |
| `--opencode`, `--gemini`, `--kiro`, … | Other platforms (see `trellis init --help`) |

This fork documents **Cursor** in depth: [../../docs/cursor.md](../../docs/cursor.md).

### Frequently used flags

| Flag | Description |
| --- | --- |
| `-y, --yes` | Non-interactive defaults |
| `-f, --force` | Overwrite existing managed files |
| `-s, --skip-existing` | Skip files that already exist |
| `--cursor2plus` | Materialize Cursor++ BYOK bundle (requires `--cursor`) |
| `-u, --user <name>` | Set developer identity |
| `--skip-readiness` | Skip smart-search / capability readiness checks |
| `--capability <id>` | Enable optional project capability (repeatable; `all` for all) |
| `--workflow <id>` | Workflow template for `.trellis/workflow.md` |
| `-t, --template <name>` | Remote spec template |
| `-r, --registry <source>` | Custom template registry |
| `--monorepo` / `--no-monorepo` | Monorepo detection override |

### What gets generated

- `.trellis/` — workflow, spec, tasks, workspace, scripts, template hashes
- `AGENTS.md` — managed instructions block
- Platform dirs — for Cursor: `.cursor/commands`, `rules`, `agents`, `hooks`, `hooks.json`, `worktrees.json`

---

## `trellis update`

Run from a project that already has `.trellis/`.

```bash
trellis update
trellis update --dry-run
```

### Flags

| Flag | Description |
| --- | --- |
| `--dry-run` | Preview changes without writing |
| `-f, --force` | Overwrite all changed managed files |
| `-s, --skip-all` | Skip all changed files |
| `-n, --create-new` | Write `.new` copies for changed files |
| `--migrate` | Apply pending path migrations (renames/deletes) |
| `--allow-downgrade` | Allow template version older than recorded |
| `--skip-readiness` | Skip readiness re-check |
| `--json` | One-line JSON rollout evidence |
| `--skip-post-update-smoke` | Skip post-apply Python smoke scripts |

Typical flow: upgrade global CLI (`npm update -g @blxzer/cursor-trellis`), `cd` to project, `trellis update`, review diff especially if you customized `.trellis/workflow.md` or `.cursor/rules`.

---

## `trellis uninstall`

```bash
trellis uninstall
trellis uninstall --dry-run
trellis uninstall -y
```

### Flags

| Flag | Description |
| --- | --- |
| `-y, --yes` | Skip confirmation |
| `--dry-run` | List planned deletions and structured scrubs only |

Removes Trellis-managed platform files and `.trellis/` per hash manifest and scrubbers. **Back up** customized workflow or rules before uninstalling.

---

## smart-search

Shipped inside this package (`vendor/smart-search/`, bin `smart-search`).

| Topic | Detail |
| --- | --- |
| What it is | CLI for search, fetch, doctor, and research—not an MCP server |
| When agents use it | Project `.trellis/workflow.md` routes external facts to smart-search first when healthy |
| Setup | `smart-search setup` and `smart-search doctor` (see [vendor README](vendor/smart-search/README.md)) |
| Readiness | `init` / `update` check unless `--skip-readiness` |

```bash
smart-search search "query" --format json
smart-search doctor --format markdown
```

Updating the vendored snapshot is a maintainer task (`pnpm run sync:smart-search` in this package). See [../../docs/maintainers.md](../../docs/maintainers.md).

---

## Maintainer scripts (this package)

For contributors editing **this repo**—not required for end users:

| Script | Purpose |
| --- | --- |
| `pnpm build` | `tsc` + copy templates |
| `pnpm test` | Vitest |
| `pnpm run sync:smart-search` | Refresh vendor tree |

Release and npm publish procedures are **not** documented in public READMEs; see internal maintainer docs.

---

## See also

- [Project README](../../README.md)
- [Cursor integration](../../docs/cursor.md)
- [Architecture](../../docs/architecture.md)
- [CHANGELOG](./CHANGELOG.md)