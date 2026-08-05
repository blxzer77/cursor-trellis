import type { GoalRunMode } from "./constants.js";

export interface PreflightProposal {
  ok: true;
  doneWhen: string[];
  evidenceHow: string;
  mode: GoalRunMode;
  modeNotice: string;
}

export interface PreflightRejection {
  ok: false;
  reason: string;
}

export type PreflightResult = PreflightProposal | PreflightRejection;

const VAGUE_GOAL = /^(do it|fix|help|something|todo)$/i;

export function detectRunMode(opts: {
  forceWindow?: boolean;
  runnerAvailable?: boolean;
}): GoalRunMode {
  if (opts.forceWindow) return "window";
  if (opts.runnerAvailable === false) return "window";
  return "runner";
}

export function modeNotice(mode: GoalRunMode): string {
  if (mode === "window") {
    return (
      "**窗内模式：** 关闭本聊天窗口将立即停止 goal 运行。默认墙钟上限 **45 分钟**。" +
      "长跑请使用 CLI runner（`cstl goal run`）。"
    );
  }
  return (
    "**Runner 模式：** goal 由后台 runner 调度 subagent（`@cursor/sdk`，需当前进程配置 `CURSOR_API_KEY`），" +
    "主窗可用于查看状态与接手。默认墙钟上限 **3 小时**。无密钥时请使用 `--mock-worker` 或窗内模式。"
  );
}

export function proposePreflight(
  goalText: string,
  mode: GoalRunMode,
): PreflightResult {
  const trimmed = goalText.trim();
  if (trimmed.length < 8 || VAGUE_GOAL.test(trimmed)) {
    return {
      ok: false,
      reason:
        "Goal too vague — write a concrete objective (cannot derive done_when).",
    };
  }

  const doneWhen = deriveDoneWhen(trimmed);
  if (doneWhen.length === 0) {
    return {
      ok: false,
      reason: "Cannot derive 1–3 observable done_when items — refine the goal.",
    };
  }

  const evidenceHow = deriveEvidenceHow(trimmed, doneWhen);
  if (!evidenceHow.trim()) {
    return {
      ok: false,
      reason: "Cannot derive evidence_how — specify how completion will be proven.",
    };
  }

  return {
    ok: true,
    doneWhen,
    evidenceHow,
    mode,
    modeNotice: modeNotice(mode),
  };
}

function deriveDoneWhen(goalText: string): string[] {
  const sentences = goalText
    .split(/[.;。\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 6);

  if (sentences.length >= 2) {
    return sentences.slice(0, 3).map((s) => `When: ${s}`);
  }

  return [
    `When: ${goalText.trim()} is implemented and verifiable`,
    "When: focused tests or validation commands for touched behavior pass",
  ].slice(0, 3);
}

function deriveEvidenceHow(goalText: string, doneWhen: string[]): string {
  const lower = goalText.toLowerCase();
  const parts: string[] = [];
  if (/test|vitest|pytest/.test(lower)) {
    parts.push("Run focused test suite; capture pass output in verify.md");
  } else if (/doc|readme|markdown/.test(lower)) {
    parts.push("Link or cite updated markdown paths in verify.md");
  } else {
    parts.push("Run validation commands listed in implement.md; capture output");
  }
  parts.push(`Map each done_when item: ${doneWhen.join(" | ")}`);
  return parts.join("; ");
}

export function renderContractMarkdown(proposal: PreflightProposal, goalText: string): string {
  const items = proposal.doneWhen.map((d, i) => `${i + 1}. ${d}`).join("\n");
  return [
    "# cstl-goal contract",
    "",
    "## Goal",
    goalText.trim(),
    "",
    "## done_when",
    items,
    "",
    "## evidence_how",
    proposal.evidenceHow,
    "",
    "## mode",
    proposal.mode,
    "",
    "## mode_notice",
    proposal.modeNotice,
    "",
  ].join("\n");
}
