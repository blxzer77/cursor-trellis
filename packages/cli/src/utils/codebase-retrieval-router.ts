/**
 * Deterministic codebase retrieval intent router.
 *
 * Mirrors machine-readable rules from `codebase-retrieval` capability guidance
 * in project-capabilities.ts. Produces the parent shared evidence envelope
 * (router-owned fields only; adapterState/freshness are pass-through stubs).
 */

import {
  type CursorRetrievalEnv,
  ENV_BYOK,
  detectCursorRetrievalEnv,
  semanticRouteSpec,
} from "./cursor-retrieval-env.js";

export const CODEBASE_RETRIEVAL_ROUTER_VERSION = 2 as const;

export const MODALITY_LEXICAL = "lexical" as const;
export const MODALITY_STRUCTURAL = "structural" as const;
export const MODALITY_SEMANTIC = "semantic" as const;

export const TOKEN_ECONOMY_HIGH = "high" as const;
export const TOKEN_ECONOMY_MEDIUM = "medium" as const;
export const TOKEN_ECONOMY_LOW = "low" as const;

export type CodebaseRetrievalIntentId =
  | "exact-symbol-path"
  | "policy-document"
  | "caller-chain"
  | "trap-package-disambiguation"
  | "extension-shared-symbol"
  | "env-config-literal"
  | "protocol-platform-preserve"
  | "cross-cutting-discovery";

export type RetrievalAdapterRole =
  | "exact"
  | "ast"
  | "lsp"
  | "semantic"
  | "verification";

export interface CodebaseRetrievalIntent {
  id: CodebaseRetrievalIntentId;
  label: string;
  confidence: "high" | "medium" | "low";
  signals: string[];
  /** When true, intent-gated branches must not reorder exact-symbol primary routes. */
  preserveExactPrimary: boolean;
}

export interface CodebaseRetrievalRoute {
  order: number;
  id: string;
  role: RetrievalAdapterRole;
  sourceFamily: string;
  commands: string[];
  rationale: string;
  intentIds: CodebaseRetrievalIntentId[];
  tokenEconomy?: "high" | "medium" | "low";
  platformNative?: boolean;
  semanticBackend?: "fast-context-mcp" | "cursor-builtin";
}

export interface CodebaseRetrievalFallbackHint {
  when: string;
  action: string;
  replacesRole?: RetrievalAdapterRole;
}

export interface CodebaseRetrievalVerificationStep {
  id: string;
  requirement: string;
  appliesToRoles: RetrievalAdapterRole[];
}

/** Parent shared envelope (router fills owned slices; adapter slices default empty). */
export interface CodebaseRetrievalPlanEnvelope {
  version: typeof CODEBASE_RETRIEVAL_ROUTER_VERSION;
  query: string;
  intents: CodebaseRetrievalIntent[];
  routes: CodebaseRetrievalRoute[];
  adapterState: [];
  freshness: [];
  fallback: CodebaseRetrievalFallbackHint[];
  warnings: string[];
  verification: CodebaseRetrievalVerificationStep[];
  projectFileCount: number | null;
  cursorEnv?: CursorRetrievalEnv;
}

export interface RouteCodebaseRetrievalInput {
  query: string;
  /** When false, optional adapter routes are omitted from the ordered plan. */
  codebaseRetrievalSelected?: boolean;
  projectFileCount?: number | null;
  /** `native` | `byok` | `unknown`; defaults to detectCursorRetrievalEnv(). */
  cursorEnv?: CursorRetrievalEnv;
}

export function emptyCodebaseRetrievalPlan(
  query = "",
  projectFileCount: number | null = null,
): CodebaseRetrievalPlanEnvelope {
  return {
    version: CODEBASE_RETRIEVAL_ROUTER_VERSION,
    query,
    intents: [],
    routes: [],
    adapterState: [],
    freshness: [],
    fallback: [],
    warnings: [],
    verification: [],
    projectFileCount,
  };
}

