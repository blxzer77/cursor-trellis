/**
 * REC-11: post-plan hints when platform-semantic is first-class in the router envelope.
 * Mirrors templates/trellis/scripts/common/semantic_plan_gate.py
 */

import {
  type CursorRetrievalEnv,
  ENV_UNKNOWN,
  detectCursorRetrievalEnv,
  isByokConservative,
} from "./cursor-retrieval-env.js";
import type { CodebaseRetrievalPlanEnvelope } from "./codebase-retrieval-router.js";

export function platformSemanticOrderFromEnvelope(
  plan: CodebaseRetrievalPlanEnvelope,
): number | null {
  for (const route of plan.routes) {
    if (route.id === "platform-semantic") {
      return route.order;
    }
  }
  return null;
}

export function semanticComplianceGateHint(
  plan: CodebaseRetrievalPlanEnvelope,
  locale = "zh",
): string {
  const order = platformSemanticOrderFromEnvelope(plan);
  if (order === null || order > 2) return "";
  if (!plan.routes.some((r) => r.id === "platform-semantic")) return "";

  const cursorEnv: CursorRetrievalEnv =
    plan.cursorEnv ?? detectCursorRetrievalEnv();

  if (isByokConservative(cursorEnv)) {
    const unknownNote =
      cursorEnv === ENV_UNKNOWN
        ? " Unknown cursorEnv — conservative BYOK gate."
        : "";
    if (locale !== "zh") {
      return (
        `**Plan gate (REC-11, BYOK):** \`platform-semantic\` is step #${order}. ` +
        "Before Top-1 you MUST run one **fast_context_search** (fast-context MCP). " +
        "Do not use WebSearch for codebase questions. Corroborate hits with Read." +
        unknownNote
      );
    }
    const label =
      cursorEnv === ENV_UNKNOWN
        ? "**计划门控（REC-11，未知 env 保守 BYOK）：**"
        : "**计划门控（REC-11，BYOK）：**";
    return (
      `${label} 本问 \`platform-semantic\` 为第 ${order} 步。` +
      "定 Top-1 前 **必须** 执行 1 次 **fast_context_search**（fast-context MCP）；" +
      "**禁止** 用 WebSearch 答代码库问题。命中路径后须 **Read** 验证。"
    );
  }

  if (locale !== "zh") {
    return (
      `**Plan gate (REC-11):** \`platform-semantic\` is step #${order}. ` +
      "Before Top-1 you MUST run one Cursor built-in codebase semantic search and log the exact tool name. " +
      "Do not use fast-context MCP. For **SemanticSearch**, always pass **`target_directories`** (`[]` = whole workspace, or directory globs when scoped). " +
      "Corroborate semantic hits with Read (verified layer)."
    );
  }
  return (
    `**计划门控（REC-11）：** 本问 \`platform-semantic\` 为第 ${order} 步。` +
    "定 Top-1 前 **必须** 执行 1 次 Cursor **内置代码库语义搜索**，并在记录中写下宿主工具名；" +
    "**禁止** fast-context MCP。若工具为 **SemanticSearch**，须传 **`target_directories`**（`[]` 全库，或已知子目录 glob 收窄）。" +
    "语义命中路径后须 **Read** 验证候选片段（verified 层）。"
  );
}