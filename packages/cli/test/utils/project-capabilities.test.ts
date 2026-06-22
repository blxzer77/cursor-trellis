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
      renderMcpJson(["codebase-retrieval", "github-mcp", "playwright-mcp"]),
    ) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };

    expect(parsed.mcpServers["fast-context"]).toEqual({
      command: "npx",
      args: ["-y", "fast-context-mcp"],
    });
    expect(parsed.mcpServers.codegraph).toEqual({
      command: "npx",
      args: ["-y", "@colbymchenry/codegraph", "serve", "--mcp"],
    });
    expect(parsed.mcpServers.github).toEqual({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
    });
    expect(parsed.mcpServers.playwright).toEqual({
      command: "npx",
      args: ["-y", "@playwright/mcp@latest"],
    });
    expect(JSON.stringify(parsed)).not.toMatch(
      /gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|test-token/i,
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
        evidence_status: expect.stringContaining("Corroborated candidate"),
      }),
    );
    expect(retrieval?.adapters?.semantic).toEqual(
      expect.objectContaining({
        provider: "fast-context-mcp",
        required: false,
        evidence_status: expect.stringContaining("Semantic recall candidate"),
      }),
    );
    expect(retrieval?.fallback).toContain(
      "Install or expose `rg` on PATH before claiming codebase retrieval readiness.",
    );
    expect(retrieval?.fallback).toContain(
      "Ensure `npx -y fast-context-mcp` and `npx -y @colbymchenry/codegraph serve --mcp` can launch before generated MCP adapter entries are claimed as usable.",
    );
    expect(retrieval?.fallback).toContain(
      "If CodeGraph, LSP, or fast-context adapters are unavailable, skipped, stale, or uninvoked, label that adapter evidence as unverified and continue with exact search plus direct file reads.",
    );
    expect(retrieval?.fallback).toContain(
      "Record exploratory retrieval chains in task `research/*.md`; record final source/Git/test proof and unresolved adapter gaps in `verify.md`.",
    );
    expect(JSON.stringify(parsed)).toContain("GITHUB_TOKEN");
    expect(JSON.stringify(parsed)).toContain("GITHUB_PERSONAL_ACCESS_TOKEN");
    expect(JSON.stringify(parsed)).not.toMatch(
      /gh[pousr]_[A-Za-z0-9_]{20,}|sk-[A-Za-z0-9_-]{20,}|test-token/i,
    );
  });

  it("renders structured CodeGraph CLI automation guidance under retrieval", () => {
    const parsed = JSON.parse(
      renderCapabilitiesJson(["codebase-retrieval"]),
    ) as {
      capabilities: Record<
        string,
        {
          adapters?: Record<string, { purpose: string }>;
          cli_automation_guidance?: { command: string; use: string }[];
          routing: string;
        }
      >;
    };
    const retrieval = parsed.capabilities["codebase-retrieval"];

    expect(retrieval?.routing).toContain("policy/document-first routing");
    expect(retrieval?.routing).toContain("intent-gated");
    expect(retrieval?.routing).toContain("retrieval role");
    expect(retrieval?.adapters?.exact.purpose).toContain("policy phrases");
    expect(retrieval?.adapters?.exact.purpose).toContain("env prefixes");
    expect(retrieval?.cli_automation_guidance).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: "rg <pattern> <path>",
          use: expect.stringContaining("policy phrases"),
        }),
        expect.objectContaining({
          command:
            'rg -i "storage default|sidecar|sqlite only" AGENTS.md "**/AGENTS.md" README.md CONTRIBUTING.md .trellis/spec',
          use: expect.stringContaining("before implementation"),
        }),
        expect.objectContaining({
          command: "rg <env-prefix> scripts test e2e bench",
          use: expect.stringContaining("before auth"),
        }),
        expect.objectContaining({
          command: "rg <symbol> extensions/",
          use: expect.stringContaining("disambiguate"),
        }),
        expect.objectContaining({
          command: "codegraph callers <symbol> --path <path> --json",
          use: expect.stringContaining("facade"),
        }),
        expect.objectContaining({
          command: "Get-Content <file> | Select-Object -First <n>",
          use: expect.stringContaining("current source"),
        }),
        expect.objectContaining({
          command: "git diff -- <path>",
          use: expect.stringContaining("current worktree"),
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
    expect(first).not.toContain("[mcp_servers.graphify]");

    const second = applyCodexCapabilityConfig(first, ["playwright-mcp"]);
    expect(second).not.toContain("[mcp_servers.fast-context]");
    expect(second).not.toContain("[mcp_servers.codegraph]");
    expect(second).not.toContain("[mcp_servers.github]");
    expect(second).toContain("[mcp_servers.playwright]");
    expect(second.match(/TRELLIS:PROJECT-CAPABILITIES:START/g)).toHaveLength(1);
  });

  it("builds project capability templates only for selected platforms", () => {
    const files = buildProjectCapabilityTemplates(
      ["codebase-retrieval", "playwright-mcp"],
      ["cursor"],
    );

    expect(files.get(".trellis/capabilities.json")).toContain(
      '"codebase-retrieval"',
    );
    expect(files.get(".trellis/capabilities.md")).toContain(
      "## Fallback Guidance",
    );
    expect(files.get(".cursor/mcp.json")).toContain('"playwright"');
    expect(files.get(".cursor/mcp.json")).not.toContain('"graphify"');
    expect(files.has(".mcp.json")).toBe(false);
    expect(files.has(".codex/config.toml")).toBe(false);
  });

  it("renders selected retrieval workflow and CLI routing", () => {
    const capabilitiesMd = renderCapabilitiesMarkdown(["codebase-retrieval"]);

    expect(capabilitiesMd).toContain(
      "## Policy and Document-First Routing (intent-gated)",
    );
    expect(capabilitiesMd).toContain(
      "inspect `AGENTS.md`, `.trellis/spec/**`, and README/contributing/architecture docs before semantic implementation search",
    );
    expect(capabilitiesMd).toContain(
      "### Storage and persistence policy (benchmark C03 pattern)",
    );
    expect(capabilitiesMd).toContain(">= 4/6");
    expect(capabilitiesMd).toContain("## Codebase Retrieval Workflow");
    expect(capabilitiesMd).toContain("## Query Intent Branches (intent-gated)");
    expect(capabilitiesMd).toContain("Semantic recall (Cursor)");
    expect(capabilitiesMd).toContain("platform-semantic");
    expect(capabilitiesMd).toContain("### Cross-cutting / conceptual discovery");
    expect(capabilitiesMd).toContain("retrieval-routing.mdc");
    expect(capabilitiesMd).toContain("### Caller and assembly chain (B-class)");
    expect(capabilitiesMd).toContain(
      "### Trap demotion and package boundary (E-class)",
    );
    expect(capabilitiesMd).toContain(
      "### Extension and shared-symbol disambiguation (A-class)",
    );
    expect(capabilitiesMd).toContain(
      "### Environment and config literals (D-class)",
    );
    expect(capabilitiesMd).toContain(
      "### Preserve strong routes (F / G / exact symbol)",
    );
    expect(capabilitiesMd).toContain("Intent-gated branches");
    expect(capabilitiesMd).toContain("## Codebase Evidence Levels");
    expect(capabilitiesMd).toContain(
      "Candidate evidence cannot support final claims",
    );
    expect(capabilitiesMd).toContain("Corroborated candidate");
    expect(capabilitiesMd).toContain("Verified claim");
    expect(capabilitiesMd).toContain("Unverified / unavailable");
    expect(capabilitiesMd).toContain("## Evidence Persistence");
    expect(capabilitiesMd).toContain("task `research/*.md`");
    expect(capabilitiesMd).toContain("`verify.md`");
    expect(capabilitiesMd).toContain("## Fallback Sequence");
    expect(capabilitiesMd).toContain("## Adapter Roles");
    expect(capabilitiesMd).toContain("### exact");
    expect(capabilitiesMd).toContain("### ast");
    expect(capabilitiesMd).toContain("### lsp");
    expect(capabilitiesMd).toContain("### semantic");
    expect(capabilitiesMd).toContain("### verification");
    expect(capabilitiesMd).toContain("## CLI Automation Guidance");
    expect(capabilitiesMd).toContain("### codebase-retrieval");
    expect(capabilitiesMd).toContain("`rg <pattern> <path>`");
    expect(capabilitiesMd).toContain(
      "`Get-Content <file> | Select-Object -First <n>`",
    );
    expect(capabilitiesMd).toContain("`git diff -- <path>`");
    expect(capabilitiesMd).toContain("`codegraph status <path> --json`");
    expect(capabilitiesMd).toContain(
      "`codegraph query <symbol-or-search> --path <path> --json`",
    );
    expect(capabilitiesMd).toContain(
      "`codegraph callers <symbol> --path <path> --json`",
    );
    expect(capabilitiesMd).toContain(
      "`rg <env-prefix> scripts test e2e bench`",
    );
    expect(capabilitiesMd).toContain("`rg <symbol> extensions/`");
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
