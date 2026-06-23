/**
 * Render codebase retrieval plan envelopes as agent-executable instructions.
 * Mirrors templates/trellis/scripts/common/retrieval_agent_instructions.py
 */

import {
  type CodebaseRetrievalPlanEnvelope,
  type CodebaseRetrievalRoute,
} from "./codebase-retrieval-router.js";
import {
  ENV_BYOK,
  detectCursorRetrievalEnv,
} from "./cursor-retrieval-env.js";
import { semanticComplianceGateHint } from "./semantic-plan-gate.js";

const SYMBOL_CANDIDATE =
  /\b([A-Za-z_][\w$]{2,})\b|`([^`]+)`|「([^」]+)」/g;

const SKIP_SYMBOLS = new Set(
  [
    "openclaw",
    "which",
    "where",
    "what",
    "who",
    "how",
    "list",
    "give",
    "tell",
    "define",
    "defined",
    "calls",
    "call",
    "invoke",
    "invoked",
    "file",
    "files",
    "module",
    "modules",
    "package",
    "packages",
    "extension",
    "extensions",
    "src",
    "the",
    "and",
    "for",
    "with",
    "from",
    "that",
    "this",
    "agents",
    "readme",
    "cursor",
  ].map((s) => s.toLowerCase()),
);

function symbolRank(candidate: string): number {
  if (/[a-z][A-Z]|[A-Z][a-z]/.test(candidate)) return 3;
  if (/[_$]/.test(candidate)) return 2;
  if (candidate.length >= 10) return 1;
  return 0;
}

export function guessSymbolFromQuery(query: string): string | null {
  const text = query.trim();
  if (!text) return null;
  let best: { rank: number; symbol: string } | null = null;
  for (const match of text.matchAll(SYMBOL_CANDIDATE)) {
    const candidate = match[1] ?? match[2] ?? match[3];
    if (!candidate) continue;
    if (candidate.includes("/")) continue;
    if (candidate.includes(".") && candidate.split(".").length > 3) continue;
    if (SKIP_SYMBOLS.has(candidate.toLowerCase())) continue;
    if (candidate.length < 4) continue;
    const rank = symbolRank(candidate);
    if (
      !best ||
      rank > best.rank ||
      (rank === best.rank && candidate.length > best.symbol.length)
    ) {
      best = { rank, symbol: candidate };
    }
  }
  return best?.symbol ?? null;
}

function intentSummary(
  intents: CodebaseRetrievalPlanEnvelope["intents"],
): string {
  if (!intents.length) return "（未分类，按默认精确检索）";
  return intents
    .slice(0, 4)
    .map((item) =>
      item.confidence ? `${item.id}（${item.confidence}）` : item.id,
    )
    .join("、");
}

function stepForRoute(
  route: CodebaseRetrievalRoute,
  symbol: string,
  query: string,
  cursorEnv: string,
): string | null {
  const { role, id: routeId } = route;

  if (role === "verification") return null;

  if (routeId === "caller-chain-ast" || (role === "ast" && routeId.includes("caller"))) {
    return `使用 **codegraph_callers**，符号 \`${symbol}\`，列出调用链；再补 codegraph_explore 若需跨文件流。`;
  }
  if (routeId.startsWith("trap-demote") && role === "ast") {
    return `使用 **codegraph_search** / **codegraph_explore**，消歧同名符号 \`${symbol}\`（跨 package trap）。`;
  }
  if (routeId.startsWith("extension") && role === "ast") {
    return `使用 **codegraph_search**，路径侧重 \`extensions/\`，符号 \`${symbol}\`。`;
  }
  if (role === "ast" || routeId === "ast-codegraph") {
    return `使用 **codegraph_explore** 或 **codegraph_node**（\`includeCode=true\`），围绕 \`${symbol}\` 或问题：${query.slice(0, 120)}`;
  }

  if (routeId === "lsp-navigation") {
    return (
      `使用 **codegraph_node**（\`includeCode=true\`）或 **codegraph_search** 定位 \`${symbol}\` ` +
      "的定义/引用（Agent 无 GO_TO_DEFINITION）；再用 **Read** 验证行号与正文。"
    );
  }

  if (
    routeId === "platform-semantic" ||
    (role === "semantic" && route.sourceFamily === "platform-semantic")
  ) {
    const backend = route.semanticBackend ?? "";
    if (cursorEnv === ENV_BYOK || backend === "fast-context-mcp") {
      return (
        "使用 **fast_context_search**（fast-context MCP）做概念/代码库语义检索；" +
        "**不要**假设 @codebase 或内置 SemanticSearch 可用；**不要**用 WebSearch 答代码库问题。"
      );
    }
    return (
      "使用 Cursor **内置代码库语义搜索**（宿主工具常为 **SemanticSearch**；" +
      "**`target_directories`** 为目录 glob 数组，省略会报错；**`[]`** = 不缩范围、搜全工作区索引；" +
      "若计划或 Grep/codegraph 已指向子树可传如 `['Trellis/packages/cli']`；" +
      "无路径线索的概念题优先 **`[]`**；Native 下 **不要**用 fast-context MCP 顶替）。"
    );
  }
  if (role === "semantic") {
    if (cursorEnv === ENV_BYOK) {
      return "使用 **fast_context_search**（fast-context MCP）；勿用 WebSearch 答代码库问题。";
    }
    return "使用 Cursor **内置代码库语义搜索**（不要用 fast-context MCP）。";
  }

  if (routeId === "policy-docs-rg" || route.sourceFamily === "policy-docs") {
    return "使用 **Grep** 在 `AGENTS.md`、`**/AGENTS.md`、`.trellis/spec`、`README.md` 中搜索策略/边界关键词。";
  }

  if (role === "exact" || routeId.includes("rg")) {
    return `使用 **Grep**（Instant Grep）搜索字面量/路径；优先与 \`${symbol}\` 或用户给出的路径相关模式。`;
  }

  if (routeId === "cross-cutting-discovery" || routeId.toLowerCase().includes("deep")) {
    if (cursorEnv === ENV_BYOK) {
      return "复杂跨模块探索：使用 **Task** 子代理（explore），再用 Grep/codegraph/Read 验证。";
    }
    return "复杂跨模块探索：可选用 **DEEP_SEARCH** 或 Explore 子任务，再用 Grep/codegraph 验证。";
  }

  return `按路由 \`${routeId}\`（${role}）执行，再 Read 源码确认。`;
}

