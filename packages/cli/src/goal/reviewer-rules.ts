import type { GoalActionPacket, GoalAxes, HardDenyId, ReviewDecision } from "./action-packet.js";

const RELEASE_BRANCH = /\b(main|master|release)\b/i;
const FEATURE_BRANCH = /\bfeat\/[\w-]+/i;

export interface RuleEvaluation {
  hard_deny_hit: HardDenyId | null;
  decision: ReviewDecision;
  axes: GoalAxes;
  constraints?: string[];
  alternative?: string | null;
  rationale: string;
}

function combinedText(packet: GoalActionPacket): string {
  return `${packet.proposed_action}\n${packet.diff_or_cmd_digest}`.toLowerCase();
}

function isProjectScopedMcp(text: string): boolean {
  return (
    /\.cursor\/mcp\.json/.test(text) &&
    !/~\//.test(text) &&
    !/user-global|machine-level|~\/.cursor/.test(text)
  );
}

export function detectHardDeny(packet: GoalActionPacket): HardDenyId | null {
  const text = combinedText(packet);

  if (
    /git\s+push\s+(--force|-f)\b/.test(text) &&
    RELEASE_BRANCH.test(text)
  ) {
    return "H-1";
  }

  if (
    RELEASE_BRANCH.test(text) &&
    (/git\s+(commit|push|merge)\b/.test(text) ||
      packet.action_kind === "git") &&
    !FEATURE_BRANCH.test(text)
  ) {
    return "H-2";
  }

  if (
    /drop\s+database/.test(text) ||
    /production.*purge/.test(text) ||
    /prod(uction)?\s+destructive/.test(text)
  ) {
    return "H-3";
  }

  if (
    (/akia[0-9a-z]{8,}/i.test(text) || /sk-[a-z0-9]{8,}/i.test(text)) &&
    (/git\s+add/.test(text) || /\.env/.test(text))
  ) {
    return "H-4";
  }

  if (
    !isProjectScopedMcp(text) &&
    (/~\/\.cursor\/mcp\.json/.test(text) ||
      /user-global/.test(text) ||
      /machine-level/.test(text) ||
      /platform\s+auth/.test(text))
  ) {
    return "H-5";
  }

  if (/\.\.\/|outside-repo|rm\s+-rf\s+\.\./.test(text)) {
    return "H-6";
  }

  for (const candidate of packet.hard_deny_candidates) {
    if (candidate === "H-5" && isProjectScopedMcp(text)) {
      continue;
    }
    if (candidate === "H-1" && /force/.test(text)) return "H-1";
    if (candidate === "H-2" && RELEASE_BRANCH.test(text)) return "H-2";
    if (candidate === "H-3" && /drop\s+database|purge/.test(text)) return "H-3";
    if (candidate === "H-4" && /akia|sk-/.test(text)) return "H-4";
    if (candidate === "H-5" && !isProjectScopedMcp(text)) return "H-5";
    if (candidate === "H-6" && /\.\.\//.test(text)) return "H-6";
  }

  return null;
}

function assessAxes(packet: GoalActionPacket): GoalAxes {
  const text = combinedText(packet);
  const A =
    packet.axes.A ||
    /force|drop\s+database|rm\s+-rf|production/.test(text);
  const B =
    packet.axes.B ||
    /npm\s+publish|remote|registry|push\s+origin/.test(text);
  const C = packet.axes.C;
  return { A, B, C };
}

export function evaluateSoftDecision(
  packet: GoalActionPacket,
  axes: GoalAxes,
): RuleEvaluation {
  const text = combinedText(packet);

  if (
    FEATURE_BRANCH.test(text) &&
    /git\s+commit/.test(text) &&
    !RELEASE_BRANCH.test(text)
  ) {
    return {
      hard_deny_hit: null,
      decision: "allow_with_constraints",
      axes,
      constraints: ["feature-branch-only"],
      rationale: "Commit on feature branch with branch discipline.",
    };
  }

  if (isProjectScopedMcp(text)) {
    return {
      hard_deny_hit: null,
      decision: "uncertain",
      axes: { ...axes, B: true },
      rationale: "Project-scoped MCP edit is reviewable but not global H-5.",
    };
  }

  if (!axes.C && /optional|unrelated|refactor/.test(text)) {
    return {
      hard_deny_hit: null,
      decision: "deny_suggest_alternative",
      axes,
      alternative: "Focus on the done_when path instead of optional work.",
      rationale: "Action is not required to satisfy done_when.",
    };
  }

  if (/implementing suggested alternative|follow-up alternative/.test(text)) {
    return {
      hard_deny_hit: null,
      decision: "allow",
      axes,
      rationale: "Reroute follow-up aligned with prior alternative.",
    };
  }

  if (axes.B && /npm\s+publish|dry-run|registry/.test(text)) {
    return {
      hard_deny_hit: null,
      decision: "uncertain",
      axes,
      rationale: "Remote publish path is ambiguous; record evidence before H3.",
    };
  }

  if (!axes.A && !axes.B && axes.C) {
    return {
      hard_deny_hit: null,
      decision: "allow",
      axes,
      rationale: "Local reversible work required for done_when.",
    };
  }

  if (axes.A || axes.B) {
    return {
      hard_deny_hit: null,
      decision: "uncertain",
      axes,
      rationale: "Gray-zone action needs evidence before continue.",
    };
  }

  return {
    hard_deny_hit: null,
    decision: "allow",
    axes,
    rationale: "Low-risk local action.",
  };
}

export function evaluateReviewerRules(
  packet: GoalActionPacket,
): RuleEvaluation {
  const axes = assessAxes(packet);
  const hard_deny_hit = detectHardDeny(packet);

  if (hard_deny_hit != null) {
    return {
      hard_deny_hit,
      decision: "deny_suggest_alternative",
      axes,
      alternative: `Hard deny ${hard_deny_hit}: choose a safer reroute.`,
      rationale: `Hard deny ${hard_deny_hit} blocks H3 even when C is true.`,
    };
  }

  return evaluateSoftDecision(packet, axes);
}
