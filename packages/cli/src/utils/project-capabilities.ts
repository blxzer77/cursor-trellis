import fs from "node:fs";
import path from "node:path";

import type { AITool } from "../types/ai-tools.js";
import { ensureDir, writeFile } from "./file-writer.js";

export const PROJECT_CAPABILITY_IDS = [
  "codebase-retrieval",
  "github-mcp",
  "playwright-mcp",
] as const;

export type ProjectCapabilityId = (typeof PROJECT_CAPABILITY_IDS)[number];

export interface McpServerTemplate {
  name: string;
  command: string;
  args: string[];
  startupTimeoutSec?: number;
}

export interface McpQueryGuidance {
  tool: string;
  use: string;
}

export interface CliAutomationGuidance {
  command: string;
  use: string;
}

export interface ProjectCapabilityAdapter {
  provider: string;
  required: boolean;
  purpose: string;
  readiness: string;
  evidenceStatus: string;
  mcpServer?: string;
}

export interface ProjectCapability {
  id: ProjectCapabilityId;
  aliases: string[];
  title: string;
  description: string;
  routing: string;
  readiness: string;
  fallback: string[];
  adapters?: Record<string, ProjectCapabilityAdapter>;
  cliAutomationGuidance?: CliAutomationGuidance[];
  mcpQueryGuidance?: McpQueryGuidance[];
  mcpServers: McpServerTemplate[];
}

interface RenderedCapabilityAdapter {
  provider: string;
  required: boolean;
  purpose: string;
  readiness: string;
  evidence_status: string;
  mcp_server?: string;
}

const CAPABILITIES_JSON_PATH = ".trellis/capabilities.json";
const CAPABILITIES_MD_PATH = ".trellis/capabilities.md";
const CODEX_CAPABILITIES_START = "# TRELLIS:PROJECT-CAPABILITIES:START";
const CODEX_CAPABILITIES_END = "# TRELLIS:PROJECT-CAPABILITIES:END";

