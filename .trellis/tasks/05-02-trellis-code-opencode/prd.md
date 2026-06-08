# brainstorm: Trellis Code as an OpenCode Fork

## Goal

Build **Trellis Code** as a Trellis-owned fork of OpenCode so Trellis has its own code-agent runtime for benchmark demos, real user workflows, and the later GUI app. The goal is not to make a better OpenCode plugin; the goal is to own the runtime surface that Trellis GUI will depend on.

## What I already know

- User's product instinct: building "Trellis Code" on OpenCode is probably inevitable, not just a benchmark convenience.
- The benchmark exists to market Trellis; the Trellis marketing wedge exists to sell the later GUI app; the GUI app itself needs a code-agent runtime. Therefore the runtime is not optional benchmark infrastructure, it is on the product critical path.
- User clarified the desired direction: directly fork OpenCode to build Trellis Code, not use OpenCode's plugin system as the primary architecture.
- OpenCode is already a supported Trellis platform in this repo.
- Existing OpenCode benchmark research found the core driver capabilities are present: headless runs, custom providers, MCP permissions, JSONL telemetry, state isolation, and auto-approval controls.
- The current repo already ships OpenCode templates and plugins under `packages/cli/src/templates/opencode/`.
- Trellis currently integrates with many platforms, but does not yet expose a first-party "run code with Trellis semantics" command.
- OpenCode exposes three runtime surfaces Trellis can use: CLI/TUI, `opencode run --format json`, and `opencode serve` + SDK/SSE.
- OpenCode storage internals are not stable enough to become a GUI contract. Trellis GUI should consume a Trellis-owned event/runtime schema, not OpenCode disk state.
- Existing Trellis OpenCode plugins are interactive-first: `session-start.js` and `inject-workflow-state.js` skip when `OPENCODE_NON_INTERACTIVE=1`. Headless Trellis Code must inject context explicitly.
- Upstream OpenCode moves quickly. The local CLI was observed at `1.14.30`, upstream npm latest at `1.14.31`, and the generated `.opencode/package.json` still pins `@opencode-ai/plugin` to `1.1.40`.

## Assumptions

- "Trellis Code" should start from an OpenCode fork, not from a Trellis wrapper around stock OpenCode.
- The first product value is a stable local runtime contract for Trellis-controlled task execution and future GUI embedding.
- The benchmark task can become an early dogfood workload for this fork.
- The later GUI app should consume the same runtime surface instead of getting a separate execution path.

## Requirements (evolving)

- Provide a first-party command surface for running Trellis Code with Trellis-managed defaults.
- Provide a runtime boundary that a future Trellis GUI can call locally.
- Fork OpenCode and rebrand/package it as Trellis Code.
- Keep upstream OpenCode mergeability where possible, but prefer Trellis runtime correctness over plugin compatibility.
- Build Trellis workflow/spec/current-task/context behavior into the runtime instead of depending on OpenCode project-local plugins.
- Treat upstream OpenCode as the initial codebase, not as a runtime adapter.
- Make Trellis workflow state, current task, spec injection, sub-agent context, and session records work without users manually configuring OpenCode internals.
- Support both interactive usage and headless task execution.
- Emit structured run/session events suitable for GUI rendering, benchmark scoring, and debugging.
- Preserve raw OpenCode JSONL as a forensic artifact while exposing normalized Trellis events to consumers.
- Record Trellis Code version, upstream OpenCode base version/commit, binary path, and runtime compatibility metadata in every run/doctor report.
- Define which OpenCode internals Trellis Code will modify first: prompt/context assembly, run event schema, config defaults, provider/runtime bootstrap, GUI-facing server API, and packaging.
- Include diagnostics for Trellis Code version, upstream base version, config, provider auth, MCP availability, built-in Trellis runtime hooks, and Trellis session identity.
- Do not read, print, copy, or hardcode API keys or secret files.

## Acceptance Criteria (evolving)

- [ ] Recommended MVP scope is chosen and recorded.
- [ ] PRD defines the command surface for `trellis code`.
- [ ] PRD defines the local runtime contract that a GUI app would later consume.
- [ ] PRD defines the OpenCode fork scope: what is renamed, what is modified, what remains upstream-compatible.
- [ ] PRD records OpenCode research conclusions and compatibility risks.
- [ ] PRD includes an upstream-sync strategy so the fork does not immediately become unmaintainable.
- [ ] Implementation context is curated in `implement.jsonl` and `check.jsonl` before coding starts.

## Definition of Done

