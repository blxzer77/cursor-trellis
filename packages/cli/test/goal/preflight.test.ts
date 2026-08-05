import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { proposePreflight } from "../../src/goal/preflight.js";
import { acceptGoalPreflight, runGoalPreflight } from "../../src/goal/runtime.js";
import { readGoalState } from "../../src/goal/state.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeCstlRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cstl-goal-"));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, ".cstl", "workspace"), { recursive: true });
  fs.mkdirSync(path.join(root, ".cstl", "tasks"), { recursive: true });
  fs.mkdirSync(path.join(root, ".cstl", "scripts"), { recursive: true });
  return root;
}

describe("goal preflight", () => {
  it("rejects vague goals", () => {
    const result = proposePreflight("fix", "runner");
    expect(result.ok).toBe(false);
  });

  it("accepts concrete goals with done_when", () => {
    const result = proposePreflight(
      "Add cstl goal status command with vitest coverage.",
      "runner",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.doneWhen.length).toBeGreaterThanOrEqual(1);
      expect(result.evidenceHow.length).toBeGreaterThan(0);
    }
  });

  it("accept flow creates running state and contract file", () => {
    const cwd = makeCstlRoot();
    const { goalId } = runGoalPreflight({
      cwd,
      goal: "Document cstl-goal dogfood steps in verify.md with commands.",
    });
    const accepted = acceptGoalPreflight({ cwd, goalId });
    expect(accepted.lifecycle).toBe("running");
    expect(fs.existsSync(path.join(cwd, ".cstl", "workspace", "goal-runs", goalId, "contract.md"))).toBe(true);
    const reread = readGoalState(cwd, goalId);
    expect(reread.contract?.doneWhen.length).toBeGreaterThan(0);
  });
});
