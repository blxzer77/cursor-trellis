# Contributing

English | [简体中文](contributing.zh-CN.md)

Contributions should leave a small, reviewable change set and evidence that a
maintainer can reproduce. Read the root [CONTRIBUTING.md](../../CONTRIBUTING.md)
for the short checklist.

## Development path

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm typecheck
pnpm lint
```

Run the closest focused tests for the files you changed. The full Core and CLI
suite is the final release preflight; do not claim it ran when it did not.

## Change and review boundaries

- Keep a Task PRD, write set, and acceptance Evidence for durable work.
- Preserve user, foreign, borrowed, and historical files unless the task
  explicitly owns them.
- Do not commit credentials, tokens, private logs, generated personal state,
  or unrelated repository changes.
- For host or Provider work, include mode, readiness, freshness, assurance,
  and the safe fallback in the verification notes.
- A reviewer checks the diff and Evidence read-only; fixes return to Execute.

Use [Support](../../SUPPORT.md) for questions and [Security](security.md) for
private vulnerabilities. Pull requests should use the repository template.
