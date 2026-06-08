# Research: OpenCode extension and customization surfaces for Trellis Code

- Query: Research OpenCode extension and customization surfaces for Trellis Code, focusing on plugins/hooks, agents, skills, MCP config, permissions, provider config, auth handling, project-local vs global config, and version compatibility risks.
- Scope: mixed
- Date: 2026-05-02

## Findings

### Files Found

| File Path | Description |
|---|---|
| `packages/cli/src/configurators/opencode.ts` | Trellis OpenCode configurator; walks `packages/cli/src/templates/opencode/`, adds common commands and skills, and writes them under `.opencode/`. |
| `packages/cli/src/templates/opencode/plugins/session-start.js` | Project-local OpenCode plugin that injects Trellis SessionStart context through `chat.message`. |
| `packages/cli/src/templates/opencode/plugins/inject-workflow-state.js` | Project-local OpenCode plugin that injects Trellis workflow-state breadcrumbs on each user message. |
| `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js` | Project-local OpenCode plugin that intercepts `tool.execute.before` for Bash context propagation and Task subagent prompt injection. |
| `packages/cli/src/templates/opencode/lib/trellis-context.js` | Shared OpenCode plugin helper for Trellis project detection, session identity, active-task lookup, JSONL context loading, and script execution. |
| `packages/cli/src/templates/opencode/lib/session-utils.js` | Builds OpenCode SessionStart context from Trellis workflow, specs, active task, and current task status. |
| `packages/cli/src/templates/opencode/agents/*.md` | Trellis subagent definitions using OpenCode Markdown frontmatter (`description`, `mode`, `permission`). |
| `packages/cli/src/templates/opencode/package.json` | Project-local plugin dependency manifest installed into `.opencode/package.json`. |
| `.opencode/package.json` / `.opencode/package-lock.json` | Current project-local generated OpenCode plugin dependency state. |
| `.trellis/spec/cli/backend/platform-integration.md` | Local spec describing OpenCode as the JS plugin pattern platform. |
| `.trellis/spec/cli/backend/workflow-state-contract.md` | Local spec describing OpenCode as a class-1 push-hook platform for workflow-state and subagent-context injection. |
| `.trellis/tasks/05-02-trellis-code-opencode/research/opencode-foundation.md` | Prior Trellis Code foundation research; recommends wrapper/distribution over fork. |
| `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md` | Prior benchmark-driver research; verified `opencode run`, JSONL telemetry, XDG isolation, provider config, permissions, and MCP whitelist behavior on `opencode 1.14.30`. |

### Code Patterns

#### Trellis already uses OpenCode as a project-local extension host

- `packages/cli/src/types/ai-tools.ts:167-181` registers OpenCode as `configDir: ".opencode"`, `cliFlag: "opencode"`, agent-capable, and without Python hooks. This makes OpenCode a first-class Trellis platform but with JS plugins instead of the shared Python hook family.
- `packages/cli/src/configurators/opencode.ts:47-77` walks the OpenCode template directory and maps files to `.opencode/<relative-path>` with POSIX keys. `packages/cli/src/configurators/opencode.ts:86-99` adds common Trellis commands and skills, and `packages/cli/src/configurators/opencode.ts:106-111` writes the collected files at init time.
- `packages/cli/src/configurators/index.ts:199-202` wires OpenCode into the central platform registry with both `configure` and `collectTemplates`, so update/hash tracking now has an OpenCode collection path.
- `packages/cli/src/commands/uninstall.ts:91-95` treats `.opencode/package.json` as a structured file and removes only the Trellis-owned `@opencode-ai/plugin` dependency while preserving other user dependencies.

#### Plugins and hooks

OpenCode's plugin surface is the strongest fit for Trellis Code runtime behavior:

