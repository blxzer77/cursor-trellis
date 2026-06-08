/**
 * Registry Invariant Tests
 *
 * Cross-module consistency checks inspired by:
 * - SQLite's invariant checking (PRAGMA integrity_check after every operation)
 * - Mark Seemann's DI container testing (roundtrip + consumer-perspective checks)
 *
 * These tests catch errors when adding a new platform but forgetting to update
 * one of the registries or derived data.
 */

import { describe, expect, it } from "vitest";
import { AI_TOOLS } from "../src/types/ai-tools.js";
import {
  PLATFORM_IDS,
} from "../src/configurators/index.js";

const COMMANDER_RESERVED_FLAGS = ["help", "version", "V", "h"];

// =============================================================================
// Internal Consistency (SQLite-style invariant checks)
// =============================================================================

describe("registry internal consistency", () => {
  it("PLATFORM_IDS length matches AI_TOOLS keys", () => {
    expect(PLATFORM_IDS.length).toBe(Object.keys(AI_TOOLS).length);
  });

  it("all cliFlag values are unique", () => {
    const flags = PLATFORM_IDS.map((id) => AI_TOOLS[id].cliFlag);
    const unique = new Set(flags);
    expect(unique.size).toBe(flags.length);
  });

  it("all configDir values are unique", () => {
    const dirs = PLATFORM_IDS.map((id) => AI_TOOLS[id].configDir);
    const unique = new Set(dirs);
    expect(unique.size).toBe(dirs.length);
  });

  it("all configDir values start with dot", () => {
    for (const id of PLATFORM_IDS) {
      expect(AI_TOOLS[id].configDir.startsWith(".")).toBe(true);
    }
  });

  it("platforms with supportsAgentSkills do not use .agents/skills as configDir", () => {
    for (const id of PLATFORM_IDS) {
      if (AI_TOOLS[id].supportsAgentSkills) {
        expect(AI_TOOLS[id].configDir).not.toBe(".agents/skills");
      }
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

  it("every platform templateDirs includes common", () => {
    for (const id of PLATFORM_IDS) {
      expect(AI_TOOLS[id].templateDirs).toContain("common");
    }
  });

  // templateContext.cliFlag mirrors the outer AIToolConfig.cliFlag — the two
  // must stay in sync so {{CLI_FLAG}} substitution in shipped templates
  // agrees with the --claude/--cursor/--codex CLI flag users invoke.
  it("templateContext.cliFlag matches AIToolConfig.cliFlag for every platform", () => {
    for (const id of PLATFORM_IDS) {
      const config = AI_TOOLS[id];
      expect(config.templateContext.cliFlag).toBe(config.cliFlag);
    }
  });

});

// =============================================================================
// UserPromptSubmit breadcrumb wiring (workflow-enforcement-v2)
// =============================================================================

describe("UserPromptSubmit hook wiring", () => {
  /** Map from template config path to (parser, event name) */
  const PLATFORM_HOOK_CONFIGS = [
    {
      platform: "claude",
      path: "claude/settings.json",
      event: "UserPromptSubmit",
    },
    {
      platform: "qoder",
      path: "qoder/settings.json",
      event: "UserPromptSubmit",
    },
    {
      platform: "codebuddy",
      path: "codebuddy/settings.json",
      event: "UserPromptSubmit",
    },
    {
      platform: "droid",
      path: "droid/settings.json",
      event: "UserPromptSubmit",
    },
    {
      // Gemini CLI 0.40+ renamed the per-turn event from `UserPromptSubmit`
      // (Claude Code naming we initially copied) to `BeforeAgent`. The
      // schema validator rejects the legacy name — see issue #224.
      platform: "gemini",
      path: "gemini/settings.json",
      event: "BeforeAgent",
    },
    {
      platform: "copilot",
      path: "copilot/hooks.json",
      event: "userPromptSubmitted",
    },
    {
      platform: "codex",
      path: "codex/hooks.json",
      event: "UserPromptSubmit",
    },
  ] as const;

  for (const { platform, path, event } of PLATFORM_HOOK_CONFIGS) {
    it(`${platform} hook config contains ${event} referencing inject-workflow-state.py`, async () => {
      const fs = await import("node:fs");
      const { dirname, join } = await import("node:path");
      const { fileURLToPath } = await import("node:url");
      const __filename = fileURLToPath(import.meta.url);
      const templatesRoot = join(
        dirname(__filename),
        "..",
        "src",
        "templates",
      );
      const raw = fs.readFileSync(join(templatesRoot, path), "utf-8");
      const parsed = JSON.parse(raw) as {
        hooks?: Record<string, unknown>;
      };
      expect(parsed.hooks).toBeDefined();
      expect(Object.keys(parsed.hooks ?? {})).toContain(event);
      expect(raw).toContain("inject-workflow-state.py");
    });
  }

  it("kiro agent JSONs do NOT wire UserPromptSubmit (downgrade per Codex R3 #4)", async () => {
    const fs = await import("node:fs");
    const { dirname, join } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const __filename = fileURLToPath(import.meta.url);
    const kiroAgentsDir = join(
      dirname(__filename),
      "..",
      "src",
      "templates",
      "kiro",
      "agents",
    );
    for (const entry of fs.readdirSync(kiroAgentsDir)) {
      if (!entry.endsWith(".json")) continue;
      const content = fs.readFileSync(join(kiroAgentsDir, entry), "utf-8");
      expect(
        content,
        `kiro/agents/${entry} should not wire inject-workflow-state.py`,
      ).not.toContain("inject-workflow-state.py");
    }
  });
});

// Roundtrip and derived-helper tests are in configurators/index.test.ts
// This file focuses on internal consistency invariants only
