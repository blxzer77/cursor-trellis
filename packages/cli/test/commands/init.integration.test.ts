/**
 * Integration tests for the init() command.
 *
 * Tests the full init flow in real temp directories with minimal mocking.
 * Only external dependencies are mocked: figlet, inquirer, child_process.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// === External dependency mocks (hoisted by vitest) ===

vi.mock("figlet", () => ({
  default: { textSync: vi.fn(() => "TRELLIS") },
}));

vi.mock("inquirer", () => ({
  default: { prompt: vi.fn().mockResolvedValue({}) },
}));

vi.mock("node:child_process", () => ({
  execSync: vi.fn().mockReturnValue(""),
}));

// === Imports ===

import { init } from "../../src/commands/init.js";
import { VERSION } from "../../src/constants/version.js";
import { DIR_NAMES, FILE_NAMES, PATHS } from "../../src/constants/paths.js";
import { collectPlatformTemplates } from "../../src/configurators/index.js";
import { computeHash } from "../../src/utils/template-hash.js";
import { execSync } from "node:child_process";
import inquirer from "inquirer";

// eslint-disable-next-line @typescript-eslint/no-empty-function
const noop = () => {};

function capabilityLookupCommand(command: string): string {
  return process.platform === "win32"
    ? `where "${command}"`
    : `command -v '${command}'`;
}

function capabilityHelpCommand(command: string): string {
  return process.platform === "win32"
    ? `"${command}" --help`
    : `'${command}' --help`;
}

function npmPackageLookupCommand(packageName: string): string {
  return process.platform === "win32"
    ? `npm view "${packageName}" bin --json`
    : `npm view '${packageName}' bin --json`;
}

describe("init() integration", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-init-int-"));
    vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    vi.spyOn(console, "log").mockImplementation(noop);
    vi.spyOn(console, "warn").mockImplementation(noop);
    vi.spyOn(console, "error").mockImplementation(noop);
    vi.mocked(inquirer.prompt).mockReset();
    vi.mocked(inquirer.prompt).mockResolvedValue({});
    vi.mocked(execSync).mockClear();
    vi.mocked(execSync).mockImplementation(((cmd: string) => {
      const expectedPythonCmd =
        process.platform === "win32" ? "python" : "python3";
      if (cmd === `${expectedPythonCmd} --version`) {
        return "Python 3.11.12";
      }
      if (cmd === "smart-search doctor --format json") {
        return JSON.stringify({ ok: true, minimum_profile_ok: true });
      }
      return "";
    }) as typeof execSync);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("#1 creates expected directory structure with defaults", async () => {
    await init({ yes: true });

    // Core workflow structure
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, PATHS.SCRIPTS))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, PATHS.WORKSPACE))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, PATHS.TASKS))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, PATHS.SPEC))).toBe(true);

    // Default platform: cursor only
    expect(fs.existsSync(path.join(tmpDir, ".cursor"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".codex"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".agents", "skills"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".agent", "workflows"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".kiro", "skills"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".gemini"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".qoder"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".codebuddy"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".windsurf", "workflows"))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(tmpDir, ".github", "copilot"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".factory"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".pi"))).toBe(false);

    // Root files
    expect(fs.existsSync(path.join(tmpDir, "AGENTS.md"))).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW, "capabilities.json")),
    ).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".mcp.json"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".cursor", "mcp.json"))).toBe(false);

    // Cursor commands-only policy: 3 slash commands, no skills shipped.
    expect(
      fs.existsSync(
        path.join(tmpDir, ".cursor", "commands", "trellis-continue.md"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(tmpDir, ".cursor", "commands", "trellis-finish-work.md"),
      ),
    ).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          tmpDir,
          ".cursor",
          "commands",
          "trellis-cursor2plus-setup.md",
        ),
      ),
    ).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".cursor", "skills"))).toBe(false);
  });

  it("#1f writes selected project capability config for cursor", async () => {
    await init({
      yes: true,
      cursor: true,
      capability: ["fast-context-mcp", "playwright"],
    });

    const capabilities = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, DIR_NAMES.WORKFLOW, "capabilities.json"),
        "utf-8",
      ),
    ) as { selected: string[] };
    expect(capabilities.selected).toEqual([
      "codebase-retrieval",
      "playwright-mcp",
    ]);

    const cursorMcp = JSON.parse(
      fs.readFileSync(path.join(tmpDir, ".cursor", "mcp.json"), "utf-8"),
    ) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    expect(cursorMcp.mcpServers.playwright).toEqual({
      command: "npx",
      args: ["-y", "@playwright/mcp@latest"],
    });
    expect(fs.existsSync(path.join(tmpDir, ".mcp.json"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".codex", "config.toml"))).toBe(false);
  });


  it("#1f.1 writes GitHub MCP config when GitHub token env is visible", async () => {
    vi.stubEnv("GITHUB_TOKEN", "test-token");
    vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "");

    await init({
      yes: true,
      cursor: true,
      capability: ["github-mcp"],
    });

    const capabilities = JSON.parse(
      fs.readFileSync(
        path.join(tmpDir, DIR_NAMES.WORKFLOW, "capabilities.json"),
        "utf-8",
      ),
    ) as { selected: string[] };
    expect(capabilities.selected).toEqual(["github-mcp"]);

    const cursorMcp = JSON.parse(
      fs.readFileSync(path.join(tmpDir, ".cursor", "mcp.json"), "utf-8"),
    ) as {
      mcpServers: Record<string, { command: string; args: string[] }>;
    };
    expect(cursorMcp.mcpServers.github).toEqual({
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
    });
    expect(JSON.stringify(cursorMcp)).not.toContain("test-token");
    expect(fs.existsSync(path.join(tmpDir, ".mcp.json"))).toBe(false);
  });

  it("#1b does not print the promotional pain-point block", async () => {
    await init({ yes: true });

    const logOutput = vi
      .mocked(console.log)
      .mock.calls.flat()
      .filter((part): part is string => typeof part === "string")
      .join("\n");

    expect(logOutput).not.toContain("Sound familiar?");
    expect(logOutput).not.toContain("You'll never say these again!!");
    expect(logOutput).not.toContain("Wrote CLAUDE.md, AI ignored it");
  });

  it("#1c verifies Smart Search readiness during init", async () => {
    await init({ yes: true });

    expect(execSync).toHaveBeenCalledWith(
      "smart-search doctor --format json",
      expect.objectContaining({
        encoding: "utf-8",
        stdio: "pipe",
      }),
    );
  });

  it("#1d blocks init when Smart Search readiness fails", async () => {
    vi.mocked(execSync).mockImplementation(((cmd: string) => {
      const expectedPythonCmd =
        process.platform === "win32" ? "python" : "python3";
      if (cmd === `${expectedPythonCmd} --version`) {
        return "Python 3.11.12";
      }
      if (cmd === "smart-search doctor --format json") {
        const error = new Error("Command failed: smart-search doctor");
        Object.assign(error, {
          status: 2,
          stdout: JSON.stringify({
            ok: false,
            minimum_profile_ok: false,
            minimum_profile_missing: ["main_search"],
            error_type: "config_error",
            error: "standard minimum profile is not configured",
          }),
        });
        throw error;
      }
      return "";
    }) as typeof execSync);

    await expect(init({ yes: true })).rejects.toThrow(
      /Smart Search readiness failed[\s\S]*smart-search setup/,
    );
    expect(execSync).not.toHaveBeenCalledWith(
      "smart-search setup",
      expect.anything(),
    );
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(false);
  });

  it("#1d.1 interactive init can run smart-search setup and re-check readiness", async () => {
    let doctorCalls = 0;
    vi.mocked(execSync).mockImplementation(((cmd: string) => {
      const expectedPythonCmd =
        process.platform === "win32" ? "python" : "python3";
      if (cmd === `${expectedPythonCmd} --version`) {
        return "Python 3.11.12";
      }
      if (cmd === "smart-search doctor --format json") {
        doctorCalls += 1;
        if (doctorCalls === 1) {
          const error = new Error("Command failed: smart-search doctor");
          Object.assign(error, {
            status: 2,
            stdout: JSON.stringify({
              ok: false,
              minimum_profile_ok: false,
              minimum_profile_missing: ["main_search"],
              error_type: "config_error",
              error: "standard minimum profile is not configured",
            }),
          });
          throw error;
        }
        return JSON.stringify({ ok: true, minimum_profile_ok: true });
      }
      if (cmd === "smart-search setup") {
        return "";
      }
      return "";
    }) as typeof execSync);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: 1, templates: [] }),
      }),
    );
    vi.mocked(inquirer.prompt)
      .mockResolvedValueOnce({ tools: ["claude"] })
      .mockResolvedValueOnce({ capabilities: [] })
      .mockResolvedValueOnce({ smartSearchSetupAction: "setup" });

    await init({ user: "test-dev" });

    expect(doctorCalls).toBe(2);
    expect(execSync).toHaveBeenCalledWith("smart-search setup", {
      stdio: "inherit",
    });
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(true);
    expect(inquirer.prompt).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: "smartSearchSetupAction",
          message: expect.stringContaining(
            "Smart Search provider configuration",
          ),
        }),
      ]),
    );
  });

  it("#1e --skip-readiness bypasses Smart Search doctor and reports unverified readiness", async () => {
    await init({ yes: true, skipReadiness: true });

    const calls = vi.mocked(execSync).mock.calls;
    expect(
      calls.some(([cmd]) => cmd === "smart-search doctor --format json"),
    ).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("framework readiness is not verified"),
    );
  });

  it("#1g blocks init before writes when selected capability readiness fails", async () => {
    vi.mocked(execSync).mockImplementation(((cmd: string) => {
      const expectedPythonCmd =
        process.platform === "win32" ? "python" : "python3";
      if (cmd === `${expectedPythonCmd} --version`) {
        return "Python 3.11.12";
      }
      if (cmd === "smart-search doctor --format json") {
        return JSON.stringify({ ok: true, minimum_profile_ok: true });
      }
      if (cmd === capabilityLookupCommand("rg")) {
        throw new Error("rg not found");
      }
      return "";
    }) as typeof execSync);

    await expect(
      init({ yes: true, capability: ["codebase-retrieval"] }),
    ).rejects.toThrow(
      /Selected project capability readiness failed[\s\S]*codebase-retrieval[\s\S]*rg[\s\S]*trellis init --skip-readiness/,
    );
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(false);
  });

  it("#1h --skip-readiness bypasses selected capability probes", async () => {
    await init({
      yes: true,
      skipReadiness: true,
      capability: ["codebase-retrieval"],
    });

    const calls = vi.mocked(execSync).mock.calls;
    expect(calls.some(([cmd]) => cmd === capabilityLookupCommand("rg"))).toBe(
      false,
    );
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(true);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Selected project capability readiness skipped"),
    );
  });

  it("#1h.1 interactive init can re-check selected capability readiness after user-approved setup", async () => {
    let capabilityLookups = 0;
    vi.mocked(execSync).mockImplementation(((cmd: string) => {
      const expectedPythonCmd =
        process.platform === "win32" ? "python" : "python3";
      if (cmd === `${expectedPythonCmd} --version`) {
        return "Python 3.11.12";
      }
      if (cmd === "smart-search doctor --format json") {
        return JSON.stringify({ ok: true, minimum_profile_ok: true });
      }
      if (cmd === capabilityLookupCommand("rg")) {
        capabilityLookups += 1;
        if (capabilityLookups === 1) {
          throw new Error("rg not found");
        }
        return "";
      }
      return "";
    }) as typeof execSync);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ version: 1, templates: [] }),
      }),
    );
    vi.mocked(inquirer.prompt).mockResolvedValueOnce({
      capabilitySetupAction: "recheck",
    });

    await init({
      user: "test-dev",
      cursor: true,
      capability: ["codebase-retrieval"],
    });

    expect(capabilityLookups).toBe(2);
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".cursor", "mcp.json"))).toBe(true);
    expect(inquirer.prompt).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          name: "capabilitySetupAction",
          message: expect.stringContaining(
            "Selected project capability readiness failed",
          ),
        }),
      ]),
    );
  });

  it("#1i warns when CodeGraph index freshness is not proven", async () => {
    await init({ yes: true, capability: ["codegraph"] });

    expect(execSync).toHaveBeenCalledWith(
      capabilityLookupCommand("rg"),
      expect.objectContaining({
        encoding: "utf-8",
        stdio: "pipe",
      }),
    );
    expect(execSync).toHaveBeenCalledWith(
      capabilityLookupCommand("npx"),
      expect.objectContaining({
        encoding: "utf-8",
        stdio: "pipe",
      }),
    );
    expect(execSync).toHaveBeenCalledWith(
      npmPackageLookupCommand("@colbymchenry/codegraph"),
      expect.objectContaining({
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 5000,
      }),
    );
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(true);
    const capabilitiesMd = fs.readFileSync(
      path.join(tmpDir, DIR_NAMES.WORKFLOW, "capabilities.md"),
      "utf-8",
    );
    expect(capabilitiesMd).toContain("## CLI Automation Guidance");
    expect(capabilitiesMd).toContain("`codegraph status <path> --json`");
    expect(capabilitiesMd).toContain(
      "`codegraph impact <symbol> --path <path> --depth <n> --json`",
    );
    expect(capabilitiesMd).toContain(
      "`codegraph affected <changed-files...> --path <path> --json`",
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("No common CodeGraph index marker was found"),
    );
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Structural graph output remains unverified"),
    );
  });

  it("#1j blocks retrieval when a generated semantic MCP adapter package is unavailable", async () => {
    vi.mocked(execSync).mockImplementation(((cmd: string) => {
      const expectedPythonCmd =
        process.platform === "win32" ? "python" : "python3";
      if (cmd === `${expectedPythonCmd} --version`) {
        return "Python 3.11.12";
      }
      if (cmd === "smart-search doctor --format json") {
        return JSON.stringify({ ok: true, minimum_profile_ok: true });
      }
      if (cmd === npmPackageLookupCommand("fast-context-mcp")) {
        throw new Error("fast-context-mcp not found");
      }
      return "";
    }) as typeof execSync);

    await expect(
      init({ yes: true, capability: ["codebase-retrieval"] }),
    ).rejects.toThrow(
      /Selected project capability readiness failed[\s\S]*fast-context[\s\S]*trellis init --skip-readiness/,
    );
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(false);
  });

  it("#1k blocks GitHub MCP when the required token env is not visible", async () => {
    vi.stubEnv("GITHUB_TOKEN", "");
    vi.stubEnv("GITHUB_PERSONAL_ACCESS_TOKEN", "");
    vi.stubEnv("GH_TOKEN", "legacy-token");

    await expect(
      init({ yes: true, capability: ["github-mcp"] }),
    ).rejects.toThrow(
      /Selected project capability readiness failed[\s\S]*github-mcp[\s\S]*GITHUB_TOKEN[\s\S]*GITHUB_PERSONAL_ACCESS_TOKEN[\s\S]*trellis init --skip-readiness/,
    );
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(false);
  });

  it("#2 single platform creates only that platform directory", async () => {
    await init({ yes: true, cursor: true });

    expect(fs.existsSync(path.join(tmpDir, ".cursor"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".claude"))).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, ".codex"))).toBe(false);
    expect(
      fs.existsSync(
        path.join(tmpDir, ".cursor", "commands", "trellis-continue.md"),
      ),
    ).toBe(true);
  });

  

  

  

  

  

  

  

  

  

  

  

  it("#4 force mode overwrites previously modified files", async () => {
    await init({ yes: true, force: true });

    const workflowMd = path.join(tmpDir, PATHS.WORKFLOW_GUIDE_FILE);
    const original = fs.readFileSync(workflowMd, "utf-8");
    fs.writeFileSync(workflowMd, "user modified content");

    await init({ yes: true, force: true });

    expect(fs.readFileSync(workflowMd, "utf-8")).toBe(original);
  });

  it("#5 skip mode preserves previously modified files", async () => {
    await init({ yes: true, force: true });

    const workflowMd = path.join(tmpDir, PATHS.WORKFLOW_GUIDE_FILE);
    fs.writeFileSync(workflowMd, "user modified content");

    await init({ yes: true, skipExisting: true });

    expect(fs.readFileSync(workflowMd, "utf-8")).toBe("user modified content");
  });

  it("#6 re-init with force produces identical file set", async () => {
    await init({ yes: true, force: true });

    const collectFiles = (dir: string): string[] => {
      const files: string[] = [];
      const walk = (d: string) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
          const full = path.join(d, entry.name);
          if (entry.isDirectory()) walk(full);
          else files.push(path.relative(tmpDir, full));
        }
      };
      walk(dir);
      return files.sort();
    };

    const first = collectFiles(tmpDir);
    await init({ yes: true, force: true });
    const second = collectFiles(tmpDir);

    expect(second).toEqual(first);
  });

  it("#7 passes developer name to init_developer script", async () => {
    await init({ yes: true, user: "testdev" });

    const calls = vi.mocked(execSync).mock.calls;
    const match = calls.find(
      ([cmd]) => typeof cmd === "string" && cmd.includes("init_developer.py"),
    );
    expect(match).toBeDefined();
    const command = String((match as [unknown])[0]);
    const expectedPythonCmd =
      process.platform === "win32" ? "python" : "python3";
    expect(command).toContain(`${expectedPythonCmd} "`);
    expect(command).toContain('"testdev"');
  });

  it("#7b throws when the selected Python command is below 3.9", async () => {
    // v0.5.7: init now tries a fallback chain (#236). Mock every candidate to
    // return the same too-old version so all candidates fail uniformly.
    vi.mocked(execSync).mockImplementation(
      (() => "Python 3.8.18") as typeof execSync,
    );

    await expect(init({ yes: true, cursor: true })).rejects.toThrow(
      /No supported Python command found.*Python 3\.8\.18 \(< 3\.9\)/s,
    );
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(false);
  });

  it("#7c throws when the selected Python command is missing", async () => {
    // v0.5.7: init now tries a fallback chain (#236). Mock every candidate to
    // throw "not found" so all candidates fail.
    vi.mocked(execSync).mockImplementation((() => {
      throw new Error("not found");
    }) as typeof execSync);

    await expect(init({ yes: true, cursor: true })).rejects.toThrow(
      /No supported Python command found.*not found/s,
    );
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(false);
  });

  it("#7d renders the platform Python command into generated config and logs the adaptation", async () => {
    const expectedPythonCmd =
      process.platform === "win32" ? "python" : "python3";

    await init({ yes: true, cursor: true });

    const settings = fs.readFileSync(
      path.join(tmpDir, ".cursor", "hooks.json"),
      "utf-8",
    );
    expect(settings).toContain(
      `"${expectedPythonCmd} .cursor/hooks/session-start.py"`,
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining(
        `Trellis rendered Python commands as "${expectedPythonCmd}" in generated hooks, settings, and help text`,
      ),
    );
  });

  it("#8 writes correct version file", async () => {
    await init({ yes: true });

    const content = fs.readFileSync(
      path.join(tmpDir, DIR_NAMES.WORKFLOW, ".version"),
      "utf-8",
    );
    expect(content).toBe(VERSION);
  });

  it("#9 initializes template hash tracking file", async () => {
    await init({ yes: true });

    const hashPath = path.join(
      tmpDir,
      DIR_NAMES.WORKFLOW,
      ".template-hashes.json",
    );
    expect(fs.existsSync(hashPath)).toBe(true);
    const hashesFile = JSON.parse(fs.readFileSync(hashPath, "utf-8")) as {
      hashes?: Record<string, string>;
    };
    const hashes = hashesFile.hashes ?? {};
    const agentsContent = fs.readFileSync(
      path.join(tmpDir, FILE_NAMES.AGENTS),
      "utf-8",
    );
    expect(hashes[FILE_NAMES.AGENTS]).toBe(computeHash(agentsContent));
    expect(Object.keys(hashes).length).toBeGreaterThan(0);
  });

  it("#10 creates spec templates for backend, frontend, and guides", async () => {
    await init({ yes: true });

    const specDir = path.join(tmpDir, PATHS.SPEC);
    expect(fs.existsSync(path.join(specDir, "backend", "index.md"))).toBe(true);
    expect(fs.existsSync(path.join(specDir, "frontend", "index.md"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(specDir, "guides", "index.md"))).toBe(true);
  });

  it("#11 backend project init skips frontend spec templates", async () => {
    // go.mod triggers detectProjectType → "backend"
    fs.writeFileSync(path.join(tmpDir, "go.mod"), "module example.com/app\n");

    await init({ yes: true });

    const specDir = path.join(tmpDir, PATHS.SPEC);
    expect(fs.existsSync(path.join(specDir, "backend", "index.md"))).toBe(true);
    expect(fs.existsSync(path.join(specDir, "frontend"))).toBe(false);
    expect(fs.existsSync(path.join(specDir, "guides", "index.md"))).toBe(true);
  });

  it("#12 frontend project init skips backend spec templates", async () => {
    // vite.config.ts triggers detectProjectType → "frontend"
    fs.writeFileSync(
      path.join(tmpDir, "vite.config.ts"),
      "export default {}\n",
    );

    await init({ yes: true });

    const specDir = path.join(tmpDir, PATHS.SPEC);
    expect(fs.existsSync(path.join(specDir, "frontend", "index.md"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(specDir, "backend"))).toBe(false);
    expect(fs.existsSync(path.join(specDir, "guides", "index.md"))).toBe(true);
  });

  // ===========================================================================
  // Monorepo integration tests
  // ===========================================================================

  /** Helper: set up a pnpm workspace with two packages */
  function setupPnpmWorkspace(
    dir: string,
    packages: { rel: string; name: string; files?: Record<string, string> }[],
  ): void {
    fs.writeFileSync(
      path.join(dir, "pnpm-workspace.yaml"),
      "packages:\n  - 'packages/*'\n",
    );
    for (const pkg of packages) {
      const pkgDir = path.join(dir, pkg.rel);
      fs.mkdirSync(pkgDir, { recursive: true });
      fs.writeFileSync(
        path.join(pkgDir, "package.json"),
        JSON.stringify({ name: pkg.name }),
      );
      if (pkg.files) {
        for (const [name, content] of Object.entries(pkg.files)) {
          fs.writeFileSync(path.join(pkgDir, name), content);
        }
      }
    }
  }

  it("#13 monorepo: creates per-package spec directories", async () => {
    // @app/web: vite.config.ts → frontend (package.json also present → still frontend)
    // @app/api: package.json + go.mod → fullstack (both indicators present)
    setupPnpmWorkspace(tmpDir, [
      {
        rel: "packages/web",
        name: "@app/web",
        files: { "vite.config.ts": "" },
      },
      { rel: "packages/api", name: "@app/api", files: { "go.mod": "" } },
    ]);

    await init({ yes: true });

    const specDir = path.join(tmpDir, PATHS.SPEC);
    // Per-package spec dirs created with sanitized names (scope stripped)
    expect(fs.existsSync(path.join(specDir, "web"))).toBe(true);
    expect(fs.existsSync(path.join(specDir, "api"))).toBe(true);

    // web: frontend (vite.config.ts) → has frontend/, no backend/
    expect(
      fs.existsSync(path.join(specDir, "web", "frontend", "index.md")),
    ).toBe(true);
    expect(fs.existsSync(path.join(specDir, "web", "backend"))).toBe(false);

    // api: fullstack (package.json + go.mod) → has both backend/ and frontend/
    expect(
      fs.existsSync(path.join(specDir, "api", "backend", "index.md")),
    ).toBe(true);
    expect(
      fs.existsSync(path.join(specDir, "api", "frontend", "index.md")),
    ).toBe(true);

    // Guides still created (shared)
    expect(fs.existsSync(path.join(specDir, "guides", "index.md"))).toBe(true);

    // Global backend/frontend should NOT exist (monorepo mode)
    expect(fs.existsSync(path.join(specDir, "backend"))).toBe(false);
    expect(fs.existsSync(path.join(specDir, "frontend"))).toBe(false);
  });

  it("#14 monorepo: writes packages section to config.yaml", async () => {
    setupPnpmWorkspace(tmpDir, [
      { rel: "packages/cli", name: "@trellis/cli" },
      { rel: "packages/docs", name: "@trellis/docs" },
    ]);

    await init({ yes: true });

    const configPath = path.join(tmpDir, DIR_NAMES.WORKFLOW, "config.yaml");
    expect(fs.existsSync(configPath)).toBe(true);

    const configContent = fs.readFileSync(configPath, "utf-8");
    expect(configContent).toContain("packages:");
    expect(configContent).toContain("cli:");
    expect(configContent).toContain("path: packages/cli");
    expect(configContent).toContain("docs:");
    expect(configContent).toContain("path: packages/docs");
    expect(configContent).toContain("default_package:");
  });

  it("#15 monorepo: bootstrap task references per-package spec paths", async () => {
    setupPnpmWorkspace(tmpDir, [
      { rel: "packages/core", name: "core" },
      { rel: "packages/ui", name: "ui" },
    ]);

    await init({ yes: true, user: "dev" });

    const taskDir = path.join(tmpDir, PATHS.TASKS, "00-bootstrap-guidelines");
    expect(fs.existsSync(taskDir)).toBe(true);

    const taskJson = JSON.parse(
      fs.readFileSync(path.join(taskDir, "task.json"), "utf-8"),
    );

    // task.json.subtasks is canonical string[] (child task dir names);
    // per-package checklist items now live in prd.md as markdown checkboxes.
    expect(Array.isArray(taskJson.subtasks)).toBe(true);
    expect(taskJson.subtasks).toEqual([]);

    // Canonical shape: legacy current_phase / next_action must NOT appear
    expect(taskJson.current_phase).toBeUndefined();
    expect(taskJson.next_action).toBeUndefined();

    // relatedFiles point to spec/<name>/
    expect(taskJson.relatedFiles).toContain(".trellis/spec/core/");
    expect(taskJson.relatedFiles).toContain(".trellis/spec/ui/");

    // prd.md mentions packages + renders per-package checklist items
    const prd = fs.readFileSync(path.join(taskDir, "prd.md"), "utf-8");
    const expectedPythonCmd =
      process.platform === "win32" ? "python" : "python3";
    expect(prd).toContain("core");
    expect(prd).toContain("ui");
    expect(prd).toContain("spec/");
    expect(prd).toContain("- [ ] Fill guidelines for core");
    expect(prd).toContain("- [ ] Fill guidelines for ui");
    expect(prd).not.toContain(
      `${expectedPythonCmd} ./.trellis/scripts/task.py finish`,
    );
    expect(prd).toContain(
      `${expectedPythonCmd} ./.trellis/scripts/task.py archive 00-bootstrap-guidelines`,
    );
  });

  it("#16 --no-monorepo skips detection even with workspace config", async () => {
    setupPnpmWorkspace(tmpDir, [{ rel: "packages/a", name: "a" }]);

    await init({ yes: true, monorepo: false });

    const specDir = path.join(tmpDir, PATHS.SPEC);
    // Single-repo spec (global backend + frontend), no per-package dirs
    expect(fs.existsSync(path.join(specDir, "backend", "index.md"))).toBe(true);
    expect(fs.existsSync(path.join(specDir, "frontend", "index.md"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(specDir, "a"))).toBe(false);

    // config.yaml should NOT have packages: section
    const configContent = fs.readFileSync(
      path.join(tmpDir, DIR_NAMES.WORKFLOW, "config.yaml"),
      "utf-8",
    );
    expect(configContent).not.toMatch(/^packages\s*:/m);
  });

  it("#17 --monorepo without workspace config exits with error", async () => {
    // Empty directory — no workspace configs
    const logSpy = vi.mocked(console.log);

    await init({ yes: true, monorepo: true });

    // Should log error about missing multi-package layout
    const errorCall = logSpy.mock.calls.find(
      ([msg]) =>
        typeof msg === "string" &&
        msg.includes("no multi-package layout detected"),
    );
    expect(errorCall).toBeDefined();

    // Should also print the manual config.yaml example as guidance
    const guideCall = logSpy.mock.calls.find(
      ([msg]) => typeof msg === "string" && msg.includes("git: true"),
    );
    expect(guideCall).toBeDefined();

    // Should NOT create .trellis/ (early return)
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(false);
  });

  it("#20 -y --registry aborts on probe failure instead of direct download fallback", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await init({
      yes: true,
      registry: "bitbucket:myorg/registry/spec",
    });

    const logOutput = vi
      .mocked(console.log)
      .mock.calls.flat()
      .filter((part): part is string => typeof part === "string")
      .join("\n");

    expect(logOutput).toContain("Error: Could not reach registry index");
    expect(fs.existsSync(path.join(tmpDir, DIR_NAMES.WORKFLOW))).toBe(false);
  });

  it("#19 polyrepo: writes git: true for sibling .git packages", async () => {
    // Two sibling .git directories — polyrepo fallback should pick them up
    fs.mkdirSync(path.join(tmpDir, "frontend", ".git"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "backend", ".git"), { recursive: true });

    await init({ yes: true });

    const configPath = path.join(tmpDir, DIR_NAMES.WORKFLOW, "config.yaml");
    expect(fs.existsSync(configPath)).toBe(true);

    const configContent = fs.readFileSync(configPath, "utf-8");
    // Slice off only the auto-generated section so commented-out template
    // examples (which legitimately mention `type: submodule`) do not pollute
    // the assertion.
    const generatedIdx = configContent.indexOf(
      "# Auto-detected monorepo packages",
    );
    expect(generatedIdx).toBeGreaterThanOrEqual(0);
    const generated = configContent.slice(generatedIdx);

    expect(generated).toContain("packages:");
    expect(generated).toContain("frontend:");
    expect(generated).toContain("backend:");
    expect(generated).toContain("path: frontend");
    expect(generated).toContain("path: backend");
    // Polyrepo packages should be marked git: true, NOT type: submodule
    expect(generated).toContain("git: true");
    expect(generated).not.toContain("type: submodule");
  });

  it("#18 monorepo: re-init does not duplicate packages in config.yaml", async () => {
    setupPnpmWorkspace(tmpDir, [{ rel: "packages/lib", name: "lib" }]);

    await init({ yes: true, force: true });
    await init({ yes: true, force: true });

    const configContent = fs.readFileSync(
      path.join(tmpDir, DIR_NAMES.WORKFLOW, "config.yaml"),
      "utf-8",
    );
    // packages: should appear exactly once
    const matches = configContent.match(/^packages\s*:/gm);
    expect(matches).toHaveLength(1);
  });

  // GitHub issue #267 — Windows users silently lose SessionStart injection
  // because Python cold start exceeds the historical 10s timeout. Defaults
  // were bumped to 30s (SessionStart) / 15s (UserPromptSubmit). This guards
  // against future drift on the most common install path.
  it("#19 init writes bumped hook timeouts (issue #267)", async () => {
    await init({ yes: true, cursor: true });

    const hooks = JSON.parse(
      fs.readFileSync(path.join(tmpDir, ".cursor", "hooks.json"), "utf-8"),
    ) as {
      hooks: {
        sessionStart?: { timeout?: number }[];
        beforeSubmitPrompt?: { timeout?: number }[];
      };
    };

    for (const hook of hooks.hooks.sessionStart ?? []) {
      expect(hook.timeout).toBeGreaterThanOrEqual(30);
    }
    for (const hook of hooks.hooks.beforeSubmitPrompt ?? []) {
      expect(hook.timeout).toBeGreaterThanOrEqual(15);
    }
  });
});
