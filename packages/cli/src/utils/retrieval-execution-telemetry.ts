import type { CodebaseRetrievalPlanEnvelope } from "./codebase-retrieval-router.js";

export const RG_CORROB_STATUSES = [
  "not_run",
  "none",
  "trap_only",
  "partial",
  "sufficient",
  "unknown",
] as const;

export type RgCorrobStatus = (typeof RG_CORROB_STATUSES)[number];

export const SEMANTIC_SKIP_REASONS = [
  "rg_corrob_sufficient",
  "rg_empty_semantic_required",
  "trap_only_semantic_required",
  "not_in_plan",
  "not_applicable",
  "adapter_unavailable",
  "agent_stopped_early",
  "unknown",
  "manual_not_recorded",
] as const;

export type SemanticSkipReason = (typeof SEMANTIC_SKIP_REASONS)[number];

export const SEMANTIC_OUTCOMES = [
  "success",
  "partial",
  "resource_exhausted",
  "timeout",
  "not_configured",
  "unavailable",
  "not_run",
  "unknown",
] as const;

export type SemanticOutcome = (typeof SEMANTIC_OUTCOMES)[number];

export interface RetrievalAdapterError {
  adapter: "fast-context" | string;
  outcome: Exclude<SemanticOutcome, "success" | "not_run">;
  category:
    | "resource_exhausted"
    | "timeout"
    | "not_configured"
    | "unavailable"
    | "partial"
    | "unknown";
  message?: string;
  retryable: boolean;
  fallback: Array<"exact-rg" | "codegraph" | "source-read" | string>;
}

export interface RetrievalQueryTelemetry {
  query_id: string;
  dataset: "main-50" | "semantic-slice" | string;
  query_text: string;
  run_id: string;

  // Router-owned plan facts.
  semantic_in_plan: boolean;
  semantic_order: number | null;
  fallback_hint_present: boolean;
  intents: string[];
  routes: string[];

  // Execution-owned facts. `semantic_executed` means a fast-context call was
  // actually made; it does not imply the call returned useful candidates.
  tools_called: string[];
  semantic_attempted: boolean;
  semantic_executed: boolean;
  semantic_outcome: SemanticOutcome;
  semantic_success: boolean;
  semantic_skip_reason: SemanticSkipReason | null;

  // Exact-search execution facts.
  rg_candidate_count: number | null;
  rg_corrob_status: RgCorrobStatus;
  trap_only: boolean;
  corroborated_files: string[];

  adapter_errors: RetrievalAdapterError[];

  /** Recall of expected files in the expanded candidate pool (before Top-K compression). */
  candidate_pool_recall: number | null;
  /** Recall of expected files in the final Top-K output. */
  final_top_k_recall: number | null;
}

export const RETRIEVAL_TELEMETRY_FIELD_OWNERSHIP = {
  router_plan: [
    "semantic_in_plan",
    "semantic_order",
    "fallback_hint_present",
    "intents",
    "routes",
  ],
  execution_harness: [
    "tools_called",
    "semantic_attempted",
    "semantic_executed",
    "semantic_outcome",
    "semantic_success",
    "semantic_skip_reason",
    "rg_candidate_count",
    "rg_corrob_status",
    "trap_only",
    "corroborated_files",
    "adapter_errors",
    "candidate_pool_recall",
    "final_top_k_recall",
  ],
  identity: ["query_id", "dataset", "query_text", "run_id"],
} as const;

export interface RetrievalTelemetryMetrics {
  total_queries: number;
  semantic_plan_count: number;
  semantic_exec_count: number;
  semantic_attempt_count: number;
  semantic_exec_success_count: number;
  semantic_plan_rate: number;
  semantic_exec_rate: number;
  semantic_attempt_rate: number;
  semantic_exec_success_rate: number;
  semantic_outcome_counts: Record<SemanticOutcome, number>;
  semantic_skip_reason_counts: Record<SemanticSkipReason, number>;
  avg_candidate_pool_recall: number;
  avg_final_top_k_recall: number;
  recall_drop_rate: number;
}

function emptyOutcomeCounts(): Record<SemanticOutcome, number> {
  return Object.fromEntries(SEMANTIC_OUTCOMES.map((value) => [value, 0])) as Record<
    SemanticOutcome,
    number
  >;
}

function emptySkipReasonCounts(): Record<SemanticSkipReason, number> {
  return Object.fromEntries(SEMANTIC_SKIP_REASONS.map((value) => [value, 0])) as Record<
    SemanticSkipReason,
    number
  >;
}

