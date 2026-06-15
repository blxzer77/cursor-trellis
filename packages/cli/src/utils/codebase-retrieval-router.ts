/**
 * Deterministic codebase retrieval intent router.
 *
 * Mirrors machine-readable rules from `codebase-retrieval` capability guidance
 * in project-capabilities.ts. Produces the parent shared evidence envelope
 * (router-owned fields only; adapterState/freshness are pass-through stubs).
 */

export const CODEBASE_RETRIEVAL_ROUTER_VERSION = 1 as const;

export type CodebaseRetrievalIntentId =
  | "exact-symbol-path"
  | "policy-document"
  | "caller-chain"
  | "trap-package-disambiguation"
  | "extension-shared-symbol"
  | "env-config-literal"
  | "protocol-platform-preserve";

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
}

export interface RouteCodebaseRetrievalInput {
  query: string;
  /** When false, optional adapter routes are omitted from the ordered plan. */
  codebaseRetrievalSelected?: boolean;
}

export function emptyCodebaseRetrievalPlan(
  query = "",
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
  /规定/,
  /边界/,
  /为什么不能/,
  /\bAGENTS\.md\b/i,
  /\bpolicy\b/i,
  /\bownership\b/i,
  /\bresponsibilit(y|ies)\b/i,
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
  /谁调用/,
  /调用链/,
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
    ...baseVerification(),
  ];
}

function callerVerification(): CodebaseRetrievalVerificationStep[] {
  return [
    {
      id: "caller-sites",
      requirement:
        "Collect concrete call sites (codegraph callers with raised limit or rg references) before treating a helper/loader file as sufficient Top-1.",
      appliesToRoles: ["exact", "ast"],
    },
    ...baseVerification(),
  ];
}

function routeExactPrimary(intentIds: CodebaseRetrievalIntentId[]): CodebaseRetrievalRoute {
  return {
    order: 1,
    id: "exact-rg-primary",
    role: "exact",
    sourceFamily: "rg",
    commands: ["rg <pattern> <path>"],
    rationale:
      "Exact identifiers, literals, paths, and protocol constants stay primary; corroborate with direct reads.",
    intentIds,
  };
}

function routePolicyDocs(intentIds: CodebaseRetrievalIntentId[]): CodebaseRetrievalRoute {
  return {
    order: 2,
    id: "policy-docs-rg",
    role: "exact",
    sourceFamily: "policy-docs",
    commands: [
      'rg -i "storage default|sidecar|sqlite only" AGENTS.md "**/AGENTS.md" README.md CONTRIBUTING.md .trellis/spec',
    ],
    rationale:
      "Policy/document intent: search instruction and spec docs before implementation modules.",
    intentIds,
  };
}

function routeAst(intentIds: CodebaseRetrievalIntentId[], order: number): CodebaseRetrievalRoute {
  return {
    order,
    id: "ast-codegraph",
    role: "ast",
    sourceFamily: "codegraph",
    commands: [
      "codegraph query <symbol-or-search> --path <path> --json",
      "codegraph callers <symbol> --path <path> --json",
      "codegraph callees <symbol> --path <path> --json",
    ],
    rationale:
      "Structural expansion after exact candidates exist; graph output remains candidate until freshness and source checks.",
    intentIds,
  };
}

function routeSemantic(intentIds: CodebaseRetrievalIntentId[], order: number): CodebaseRetrievalRoute {
  return {
    order,
    id: "semantic-fast-context",
    role: "semantic",
    sourceFamily: "fast-context",
    commands: ["fast_context_search query=<question> project_path=<root>"],
    rationale:
      "Semantic recall last on policy/env/extension-heavy queries; convert hits to exact rg follow-ups.",
    intentIds,
  };
}

function routeVerification(intentIds: CodebaseRetrievalIntentId[], order: number): CodebaseRetrievalRoute {
  return {
    order,
    id: "verification-source-git-tests",
    role: "verification",
    sourceFamily: "source-git-tests",
    commands: ["git diff -- <path>", "Get-Content <file>"],
    rationale: "Required proof layer for verified claims.",
    intentIds,
  };
}

