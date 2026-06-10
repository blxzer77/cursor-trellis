import { describe, expect, it } from "vitest";

import {
  applyCodexCapabilityConfig,
  buildProjectCapabilityTemplates,
  parseProjectCapabilities,
  renderCapabilitiesJson,
  renderCapabilitiesMarkdown,
  renderMcpJson,
} from "../../src/utils/project-capabilities.js";

describe("project capabilities", () => {
  it("parses aliases, comma-separated values, all, and none", () => {
    expect(
      parseProjectCapabilities([
        "fast-context",
        "colbymchenry/codegraph,graphify",
        "none",
      ]),
    ).toEqual(["fast-context-mcp", "codegraph", "graphify"]);

    expect(parseProjectCapabilities(["all"])).toEqual([
      "fast-context-mcp",
      "codegraph",
      "graphify",
      "github-mcp",
      "playwright-mcp",
    ]);
  });

  it("rejects unknown capability ids", () => {
    expect(() => parseProjectCapabilities(["gitnexus"])).toThrow(
      /Unknown project capability/,
    );
  });

  it("renders Claude/Cursor MCP JSON without credentials", () => {
    const parsed = JSON.parse(
      renderMcpJson(["fast-context-mcp", "playwright-mcp"]),
    ) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };

    expect(parsed.mcpServers["fast-context"]).toEqual({
      command: "fast-context-mcp",
      args: [],
    });
    expect(parsed.mcpServers.playwright).toEqual({
      command: "npx",
      args: ["-y", "@playwright/mcp@latest"],
    });
    expect(JSON.stringify(parsed)).not.toMatch(/TOKEN|KEY|SECRET/i);
  });

  it("renders readiness fallback guidance without credentials", () => {
    const parsed = JSON.parse(renderCapabilitiesJson(["fast-context-mcp"])) as {
      capabilities: Record<string, { fallback: string[] }>;
    };

    expect(parsed.capabilities["fast-context-mcp"].fallback).toContain(
      "Install or expose `fast-context-mcp` on PATH for the selected agent host.",
    );
    expect(JSON.stringify(parsed)).not.toMatch(/TOKEN|KEY|SECRET/i);
  });

  it("renders CodeGraph MCP server with the verified serve command", () => {
    const parsed = JSON.parse(renderMcpJson(["codegraph"])) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };

    expect(parsed.mcpServers.codegraph).toEqual({
      command: "codegraph",
      args: ["serve"],
    });
  });

  it("renders structured CodeGraph CLI automation guidance", () => {
    const parsed = JSON.parse(renderCapabilitiesJson(["codegraph"])) as {
      capabilities: Record<
        string,
        {
          cli_automation_guidance?: Array<{ command: string; use: string }>;
          routing: string;
        }
      >;
    };
    const codegraph = parsed.capabilities.codegraph;

    expect(codegraph.routing).toContain("For impact preflight");
    expect(codegraph.cli_automation_guidance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: "codegraph status --json <path>",
          use: expect.stringContaining("pending changes"),
        }),
        expect.objectContaining({
          command: "codegraph impact <symbol> --path <path> --depth <n> --json",
          use: expect.stringContaining("blast radius"),
        }),
        expect.objectContaining({
          command: "codegraph affected <changed-files...> --path <path> --json",
          use: expect.stringContaining("affected tests"),
        }),
      ]),
    );
  });

  it("renders structured Graphify MCP query guidance", () => {
    const parsed = JSON.parse(renderCapabilitiesJson(["graphify"])) as {
      capabilities: Record<
        string,
        {
          mcp_query_guidance?: Array<{ tool: string; use: string }>;
          routing: string;
        }
      >;
    };
    const graphify = parsed.capabilities.graphify;

    expect(graphify.routing).toContain("After explicit MCP approval");
    expect(graphify.mcp_query_guidance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          tool: "query_graph",
          use: expect.stringContaining("Broad architecture or concept"),
        }),
        expect.objectContaining({
          tool: "graph_stats",
          use: expect.stringContaining("coverage and health"),
        }),
        expect.objectContaining({
          tool: "shortest_path",
          use: expect.stringContaining("relationship path"),
        }),
      ]),
    );
  });

  it("renders Codex MCP server blocks inside a replaceable managed section", () => {
    const first = applyCodexCapabilityConfig("project_doc = []\n", [
      "fast-context-mcp",
      "github-mcp",
    ]);
    expect(first).toContain("# TRELLIS:PROJECT-CAPABILITIES:START");
    expect(first).toContain("[mcp_servers.fast-context]");
    expect(first).toContain('[mcp_servers.github]');

    const second = applyCodexCapabilityConfig(first, ["graphify"]);
    expect(second).not.toContain("[mcp_servers.fast-context]");
    expect(second).toContain("[mcp_servers.graphify]");
    expect(second.match(/TRELLIS:PROJECT-CAPABILITIES:START/g)).toHaveLength(
      1,
    );
  });

  it("builds project capability templates only for selected platforms", () => {
    const files = buildProjectCapabilityTemplates(
      ["fast-context-mcp", "playwright-mcp"],
      ["codex", "cursor"],
    );

    expect(files.get(".trellis/capabilities.json")).toContain(
      '"fast-context-mcp"',
    );
    expect(files.get(".trellis/capabilities.md")).toContain(
      "Unselected, unavailable, skipped, or uninvoked capabilities",
    );
    expect(files.get(".trellis/capabilities.md")).toContain(
      "## Fallback Guidance",
    );
    expect(files.get(".codex/config.toml")).toContain(
      "[mcp_servers.fast-context]",
    );
    expect(files.get(".cursor/mcp.json")).toContain('"playwright"');
    expect(files.has(".mcp.json")).toBe(false);
  });

  it("renders graph capability freshness boundaries", () => {
    const files = buildProjectCapabilityTemplates(["codegraph", "graphify"], [
      "claude-code",
    ]);
    const capabilitiesMd = files.get(".trellis/capabilities.md");

    expect(capabilitiesMd).toContain(
      "CodeGraph index markers are freshness hints, not proof",
    );
    expect(capabilitiesMd).toContain(
      "Graphify is artifact-first: existing `graphify-out` artifacts can orient work",
    );
    expect(capabilitiesMd).toContain(
      "they do not prove current-code behavior",
    );
    expect(capabilitiesMd).toContain("## Fallback Guidance");
    expect(capabilitiesMd).toContain(
      "If artifact freshness is unknown, treat Graphify output as orientation only",
    );
  });

  it("renders selected CodeGraph CLI automation routing", () => {
    const capabilitiesMd = renderCapabilitiesMarkdown(["codegraph"]);

    expect(capabilitiesMd).toContain("## CLI Automation Guidance");
    expect(capabilitiesMd).toContain("### codegraph");
    expect(capabilitiesMd).toContain("`codegraph status --json <path>`");
    expect(capabilitiesMd).toContain(
      "`codegraph query <symbol-or-search> --path <path> --json`",
    );
    expect(capabilitiesMd).toContain(
      "`codegraph callers <symbol> --path <path> --json`",
    );
    expect(capabilitiesMd).toContain(
      "`codegraph callees <symbol> --path <path> --json`",
    );
    expect(capabilitiesMd).toContain(
      "`codegraph impact <symbol> --path <path> --depth <n> --json`",
    );
    expect(capabilitiesMd).toContain(
      "`codegraph affected <changed-files...> --path <path> --json`",
    );
    expect(capabilitiesMd).toContain("readiness/freshness has been verified");
    expect(capabilitiesMd).toContain(
      "current source, Git, or tests confirm the claim",
    );
  });

  it("renders selected Graphify MCP query routing without implicit startup", () => {
    const capabilitiesMd = renderCapabilitiesMarkdown(["graphify"]);

    expect(capabilitiesMd).toContain("## MCP Query Guidance");
    expect(capabilitiesMd).toContain("### graphify");
    expect(capabilitiesMd).toContain("`query_graph`");
    expect(capabilitiesMd).toContain("`get_node`");
    expect(capabilitiesMd).toContain("`get_neighbors`");
    expect(capabilitiesMd).toContain("`get_community`");
    expect(capabilitiesMd).toContain("`god_nodes`");
    expect(capabilitiesMd).toContain("`graph_stats`");
    expect(capabilitiesMd).toContain("`shortest_path`");
    expect(capabilitiesMd).toContain(
      "explicitly approves any MCP runtime startup",
    );
    expect(capabilitiesMd).toContain(
      "source reads, Git, and tests remain the proof layer",
    );
    expect(capabilitiesMd).not.toContain("automatically start");
  });
});