- Requirements and trade-offs are documented in this PRD.
- Relevant research is persisted under this task's `research/` directory.
- If implementation is approved, the task is started and implemented through the Trellis Phase 2 flow.
- Specs are updated if new platform-integration conventions are discovered.

## Out of Scope

- Full UI redesign in the MVP.
- Maintaining stock OpenCode plugin compatibility as the primary architecture.
- Building Trellis as only a project-local `.opencode/` template/plugin layer.
- Building a marketplace or hosted service.
- Supporting every provider on day one.
- Running benchmark workloads before the fork's token and config behavior is calibrated.

## Technical Approach

Recommended direction: **Trellis Code as an OpenCode fork**, implemented as thin slices.

1. Fork/import OpenCode into a separate Trellis Code repo or workspace, preserving MIT notices.
2. Rebrand binaries/package names from `opencode` / `opencode-ai` to `trellis-code` where user-facing.
3. Build Trellis context/runtime behavior into the fork: task selection, workflow state, spec injection, run manifests, normalized events, and GUI-facing APIs.
4. Keep CLI/TUI/headless/server modes, but make Trellis semantics first-class defaults instead of plugin-provided behavior.
5. Use the benchmark task as the first dogfood workload for `trellis-code run`.

## OpenCode Research Conclusions

- OpenCode is a viable starting codebase for Trellis Code because it already has a TUI, headless runs, local server, SDK, plugin hooks, project-local agents/skills, MCP config, provider config, permission controls, and JSON event output.
- The GUI path should use a Trellis runtime boundary built into the fork. It should not parse OpenCode storage files or depend on raw upstream event names.
- OpenCode's `run --format json` implementation is the right source pattern for Trellis Code's first headless execution primitive.
- OpenCode's `serve` + SDK/SSE implementation is the right source pattern for the GUI-facing runtime.
- The existing plugin integration remains useful as a prototype of desired behavior, but Trellis Code should move this behavior into the runtime/fork rather than requiring users to install `.opencode/plugins`.
- Fork cost is real because OpenCode moves quickly, but the product requirement is runtime ownership. The risk should be managed with a narrow fork delta and regular upstream sync, not avoided by choosing plugin-first.
- Forkability rating from research: **3/5**. A narrow Trellis Code fork is realistic; deep rewrites of LLM streaming, tool execution, storage, TUI/web UI, provider/auth, and binary packaging are high-maintenance.
- Direct OpenCode forks exist, but few are widely known products. Kilo CLI is the strongest OpenCode-fork product signal, while Mammouth Code is the clearest GitHub-confirmed productized direct fork.
- The broader market pattern is stronger than the direct OpenCode-fork list: successful AI coding forks win by owning a differentiated runtime/GUI/orchestration surface, not by only renaming the upstream agent.

## Forkability Assessment

OpenCode is suitable for a **narrow product fork**:

- Rebrand/package to `trellis-code`.
- Add Trellis run manifests and normalized events.
- Move current Trellis context/spec/workflow injection from plugin prototypes into runtime modules.
- Add GUI-facing server/API/event routes.
- Keep upstream model loop, TUI, server, MCP, provider/auth, and generic tool execution mostly intact at first.

OpenCode is not suitable for an unfocused deep fork in the first pass:

- Release packaging spans Bun native binaries, npm wrapper packages, platform optional dependencies, Docker, Homebrew, AUR, and postinstall behavior.
- Core runtime changes touch `session/llm`, `session/processor`, `tool/registry`, `session/session`, `config/config`, server routes, and Effect service wiring.
- Upstream releases quickly, so broad renames or UI rewrites would make upstream sync expensive.

MVP rule: **modify runtime boundaries that create Trellis product value; do not rewrite generic OpenCode internals until a concrete blocker appears.**

## Market Landscape

Confirmed or strong OpenCode-fork signals:

- **Kilo CLI** — Kilo's own docs/blog describe it as an OpenCode fork / OpenCode-server-based CLI, though the GitHub repo is not marked as a GitHub fork. This is the strongest product signal.
- **Mammouth Code** — GitHub-confirmed fork of OpenCode, rebranded around Mammouth API usage. Clearest productized direct fork found.
- **Finny / Whispercode / evil-opencode / shuvcode / opencode-sentinel** — confirmed GitHub forks or rebrands, but lower public product traction.

Adjacent non-fork products:

- **OpenWork** — GUI/host stack powered by OpenCode.
- **OpenChamber** — UI around OpenCode requiring the OpenCode CLI/server.
- **oh-my-openagent / oh-my-opencode** — high-traction harness/plugin distribution around OpenCode, not a direct runtime fork.