function orderedRoutesForIntents(
  intents: CodebaseRetrievalIntent[],
  includeOptionalAdapters: boolean,
): CodebaseRetrievalRoute[] {
  const ids = new Set(intents.map((item) => item.id));
  const preserve = ids.has("protocol-platform-preserve");
  const policy = ids.has("policy-document");
  const caller = ids.has("caller-chain");
  const trap = ids.has("trap-package-disambiguation");
  const extension = ids.has("extension-shared-symbol");
  const env = ids.has("env-config-literal");
  const exact = ids.has("exact-symbol-path");

  const activeIntentIds = [...ids];
  const routes: CodebaseRetrievalRoute[] = [];
  const exactPrimaryFirst = preserve || exact;

  if (policy && !preserve && !exactPrimaryFirst) {
    routes.push({ ...routePolicyDocs(activeIntentIds), order: 1 });
    routes.push({
      ...routeExactPrimary(activeIntentIds),
      order: 2,
      rationale:
        "Exact rg on narrowed paths after policy doc pass when no named symbol/path intent is present.",
    });
  } else if (exactPrimaryFirst) {
    routes.push(routeExactPrimary(activeIntentIds));
    if (policy && !preserve) {
      routes.push({
        ...routePolicyDocs(activeIntentIds),
        order: routes.length + 1,
      });
    }
  }

  if (env && !preserve) {
    routes.push({
      order: routes.length + 1,
      id: "env-scripts-rg",
      role: "exact",
      sourceFamily: "rg",
      commands: ["rg <env-prefix> scripts test e2e bench"],
      rationale:
        "Env/config literal intent: search scripts and test trees before src/ auth/runtime modules.",
      intentIds: activeIntentIds,
    });
  }

  if (extension && !preserve) {
    routes.push({
      order: routes.length + 1,
      id: "extension-rg",
      role: "exact",
      sourceFamily: "rg",
      commands: ["rg <symbol> extensions/"],
      rationale:
        "Extension disambiguation: list extension hits and filter by extension id before global semantic explore.",
      intentIds: activeIntentIds,
    });
  }

  if (trap && !preserve) {
    routes.push({
      order: routes.length + 1,
      id: "trap-demote-rg",
      role: "exact",
      sourceFamily: "rg",
      commands: ["rg <symbol> packages/<name>/", "rg <symbol> src/"],
      rationale:
        "Trap demotion: prefer named package paths and demote similarly named agent glue until exports confirm.",
      intentIds: activeIntentIds,
    });
  }

  if (caller) {
    routes.push({
      order: routes.length + 1,
      id: "caller-chain-ast",
      role: "ast",
      sourceFamily: "codegraph",
      commands: [
        "codegraph callers <symbol> --path <path> --json",
        "rg <symbol> --glob '*.ts'",
      ],
      rationale:
        "Caller-chain intent: prioritize concrete call sites over facade/loader definition files.",
      intentIds: activeIntentIds,
    });
  }

  if (!routes.some((r) => r.id === "exact-rg-primary")) {
    routes.push(routeExactPrimary(activeIntentIds));
  }

  if (includeOptionalAdapters) {
    routes.push(routeAst(activeIntentIds, routes.length + 1));
    routes.push({
      order: routes.length + 2,
      id: "lsp-navigation",
      role: "lsp",
      sourceFamily: "language-server",
      commands: ["definition", "references", "hover"],
      rationale:
        "LSP navigation after candidate symbols/files exist; not a broad first pass.",
      intentIds: activeIntentIds,
    });
    const semanticOrder = routes.length + 1;
    routes.push(routeSemantic(activeIntentIds, semanticOrder));
  }

  routes.push(routeVerification(activeIntentIds, routes.length + 1));

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
  if (intents.some((i) => i.id === "policy-document")) {
    hints.push({
      when: "semantic Top-1 is implementation-only for policy query",
      action:
        "Fall back to policy-doc rg route and AGENTS.md/.trellis/spec reads before accepting semantic ranking.",
      replacesRole: "semantic",
    });
  }
  return hints;
}

function buildWarnings(intents: CodebaseRetrievalIntent[]): string[] {
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

  if (!query) {
    const empty = emptyCodebaseRetrievalPlan(query);
    empty.warnings.push("Empty query; only baseline exact route is emitted.");
    empty.routes = orderedRoutesForIntents(
      [
        buildIntent(
          "exact-symbol-path",
          "General codebase (exact baseline)",
          ["empty-query"],
          "low",
          true,
        ),
      ],
      includeOptionalAdapters,
    );
    empty.verification = baseVerification();
    return empty;
  }

  const intents = classifyIntents(query);
  return {
    version: CODEBASE_RETRIEVAL_ROUTER_VERSION,
    query,
    intents,
    routes: orderedRoutesForIntents(intents, includeOptionalAdapters),
    adapterState: [],
    freshness: [],
    fallback: buildFallbackHints(intents, includeOptionalAdapters),
    warnings: buildWarnings(intents),
    verification: verificationForIntents(intents),
  };
}