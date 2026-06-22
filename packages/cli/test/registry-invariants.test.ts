/**
 * Registry Invariant Tests
 *
 * Cross-module consistency checks for the cursor-only platform registry.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { AI_TOOLS } from "../src/types/ai-tools.js";
import {
  FIRST_CLASS_PLATFORM_IDS,
  LEGACY_PLATFORM_IDS,
  getInitToolChoices,
  PLATFORM_IDS,
} from "../src/configurators/index.js";
import { getHooksConfig as getCursorHooksConfig } from "../src/templates/cursor/index.js";

const COMMANDER_RESERVED_FLAGS = ["help", "version", "V", "h"];

describe("registry internal consistency", () => {
  it("PLATFORM_IDS length matches AI_TOOLS keys", () => {
    expect(PLATFORM_IDS.length).toBe(Object.keys(AI_TOOLS).length);
  });

  it("only Cursor is registered", () => {
    expect(PLATFORM_IDS).toEqual(["cursor"]);
  });

  it("all cliFlag values are unique", () => {
    const flags = PLATFORM_IDS.map((id) => AI_TOOLS[id].cliFlag);
    expect(new Set(flags).size).toBe(flags.length);
  });

  it("all configDir values are unique", () => {
    const dirs = PLATFORM_IDS.map((id) => AI_TOOLS[id].configDir);
    expect(new Set(dirs).size).toBe(dirs.length);
  });

  it("all configDir values start with dot", () => {
    for (const id of PLATFORM_IDS) {
      expect(AI_TOOLS[id].configDir.startsWith(".")).toBe(true);
    }
  });

  it("no configDir collides with .trellis", () => {
    for (const id of PLATFORM_IDS) {
      expect(AI_TOOLS[id].configDir).not.toBe(".trellis");
    }
  });

  it("no cliFlag collides with commander.js reserved flags", () => {
    for (const id of PLATFORM_IDS) {
      expect(COMMANDER_RESERVED_FLAGS).not.toContain(AI_TOOLS[id].cliFlag);
    }
  });

  it("every platform has non-empty name", () => {
    for (const id of PLATFORM_IDS) {
      expect(AI_TOOLS[id].name.length).toBeGreaterThan(0);
    }
  });

  it("Cursor is the sole first-class platform", () => {
    expect(FIRST_CLASS_PLATFORM_IDS).toEqual(["cursor"]);
    expect(LEGACY_PLATFORM_IDS).toEqual([]);
    expect(FIRST_CLASS_PLATFORM_IDS.length + LEGACY_PLATFORM_IDS.length).toBe(
      PLATFORM_IDS.length,
    );
  });

  it("interactive init lists Cursor only", () => {
    const choices = getInitToolChoices();
    expect(choices.map((c) => c.platformId)).toEqual(["cursor"]);
  });

  it("every platform templateDirs includes common", () => {
    for (const id of PLATFORM_IDS) {
      expect(AI_TOOLS[id].templateDirs).toContain("common");
    }
  });

  it("templateContext.cliFlag matches AIToolConfig.cliFlag for every platform", () => {
    for (const id of PLATFORM_IDS) {
      const config = AI_TOOLS[id];
      expect(config.templateContext.cliFlag).toBe(config.cliFlag);
    }
  });
});

describe("Cursor hooks.json wiring", () => {
  it("hooks.json contains sessionStart and beforeSubmitPrompt with shared scripts", () => {
    const raw = getCursorHooksConfig();
    const parsed = JSON.parse(raw) as { hooks?: Record<string, unknown> };
    expect(parsed.hooks).toBeDefined();
    expect(Object.keys(parsed.hooks ?? {})).toContain("sessionStart");
    expect(Object.keys(parsed.hooks ?? {})).toContain("beforeSubmitPrompt");
    expect(raw).toContain("session-start.py");
    expect(raw).toContain("inject-retrieval-plan.py");
  });

  it("template hooks.json on disk matches exported config", () => {
    const __filename = fileURLToPath(import.meta.url);
    const templatesRoot = join(dirname(__filename), "..", "src", "templates");
    const disk = readFileSync(join(templatesRoot, "cursor/hooks.json"), "utf-8");
    expect(disk).toBe(getCursorHooksConfig());
  });
});