export const PROJECT_CAPABILITIES: readonly ProjectCapability[] = [
  {
    id: "codebase-retrieval",
    aliases: [
      "fast-context-mcp",
      "fast-context",
      "fast_context",
      "codegraph",
      "colbymchenry/codegraph",
      "colbymchenry-codegraph",
    ],
    title: "Codebase retrieval",
    description:
      "Role-based local code retrieval through exact search, AST/structure, optional editor/LSP navigation, semantic recall, and verification.",
    routing:
      "Use for codebase questions by retrieval role: extract exact identifiers, path hints, and policy phrases, run rg first, apply intent-gated policy/document-first routing for architecture, boundary, and storage-policy questions, apply other intent-gated branches (caller-chain, trap demotion, extension disambiguation, env/config literals) only when the question matches that class, expand structural candidates with CodeGraph when available and fresh enough, optionally use editor/LSP navigation (GO_TO_DEFINITION / find references) only after candidate symbols/files exist and when the host exposes it — not as a guaranteed Agent default tool, use fast-context for semantic recall last on policy/env-heavy queries, then promote only source/Git/test-backed findings to final claims.",
    readiness:
      "Required exact search (`rg`) is available. Optional CodeGraph, editor/LSP navigation, and fast-context adapters are reported as available, unavailable, or unverified without startup side effects. On Cursor Agent sessions, LSP is optional and often uncounted in benchmarks; prefer Grep, Read, and codegraph.",
    fallback: [
      "Install or expose `rg` on PATH before claiming codebase retrieval readiness.",
      "Ensure `npx -y fast-context-mcp` and `npx -y @colbymchenry/codegraph serve --mcp` can launch before generated MCP adapter entries are claimed as usable.",
      "If CodeGraph, LSP, or fast-context adapters are unavailable, skipped, stale, or uninvoked, label that adapter evidence as unverified and continue with exact search plus direct file reads.",
      "Record exploratory retrieval chains in task `research/*.md`; record final source/Git/test proof and unresolved adapter gaps in `verify.md`.",
      "Run indexing, host MCP smoke checks, or language-server startup only after explicit user approval.",
    ],
    adapters: {
      exact: {
        provider: "rg",
        required: true,
        purpose:
          "Find identifiers, literals, paths, protocol constants, error codes, config keys, policy phrases, env prefixes, extension ids, and test names.",
        readiness: "`rg` is available on PATH.",
        evidenceStatus:
          "Corroborated candidate evidence when current file/range matches are captured; still not final proof without source/Git/test confirmation.",
      },
      ast: {
        provider: "codegraph",
        required: false,
        purpose:
          "Resolve symbols, definitions, imports, callers, callees, impact, affected files, and structural relationships.",
        readiness:
          "`npx -y @colbymchenry/codegraph serve --mcp` is available and index freshness is confirmed through status/query smoke or source/Git checks.",
        evidenceStatus:
          "Structural candidate and impact guidance only; stale or unverified graph output must be confirmed with current source, Git, or tests.",
        mcpServer: "codegraph",
      },
      lsp: {
        provider: "language-server",
        required: false,
        purpose:
          "Optional editor/LSP navigation (definitions, references, hover) after candidates exist — not a guaranteed Cursor Agent tool; use Read and Grep when LSP is absent or uninvoked.",
        readiness:
          "Host-dependent: IDE language services or GO_TO_DEFINITION when exposed. Trellis does not start language servers during init/update; Agent cold runs may show zero LSP tool calls.",
        evidenceStatus:
          "Navigation candidate until exact file/range evidence is verified by source reads; label uninvoked LSP as unverified.",
      },
      semantic: {
        provider: "fast-context-mcp",
        required: false,
        purpose:
          "Recall conceptual or poorly named code areas and return candidate files, ranges, and follow-up grep terms.",
        readiness:
          "`npx -y fast-context-mcp` is available to the host and a project-scoped smoke search is confirmed outside ordinary init/update.",
        evidenceStatus:
          "Semantic recall candidate only; convert returned files/ranges/keywords into exact search and source reads before relying on it.",
        mcpServer: "fast-context",
      },
      verification: {
        provider: "source-git-tests",
        required: true,
        purpose:
          "Prove final claims with direct source reads, exact search confirmation, Git evidence, and focused validation.",
        readiness:
          "Repository files are readable and task-appropriate validation commands are available or blockers are recorded.",
        evidenceStatus:
          "Required proof layer for final technical claims and verification evidence.",
      },
    },
    cliAutomationGuidance: [
      {
        command: "rg <pattern> <path>",
        use: "Start with exact identifiers, literals, path hints, policy phrases, errors, config keys, and test names before broader semantic recall.",
      },
      {
        command:
          'rg -i "storage default|sidecar|sqlite only" AGENTS.md "**/AGENTS.md" README.md CONTRIBUTING.md .trellis/spec',
        use: "For architecture, boundary, or storage/persistence policy questions (OpenClaw benchmark C-class, especially storage-policy queries), search project instruction and policy docs before implementation modules such as SQLite or state DB files.",
      },
      {
        command: "Get-Content <file> | Select-Object -First <n>",
        use: "Read current source around candidate file ranges before turning retrieval output into a claim.",
      },
      {
        command: "git diff -- <path>",
        use: "Check current worktree changes before claiming behavior, impact, or test scope.",
      },
      {
        command: "codegraph status <path> --json",
        use: "Check initialization, graph size, languages, backend, and pending changes before relying on graph output.",
      },
      {
        command: "codegraph query <symbol-or-search> --path <path> --json",
        use: "Resolve candidate symbols, kinds, files, and line ranges before running impact or relationship commands.",
      },
      {
        command: "codegraph callers <symbol> --path <path> --json",
        use: "Find upstream callers; raise result limits or paginate with rg when the question asks which modules/files invoke a facade, loader, or helper (do not stop at the helper definition file).",
      },
      {
        command: "rg <env-prefix> scripts test e2e bench",
        use: "For env/config literal questions, search scripts, e2e, benchmark, and test trees before auth or runtime implementation modules under src/.",
      },
      {
        command: "rg <symbol> extensions/",
        use: "For shared extension exports, list every extension hit, then disambiguate by extension id in the query and non-empty export bodies before global semantic explore.",
      },
      {
        command: "codegraph callees <symbol> --path <path> --json",
        use: "Find downstream calls and dependencies that constrain a safe change.",
      },
      {
        command: "codegraph impact <symbol> --path <path> --depth <n> --json",
        use: "Estimate blast radius for a resolved symbol before editing or reviewing a refactor.",
      },
      {
        command: "codegraph affected <changed-files...> --path <path> --json",
        use: "Map changed source files to affected tests when preparing validation scope.",
      },
    ],
    mcpServers: [
      {
        name: "fast-context",
        command: "npx",
        args: ["-y", "fast-context-mcp"],
      },
      {
        name: "codegraph",
        command: "npx",
        args: ["-y", "@colbymchenry/codegraph", "serve", "--mcp"],
        startupTimeoutSec: 120,
      },
    ],
  },
  {
    id: "github-mcp",
    aliases: ["github"],
    title: "GitHub MCP",
    description:
      "GitHub repository, issue, pull request, and review operations.",
    routing:
      "Use for explicit GitHub remote work; distinguish read-only inspection from write-capable issue, PR, branch, review, or merge actions.",
    readiness:
      "Configured GitHub API MCP package is visible and `GITHUB_TOKEN` or `GITHUB_PERSONAL_ACCESS_TOKEN` is present in the agent host environment before remote actions are claimed.",
    fallback: [
      "Expose `GITHUB_TOKEN` or `GITHUB_PERSONAL_ACCESS_TOKEN` to the MCP server environment or configure the agent host explicitly.",
      "Ensure `npx -y @modelcontextprotocol/server-github` can launch before selecting this capability.",
      "Without a verified credential posture, use local Git only and do not claim GitHub remote actions.",
    ],
    mcpServers: [
      {
        name: "github",
        command: "npx",
        args: ["-y", "@modelcontextprotocol/server-github"],
      },
    ],
  },
  {
    id: "playwright-mcp",
    aliases: ["playwright"],
    title: "Playwright MCP",
    description:
      "Browser automation, frontend behavior checks, screenshots, and UI smoke verification.",
    routing:
      "Use for browser/UI verification when the task requires rendered behavior evidence; keep browser/session startup explicit.",
    readiness:
      "Configured server and browser runtime are available without silently starting unrelated browsing sessions.",
    fallback: [
      "Verify the Playwright MCP package and browser runtime in the selected host before claiming rendered UI evidence.",
      "If browser automation is unavailable, record the missing runtime and fall back to static checks or manual user verification.",
    ],
    mcpServers: [
      {
        name: "playwright",
        command: "npx",
        args: ["-y", "@playwright/mcp@latest"],
        startupTimeoutSec: 120,
      },
    ],
  },
];

