/**
 * Platform Registry — Single source of truth for platform functions and derived helpers
 *
 * All platform-specific lists (backup dirs, template dirs, configured platforms, etc.)
 * are derived from AI_TOOLS in types/ai-tools.js.
 *
 * Cursor-only fork: only the Cursor configurator and templates are wired.
 */

import fs from "node:fs";
import path from "node:path";
import {
  AI_TOOLS,
  getManagedPaths,
  type AITool,
  type CliFlag,
} from "../types/ai-tools.js";

// Platform configurators
import { configureCursor } from "./cursor.js";

// Shared utilities
import {
  replacePythonCommandLiterals,
  resolvePlaceholders,
  resolveCommands,
} from "./shared.js";

// Cursor-specific template content (agents, rules, hooks, settings, commands)
import {
  getAllAgents as getCursorAgents,
  getAllRules as getCursorRules,
  getCursorCommands,
  getHooksConfig as getCursorHooksConfig,
  getWorktreesConfig,
} from "../templates/cursor/index.js";
import {
  getSharedHookScriptsForPlatform,
  type SharedHookPlatform,
} from "../templates/shared-hooks/index.js";

// =============================================================================
// Platform Functions Registry
// =============================================================================

interface PlatformFunctions {
  /** Configure platform during init (copy templates to project) */
  configure: (cwd: string) => Promise<void>;
  /** Collect template files for update tracking. Undefined = platform skipped during update. */
  collectTemplates?: () => Map<string, string>;
}

/** Helper: collect the shared hook scripts that `platform` actually
 *  registers. Keyed off SHARED_HOOKS_BY_PLATFORM so runtime install
 *  (writeSharedHooks) and update diff (collectSharedHooks) never drift.
 */
function collectSharedHooks(
  hooksPath: string,
  platform: SharedHookPlatform,
): Map<string, string> {
  const files = new Map<string, string>();
  for (const hook of getSharedHookScriptsForPlatform(platform)) {
    files.set(`${hooksPath}/${hook.name}`, hook.content);
  }
  return files;
}

/** Apply python3→python replacement to all content in a template map. */
function replaceInMap(map: Map<string, string>): Map<string, string> {
  const result = new Map<string, string>();
  for (const [key, content] of map) {
    result.set(key, replacePythonCommandLiterals(content));
  }
  return result;
}

/**
 * Platform functions registry — maps each AITool to its behavior.
 * Cursor-only fork: only the Cursor entry is registered.
 */
const PLATFORM_FUNCTIONS: Record<AITool, PlatformFunctions> = {
  cursor: {
    configure: configureCursor,
    collectTemplates: () => {
      const ctx = AI_TOOLS.cursor.templateContext;
      const files = new Map<string, string>();
      // commands-only policy: ship common commands (continue, finish-work) +
      // Cursor-only commands (cursor2plus-setup) as .cursor/commands/cstl-*.md.
      // No .cursor/skills/ are shipped on Cursor — internal workflow skills
      // reach the agent via .cursor/rules + AGENTS.md instead.
      for (const cmd of resolveCommands(ctx)) {
        files.set(
          `.cursor/commands/cstl-${cmd.name}.md`,
          resolvePlaceholders(cmd.content, ctx),
        );
      }
      for (const cmd of getCursorCommands()) {
        files.set(
          `.cursor/commands/cstl-${cmd.name}.md`,
          resolvePlaceholders(cmd.content, ctx),
        );
      }
      for (const agent of getCursorAgents()) {
        files.set(`.cursor/agents/${agent.name}.md`, agent.content);
      }
      // Rules: names already carry .mdc (Cursor requires the extension).
      for (const rule of getCursorRules()) {
        files.set(`.cursor/rules/${rule.name}`, rule.content);
      }
      for (const [k, v] of collectSharedHooks(".cursor/hooks", "cursor")) {
        files.set(k, v);
      }
      files.set(
        ".cursor/hooks.json",
        resolvePlaceholders(getCursorHooksConfig()),
      );
      files.set(
        ".cursor/worktrees.json",
        resolvePlaceholders(getWorktreesConfig()),
      );
      return files;
    },
  },
};

// =============================================================================
// Derived Helpers — all derived from AI_TOOLS registry
// =============================================================================

/** All platform IDs */
export const PLATFORM_IDS = Object.keys(AI_TOOLS) as AITool[];

