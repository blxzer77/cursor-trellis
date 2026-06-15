# Handoff: Retrieval Evaluation Harness

## Status

Implementation verified and ready for parent integration review. This harness protects Phase 2/3 retrieval scoring and context packing contracts together.

## Harness Entry Points

Primary suite:

```text
packages/cli/test/scripts/retrieval-eval.integration.test.ts
```

Shared fixtures:

```text
packages/cli/test/scripts/retrieval-eval-fixtures.ts
```

Focused child suites reused by parent validation:

```text
packages/cli/test/scripts/retrieval-evidence.integration.test.ts
packages/cli/test/scripts/context-pack.integration.test.ts
```

## Fixture Model

`seedEvalProject(root)` materializes a temporary Trellis project with:

- generated `.trellis/scripts/*` from template registration;
- selected task `.trellis/tasks/06-13-eval/*`;
- session journal `.trellis/workspace/eval-dev/journal-1.md`;
- Smart Search manifests for `ok`, `degraded`, `failed`, and `not_configured`;
- durable spec artifact for artifact-search coverage.

`buildMixedSourceBundle()` supplies in-memory Phase 2 payloads for all source types without live retrieval.

## Coverage Matrix

| Area | What the harness asserts |
| --- | --- |
| Source coverage | all five Phase 2/3 evidence sources appear in scored output |
| Smart Search states | ok, degraded, failed, not_configured semantics and score caps |
| Session memory | historical context, `unverified`, medium trust |
| Codebase evidence | `validationState: candidate` |
| Missing payloads | `status: missing` for absent source payloads |
| Score ordering | deterministic repeated runs, monotonic score list |
| Ranking policy | task/artifact evidence outrank failed/not_configured Smart Search |
| Context pack budget | `maxItems` trimming, omission reasons, empty pack |
| Determinism | repeated pack builds preserve selected references |
| Side effects | no journal/manifest mutation; no new Smart Search dirs from `get_context --json` |

## Protected Contracts

Future retrieval changes must keep passing:

1. `score_evidence_bundle()` field presence and ordering rules from `retrieval-evidence-scoring/handoff.md`.
2. `build_context_pack()` JSON contract and budget semantics from `retrieval-context-pack-builder/handoff.md`.
3. No implicit retrieval execution during scoring, packing, or guidance-only `get_context` runs.

## No-Side-Effect Guarantees

The harness explicitly checks that eval utilities do not:

- create new Smart Search evidence directories;
- mutate seeded manifests or journals during scoring/packing;
- require network access, MCP tools, or live Smart Search binaries;
- require credentials or external eval services.

## Remaining Gaps / Future Eval Dimensions

Not covered in this harness:

- live web quality benchmarking;
- provider-specific Smart Search output drift across real networks;
- large-repo performance profiling;
- browser/UI retrieval flows.

These are intentionally out of scope for Phase 3 fixture-driven acceptance.

## Parent Validation Command Set

```powershell
cd D:\MyHarness\Trellis
pnpm --filter @blxzer/trellis exec vitest run test/scripts/retrieval-eval.integration.test.ts
pnpm --filter @blxzer/trellis exec vitest run test/scripts/retrieval-evidence.integration.test.ts test/scripts/context-pack.integration.test.ts
pnpm --filter @blxzer/trellis typecheck
```
