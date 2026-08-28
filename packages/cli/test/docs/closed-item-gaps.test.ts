import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const cliRoot = path.resolve(testDir, "../..");
const repoRoot = path.resolve(cliRoot, "../..");
const templates = path.join(cliRoot, "src/templates");

function readUtf8(filePath: string): string {
  return fs.readFileSync(filePath, "utf-8");
}

describe("closed-item product-template gaps (P02/P10/P12/P14/P19/P20)", () => {
  it("P02/P10-③ CONTEXT seed has governance + architecture terms", () => {
    const context = readUtf8(path.join(templates, "trellis/CONTEXT.md"));
    expect(context).toMatch(/## Governance domain seed/);
    expect(context).toMatch(/\*\*审核池\*\*/);
    expect(context).toMatch(/## Architecture \(deep-module vocabulary\)/);
    expect(context).toMatch(/\*\*seam\*\*/);
    expect(context).toMatch(/\*\*locality\*\*/);
  });

  it("P10-② authoring-rules ships writing-for-agents four techniques", () => {
    const rules = readUtf8(
      path.join(
        templates,
        "common/bundled-skills/cstl-skill-creator/references/authoring-rules.md",
      ),
    );
    expect(rules).toContain("Leading words");
    expect(rules).toContain("No-op test");
    expect(rules).toContain("Negation anti-pattern");
    expect(rules).toContain("Context pointer wording");
  });

  it("P12/P20 AGENTS points at official /goal and does not restore cstl-goal", () => {
    const agents = readUtf8(path.join(templates, "markdown/agents.md"));
    expect(agents).toMatch(/official Cursor `\/goal`/);
    expect(agents).toMatch(/Do \*\*not\*\* restore or invent `cstl-goal`/);
    expect(
      fs.existsSync(path.join(templates, "cursor/commands/cstl-goal.md")),
    ).toBe(false);
    expect(fs.existsSync(path.join(templates, "cursor/commands/goal.md"))).toBe(
      false,
    );
  });

  it("P14 dogfood list does not present Cursor++ as an optional live surface", () => {
    const dogfood = readUtf8(
      path.join(templates, "markdown/framework/dogfood-only-surfaces.md.txt"),
    );
    expect(dogfood).toMatch(/\*\*not\*\* an optional live surface/);
    expect(dogfood).not.toMatch(/(?:is|as) an optional live (?:install|surface)/i);
    expect(dogfood).not.toMatch(/goal-regression runbook/);
  });

  it("P19 README states default Native and does not embed BYOK", () => {
    const en = readUtf8(path.join(repoRoot, "README.md"));
    const zh = readUtf8(path.join(repoRoot, "README.zh-CN.md"));
    expect(en).toMatch(/does \*\*not\*\* embed BYOK/);
    expect(zh).toMatch(/不内嵌 BYOK/);
    expect(en).not.toContain("goal-release-regression-runbook");
  });
});
