import fs from "node:fs";
import path from "node:path";

import type { AITool } from "../types/ai-tools.js";
import { getConfigTemplate as getCodexConfigTemplate } from "../templates/codex/index.js";
import { ensureDir, writeFile } from "./file-writer.js";

export const PROJECT_CAPABILITY_IDS = [
  "fast-context-mcp",
  "codegraph",
  "graphify",
  "github-mcp",
  "playwright-mcp",
] as const;

export type ProjectCapabilityId = (typeof PROJECT_CAPABILITY_IDS)[number];

export interface McpServerTemplate {
  name: string;
  command: string;
  args: string[];
}

export interface McpQueryGuidance {
  tool: string;
  use: string;
}

export interface CliAutomationGuidance {
  command: string;
  use: string;
}

export interface ProjectCapability {
  id: ProjectCapabilityId;
  aliases: string[];
  title: string;
  description: string;
  routing: string;
  readiness: string;
  fallback: string[];
  cliAutomationGuidance?: CliAutomationGuidance[];
  mcpQueryGuidance?: McpQueryGuidance[];
  mcpServer: McpServerTemplate;
}

const CAPABILITIES_JSON_PATH = ".trellis/capabilities.json";
const CAPABILITIES_MD_PATH = ".trellis/capabilities.md";
const CODEX_CAPABILITIES_START = "# TRELLIS:PROJECT-CAPABILITIES:START";
const CODEX_CAPABILITIES_END = "# TRELLIS:PROJECT-CAPABILITIES:END";

