# Source Map

## Task Artifacts

- `.trellis/tasks/06-08-personal-skills-trellis-refactor/prd.md`
  - Requirements, non-goals, user-facing behavior, acceptance criteria, and risk list.
- `.trellis/tasks/06-08-personal-skills-trellis-refactor/design.md`
  - Architecture, target file layout, platform roots, test design, rollout, and rollback.
- `.trellis/tasks/06-08-personal-skills-trellis-refactor/implement.md`
  - Ordered implementation checklist and validation plan.

## Skill Authoring Reference

- `D:\MyHarness\riverfjs-skills\skill-creator\SKILL.md`
  - Local reference for high-quality Skill authoring.
  - Key rules used here:
    - `SKILL.md` should be concise and English.
    - Skill `name` should use lowercase letters, numbers, and hyphens.
    - `description` must include WHAT and WHEN trigger language.
    - Put `## Hard Constraints` near the top.
    - Use progressive disclosure for detailed references.
    - Avoid unrelated auxiliary docs inside skill folders.

## Graphify Source

- `https://github.com/safishamsi/graphify`
  - Studied through GitHub MCP on `main`.
- `README.md`
  - Describes graphify as a Claude Code skill and Python CLI.
  - Shows output under `graphify-out/`: `graph.html`, `obsidian/`, `wiki/`, `GRAPH_REPORT.md`, `graph.json`, and cache.
  - Documents usage such as `/graphify .`, `--update`, `--watch`, `--wiki`, `query`, `path`, `explain`, and `--mcp`.
- `graphify/skill.md`
  - Packaged Skill file, size observed ~47 KB.
  - Contains the complete slash-command operational contract for build/update/query/path/explain/add/watch/hook/MCP behavior.
  - The build pipeline is Skill-orchestrated: detection, AST extraction, semantic subagents, merge, graph build, community labels, exports, benchmark, manifest, cleanup, and report.
- `skills/graphify/skill.md` on branch `v1`
  - Similar Skill source for manual skill installation.
- `pyproject.toml`
  - Package name is `graphifyy`, version observed `0.1.14`.
  - CLI entrypoint is `graphify = graphify.__main__:main`.
  - Core dependencies include NetworkX, graspologic, tree-sitter, and language parsers.
  - Optional extras include `mcp`, `neo4j`, `pdf`, `watch`, and `all`.
- `ARCHITECTURE.md`
  - Pipeline: `detect() -> extract() -> build_graph() -> cluster() -> analyze() -> report() -> export()`.
  - Extraction schema includes `nodes` and `edges` with `EXTRACTED`, `INFERRED`, and `AMBIGUOUS` confidence labels.
  - MCP server module is `serve.py`.
- `graphify/serve.py`
  - Provides MCP stdio tools: `query_graph`, `get_node`, `get_neighbors`, `get_community`, `god_nodes`, `graph_stats`, and `shortest_path`.
- `graphify/__main__.py`
  - Shows the CLI entrypoint mostly handles installation and project instruction helpers (`install`, `vscode install`, `benchmark`, `hook`, `claude install/uninstall`), not the full `/graphify <path>` build pipeline by itself.
- `graphify/wiki.py`
  - Generates agent-crawlable `wiki/index.md` plus community and god-node articles.
- `graphify/detect.py`
  - Skips sensitive files, ignores common dependency/build/cache dirs, classifies code/docs/papers/images, and detects incremental changes.
- `SECURITY.md`
  - Local-only model, no network listener, no source-code execution, explicit URL ingest only, path guards, label sanitization, and sensitive file skipping.

Observed conclusion:

- `graphify` complements `fast-context-mcp` rather than replacing it.
- `fast-context-mcp` is live semantic retrieval; `graphify` is persistent graph/wikipedia-style architecture memory.
- Skill+CLI is likely the right surface for build/update because the complete graph construction workflow lives in the Skill.
- MCP may be the better surface for querying an already-built graph because `serve.py` exposes stable graph tools.
- Best future Trellis integration is likely hybrid: a `trellis-graphify` optional bundled skill/capability profile that reads existing artifacts first, uses Skill+CLI for build/update, and can route existing-graph queries to MCP if a focused comparison shows better behavior.

## Smart Search Source

- `D:\MyHarness\smartsearch-private\skills\smart-search-cli\SKILL.md`
  - Canonical Smart Search skill instructions.
  - Current size is large enough that future refactoring may move more detail into references, but the initial Trellis pass should preserve the current contract.
- `D:\MyHarness\smartsearch-private\skills\smart-search-cli\agents\openai.yaml`
  - UI metadata: display name, short description, default prompt.
- `D:\MyHarness\smartsearch-private\skills\smart-search-cli\examples\batch-search.md`
  - Example batch research flow.
- `D:\MyHarness\smartsearch-private\skills\smart-search-cli\examples\evidence-gathering.md`
  - Example evidence-gathering workflow.
- `D:\MyHarness\smartsearch-private\skills\smart-search-cli\references\cli-contract.md`
  - CLI command, alias, output, provider routing, and diagnostic contract.

