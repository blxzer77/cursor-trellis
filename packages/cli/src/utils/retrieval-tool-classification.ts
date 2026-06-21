/** Normalize host tool names into retrieval telemetry buckets (Cursor-first). */

export interface ClassifiedToolCalls {
  tools_called: string[];
  grep_count: number;
  read_count: number;
  codegraph_attempted: boolean;
  codegraph_executed: boolean;
  semantic_attempted: boolean;
  semantic_executed: boolean;
  router_cli_invoked: boolean;
}

const CODEGRAPH_PATTERNS = [
  /^codegraph_/i,
  /^project-0-.*-codegraph-/i,
  /codegraph_search/i,
  /codegraph_explore/i,
  /codegraph_callers/i,
  /codegraph_node/i,
];

const SEMANTIC_PATTERNS = [
  /fast_context_search/i,
  /@codebase/i,
  /semantic.?search/i,
  /DEEP_SEARCH/i,
  /codebase.?search/i,
];

const GREP_PATTERNS = [/^grep$/i, /^Grep$/i, /^rg$/i, /ripgrep/i, /Instant Grep/i];

const READ_PATTERNS = [/^read$/i, /^Read$/i, /ReadFile/i, /Get-Content/i];

const ROUTER_CLI_PATTERNS = [
  /route_codebase_retrieval/i,
  /retrieval-routing/i,
];

function matchesAny(name: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(name));
}

export function classifyToolCalls(raw: readonly string[]): ClassifiedToolCalls {
  const tools_called = [...raw];
  let grep_count = 0;
  let read_count = 0;
  let codegraph_executed = false;
  let semantic_executed = false;
  let router_cli_invoked = false;

  for (const name of raw) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    if (matchesAny(trimmed, GREP_PATTERNS)) grep_count += 1;
    if (matchesAny(trimmed, READ_PATTERNS)) read_count += 1;
    if (matchesAny(trimmed, CODEGRAPH_PATTERNS)) codegraph_executed = true;
    if (matchesAny(trimmed, SEMANTIC_PATTERNS)) semantic_executed = true;
    if (matchesAny(trimmed, ROUTER_CLI_PATTERNS)) router_cli_invoked = true;
  }

  return {
    tools_called,
    grep_count,
    read_count,
    codegraph_attempted: codegraph_executed,
    codegraph_executed,
    semantic_attempted: semantic_executed,
    semantic_executed,
    router_cli_invoked,
  };
}

export function structuralRoutesInPlan(routes: readonly string[]): boolean {
  return routes.some(
    (id) =>
      id.includes("codegraph") ||
      id === "caller-chain-ast" ||
      id === "trap-demote-codegraph" ||
      id === "extension-codegraph" ||
      id === "ast-codegraph",
  );
}

export function semanticRoutesInPlan(routes: readonly string[]): boolean {
  return routes.some(
    (id) => id === "platform-semantic" || id === "semantic-fast-context",
  );
}