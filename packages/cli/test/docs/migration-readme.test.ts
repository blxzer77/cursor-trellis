import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(testDir, "../..");
const repoRoot = path.resolve(cliRoot, "../..");

const MIGRATION_README_PATHS = [
  path.join(repoRoot, "README.md"),
  path.join(repoRoot, "README.zh-CN.md"),
  path.join(cliRoot, "README.md"),
  path.join(cliRoot, "README.zh-CN.md"),
];

const REQUIRED_MIGRATION_PHRASES = [
  "npm install -g @blxzer/cursor-trellis@latest",
  "cstl update --migrate",
  ".trellis/",
  "trellis-task-models.json5",
  "cstl-research/implement/check",
];

/** Patterns that imply `tl` is still a shipped bin alias (not historical mention). */
const TL_BIN_ALIAS_PATTERNS = [
  /`cstl`,\s*`tl`/,
  /`cstl`、`tl`/,
  /\|\s*`tl`\s*\|/,
  /\(cstl,\s*tl\)/,
];

function readUtf8(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

describe("0.3.0 migration README narrative", () => {
  it("README files exist and share the migration closed loop", () => {
    for (const readmePath of MIGRATION_README_PATHS) {
      expect(fs.existsSync(readmePath), readmePath).toBe(true);
      const content = readUtf8(readmePath);
      for (const phrase of REQUIRED_MIGRATION_PHRASES) {
        expect(content, `${readmePath} missing ${phrase}`).toContain(phrase);
      }
    }
  });

  it("README files do not list tl as a current bin alias", () => {
    for (const readmePath of MIGRATION_README_PATHS) {
      const content = readUtf8(readmePath);
      for (const pattern of TL_BIN_ALIAS_PATTERNS) {
        expect(content, `${readmePath} matches ${pattern}`).not.toMatch(pattern);
      }
    }
  });

  it("CHANGELOG and 0.3.0 manifest align on manual npm install + --migrate", () => {
    const changelog = readUtf8(path.join(cliRoot, "CHANGELOG.md"));
    const manifest = JSON.parse(
      readUtf8(path.join(cliRoot, "src/migrations/manifests/0.3.0.json")),
    ) as { aiInstructions?: string; changelog?: string };

    expect(changelog).toContain("npm install -g @blxzer/cursor-trellis@latest");
    expect(changelog).toContain("cstl update --migrate");
    expect(changelog).toContain("trellis upgrade");

    expect(manifest.aiInstructions).toContain(
      "npm install -g @blxzer/cursor-trellis@latest",
    );
    expect(manifest.aiInstructions).toContain("cstl update --migrate");
    expect(manifest.changelog).toContain("`trellis`/`tl`");
  });
});