- Official plugin docs say local plugin files are loaded from `.opencode/plugins/` or `~/.config/opencode/plugins/`, npm plugins are listed under `plugin` in `opencode.json`, and load order is global config, project config, global plugin dir, project plugin dir. Source: <https://opencode.ai/docs/plugins/> lines 104-154.
- Official plugin docs describe plugins as JS/TS modules exporting plugin functions that receive `{ project, client, $, directory, worktree }` and return hook implementations. Source: <https://opencode.ai/docs/plugins/> lines 157-224.
- Official plugin docs list event, permission, shell, tool, TUI, and session event families, including `tool.execute.before`, `tool.execute.after`, `shell.env`, and `experimental.session.compacting`. Source: <https://opencode.ai/docs/plugins/> lines 246-311 and 478-551.
- Official plugin docs allow plugin-defined custom tools via `tool()` from `@opencode-ai/plugin`; a plugin tool with the same name as a built-in tool takes precedence. Source: <https://opencode.ai/docs/plugins/> lines 398-447.
- Trellis uses `chat.message` for session-start injection in `packages/cli/src/templates/opencode/plugins/session-start.js:38-86`, workflow-state injection in `packages/cli/src/templates/opencode/plugins/inject-workflow-state.js:104-151`, and event handling for compaction cleanup in `packages/cli/src/templates/opencode/plugins/session-start.js:21-36`.
- Trellis uses `tool.execute.before` to inject `TRELLIS_CONTEXT_ID` into Bash commands and to rewrite Task prompts for Trellis subagents in `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:313-408`.
- Trellis relies on in-place mutation of hook output objects: `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:397-399` notes that whole-object replacement does not work for Task args because the runtime keeps a local args reference.

Trellis Code implication: keep runtime injection in project-local plugins first. Use npm plugin packaging only after the wrapper semantics stabilize, because local plugins are reviewable and versioned with the project.

#### Agents

- OpenCode agents can be configured in JSON under `agent` or as Markdown files under global/project agent directories; agent options include `steps`, `prompt`, `model`, `permission`, `mode`, `hidden`, and Task permissions. Sources: <https://opencode.ai/docs/agents/> lines 458-557, 631-704, and 873-914.
- `steps` is the current max-iteration field; `maxSteps` is deprecated. Source: <https://opencode.ai/docs/agents/> lines 458-487.
- Agent prompt file paths are relative to the config file directory, so the same pattern works for global and project config. Source: <https://opencode.ai/docs/agents/> lines 511-532.
- Trellis ships Markdown subagents with `mode: subagent` and explicit permission blocks. Example: `packages/cli/src/templates/opencode/agents/trellis-research.md:1-14`, `trellis-implement.md:1-13`, and `trellis-check.md:1-13`.
- The Task tool subagent boundary is permission-addressable with `permission.task`, and `deny` removes that subagent from the Task tool description. Source: <https://opencode.ai/docs/agents/> lines 873-906.

Trellis Code implication: define a Trellis primary agent with bounded `steps`, explicit `permission`, explicit `model`, and a narrow `permission.task` map. Keep Trellis implement/check/research as project-local Markdown subagents unless the product needs a bundled npm distribution.

#### Skills

- OpenCode's Agent Skills search order includes project-local `.opencode/skills/<name>/SKILL.md`, global `~/.config/opencode/skills/<name>/SKILL.md`, Claude-compatible `.claude/skills`, and agent-compatible `.agents/skills`. Source: <https://opencode.ai/docs/skills/> lines 90-106.
- Skill access is controlled with `permission.skill` pattern rules, with `allow`, `deny`, and `ask`; denied skills are hidden/rejected. Source: <https://opencode.ai/docs/skills/> lines 200-227.
- Trellis installs common workflow skills into `.opencode/skills` through `collectSkillTemplates(".opencode/skills", ...)` in `packages/cli/src/configurators/opencode.ts:92-98`.

Trellis Code implication: skills are the right surface for reusable instructions, not runtime control. Runtime control belongs in plugins, while skill availability should be managed with `permission.skill` per agent.

#### MCP configuration

