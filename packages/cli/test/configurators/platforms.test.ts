import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  getConfiguredPlatforms,
  configurePlatform,
  collectPlatformTemplates,
  PLATFORM_IDS,
} from "../../src/configurators/index.js";
import { AI_TOOLS } from "../../src/types/ai-tools.js";
import { setWriteMode } from "../../src/utils/file-writer.js";
import { getHooksConfig as getCursorHooksConfig } from "../../src/templates/cursor/index.js";
import { resolvePlaceholders } from "../../src/configurators/shared.js";

describe("getConfiguredPlatforms", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-platforms-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns empty set when no platform dirs exist", () => {
    expect(getConfiguredPlatforms(tmpDir).size).toBe(0);
  });

  it("detects .cursor directory as cursor", () => {
    fs.mkdirSync(path.join(tmpDir, ".cursor"));
    const result = getConfiguredPlatforms(tmpDir);
    expect(result.has("cursor")).toBe(true);
    expect(result.size).toBe(1);
  });

  it("ignores legacy platform directories not in registry", () => {
    fs.mkdirSync(path.join(tmpDir, ".claude"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, ".codex"), { recursive: true });
    expect(getConfiguredPlatforms(tmpDir).size).toBe(0);
  });

  it("ignores unrelated directories", () => {
    fs.mkdirSync(path.join(tmpDir, ".vscode"));
    fs.mkdirSync(path.join(tmpDir, ".git"));
    expect(getConfiguredPlatforms(tmpDir).size).toBe(0);
  });
});

describe("configurePlatform", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-configure-"));
    setWriteMode("force");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    setWriteMode("ask");
  });

  it("configurePlatform('cursor') creates .cursor directory", async () => {
    await configurePlatform("cursor", tmpDir);
    expect(fs.existsSync(path.join(tmpDir, ".cursor"))).toBe(true);
  });

  it("configurePlatform('cursor') ships commands-only (no skills) per Cursor policy", async () => {
    await configurePlatform("cursor", tmpDir);
    const continueCmd = path.join(
      tmpDir,
      ".cursor",
      "commands",
      "cstl-continue.md",
    );
    const finishCmd = path.join(
      tmpDir,
      ".cursor",
      "commands",
      "cstl-finish-work.md",
    );
    const c2pCmd = path.join(
      tmpDir,
      ".cursor",
      "commands",
      "cstl-cursor2plus-setup.md",
    );
    expect(fs.existsSync(continueCmd)).toBe(true);
    expect(fs.existsSync(finishCmd)).toBe(true);
    expect(fs.existsSync(c2pCmd)).toBe(true);
    expect(fs.readFileSync(finishCmd, "utf-8")).toContain("get_context.py");
    expect(fs.existsSync(path.join(tmpDir, ".cursor", "skills"))).toBe(false);
  });

  it("cursor collectTemplates matches commands-only policy (no skills tracked)", async () => {
    await configurePlatform("cursor", tmpDir);
    const templates = collectPlatformTemplates("cursor");
    expect(templates).toBeInstanceOf(Map);
    if (!templates) throw new Error("cursor did not expose template tracking");
    expect(templates.has(".cursor/commands/cstl-continue.md")).toBe(true);
    expect(templates.has(".cursor/commands/cstl-finish-work.md")).toBe(true);
    expect(templates.has(".cursor/commands/cstl-cursor2plus-setup.md")).toBe(
      true,
    );
    const skillKeys = [...templates.keys()].filter((k) =>
      k.includes(".cursor/skills/"),
    );
    expect(skillKeys).toEqual([]);
  });

  it("configurePlatform writes collected templates byte-for-byte for cursor", async () => {
    await configurePlatform("cursor", tmpDir);
    const templates = collectPlatformTemplates("cursor");
    expect(templates).toBeInstanceOf(Map);
    if (!templates) throw new Error("cursor did not expose template tracking");
    for (const [relPath, content] of templates) {
      const absPath = path.join(tmpDir, relPath);
      expect(fs.existsSync(absPath), relPath).toBe(true);
      expect(fs.readFileSync(absPath, "utf-8")).toBe(content);
    }
  });

  it("cursor hooks.json matches both documented and native subagent tool names", () => {
    const hooksConfig = JSON.parse(getCursorHooksConfig()) as {
      hooks: { preToolUse: { matcher: string }[] };
    };
    expect(hooksConfig.hooks.preToolUse[0].matcher).toBe("Task|Subagent");
  });

  it("collectPlatformTemplates('cursor') resolves placeholders in hooks.json", () => {
    const templates = collectPlatformTemplates("cursor");
    expect(templates?.get(".cursor/hooks.json")).toBe(
      resolvePlaceholders(getCursorHooksConfig()),
    );
  });

  it("does not throw for cursor", async () => {
    for (const id of PLATFORM_IDS) {
      expect(id).toBe("cursor");
      await expect(configurePlatform(id, tmpDir)).resolves.not.toThrow();
    }
  });

  it("PLATFORM_IDS contains only cursor", () => {
    expect(PLATFORM_IDS).toEqual(["cursor"]);
    expect(AI_TOOLS.cursor.configDir).toBe(".cursor");
  });
});