export function deriveRetrievalTelemetryMetrics(
  records: readonly RetrievalQueryTelemetry[],
): RetrievalTelemetryMetrics {
  const total = records.length;
  const outcomeCounts = emptyOutcomeCounts();
  const skipReasonCounts = emptySkipReasonCounts();

  let semanticPlanCount = 0;
  let semanticExecCount = 0;
  let semanticAttemptCount = 0;
  let semanticExecSuccessCount = 0;

  const candidatePoolRecalls: number[] = [];
  const finalTopKRecalls: number[] = [];

  for (const record of records) {
    if (record.semantic_in_plan) semanticPlanCount += 1;
    if (record.semantic_executed) semanticExecCount += 1;
    if (record.semantic_attempted) semanticAttemptCount += 1;
    if (record.semantic_success && record.semantic_outcome === "success") {
      semanticExecSuccessCount += 1;
    }
    outcomeCounts[record.semantic_outcome] += 1;
    if (record.semantic_skip_reason) {
      skipReasonCounts[record.semantic_skip_reason] += 1;
    }
    if (record.candidate_pool_recall !== null) {
      candidatePoolRecalls.push(record.candidate_pool_recall);
    }
    if (record.final_top_k_recall !== null) {
      finalTopKRecalls.push(record.final_top_k_recall);
    }
  }

  const rate = (count: number) => (total === 0 ? 0 : count / total);
  const avg = (values: number[]) => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);

  const avgCandidatePoolRecall = avg(candidatePoolRecalls);
  const avgFinalTopKRecall = avg(finalTopKRecalls);
  const recallDropRate = avgCandidatePoolRecall > 0 ? 1 - avgFinalTopKRecall / avgCandidatePoolRecall : 0;

  return {
    total_queries: total,
    semantic_plan_count: semanticPlanCount,
    semantic_exec_count: semanticExecCount,
    semantic_attempt_count: semanticAttemptCount,
    semantic_exec_success_count: semanticExecSuccessCount,
    semantic_plan_rate: rate(semanticPlanCount),
    semantic_exec_rate: rate(semanticExecCount),
    semantic_attempt_rate: rate(semanticAttemptCount),
    semantic_exec_success_rate: rate(semanticExecSuccessCount),
    semantic_outcome_counts: outcomeCounts,
    semantic_skip_reason_counts: skipReasonCounts,
    avg_candidate_pool_recall: avgCandidatePoolRecall,
    avg_final_top_k_recall: avgFinalTopKRecall,
    recall_drop_rate: recallDropRate,
  };
}

export const RETRIEVAL_TELEMETRY_EXAMPLES = {
  main50RgSufficientSkip: {
    query_id: "Q01",
    dataset: "main-50",
    query_text: "who calls routeCodebaseRetrieval after exact rg finds source",
    run_id: "example-main-50",
    semantic_in_plan: true,
    semantic_order: 4,
    fallback_hint_present: true,
    intents: ["exact-symbol-path", "caller-chain"],
    routes: ["exact-rg-primary", "caller-chain-ast", "semantic-fast-context"],
    tools_called: ["rg", "ReadFile"],
    semantic_attempted: false,
    semantic_executed: false,
    semantic_outcome: "not_run",
    semantic_success: false,
    semantic_skip_reason: "rg_corrob_sufficient",
    rg_candidate_count: 3,
    rg_corrob_status: "sufficient",
    trap_only: false,
    corroborated_files: ["packages/cli/src/utils/codebase-retrieval-router.ts"],
    adapter_errors: [],
    candidate_pool_recall: null,
    final_top_k_recall: null,
  },
  semanticSliceExecutedSuccess: {
    query_id: "S04",
    dataset: "semantic-slice",
    query_text: "how does retrieval policy work across modules",
    run_id: "example-semantic-slice",
    semantic_in_plan: true,
    semantic_order: 1,
    fallback_hint_present: true,
    intents: ["cross-cutting-discovery"],
    routes: ["semantic-fast-context", "exact-rg-primary"],
    tools_called: ["rg", "fast_context_search", "rg", "ReadFile"],
    semantic_attempted: true,
    semantic_executed: true,
    semantic_outcome: "success",
    semantic_success: true,
    semantic_skip_reason: null,
    rg_candidate_count: 0,
    rg_corrob_status: "none",
    trap_only: false,
    corroborated_files: [".trellis/spec/guides/retrieval-daily-guide.md"],
    adapter_errors: [],
    candidate_pool_recall: null,
    final_top_k_recall: null,
  },
  semanticSliceResourceExhausted: {
    query_id: "S08",
    dataset: "semantic-slice",
    query_text: "conceptual retrieval boundary question with quota failure",
    run_id: "example-semantic-slice",
    semantic_in_plan: true,
    semantic_order: 1,
    fallback_hint_present: true,
    intents: ["cross-cutting-discovery"],
    routes: ["semantic-fast-context", "exact-rg-primary"],
    tools_called: ["rg", "fast_context_search", "rg", "ReadFile"],
    semantic_attempted: true,
    semantic_executed: true,
    semantic_outcome: "resource_exhausted",
    semantic_success: false,
    semantic_skip_reason: null,
    rg_candidate_count: 0,
    rg_corrob_status: "none",
    trap_only: false,
    corroborated_files: [],
    adapter_errors: [
      {
        adapter: "fast-context",
        outcome: "resource_exhausted",
        category: "resource_exhausted",
        message: "fast-context provider returned resource_exhausted",
        retryable: false,
        fallback: ["exact-rg", "codegraph", "source-read"],
      },
    ],
    candidate_pool_recall: null,
    final_top_k_recall: null,
  },
} satisfies Record<string, RetrievalQueryTelemetry>;