Adjacent fork pattern:

- Cline -> Roo Code -> Kilo Code, Codex CLI -> Every Code, and VS Code-derived AI editors show that runtime/editor forks can work when they own a differentiated product layer.

## Runtime Contract Draft

Trellis Code should expose a stable local contract independent of OpenCode internals.

Input shape:

```json
{
  "version": 1,
  "mode": "headless",
  "cwd": "/path/to/workspace",
  "taskDir": ".trellis/tasks/<task>",
  "contextId": "trellis-code-...",
  "promptFile": "prompt.md",
  "agent": "trellis-runner",
  "model": "provider/model",
  "permissions": "default-deny",
  "server": { "mode": "ephemeral" }
}
```

Output manifest:

```json
{
  "version": 1,
  "runId": "trc_...",
  "mode": "headless",
  "opencodeVersion": "1.14.30",
  "sessionId": "ses_...",
  "startedAt": "2026-05-02T00:00:00.000Z",
  "finishedAt": "2026-05-02T00:00:10.000Z",
  "exitCode": 0,
  "artifacts": {
    "events": "events.jsonl",
    "normalizedEvents": "trellis-events.jsonl",
    "stderr": "stderr.log",
    "opencodeExport": "session.json",
    "summary": "summary.json"
  }
}
```

Event stream:

- `run.started`
- `opencode.event`
- `session.created`
- `assistant.text`
- `tool.started`
- `tool.finished`
- `step.finished`
- `run.finished`
- `run.error`

## Fork Ownership Boundary

Trellis owns:

- Trellis Code fork repository/package.
- `trellis-code` binary and user-facing naming.
- Built-in Trellis task/workflow/spec context behavior.
- Trellis runtime manifests and normalized events.
- Prompt/context assembly for interactive and headless runs.
- GUI-facing server/API/event contract.
- Runtime artifacts, logs, benchmark/GUI-facing schemas, and update compatibility.

Upstream OpenCode remains the source to sync from:

- Model/tool loop execution.
- TUI and local server implementation.
- Provider adapters, MCP client behavior, permissions engine, and session engine.
- Raw run JSONL and SDK/server APIs until Trellis replaces or wraps them in-fork.

Trellis should avoid owning initially:

- OpenCode private storage layout.
- User provider secrets or auth stores.
- Deep UI rewrites unrelated to Trellis workflow/runtime needs.

## Decision (ADR-lite)

**Context**: Trellis needs a reliable execution surface for benchmarks, real users, and the later GUI app. Relying only on platform integrations or OpenCode plugins keeps Trellis dependent on host-level workflow behavior, while the GUI app needs a code-agent runtime that Trellis owns.

**Decision**: Build Trellis Code as a direct fork of OpenCode, with Trellis workflow/spec/runtime behavior moved into the fork over time.

**Consequences**: This gives Trellis full runtime control and a credible foundation for the GUI product. The trade-off is maintaining a fast-moving fork. The initial implementation must keep the fork delta small: rebrand/package, add Trellis runtime contract, then move current plugin behaviors into core one by one.

## Research References

- [`research/opencode-foundation.md`](research/opencode-foundation.md) — earlier wrapper-first analysis; superseded by the user's fork-first product direction, but still useful for OpenCode capability inventory.
- [`research/opencode-runtime-architecture.md`](research/opencode-runtime-architecture.md) — OpenCode run modes, JSON/SSE events, storage, lifecycle, and GUI-consumable runtime contract.
- [`research/opencode-extension-surfaces.md`](research/opencode-extension-surfaces.md) — plugins/hooks, agents, skills, MCP, permissions, provider/auth config, and compatibility risks.
- [`research/opencode-distribution-feasibility.md`](research/opencode-distribution-feasibility.md) — license, upstream package layout, executable distribution, wrapper vs fork trade-offs, and release cadence.
- [`research/opencode-forkability.md`](research/opencode-forkability.md) — source architecture, module boundaries, build/release packaging, high-friction areas, and 3/5 forkability rating.
- [`research/opencode-fork-landscape.md`](research/opencode-fork-landscape.md) — confirmed OpenCode forks, Kilo/Mammouth and adjacent derivative landscape.
- [`../05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md`](../05-02-trellis-spec-compounding-benchmark-toy-phase/research/opencode-driver.md) — verified OpenCode headless driver capabilities.

## Open Questions

- Where should the fork live: separate `trellis-code` repo, subtree/submodule inside this repo, or a new workspace package?