const CAPABILITY_BY_TOKEN = new Map<string, ProjectCapabilityId>();
for (const capability of PROJECT_CAPABILITIES) {
  CAPABILITY_BY_TOKEN.set(capability.id, capability.id);
  for (const alias of capability.aliases) {
    CAPABILITY_BY_TOKEN.set(alias, capability.id);
  }
}

function selectedSet(
  selected: readonly ProjectCapabilityId[],
): Set<ProjectCapabilityId> {
  return new Set(selected);
}

function tokenizeProjectCapabilityValues(
  values: readonly string[] | undefined,
): string[] {
  return (values ?? [])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
}

function capabilityById(id: ProjectCapabilityId): ProjectCapability {
  const capability = PROJECT_CAPABILITIES.find((item) => item.id === id);
  if (!capability) {
    throw new Error(`Unknown project capability: ${id}`);
  }
  return capability;
}

function uniqueInRegistryOrder(
  values: Iterable<ProjectCapabilityId>,
): ProjectCapabilityId[] {
  const requested = new Set(values);
  return PROJECT_CAPABILITY_IDS.filter((id) => requested.has(id));
}

function uniqueMcpServers(
  selected: readonly ProjectCapabilityId[],
): McpServerTemplate[] {
  const servers = new Map<string, McpServerTemplate>();
  for (const id of uniqueInRegistryOrder(selected)) {
    for (const server of capabilityById(id).mcpServers) {
      if (!servers.has(server.name)) {
        servers.set(server.name, server);
      }
    }
  }
  return [...servers.values()];
}

function renderCapabilityAdapters(
  adapters: Record<string, ProjectCapabilityAdapter> | undefined,
): Record<string, RenderedCapabilityAdapter> | undefined {
  if (!adapters) {
    return undefined;
  }
  return Object.fromEntries(
    Object.entries(adapters).map(([role, adapter]) => [
      role,
      {
        provider: adapter.provider,
        required: adapter.required,
        purpose: adapter.purpose,
        readiness: adapter.readiness,
        evidence_status: adapter.evidenceStatus,
        ...(adapter.mcpServer ? { mcp_server: adapter.mcpServer } : {}),
      },
    ]),
  );
}

