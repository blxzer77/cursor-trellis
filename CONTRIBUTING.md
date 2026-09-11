# Contributing to Pactile

English | [简体中文](docs/governance/contributing.zh-CN.md)

Pactile contributions should be small, reproducible, and explicit about their
host and evidence boundaries. Start from a clean project checkout and keep
unrelated dirty worktree changes out of the patch.

## Setup and checks

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

For a focused change, run the closest package or conformance test and report
exactly what was skipped. The complete Core and CLI suite is the final release
preflight; a local change must not claim that gate unless it actually ran.

## Pull request contract

- Describe the user outcome and the bounded write set.
- Keep durable work in a Task with PRD, design/implementation contract, and
  `verify.md` Evidence.
- Preserve user, foreign, borrowed, and historical resources. Do not rewrite
  published changelog, manifests, tags, or archived Evidence.
- For host or Provider changes, record origin/mode, readiness, freshness,
  assurance, fallback, and ownership impact.
- Do not commit credentials, tokens, private logs, generated personal state, or
  unrelated files.
- Use dry-run and preview fingerprints before destructive operations. Do not
  publish, tag, or mutate a remote from a normal contribution.

Review is a read-only claim about the diff and Evidence. If review finds a
problem, repair it in Execute and update the Evidence before asking again.
