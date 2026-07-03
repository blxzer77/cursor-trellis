# minimal-agent-app

A **5-minute** walkthrough of `@blxzer/cursor-trellis` on an empty application directory. This folder is a placeholder app root — Trellis is not initialized here by default. The demo scripts create a fresh workspace, run `cstl init`, validate rules, and print the generated tree.

Based on the [Trellis framework by mindfold-ai](https://github.com/mindfold-ai/Trellis); this fork targets **Cursor** (rules, commands, agents, hooks).

## Prerequisites

- **Node.js** ≥ 18.17
- **Python** ≥ 3.9 (Trellis hooks and scripts)
- **smart-search** — installed automatically with `npm install -g @blxzer/cursor-trellis`, or use `--skip-readiness` (see scripts)

## Option A — global CLI

```bash
npm install -g @blxzer/cursor-trellis
cd examples/minimal-agent-app
./demo.sh          # macOS / Linux / Git Bash
# or
./demo.ps1         # Windows PowerShell
```

## Option B — from this monorepo (contributors)

```bash
# repo root
pnpm install && pnpm build
cd examples/minimal-agent-app
./demo.sh          # auto-detects ../../packages/cli/bin/cstl.js
```

## What the demo does

1. Creates a clean `_demo-workspace/` directory (gitignored).
2. Runs `cstl init --cursor -y`.
3. Runs `cstl validate-rules` (templates + installed `.cursor/rules`).
4. Lists `.cstl/`, `.cursor/`, and `AGENTS.md`.

Expected output ends with a tree similar to:

```text
_demo-workspace/
  .cstl/          workflow, spec, tasks, scripts
  .cursor/           rules, commands, agents, hooks
  AGENTS.md
```

## Next steps (manual, in Cursor)

1. Open `_demo-workspace/` in Cursor Agent mode.
2. Create a task: `python .cstl/scripts/task.py create "Hello Trellis" --slug hello`.
3. Use `/cstl-continue` to resume; Request Triage is enforced via `.cursor/rules/cstl-triage.mdc`.

See [docs/workflow.md](../../docs/workflow.md) and [docs/cursor.md](../../docs/cursor.md).

## Notes

- Examples are **not** shipped in the npm package (`packages/cli/package.json` `files` field).
- Do not run `cstl init` inside the **cursor-trellis source tree** — use this example or your own app repo.
