import { describe, expect, it } from "vitest";

import { parseGoalActionPacket } from "../../src/goal/action-packet.js";
import {
  applyReviewDecision,
  minimalReviewFallback,
  packAction,
} from "../../src/goal/review-seam.js";
import { createDraftState } from "../../src/goal/state.js";

describe("goal review seam", () => {
  it("packs action packets", () => {
    const state = createDraftState("goal-1", "ship feature", "runner");
    state.contract = {
      goalText: "ship feature",
      doneWhen: ["tests pass"],
      evidenceHow: "vitest",
      acceptedAt: new Date().toISOString(),
    };
    const packet = packAction(state, {
      summary: "git push origin main",
      kind: "git",
      digest: "git push origin main",
      axes: { A: true, B: true, C: true },
      hardDenyCandidates: ["H-2"],
    });
    expect(packet.goal_id).toBe("goal-1");
    expect(packet.done_when_ref).toContain("tests pass");
  });

  it("fallback hard-denies push to main", () => {
    const packet = parseGoalActionPacket({
      schema_version: 1,
      goal_id: "g",
      proposed_action: "push main",
      action_kind: "git",
      axes: { A: true, B: true, C: true },
      hard_deny_candidates: ["H-2"],
      done_when_ref: "done",
      diff_or_cmd_digest: "git push origin main",
    });
    const decision = minimalReviewFallback(packet);
    expect(decision.hard_deny_hit).toBe("H-2");
    const state = createDraftState("g", "x", "runner");
    const outcome = applyReviewDecision(state, packet, decision, "git");
    expect(outcome.result.action).toBe("reroute");
  });

  it("allows uncertain H3 when not hard deny", () => {
    const packet = parseGoalActionPacket({
      schema_version: 1,
      goal_id: "g",
      proposed_action: "edit file",
      action_kind: "fs",
      axes: { A: false, B: false, C: true },
      hard_deny_candidates: [],
      done_when_ref: "done",
      diff_or_cmd_digest: "edit src/foo.ts",
    });
    const decision = minimalReviewFallback(packet);
    const state = createDraftState("g", "x", "runner");
    const outcome = applyReviewDecision(state, packet, decision, "fs");
    expect(outcome.result.action).toBe("execute");
  });
});
