# Personal Skills Trellis Integration Research And Plan

## Scope

This memo records the planning result for the first concrete refactor of the user's Trellis fork on `0.6.0-beta.22`.

Current implementation slice:

- Bundle `smart-search-cli` into Trellis.
- Bundle `trellis-micro-grill` into Trellis.
- Keep both available through `trellis init` and `trellis update`.
- Add `graphify` as a researched future capability that can complement `fast-context-mcp`.

Deferred broader personal workflow work:

- Route the user's MCP/tooling capabilities through a personal workflow profile.
- Confirm Graphify's Trellis ownership in child task `.trellis/tasks/06-08-graphify-integration-ownership`.
- Decide whether Smart Search runtime installation belongs inside Trellis.
- Convert the native workflow into the user's full personal workflow framework.

## Baseline

```text
Worktree: D:\MyHarness\Trellis-v0.6.0-beta.22
Branch: personal-v0.6.0-beta.22
Version: 0.6.0-beta.22
Full Task: .trellis/tasks/06-08-personal-skills-trellis-refactor
Skill reference: D:\MyHarness\riverfjs-skills\skill-creator\SKILL.md
Smart Search source: D:\MyHarness\smartsearch-private\skills\smart-search-cli
Micro-Grill source: D:\MyHarness\Trellis\.agents\skills\trellis-micro-grill\SKILL.md
```

## Core Architecture Decision

Use Trellis's existing bundled skill pipeline:

```text
packages/cli/src/templates/common/bundled-skills/<skill-name>/
```

Reasons:

- `getBundledSkillTemplates()` already discovers multi-file skills.
- `resolveBundledSkills()` already renders them without wrapping frontmatter.
- `writeSkills()` already writes nested skill assets during init.
- `collectSkillTemplates()` already tracks nested files for update hashes.
- `copy-templates.js` already moves source templates to `dist/templates` for packaging.

No new marketplace mechanism is needed for this slice.

## Target Skill Layout

Smart Search:

```text
packages/cli/src/templates/common/bundled-skills/smart-search-cli/
  SKILL.md
  agents/openai.yaml
  examples/batch-search.md
  examples/evidence-gathering.md
  references/cli-contract.md
```

Micro-Grill:

```text
packages/cli/src/templates/common/bundled-skills/trellis-micro-grill/
  SKILL.md
```

Graphify ownership child task:

```text
.trellis/tasks/06-08-graphify-integration-ownership
```

This is not part of the current implementation slice. The final integration may be Skill+CLI, MCP, artifact-reading convention, runtime adapter, or hybrid after focused testing.

## Important Boundaries

- `smart-search-cli` keeps its existing name. Do not rename to `trellis-smart-search`.
- `smartsearch-private` remains the Smart Search source of truth.
- Trellis vendors a skill snapshot first; it does not absorb the Smart Search CLI runtime yet.
- Missing `smart-search` executable is a blocker, not permission to invent unsourced web facts.
- `trellis-micro-grill` is a Trellis-specific wrapper around the user's `grill-me` workflow, not a generic bundled `grill-me`.
- MCP configuration is not bundled in this task.
- `graphify --mcp` should not be rejected by policy. It should be evaluated against Skill+CLI/artifact reading.
- `graphify` should be treated as a persistent graph/wiki complement to `fast-context-mcp`, not as a replacement for live semantic code search.

## Graphify And Fast Context

`fast-context-mcp` is the default live code search layer:

- semantic search over the current project;
- file and line-range discovery;
- follow-up grep keywords;
- low-friction implementation-time retrieval.

`graphify` is a candidate persistent structural memory layer:

- `graphify-out/GRAPH_REPORT.md` for god nodes, communities, surprising links, and suggested questions;
- `graphify-out/wiki/index.md` for agent-crawlable architecture wiki;
- `graphify-out/graph.json` for shortest-path, neighborhood, and community queries;
- optional exports to HTML, Obsidian, GraphML, SVG, and Neo4j.

Important research correction:

- The full `/graphify <path>` build/update workflow is encoded in `graphify/skill.md`, not simply in a conventional CLI subcommand.
- The packaged `graphify` CLI mostly handles install/config helpers, benchmark, hooks, and local instruction installation.
- The MCP server is strongest after `graphify-out/graph.json` already exists; it exposes query/path/neighborhood/community tools.

Recommended Trellis routing:

- Architecture-map or concept-relationship request -> check `graphify-out/wiki/index.md` and `GRAPH_REPORT.md`.
- Targeted implementation lookup -> use `fast-context-mcp`.
- Building/updating graphify output -> ask first; it can be expensive and is not a default background action.
- Existing graph query/path/neighborhood request -> compare artifact reading, Skill query flow, and `graphify --mcp`; use MCP if it proves more reliable.

## Test Impact

Known files to update after adding assets:

- `packages/cli/test/configurators/platforms.test.ts`
  - Add `smart-search-cli` and `trellis-micro-grill` to bundled skill expectations.
  - Remove the assumption that every bundled skill starts with `trellis-`.
- `packages/cli/test/configurators/index.test.ts`
  - Assert both new skills are tracked for every skill-writing platform.
- `packages/cli/test/commands/init.integration.test.ts`
  - Assert default init, Codex init, and hash tracking include both skills.

Validation commands:

```powershell
pnpm test -- packages/cli/test/configurators/platforms.test.ts
pnpm test -- packages/cli/test/configurators/index.test.ts
pnpm test -- packages/cli/test/commands/init.integration.test.ts
pnpm typecheck
pnpm build
pnpm test
```

## Execution Order

1. Add `trellis-micro-grill` bundled skill.
2. Add `smart-search-cli` bundled skill snapshot.
3. Update configurator and init tests.
4. Run targeted tests.
5. Run typecheck/build.
6. Verify built `dist/templates/common/bundled-skills/**`.
7. Optionally run a built-CLI temp init smoke test.

## Follow-Up Architecture

After the two skills are bundled, the next refactor should be a personal workflow profile:

- Small underspecified request -> `trellis-micro-grill`.
- Source-backed web/docs/current research -> `smart-search-cli`.
- Semantic local codebase search -> `fast-context-mcp`.
- Persistent architecture graph/wiki -> future `trellis-graphify` capability.
- GitHub remote issues/PR/code actions -> GitHub MCP.
- Browser inspection and UI verification -> Playwright MCP.
- Persistent implementation work -> Trellis Lite/Full Task.

This keeps MCPs as runtime capability surfaces and Skills as agent behavior modules. Trellis can orchestrate both without committing user-specific secrets or MCP config.
