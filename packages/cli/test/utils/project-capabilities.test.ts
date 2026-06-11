import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  applyCodexCapabilityConfig,
  buildProjectCapabilityTemplates,
  loadProjectCapabilities,
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
        "colbymchenry/codegraph",
        "none",
      ]),
    ).toEqual(["codebase-retrieval"]);

    expect(parseProjectCapabilities(["all"])).toEqual([
      "codebase-retrieval",
      "github-mcp",
      "playwright-mcp",
    ]);
  });

  it("rejects unknown capability ids", () => {
    expect(() => parseProjectCapabilities(["gitnexus"])).toThrow(
      /Unknown project capability/,
    );
  });

  it("loads stored legacy aliases while ignoring removed unknown selections", () => {
    const tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "trellis-capabilities-"),
    );
    try {
      fs.mkdirSync(path.join(tmpDir, ".trellis"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, ".trellis", "capabilities.json"),
        JSON.stringify({
          selected: [
            "fast-context-mcp",
            "codegraph",
            "legacy-architecture-graph",
            "playwright-mcp",
          ],
        }),
      );

      expect(loadProjectCapabilities(tmpDir)).toEqual([
        "codebase-retrieval",
        "playwright-mcp",
      ]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("renders Claude/Cursor MCP JSON without credentials", () => {
    const parsed = JSON.parse(
      renderMcpJson(["codebase-retrieval", "playwright-mcp"]),
    ) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };

    expect(parsed.mcpServers["fast-context"]).toEqual({
      command: "fast-context-mcp",
      args: [],
    });
    expect(parsed.mcpServers.codegraph).toEqual({
      command: "codegraph",
      args: ["serve"],
    });
    expect(parsed.mcpServers.playwright).toEqual({
      command: "npx",
      args: ["-y", "@playwright/mcp@latest"],
    });
    expect(JSON.stringify(parsed)).not.toMatch(
      /API[_-]?KEY|ACCESS[_-]?TOKEN|SECRET/i,
    );
  });

  it("renders role-based retrieval adapters and fallback guidance without credentials", () => {
    const parsed = JSON.parse(
      renderCapabilitiesJson(["codebase-retrieval"]),
    ) as {
      schema_version: number;
      selected: string[];
      capabilities: Record<
        string,
        {
          adapters?: Record<
            string,
            { provider: string; required: boolean; evidence_status: string }
          >;
          fallback: string[];
        }
      >;
    };
    const retrieval = parsed.capabilities["codebase-retrieval"];

    expect(parsed.schema_version).toBe(2);
    expect(parsed.selected).toEqual(["codebase-retrieval"]);
    expect(retrieval?.adapters?.exact).toEqual(
      expect.objectContaining({
        provider: "rg",
        required: true,
      }),
    );
    expect(retrieval?.adapters?.semantic).toEqual(
      expect.objectContaining({
        provider: "fast-context-mcp",
        required: false,
      }),
    );
    expect(retrieval?.fallback).toContain(
      "Install or expose `rg` on PATH before claiming codebase retrieval readiness.",
    );
    expect(JSON.stringify(parsed)).not.toMatch(
      /API[_-]?KEY|ACCESS[_-]?TOKEN|SECRET/i,
    );
  });

  it("renders structured CodeGraph CLI automation guidance under retrieval", () => {
    const parsed = JSON.parse(
      renderCapabilitiesJson(["codebase-retrieval"]),
    ) as {
      capabilities: Record<
        string,
        {
          cli_automation_guidance?: { command: string; use: string }[];
          routing: string;
        }
      >;
    };
    const retrieval = parsed.capabilities["codebase-retrieval"];

    expect(retrieval?.routing).toContain("retrieval role");
    expect(retrieval?.cli_automation_guidance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: "rg <pattern> <path>",
          use: expect.stringContaining("exact identifiers"),
        }),
        expect.objectContaining({
          command: "codegraph status <path> --json",
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

  it("renders Codex MCP server blocks inside a replaceable managed section", () => {
    const first = applyCodexCapabilityConfig("project_doc = []\n", [
      "codebase-retrieval",
      "github-mcp",
    ]);
    expect(first).toContain("# TRELLIS:PROJECT-CAPABILITIES:START");
    expect(first).toContain("[mcp_servers.fast-context]");
    expect(first).toContain("[mcp_servers.codegraph]");
    expect(first).toContain("[mcp_servers.github]");

    const second = applyCodexCapabilityConfig(first, ["playwright-mcp"]);
    expect(second).not.toContain("[mcp_servers.fast-context]");
    expect(second).not.toContain("[mcp_servers.codegraph]");
    expect(second).not.toContain("[mcp_servers.github]");
    expect(second).toContain("[mcp_servers.playwright]");
    expect(second.match(/TRELLIS:PROJECT-CAPABILITIES:START/g)).toHaveLength(
      1,
    );
  });

  it("builds project capability templates only for selected platforms", () => {
    const files = buildProjectCapabilityTemplates(
      ["codebase-retrieval", "playwright-mcp"],
      ["codex", "cursor"],
    );

    expect(files.get(".trellis/capabilities.json")).toContain(
      '"codebase-retrieval"',
    );
    expect(files.get(".trellis/capabilities.md")).toContain(
      "Unselected, unavailable, skipped, or uninvoked capabilities",
    );
    expect(files.get(".trellis/capabilities.md")).toContain(
      "## Codebase Retrieval Workflow",
    );
    expect(files.get(".trellis/capabilities.md")).toContain(
      "## Fallback Guidance",
    );
    expect(files.get(".codex/config.toml")).toContain(
      "[mcp_servers.fast-context]",
    );
    expect(files.get(".codex/config.toml")).toContain(
      "[mcp_servers.codegraph]",
    );
    expect(files.get(".cursor/mcp.json")).toContain('"playwright"');
    expect(files.has(".mcp.json")).toBe(false);
  });

  it("renders selected retrieval workflow and CLI routing", () => {
    const capabilitiesMd = renderCapabilitiesMarkdown(["codebase-retrieval"]);

    expect(capabilitiesMd).toContain("## Codebase Retrieval Workflow");
    expect(capabilitiesMd).toContain("## Adapter Roles");
    expect(capabilitiesMd).toContain("### exact");
    expect(capabilitiesMd).toContain("### ast");
    expect(capabilitiesMd).toContain("### lsp");
    expect(capabilitiesMd).toContain("### semantic");
    expect(capabilitiesMd).toContain("### verification");
    expect(capabilitiesMd).toContain("## CLI Automation Guidance");
    expect(capabilitiesMd).toContain("### codebase-retrieval");
    expect(capabilitiesMd).toContain("`rg <pattern> <path>`");
    expect(capabilitiesMd).toContain("`codegraph status <path> --json`");
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
    expect(capabilitiesMd).not.toContain("## MCP Query Guidance");
  });
});
