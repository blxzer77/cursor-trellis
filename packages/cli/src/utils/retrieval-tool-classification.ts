/** Normalize host tool names into retrieval telemetry buckets (Cursor-first). */

export interface ClassifiedToolCalls {
  tools_called: string[];
  grep_count: number;
  read_count: number;
  codegraph_attempted: boolean;
  codegraph_executed: boolean;
  semantic_attempted: boolean;
  /** True when a platform-appropriate semantic tool fired (see classify options). */
  semantic_executed: boolean;
  router_cli_invoked: boolean;
  /** Cursor: built-in semantic only (excludes fast-context MCP). */
  platform_semantic_executed?: boolean;
  /** Count of fast_context_search / fast-context MCP invocations. */
  fast_context_count?: number;
  /** Cursor platform: fast-context used while semantic route is platform-native (misuse signal). */
  cursor_fast_context_misuse?: boolean;
}

export interface ClassifyToolCallsOptions {
  /** When `cursor`, semantic_exec counts platform-native tools only; fast-context is tracked separately. */
  platform?: string;
  /** `native` | `byok` — BYOK counts fast-context as semantic exec, not misuse. */
  cursor_env?: string;
}

const CODEGRAPH_PATTERNS = [
  /^codegraph_/i,
  /^project-0-.*-codegraph-/i,
  /codegraph_search/i,
  /codegraph_explore/i,
  /codegraph_callers/i,
  /codegraph_node/i,
];

/** Cursor built-in / host semantic (REC-06). Not fast-context MCP. */
const PLATFORM_SEMANTIC_PATTERNS = [
  /@codebase/i,
  /semantic.?search/i,
  /DEEP_SEARCH/i,
  /codebase.?search/i,
  /SemanticSearch/i,
  /Instant Search/i,
  /Cursor.*semantic/i,
  /built-?in.*codebase/i,
];

const FAST_CONTEXT_PATTERNS = [
  /fast_context_search/i,
  /fast-context/i,
  /fast_context/i,
];

/** Legacy: any semantic signal including fast-context (non-cursor aggregate). */
const LEGACY_SEMANTIC_PATTERNS = [
  ...FAST_CONTEXT_PATTERNS,
  ...PLATFORM_SEMANTIC_PATTERNS,
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

export function isPlatformSemanticToolName(name: string): boolean {
  return matchesAny(name.trim(), PLATFORM_SEMANTIC_PATTERNS);
}

export function isFastContextToolName(name: string): boolean {
  return matchesAny(name.trim(), FAST_CONTEXT_PATTERNS);
}

export function classifyToolCalls(
  raw: readonly string[],
  options: ClassifyToolCallsOptions = {},
): ClassifiedToolCalls {
  const platform = (options.platform ?? "cursor").toLowerCase();
  const cursorEnv = (options.cursor_env ?? "").trim().toLowerCase();
  const tools_called = [...raw];
  let grep_count = 0;
  let read_count = 0;
  let codegraph_executed = false;
  let semantic_executed = false;
  let router_cli_invoked = false;
  let platform_semantic_executed = false;
  let fast_context_count = 0;

  for (const name of raw) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    if (matchesAny(trimmed, GREP_PATTERNS)) grep_count += 1;
    if (matchesAny(trimmed, READ_PATTERNS)) read_count += 1;
    if (matchesAny(trimmed, CODEGRAPH_PATTERNS)) codegraph_executed = true;
    if (matchesAny(trimmed, ROUTER_CLI_PATTERNS)) router_cli_invoked = true;
    if (isFastContextToolName(trimmed)) fast_context_count += 1;
    if (isPlatformSemanticToolName(trimmed)) platform_semantic_executed = true;
  }

  if (platform === "cursor") {
    if (cursorEnv === "byok") {
      semantic_executed =
        platform_semantic_executed || fast_context_count > 0;
    } else {
      semantic_executed = platform_semantic_executed;
    }
  } else {
    semantic_executed =
      platform_semantic_executed || fast_context_count > 0 ||
      raw.some((n) => matchesAny(n.trim(), LEGACY_SEMANTIC_PATTERNS));
  }

  const semantic_attempted = semantic_executed || fast_context_count > 0;

  const out: ClassifiedToolCalls = {
    tools_called,
    grep_count,
    read_count,
    codegraph_attempted: codegraph_executed,
    codegraph_executed,
    semantic_attempted,
    semantic_executed,
    router_cli_invoked,
    platform_semantic_executed,
    fast_context_count,
  };

  if (platform === "cursor") {
    out.cursor_fast_context_misuse =
      fast_context_count > 0 && cursorEnv !== "byok";
  }

  return out;
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

export function platformSemanticRouteOrder(routes: readonly { id: string; order: number }[]): number | null {
  const hit = routes.find((r) => r.id === "platform-semantic");
  return hit?.order ?? null;
}