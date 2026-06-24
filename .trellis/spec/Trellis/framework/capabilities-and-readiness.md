# Capabilities And Readiness

## Capability Registry

Project capability selection is owned by `packages/cli/src/utils/project-capabilities.ts`.

Local pattern:

- Capability ids are registry constants.
- Each capability includes aliases, routing, readiness, fallback, optional adapters, CLI guidance, and MCP server templates.
- Codex TOML uses a managed `TRELLIS:PROJECT-CAPABILITIES` block.
- Claude/Cursor-style MCP JSON should stay limited to portable `command` and `args` fields.
- Codex-specific startup timeout belongs in TOML rendering through `startupTimeoutSec`.

## Readiness Probes

Readiness is evidence, not permission. `packages/cli/src/utils/readiness.ts` checks availability and reports blockers without silently starting unrelated services.

Rules:

- Do not claim MCP, browser, GitHub, or smart-search readiness unless a check actually ran and returned usable evidence.
- Keep missing-capability messages actionable and specific.
- Do not require optional adapters for basic `rg`-based code retrieval.
- Keep credential-bearing work explicit; GitHub remote actions need visible token posture and user intent.

## Codebase Retrieval Evidence Levels

For `codebase-retrieval`, keep adapter output separate from proof:

- Candidate: filenames, semantic recall, initial CodeGraph/LSP output, or
  incomplete exact search. Candidate evidence cannot support final claims.
- Corroborated candidate: current source reads or exact `rg` hits confirm the
  candidate exists in the current checkout.
- Verified claim: current source lines plus Git evidence or focused validation
  support the statement. Use this level for final answers and `verify.md`.
- Unverified / unavailable: adapter output is stale, skipped, unavailable,
  hidden from the host, or not invoked. Report it explicitly instead of
  claiming it.

Record exploratory retrieval chains, adapter availability, freshness checks,
and competing hypotheses in task `research/*.md`. Record final source/Git/test
proof and unresolved adapter gaps in `verify.md`.

### Platform-adaptive routing (v2)

Router version 2 adds `platform` and `projectFileCount` parameters. Routes
now carry `tokenEconomy` labels and `platformNative` flags.

- **Cursor**: semantic routes use `platform-semantic` (sourceFamily) with
  `platformNative: true` instead of `semantic-fast-context`. LSP routes
  also carry `platformNative: true`. Do not use `fast-context` on Cursor;
  its custom embedding model trained on agent session data outperforms
  Devstral-based fast-context.
- **Claude Code / Codex / Generic**: semantic routes use `semantic-fast-context`
  as before.
- **Structural-first**: caller-chain, trap, and extension intents now produce
  codegraph routes before rg follow-up routes, reflecting codegraph's superior
  token economy for structural queries (~80-150 tokens/answer vs ~3557 for
  naive grep).
- **Large project heuristic**: when `projectFileCount > 2000`, the router
  promotes codegraph (AST) routes ahead of rg routes for better token
  efficiency.

Token economy labels per route:
- `high`: codegraph callers/search, platform-semantic (~80-200 tokens/answer)
- `medium`: codegraph explore, smart rg, fast-context (~200-700 tokens/answer)
- `low`: naive rg without constraints (~3000+ tokens/answer)

## Retrieval pack and adapter envelope (#11)

Default `get_context --json` exposes `retrievalGuide` only. Explicit `--mode retrieval-pack` scores **pre-collected** evidence; it does not run adapters. The 13 adapter IDs in `retrieval_adapter_metadata.py` include **integration placeholders** (`mcp`, `browser`, `network`) for envelope completeness—they are not separate retrieval pipelines. See task `06-15-child-phase3-retrieval-review` → `research/retrieval-layer-review.md`.

**Integration vs retrieval adapters:** `mcp`, `browser`, and `network` in the evidence envelope describe host integration surfaces (GitHub MCP, Playwright, network fetch via smart-search)—not standalone codebase-retrieval roles. Daily work uses `rg`, task/artifact search, smart-search CLI, and optional codegraph; do not treat envelope placeholders as required retrieval tools.

## MCP Config Rules

- CodeGraph MCP must start with `serve --mcp`.
- Playwright MCP can need a longer Codex startup timeout.
- Do not put secrets in generated MCP configs.
- Do not add unsupported keys to portable `.mcp.json` / `.cursor/mcp.json` without client evidence.

## Tests

Use:

```powershell
pnpm --filter @blaze/trellis exec vitest run test/utils/project-capabilities.test.ts test/commands/init.integration.test.ts
```

for capability template changes.
