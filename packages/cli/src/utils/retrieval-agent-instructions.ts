/**
 * Render codebase retrieval plan envelopes as agent-executable instructions.
 * Mirrors templates/trellis/scripts/common/retrieval_agent_instructions.py
 */

import {
  PLATFORM_CURSOR,
  type CodebaseRetrievalPlanEnvelope,
  type CodebaseRetrievalRoute,
} from "./codebase-retrieval-router.js";

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

function cursorStepForRoute(
  route: CodebaseRetrievalRoute,
  symbol: string,
  query: string,
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

  if (
    routeId === "platform-semantic" ||
    (role === "semantic" && route.sourceFamily === "platform-semantic")
  ) {
    return "使用 Cursor **内置代码库语义搜索**（Agent 语义搜索能力，等同 @codebase 语义索引；**不要**使用 fast-context MCP）。";
  }
  if (role === "semantic") {
    return "使用 **fast_context_search**（非 Cursor 平台语义路由）；若在 Cursor 上应改用内置语义搜索。";
  }

  if (routeId === "lsp-navigation" || role === "lsp") {
    return `对候选定义使用 **GO_TO_DEFINITION** / 查找引用，核对 \`${symbol}\` 的真实定义与引用。`;
  }

  if (routeId === "policy-docs-rg" || route.sourceFamily === "policy-docs") {
    return "使用 **Grep** 在 `AGENTS.md`、`**/AGENTS.md`、`.trellis/spec`、`README.md` 中搜索策略/边界关键词。";
  }

  if (role === "exact" || routeId.includes("rg")) {
    return `使用 **Grep**（Instant Grep）搜索字面量/路径；优先与 \`${symbol}\` 或用户给出的路径相关模式。`;
  }

  if (routeId === "cross-cutting-discovery" || routeId.toLowerCase().includes("deep")) {
    return "复杂跨模块探索：可选用 **DEEP_SEARCH** 或 Explore 子任务，再用 Grep/codegraph 验证。";
  }

  return `按路由 \`${routeId}\`（${role}）执行，再 Read 源码确认。`;
}

function genericStepForRoute(
  route: CodebaseRetrievalRoute,
  symbol: string,
  query: string,
): string | null {
  if (route.role === "verification") return null;
  const cmdHint = route.commands[0]?.slice(0, 160) ?? "";
  return `执行路由 \`${route.id}\`（${route.role}）：${cmdHint || query.slice(0, 80)}`;
}

export interface RenderAgentInstructionsOptions {
  platform?: string;
  locale?: string;
}

export function renderAgentInstructions(
  plan: CodebaseRetrievalPlanEnvelope,
  options: RenderAgentInstructionsOptions = {},
): string {
  const platform = options.platform ?? plan.platform ?? PLATFORM_CURSOR;
  const locale = options.locale ?? "zh";
  const query = plan.query ?? "";
  const symbol = guessSymbolFromQuery(query) ?? "<symbol>";
  const useCursor = platform === PLATFORM_CURSOR;

  const header =
    locale === "zh"
      ? `## 代码库检索计划（${platform}）`
      : `## Codebase retrieval plan (${platform})`;

  const lines: string[] = [
    header,
    `问题：${query || "（空）"}`,
    `意图：${intentSummary(plan.intents)}`,
    "",
  ];

  let step = 0;
  const sortedRoutes = [...plan.routes].sort((a, b) => a.order - b.order);
  for (const route of sortedRoutes) {
    const text = useCursor
      ? cursorStepForRoute(route, symbol, query)
      : genericStepForRoute(route, symbol, query);
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

  if (useCursor) {
    lines.push(
      "",
      "**codegraph 独用场景**：调用链、跨包 trap、extension 符号、影响面；纯字面搜索用 Grep，单点定义用 GO_TO_DEFINITION。",
    );
  }

  return `${lines.join("\n").trim()}\n`;
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