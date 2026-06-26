import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { expectedRules } from "../../src/templates/cursor/fixtures/expected-rules.js";
import { getAllRules } from "../../src/templates/cursor/index.js";
import {
  formatRuleValidationErrors,
  validateRulesDir,
  validateTemplateRules,
} from "../../src/utils/validate-rules.js";

describe("validate-rules", () => {
  it("passes for current template rules (positive case)", () => {
    const result = validateTemplateRules();
    expect(result.ok, formatRuleValidationErrors(result)).toBe(true);
    expect(getAllRules().map((r) => r.name).sort()).toEqual(
      expectedRules.map((r) => r.filename).sort(),
    );
  });

  it("fails when a required rule is missing from manifest check (negative case)", () => {
    const result = validateTemplateRules([
      ...expectedRules,
      {
        filename: "nonexistent-rule.mdc",
        requiredSections: ["must-exist"],
        minBytes: 1,
      },
    ]);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.kind === "missing")).toBe(true);
  });

  it("fails when installed rules dir is missing a required file", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-rules-"));
    const rulesDir = path.join(tmp, "rules");
    fs.mkdirSync(rulesDir);

    for (const rule of getAllRules()) {
      if (rule.name !== "trellis-triage.mdc") {
        fs.writeFileSync(path.join(rulesDir, rule.name), rule.content);
      }
    }

    const result = validateRulesDir(rulesDir);
    expect(result.ok).toBe(false);
    expect(
      result.issues.some(
        (i) => i.filename === "trellis-triage.mdc" && i.kind === "missing",
      ),
    ).toBe(true);
  });
});