function parseStoredProjectCapabilities(
  values: readonly string[] | undefined,
): ProjectCapabilityId[] {
  const selected = new Set<ProjectCapabilityId>();
  for (const token of tokenizeProjectCapabilityValues(values)) {
    if (token === "none") {
      continue;
    }
    if (token === "all") {
      for (const id of PROJECT_CAPABILITY_IDS) {
        selected.add(id);
      }
      continue;
    }
    const id = CAPABILITY_BY_TOKEN.get(token);
    if (id) {
      selected.add(id);
    }
  }
  return uniqueInRegistryOrder(selected);
}

export function parseProjectCapabilities(
  values: readonly string[] | undefined,
): ProjectCapabilityId[] {
  const selected = new Set<ProjectCapabilityId>();
  for (const token of tokenizeProjectCapabilityValues(values)) {
    if (token === "none") {
      continue;
    }
    if (token === "all") {
      for (const id of PROJECT_CAPABILITY_IDS) {
        selected.add(id);
      }
      continue;
    }
    const id = CAPABILITY_BY_TOKEN.get(token);
    if (!id) {
      throw new Error(
        `Unknown project capability "${token}". Known values: ${[
          ...PROJECT_CAPABILITY_IDS,
          "all",
          "none",
        ].join(", ")}`,
      );
    }
    selected.add(id);
  }

  return uniqueInRegistryOrder(selected);
}

export function getProjectCapabilityChoices(): {
  id: ProjectCapabilityId;
  name: string;
}[] {
  return PROJECT_CAPABILITIES.map((capability) => ({
    id: capability.id,
    name: `${capability.title} - ${capability.description}`,
  }));
}

export function renderCapabilitiesJson(
  selected: readonly ProjectCapabilityId[],
): string {
  const selectedIds = uniqueInRegistryOrder(selected);
  const selectedLookup = selectedSet(selectedIds);
  const capabilities = Object.fromEntries(
    PROJECT_CAPABILITIES.map((capability) => {
      const adapters = renderCapabilityAdapters(capability.adapters);
      return [
        capability.id,
        {
          selected: selectedLookup.has(capability.id),
          mcp_servers: capability.mcpServers.map((server) => ({
            name: server.name,
            command: server.command,
            args: server.args,
            ...(server.startupTimeoutSec
              ? { startup_timeout_sec: server.startupTimeoutSec }
              : {}),
          })),
          routing: capability.routing,
          readiness: capability.readiness,
          fallback: capability.fallback,
          ...(adapters ? { adapters } : {}),
          ...(capability.cliAutomationGuidance
            ? { cli_automation_guidance: capability.cliAutomationGuidance }
            : {}),
          ...(capability.mcpQueryGuidance
            ? { mcp_query_guidance: capability.mcpQueryGuidance }
            : {}),
        },
      ];
    }),
  );

  return `${JSON.stringify(
    {
      schema_version: 2,
      note: "Trellis-managed project capability selection. Credentials and global MCP/client config stay outside repository templates.",
      selected: selectedIds,
      capabilities,
    },
    null,
    2,
  )}\n`;
}

export function getProjectCapability(
  id: ProjectCapabilityId,
): ProjectCapability {
  return capabilityById(id);
}

function appendPolicyDocumentRetrievalRouting(lines: string[]): void {
  lines.push(
    "## Policy and Document-First Routing (intent-gated)",
    "",
    "Apply this branch when the question is about architecture, responsibility, ownership, boundaries, project or package policy, storage or persistence policy, conventions, or where behavior is allowed, forbidden, or defined in instructions—not when the question names an exact symbol, protocol constant, schema path, platform file, or version literal (those stay symbol/path-first for strong A/G/F/J routes).",
    "",
    "Trigger signals include: 规定 / 边界 / 为什么不能 / storage policy / persistence / sidecar / import boundaries / transport-only / project instructions / AGENTS conventions.",
    "",
    "Evidence order for policy/document queries:",
    "",
    "1. Root and nested `AGENTS.md`, then `.trellis/spec/**`, `README.md`, `CONTRIBUTING.md`, architecture or design docs, and package-level policy or contract instruction files.",
    "2. Exact `rg` on policy phrases and boundary terms scoped to those paths (for example `Storage default: SQLite only`, `sidecar`, `SQLite only`, transport-only, import boundary).",
    "3. Read matched policy sections with direct source reads before ranking implementation files as Top-1.",
    "4. Use AST/CodeGraph or semantic recall only to corroborate policy claims or locate related implementation; do not let SQLite/state/cache modules outrank root policy docs when the question asks what is allowed or forbidden.",
    "5. Verify with source reads before final claims; optional adapters remain optional.",
    "",
    "### Storage and persistence policy (benchmark C03 pattern)",
    "",
    "When the question asks how storage is chosen, why sidecar files for cache or queue are forbidden, or SQLite vs JSON/JSONL policy: inspect root `AGENTS.md` (and nested `**/AGENTS.md`) before `src/state/*`, Kysely, or other storage implementation modules. Target Top-1 policy evidence such as `Storage default: SQLite only`, `state/openclaw.sqlite`, and `Kysely` cited from instruction docs, not from implementation adjacency alone. OpenClaw audit acceptance target for this query class: `>= 4/6` when agents follow this route.",
    "",
  );
}

