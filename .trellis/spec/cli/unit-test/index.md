# Unit Test Guidelines

> Testing conventions and patterns for this project.

---

## Overview

This project uses **Vitest** with TypeScript ESM. Tests live in a centralized `test/` directory mirroring `src/` structure. The goal is fast, reproducible tests with minimal mocking.

---

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Conventions](./conventions.md) | File naming, structure, assertion patterns, test isolation (env-leak guard), when to write tests | Done |
| [Mock Strategies](./mock-strategies.md) | What to mock, how, and the minimal mocking principle | Done |
| [Integration Patterns](./integration-patterns.md) | Function-level integration tests for commands | Done |

---

## Quick Reference

```bash
# Run all tests
pnpm test

# Watch mode
pnpm test:watch

# Run a specific test file
pnpm test test/commands/init.integration.test.ts

# Run with coverage report (terminal + HTML)
pnpm test:coverage
```

---

## Code Coverage

Coverage is generated automatically via `@vitest/coverage-v8`. Configuration is in `vitest.config.ts`.

- **Terminal**: `pnpm test:coverage` prints per-file coverage table
- **HTML report**: `./coverage/index.html` (gitignored, generated on demand)
- **Source scope**: `src/**/*.ts` (excludes `src/cli/index.ts`)

Do **not** maintain a manual coverage table — always run `pnpm test:coverage` for the real numbers.

---

## CI / Pipeline Strategy

| Stage | What Runs | Rationale |
|-------|-----------|-----------|
| **pre-commit** (husky) | `lint-staged` (eslint + prettier) | Keep fast; don't add tests here or developers will skip with `--no-verify` |
| **CI** (GitHub Actions, PR gate) | `pnpm lint` → `pnpm build` → `pnpm test` | Full suite; ~312 tests run in ~1s, no reason to split |

**When to reconsider**: If total test time exceeds 5 minutes, split into fast (unit) and slow (integration) stages. Currently unnecessary.

---

## Pre-Development Checklist

Before writing or improving tests:

1. Read [conventions.md](./conventions.md) — file naming, structure, assertion patterns, when to write tests
2. Read [mock-strategies.md](./mock-strategies.md) — what to mock, how, minimal mocking principle
3. For command-level tests, read [integration-patterns.md](./integration-patterns.md)

---

## Quality Check

After writing tests:

1. Ensure tests follow conventions (naming, structure, assertions)
2. Verify mocking is minimal — prefer real code paths
3. Run validation:
   ```bash
   pnpm lint && pnpm typecheck && pnpm test
   ```
4. Check coverage decisions — report any gaps with rationale

---

**Language**: All documentation should be written in **English**.
