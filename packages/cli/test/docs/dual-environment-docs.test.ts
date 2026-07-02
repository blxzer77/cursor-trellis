import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(testDir, "../..");
const repoRoot = path.resolve(cliRoot, "../..");

const COEXISTENCE_DOCS = [
  {
    file: path.join(repoRoot, "docs/cursor.md"),
    heading: "## Native and BYOK coexistence (not either/or)",
  },
  {
    file: path.join(repoRoot, "docs/cursor.zh-CN.md"),
    heading: "## Native 与 BYOK 并存（非二选一）",
  },
];

const README_FILES = [
  path.join(repoRoot, "README.md"),
  path.join(repoRoot, "README.zh-CN.md"),
];

const REQUIRED_PHRASES_EN = [
  "not either/or",
  "Configuration layers",
  "Method 2.5",
  "Method 4",
  "TRELLIS_CURSOR_BYOK",
  "routes.json",
];

const REQUIRED_PHRASES_ZH = [
  "非二选一",
  "配置分层",
  "Method 2.5",
  "Method 4",
  "TRELLIS_CURSOR_BYOK",
  "routes.json",
];

const MUTUAL_EXCLUSION_PATTERNS = [
  /choose one environment/i,
  /只能选一种环境/,
  /must pick either Native or BYOK/i,
];

function readUtf8(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

describe("dual-environment coexistence docs", () => {
  it("cursor docs include coexistence section with config layers and method matrix", () => {
    const en = readUtf8(COEXISTENCE_DOCS[0].file);
    const zh = readUtf8(COEXISTENCE_DOCS[1].file);

    expect(en).toContain(COEXISTENCE_DOCS[0].heading);
    expect(zh).toContain(COEXISTENCE_DOCS[1].heading);

    for (const phrase of REQUIRED_PHRASES_EN) {
      expect(en, `cursor.md missing ${phrase}`).toContain(phrase);
    }
    for (const phrase of REQUIRED_PHRASES_ZH) {
      expect(zh, `cursor.zh-CN.md missing ${phrase}`).toContain(phrase);
    }
  });

  it("README files link coexistence and mention per-repo cursor2plus", () => {
    for (const readmePath of README_FILES) {
      const content = readUtf8(readmePath);
      expect(content, readmePath).toMatch(/coexist|并存/);
      expect(content, readmePath).toMatch(/per-repo|按仓库/);
      expect(content, readmePath).toMatch(/cursor\.zh-CN\.md|cursor\.md/);
      for (const pattern of MUTUAL_EXCLUSION_PATTERNS) {
        expect(content, readmePath).not.toMatch(pattern);
      }
    }
  });

  it("cursor2plus local bundle README mentions coexistence", () => {
    const localReadme = readUtf8(
      path.join(cliRoot, "src/templates/trellis/local/README.md"),
    );
    expect(localReadme).toContain("Coexistence");
    expect(localReadme).toContain("per-repo");
    expect(localReadme).toContain("Native and BYOK coexistence");
  });
});