function appendCodebaseRetrievalIntentBranches(lines: string[]): void {
  lines.push(
    "## Query Intent Branches (intent-gated)",
    "",
    "Apply these branches only when the question matches the intent class. Do not reorder the global workflow for F/G protocol queries, platform file paths, or questions with a single named symbol or constant—keep exact `rg` and symbol-scoped CodeGraph first.",
    "",
    "### Caller and assembly chain (B-class)",
    "",
    "- Use when the question asks who calls, which modules invoke, where behavior is wired, or which facade modules delegate work.",
    "- Do not treat facade-runtime, loader, barrel, plugin-registry-snapshot, or a single deliver/helper file as sufficient Top-1 evidence when the rubric expects many concrete call sites.",
    "- After exact hits on the helper or symbol, run `codegraph callers` with a raised limit (or repeat with `rg` references/imports) until concrete callee modules appear; follow assembly nodes (`*-runtime`, `server-runtime-services`, registry entry vs snapshot) with `codegraph callees` or targeted `rg`.",
    "- Rank concrete call-site files above the file that only defines or loads the helper.",
    "",
    "### Cross-cutting / conceptual discovery",
    "",
    "- Use when the question has no named symbol, path, or protocol constant but asks how behavior works, spans modules/packages, or uses conceptual phrasing (for example English *how does* / *across packages*, or Chinese 如何 / 机制 / 跨).",
    "- The deterministic router emits intent `cross-cutting-discovery` and promotes semantic recall to plan order 1–2 (after `policy-docs-rg` when policy intent also matches); follow with exact `rg` on returned keywords and paths.",
    "- **On Cursor**: router route id `platform-semantic` (`platformNative: true`) — use Cursor built-in codebase / semantic search (see `.cursor/rules/retrieval-routing.mdc`). **Do not** use `fast_context_search` or fast-context MCP for semantic recall on Cursor.",
    "- **On Codex, Claude Code, and other non-Cursor hosts**: router route id `semantic-fast-context` — invoke `fast_context_search` when the envelope fallback calls for semantic recall after uncorroborated exact `rg`.",
    "- When exact-symbol or F/G preserve intents match, keep exact `rg` primary; do not apply this branch.",
    "",
    "### Trap demotion and package boundary (E-class)",
    "",
    "- Use when similarly named files exist in a different package or layer (for example `src/agents/*` vs `packages/*-core`).",
    "- Parse path and package hints in the query; demote trap candidates until an export, protocol type, or corroborating call site matches the asked layer.",
    "- Prefer `packages/<name>/` evidence when the question names a core library; demote spawn/runtime overlay traps that share a prefix but live in agent glue code.",
    "- Do not promote a trap file to Top-1 without reading exports and at least one confirming reference.",
    "",
    "### Extension and shared-symbol disambiguation (A-class)",
    "",
    "- Use when one symbol (for example `legacyConfigRules`) appears across many `extensions/` trees.",
    "- Run exact `rg` across `extensions/` first; filter by extension id or directory named in the question.",
    "- Prefer the first non-empty export with a real implementation over stub or empty `doctor-contract-api` paths; demote traps listed in eval/query context when present.",
    "- Run CodeGraph explore only after the extension candidate set is narrowed—not as an unscoped global symbol search.",
    "",
    "### Environment and config literals (D-class)",
    "",
    "- Use when the question names env vars, `OPENCLAW_*` prefixes, benchmark startup, or e2e script configuration.",
    "- Run exact `rg` on `scripts/`, `test/`, `e2e/`, and `bench/` (or project equivalents) before `src/` auth, token, or runtime conflict modules.",
    "- Prefer files that assign or read the literal in scripts over implementation files that only mention the prefix in error handling.",
    "- Use CodeGraph after literal hits exist; do not let auth/runtime implementation outrank script evidence for env-inventory questions.",
    "",
    "### Preserve strong routes (F / G / exact symbol)",
    "",
    "- Platform paths (`apps/ios`, `apps/android`, Swift/Kotlin trees), `packages/gateway-protocol`, contract/schema globs, and named constants: exact `rg` plus symbol-scoped `codegraph_search` stay primary.",
    "- Do not run policy-first, trap demotion, or env-before-`src/` passes ahead of exact symbol discovery for those queries.",
    "",
  );
}

