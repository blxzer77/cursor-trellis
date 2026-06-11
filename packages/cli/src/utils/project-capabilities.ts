import fs from "node:fs";
import path from "node:path";

import type { AITool } from "../types/ai-tools.js";
import { getConfigTemplate as getCodexConfigTemplate } from "../templates/codex/index.js";
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
      "Role-based local code retrieval through exact search, AST/structure, LSP expansion, semantic recall, and verification.",
    routing:
      "Use for codebase questions by retrieval role: collect exact identifiers and path hints with rg first, expand structural candidates with CodeGraph when available, use LSP for precise navigation when available, use fast-context for semantic recall, then verify final claims with source reads, Git, or tests.",
    readiness:
      "Required exact search (`rg`) is available. Optional CodeGraph, LSP, and fast-context adapters are reported as available or unavailable without startup side effects.",
    fallback: [
      "Install or expose `rg` on PATH before claiming codebase retrieval readiness.",
      "Ensure `npx -y fast-context-mcp` and `npx -y @colbymchenry/codegraph serve --mcp` can launch before generated MCP adapter entries are claimed as usable.",
      "If CodeGraph, LSP, or fast-context adapters are not verified, continue with exact search and direct file reads; do not claim missing adapter output.",
      "Run indexing, host MCP smoke checks, or language-server startup only after explicit user approval.",
    ],
    adapters: {
      exact: {
        provider: "rg",
        required: true,
        purpose:
          "Find identifiers, literals, paths, protocol constants, error codes, config keys, and test names.",
        readiness: "`rg` is available on PATH.",
        evidenceStatus:
          "High-confidence candidate evidence, still confirmed by direct source reads before final claims.",
      },
      ast: {
        provider: "codegraph",
        required: false,
        purpose:
          "Resolve symbols, definitions, imports, callers, callees, impact, affected files, and structural relationships.",
        readiness:
          "`npx -y @colbymchenry/codegraph serve --mcp` is available and index freshness is confirmed through status/query smoke or source/Git checks.",
        evidenceStatus:
          "Structural candidate and impact guidance until confirmed with current source, Git, or tests.",
        mcpServer: "codegraph",
      },
      lsp: {
        provider: "language-server",
        required: false,
        purpose:
          "Expand high-confidence candidates through definitions, references, implementations, hover, and workspace symbols.",
        readiness:
          "A project-appropriate language server is configured by the host; Trellis does not start it during init/update.",
        evidenceStatus:
          "Navigation candidate until the exact file and range are verified by source reads.",
      },
      semantic: {
        provider: "fast-context-mcp",
        required: false,
        purpose:
          "Recall conceptual or poorly named code areas and return candidate files, ranges, and follow-up grep terms.",
        readiness:
          "`npx -y fast-context-mcp` is available to the host and a project-scoped smoke search is confirmed outside ordinary init/update.",
        evidenceStatus:
          "Recall candidate only; never final proof without source/Git/test verification.",
        mcpServer: "fast-context",
      },
      verification: {
        provider: "source-git-tests",
        required: true,
        purpose:
          "Prove final claims with direct source reads, exact search confirmation, Git evidence, and focused validation.",
        readiness:
          "Repository files are readable and task-appropriate validation commands are available or blockers are recorded.",
        evidenceStatus: "Required proof layer for final technical claims.",
      },
    },
    cliAutomationGuidance: [
      {
        command: "rg <pattern> <path>",
        use: "Start with exact identifiers, literals, path hints, errors, config keys, and test names before broader semantic recall.",
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
        use: "Find direct upstream callers that may need edits or focused tests.",
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
    description: "GitHub repository, issue, pull request, and review operations.",
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
      note:
        "Trellis-managed project capability selection. Credentials and global MCP/client config stay outside repository templates.",
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

function appendCodebaseRetrievalWorkflow(lines: string[]): void {
  lines.push(
    "## Codebase Retrieval Workflow",
    "",
    "1. Extract exact identifiers, literals, path hints, error text, config keys, and test names from the question.",
    "2. Run exact `rg` search first and keep file/range candidates tied to source evidence.",
    "3. Use AST/CodeGraph only when available to resolve symbols, imports, callers, callees, impact, and affected files.",
    "4. Use LSP navigation only after candidate files or symbols exist; do not use it as the broad first-pass search.",
    "5. Use semantic recall for conceptual or poorly named areas, then turn returned files/ranges into exact follow-up checks.",
    "6. Fuse candidates by source proximity, tests, current Git state, and adapter freshness.",
    "7. Read files and run task-appropriate validation before making final behavior or impact claims.",
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
    "- `codebase-retrieval` routes by retrieval role, not by tool brand: exact search, AST/structure, LSP navigation, semantic recall, then verification.",
    "- Exact `rg` search and direct source reads are the baseline for current-code claims.",
    "- CodeGraph output is structural guidance until index freshness and current source/Git evidence are confirmed.",
    "- fast-context output is semantic recall only and must be converted into exact source checks before final claims.",
    "- GitHub MCP uses the GitHub API server package; remote writes require explicit user intent and the host's credential/tool posture must be clear.",
    "- Playwright MCP should be used for rendered UI evidence only when browser verification is part of the task.",
    "",
  );

  if (selectedIds.includes("codebase-retrieval")) {
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
    .filter(
      (capability) => (capability.mcpQueryGuidance?.length ?? 0) > 0,
    );

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
  if (platformSet.has("codex")) {
    const config = getCodexConfigTemplate();
    files.set(
      `.codex/${config.targetPath}`,
      applyCodexCapabilityConfig(config.content, selectedIds),
    );
  }
  if (platformSet.has("claude-code")) {
    files.set(".mcp.json", renderMcpJson(selectedIds));
  }
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
    if (
      relativePath === ".codex/config.toml" &&
      fs.existsSync(targetPath) &&
      normalizeLineEndings(fs.readFileSync(targetPath, "utf-8")) ===
        normalizeLineEndings(getCodexConfigTemplate().content)
    ) {
      fs.writeFileSync(targetPath, content);
      continue;
    }
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
