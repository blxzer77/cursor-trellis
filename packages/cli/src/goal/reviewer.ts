import {
  deriveH3Allowed,
  type GoalActionPacket,
  type GoalReviewDecision,
  safeParseGoalActionPacket,
  validateGoalReviewDecision,
} from "./action-packet.js";
import { evaluateReviewerRules } from "./reviewer-rules.js";

export interface ReviewResult {
  valid: boolean;
  decision?: GoalReviewDecision;
  invalid_reason?: string;
}

function buildL1Ready(
  packet: GoalActionPacket,
  evaluation: ReturnType<typeof evaluateReviewerRules>,
): GoalReviewDecision["l1_ready"] {
  return {
    time: new Date().toISOString(),
    action: packet.proposed_action.slice(0, 200),
    axes: evaluation.axes,
    reviewer: "cstl-goal-reviewer",
    decision: evaluation.decision,
    rollback_hint:
      evaluation.hard_deny_hit != null
        ? `Do not execute; reroute away from ${evaluation.hard_deny_hit}.`
        : "Revert local edits or undo git commit if outcome is wrong.",
  };
}

export function reviewGoalActionPacket(input: unknown): ReviewResult {
  const packetResult = safeParseGoalActionPacket(input);
  if (!packetResult.valid) {
    return {
      valid: false,
      invalid_reason: packetResult.invalid_reason,
    };
  }

  const packet = packetResult.packet;
  const evaluation = evaluateReviewerRules(packet);
  const l1_ready = buildL1Ready(packet, evaluation);

  const decisionPayload = {
    schema_version: 1 as const,
    decision: evaluation.decision,
    axes: evaluation.axes,
    hard_deny_hit: evaluation.hard_deny_hit,
    constraints: evaluation.constraints,
    alternative: evaluation.alternative ?? null,
    rationale: evaluation.rationale,
    l1_ready,
    h3_allowed: deriveH3Allowed({
      schema_version: 1,
      decision: evaluation.decision,
      axes: evaluation.axes,
      hard_deny_hit: evaluation.hard_deny_hit,
      rationale: evaluation.rationale,
      l1_ready,
    }),
  };

  const decisionResult = validateGoalReviewDecision(decisionPayload);
  if (!decisionResult.valid) {
    return {
      valid: false,
      invalid_reason: decisionResult.invalid_reason,
    };
  }

  return { valid: true, decision: decisionResult.decision };
}

export { validateGoalReviewDecision };