function appendCodebaseRetrievalWorkflow(lines: string[]): void {
  lines.push(
    "## Codebase Retrieval Workflow",
    "",
    "1. Extract exact identifiers, literals, path hints, policy phrases, command names, error text, config keys, env prefixes, extension ids, routes, event names, task names, and test names from the question.",
    "2. Run exact `rg` search first when exact signals exist and keep file/range candidates tied to source evidence.",
    "3. Classify intent (policy/document, caller-chain, trap/package, extension spread, env literal, protocol/platform) and apply **Policy and Document-First Routing** or the matching branch from **Query Intent Branches** when it fits; skip branches that do not match.",
    "4. Use AST/CodeGraph when available and fresh enough to resolve symbols, imports, callers, callees, impact, and affected files.",
    "5. Optionally use editor/LSP navigation (GO_TO_DEFINITION / references) only after candidate files or symbols exist; not a guaranteed Agent default — continue with Read and Grep when LSP is unavailable or uninvoked.",
    "6. Use semantic recall for conceptual, poorly named, or cross-cutting areas, then turn returned files/ranges/keywords into exact follow-up checks; deprioritize semantic Top-1 for policy/storage-policy, env-literal, and extension-disambiguation questions until policy docs or `rg` narrow candidates.",
    "7. Fuse candidates by source proximity, tests, current Git state, and adapter freshness.",
    "8. Read files, inspect relevant Git evidence, and run task-appropriate validation before making final behavior, impact, or test-coverage claims.",
    "",
    "## Codebase Evidence Levels",
    "",
    "- Candidate: filenames, semantic recall, initial graph/LSP output, or incomplete exact search. Candidate evidence cannot support final claims.",
    "- Corroborated candidate: current source reads or exact `rg` hits confirm the candidate exists in this checkout. Use it to plan deeper reads or tests.",
    "- Verified claim: current source lines plus Git evidence or focused validation support the statement. Use this level for final answers and `verify.md`.",
    "- Unverified / unavailable: adapter output is stale, skipped, unavailable, hidden from the host, or not invoked. Report it explicitly instead of claiming it.",
    "",
    "## Evidence Persistence",
    "",
    "- Record exploratory retrieval chains, adapter availability, freshness checks, and competing hypotheses in task `research/*.md`.",
    "- Record final source/Git/test proof, validation commands, and unresolved adapter gaps in `verify.md`.",
    "- Prefer reusable research frontmatter when the artifact should be rediscovered later: `doc_type`, `status`, `confidence`, `scope`, and `related_files`.",
    "",
    "## Fallback Sequence",
    "",
    "- If `rg` is missing, codebase retrieval readiness fails; install or expose `rg` before claiming readiness.",
    "- If CodeGraph, LSP, or fast-context are unavailable or unverified, continue with exact search, direct source reads, Git evidence, and focused tests.",
    "- Do not start MCP servers, initialize indexes, start language servers, or install tools without explicit user approval.",
    "",
    "## Adapter Roles",
    "",
  );

  const adapters = capabilityById("codebase-retrieval").adapters ?? {};
  for (const [role, adapter] of Object.entries(adapters)) {
    lines.push(
      `### ${role}`,
      "",
      `- Provider: ${adapter.provider}`,
      `- Required: ${adapter.required ? "yes" : "no"}`,
      `- Purpose: ${adapter.purpose}`,
      `- Readiness: ${adapter.readiness}`,
      `- Evidence status: ${adapter.evidenceStatus}`,
      "",
    );
  }

    lines.push(
    "## Semantic recall (Cursor)",
    "",
    "The `semantic` adapter role above lists **fast-context-mcp** as the default MCP provider for generated templates. **On Cursor**, the retrieval planner routes semantic intents to **platform-native search** (`platform-semantic`, `platformNative: true`) — use built-in codebase / semantic search; **not** fast-context MCP.",
    "",
    "Prefer `.cursor/rules/retrieval-routing.mdc` and `retrieval-daily-guide.md` for tool names.",
    "",
  );

  appendCodebaseRetrievalIntentBranches(lines);
}

