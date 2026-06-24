# Release And Vendor

## Workspace Scripts

Root scripts orchestrate core and CLI packages:

- `pnpm build` builds `@blaze/trellis-core` and `@blaze/trellis`.
- `pnpm test` runs both test suites.
- `pnpm typecheck` builds core before CLI typecheck.

CLI package scripts handle build, postinstall, smart-search vendor sync/check, release, and manifest generation.

## Smart Search Vendor

The CLI package vendors Smart Search under `packages/cli/vendor/smart-search/` and exposes a `smart-search` bin. Treat this as a package contract:

- Do not commit runtime cache directories such as `.smart-search-python`, `build/`, or `*.egg-info` unless a task explicitly changes packaging fixtures.
- Use `pnpm --filter @blaze/trellis check:smart-search` when vendor drift matters.
- Keep bundled skill assets synchronized between vendored source and Trellis templates.
- The postinstall path can create local runtime files; avoid mistaking those for source changes.

## Release Rules

- Use existing release scripts instead of hand-editing tags or package metadata.
- Do not publish, tag, or push without explicit user instruction.
- Release changes should run targeted preflight tests and document any skipped checks.

## Readiness vs execution (Trellis workflow)

Split release work into two durable tasks (templates under `.trellis/tasks/templates/`):

| Phase | Task template | Allowed actions |
| --- | --- | --- |
| Readiness | `release-readiness/` | Recommend version, draft changelog, manifest notes, build, focused tests, typecheck, `npm pack --dry-run`, `release-preflight.js` check/plan/verify-packed-cli |
| Execution | `release-execution/` | After explicit user approval: bump (if needed), `release.js`, tag, push, `npm publish`, post-publish `verify-npm` smoke |

Release posture labels for `handoff.md` / `verify.md`: **ready to publish**, **not published**, **published**, **blocked**, **waived**, **deferred**. Readiness must never record **published**; execution must record **Publish approval evidence** before any remote mutation.

Workflow detail: `.trellis/workflow.md` → **Release readiness and release execution**.

