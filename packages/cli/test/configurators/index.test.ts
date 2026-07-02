import { describe, expect, it } from "vitest";
import {
  ALL_MANAGED_DIRS,
  CONFIG_DIRS,
  PLATFORM_IDS,
  PLATFORM_MANAGED_DIRS,
  collectPlatformTemplates,
  getInitToolChoices,
  getPlatformManagedPaths,
  getPlatformsWithPythonHooks,
  isManagedPath,
  isManagedRootDir,
  resolveCliFlag,
} from "../../src/configurators/index.js";
import { AI_TOOLS } from "../../src/types/ai-tools.js";

describe("PLATFORM_IDS", () => {
  it("contains all AI_TOOLS keys", () => {
    const aiToolKeys = Object.keys(AI_TOOLS);
    expect(PLATFORM_IDS).toEqual(expect.arrayContaining(aiToolKeys));
    expect(PLATFORM_IDS).toHaveLength(aiToolKeys.length);
    expect(PLATFORM_IDS).toEqual(["cursor"]);
  });
});

describe("CONFIG_DIRS", () => {
  it("has same length as PLATFORM_IDS", () => {
    expect(CONFIG_DIRS).toHaveLength(PLATFORM_IDS.length);
  });

  it("maps to AI_TOOLS configDir values in order", () => {
    for (let i = 0; i < PLATFORM_IDS.length; i++) {
      expect(CONFIG_DIRS[i]).toBe(AI_TOOLS[PLATFORM_IDS[i]].configDir);
    }
    expect(CONFIG_DIRS).toEqual([".cursor"]);
  });
});

describe("ALL_MANAGED_DIRS", () => {
  it("starts with .trellis", () => {
    expect(ALL_MANAGED_DIRS[0]).toBe(".trellis");
  });

  it("contains .trellis plus all managed dirs", () => {
    expect(ALL_MANAGED_DIRS).toEqual([
      ".trellis",
      ...new Set(PLATFORM_MANAGED_DIRS),
    ]);
  });

  it("has no duplicates", () => {
    expect(new Set(ALL_MANAGED_DIRS).size).toBe(ALL_MANAGED_DIRS.length);
  });
});

describe("isManagedPath", () => {
  it("matches cursor config sub-paths", () => {
    expect(isManagedPath(".cursor/rules/bar.md")).toBe(true);
    expect(isManagedPath(".cursor/commands/cstl-continue.md")).toBe(true);
    expect(isManagedPath(".cursor/hooks/session-start.py")).toBe(true);
  });

  it("matches exact managed directory names", () => {
    expect(isManagedPath(".cursor")).toBe(true);
    expect(isManagedPath(".trellis")).toBe(true);
  });

  it("matches .trellis sub-paths", () => {
    expect(isManagedPath(".trellis/spec")).toBe(true);
    expect(isManagedPath(".trellis/tasks/some-task")).toBe(true);
  });

  it("rejects legacy platform paths not in registry", () => {
    expect(isManagedPath(".claude/commands/foo.md")).toBe(false);
    expect(isManagedPath(".codex/agents/check.toml")).toBe(false);
    expect(isManagedPath(".github/copilot/hooks/session-start.py")).toBe(false);
  });

  it("rejects prefix-similar non-sub-paths", () => {
    expect(isManagedPath(".cursorignore")).toBe(false);
    expect(isManagedPath(".trellis-old")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isManagedPath("")).toBe(false);
  });

  it("rejects path traversal", () => {
    expect(isManagedPath("../.cursor")).toBe(false);
    expect(isManagedPath("../.trellis/spec")).toBe(false);
  });

  it("rejects unrelated directories", () => {
    expect(isManagedPath(".vscode")).toBe(false);
    expect(isManagedPath(".git")).toBe(false);
    expect(isManagedPath("node_modules")).toBe(false);
  });

  it("matches Windows-style backslash paths for cursor", () => {
    expect(isManagedPath(".cursor\\commands\\foo.md")).toBe(true);
    expect(isManagedPath(".trellis\\spec\\backend")).toBe(true);
  });
});

describe("isManagedRootDir", () => {
  it("matches cursor config dir", () => {
    expect(isManagedRootDir(".cursor")).toBe(true);
  });

  it("matches .trellis", () => {
    expect(isManagedRootDir(".trellis")).toBe(true);
  });

  it("rejects sub-paths (not a root dir)", () => {
    expect(isManagedRootDir(".cursor/commands")).toBe(false);
    expect(isManagedRootDir(".trellis/spec")).toBe(false);
  });

  it("rejects unrelated directories", () => {
    expect(isManagedRootDir(".vscode")).toBe(false);
    expect(isManagedRootDir(".claude")).toBe(false);
  });
});

describe("resolveCliFlag", () => {
  it("resolves cursor flag", () => {
    expect(resolveCliFlag("cursor")).toBe("cursor");
  });

  it("returns undefined for unknown flag", () => {
    expect(resolveCliFlag("unknown")).toBeUndefined();
    expect(resolveCliFlag("claude")).toBeUndefined();
    expect(resolveCliFlag("--cursor")).toBeUndefined();
  });
});

describe("getInitToolChoices", () => {
  const choices = getInitToolChoices();

  it("returns one entry for cursor", () => {
    expect(choices).toHaveLength(1);
    expect(choices[0].platformId).toBe("cursor");
    expect(choices[0].key).toBe("cursor");
  });

  it("each key roundtrips through resolveCliFlag", () => {
    for (const choice of choices) {
      expect(resolveCliFlag(choice.key)).toBe(choice.platformId);
    }
  });
});

describe("getPlatformsWithPythonHooks", () => {
  const result = getPlatformsWithPythonHooks();

  it("returns cursor only", () => {
    expect(result).toEqual(["cursor"]);
  });
});

describe("collectPlatformTemplates", () => {
  it("does not throw for cursor", () => {
    expect(() => collectPlatformTemplates("cursor")).not.toThrow();
  });

  it("returns non-empty Map for cursor", () => {
    const result = collectPlatformTemplates("cursor");
    expect(result).toBeInstanceOf(Map);
    expect(result?.size).toBeGreaterThan(0);
  });

  it("all returned paths start with .cursor", () => {
    const result = collectPlatformTemplates("cursor");
    const managedPaths = getPlatformManagedPaths("cursor");
    for (const [filePath] of result ?? []) {
      expect(
        managedPaths.some(
          (managedPath) =>
            filePath === managedPath || filePath.startsWith(managedPath + "/"),
        ),
      ).toBe(true);
    }
  });

  it("tracks cursor commands but not skills (commands-only policy)", () => {
    const result = collectPlatformTemplates("cursor");
    expect(result?.has(".cursor/commands/cstl-continue.md")).toBe(true);
    expect(result?.has(".cursor/hooks.json")).toBe(true);
    const skillKeys = [...(result?.keys() ?? [])].filter((k) =>
      k.includes(".cursor/skills/"),
    );
    expect(skillKeys).toEqual([]);
  });

  it("returned Map keys never contain backslash (POSIX-only)", () => {
    const result = collectPlatformTemplates("cursor");
    for (const [filePath] of result ?? []) {
      expect(filePath).not.toMatch(/\\/);
    }
  });
});
