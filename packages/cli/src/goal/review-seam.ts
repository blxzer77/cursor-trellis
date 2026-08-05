import fs from "node:fs";
import path from "node:path";

import type { GoalActionPacket, GoalReviewDecision } from "./action-packet.js";
import {
  isValidReviewDecision,
  parseGoalActionPacket,
  parseGoalReviewDecision,
} from "./action-packet.js";
import { appendAuditLine, formatL1Line } from "./audit.js";
import { goalRunDir } from "./paths.js";
import type { GoalState } from "./state.js";

export interface ProposedAction {
  summary: string;
  kind: string;
  digest: string;
  axes: { A: boolean; B: boolean; C: boolean };
  hardDenyCandidates: string[];
  constraintsHint?: string | null;
}

export type ReviewCaller = (packetPath: string) => Promise<GoalReviewDecision>;

export function packAction(
  state: GoalState,
  action: ProposedAction,
): GoalActionPacket {
  const doneRef =
    state.contract?.doneWhen?.[0] ??
    state.goal_text.slice(0, 120) ??
    "active stop condition";

  return parseGoalActionPacket({
    schema_version: 1,
    goal_id: state.goal_id,
    task_dir: state.task_dir,
    proposed_action: action.summary,
    action_kind: action.kind,
    axes: action.axes,
    hard_deny_candidates: action.hardDenyCandidates,
    done_when_ref: doneRef,
    diff_or_cmd_digest: action.digest,
    constraints_hint: action.constraintsHint ?? "feature-branch only",
  });
}

export function writePacketFiles(
  cwd: string,
  goalId: string,
  seq: number,
  packet: GoalActionPacket,
  response?: GoalReviewDecision,
): { requestPath: string; responsePath?: string } {
  const dir = path.join(goalRunDir(cwd, goalId), "packets");
  fs.mkdirSync(dir, { recursive: true });
  const requestPath = path.join(dir, `${seq}-request.json`);
  fs.writeFileSync(requestPath, `${JSON.stringify(packet, null, 2)}\n`, "utf-8");
  if (!response) return { requestPath };
  const responsePath = path.join(dir, `${seq}-response.json`);
  fs.writeFileSync(responsePath, `${JSON.stringify(response, null, 2)}\n`, "utf-8");
  return { requestPath, responsePath };
}

export type ApplyDecisionResult =
  | { action: "execute"; constraints: string[] }
  | { action: "h3_continue" }
  | { action: "reroute"; alternative: string | null }
  | { action: "crash_wall"; reason: string }
  | { action: "retry_review"; reason: string };

export function applyReviewDecision(
  state: GoalState,
  packet: GoalActionPacket,
  decision: GoalReviewDecision,
  rerouteKey: string,
): { state: GoalState; result: ApplyDecisionResult } {
  const validity = isValidReviewDecision(decision);
  if (!validity.valid) {
    return {
      state,
      result: { action: "retry_review", reason: validity.reason },
    };
  }

  if (decision.hard_deny_hit != null) {
    if (decision.decision === "uncertain") {
      return rerouteOrCrash(state, packet, decision, rerouteKey, true);
    }
    if (decision.decision === "deny_suggest_alternative") {
      return rerouteOrCrash(state, packet, decision, rerouteKey, true);
    }
  }

  switch (decision.decision) {
    case "allow":
    case "allow_with_constraints":
      return {
        state,
        result: {
          action: "execute",
          constraints: decision.constraints ?? [],
        },
      };
    case "uncertain":
      return { state, result: { action: "h3_continue" } };
    case "deny_suggest_alternative":
      return rerouteOrCrash(state, packet, decision, rerouteKey, false);
    default:
      return {
        state,
        result: { action: "retry_review", reason: "unknown decision" },
      };
  }
}

function rerouteOrCrash(
  state: GoalState,
  packet: GoalActionPacket,
  decision: GoalReviewDecision,
  rerouteKey: string,
  hardDeny: boolean,
): { state: GoalState; result: ApplyDecisionResult } {
  const count = (state.reroute_counts[rerouteKey] ?? 0) + 1;
  const next = {
    ...state,
    reroute_counts: { ...state.reroute_counts, [rerouteKey]: count },
  };
  if (count > state.walls.maxReroutes) {
    return {
      state: next,
      result: {
        action: "crash_wall",
        reason: hardDeny
          ? `hard-deny reroute exhausted for ${rerouteKey}`
          : `reroute exhausted for ${rerouteKey}`,
      },
    };
  }
  return {
    state: next,
    result: {
      action: "reroute",
      alternative: decision.alternative ?? null,
    },
  };
}

export function recordL1(
  cwd: string,
  goalId: string,
  decision: GoalReviewDecision,
): void {
  appendAuditLine(cwd, goalId, "L1", formatL1Line(decision.l1_ready));
}

export function recordL2(cwd: string, goalId: string, reason: string): void {
  appendAuditLine(cwd, goalId, "L2", reason);
}

/** MVP fallback when reviewer Child CLI is not yet available. */
export function minimalReviewFallback(packet: GoalActionPacket): GoalReviewDecision {
  const digest = packet.diff_or_cmd_digest.toLowerCase();
  let hard: string | null = null;
  if (/git\s+push\s+.*--force/.test(digest) || /push\s+--force/.test(digest)) {
    hard = "H-1";
  } else if (
    /\b(main|master|release)\b/.test(digest) &&
    /(push|merge|commit)/.test(digest)
  ) {
    hard = "H-2";
  }

  const axes = packet.axes;
  const now = new Date().toISOString();
  if (hard) {
    return parseGoalReviewDecision({
      schema_version: 1,
      decision: "deny_suggest_alternative",
      axes,
      hard_deny_hit: hard,
      alternative: "Use a feature branch and avoid force-push to protected branches.",
      rationale: `Hard deny ${hard} matched digest.`,
      h3_allowed: false,
      l1_ready: {
        time: now,
        action: packet.proposed_action,
        axes,
        reviewer: "cstl-goal-runtime-fallback",
        decision: "deny_suggest_alternative",
        rollback_hint: "Do not execute; reroute per contract-freeze §3.",
      },
    });
  }

  const needsReview = axes.A || axes.B || packet.hard_deny_candidates.length > 0;
  const decision = needsReview ? "uncertain" : "allow";
  return parseGoalReviewDecision({
    schema_version: 1,
    decision,
    axes,
    hard_deny_hit: null,
    rationale: needsReview ? "Axes triggered review." : "Local reversible work.",
    h3_allowed: true,
    l1_ready: {
      time: now,
      action: packet.proposed_action,
      axes,
      reviewer: "cstl-goal-runtime-fallback",
      decision,
      rollback_hint: needsReview ? "H3 may continue if not hard-deny." : "Revert local edits.",
    },
  });
}
