import { describe, expect, it } from "vitest";
import { getBundledSkillTemplates, getOptionalSkillTemplates } from "../../src/templates/common/index.js";
import { resolveOptionalSkills } from "../../src/configurators/shared.js";
import { AI_TOOLS } from "../../src/types/ai-tools.js";

function requireSkill(
  skills: { name: string; files: { relativePath: string; content: string }[] }[],
  name: string,
): { name: string; files: { relativePath: string; content: string }[] } {
  const skill = skills.find((s) => s.name === name);
  if (!skill) throw new Error(`Expected skill "${name}" to exist`);
  return skill;
}

function requireFile(
  files: { relativePath: string; content: string }[],
  relativePath: string,
): string {
  const file = files.find((f) => f.relativePath === relativePath);
  if (!file) throw new Error(`Expected file "${relativePath}" to exist`);
  return file.content;
}

describe("optional-skills template pipeline", () => {
  it("getBundledSkillTemplates() does NOT include chrome-cdp (protective regression)", () => {
    const names = getBundledSkillTemplates().map((s) => s.name);
    expect(names).not.toContain("chrome-cdp");
    expect(names).not.toContain("optional-skills");
  });

  it("getOptionalSkillTemplates() returns chrome-cdp with scripts/cdp.mjs", () => {
    const chromeCdp = requireSkill(getOptionalSkillTemplates(), "chrome-cdp");
    expect(chromeCdp.files.map((f) => f.relativePath)).toEqual(
      expect.arrayContaining([
        "SKILL.md",
        "scripts/cdp.mjs",
        "examples/fetch-hook-api-capture.md",
      ]),
    );
    const skill = requireFile(chromeCdp.files, "SKILL.md");
    expect(skill).toContain("name: chrome-cdp");
    expect(skill).toContain("experimental");
  });

  it("getOptionalSkillTemplates() only lists the optional-skills directory", () => {
    const names = getOptionalSkillTemplates().map((s) => s.name);
    expect(names).toEqual(["chrome-cdp"]);
  });

  it("resolveOptionalSkills([]) resolves nothing", () => {
    expect(resolveOptionalSkills([], AI_TOOLS.cursor.templateContext)).toEqual([]);
  });

  it("resolveOptionalSkills('chrome-cdp') resolves SKILL.md + scripts + examples with placeholder rendering", () => {
    const resolved = resolveOptionalSkills(
      ["chrome-cdp"],
      AI_TOOLS.cursor.templateContext,
    );
    expect(resolved.map((f) => f.relativePath)).toEqual(
      expect.arrayContaining([
        "chrome-cdp/SKILL.md",
        "chrome-cdp/scripts/cdp.mjs",
        "chrome-cdp/examples/fetch-hook-api-capture.md",
      ]),
    );
    const skill = requireFile(resolved, "chrome-cdp/SKILL.md");
    expect(skill).toContain("Required Safety Wording");
    expect(skill).toContain("Prefer Playwright MCP");
  });

  it("resolveOptionalSkills throws on unknown names (loud failure, no silent no-op)", () => {
    expect(() =>
      resolveOptionalSkills(["chrome-cdp", "nope-missing"], AI_TOOLS.cursor.templateContext),
    ).toThrow(/Unknown optional skill\(s\): nope-missing/);
  });
});