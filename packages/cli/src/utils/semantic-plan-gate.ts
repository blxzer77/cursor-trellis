import type { CodebaseRetrievalPlanEnvelope } from "./codebase-retrieval-router.js";

export function semanticProviderOrderFromEnvelope(
  plan: Pick<CodebaseRetrievalPlanEnvelope, "steps">,
): number | null {
  const step = plan.steps.find(
    (candidate) =>
      candidate.intent === "semantic" && candidate.kind === "provider-request",
  );
  return step?.order ?? null;
}

/**
 * Render a neutral reminder. The text deliberately leaves tool and Provider
 * selection to the project resolver/Adapter.
 */
export function semanticComplianceGateHint(
  plan: Pick<CodebaseRetrievalPlanEnvelope, "steps" | "minimumAssurance">,
  locale: "zh" | "en" = "zh",
): string {
  const step = plan.steps.find(
    (candidate) =>
      candidate.intent === "semantic" && candidate.kind === "provider-request",
  );
  if (!step?.providerRequirement) return "";
  const status = step.providerRequirement.status;
  if (locale === "en") {
    return (
      `**Semantic retrieval gate:** step #${step.order} requests a project-resolved ` +
      `semantic capability at minimum assurance \`${plan.minimumAssurance}\` ` +
      `(status: \`${status}\`). Treat every result as a candidate until source, Git, ` +
      "or repeatable-test corroboration succeeds."
    );
  }
  return (
    `**语义检索门控：** 第 ${step.order} 步请求由项目 Resolver 解析的语义能力，` +
    `最低 assurance 为 \`${plan.minimumAssurance}\`（状态：\`${status}\`）。` +
    "所有结果在源码、Git 或可重复测试完成佐证前都只能作为 candidate。"
  );
}