export interface RenderAgentInstructionsOptions {
  locale?: string;
}

export function renderAgentInstructions(
  plan: CodebaseRetrievalPlanEnvelope,
  options: RenderAgentInstructionsOptions = {},
): string {
  const locale = options.locale ?? "zh";
  const query = plan.query ?? "";
  const symbol = guessSymbolFromQuery(query) ?? "<symbol>";
  const cursorEnv = plan.cursorEnv ?? detectCursorRetrievalEnv();

  const header =
    locale === "zh"
      ? "## 代码库检索计划"
      : "## Codebase retrieval plan";

  const lines: string[] = [
    header,
    `问题：${query || "（空）"}`,
    `意图：${intentSummary(plan.intents)}`,
    `检索环境（cursorEnv）：${cursorEnv}`,
    "",
  ];

  let step = 0;
  const sortedRoutes = [...plan.routes].sort((a, b) => a.order - b.order);
  for (const route of sortedRoutes) {
    const text = stepForRoute(route, symbol, query, cursorEnv);
    if (!text) continue;
    step += 1;
    lines.push(`${step}. ${text}`);
  }

  if (step === 0) {
    step += 1;
    lines.push(`${step}. 使用 **Grep** 搜索关键词，再 **Read** 打开候选文件验证。`);
  }

  if (plan.fallback.length > 0) {
    lines.push("", "**降级**：");
    for (const hint of plan.fallback.slice(0, 3)) {
      if (hint.when && hint.action) {
        lines.push(`- 当 ${hint.when} → ${hint.action}`);
      }
    }
  }

  if (plan.verification.length > 0) {
    lines.push("", "**验证**（下结论前）：");
    for (const ver of plan.verification.slice(0, 4)) {
      if (ver.requirement) lines.push(`- ${ver.requirement}`);
    }
  }

  lines.push(
    "",
    "**codegraph 独用场景**：调用链、跨包 trap、extension 符号、影响面、定义/引用定位；" +
      "纯字面搜索用 Grep（勿用 GO_TO_DEFINITION，Agent 未暴露）。",
  );

  if (plan.routes.some((r) => r.id === "platform-semantic")) {
    lines.push("");
    if (cursorEnv === ENV_BYOK) {
      lines.push(
        "**语义合规（Cursor++ BYOK）：**",
        "- 本计划含 **platform-semantic** 时：定 Top-1 前至少 **1 次** **fast_context_search**（fast-context MCP），并记录工具名。",
      );
    } else {
      lines.push(
        "**语义合规（Cursor Native）：**",
        "- 本计划含 **platform-semantic** 时：定 Top-1 前至少执行 **1 次** Cursor **内置代码库语义搜索**（不要用 fast-context MCP）。",
        "- 在 run 记录中写下宿主返回的**真实工具名**（如 SemanticSearch、codebase_search、@codebase），供 semantic_exec 统计。",
        "- 若工具为 **SemanticSearch**：**必须提供** **`target_directories`**；**`[]`** = 全库；已知子目录时用 glob 收窄（勿省略该字段）。",
      );
    }
  }

  const gateHint = semanticComplianceGateHint(plan, locale);
  if (gateHint) {
    lines.push("", gateHint);
  }

  const rankingHint = resultLayerRankingHint(
    plan.intents.map((i) => i.id),
    locale,
  );
  if (rankingHint) {
    lines.push("", rankingHint.trimEnd());
  }

  return `${lines.join("\n").trim()}\n`;
}

