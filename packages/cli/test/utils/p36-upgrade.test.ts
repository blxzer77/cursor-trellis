import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  applyOfficialRetire,
  composeP36Plan,
  planOfficialSurfaceA,
} from "../../src/utils/p36-upgrade.js";
import { computeHash } from "../../src/utils/template-hash.js";
import { planArtifactMigration } from "@blxzer/cursor-trellis-core/task";

const TRIAGE = `---
description: "old triage"
alwaysApply: true
---

# old triage
`;

describe("P36 official-surface A planner", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cstl-p36-a-"));
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("retires unmodified known always-on and preserves user edits", () => {
    const triage = path.join(tmp, ".cursor", "rules", "cstl-triage.mdc");
    const routing = path.join(tmp, ".cursor", "rules", "retrieval-routing.mdc");
    fs.mkdirSync(path.dirname(triage), { recursive: true });
    fs.writeFileSync(triage, TRIAGE, "utf-8");
    fs.writeFileSync(routing, `${TRIAGE}\nuser change\n`, "utf-8");

    const hashes = {
      ".cursor/rules/cstl-triage.mdc": computeHash(TRIAGE),
      ".cursor/rules/retrieval-routing.mdc": computeHash(TRIAGE),
    };
    const official = planOfficialSurfaceA({
      cwd: tmp,
      hashes,
      refresh: [".cstl/workflow.md"],
      preserved: ["AGENTS.md"],
    });
    expect(official.retire.map((item) => item.path)).toEqual([
      ".cursor/rules/cstl-triage.mdc",
    ]);
    expect(official.preserve.map((item) => item.path)).toEqual([
      ".cursor/rules/retrieval-routing.mdc",
    ]);

    const artifacts = planArtifactMigration({ root: tmp });
    const plan = composeP36Plan({
      official,
      artifacts,
      writeArtifacts: false,
    });
    const text = plan.vernacular.join("\n");
    expect(text).toMatch(/官方面/);
    expect(text).not.toMatch(/Stage\s*[0-7]/);
    expect(text).not.toMatch(/MyHarness/);
    expect(text).not.toMatch(/手搬/);

    const deleted = applyOfficialRetire(tmp, official);
    expect(deleted).toBe(1);
    expect(fs.existsSync(triage)).toBe(false);
    expect(fs.existsSync(routing)).toBe(true);
  });
});