const POLICY_SIGNALS: readonly RegExp[] = [
  /\bstorage\s+policy\b/i,
  /\bsidecar\b/i,
  /\bsqlite\s+only\b/i,
  /\bpersistence\b/i,
  /\bimport\s+boundar/i,
  /\btransport[- ]only\b/i,
  /\barchitecture\b/i,
  /\bconvention(s)?\b/i,
  /\bforbidden\b/i,
  /\ballowed\b/i,
  /\bwhere\s+is\s+\w+\s+defined\b/i,
  /\bwho\s+owns\b/i,
  /\bwho\s+is\s+responsible\s+for\b/i,
  /\bwhich\s+module\s+handles\b/i,
  /\bwhich\s+package\s+is\s+responsible\b/i,
  /\ballowed\s+in\b/i,
  /\bforbidden\s+in\b/i,
  /\brestricted\s+to\b/i,
  /\bmust\s+not\b/i,
  /\bshould\s+not\b/i,
  /\bboundary\s+between\b/i,
  /\bboundary\s+of\b/i,
  /\bcode\s+boundary\b/i,
  /\bmodule\s+boundary\b/i,
  /\bpackage\s+boundary\b/i,
  /规定/,
  /边界/,
  /为什么不能/,
  /\bAGENTS\.md\b/i,
  /\bpolicy\b/i,
  /\bownership\b/i,
  /\bresponsibilit(y|ies)\b/i,
  /不能/,
  /规则/,
];

const CONCEPTUAL_SIGNALS: readonly RegExp[] = [
  /\bhow\s+does\b/i,
  /\bacross\s+(packages|modules)\b/i,
  /\bwhere\s+is\b.*\b(handled|implemented)\b/i,
  /\bdifference\s+between\b/i,
  /\boverall\s+design\b/i,
  /如何/,
  /机制/,
  /跨/,
  /为什么/,
  /原理/,
  /区别/,
];

const PRESERVE_SIGNALS: readonly RegExp[] = [
  /\bapps\/(ios|android)\b/i,
  /\bgateway-protocol\b/i,
  /\bpackages\/gateway-protocol\b/i,
  /\.swift\b/i,
  /\.kt\b/i,
  /\bschema\b/i,
  /\bcontract\b/i,
  /\bprotocol\s+constant\b/i,
];

const CALLER_CHAIN_SIGNALS: readonly RegExp[] = [
  /\bwho\s+calls\b/i,
  /\bwhich\s+modules?\s+invoke\b/i,
  /\bcall\s*sites?\b/i,
  /\bcaller(s)?\b/i,
  /\bwired\b/i,
  /\bdelegate(s|d)?\b/i,
  /\bassembly\b/i,
  /\bdependents\b/i,
  /\busages?\s+of\b/i,
  /谁调用/,
  /调用链/,
  /影响面/,
  /被哪些/,
  /哪些地方/,
  /哪里用到/,
];

const TRAP_SIGNALS: readonly RegExp[] = [
  /\bpackages\/[a-z0-9-]+\b/i,
  /\bsrc\/agents\b/i,
  /\btrap\b/i,
  /\bdifferent\s+package\b/i,
  /\blayer\b/i,
  /\boverlay\b/i,
  /\bcore\s+library\b/i,
];

const EXTENSION_SIGNALS: readonly RegExp[] = [
  /\bextensions\/\b/i,
  /\bextension\s+id\b/i,
  /\bshared\s+symbol\b/i,
  /\bacross\s+extensions\b/i,
];

const ENV_LITERAL_SIGNALS: readonly RegExp[] = [
  /\bOPENCLAW_[A-Z0-9_]+\b/,
  /\be2e\b/i,
  /\bbench(mark)?\b/i,
  /\benv\s+var/i,
  /\benvironment\s+variable\b/i,
  /\bstartup\s+script\b/i,
];

