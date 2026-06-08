# Pi Agent Capabilities Research

## Sources

* Pi README: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/README.md
* Pi skills docs: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/skills.md
* Pi settings docs: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/settings.md
* Pi extension docs: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/extensions.md
* Pi package docs: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/packages.md
* Pi SDK docs: https://github.com/badlogic/pi-mono/blob/main/packages/coding-agent/docs/sdk.md

## Findings

Pi should be treated as an extension-backed sub-agent capable platform, not as an agent-less workflow platform.

Relevant official behaviors:

* Pi reads project context files at startup, including `AGENTS.md` from parent directories and the current directory.
* Pi supports the Agent Skills standard. It loads skills from `.agents/skills/` and `.pi/skills/`, including project `.agents/skills` discovered from cwd/ancestor directories.
* Pi registers skills as `/skill:<name>` commands when `enableSkillCommands` is enabled.
* Pi has prompt-template slash commands. Markdown prompt templates in `.pi/prompts/` are invoked as `/<name>`.
* Pi project settings live at `.pi/settings.json` and can load `extensions`, `skills`, `prompts`, `themes`, and `packages`.
* Pi project-local extensions live under `.pi/extensions/` and can be hot-reloaded with `/reload`.
* Pi extensions can register slash commands via `pi.registerCommand(name, ...)`.
* `pi.getCommands()` returns extension commands, prompt templates, and skill commands; built-in interactive commands are handled separately.
* Pi extensions can register custom tools via `pi.registerTool(...)`.
* Pi extensions can subscribe to events such as `before_agent_start` and `tool_call`; `before_agent_start` can inject messages or modify the system prompt, and `tool_call` can mutate tool input or block execution.
* Pi packages can expose `extensions`, `skills`, `prompts`, and `themes` via the `pi` key in `package.json` or conventional directories.
* Pi's official repository includes `packages/coding-agent/examples/extensions/subagent/index.ts`, a sub-agent tool extension that:
  * registers a `subagent` tool
  * spawns separate `pi` processes with `--mode json -p --no-session`
  * supports single, parallel, and chain modes
  * discovers user agents from `~/.pi/agent/agents`
  * discovers project agents from the nearest `.pi/agents`
  * supports per-agent frontmatter fields such as `name`, `description`, `tools`, and `model`
  * can include project-local agents with `agentScope: "project"` or `agentScope: "both"`

## Corrected Interpretation

My earlier statement that Pi has no sub-agent support was too strong. The more accurate statement is:

* Pi does not need to be treated like an agent-less platform.
* Pi's sub-agent support is not the same shape as Claude/Codex built-ins, but the official extension API and official subagent example provide a concrete, supported path.
* Trellis can support Pi sub-agents by installing a Pi extension plus `.pi/agents` definitions.

## Implications for Trellis

Trellis should mark Pi as agent-capable if the generated project includes the sub-agent extension and Trellis agent definitions.

Pi hook mapping:

* Trellis `SessionStart`: Pi `session_start` can show/inject startup workflow state through an extension.
* Trellis `UserPromptSubmit`: Pi `input` can intercept, transform, block, or handle user input before skill/template expansion.
* Trellis "inject workflow state before model call": Pi `before_agent_start` can inject a persistent message and/or modify the turn system prompt.
* Trellis "modify messages before each provider request": Pi `context` can modify the message list before every LLM call.
* Trellis `PreToolUse`: Pi `tool_call` can inspect, modify, or block tool input before execution.
* Trellis tool execution telemetry: Pi `tool_execution_start`, `tool_execution_update`, and `tool_execution_end` expose lifecycle events.

Pi is therefore not a no-hook platform. It is an extension-hook platform. The key distinction is that Trellis should generate TypeScript extension assets instead of Python hook scripts and JSON hook config.

Comparison with OpenCode:

* Same broad category: both should use JS/TS extension assets rather than Trellis Python hooks.
* Same Trellis file style likely applies: generated project-local extension, shared helper module for reading `.trellis`, `.trellis/.current-task`, `prd.md`, and JSONL context files.
* OpenCode current templates use plugin files under `.opencode/plugins/` plus a helper library under `.opencode/lib/`.
* Pi should likely use `.pi/extensions/trellis/` plus a small local helper module, not `.opencode/plugins/` layout.
* OpenCode injects workflow state through `chat.message`; Pi's analogous event is closer to `input` for prompt interception and `before_agent_start` / `context` for model-context injection.
* OpenCode sub-agent context injection hooks `tool.execute.before` and mutates Task tool prompt args. Pi can either:
  * inject at `tool_call` if the subagent tool invocation exposes mutable input, or
  * inject inside the Trellis-maintained `subagent` tool before spawning child `pi` processes.
* OpenCode has an existing Task tool model; Pi's sub-agent path is extension/tool based, so Trellis likely owns more of the subagent orchestration code on Pi.
* Consequence: reuse Trellis's OpenCode plugin architecture ideas, but do not copy the OpenCode plugin event names or assume identical input/output payload shapes.

MVP should use a Pi-specific platform shape:

* Generate `.pi/settings.json`.
* Generate `.pi/skills/*/SKILL.md` from common skills.
* Generate `.pi/prompts/trellis-*.md` or `.pi/prompts/*.md` from common commands for slash-command invocation.
* Generate `.pi/agents/trellis-implement.md`, `.pi/agents/trellis-check.md`, and `.pi/agents/trellis-research.md`.
* Generate or package-load a Pi Trellis extension that exposes a `subagent` tool and handles Trellis hook-equivalent events.
* Add `.pi` to `_SUBAGENT_CONFIG_DIRS` only when Trellis's generated Pi setup actually consumes `implement.jsonl` / `check.jsonl`.
* Prefer hook-based context injection through the Pi extension if the sub-agent tool prompt path is controllable; otherwise use pull-based context loading in Pi agent definitions.

Open design point:

* Either vendor/adapt the official subagent extension into Trellis templates, or depend on a Pi package that provides the same tool. Vendoring gives deterministic init output and testability; package dependency keeps Trellis smaller but creates an external version dependency.
* Decide whether context injection should happen at `before_agent_start` for every Pi turn, inside the Trellis `subagent` tool before spawning child `pi` processes, or both.