Observed package contracts:

- `D:\MyHarness\smartsearch-private\package.json` includes `skills/smart-search-cli/**`.
- `D:\MyHarness\smartsearch-private\pyproject.toml` packages `assets/skills/smart-search-cli/**`.
- `D:\MyHarness\smartsearch-private\tests\test_regression.py` guards public vs packaged skill asset sync.

## Micro-Grill Source

- `D:\MyHarness\Trellis\.agents\skills\trellis-micro-grill\SKILL.md`
  - Current customized Trellis wrapper around the user's `grill-me` habit.

Observed behavior to preserve:

- Do not create Trellis task artifacts by default.
- Ask exactly one high-value clarification question at a time.
- Provide a recommended answer when enough evidence exists.
- Inspect local files before asking if the answer is discoverable.
- Escalate to Lite/Full Task when persistence, broad scope, or durable design risk appears.
- Use Simplified Chinese for user-facing questions.

## Trellis Bundled Skill Pipeline

- `packages/cli/src/templates/common/index.ts`
  - `getBundledSkillTemplates()` recursively reads `common/bundled-skills/*`.
  - It normalizes file paths to POSIX relative paths.
- `packages/cli/src/configurators/shared.ts`
  - `resolveBundledSkills(ctx)` renders placeholders.
  - `writeSkills()` writes nested bundled files.
  - `collectSkillTemplates()` tracks them for updates.
- `packages/cli/src/configurators/index.ts`
  - `collectBothTemplates()` and platform-specific collectors pass `resolveBundledSkills(ctx)` into `collectSkillTemplates()`.
  - Codex and Gemini both write `.agents/skills/`; shared content must remain byte-identical.
- `packages/cli/scripts/copy-templates.js`
  - Copies `src/templates` into `dist/templates` during build.
- `packages/cli/package.json`
  - Publishes `dist/**`, making built templates part of the npm package.

## Local Trellis Specs Read

- `.trellis/spec/cli/backend/index.md`
  - Pre-development checklist and quality gates.
- `.trellis/spec/cli/backend/configurator-shared.md`
  - Shared helper contracts for template rendering, bundled skills, and init/update parity.
- `.trellis/spec/cli/backend/platform-integration.md`
  - Platform skill root behavior and bundled built-in skill contract.
- `.trellis/spec/cli/backend/commands-update.md`
  - Update hash tracking, idempotency, and managed template rules.
- `.trellis/spec/cli/unit-test/index.md`
  - Vitest test expectations.
- `.trellis/spec/guides/cross-platform-thinking-guide.md`
  - POSIX key, Windows path, and platform command assumptions.

## Tests With Known Impact

- `packages/cli/test/configurators/platforms.test.ts`
  - Hardcodes `BUNDLED_SKILL_NAMES`.
  - Contains a `startsWith("trellis-")` assumption that `smart-search-cli` invalidates.
  - Counts bundled `SKILL.md` files for shared skill roots.
- `packages/cli/test/configurators/index.test.ts`
  - Verifies bundled skill files are tracked for every skill-writing platform.
  - Enforces POSIX-only Map keys.
- `packages/cli/test/commands/init.integration.test.ts`
  - Verifies default, single-platform, and Codex init outputs.
  - Verifies `.trellis/.template-hashes.json` tracks bundled skill files.

## Superseded Planning Decision

Earlier planning limited the first implementation slice to Trellis's existing bundled skill mechanism for `smart-search-cli` and `trellis-micro-grill`. That boundary is superseded by the user's clarified goal: this fork becomes a custom Trellis-derived workflow framework by default, and Smart Search from `D:\MyHarness\smartsearch-private` is a required built-in runtime rather than a separate setup step.

Accepted replacement decision: vendor Smart Search runtime files into the Trellis CLI package, expose a `smart-search` executable from the Trellis install/runtime path, and maintain an explicit sync or drift-check path back to `D:\MyHarness\smartsearch-private`.

Accepted layout decision: use `packages/cli/vendor/smart-search/` as the vendored runtime root and preserve Smart Search's original package/Python/npm wrapper structure inside that directory.

Accepted wrapper decision: expose `smart-search` through a Trellis-owned thin wrapper that locates and launches the vendored runtime. Do not reimplement Smart Search's CLI behavior inside Trellis; keep Trellis responsible for packaging/launch and Smart Search responsible for search behavior.

Accepted readiness decision: Trellis readiness means capability readiness. `trellis init` must initialize or verify Smart Search and required MCP surfaces before claiming the framework is ready. Smart Search readiness is `smart-search doctor --format json` success; required MCP readiness covers `fast-context-mcp`, GitHub MCP, and Playwright MCP availability for the target AI environment. Secret-bearing provider and MCP credentials stay outside templates.

Accepted failure-mode decision: readiness failure is a hard init failure by default, including `trellis init --yes`. `--skip-readiness` is an explicit repair/debug escape hatch; when used, Trellis may generate files but must report that readiness was skipped and the framework is not verified ready.
