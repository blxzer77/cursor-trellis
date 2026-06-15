import { describe, it, expect } from "vitest";

import {
  UPDATE_ROLLOUT_REPORT_SCHEMA_VERSION,
  buildFilePlanFromChanges,
  createBaseRolloutReport,
  summarizeMigrationPlan,
} from "../../src/utils/update-rollout-report.js";

describe("update-rollout-report", () => {
  it("buildFilePlanFromChanges lists pending conflicts separately from apply fields", () => {
    const plan = buildFilePlanFromChanges({
      newFiles: [{ relativePath: "a.py" }],
      unchangedFiles: [{ relativePath: "b.py" }],
      autoUpdateFiles: [{ relativePath: "c.py" }],
      changedFiles: [{ relativePath: "AGENTS.md" }],
      userDeletedFiles: [],
      safeDeletePaths: ["old.md"],
    });
    expect(plan.added).toEqual(["a.py"]);
    expect(plan.autoUpdated).toEqual(["c.py"]);
    expect(plan.overwritten).toEqual([]);
    expect(plan.skipped).toEqual([]);
    expect(plan.safeDeleted).toEqual(["old.md"]);
  });

  it("createBaseRolloutReport uses schema version 1", () => {
    const report = createBaseRolloutReport({
      mode: "dry-run",
      outcome: "would_apply",
      projectPath: "/tmp/proj",
      projectVersionBefore: "1.0.0",
      latestNpmVersion: "1.0.1",
      cliBehindNpm: false,
      options: {
        dryRun: true,
        force: false,
        skipAll: false,
        createNew: false,
        migrate: false,
        allowDowngrade: false,
        skipReadiness: false,
      },
      readiness: {
        skipped: false,
        smartSearch: { command: "smart-search doctor --format json", ok: true, details: [] },
        capabilities: [],
      },
      upgradeDirection: "upgrade",
      files: buildFilePlanFromChanges({
        newFiles: [],
        unchangedFiles: [],
        autoUpdateFiles: [],
        changedFiles: [],
        userDeletedFiles: [],
      }),
      conflictsPending: ["AGENTS.md"],
      migrations: summarizeMigrationPlan(null, 0),
    });
    expect(report.schemaVersion).toBe(UPDATE_ROLLOUT_REPORT_SCHEMA_VERSION);
    expect(report.plan.conflictsPending).toEqual(["AGENTS.md"]);
    expect(report.mode).toBe("dry-run");
    expect(report.outcome).toBe("would_apply");
  });
});