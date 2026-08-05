import path from "node:path";

import type { GoalState } from "./state.js";

export interface GoalWorkerPromptContext {
  cwd: string;
  state: GoalState;
  contractPath: string;
  agentDefinitionPath: string;
  turnIndex: number;
}

/**
 * Build the authoritative prompt for cstl-goal-worker (SDK / channel runner).
 */
export function buildGoalWorkerPrompt(ctx: GoalWorkerPromptContext): string {
  const absoluteContract = path.resolve(ctx.contractPath);
  const absoluteAgent = path.resolve(ctx.agentDefinitionPath);
  const taskDir = ctx.state.task_dir ? path.resolve(ctx.state.task_dir) : "(none)";
  const doneWhen =
    ctx.state.contract?.doneWhen.map((d, i) => `${i + 1}. ${d}`).join("\n") ??
    "(contract not loaded)";
  const evidenceHow = ctx.state.contract?.evidenceHow ?? "(unspecified)";

  return [
    "## Goal binding (authoritative)",
    `- goal_id: \`${ctx.state.goal_id}\``,
    `- mode: \`${ctx.state.mode}\``,
    `- contract.md (absolute): \`${absoluteContract}\``,
    `- task_dir (absolute): \`${taskDir}\``,
    `- worker agent definition: \`${absoluteAgent}\``,
    `- turn: ${ctx.turnIndex}`,
    `- worker_turns: ${ctx.state.worker_turns} / ${ctx.state.walls.workerTurnLimit}`,
    "",
    "## done_when",
    doneWhen,
    "",
    "## evidence_how",
    evidenceHow,
    "",
    "## Turn instructions",
    "You are the cstl-goal-worker subagent (G1). Advance one concrete step toward done_when.",
    "If you need human-reviewed action (push/merge/delete/global-config class): output a single JSON code block",
    "matching GoalActionPacket v0 (schema_version=1, goal_id, proposed_action, action_kind, axes,",
    "hard_deny_candidates, done_when_ref, diff_or_cmd_digest). Do NOT include secrets.",
    "Otherwise reply with a short status: progress vs done_when, next action, blockers.",
    "",
    "## Forbidden",
    "- Mid-flight human approval requests (preflight already passed).",
    "- Force-push, commit to main/release, bypass hard deny H-1…H-6.",
    "- Raw secrets in output.",
  ].join("\n");
}
