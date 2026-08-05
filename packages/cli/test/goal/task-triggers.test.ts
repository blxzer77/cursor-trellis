import { describe, expect, it } from "vitest";

import {
  evaluateTaskTriggers,
  shouldCreateGoalRootTask,
} from "../../src/goal/task-triggers.js";
import { createDraftState } from "../../src/goal/state.js";

describe("goal task triggers", () => {
  it("T-5 on preflight accept", () => {
    const state = createDraftState("g", "goal", "runner");
    const hits = evaluateTaskTriggers(state, { l1Count: 0, justAcceptedPreflight: true });
    expect(hits.some((h) => h.id === "T-5")).toBe(true);
    expect(shouldCreateGoalRootTask(hits)).toBe(true);
  });
});
