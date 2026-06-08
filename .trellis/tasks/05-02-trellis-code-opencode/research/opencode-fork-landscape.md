# Research: OpenCode fork and derivative landscape

- Query: Research whether there are well-known products or projects that forked OpenCode, rebranded it, or built a notable derivative from it. Search GitHub forks, npm package ecosystem, docs/blogs/social references, and compare with adjacent AI coding runtime forks if direct OpenCode forks are not notable.
- Scope: mixed
- Date: 2026-05-02

## Findings

### Short conclusion

There are confirmed OpenCode forks and rebrands, but most GitHub-metadata forks are not yet major products. The notable OpenCode-based product landscape is split into three categories:

1. **Confirmed OpenCode forks/rebrands**: GitHub forks whose `parent` is `anomalyco/opencode`, plus Kilo CLI whose own docs call it an OpenCode fork even though the GitHub repo is not marked as a fork.
2. **Notable adjacent/non-fork products**: GUIs, orchestrators, plugins, and harnesses that depend on OpenCode server/SDK/config but are not repository forks.
3. **Adjacent AI coding runtime fork pattern**: other ecosystems show the clearer commercial path: Cline -> Roo Code -> Kilo, OpenAI Codex CLI -> Every Code, VS Code -> Void/Melty. OpenCode itself has a larger adjacent ecosystem than a large direct-fork ecosystem.

### Files found

| File path | Description |
|---|---|
| `.trellis/tasks/05-02-trellis-code-opencode/prd.md` | Current Trellis Code PRD; already assumes a direct OpenCode fork for Trellis runtime ownership. |
| `.trellis/tasks/05-02-trellis-code-opencode/research/opencode-foundation.md` | Earlier wrapper-first analysis; useful as contrast because this research found some fork examples but still limited direct-fork product maturity. |
| `.trellis/tasks/05-02-trellis-code-opencode/research/opencode-distribution-feasibility.md` | Prior license/package/release-cadence research; relevant to npm/package comparison and upstream fast-move risk. |
| `.trellis/tasks/05-02-trellis-code-opencode/research/opencode-runtime-architecture.md` | Prior runtime research on `opencode run`, `serve`, SDK/SSE, storage, and GUI-consumable contract. |
| `.trellis/tasks/05-02-trellis-code-opencode/research/opencode-extension-surfaces.md` | Prior plugin/agent/MCP/permission research; relevant because the most notable non-fork derivatives use these surfaces. |
| `.trellis/spec/cli/backend/index.md` | Relevant local spec index for Trellis OpenCode platform work. |

### Code patterns

- The Trellis Code PRD has already moved from wrapper-first to fork-first: it says "Fork OpenCode and rebrand/package it as Trellis Code" and prioritizes Trellis-owned workflow/runtime behavior inside the runtime.
- Earlier local research shows a tension: `opencode-foundation.md` and `opencode-distribution-feasibility.md` recommended wrapper/distribution before fork, while the current PRD explicitly accepts fork maintenance cost for product/runtime ownership.
- OpenCode local integration in this repo is currently plugin/template based, not a fork. Relevant Trellis assets are installed under `.opencode/` by `packages/cli/src/configurators/opencode.ts`, with plugins under `packages/cli/src/templates/opencode/plugins/`.

### GitHub fork landscape

Source command: GitHub GraphQL via `gh api graphql` on 2026-05-02 against `anomalyco/opencode` and top forks ordered by stars.

Canonical upstream observed:

- [`anomalyco/opencode`](https://github.com/anomalyco/opencode): not a fork, MIT, created 2025-04-30, pushed 2026-05-02, about 153k stars and 17.7k forks at query time. `sst/opencode` resolved to the same repository through GitHub.

Top confirmed GitHub forks by star count:

| Project | Confirmed status | Evidence | Created / last pushed | Stars / forks at query time | Notes |
|---|---|---|---|---:|---|
| [`DNGriffin/whispercode`](https://github.com/DNGriffin/whispercode) | Confirmed GitHub fork of `anomalyco/opencode` | GitHub `isFork: true`, parent `anomalyco/opencode` | Created 2026-01-19; pushed 2026-04-26 | 231 / 9 | Rebranded repo name, but package still reports `packages/opencode` name/bin as `opencode`; no npm package named `whispercode` found. |
| [`winmin/evil-opencode`](https://github.com/winmin/evil-opencode) | Confirmed GitHub fork | GitHub `isFork: true`, parent `anomalyco/opencode` | Created 2026-01-06; pushed 2026-05-01 | 219 / 20 | Security/safety-guardrail-removal positioning. Not a positive product model for Trellis, but it is a notable fork by stars. |
| [`Latitudes-Dev/shuvcode`](https://github.com/Latitudes-Dev/shuvcode) | Confirmed GitHub fork | GitHub `isFork: true`, parent `anomalyco/opencode`; description says unofficial fork | Created 2025-10-27; pushed 2026-04-06 | 100 / 1 | `packages/opencode/package.json` still uses `opencode` bin/name; looks lightly renamed rather than a full product/runtime split. |
| [`mammouth-ai/code`](https://github.com/mammouth-ai/code) | Confirmed GitHub fork and product rebrand | GitHub `isFork: true`, parent `anomalyco/opencode`; README FAQ says it is a fork of OpenCode | Created 2026-02-05; pushed 2026-05-01 | 39 / 3 | Most explicit productized direct fork found. Package name/bin changed to `mammouth`; docs install via `code.mammouth.ai` and require a Mammouth API key. |
| [`OneOfLzx/opencode-sentinel`](https://github.com/OneOfLzx/opencode-sentinel) | Confirmed GitHub fork | GitHub `isFork: true`, parent `anomalyco/opencode` | Created 2026-01-21; pushed 2026-02-03 | 35 / 3 | Security-enhanced/private-AI-server positioning; still reports `opencode` package/bin. |
| [`Jaiminp007/finny`](https://github.com/Jaiminp007/finny) | Confirmed GitHub fork and domain rebrand | GitHub `isFork: true`, parent `anomalyco/opencode` | Created 2026-02-06; pushed 2026-05-02 | 29 / 5 | Financial-markets positioning. `packages/opencode/package.json` changed name/bin to `finny`. |
| [`jasonkneen/codesurf-ai`](https://github.com/jasonkneen/codesurf-ai) | Confirmed GitHub fork | GitHub fork list parent `anomalyco/opencode` | Created 2025-11-26; pushed 2026-01-09 | 25 / 0 | Description says based on `@opencode`; limited evidence of product traction. |

Interpretation: direct forks exist, but the top GitHub-metadata fork has only low hundreds of stars. Most top forks either keep the upstream package/bin shape or present as narrow rebrands. Mammouth Code and Finny are the clearest direct product rebrands.

### Npm package ecosystem

Source commands: `npm search opencode --json --searchlimit=100`, targeted `npm view`, and package metadata on 2026-05-02.

Official upstream packages:

- [`opencode-ai`](https://www.npmjs.com/package/opencode-ai): version `1.14.31`, MIT, bin `opencode`, platform binary optional dependencies, created 2025-05-31, modified 2026-05-02.
- [`@opencode-ai/plugin`](https://www.npmjs.com/package/@opencode-ai/plugin): version `1.14.31`, MIT, created 2025-08-02, modified 2026-05-02.
- [`@opencode-ai/sdk`](https://www.npmjs.com/package/@opencode-ai/sdk): version `1.14.31`, official TypeScript library for the OpenCode API.

Notable OpenCode ecosystem packages:

| Package | Classification | Evidence | Created / modified | Notes |
|---|---|---|---|---|
| [`@kilocode/cli`](https://www.npmjs.com/package/@kilocode/cli) | OpenCode fork/rebrand per Kilo docs; not a GitHub fork by metadata | npm bin `kilo`; optional platform binary packages; repo [`Kilo-Org/kilocode`](https://github.com/Kilo-Org/kilocode) | Created 2025-10-13; modified 2026-05-01 | Kilo docs state Kilo CLI is a fork of OpenCode and supports the same config options. GitHub repo itself is not marked as a fork. |
| [`oh-my-opencode`](https://www.npmjs.com/package/oh-my-opencode) / [`oh-my-openagent`](https://www.npmjs.com/package/oh-my-openagent) | Not an OpenCode repo fork; notable OpenCode harness/plugin distribution | npm package description: "Batteries-Included OpenCode Plugin"; repo [`code-yeongyu/oh-my-openagent`](https://github.com/code-yeongyu/oh-my-openagent) is not a fork | Created 2025-12-04; modified 2026-04-30 | Very high GitHub traction (~55k stars at query time), but should be treated as adjacent product/harness, not a confirmed OpenCode fork. |
| [`oh-my-opencode-slim`](https://www.npmjs.com/package/oh-my-opencode-slim) | Fork of oh-my-opencode, not OpenCode | npm description says slimmed-down fork of oh-my-opencode | Modified 2026-04-30 | Confirms second-order ecosystem around OpenCode plugins/harnesses. |
| [`@openchamber/web`](https://www.npmjs.com/package/@openchamber/web) | Adjacent GUI/server product, not OpenCode fork | Depends on `@opencode-ai/sdk`; bin `openchamber` | Created 2025-12-07; modified 2026-04-28 | Repo is not a fork; UI/desktop/web around OpenCode server. |
| [`openwork-orchestrator`](https://www.npmjs.com/package/openwork-orchestrator) | Adjacent orchestrator, not OpenCode fork | Description says it orchestrates `opencode` + OpenWork server + `opencode-router` | Created 2026-02-16; modified 2026-04-30 | Part of OpenWork; wrapper/host stack rather than fork metadata. |
| [`opencode-router`](https://www.npmjs.com/package/opencode-router) | Adjacent bridge/router | Slack + Telegram bridge + directory routing for a running OpenCode server | Created 2026-02-16; modified 2026-04-30 | Used by OpenWork host stack. |
| [`@different-ai/opencode-browser`](https://www.npmjs.com/package/@different-ai/opencode-browser) | Plugin | Browser automation plugin for OpenCode | Created 2026-01-04; modified 2026-02-23 | Extension of OpenCode rather than fork. |
| [`opencode-mem`](https://www.npmjs.com/package/opencode-mem), [`opencode-supermemory`](https://www.npmjs.com/package/opencode-supermemory), [`opencode-wakatime`](https://www.npmjs.com/package/opencode-wakatime), [`opencode-feishu`](https://www.npmjs.com/package/opencode-feishu) | Plugins/integrations | npm package descriptions identify OpenCode plugins | Various 2025-12 to 2026-05 | Shows plugin ecosystem maturity, not runtime fork maturity. |

Npm interpretation: the package ecosystem is healthier around plugins, harnesses, GUIs, and platform-specific binary wrappers than around independently published OpenCode forks. Kilo is the main npm-level OpenCode fork/rebrand signal.

### Notable adjacent/non-fork OpenCode derivatives

| Project | Status | Evidence | Traction at query time | Implication |
|---|---|---|---:|---|
| [`Kilo-Org/kilocode`](https://github.com/Kilo-Org/kilocode) / [`@kilocode/cli`](https://www.npmjs.com/package/@kilocode/cli) | Docs-confirmed OpenCode fork/rebuild; GitHub metadata says not a fork | Kilo blog, 2026-02-03, says Kilo CLI is based on OpenCode and built on the OpenCode server; Kilo docs explicitly say "The Kilo CLI is a fork of OpenCode" | GitHub ~18.8k stars / 2.5k forks; npm CLI version `7.2.31` | This is the strongest evidence that a company can productize an OpenCode-derived runtime. It also shows a likely import/rewrite strategy rather than relying on GitHub fork metadata. |
| [`code-yeongyu/oh-my-openagent`](https://github.com/code-yeongyu/oh-my-openagent) | Non-fork harness/plugin distribution, formerly oh-my-opencode | Repo not GitHub fork; npm package says OpenCode plugin/harness; README frames it as OpenCode-compatible orchestration | GitHub ~55k stars / 4.5k forks; npm version `3.17.12` | Strongest ecosystem traction, but not evidence for direct runtime fork. Evidence for building a high-value layer above OpenCode. |
| [`different-ai/openwork`](https://github.com/different-ai/openwork) | Non-fork desktop/server product powered by OpenCode | README says OpenWork is powered by OpenCode; host mode runs local OpenCode; UI uses `@opencode-ai/sdk` | GitHub ~14.6k stars / 1.4k forks | Strong GUI/product precedent for consuming OpenCode as runtime rather than forking it. |
| [`openchamber/openchamber`](https://github.com/openchamber/openchamber) | Non-fork desktop/web/VS Code UI around OpenCode | README describes rich interface for OpenCode; prerequisite is OpenCode CLI; can connect to existing OpenCode server | GitHub ~3.7k stars / 368 forks | Confirms OpenCode server/SDK can anchor a GUI ecosystem without fork ownership. |

### External references

- OpenCode upstream repo: [`anomalyco/opencode`](https://github.com/anomalyco/opencode)
- OpenCode official site/docs: <https://opencode.ai/>
- Mammouth Code docs: <https://info.mammouth.ai/docs/mammouth-code/>; lines observed state Mammouth Code is a terminal coding agent, open source on GitHub, installs via `code.mammouth.ai`, and runs as `mammouth`.
- Mammouth Code GitHub: [`mammouth-ai/code`](https://github.com/mammouth-ai/code); README FAQ explicitly says it is a fork of OpenCode with Mammouth API-specific behavior.
- Kilo CLI launch blog: <https://blog.kilo.ai/p/kilo-cli>; dated 2026-02-03; says Kilo CLI is built on the OpenCode server and based on OpenCode.
- Kilo CLI docs: <https://kilo.ai/docs/code-with-ai/platforms/cli>; says the Kilo CLI is a fork of OpenCode and built from [`Kilo-Org/kilocode`](https://github.com/Kilo-Org/kilocode).
- Kilo VS Code rebuild blog: <https://blog.kilo.ai/p/new-kilo-for-vscode-is-live>; dated 2026-04-02; says the rebuilt VS Code extension uses OpenCode server as shared core.
- OpenWork repo: [`different-ai/openwork`](https://github.com/different-ai/openwork); README says OpenWork is powered by OpenCode and has host/direct modes using OpenCode.
- OpenChamber repo: [`openchamber/openchamber`](https://github.com/openchamber/openchamber); README says it is a rich interface for OpenCode and requires OpenCode CLI.
- npm `opencode-ai`: <https://www.npmjs.com/package/opencode-ai>
- npm `@kilocode/cli`: <https://www.npmjs.com/package/@kilocode/cli>
- npm `oh-my-opencode`: <https://www.npmjs.com/package/oh-my-opencode>
- npm `@openchamber/web`: <https://www.npmjs.com/package/@openchamber/web>
- npm `openwork-orchestrator`: <https://www.npmjs.com/package/openwork-orchestrator>
- Reddit thread: <https://www.reddit.com/r/opencodeCLI/comments/1qvo002/kilo_cli_10_just_launched_built_on_opencode_as/>; posted about 2026-02; useful as community/social signal, not primary evidence.
- Slop Forks leaderboard: <https://slopforks.com/>; observed 2026-05-02. It classifies OpenCode itself as a fork/reimagining of Claude Code and lists adjacent runtime forks such as Roo Code, Kilo Code, and Every Code. Treat as secondary/social taxonomy, not canonical evidence.

### Adjacent AI coding runtime fork comparison

OpenCode direct forks are less mature than adjacent fork ecosystems:

- **Cline -> Roo Code -> Kilo Code**: Roo Code is widely described as a Cline fork and has ~23k GitHub stars; Kilo historically came from Roo/Cline extension lineage and now uses/forks OpenCode for CLI/core surfaces. This path shows a stronger commercial fork/rebrand precedent than OpenCode-only GitHub forks.
- **OpenAI Codex CLI -> Every Code**: [`just-every/code`](https://github.com/just-every/code) is a GitHub-confirmed fork of `openai/codex`, with npm package [`@just-every/code`](https://www.npmjs.com/package/@just-every/code), about 3.7k GitHub stars, and explicit positioning around validation, automation, browser integration, multi-agents, theming, and multi-provider orchestration.
- **VS Code -> Cursor/Void/Melty-style editor forks**: The broader AI coding market accepts editor/runtime forks when they own a differentiated interface or workflow. This is stronger precedent for a Trellis-owned runtime than the direct OpenCode fork list alone.

The lesson for Trellis Code: a fork can be justified, but the product must quickly create a new owned surface. Directly renaming OpenCode is not enough; the successful adjacent examples add platform integration, orchestration, GUI/server workflow, model routing, or domain-specific distribution.

### Related specs

- `.trellis/spec/cli/backend/index.md` — entry point for CLI/backend changes.
- `.trellis/spec/cli/backend/platform-integration.md` — relevant for existing OpenCode JS plugin/platform integration.
- `.trellis/spec/cli/backend/workflow-state-contract.md` — relevant because Trellis Code would need first-class workflow-state behavior rather than project-local plugin injection.
- `.trellis/spec/guides/cross-platform-thinking-guide.md` — relevant to binary/package distribution and config path behavior.

## Caveats / Not Found

- GitHub fork metadata is not sufficient. Kilo's repo is not marked as a GitHub fork, but Kilo's own docs call its CLI an OpenCode fork. Conversely, many GitHub forks are just personal forks or light rebrands.
- I did not find a major, GitHub-confirmed OpenCode fork with Kilo/oh-my-openagent/OpenWork-level traction. The strongest productized direct GitHub fork evidence is Mammouth Code, but its public GitHub star count is still small.
- I did not find npm packages for several top GitHub forks (`whispercode`, `shuvcode`, `mammouth` / `mammouth-code`, `finny`) under obvious names. Their distribution appears to be custom install scripts, GitHub releases, or not publicly published to npm under those names.
- Some blog/social sources are promotional or community commentary. I treated Kilo official docs/blog and GitHub/npm metadata as stronger evidence than Reddit or third-party ranking pages.
- Star/fork counts are point-in-time observations from 2026-05-02 and will drift quickly.
- This research did not read or modify any secret files, did not run package installs, and did not edit code or specs.