- OpenCode config uses top-level `mcp` entries. Local MCP servers use `type: "local"` plus a command array; remote MCP servers use `type: "remote"` plus `url`, optional `headers`, and `enabled`. Sources: <https://opencode.ai/docs/mcp-servers> lines 206-228 and 246-274.
- OpenCode docs show per-agent MCP narrowing by disabling a server globally as a tool, then enabling it in agent config. Source: <https://opencode.ai/docs/mcp-servers> lines 521-526.
- OAuth-style MCP auth exists for some remote MCPs, e.g. `opencode mcp auth sentry`. Source: <https://opencode.ai/docs/mcp-servers> lines 590-620.
- Prior local benchmark research verified MCP permission names through agent permissions as `mcp__<server>__<tool>` patterns, e.g. `mcp__abcoder__*: allow` and explicit deny for other servers in `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md:108-153`.

Trellis Code implication: MCP belongs in the generated/runtime `opencode.json`, with per-agent permission maps used as the enforceable allowlist. Avoid embedding MCP secrets in project-local checked-in config.

#### Permissions

- OpenCode's current permission system supersedes legacy boolean `tools` as of `v1.1.1`; old `tools` config remains backward-compatible but deprecated. Source: <https://opencode.ai/docs/permissions/> lines 81-88.
- Permission actions are `allow`, `ask`, and `deny`, with `*` global defaults and per-tool overrides. Source: <https://opencode.ai/docs/permissions/> lines 90-131.
- Object syntax supports pattern matching; the last matching rule wins. Source: <https://opencode.ai/docs/permissions/> lines 134-171.
- Available permission keys include `read`, `edit`, `glob`, `grep`, `bash`, `task`, `skill`, `lsp`, `question`, `webfetch`, `websearch`, `external_directory`, and `doom_loop`. Source: <https://opencode.ai/docs/permissions/> lines 239-254.
- Defaults are permissive: most permissions default to `allow`, while `doom_loop` and `external_directory` default to `ask`; `.env` reads are denied by default. Source: <https://opencode.ai/docs/permissions/> lines 256-284.
- Agent permissions merge with global config and take precedence. Source: <https://opencode.ai/docs/permissions/> lines 298-300.
- Prior local benchmark research verified `--dangerously-skip-permissions` auto-approves ask cases but still honors explicit deny rules on OpenCode 1.14.30. See `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md:208-217`.

Trellis Code implication: Trellis Code should not assume OpenCode is safe by default. A Trellis-owned agent should start from explicit deny/ask floors and then allow only required tools, skills, subagents, MCP tools, and external directories.

#### Provider config and auth handling

- OpenCode custom providers are configured under `provider.<id>` with `npm`, `name`, `options.baseURL`, optional `options.apiKey`, optional headers, and `models`. Source: <https://opencode.ai/docs/providers> lines 2221-2329.
- For OpenAI-compatible providers using `/v1/chat/completions`, docs specify `@ai-sdk/openai-compatible`; for `/v1/responses`, use `@ai-sdk/openai`. Source: <https://opencode.ai/docs/providers> lines 2323-2329 and 2407-2410.
- Docs currently present provider credential entry through the TUI `/connect` flow; after adding a credential for a custom provider, the provider still must be configured in `opencode.json`. Source: <https://opencode.ai/docs/providers> lines 2229-2286.
- Provider troubleshooting includes `opencode auth list` to verify credentials. Source: <https://opencode.ai/docs/providers> lines 2399-2405.
- Config variable substitution supports `{env:VARIABLE_NAME}` and `{file:path/to/file}` for provider API keys and other secrets. Source: <https://opencode.ai/docs/config/> lines 1049-1123.
- `disabled_providers` and `enabled_providers` can constrain provider loading; disabled providers take priority. Source: <https://opencode.ai/docs/config/> lines 983-1026.
- Prior local benchmark research found API-key auth persisted in OpenCode's auth store and warned not to inline secrets in research or generated project files. See `.trellis/tasks/05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md:64-107` and `443-452`.

