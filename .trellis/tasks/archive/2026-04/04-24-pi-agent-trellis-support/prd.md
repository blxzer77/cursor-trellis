# brainstorm: pi agent trellis support

## Goal

Add Trellis support for Pi Agent so `trellis init --pi` can install Trellis workflow assets into a Pi project using Pi's native resource model, including Pi-compatible Trellis sub-agents.

## What I already know

* User wants to explore how to add Trellis support for Pi Agent.
* Trellis platform support is registry-driven:
  * `packages/cli/src/types/ai-tools.ts` stores platform metadata.
  * `packages/cli/src/configurators/index.ts` stores platform behavior and template tracking.
  * `packages/cli/src/configurators/{platform}.ts` writes project files during init.
  * `packages/cli/src/templates/{platform}/` stores platform-specific templates when needed.
  * `packages/cli/src/templates/trellis/scripts/common/cli_adapter.py` has an independent runtime platform registry.
  * `packages/cli/src/templates/trellis/scripts/common/task_store.py` separately tracks which platforms consume `implement.jsonl` / `check.jsonl`.
* Existing platform groups:
  * Full/hook or pull-based sub-agent platforms: Claude, Cursor, OpenCode, Codex, Kiro, Gemini, Qoder, CodeBuddy, Copilot, Droid.
  * Agent-less workflow platforms: Kilo, Antigravity, Windsurf.
* Official Pi docs show that Pi supports `AGENTS.md`, skills, prompt templates, project `.pi/settings.json`, extensions, and packages.
* Pi has hook-equivalent extension events, not external Python hook scripts:
  * `session_start` maps to Trellis session-start behavior.
  * `input` maps to user-prompt submit interception.
  * `before_agent_start` can inject a persistent message or modify the turn system prompt.
  * `context` can modify messages before each provider request.
  * `tool_call` can inspect, mutate, or block tool calls before execution.
  * `tool_execution_start/update/end` can observe tool execution lifecycle.
* Pi has slash commands from multiple sources:
  * Prompt templates in `.pi/prompts/` are invoked as `/<name>`.
  * Skills can be invoked as `/skill:<name>` when `enableSkillCommands` is enabled.
  * Extensions can register slash commands via `pi.registerCommand(...)`.
  * `pi.getCommands()` lists extension commands, prompt templates, and skill commands; built-in interactive commands are separate.
* Official Pi docs and examples show Pi can support sub-agents through extensions:
  * `examples/extensions/subagent/index.ts` registers a `subagent` tool.
  * The tool supports single, parallel, and chain delegation modes.
  * It spawns separate `pi` processes with isolated context.
  * It discovers project-local agents from `.pi/agents`.
* The active rollout JSONL files opened in the IDE are Codex session exports, not Pi session exports. They are useful as examples of session JSONL shape, but they do not establish Pi integration contracts.

## Assumptions

* MVP should prioritize local project support through `trellis init --pi`, not publishing a separate Pi package.
* MVP should treat Pi as sub-agent capable if Trellis installs the required Pi extension and `.pi/agents` definitions.
* Pi can consume the shared Agent Skills standard directly, so Trellis should reuse common skills instead of duplicating workflow prose.
* `.pi/settings.json` is acceptable as the platform detection signal and managed config root.

## Requirements

* Add `pi` as a supported platform in the TypeScript platform registry.
* Add `--pi` to `trellis init`.
* Generate Pi project assets:
  * `.pi/settings.json`
  * `.pi/skills/<name>/SKILL.md` for Trellis auto-trigger workflows
  * `.pi/prompts/<name>.md` or `.pi/prompts/trellis-<name>.md` for user-invoked workflow prompts
  * `.pi/agents/trellis-implement.md`, `.pi/agents/trellis-check.md`, `.pi/agents/trellis-research.md`
  * `.pi/extensions/<trellis-subagent>/index.ts` or equivalent package-loaded extension exposing a `subagent` tool
* Add Pi to `_SUBAGENT_CONFIG_DIRS` when the generated extension/agents consume `implement.jsonl` / `check.jsonl`.
* Update `cli_adapter.py` with explicit Pi branches instead of falling through to Claude defaults.
* Add tests covering registry, init output, template collection, CLI flag, runtime adapter strings, and template shape.
* Update README / README_CN supported-tool lists.

## Proposed MVP Shape

Pi should start as an extension-backed sub-agent platform with Pi-specific output paths:

* `configDir`: `.pi`
* `cliFlag`: `pi`
* `hasPythonHooks`: `false`
* `agentCapable`: `true`
* `hasHooks`: `true`, but implemented through `.pi/extensions/*.ts` rather than Python hook scripts
* `userActionLabel`: `Slash commands`
* `cmdRefPrefix`: `/trellis-` for Trellis prompt-template commands; skills remain invokable through `/skill:<name>`
* Sub-agent mode:
  * Generate `.pi/agents/*.md` definitions.
  * Install a Pi extension based on the official subagent example or a Trellis-maintained equivalent.
  * Prefer injecting PRD/spec context inside the Trellis Pi extension when spawning sub-agents; use pull-based prelude only if prompt injection cannot be made reliable.
* Hook mode:
  * Generate `.pi/extensions/trellis/index.ts` or equivalent.
  * Register hook-equivalent event handlers for `session_start`, `input`, `before_agent_start`, `context`, and `tool_call` as needed.
  * Do not copy Trellis's shared Python hooks into `.pi`; Pi should use TypeScript extension hooks.
  * Model this after OpenCode's JS plugin architecture at the Trellis level, but adapt event names and payload handling to Pi.
  * Reuse the OpenCode idea of a local context helper module, but generate it under `.pi/extensions/trellis/` or `.pi/lib/` instead of `.opencode/lib/`.
* Commands:
  * Generate Pi prompt templates under `.pi/prompts/`.
  * Either `.pi/prompts/continue.md` and `.pi/prompts/finish-work.md`, invoked as `/continue` and `/finish-work`.
  * Or `.pi/prompts/trellis-continue.md` and `.pi/prompts/trellis-finish-work.md`, invoked as `/trellis-continue` and `/trellis-finish-work`.
  * Default: use the `trellis-` prefix to avoid colliding with user, package, or built-in command names.
* Skills:
  * `.pi/skills/before-dev/SKILL.md`
  * `.pi/skills/brainstorm/SKILL.md`
  * `.pi/skills/check/SKILL.md`
  * `.pi/skills/break-loop/SKILL.md`
  * `.pi/skills/update-spec/SKILL.md`

## Open Question

Two design choices remain:

* Sub-agent extension source:
  * Option A: vendor/adapt the official Pi `examples/extensions/subagent` code into Trellis templates. This is deterministic and testable.
  * Option B: load an external Pi package that provides sub-agents. This is smaller but adds dependency/version risk.
* OpenCode-style reuse boundary:
  * Reuse architecture: local TS extension + context helper + project-local generated files.
  * Do not reuse event names mechanically: OpenCode `chat.message` / `tool.execute.before` differs from Pi `input` / `before_agent_start` / `context` / `tool_call`.
* Pi prompt template naming:
  * Option A: Use plain Pi commands like `/continue` and `/finish-work`. This is shorter but can collide with user or package prompts.
  * Option B: Use prefixed commands like `/trellis-continue` and `/trellis-finish-work`. This matches Trellis's cross-platform namespace style and avoids collisions.

Default recommendation: vendor/adapt the extension for MVP, and use prefixed prompt names.

## Acceptance Criteria

* `trellis init --pi` creates `.pi/settings.json`, Trellis skills, Trellis prompt templates, Trellis sub-agent definitions, and the Pi extension needed to invoke them.
* `getConfiguredPlatforms()` detects Pi from `.pi`.
* `collectPlatformTemplates("pi")` tracks every file written by `configurePi()`.
* `cli_adapter.py` recognizes `pi`, returns `.pi` for `config_dir_name`, uses `pi -p` for non-interactive run, and uses `pi -c` or a documented unsupported resume behavior.
* Pi is listed as an agent-capable platform only if generated Trellis Pi assets provide a real sub-agent invocation path.
* Pi is listed as hook-capable in the registry, but `hasPythonHooks` remains false because hooks are TypeScript extension events.
* Pi-only projects seed `implement.jsonl` / `check.jsonl`, and Pi implement/check agents load that context before coding/review.
* Tests cover registry, configurator output, CLI flag roundtrip, adapter support, and template extraction if a physical template directory is added.
* README and README_CN mention Pi support and describe that sub-agents are provided through Trellis-installed Pi extension assets.

## Definition of Done

* Implementation is delegated to `trellis-implement` after PRD confirmation and context curation.
* `trellis-check` reviews and fixes the result.
* Lint/typecheck/tests relevant to `packages/cli` pass.
* Specs are updated if the Pi integration produces a new platform pattern worth documenting.

## Out of Scope

* Building workflow-state auto-injection beyond the sub-agent tool path.
* Publishing a reusable Pi package to npm or git.
* Parsing or importing Pi session JSONL exports.

## Technical Notes

* Relevant spec: `.trellis/spec/cli/backend/platform-integration.md`
* Relevant shared guide: `.trellis/spec/guides/cross-platform-thinking-guide.md`
* Research artifact: `.trellis/tasks/04-24-pi-agent-trellis-support/research/pi-agent-capabilities.md`
