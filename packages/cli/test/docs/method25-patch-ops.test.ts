import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(testDir, "../..");
const repoRoot = path.resolve(cliRoot, "../..");

const DOC_PATHS = [
  path.join(repoRoot, "docs/cursor.md"),
  path.join(repoRoot, "docs/cursor.zh-CN.md"),
  path.join(cliRoot, "src/templates/trellis/local/README.md"),
  path.join(cliRoot, "src/templates/common/bundled-skills/cstl-cursor2plus-setup/SKILL.md"),
];

function readUtf8(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

describe("Method 2.5 patch operations docs", () => {
  it("documents check-compat after Cursor/Cursor++ upgrades", () => {
    for (const docPath of DOC_PATHS) {
      const content = readUtf8(docPath);
      expect(content, docPath).toMatch(/--check-compat/);
      expect(content, docPath).toMatch(/Cursor\+\+ upgrade|Cursor\/Cursor\+\+ 升级/i);
    }
  });

  it("does not present WPeLc8 as an eternal stable API in user-facing cursor docs", () => {
    const en = readUtf8(path.join(repoRoot, "docs/cursor.md"));
    const zh = readUtf8(path.join(repoRoot, "docs/cursor.zh-CN.md"));
    expect(en).toMatch(/not a stable public API|symbol names can change/i);
    expect(zh).toMatch(/不是稳定公开 API|可能变化/);
  });
});