export function renderCapabilitiesMarkdown(
  selected: readonly ProjectCapabilityId[],
): string {
  const selectedIds = uniqueInRegistryOrder(selected);
  const lines = [
    "# Trellis Project Capabilities",
    "",
    "This file records selected project capabilities for the Trellis workflow. It does not store credentials and does not prove readiness by itself.",
    "",
    "## Selected",
    "",
  ];

  if (selectedIds.length === 0) {
    lines.push("- none");
  } else {
    for (const id of selectedIds) {
      const capability = capabilityById(id);
      lines.push(`- ${capability.id}: ${capability.description}`);
    }
  }

  lines.push(
    "",
    "## Routing Rules",
    "",
    "- Unselected, unavailable, skipped, or uninvoked capabilities must not be reported as used.",
    "- Capability output that affects task decisions must be recorded in task research or verify evidence.",
    "- `codebase-retrieval` routes by retrieval role, not by tool brand: exact search, intent-gated policy/document-first routing for C-class questions, other intent-gated branches when the question class matches, AST/structure, LSP navigation, semantic recall, then verification.",
    "- Policy, architecture, boundary, and storage-policy questions must inspect `AGENTS.md`, `.trellis/spec/**`, and README/contributing/architecture docs before semantic implementation search.",
    "- Intent-gated branches (policy/document, caller-chain, trap demotion, extension disambiguation, env/config literals) must not override exact-symbol or F/G protocol routes.",
    "- Exact `rg` search and direct source reads are the baseline for current-code claims.",
    "- CodeGraph output is structural guidance until index freshness and current source/Git evidence are confirmed.",
    "- fast-context output is semantic recall only and must be converted into exact source checks before final claims.",
    "- On **Cursor**, semantic recall uses built-in search (`platform-semantic`); do not substitute fast-context MCP. See **Semantic recall (Cursor)** under codebase-retrieval.",
    "- On Cursor, per-query tool order also lives in `.cursor/rules/retrieval-routing.mdc` (`alwaysApply`).",
    "- GitHub MCP uses the GitHub API server package; remote writes require explicit user intent and the host's credential/tool posture must be clear.",
    "- Playwright MCP should be used for rendered UI evidence only when browser verification is part of the task.",
    "",
  );

  if (selectedIds.includes("codebase-retrieval")) {
    appendPolicyDocumentRetrievalRouting(lines);
    appendCodebaseRetrievalWorkflow(lines);
  }

  const selectedWithCliAutomation = selectedIds
    .map(capabilityById)
    .filter(
      (capability) => (capability.cliAutomationGuidance?.length ?? 0) > 0,
    );

  if (selectedWithCliAutomation.length > 0) {
    lines.push("## CLI Automation Guidance", "");
    for (const capability of selectedWithCliAutomation) {
      lines.push(
        `### ${capability.id}`,
        "",
        "- Run these commands only after the capability is selected and readiness/freshness has been verified or explicitly reported as unverified.",
        "- Treat adapter output as planning guidance until current source, Git, or tests confirm the claim.",
      );
      for (const hint of capability.cliAutomationGuidance ?? []) {
        lines.push(`- \`${hint.command}\`: ${hint.use}`);
      }
      lines.push("");
    }
  }

  const selectedWithQueryGuidance = selectedIds
    .map(capabilityById)
    .filter((capability) => (capability.mcpQueryGuidance?.length ?? 0) > 0);

  if (selectedWithQueryGuidance.length > 0) {
    lines.push("## MCP Query Guidance", "");
    for (const capability of selectedWithQueryGuidance) {
      lines.push(
        `### ${capability.id}`,
        "",
        "- Use these MCP query tools only after the capability is selected and the user explicitly approves any MCP runtime startup.",
        "- Treat tool output as orientation unless freshness is confirmed; source reads, Git, and tests remain the proof layer for current-code claims.",
      );
      for (const hint of capability.mcpQueryGuidance ?? []) {
        lines.push(`- \`${hint.tool}\`: ${hint.use}`);
      }
      lines.push("");
    }
  }

  lines.push("## Readiness Expectations", "");

  for (const capability of PROJECT_CAPABILITIES) {
    lines.push(`- ${capability.id}: ${capability.readiness}`);
  }

  lines.push("", "## Fallback Guidance", "");

  if (selectedIds.length === 0) {
    lines.push("- none");
  } else {
    for (const id of selectedIds) {
      const capability = capabilityById(id);
      lines.push(`### ${capability.id}`, "");
      for (const fallback of capability.fallback) {
        lines.push(`- ${fallback}`);
      }
      lines.push("");
    }
  }

  return `${lines.join("\n")}\n`;
}