/** Actively targeted platform IDs for this fork. */
export const FIRST_CLASS_PLATFORM_IDS = PLATFORM_IDS.filter(
  (id) => AI_TOOLS[id].tier === "first-class",
);

/** Legacy adapter IDs retained for explicit compatibility, not default targeting. */
export const LEGACY_PLATFORM_IDS = PLATFORM_IDS.filter(
  (id) => AI_TOOLS[id].tier === "legacy",
);

/** All platform config directory names (e.g., [".cursor"]) */
export const CONFIG_DIRS = PLATFORM_IDS.map((id) => AI_TOOLS[id].configDir);

/** All managed paths for every platform (primary configDir + extra managed paths). */
export const PLATFORM_MANAGED_DIRS = PLATFORM_IDS.flatMap((id) =>
  getManagedPaths(id),
);

/** All directories managed by Trellis (including .trellis itself) */
export const ALL_MANAGED_DIRS = [".trellis", ...new Set(PLATFORM_MANAGED_DIRS)];

/**
 * Detect which platforms are configured by checking for configDir existence.
 *
 * Note: Detection uses only `configDir` (the platform-specific directory),
 * NOT shared layers like `.agents/skills/`. This prevents false positives
 * where a shared directory triggers detection of a specific platform.
 */
export function getConfiguredPlatforms(cwd: string): Set<AITool> {
  const platforms = new Set<AITool>();
  for (const id of PLATFORM_IDS) {
    if (fs.existsSync(path.join(cwd, AI_TOOLS[id].configDir))) {
      platforms.add(id);
    }
  }
  return platforms;
}

/**
 * Get platform IDs that have Python hooks (for Windows encoding detection)
 */
export function getPlatformsWithPythonHooks(): AITool[] {
  return PLATFORM_IDS.filter((id) => AI_TOOLS[id].hasPythonHooks);
}

/**
 * Check if a path starts with any managed directory
 */
export function isManagedPath(dirPath: string): boolean {
  // Normalize Windows backslashes to forward slashes for consistent matching
  const normalized = dirPath.replace(/\\/g, "/");
  return ALL_MANAGED_DIRS.some(
    (d) => normalized.startsWith(d + "/") || normalized === d,
  );
}

/**
 * Check if a directory name is a managed root directory (should not be deleted)
 */
export function isManagedRootDir(dirName: string): boolean {
  return ALL_MANAGED_DIRS.includes(dirName);
}

/**
 * Get all managed paths for a platform.
 */
export function getPlatformManagedPaths(platformId: AITool): string[] {
  return getManagedPaths(platformId);
}

/**
 * Get the configure function for a platform
 */
export function configurePlatform(
  platformId: AITool,
  cwd: string,
): Promise<void> {
  return PLATFORM_FUNCTIONS[platformId].configure(cwd);
}

/**
 * Collect template files for a specific platform (for update tracking).
 * Returns undefined if the platform doesn't support template tracking.
 */
export function collectPlatformTemplates(
  platformId: AITool,
): Map<string, string> | undefined {
  const map = PLATFORM_FUNCTIONS[platformId].collectTemplates?.();
  return map ? replaceInMap(map) : map;
}

/**
 * Build TOOLS array for interactive init prompt, derived from AI_TOOLS registry
 */
export function getInitToolChoices(): {
  key: CliFlag;
  name: string;
  defaultChecked: boolean;
  platformId: AITool;
}[] {
  const sorted = [...PLATFORM_IDS].sort((a, b) => {
    const aFirstClass = AI_TOOLS[a].tier === "first-class";
    const bFirstClass = AI_TOOLS[b].tier === "first-class";
    if (aFirstClass === bFirstClass) {
      return 0;
    }
    return aFirstClass ? -1 : 1;
  });

  return sorted.map((id) => ({
    key: AI_TOOLS[id].cliFlag,
    name: AI_TOOLS[id].name,
    defaultChecked: AI_TOOLS[id].defaultChecked,
    platformId: id,
  }));
}

/**
 * Resolve CLI flag name to AITool id (e.g., "cursor" → "cursor")
 */
export function resolveCliFlag(flag: string): AITool | undefined {
  return PLATFORM_IDS.find((id) => AI_TOOLS[id].cliFlag === flag);
}
