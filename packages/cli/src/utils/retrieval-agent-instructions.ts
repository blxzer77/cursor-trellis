import type {
  CodebaseRetrievalPlanEnvelope,
  CodebaseRetrievalIntentId,
} from "./codebase-retrieval-router.js";
import { semanticComplianceGateHint } from "./semantic-plan-gate.js";

const SYMBOL_CANDIDATE = /(?:`([^`]+)`|\b([A-Za-z_$][A-Za-z0-9_$]{2,})\b)/g;
const SKIP_SYMBOLS = new Set([
  "where",
  "which",
  "what",
  "when",
  "how",
  "does",
  "find",
  "show",
  "source",
  "exact",
]);

export function guessSymbolFromQuery(query: string): string | null {
  const matches = [...query.matchAll(SYMBOL_CANDIDATE)];
  for (const match of matches) {
    const candidate = (match[1] ?? match[2] ?? "").trim();
    if (candidate && !SKIP_SYMBOLS.has(candidate.toLowerCase()))
      return candidate;
  }
  return null;
}

function intentLabel(
  intent: CodebaseRetrievalIntentId,
  locale: "zh" | "en",
): string {
  if (locale === "en") return intent;
  switch (intent) {
    case "exact":
      return "精确";
    case "semantic":
      return "语义";
    case "structural":
      return "结构";
    case "external":
      return "外部";
  }
}

function stepInstruction(
  plan: CodebaseRetrievalPlanEnvelope,
  index: number,
  locale: "zh" | "en",
): string {
  const step = plan.steps[index];
  if (step.kind === "local-exact") {
    const symbol = guessSymbolFromQuery(plan.query);
    if (locale === "en") {
      return symbol
        ? `Use \`rg\` for the exact candidate \`${symbol}\` within the declared scope hints.`
        : "Use `rg` for bounded local text, path, or symbol candidates within the declared scope hints.";
    }
    return symbol
      ? `在声明的 scope hints 内用 \`rg\` 精确定位候选 \`${symbol}\`。`
      : "在声明的 scope hints 内用 `rg` 做有界的本地文本、路径或符号定位。";
  }
  const requirement = step.providerRequirement;
  if (!requirement) {
    return locale === "en"
      ? "Stop because the Provider requirement is missing."
      : "Provider requirement 缺失，停止执行。";
  }
  if (locale === "en") {
    return (
      `Request the \`${step.intent}\` intent from the project resolver with minimum assurance ` +
      `\`${requirement.minimumAssurance}\` and status \`${requirement.status}\`. ` +
      "Do not infer or choose an implementation in the planner."
    );
  }
  return (
    `向项目 Resolver 请求 \`${step.intent}\` intent，最低 assurance 为 ` +
    `\`${requirement.minimumAssurance}\`，当前状态为 \`${requirement.status}\`。` +
    "不得在 Planner 或说明文本中推断、选择具体实现。"
  );
}

export interface RenderAgentInstructionsOptions {
  readonly locale?: "zh" | "en";
}

export function renderAgentInstructions(
  plan: CodebaseRetrievalPlanEnvelope,
  options: RenderAgentInstructionsOptions | "zh" | "en" = {},
): string {
  const locale =
    typeof options === "string" ? options : (options.locale ?? "zh");
  const lines: string[] = [];
  if (locale === "en") {
    lines.push(
      `Retrieval plan V${plan.schemaVersion}`,
      `Intents: ${plan.intents.map((intent) => intentLabel(intent, locale)).join(", ")}`,
      `Minimum assurance: ${plan.minimumAssurance}`,
      "",
    );
  } else {
    lines.push(
      `检索计划 V${plan.schemaVersion}`,
      `意图：${plan.intents.map((intent) => intentLabel(intent, locale)).join("、")}`,
      `最低 assurance：${plan.minimumAssurance}`,
      "",
    );
  }
  for (let index = 0; index < plan.steps.length; index += 1) {
    lines.push(`${index + 1}. ${stepInstruction(plan, index, locale)}`);
  }
  lines.push(
    "",
    locale === "en"
      ? "Verification: candidate -> corroborate with source/Git/repeatable tests -> classify evidence -> check assurance -> accept or stop."
      : "验证链：candidate → 源码/Git/可重复测试佐证 → Evidence 分类 → assurance 检查 → 接受或停止。",
  );
  const semanticGate = semanticComplianceGateHint(plan, locale);
  if (semanticGate) lines.push("", semanticGate);
  if (plan.stopReasons.length > 0) {
    lines.push(
      "",
      locale === "en"
        ? `Blocking reasons: ${plan.stopReasons.map((reason) => reason.code).join(", ")}`
        : `阻断原因：${plan.stopReasons.map((reason) => reason.code).join("、")}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function attachAgentInstructions(
  plan: CodebaseRetrievalPlanEnvelope,
  options: RenderAgentInstructionsOptions | "zh" | "en" = {},
): CodebaseRetrievalPlanEnvelope & { readonly agentInstructions: string } {
  return {
    ...plan,
    agentInstructions: renderAgentInstructions(plan, options),
  };
}
