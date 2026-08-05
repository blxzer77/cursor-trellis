import { describe, expect, it } from "vitest";

import { checkWalls } from "../../src/goal/walls.js";
import { createDraftState } from "../../src/goal/state.js";

describe("goal walls", () => {
  it("trips wall-clock", () => {
    const state = createDraftState("goal-test", "x", "window");
    state.lifecycle = "running";
    state.started_at = new Date(Date.now() - 50 * 60 * 1000).toISOString();
    const result = checkWalls(state);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("wall-clock");
  });

  it("trips worker turn cap", () => {
    const state = createDraftState("goal-test", "x", "runner");
    state.worker_turns = state.walls.workerTurnLimit;
    const result = checkWalls(state);
    expect(result.ok).toBe(false);
  });
});