const EXACT_SYMBOL_SIGNALS: readonly RegExp[] = [
  /\b[A-Z][a-zA-Z0-9]+(?:[A-Z][a-zA-Z0-9]+)+\b/,
  /\b[a-z][a-zA-Z0-9]+(?:[A-Z][a-zA-Z0-9]+)+\b/,
  /`[^`]+`/,
  /\b[\w.-]+\.(ts|tsx|js|jsx|py|rs|go|swift|kt|md|json|yaml|yml)\b/i,
  /\b(?:src|packages|extensions)\/[\w./-]+/i,
];

function normalizeQuery(query: string): string {
  return query.replace(/\s+/g, " ").trim();
}

function matchAny(patterns: readonly RegExp[], text: string): string[] {
  const hits: string[] = [];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      hits.push(match[0]);
    }
  }
  return hits;
}

function intentConfidence(
  hitCount: number,
  strong: boolean,
): "high" | "medium" | "low" {
  if (strong && hitCount >= 2) return "high";
  if (hitCount >= 2) return "medium";
  if (hitCount === 1) return strong ? "medium" : "low";
  return "low";
}

function buildIntent(
  id: CodebaseRetrievalIntentId,
  label: string,
  signals: string[],
  confidence: "high" | "medium" | "low",
  preserveExactPrimary: boolean,
): CodebaseRetrievalIntent {
  return {
    id,
    label,
    confidence,
    signals: [...new Set(signals)].slice(0, 12),
    preserveExactPrimary,
  };
}

function baseVerification(): CodebaseRetrievalVerificationStep[] {
  return [
    {
      id: "source-read",
      requirement:
        "Read current source around candidate file ranges before final claims.",
      appliesToRoles: ["exact", "ast", "lsp", "semantic"],
    },
    {
      id: "git-scope",
      requirement:
        "Inspect relevant Git diff/log evidence when behavior or impact is claimed.",
      appliesToRoles: ["verification"],
    },
    {
      id: "focused-tests",
      requirement:
        "Run task-appropriate validation when tests define the claim boundary.",
      appliesToRoles: ["verification"],
    },
  ];
}

function policyVerification(): CodebaseRetrievalVerificationStep[] {
  return [
    {
      id: "policy-doc-top1",
      requirement:
        "For policy/document intents, confirm Top-1 policy evidence from AGENTS.md or .trellis/spec before ranking implementation modules first.",
      appliesToRoles: ["exact", "semantic"],
    },
    {
      id: "agents-neighborhood",
      requirement:
        "Read AGENTS.md neighborhood: root AGENTS.md, nested **/AGENTS.md, and package-level policy files before searching implementation modules.",
      appliesToRoles: ["exact", "semantic"],
    },
    ...baseVerification(),
  ];
}

function callerVerification(): CodebaseRetrievalVerificationStep[] {
  return [
    {
      id: "caller-sites",
      requirement:
        "Confirm codegraph-caller results cover the call chain, then verify " +
        "dynamic dispatch points (callbacks, event handlers, DI registrations) " +
        "that codegraph may not resolve statically.",
      appliesToRoles: ["exact", "ast"],
    },
    ...baseVerification(),
  ];
}

function trapVerification(): CodebaseRetrievalVerificationStep[] {
  return [
    {
      id: "trap-package-check",
      requirement:
        "When multiple same-named symbols exist across packages, confirm the " +
        "codegraph result belongs to the correct package by checking the file's " +
        "package root or AGENTS.md scope before ranking.",
      appliesToRoles: ["ast", "exact"],
    },
    ...baseVerification(),
  ];
}

function extensionVerification(): CodebaseRetrievalVerificationStep[] {
  return [
    {
      id: "extension-scope-check",
      requirement:
        "Confirm the symbol definition lives inside the target extension " +
        "directory, not in a shared core module with the same name.",
      appliesToRoles: ["ast", "exact"],
    },
    ...baseVerification(),
  ];
}

function tokenEconomyForRoute(routeId: string): "high" | "medium" | "low" {
  const highEconomyRoutes: ReadonlySet<string> = new Set([
    "caller-chain-ast",
    "trap-demote-codegraph",
    "extension-codegraph",
    "ast-codegraph",
    "platform-semantic",
  ]);
  if (highEconomyRoutes.has(routeId)) {
    return TOKEN_ECONOMY_HIGH;
  }
  return TOKEN_ECONOMY_MEDIUM;
}

function largeProject(projectFileCount: number | null): boolean {
  if (projectFileCount === null) return false;
  return projectFileCount > 2000;
}

function platformSemanticRoute(
  baseRationale: string,
  cursorEnv: CursorRetrievalEnv,
): Omit<
  CodebaseRetrievalRoute,
  "order" | "intentIds" | "tokenEconomy"
> {
  const spec = semanticRouteSpec(cursorEnv);
  return {
    id: "platform-semantic",
    role: "semantic",
    sourceFamily: "platform-semantic",
    commands: spec.commands,
    rationale: baseRationale + spec.rationaleSuffix,
    platformNative: spec.platformNative,
    semanticBackend: spec.semanticBackend,
  };
}

function orderedRoutesForIntents(
  intents: CodebaseRetrievalIntent[],
  includeOptionalAdapters: boolean,
  projectFileCount: number | null = null,
  cursorEnv: CursorRetrievalEnv = detectCursorRetrievalEnv(),
): CodebaseRetrievalRoute[] {
  const ids = new Set(intents.map((item) => item.id));
  const preserve = ids.has("protocol-platform-preserve");
  const policy = ids.has("policy-document");
  const caller = ids.has("caller-chain");
  const trap = ids.has("trap-package-disambiguation");
  const extension = ids.has("extension-shared-symbol");
  const env = ids.has("env-config-literal");
  const exact = ids.has("exact-symbol-path");
  const conceptual = ids.has("cross-cutting-discovery");

  const activeIntentIds = [...ids] as CodebaseRetrievalIntentId[];
  const isLarge = largeProject(projectFileCount);
  let semanticPromoted = false;

  const routes: CodebaseRetrievalRoute[] = [];

  function append(route: Omit<CodebaseRetrievalRoute, "order" | "intentIds" | "tokenEconomy" | "platformNative"> & { platformNative?: boolean }): void {
    routes.push({
      ...route,
      order: routes.length + 1,
      intentIds: activeIntentIds,
      tokenEconomy: tokenEconomyForRoute(route.id),
      platformNative: route.platformNative ?? false,
    });
  }

  // ── Structural-first intents: caller, trap, extension ──
  if (caller) {
    append({
      id: "caller-chain-ast",
      role: "ast",
      sourceFamily: "codegraph",
      commands: ["codegraph callers <symbol> --path <path> --json"],
      rationale: "Caller-chain intent: codegraph for precise call edges first.",
    });
    append({
      id: "caller-rg-followup",
      role: "exact",
      sourceFamily: "rg",
      commands: ["rg <symbol> --glob '*.ts'"],
      rationale: "Caller-chain intent: rg follow-up for dynamic callsites codegraph may miss.",
    });
  }

  if (trap && !preserve) {
    append({
      id: "trap-demote-codegraph",
      role: "ast",
      sourceFamily: "codegraph",
      commands: ["codegraph search <symbol> --path <path> --json"],
      rationale: "Trap intent: codegraph distinguishes same-named symbols across packages.",
    });
    append({
      id: "trap-demote-rg",
      role: "exact",
      sourceFamily: "rg",
      commands: ["rg <symbol> packages/<name>/", "rg <symbol> src/"],
      rationale: "Trap intent: rg follow-up across package boundaries.",
    });
  }

  if (extension && !preserve) {
    append({
      id: "extension-codegraph",
      role: "ast",
      sourceFamily: "codegraph",
      commands: ["codegraph search <symbol> --path <path> --json"],
      rationale: "Extension intent: codegraph finds cross-extension symbol definitions.",
    });
    append({
      id: "extension-rg",
      role: "exact",
      sourceFamily: "rg",
      commands: ["rg <symbol> extensions/"],
      rationale: "Extension intent: rg follow-up for extension directory.",
    });
  }

  // ── Lexical-first intents: exact, policy, preserve, env ──
  const exactPrimaryFirst = preserve || exact;
  const conceptualPrimary = conceptual && !preserve && !exactPrimaryFirst;

  if (conceptualPrimary) {
    if (policy) {
      append({
        id: "policy-docs-rg",
        role: "exact",
        sourceFamily: "policy-docs",
        commands: [
          'rg -i "storage default|sidecar|sqlite only" AGENTS.md "**/AGENTS.md" README.md CONTRIBUTING.md .trellis/spec',
        ],
        rationale: "Policy/document intent: search instruction and spec docs first.",
      });
    }
    const semanticRationale = policy
      ? "Policy plus conceptual intent: semantic recall after policy docs, before exact rg follow-up."
      : "Conceptual query without exact signals; semantic recall before exact rg narrowing.";
    append(platformSemanticRoute(semanticRationale, cursorEnv));
    semanticPromoted = true;
    append({
      id: "exact-rg-primary",
      role: "exact",
      sourceFamily: "rg",
      commands: ["rg <pattern> <path>"],
      rationale: "Exact rg follow-up after semantic recall (or policy docs) narrows candidate files and symbols.",
    });
  } else if (policy && !preserve && !exactPrimaryFirst) {
    append({
      id: "policy-docs-rg",
      role: "exact",
      sourceFamily: "policy-docs",
      commands: [
        'rg -i "storage default|sidecar|sqlite only" AGENTS.md "**/AGENTS.md" README.md CONTRIBUTING.md .trellis/spec',
      ],
      rationale: "Policy/document intent: search instruction and spec docs first.",
    });
    append({
      id: "exact-rg-primary",
      role: "exact",
      sourceFamily: "rg",
      commands: ["rg <pattern> <path>"],
      rationale: "Exact rg after policy doc pass when no symbol/path intent is present.",
    });
  } else if (exactPrimaryFirst) {
    append({
      id: "exact-rg-primary",
      role: "exact",
      sourceFamily: "rg",
      commands: ["rg <pattern> <path>"],
      rationale: "Exact identifiers and paths stay primary.",
    });
    if (policy && !preserve) {
      append({
        id: "policy-docs-rg",
        role: "exact",
        sourceFamily: "policy-docs",
        commands: [
          'rg -i "storage default|sidecar|sqlite only" AGENTS.md "**/AGENTS.md" README.md CONTRIBUTING.md .trellis/spec',
        ],
        rationale: "Policy/document branch after exact-primary when both intents match.",
      });
    }
  }

  if (env && !preserve) {
    append({
      id: "env-scripts-rg",
      role: "exact",
      sourceFamily: "rg",
      commands: ["rg <env-prefix> scripts test e2e bench"],
      rationale: "Env/config literals: scripts and test trees before src/ modules.",
    });
  }

  if (!routes.some((r) => r.id === "exact-rg-primary")) {
    append({
      id: "exact-rg-primary",
      role: "exact",
      sourceFamily: "rg",
      commands: ["rg <pattern> <path>"],
      rationale: "Baseline exact search.",
    });
  }

  // ── Optional adapters ──
  if (includeOptionalAdapters) {
    if (!routes.some((r) => r.id === "caller-chain-ast")) {
      const cgRationale = isLarge
        ? "Structural search first on large codebase for token efficiency."
        : "Structural expansion after exact candidates.";
      append({
        id: "ast-codegraph",
        role: "ast",
        sourceFamily: "codegraph",
        commands: [
          "codegraph query <symbol-or-search> --path <path> --json",
          "codegraph callers <symbol> --path <path> --json",
        ],
        rationale: cgRationale,
      });
    }
    append({
      id: "lsp-navigation",
      role: "ast",
      sourceFamily: "codegraph",
      commands: [
        "codegraph_node <symbol> --includeCode",
        "codegraph_search <symbol>",
      ],
      rationale:
        "Definition/reference via codegraph (Cursor Agent does not expose " +
        "GO_TO_DEFINITION); corroborate with Read on returned line ranges.",
      platformNative: false,
    });
    if (!semanticPromoted) {
      append(
        platformSemanticRoute(
          "Semantic recall for conceptual narrowing.",
          cursorEnv,
        ),
      );
    }
  }

  append({
    id: "verification-source-git-tests",
    role: "verification",
    sourceFamily: "source-git-tests",
    commands: ["git diff -- <path>", "Get-Content <file>"],
    rationale: "Required proof layer for verified claims.",
  });

  // Large project: reorder so structural (ast) routes precede others
  if (isLarge) {
    const structural = routes.filter((r) => r.role === "ast");
    const others = routes.filter((r) => r.role !== "ast");
    const reordered = [...structural, ...others];
    return reordered.map((route, index) => ({ ...route, order: index + 1 }));
  }

  return routes
    .sort((a, b) => a.order - b.order)
    .map((route, index) => ({ ...route, order: index + 1 }));
}

function classifyIntents(query: string): CodebaseRetrievalIntent[] {
  const intents: CodebaseRetrievalIntent[] = [];

  const preserveHits = matchAny(PRESERVE_SIGNALS, query);
  if (preserveHits.length > 0) {
    intents.push(
      buildIntent(
        "protocol-platform-preserve",
        "Protocol / platform preserve (F/G)",
        preserveHits,
        intentConfidence(preserveHits.length, true),
        true,
      ),
    );
  }

  const exactHits = matchAny(EXACT_SYMBOL_SIGNALS, query);
  if (exactHits.length > 0) {
    intents.push(
      buildIntent(
        "exact-symbol-path",
        "Exact symbol or path",
        exactHits,
        intentConfidence(exactHits.length, true),
        true,
      ),
    );
  }

  const policyHits = matchAny(POLICY_SIGNALS, query);
  if (policyHits.length > 0) {
    intents.push(
      buildIntent(
        "policy-document",
        "Policy and document-first (C-class)",
        policyHits,
        intentConfidence(policyHits.length, false),
        false,
      ),
    );
  }

  const callerHits = matchAny(CALLER_CHAIN_SIGNALS, query);
  if (callerHits.length > 0) {
    intents.push(
      buildIntent(
        "caller-chain",
        "Caller and assembly chain (B-class)",
        callerHits,
        intentConfidence(callerHits.length, false),
        false,
      ),
    );
  }

  const trapHits = matchAny(TRAP_SIGNALS, query);
  if (trapHits.length > 0) {
    intents.push(
      buildIntent(
        "trap-package-disambiguation",
        "Trap demotion and package boundary (E-class)",
        trapHits,
        intentConfidence(trapHits.length, false),
        false,
      ),
    );
  }

  const extensionHits = matchAny(EXTENSION_SIGNALS, query);
  if (extensionHits.length > 0) {
    intents.push(
      buildIntent(
        "extension-shared-symbol",
        "Extension shared-symbol disambiguation (A-class)",
        extensionHits,
        intentConfidence(extensionHits.length, false),
        false,
      ),
    );
  }

  const envHits = matchAny(ENV_LITERAL_SIGNALS, query);
  if (envHits.length > 0) {
    intents.push(
      buildIntent(
        "env-config-literal",
        "Environment and config literals (D-class)",
        envHits,
        intentConfidence(envHits.length, false),
        false,
      ),
    );
  }

  if (exactHits.length === 0 && preserveHits.length === 0) {
    const conceptualHits = matchAny(CONCEPTUAL_SIGNALS, query);
    if (conceptualHits.length > 0) {
      intents.push(
        buildIntent(
          "cross-cutting-discovery",
          "Conceptual / cross-cutting discovery",
          conceptualHits,
          intentConfidence(conceptualHits.length, false),
          false,
        ),
      );
    }
  }

  if (intents.length === 0) {
    intents.push(
      buildIntent(
        "exact-symbol-path",
        "General codebase (exact baseline)",
        ["default-exact-baseline"],
        "low",
        true,
      ),
    );
  }

  const seen = new Set<CodebaseRetrievalIntentId>();
  return intents.filter((intent) => {
    if (seen.has(intent.id)) return false;
    seen.add(intent.id);
    return true;
  });
}

function buildFallbackHints(
  intents: CodebaseRetrievalIntent[],
  includeOptionalAdapters: boolean,
  routes: CodebaseRetrievalRoute[],
  cursorEnv: CursorRetrievalEnv = detectCursorRetrievalEnv(),
): CodebaseRetrievalFallbackHint[] {
  const hints: CodebaseRetrievalFallbackHint[] = [
    {
      when: "rg missing on PATH",
      action:
        "Codebase retrieval readiness fails; install or expose rg before claiming readiness.",
    },
  ];
  if (!includeOptionalAdapters) {
    hints.push({
      when: "codebase-retrieval not selected",
      action:
        "Skip optional AST/LSP/semantic routes; continue with exact search and verification only.",
      replacesRole: "semantic",
    });
  }
  if (cursorEnv === ENV_BYOK) {
    hints.push({
      when: "built-in @codebase / SemanticSearch not in agent tool list",
      action:
        "Use fast_context_search (fast-context MCP) per platform-semantic route; " +
        "do not use WebSearch for codebase questions.",
      replacesRole: "semantic",
    });
    hints.push({
      when: "DEEP_SEARCH not available for wide cross-cutting explore",
      action:
        "Use Task subagent (explore), then Grep/codegraph/Read to verify.",
      replacesRole: "semantic",
    });
  }
  if (intents.some((i) => i.id === "policy-document")) {
    hints.push({
      when: "semantic Top-1 is implementation-only for policy query",
      action:
        "Fall back to policy-doc rg route and AGENTS.md/.trellis/spec reads before accepting semantic ranking.",
      replacesRole: "semantic",
    });
  }
  const semanticRoute = routes.find((r) => r.role === "semantic");
  const hasConceptual = intents.some((i) => i.id === "cross-cutting-discovery");
  const exactPrimary = intents.some(
    (i) => i.id === "exact-symbol-path" && i.preserveExactPrimary,
  );
  if (
    includeOptionalAdapters &&
    semanticRoute &&
    (hasConceptual || semanticRoute.order >= 3 || exactPrimary)
  ) {
    hints.push({
      when:
        "exact rg returns no corroborated file/range candidates (or only trap hits) before final Top-1",
      action:
        "Use fast_context_search (BYOK) or Cursor built-in semantic search (Native) " +
        "per platform-semantic route, then narrow with rg on returned keywords and paths.",
      replacesRole: "semantic",
    });
  }
  return hints;
}

function buildWarnings(
  intents: CodebaseRetrievalIntent[],
): string[] {
  const warnings: string[] = [];
  const low = intents.filter((i) => i.confidence === "low");
  if (low.length > 0) {
    warnings.push(
      `Low-confidence intent classification for: ${low.map((i) => i.id).join(", ")}.`,
    );
  }
  const hasPolicy = intents.some((i) => i.id === "policy-document");
  const hasPreserve = intents.some((i) => i.id === "protocol-platform-preserve");
  if (hasPolicy && hasPreserve) {
    warnings.push(
      "Both policy-document and protocol-platform-preserve detected; preserve route keeps exact-symbol primary.",
    );
  }
  const hasConceptual = intents.some((i) => i.id === "cross-cutting-discovery");
  const hasExactIntent = intents.some((i) => i.id === "exact-symbol-path");
  if (
    hasConceptual &&
    !hasExactIntent &&
    !intents.some((i) => i.id === "protocol-platform-preserve")
  ) {
    const semanticHint = "platform-semantic";
    warnings.push(
      `Conceptual intent without exact signals; ${semanticHint} route promoted in plan. Convert semantic hits to exact rg follow-ups before final claims.`,
    );
  }
  return warnings;
}

function verificationForIntents(
  intents: CodebaseRetrievalIntent[],
): CodebaseRetrievalVerificationStep[] {
  if (intents.some((i) => i.id === "policy-document")) {
    return policyVerification();
  }
  if (intents.some((i) => i.id === "caller-chain")) {
    return callerVerification();
  }
  if (intents.some((i) => i.id === "trap-package-disambiguation")) {
    return trapVerification();
  }
  if (intents.some((i) => i.id === "extension-shared-symbol")) {
    return extensionVerification();
  }
  return baseVerification();
}

/**
 * Build a deterministic retrieval plan envelope for a natural-language query.
 */
export function routeCodebaseRetrieval(
  input: RouteCodebaseRetrievalInput,
): CodebaseRetrievalPlanEnvelope {
  const query = normalizeQuery(input.query);
  const includeOptionalAdapters = input.codebaseRetrievalSelected !== false;
  const projectFileCount = input.projectFileCount ?? null;
  const cursorEnv = input.cursorEnv ?? detectCursorRetrievalEnv();

  if (!query) {
    const emptyIntent = buildIntent(
      "exact-symbol-path",
      "General codebase (exact baseline)",
      ["empty-query"],
      "low",
      true,
    );
    const emptyRoutes = orderedRoutesForIntents(
      [emptyIntent],
      includeOptionalAdapters,
      projectFileCount,
      cursorEnv,
    );
    return {
      version: CODEBASE_RETRIEVAL_ROUTER_VERSION,
      query,
      cursorEnv,
      intents: [emptyIntent],
      routes: emptyRoutes,
      adapterState: [],
      freshness: [],
      fallback: buildFallbackHints(
        [emptyIntent],
        includeOptionalAdapters,
        emptyRoutes,
        cursorEnv,
      ),
      warnings: ["Empty query; only baseline exact route is emitted."],
      verification: baseVerification(),
      projectFileCount,
    };
  }

  const intents = classifyIntents(query);
  const routes = orderedRoutesForIntents(
    intents,
    includeOptionalAdapters,
    projectFileCount,
    cursorEnv,
  );
  return {
    version: CODEBASE_RETRIEVAL_ROUTER_VERSION,
    query,
    cursorEnv,
    intents,
    routes,
    adapterState: [],
    freshness: [],
    fallback: buildFallbackHints(
      intents,
      includeOptionalAdapters,
      routes,
      cursorEnv,
    ),
    warnings: buildWarnings(intents),
    verification: verificationForIntents(intents),
    projectFileCount,
  };
}