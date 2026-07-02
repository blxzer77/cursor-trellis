import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  formatMirrorDiffs,
  runMirrorCheck,
} from "../../src/utils/mirror-check.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliDir = path.resolve(__dirname, "../..");
const trellisRoot = path.resolve(cliDir, "../..");

describe("mirror-check", () => {
  it("passes when dogfood mirrors templates (positive case)", () => {
    const result = runMirrorCheck({
      dogfoodRoot: trellisRoot,
      templateCursorDir: path.join(cliDir, "src/templates/cursor"),
      templateAgentsPath: path.join(cliDir, "src/templates/markdown/agents.md"),
    });
    expect(result.ok, formatMirrorDiffs(result.diffs)).toBe(true);
  });

  it("fails when dogfood rule content diverges (negative case)", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-mirror-"));
    const dogfoodCursor = path.join(tmp, ".cursor", "rules");
    fs.mkdirSync(dogfoodCursor, { recursive: true });

    const templateRule = path.join(
      cliDir,
      "src/templates/cursor/rules/cstl-triage.mdc",
    );
    fs.copyFileSync(
      templateRule,
      path.join(dogfoodCursor, "cstl-triage.mdc"),
    );
    fs.writeFileSync(
      path.join(dogfoodCursor, "cstl-triage.mdc"),
      fs.readFileSync(templateRule, "utf-8") + "\n# drift",
    );

    const result = runMirrorCheck({
      dogfoodRoot: tmp,
      templateCursorDir: path.join(cliDir, "src/templates/cursor"),
      templateAgentsPath: path.join(cliDir, "src/templates/markdown/agents.md"),
    });
    expect(result.ok).toBe(false);
    expect(result.diffs.some((d) => d.relativePath === "rules/cstl-triage.mdc")).toBe(
      true,
    );
  });

  it("mirror-check script exits 0 for current repo", () => {
    execSync("node scripts/mirror-check.js", {
      cwd: cliDir,
      encoding: "utf-8",
    });
  });
});
