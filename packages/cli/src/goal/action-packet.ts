import { z } from "zod";

/** Parent lock v0 — shared with reviewer Child. */
export const GOAL_ACTION_PACKET_SCHEMA_VERSION = 1 as const;

export const HARD_DENY_IDS = [
  "H-1",
  "H-2",
  "H-3",
  "H-4",
  "H-5",
  "H-6",
] as const;

export type HardDenyId = (typeof HARD_DENY_IDS)[number];

export const REVIEW_DECISIONS = [
  "allow",
  "allow_with_constraints",
  "deny_suggest_alternative",
  "uncertain",
] as const;

export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

const axesSchema = z.object({
  A: z.boolean(),
  B: z.boolean(),
  C: z.boolean(),
});

export const goalActionPacketSchema = z.object({
  schema_version: z.literal(GOAL_ACTION_PACKET_SCHEMA_VERSION),
  goal_id: z.string().min(1),
  task_dir: z.string().nullable().optional(),
  proposed_action: z.string().min(1),
  action_kind: z.string().min(1),
  axes: axesSchema,
  hard_deny_candidates: z.array(z.string()),
  done_when_ref: z.string().min(1),
  diff_or_cmd_digest: z.string().min(1),
  constraints_hint: z.string().nullable().optional(),
});

export const goalReviewDecisionSchema = z.object({
  schema_version: z.literal(GOAL_ACTION_PACKET_SCHEMA_VERSION),
  decision: z.enum(REVIEW_DECISIONS),
  axes: axesSchema,
  hard_deny_hit: z.string().nullable(),
  constraints: z.array(z.string()).optional(),
  alternative: z.string().nullable().optional(),
  rationale: z.string().min(1),
  l1_ready: z.object({
    time: z.string().min(1),
    action: z.string().min(1),
    axes: axesSchema,
    reviewer: z.string().min(1),
    decision: z.string().min(1),
    rollback_hint: z.string().min(1),
  }),
  h3_allowed: z.boolean().optional(),
  valid: z.boolean().optional(),
  invalid_reason: z.string().optional(),
});

export type GoalAxes = z.infer<typeof axesSchema>;
export type GoalActionPacket = z.infer<typeof goalActionPacketSchema>;
export type GoalReviewDecision = z.infer<typeof goalReviewDecisionSchema>;

export function parseGoalActionPacket(input: unknown): GoalActionPacket {
  return goalActionPacketSchema.parse(input);
}

export function safeParseGoalActionPacket(
  input: unknown,
): { valid: true; packet: GoalActionPacket } | { valid: false; invalid_reason: string } {
  const parsed = goalActionPacketSchema.safeParse(input);
  if (!parsed.success) {
    return {
      valid: false,
      invalid_reason: parsed.error.issues.map((i) => i.message).join("; "),
    };
  }
  return { valid: true, packet: parsed.data };
}

export function parseGoalReviewDecision(input: unknown): GoalReviewDecision {
  const parsed = goalReviewDecisionSchema.parse(input);
  if (parsed.hard_deny_hit != null && parsed.h3_allowed === true) {
    throw new Error("invalid decision: hard_deny_hit set but h3_allowed is true");
  }
  return parsed;
}

export function isValidReviewDecision(
  decision: GoalReviewDecision,
): { valid: true } | { valid: false; reason: string } {
  if (decision.valid === false) {
    return { valid: false, reason: decision.invalid_reason ?? "marked invalid" };
  }
  const l1 = decision.l1_ready;
  if (!l1.time || !l1.action || !l1.reviewer || !l1.decision || !l1.rollback_hint) {
    return { valid: false, reason: "incomplete l1_ready" };
  }
  if (!decision.decision || !decision.axes) {
    return { valid: false, reason: "missing decision or axes" };
  }
  if (decision.hard_deny_hit != null && decision.h3_allowed === true) {
    return { valid: false, reason: "hard_deny_hit set but h3_allowed is true" };
  }
  return { valid: true };
}

export function deriveH3Allowed(decision: GoalReviewDecision): boolean {
  if (decision.hard_deny_hit != null) {
    return false;
  }
  return decision.decision === "uncertain";
}

export function validateGoalReviewDecision(
  input: unknown,
): { valid: true; decision: GoalReviewDecision } | { valid: false; invalid_reason: string } {
  try {
    const decision = parseGoalReviewDecision(input);
    const check = isValidReviewDecision(decision);
    if (!check.valid) {
      return { valid: false, invalid_reason: check.reason };
    }
    return { valid: true, decision };
  } catch (error) {
    return {
      valid: false,
      invalid_reason: error instanceof Error ? error.message : String(error),
    };
  }
}