Trellis Code implication: provider IDs, model IDs, and allowlisted providers can be generated, but credentials should stay in OpenCode auth storage or environment/file substitutions controlled by the user. Trellis Code must never read or print auth files.

#### Project-local vs global config

- OpenCode config files are merged, not replaced; later config sources override only conflicting keys. Source: <https://opencode.ai/docs/config/> lines 162-171.
- Precedence order is remote config, global `~/.config/opencode/opencode.json`, `OPENCODE_CONFIG`, project `opencode.json`, `.opencode` directories, `OPENCODE_CONFIG_CONTENT`, managed config files, and macOS managed preferences. Source: <https://opencode.ai/docs/config/> lines 174-185.
- `.opencode` and `~/.config/opencode` directories use plural subdirectories such as `agents/`, `commands/`, `plugins/`, `skills/`, `tools/`, and `themes/`. Source: <https://opencode.ai/docs/config/> lines 187-189.
- Global config is intended for user-wide providers, models, permissions, and runtime preferences. Source: <https://opencode.ai/docs/config/> lines 242-248.
- Project config lives at project-root `opencode.json` and is safe to check into Git when it contains no secrets. OpenCode traverses upward to the nearest Git directory. Source: <https://opencode.ai/docs/config/> lines 251-262.
- `OPENCODE_CONFIG_DIR` can point at a custom directory that is searched like `.opencode` for agents, commands, modes, and plugins. Source: <https://opencode.ai/docs/config/> lines 278-280.

Trellis Code implication: project-local `.opencode/` is the right place for Trellis workflow assets. User-wide provider credentials and personal defaults should remain global. For deterministic runs, `OPENCODE_CONFIG`, `OPENCODE_CONFIG_CONTENT`, `OPENCODE_CONFIG_DIR`, and XDG directories are the runtime override surfaces to inspect.

#### Commands and rules/instructions

- OpenCode commands can be configured in JSON under `command` or Markdown files in global/project command directories. Source: <https://opencode.ai/docs/commands/> lines 135-195.
- Markdown command prompts support `$ARGUMENTS`, `$1`, `$2`, etc., and shell-output interpolation with ``!`command` ``. Source: <https://opencode.ai/docs/commands/> lines 200-260.
- Rules/instructions can come from `AGENTS.md`, and `opencode.json` can include instruction files/globs through `instructions`. Sources: <https://opencode.ai/docs/rules/> lines 83-107 and <https://opencode.ai/docs/config/> lines 966-980.

Trellis Code implication: slash commands are useful for interactive Trellis entry points, but deterministic headless Trellis Code runs should pass explicit prompts/config rather than relying on command expansion side effects.

### External References

| Source | Relevance |
|---|---|
| <https://opencode.ai/docs/config/> | Official config format, precedence, global/project split, plugins, instructions, provider allow/deny lists, variable substitution. Last updated May 1, 2026. |
| <https://opencode.ai/docs/plugins/> | Official plugin loading, dependency, hook, custom tool, and compaction-hook docs. Last updated May 1, 2026. |
| <https://opencode.ai/docs/agents/> | Official agent config docs: `steps`, `prompt`, `model`, `permission`, `mode`, `hidden`, and Task permission controls. |
| <https://opencode.ai/docs/skills/> | Official Agent Skills discovery and permission docs. |
| <https://opencode.ai/docs/mcp-servers> | Official MCP local/remote server config and MCP auth examples. |
| <https://opencode.ai/docs/permissions/> | Official permission model docs, including `v1.1.1` deprecation of legacy `tools`. |
| <https://opencode.ai/docs/providers> | Official provider and custom OpenAI-compatible provider docs. |
| <https://opencode.ai/docs/tools> | Official tool inventory and permission linkage, including `edit` covering write/patch operations. |
| <https://www.npmjs.com/package/opencode-ai> | npm registry source for OpenCode CLI package. `npm view opencode-ai version --json` returned `1.14.31` on 2026-05-02. |
| <https://www.npmjs.com/package/@opencode-ai/plugin> | npm registry source for plugin SDK package. `npm view @opencode-ai/plugin version --json` returned `1.14.31` on 2026-05-02. |
| <https://github.com/sst/opencode/issues/20725> | Prior research noted a custom-provider sub-session fallback issue; relevant if Trellis Code enables Task subagents with custom OpenAI-compatible providers. |