export const PROJECT_CAPABILITIES: readonly ProjectCapability[] = [
  {
    id: "fast-context-mcp",
    aliases: ["fast-context", "fast_context"],
    title: "fast-context-mcp",
    description: "Semantic local code search and repository discovery.",
    routing:
      "Use for non-trivial local repository discovery, then confirm important findings with rg, Git, or direct file reads before final evidence claims.",
    readiness:
      "MCP server is visible to the selected agent host and can run a small project-scoped semantic search or return an actionable credential/API failure.",
    fallback: [
      "Install or expose `fast-context-mcp` on PATH for the selected agent host.",
      "If semantic search is unavailable, use `rg`, Git, and direct file reads; do not report fast-context results as evidence.",
    ],
    mcpServer: {
      name: "fast-context",
      command: "fast-context-mcp",
      args: [],
    },
  },
  {
    id: "codegraph",
    aliases: ["colbymchenry/codegraph", "colbymchenry-codegraph"],
    title: "colbymchenry/codegraph",
    description:
      "Code structure, definitions, relationships, impact, and path queries.",
    routing:
      "Use for structural graph questions after runtime/index freshness has been verified. For impact preflight, run status first, resolve symbols with query, inspect callers/callees, then use impact or affected-test automation as appropriate; do not treat stale graph output as current-code proof.",
    readiness:
      "Runtime is available. Common index markers are only freshness hints; current-code graph claims require a host-level status/query smoke or source/Git confirmation.",
    fallback: [
      "Install or expose `codegraph` on PATH and initialize or refresh the project index.",
      "If index freshness is missing, stale, or unverified, use source reads, tests, and Git evidence before making impact claims.",
    ],
    cliAutomationGuidance: [
      {
        command: "codegraph status --json <path>",
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
    mcpServer: {
      name: "codegraph",
      command: "codegraph",
      args: ["serve"],
    },
  },
  {
    id: "graphify",
    aliases: ["graphify-mcp"],
    title: "Graphify",
    description:
      "Architecture graph, wiki/memory, mixed-corpus analysis, and graph artifact navigation.",
    routing:
      "Prefer existing graphify-out artifacts for architecture orientation only; ask before building/updating graphs or starting optional MCP runtime. After explicit MCP approval against an existing graph, use Graphify MCP query tools for concept, node, neighbor, community, hotspot, coverage, and shortest-path questions, then confirm current-code claims with source, Git, or tests.",
    readiness:
      "Graphify runtime is available or artifact-first fallback exists. Existing artifacts orient work but do not prove current-code behavior until freshness is confirmed.",
    fallback: [
      "Use existing `graphify-out/GRAPH_REPORT.md`, `wiki/index.md`, or `graph.json` artifacts when present.",
      "If artifact freshness is unknown, treat Graphify output as orientation only and confirm current behavior with source reads, Git, or tests.",
      "Ask before starting Graphify MCP, building graphs, or updating graph artifacts.",
    ],
    mcpQueryGuidance: [
      {
        tool: "query_graph",
        use: "Broad architecture or concept discovery across an existing `graphify-out/graph.json` graph.",
      },
      {
        tool: "get_node",
        use: "Inspect exact node metadata before citing a specific Graphify node.",
      },
      {
        tool: "get_neighbors",
        use: "Explore adjacent modules, files, concepts, or dependency relationships around a known node.",
      },
      {
        tool: "get_community",
        use: "Read module/community context, labels, and architecture grouping for a known community.",
      },
      {
        tool: "god_nodes",
        use: "Find high-centrality architecture hotspots for preflight, risk scanning, or refactor orientation.",
      },
      {
        tool: "graph_stats",
        use: "Check graph coverage and health before relying on MCP query results.",
      },
      {
        tool: "shortest_path",
        use: "Trace a relationship path between two concepts, files, modules, or graph nodes.",
      },
    ],
    mcpServer: {
      name: "graphify",
      command: "graphify",
      args: ["--mcp"],
    },
  },
  {
    id: "github-mcp",
    aliases: ["github"],
    title: "GitHub MCP",
    description: "GitHub repository, issue, pull request, and review operations.",
    routing:
      "Use for explicit GitHub remote work; distinguish read-only inspection from write-capable issue, PR, branch, review, or merge actions.",
    readiness:
      "Configured server is visible and credentials/tool posture are known before remote actions are claimed.",
    fallback: [
      "Expose GitHub credentials to the MCP server environment or configure the agent host explicitly.",
      "Without a verified credential posture, use local Git only and do not claim GitHub remote actions.",
    ],
    mcpServer: {
      name: "github",
      command: "github-mcp-server",
      args: ["stdio"],
    },
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
    mcpServer: {
      name: "playwright",
      command: "npx",
      args: ["-y", "@playwright/mcp@latest"],
    },
  },
];

const CAPABILITY_BY_TOKEN = new Map<string, ProjectCapabilityId>();
for (const capability of PROJECT_CAPABILITIES) {
  CAPABILITY_BY_TOKEN.set(capability.id, capability.id);
  for (const alias of capability.aliases) {
    CAPABILITY_BY_TOKEN.set(alias, capability.id);
  }
}

function selectedSet(selected: readonly ProjectCapabilityId[]): Set<string> {
  return new Set(selected);
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

export function parseProjectCapabilities(
  values: readonly string[] | undefined,
): ProjectCapabilityId[] {
  const tokens = (values ?? [])
    .flatMap((value) => value.split(","))
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  const selected = new Set<ProjectCapabilityId>();
  for (const token of tokens) {
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

export function getProjectCapabilityChoices(): Array<{
  id: ProjectCapabilityId;
  name: string;
}> {
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
    PROJECT_CAPABILITIES.map((capability) => [
      capability.id,
      {
        selected: selectedLookup.has(capability.id),
        mcp_server: capability.mcpServer.name,
        command: capability.mcpServer.command,
        args: capability.mcpServer.args,
        routing: capability.routing,
        readiness: capability.readiness,
        fallback: capability.fallback,
        ...(capability.cliAutomationGuidance
          ? { cli_automation_guidance: capability.cliAutomationGuidance }
          : {}),
        ...(capability.mcpQueryGuidance
          ? { mcp_query_guidance: capability.mcpQueryGuidance }
          : {}),
      },
    ]),
  );

  return `${JSON.stringify(
    {
      schema_version: 1,
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
    "- `fast-context-mcp` semantic discovery must be confirmed with `rg`, Git, or direct file reads before final evidence claims.",
    "- CodeGraph index markers are freshness hints, not proof; run a host-level status/query smoke or confirm with source/Git evidence before graph-derived impact claims.",
    "- Graphify is artifact-first: existing `graphify-out` artifacts can orient work, but they do not prove current-code behavior and graph builds/updates or MCP startup require explicit approval.",
    "- GitHub MCP remote writes require explicit user intent and the host's credential/tool posture must be clear.",
    "- Playwright MCP should be used for rendered UI evidence only when browser verification is part of the task.",
    "",
  );

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
        "- Treat graph/index output as planning guidance until current source, Git, or tests confirm the claim.",
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
        "- Treat graph/index output as orientation unless freshness is confirmed; source reads, Git, and tests remain the proof layer for current-code claims.",
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

  for (const id of selectedIds) {
    const server = capabilityById(id).mcpServer;
    lines.push(
      "",
      `[mcp_servers.${server.name}]`,
      `command = ${tomlString(server.command)}`,
      `args = ${tomlArray(server.args)}`,
    );
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
    uniqueInRegistryOrder(selected).map((id) => {
      const server = capabilityById(id).mcpServer;
      return [
        server.name,
        {
          command: server.command,
          args: server.args,
        },
      ];
    }),
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
    return parseProjectCapabilities(
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
