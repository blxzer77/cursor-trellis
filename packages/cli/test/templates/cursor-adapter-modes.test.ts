import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  collectPlatformTemplates,
  configurePlatform,
} from "../../src/configurators/index.js";
import {
  resolveCommands,
  wrapWithSkillFrontmatter,
} from "../../src/configurators/shared.js";
import { getCursorCommands } from "../../src/templates/cursor/index.js";
import { AI_TOOLS } from "../../src/types/ai-tools.js";
import { setWriteMode } from "../../src/utils/file-writer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../../..");
const cliSrc = path.join(repoRoot, "packages/cli/src");

const modesGuidePath = path.join(
  cliSrc,
  "templates/markdown/framework/cursor-native-modes-guide.md.txt",
);
const continuePath = path.join(
  cliSrc,
  "templates/common/commands/continue.md",
);
const finishWorkPath = path.join(
  cliSrc,
  "templates/common/commands/finish-work.md",
);
const bootstrapPath = path.join(
  cliSrc,
  "templates/cursor/rules/cstl-bootstrap.mdc",
);
const cursorRulesDir = path.join(cliSrc, "templates/cursor/rules");

const SHIPPED_SLASH_FILES = [
  "cstl-continue.md",
  "cstl-finish-work.md",
  "cstl-handoff.md",
] as const;

describe("Cursor adapter modes — shipped slash set", () => {
  it("resolveCommands on agent-capable Cursor omits start", () => {
    const names = resolveCommands(AI_TOOLS.cursor.templateContext).map(
      (cmd) => cmd.name,
    );
    expect(names).toEqual(["continue", "finish-work"]);
    expect(names).not.toContain("start");
  });

  it("Cursor extras add only handoff", () => {
    expect(getCursorCommands().map((cmd) => cmd.name)).toEqual(["handoff"]);
  });

  it("collectPlatformTemplates locks the three-piece slash set", () => {
    const templates = collectPlatformTemplates("cursor");
    expect(templates).toBeInstanceOf(Map);
    const commandFiles = [...(templates?.keys() ?? [])]
      .filter((key) => key.startsWith(".cursor/commands/"))
      .map((key) => key.slice(".cursor/commands/".length))
      .sort();
    expect(commandFiles).toEqual([...SHIPPED_SLASH_FILES]);
    expect(templates?.has(".cursor/commands/cstl-start.md")).toBe(false);
    for (const internal of [
      "brainstorm",
      "check",
      "skill-creator",
      "before-dev",
      "micro-grill",
    ]) {
      expect(templates?.has(`.cursor/commands/cstl-${internal}.md`)).toBe(
        false,
      );
    }
  });
});

describe("Cursor adapter modes — configure install list", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cstl-adapter-modes-"));
    setWriteMode("force");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    setWriteMode("ask");
  });

  it("writes only cstl-continue / cstl-finish-work / cstl-handoff under commands", async () => {
    await configurePlatform("cursor", tmpDir);
    const commandsDir = path.join(tmpDir, ".cursor", "commands");
    const installed = fs.readdirSync(commandsDir).sort();
    expect(installed).toEqual([...SHIPPED_SLASH_FILES]);
    expect(installed).not.toContain("cstl-start.md");
  });
});

describe("Cursor adapter modes — guide and escape hatches", () => {
  const read = (filePath: string): string =>
    fs.readFileSync(filePath, "utf-8").replace(/\r\n/g, "\n");

  it("modes guide uses Open/Define and Ask cannot SwitchMode; no mandatory [Triage:]", () => {
    const guide = read(modesGuidePath);
    expect(guide).toMatch(/\bOpen\b/);
    expect(guide).toMatch(/\bDefine\b/);
    expect(guide).toMatch(/cannot `SwitchMode`/i);
    expect(guide).not.toContain("[Triage:]");
    expect(guide).not.toContain("Phase 1");
    expect(guide).not.toContain("Micro-Grill");
    expect(guide).not.toContain("本版本不适配");
    expect(guide).toContain("generalPurpose");
    expect(guide).toMatch(/\/goal/);
    expect(guide).toContain("Do **not** restore `cstl-goal`");
  });

  it("continue.md does not treat Phase Index as runtime SSOT", () => {
    const body = read(continuePath);
    expect(body).toMatch(/selected_task/);
    expect(body).toMatch(/Kernel/);
    expect(body).toMatch(/Dashboard/);
    expect(body).not.toContain("Load the Phase Index");
    expect(body).toMatch(/not.{0,80}runtime SSOT/i);
    expect(body).not.toMatch(/## Step \d+: Load the Phase Index/);
  });

  it("finish-work.md uses Close / Verify names instead of Phase 3.x", () => {
    const body = read(finishWorkPath);
    expect(body).toMatch(/\bClose\b/);
    expect(body).toMatch(/\bVerify\b/);
    expect(body).not.toContain("Phase 3.3");
    expect(body).not.toContain("Phase 3.4");
  });

  it("SKILL_DESCRIPTIONS continue no longer names Phase Index as the loader", () => {
    const wrapped = wrapWithSkillFrontmatter("cstl-continue", "# body\n");
    expect(wrapped).not.toContain("Loads the workflow Phase Index");
    expect(wrapped).toMatch(/Kernel\/Dashboard/);
  });

  it("cstl-bootstrap.mdc is the only default always-on rule and stays thin", () => {
    const rules = fs
      .readdirSync(cursorRulesDir)
      .filter((name) => name.endsWith(".mdc"))
      .sort();
    expect(rules).toEqual(["cstl-bootstrap.mdc"]);
    const body = read(bootstrapPath);
    expect(body).toMatch(/^alwaysApply:\s*true$/m);
    expect(body).toContain("single thin Bootstrap");
    expect(body).not.toContain("SwitchMode");
    expect(body).not.toContain("[Triage:]");
    expect(body).not.toContain("Phase Index");
    expect(body.split("\n").length).toBeLessThan(40);
  });
});
