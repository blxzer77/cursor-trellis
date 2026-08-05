import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { buildGoalWorkerPrompt } from "../../src/goal/worker-prompt.js";
import {
  extractJsonBlocks,
  MockWorkerAdapter,
  parseWorkerPacketFromText,
  resolveWorkerAdapter,
} from "../../src/goal/worker.js";
import { createDraftState } from "../../src/goal/state.js";

const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeCstlRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cstl-goal-worker-"));
  tempDirs.push(root);
  fs.mkdirSync(path.join(root, ".cstl", "workspace"), { recursive: true });
  return root;
}

describe("goal worker", () => {
  it("builds goal worker prompt with binding block", () => {
    const state = createDraftState("goal-20260806-abc", "Ship SDK worker", "runner");
    state.contract = {
      goalText: "Ship SDK worker",
      doneWhen: ["tests pass"],
      evidenceHow: "vitest",
      acceptedAt: new Date().toISOString(),
    };
    const prompt = buildGoalWorkerPrompt({
      cwd: "/repo",
      state,
      contractPath: "/repo/.cstl/workspace/goal-runs/goal-20260806-abc/contract.md",
      agentDefinitionPath: "/repo/.cursor/agents/cstl-goal-worker.md",
      turnIndex: 1,
    });
    expect(prompt).toContain("goal-20260806-abc");
    expect(prompt).toContain("done_when");
    expect(prompt).toContain("GoalActionPacket");
  });

  it("extracts GoalActionPacket JSON from markdown", () => {
    const text = [
      "Status update",
      "```json",
      JSON.stringify({
        schema_version: 1,
        goal_id: "goal-1",
        task_dir: null,
        proposed_action: "run tests",
        action_kind: "shell",
        axes: { A: false, B: false, C: true },
        hard_deny_candidates: [],
        done_when_ref: "tests pass",
        diff_or_cmd_digest: "pnpm test goal/",
      }),
      "```",
    ].join("\n");
    const blocks = extractJsonBlocks(text);
    expect(blocks).toHaveLength(1);
    const packet = parseWorkerPacketFromText(text, "goal-1");
    expect(packet?.proposed_action).toBe("run tests");
  });

  it("mock adapter returns action packet", async () => {
    const cwd = makeCstlRoot();
    const state = createDraftState("goal-1", "x", "runner");
    state.contract = {
      goalText: "x",
      doneWhen: ["done"],
      evidenceHow: "vitest",
      acceptedAt: new Date().toISOString(),
    };
    const adapter = new MockWorkerAdapter();
    const result = await adapter.runTurn({
      cwd,
      state,
      contractPath: path.join(cwd, "contract.md"),
      agentDefinitionPath: path.join(cwd, "agent.md"),
      turnIndex: 1,
      timeoutMs: 1000,
    });
    expect(result.kind).toBe("action");
    expect(result.packet?.goal_id).toBe("goal-1");
  });

  it("resolveWorkerAdapter uses mock when requested", () => {
    expect(resolveWorkerAdapter({ mockWorker: true }).id).toBe("mock");
    expect(resolveWorkerAdapter({ worker: "mock" }).id).toBe("mock");
  });

  it("resolveWorkerAdapter refuses sdk without API key", () => {
    const prev = process.env.CURSOR_API_KEY;
    delete process.env.CURSOR_API_KEY;
    try {
      expect(() => resolveWorkerAdapter({})).toThrow(/CURSOR_API_KEY/);
    } finally {
      if (prev !== undefined) process.env.CURSOR_API_KEY = prev;
    }
  });
});