### Version Compatibility Risks

1. Local CLI/package skew exists now: `opencode --version` returned `1.14.30`, while npm latest for both `opencode-ai` and `@opencode-ai/plugin` returned `1.14.31` on 2026-05-02.
2. Trellis template `packages/cli/src/templates/opencode/package.json:1-4` pins `@opencode-ai/plugin` to `1.1.40`, while this project's `.opencode/package-lock.json:7-9` and `89-96` show an installed/locked `@opencode-ai/plugin` and SDK at `1.14.22`. That is a concrete local skew surface between generated manifest, lockfile, plugin SDK, and CLI.
3. OpenCode plugin export shape changed before: `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:313-318` records that OpenCode 1.2.x iterates module exports and invokes each export as a function; an older `{ id, server }` object shape failed with `TypeError: fn is not a function`.
4. Trellis OpenCode plugins depend on hook names and mutable-output contracts that are less stable than config files. Local code uses `chat.message`, `event`, `tool.execute.before`, `client.session.messages`, and in-place mutation of `output.parts` / `output.args`.
5. Permission config changed in `v1.1.1`: legacy `tools` remains supported but is deprecated. New Trellis Code config should use `permission`, and doctor checks should flag legacy-only configs when they matter.
6. Agent max-iteration config changed: `maxSteps` is deprecated; `steps` is current. Config generators should not emit `maxSteps`.
7. Experimental hooks/options are explicitly unstable in OpenCode docs. `experimental.session.compacting` and `experimental.*` config should be treated as compatibility-sensitive.
8. Config precedence can override Trellis assumptions: inline config and managed config load after project `.opencode` directories. A Trellis Code doctor needs to report effective config, not only generated files.
9. Provider/auth docs use both interactive `/connect` and CLI `opencode auth list`; prior research used `opencode auth login`. Auth command UX is a moving surface, so product flows should verify the installed CLI before relying on a specific command name.
10. MCP headers and provider `options.apiKey` can carry secrets in config. Project-local config is safe to commit only when secrets are referenced indirectly through `{env}` / `{file}` or OpenCode auth storage.

### Related Specs

- `.trellis/spec/cli/backend/platform-integration.md:82-92` describes OpenCode's JS plugin pattern, but line 92 says OpenCode has no `collectTemplates`; current code now has `collectOpenCodeTemplates()` and registry wiring at `packages/cli/src/configurators/opencode.ts:86-99` and `packages/cli/src/configurators/index.ts:199-202`. Treat the spec note as stale.
- `.trellis/spec/cli/backend/workflow-state-contract.md:187-206` classifies OpenCode as a class-1 push-hook platform where main-session workflow-state and subagent context use separate injection paths.
- `.trellis/spec/guides/cross-platform-thinking-guide.md` is relevant for `.opencode` path generation and host-platform command handling; current OpenCode Bash context injection already has separate POSIX and Windows PowerShell prefixes in `packages/cli/src/templates/opencode/plugins/inject-subagent-context.js:267-274`.

## Caveats / Not Found

- I did not find an official compatibility matrix that says which `@opencode-ai/plugin` versions are supported by which `opencode-ai` CLI versions. npm latest currently matches at `1.14.31`, but local Trellis-generated files show drift.
- I did not read any auth secret files. Auth handling findings come from official docs and prior non-secret research notes.
- Official plugin docs list many hook families but do not provide a semver stability guarantee for hook payload shapes. Trellis's existing reliance on `chat.message` and mutable output objects should be treated as version-sensitive and covered by smoke tests.
- This research did not modify code or specs; only this research artifact was written.