export type SimulatedRgStatus =
  | "rg_empty"
  | "trap_only"
  | "corroborated_exact_sufficient";

export interface SimulatedRgResult {
  status: SimulatedRgStatus;
  candidateCount?: number;
  files?: string[];
}

export type O2ComplianceNextAction =
  | "invoke_semantic"
  | "continue_exact"
  | "verify_sources"
  | "stop_with_skip_reason";

export interface O2ComplianceDecision {
  next_action: O2ComplianceNextAction;
  rationale: string;
  telemetry: Pick<
    RetrievalQueryTelemetry,
    | "semantic_in_plan"
    | "fallback_hint_present"
    | "rg_candidate_count"
    | "rg_corrob_status"
    | "trap_only"
    | "corroborated_files"
    | "semantic_skip_reason"
  >;
}

function hasSemanticRoute(plan: Pick<CodebaseRetrievalPlanEnvelope, "routes">): boolean {
  return plan.routes.some(
    (route) => route.role === "semantic" || route.id === "semantic-fast-context",
  );
}

function hasSemanticFallbackHint(
  plan: Pick<CodebaseRetrievalPlanEnvelope, "fallback">,
): boolean {
  return plan.fallback.some(
    (hint) =>
      hint.replacesRole === "semantic" || /fast_context_search|semantic/i.test(hint.action),
  );
}

function rgTelemetry(result: SimulatedRgResult): Pick<
  RetrievalQueryTelemetry,
  "rg_candidate_count" | "rg_corrob_status" | "trap_only" | "corroborated_files"
> {
  if (result.status === "corroborated_exact_sufficient") {
    return {
      rg_candidate_count: result.candidateCount ?? Math.max(result.files?.length ?? 1, 1),
      rg_corrob_status: "sufficient",
      trap_only: false,
      corroborated_files: result.files ?? [],
    };
  }
  if (result.status === "trap_only") {
    return {
      rg_candidate_count: result.candidateCount ?? Math.max(result.files?.length ?? 1, 1),
      rg_corrob_status: "trap_only",
      trap_only: true,
      corroborated_files: [],
    };
  }
  return {
    rg_candidate_count: result.candidateCount ?? 0,
    rg_corrob_status: "none",
    trap_only: false,
    corroborated_files: [],
  };
}

/**
 * Lightweight RB-004 harness: the router cannot know live rg results, so this
 * function checks execution-layer behavior after a simulated rg pass.
 */
export function evaluateO2SemanticFallback(
  plan: Pick<CodebaseRetrievalPlanEnvelope, "routes" | "fallback">,
  result: SimulatedRgResult,
): O2ComplianceDecision {
  const semanticInPlan = hasSemanticRoute(plan);
  const fallbackHintPresent = hasSemanticFallbackHint(plan);
  const baseTelemetry = {
    semantic_in_plan: semanticInPlan,
    fallback_hint_present: fallbackHintPresent,
    ...rgTelemetry(result),
  };

  if (!semanticInPlan) {
    return {
      next_action: "continue_exact",
      rationale: "Semantic route is not present in the router plan.",
      telemetry: {
        ...baseTelemetry,
        semantic_skip_reason: "not_in_plan",
      },
    };
  }

  if (result.status === "corroborated_exact_sufficient") {
    return {
      next_action: "stop_with_skip_reason",
      rationale: "Corroborated exact evidence is sufficient; semantic is optional.",
      telemetry: {
        ...baseTelemetry,
        semantic_skip_reason: "rg_corrob_sufficient",
      },
    };
  }

  if (fallbackHintPresent && result.status === "trap_only") {
    return {
      next_action: "invoke_semantic",
      rationale:
        "Only trap candidates were found; execution must continue to semantic recall or equivalent trap demotion before final claims.",
      telemetry: {
        ...baseTelemetry,
        semantic_skip_reason: null,
      },
    };
  }

  if (fallbackHintPresent && result.status === "rg_empty") {
    return {
      next_action: "invoke_semantic",
      rationale:
        "No corroborated file/range candidates were found; O2 fallback requires semantic recall as the next action.",
      telemetry: {
        ...baseTelemetry,
        semantic_skip_reason: null,
      },
    };
  }

  return {
    next_action: "verify_sources",
    rationale: "Exact evidence is incomplete; continue verification before final claims.",
    telemetry: {
      ...baseTelemetry,
      semantic_skip_reason: "unknown",
    },
  };
}