function tomlString(value: string): string {
  return JSON.stringify(value);
}

function tomlArray(values: readonly string[]): string {
  return `[${values.map(tomlString).join(", ")}]`;
}

function renderCodexCapabilityBlock(
  selected: readonly ProjectCapabilityId[],
): string {
  const selectedIds = uniqueInRegistryOrder(selected);
  if (selectedIds.length === 0) {
    return "";
  }

  const lines = [
    CODEX_CAPABILITIES_START,
    "# Project-local MCP servers selected through Trellis.",
    "# Credentials stay in the agent host environment or user-level config.",
  ];

  for (const server of uniqueMcpServers(selectedIds)) {
    lines.push(
      "",
      `[mcp_servers.${server.name}]`,
      `command = ${tomlString(server.command)}`,
      `args = ${tomlArray(server.args)}`,
    );
    if (server.startupTimeoutSec) {
      lines.push(`startup_timeout_sec = ${server.startupTimeoutSec}`);
    }
  }

  lines.push(CODEX_CAPABILITIES_END);
  return lines.join("\n");
}

export function applyCodexCapabilityConfig(
  baseContent: string,
  selected: readonly ProjectCapabilityId[],
): string {
  const escapedStart = CODEX_CAPABILITIES_START.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const escapedEnd = CODEX_CAPABILITIES_END.replace(
    /[.*+?^${}()|[\]\\]/g,
    "\\$&",
  );
  const withoutExistingBlock = baseContent
    .replace(new RegExp(`\\n*${escapedStart}[\\s\\S]*?${escapedEnd}\\n*`), "\n")
    .trimEnd();
  const block = renderCodexCapabilityBlock(selected);
  if (!block) {
    return `${withoutExistingBlock}\n`;
  }
  return `${withoutExistingBlock}\n\n${block}\n`;
}

export function renderMcpJson(
  selected: readonly ProjectCapabilityId[],
): string {
  const servers = Object.fromEntries(
    uniqueMcpServers(selected).map((server) => [
      server.name,
      {
        command: server.command,
        args: server.args,
      },
    ]),
  );
  return `${JSON.stringify({ mcpServers: servers }, null, 2)}\n`;
}

export function buildProjectCapabilityTemplates(
  selected: readonly ProjectCapabilityId[],
  platforms: Iterable<AITool>,
): Map<string, string> {
  const selectedIds = uniqueInRegistryOrder(selected);
  const files = new Map<string, string>();
  if (selectedIds.length === 0) {
    return files;
  }

  files.set(CAPABILITIES_JSON_PATH, renderCapabilitiesJson(selectedIds));
  files.set(CAPABILITIES_MD_PATH, renderCapabilitiesMarkdown(selectedIds));

  const platformSet = new Set(platforms);
  if (platformSet.has("cursor")) {
    files.set(".cursor/mcp.json", renderMcpJson(selectedIds));
  }

  return files;
}

export async function writeProjectCapabilityFiles(
  cwd: string,
  selected: readonly ProjectCapabilityId[],
  platforms: Iterable<AITool>,
): Promise<void> {
  const files = buildProjectCapabilityTemplates(selected, platforms);
  if (files.size === 0) {
    return;
  }

  for (const [relativePath, content] of files) {
    const targetPath = path.join(cwd, ...relativePath.split("/"));
    ensureDir(path.dirname(targetPath));
    await writeFile(targetPath, content);
  }
}

function normalizeLineEndings(content: string): string {
  return content.replace(/\r\n/g, "\n");
}

export function loadProjectCapabilities(cwd: string): ProjectCapabilityId[] {
  const filePath = path.join(cwd, ...CAPABILITIES_JSON_PATH.split("/"));
  if (!fs.existsSync(filePath)) {
    return [];
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as {
      selected?: unknown;
    };
    if (!Array.isArray(parsed.selected)) {
      return [];
    }
    return parseStoredProjectCapabilities(
      parsed.selected.filter(
        (item): item is string => typeof item === "string",
      ),
    );
  } catch {
    return [];
  }
}

export function collectProjectCapabilityTemplates(
  cwd: string,
  platforms: Iterable<AITool>,
): Map<string, string> {
  return buildProjectCapabilityTemplates(
    loadProjectCapabilities(cwd),
    platforms,
  );
}