function resultLayerRankingHint(
  intentIds: readonly string[],
  locale: string,
): string {
  const lines: string[] = [];
  const zh = locale === "zh";
  if (
    !intentIds.includes("caller-chain") &&
    !intentIds.includes("trap-package-disambiguation") &&
    !intentIds.includes("env-config-literal")
  ) {
    return "";
  }
  lines.push(
    zh
      ? "**结果层排序（定 Top-1 / Top-5 前）：**"
      : "**Result-layer ranking (before Top-1 / Top-5):**",
  );
  if (intentIds.includes("caller-chain")) {
    lines.push(
      zh
        ? "- 调用链：先扩大候选池（codegraph callers + rg），具体调用点优先于 facade/barrel/runtime/registry 等装配文件。"
        : "- Caller-chain: keep an expanded pool; prefer concrete call sites over assembly-only files.",
    );
  }
  if (intentIds.includes("trap-package-disambiguation")) {
    lines.push(
      zh
        ? "- 干扰项：压低 snapshot/registry/overlay 与跨包同名；除非 Read 确认就是所问层级。"
        : "- Trap: demote snapshot/registry overlays unless Read confirms the asked layer.",
    );
  }
  if (intentIds.includes("env-config-literal")) {
    lines.push(
      zh
        ? "- 环境变量/配置字面量：优先 scripts/e2e/bench/test 等路径，低于泛化 src/auth/paths 实现文件。"
        : "- Env literals: prefer scripts/e2e/bench/test paths over generic src/auth/paths.",
    );
  }
  return `${lines.join("\n")}\n`;
}

export function attachAgentInstructions(
  plan: CodebaseRetrievalPlanEnvelope,
  options: RenderAgentInstructionsOptions = {},
): CodebaseRetrievalPlanEnvelope & { agentInstructions: string } {
  return {
    ...plan,
    agentInstructions: renderAgentInstructions(plan, options),
  };
}
