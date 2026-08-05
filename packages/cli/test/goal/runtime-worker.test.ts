import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { goalAuditPath } from "../../src/goal/paths.js";
import {
  acceptGoalPreflight,
  runGoalLoop,
  runGoalPreflight,
} from "../../src/goal/runtime.js";
import { readGoalState } from "../../src/goal/state.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeCstlRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cstl-goal-run-"));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, ".cstl", "workspace"), { recursive: true });
  fs.mkdirSync(path.join(root, ".cstl", "tasks"), { recursive: true });
  fs.mkdirSync(path.join(root, ".cstl", "scripts"), { recursive: true });
  return root;
}

describe("runGoalLoop with mock worker", () => {
  it("runs propose → review → apply for one step", async () => {
    const cwd = makeCstlRoot();
    const { goalId } = runGoalPreflight({
      cwd,
      goal: "Document cstl-goal SDK worker mock path in verify.md with commands.",
    });
    acceptGoalPreflight({ cwd, goalId });

    const final = await runGoalLoop({
      cwd,
      goalId,
      mockWorker: true,
      maxSteps: 1,
    });

    expect(final.lifecycle).toBe("running");
    expect(final.last_worker_adapter).toBe("mock");
    expect(final.worker_turns).toBe(1);

    const audit = fs.readFileSync(goalAuditPath(cwd, goalId), "utf-8");
    expect(audit).toContain("worker mock turn 1 start");
    expect(audit).toMatch(/L1|allow/);

    const packetsDir = path.join(
      cwd,
      ".cstl",
      "workspace",
      "goal-runs",
      goalId,
      "packets",
    );
    expect(fs.existsSync(path.join(packetsDir, "1-request.json"))).toBe(true);
    expect(fs.existsSync(path.join(packetsDir, "1-response.json"))).toBe(true);

    const reread = readGoalState(cwd, goalId);
    expect(reread.last_worker_adapter).toBe("mock");
  });
});
