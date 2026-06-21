import type { CodebaseRetrievalPlanEnvelope } from "./codebase-retrieval-router.js";
import {
  classifyToolCalls,
  semanticRoutesInPlan,
  structuralRoutesInPlan,
} from "./retrieval-tool-classification.js";

export const RETRIEVAL_TELEMETRY_SCHEMA_VERSION = 2 as const;

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
  fallback: ("exact-rg" | "codegraph" | "source-read" | string)[];
}

export interface RetrievalQueryTelemetry {
  schema_version: typeof RETRIEVAL_TELEMETRY_SCHEMA_VERSION;
  query_id: string;
  dataset: "main-50" | "semantic-slice" | string;
  query_text: string;
  run_id: string;
  platform: string;

  // Router-owned plan facts.
  semantic_in_plan: boolean;
  semantic_order: number | null;
  structural_in_plan: boolean;
  codegraph_in_plan: boolean;
  fallback_hint_present: boolean;
  intents: string[];
  routes: string[];
  routes_in_plan: string[];
  project_file_count: number | null;

  // Execution-owned facts (Cursor: semantic/codegraph from classifyToolCalls).
  tools_called: string[];
  grep_count: number;
  read_count: number;
  codegraph_attempted: boolean;
  codegraph_executed: boolean;
  router_cli_invoked: boolean;
  plan_block_in_prompt: boolean;
  read_verification_done: boolean;
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

  candidate_pool_recall: number | null;
  final_top_k_recall: number | null;

  answer_score: number | null;
  compliance_score: number | null;
}

export const RETRIEVAL_TELEMETRY_FIELD_OWNERSHIP = {
  router_plan: [
    "platform",
    "semantic_in_plan",
    "semantic_order",
    "structural_in_plan",
    "codegraph_in_plan",
    "fallback_hint_present",
    "intents",
    "routes",
    "routes_in_plan",
    "project_file_count",
  ],
  execution_harness: [
    "tools_called",
    "grep_count",
    "read_count",
    "codegraph_attempted",
    "codegraph_executed",
    "router_cli_invoked",
    "plan_block_in_prompt",
    "read_verification_done",
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
    "answer_score",
    "compliance_score",
  ],
  identity: [
    "schema_version",
    "query_id",
    "dataset",
    "query_text",
    "run_id",
  ],
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
  codegraph_plan_count: number;
  codegraph_exec_count: number;
  codegraph_plan_rate: number;
  codegraph_exec_rate: number;
  router_cli_count: number;
  router_cli_rate: number;
  plan_block_count: number;
  plan_block_rate: number;
  read_verification_count: number;
  read_verification_rate: number;
  avg_compliance_score: number;
  avg_answer_score: number;
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
  let codegraphPlanCount = 0;
  let codegraphExecCount = 0;
  let routerCliCount = 0;
  let planBlockCount = 0;
  let readVerificationCount = 0;

  const candidatePoolRecalls: number[] = [];
  const finalTopKRecalls: number[] = [];
  const complianceScores: number[] = [];
  const answerScores: number[] = [];

  for (const record of records) {
    if (record.semantic_in_plan) semanticPlanCount += 1;
    if (record.semantic_executed) semanticExecCount += 1;
    if (record.semantic_attempted) semanticAttemptCount += 1;
    if (record.codegraph_in_plan) codegraphPlanCount += 1;
    if (record.codegraph_executed) codegraphExecCount += 1;
    if (record.router_cli_invoked) routerCliCount += 1;
    if (record.plan_block_in_prompt) planBlockCount += 1;
    if (record.read_verification_done) readVerificationCount += 1;
    if (record.semantic_success && record.semantic_outcome === "success") {
      semanticExecSuccessCount += 1;
    }
    if (record.compliance_score !== null) {
      complianceScores.push(record.compliance_score);
    }
    if (record.answer_score !== null) {
      answerScores.push(record.answer_score);
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

  const rate = (count: number): number => (total === 0 ? 0 : count / total);
  const avg = (values: number[]): number => (values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length);

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
    codegraph_plan_count: codegraphPlanCount,
    codegraph_exec_count: codegraphExecCount,
    codegraph_plan_rate: rate(codegraphPlanCount),
    codegraph_exec_rate: rate(codegraphExecCount),
    router_cli_count: routerCliCount,
    router_cli_rate: rate(routerCliCount),
    plan_block_count: planBlockCount,
    plan_block_rate: rate(planBlockCount),
    read_verification_count: readVerificationCount,
    read_verification_rate: rate(readVerificationCount),
    avg_compliance_score: avg(complianceScores),
    avg_answer_score: avg(answerScores),
    semantic_outcome_counts: outcomeCounts,
    semantic_skip_reason_counts: skipReasonCounts,
    avg_candidate_pool_recall: avgCandidatePoolRecall,
    avg_final_top_k_recall: avgFinalTopKRecall,
    recall_drop_rate: recallDropRate,
  };
}

export function planFactsFromEnvelope(
  plan: CodebaseRetrievalPlanEnvelope,
): Pick<
  RetrievalQueryTelemetry,
  | "platform"
  | "semantic_in_plan"
  | "semantic_order"
  | "structural_in_plan"
  | "codegraph_in_plan"
  | "fallback_hint_present"
  | "intents"
  | "routes"
  | "routes_in_plan"
  | "project_file_count"
> {
  const routeIds = plan.routes.map((r) => r.id);
  const semanticInPlan = plan.routes.some(
    (r) =>
      r.role === "semantic" ||
      r.id === "semantic-fast-context" ||
      r.id === "platform-semantic",
  );
  const semanticOrder =
    plan.routes.find(
      (r) =>
        r.role === "semantic" ||
        r.id === "semantic-fast-context" ||
        r.id === "platform-semantic",
    )?.order ?? null;
  const structuralInPlan = structuralRoutesInPlan(routeIds);
  return {
    platform: plan.platform,
    semantic_in_plan: semanticInPlan,
    semantic_order: semanticOrder,
    structural_in_plan: structuralInPlan,
    codegraph_in_plan: structuralInPlan,
    fallback_hint_present: hasSemanticFallbackHint(plan),
    intents: plan.intents.map((i) => i.id),
    routes: routeIds,
    routes_in_plan: routeIds,
    project_file_count: plan.projectFileCount,
  };
}

export function applyToolClassification(
  record: RetrievalQueryTelemetry,
  toolNames: readonly string[],
): RetrievalQueryTelemetry {
  const classified = classifyToolCalls(toolNames);
  return {
    ...record,
    tools_called: classified.tools_called,
    grep_count: classified.grep_count,
    read_count: classified.read_count,
    codegraph_attempted: classified.codegraph_attempted,
    codegraph_executed: classified.codegraph_executed,
    router_cli_invoked:
      record.router_cli_invoked || classified.router_cli_invoked,
    semantic_attempted: classified.semantic_attempted,
    semantic_executed: classified.semantic_executed,
    read_verification_done:
      record.read_verification_done || classified.read_count > 0,
  };
}

/** 0–1 layer compliance (plan vs exec); orthogonal to answer_score rubric. */
export function computeComplianceScore(
  record: Pick<
    RetrievalQueryTelemetry,
    | "structural_in_plan"
    | "codegraph_executed"
    | "semantic_in_plan"
    | "semantic_executed"
    | "semantic_skip_reason"
    | "read_verification_done"
    | "router_cli_invoked"
    | "plan_block_in_prompt"
  >,
): number {
  let earned = 0;
  let possible = 0;

  if (record.structural_in_plan) {
    possible += 1;
    if (record.codegraph_executed) earned += 1;
  }
  if (record.semantic_in_plan) {
    possible += 1;
    if (
      record.semantic_executed ||
      record.semantic_skip_reason === "rg_corrob_sufficient"
    ) {
      earned += 1;
    }
  }
  possible += 1;
  if (record.read_verification_done) earned += 1;

  if (record.plan_block_in_prompt) {
    possible += 0.25;
    if (record.router_cli_invoked) earned += 0.25;
  }

  return possible === 0 ? 1 : earned / possible;
}

export function withDerivedComplianceScore(
  record: RetrievalQueryTelemetry,
): RetrievalQueryTelemetry {
  return {
    ...record,
    compliance_score: computeComplianceScore(record),
  };
}

/** Best-effort upgrade for pre-v2 JSONL rows (schema_version missing). */
export function migrateTelemetryRecord(
  raw: Record<string, unknown>,
): RetrievalQueryTelemetry {
  const routes = Array.isArray(raw.routes)
    ? (raw.routes as string[])
    : Array.isArray(raw.routes_in_plan)
      ? (raw.routes_in_plan as string[])
      : [];
  const tools = Array.isArray(raw.tools_called)
    ? (raw.tools_called as string[])
    : [];
  const classified = classifyToolCalls(tools);
  const structuralIn =
    typeof raw.structural_in_plan === "boolean"
      ? raw.structural_in_plan
      : structuralRoutesInPlan(routes);
  const semanticIn =
    typeof raw.semantic_in_plan === "boolean"
      ? raw.semantic_in_plan
      : semanticRoutesInPlan(routes);

  const base: RetrievalQueryTelemetry = {
    schema_version: RETRIEVAL_TELEMETRY_SCHEMA_VERSION,
    query_id: String(raw.query_id ?? ""),
    dataset: String(raw.dataset ?? "unknown"),
    query_text: String(raw.query_text ?? ""),
    run_id: String(raw.run_id ?? ""),
    platform: String(raw.platform ?? "generic"),
    semantic_in_plan: semanticIn,
    semantic_order:
      typeof raw.semantic_order === "number" ? raw.semantic_order : null,
    structural_in_plan: structuralIn,
    codegraph_in_plan:
      typeof raw.codegraph_in_plan === "boolean"
        ? raw.codegraph_in_plan
        : structuralIn,
    fallback_hint_present: Boolean(raw.fallback_hint_present),
    intents: Array.isArray(raw.intents) ? (raw.intents as string[]) : [],
    routes,
    routes_in_plan: routes,
    project_file_count:
      typeof raw.project_file_count === "number"
        ? raw.project_file_count
        : null,
    tools_called: classified.tools_called,
    grep_count:
      typeof raw.grep_count === "number"
        ? raw.grep_count
        : classified.grep_count,
    read_count:
      typeof raw.read_count === "number"
        ? raw.read_count
        : classified.read_count,
    codegraph_attempted:
      typeof raw.codegraph_attempted === "boolean"
        ? raw.codegraph_attempted
        : classified.codegraph_attempted,
    codegraph_executed:
      typeof raw.codegraph_executed === "boolean"
        ? raw.codegraph_executed
        : classified.codegraph_executed,
    router_cli_invoked:
      typeof raw.router_cli_invoked === "boolean"
        ? raw.router_cli_invoked
        : classified.router_cli_invoked,
    plan_block_in_prompt: Boolean(raw.plan_block_in_prompt),
    read_verification_done:
      typeof raw.read_verification_done === "boolean"
        ? raw.read_verification_done
        : classified.read_count > 0,
    semantic_attempted:
      typeof raw.semantic_attempted === "boolean"
        ? raw.semantic_attempted
        : classified.semantic_attempted,
    semantic_executed:
      typeof raw.semantic_executed === "boolean"
        ? raw.semantic_executed
        : classified.semantic_executed,
    semantic_outcome: (raw.semantic_outcome as SemanticOutcome) ?? "unknown",
    semantic_success: Boolean(raw.semantic_success),
    semantic_skip_reason:
      (raw.semantic_skip_reason as SemanticSkipReason | null) ?? null,
    rg_candidate_count:
      typeof raw.rg_candidate_count === "number"
        ? raw.rg_candidate_count
        : null,
    rg_corrob_status: (raw.rg_corrob_status as RgCorrobStatus) ?? "unknown",
    trap_only: Boolean(raw.trap_only),
    corroborated_files: Array.isArray(raw.corroborated_files)
      ? (raw.corroborated_files as string[])
      : [],
    adapter_errors: Array.isArray(raw.adapter_errors)
      ? (raw.adapter_errors as RetrievalAdapterError[])
      : [],
    candidate_pool_recall:
      typeof raw.candidate_pool_recall === "number"
        ? raw.candidate_pool_recall
        : null,
    final_top_k_recall:
      typeof raw.final_top_k_recall === "number"
        ? raw.final_top_k_recall
        : null,
    answer_score:
      typeof raw.answer_score === "number" ? raw.answer_score : null,
    compliance_score:
      typeof raw.compliance_score === "number" ? raw.compliance_score : null,
  };
  return withDerivedComplianceScore(base);
}

function buildTelemetryExample(
  partial: Omit<
    RetrievalQueryTelemetry,
    | "schema_version"
    | "grep_count"
    | "read_count"
    | "codegraph_attempted"
    | "codegraph_executed"
    | "router_cli_invoked"
    | "semantic_attempted"
    | "semantic_executed"
    | "read_verification_done"
    | "routes_in_plan"
    | "structural_in_plan"
    | "codegraph_in_plan"
    | "compliance_score"
    | "plan_block_in_prompt"
  > & {
    routes: string[];
    tools_called: string[];
  },
): RetrievalQueryTelemetry {
  const routesInPlan = partial.routes;
  const structuralInPlan = structuralRoutesInPlan(routesInPlan);
  const draft: RetrievalQueryTelemetry = {
    schema_version: RETRIEVAL_TELEMETRY_SCHEMA_VERSION,
    structural_in_plan: structuralInPlan,
    codegraph_in_plan: structuralInPlan,
    routes_in_plan: routesInPlan,
    grep_count: 0,
    read_count: 0,
    codegraph_attempted: false,
    codegraph_executed: false,
    router_cli_invoked: false,
    read_verification_done: false,
    semantic_attempted: false,
    semantic_executed: false,
    compliance_score: null,
    plan_block_in_prompt: false,
    ...partial,
    routes: routesInPlan,
  };
  return withDerivedComplianceScore(
    applyToolClassification(draft, partial.tools_called),
  );
}

export const RETRIEVAL_TELEMETRY_EXAMPLES = {
  main50RgSufficientSkip: buildTelemetryExample({
    query_id: "Q01",
    dataset: "main-50",
    query_text: "who calls routeCodebaseRetrieval after exact rg finds source",
    run_id: "example-main-50",
    platform: "cursor",
    semantic_in_plan: true,
    semantic_order: 4,
    fallback_hint_present: true,
    intents: ["exact-symbol-path", "caller-chain"],
    routes: ["exact-rg-primary", "caller-chain-ast", "platform-semantic"],
    project_file_count: 2400,
    tools_called: ["Grep", "Read"],
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
    answer_score: 6,
  }),
  semanticSliceExecutedSuccess: buildTelemetryExample({
    query_id: "S04",
    dataset: "semantic-slice",
    query_text: "how does retrieval policy work across modules",
    run_id: "example-semantic-slice",
    platform: "codex",
    semantic_in_plan: true,
    semantic_order: 1,
    fallback_hint_present: true,
    intents: ["cross-cutting-discovery"],
    routes: ["semantic-fast-context", "exact-rg-primary"],
    project_file_count: 800,
    tools_called: ["rg", "fast_context_search", "rg", "ReadFile"],
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
    answer_score: 6,
  }),
  cursorColdBlindGrepOnly: buildTelemetryExample({
    query_id: "B02",
    dataset: "main-50",
    query_text: "deliverOutboundPayloads barrel at gateway startup",
    run_id: "cursor-full-cold-blind",
    platform: "cursor",
    semantic_in_plan: true,
    semantic_order: 3,
    fallback_hint_present: true,
    intents: ["caller-chain", "exact-symbol-path"],
    routes: ["exact-rg-primary", "caller-chain-ast", "platform-semantic"],
    project_file_count: 5200,
    tools_called: ["Grep"],
    semantic_outcome: "not_run",
    semantic_success: false,
    semantic_skip_reason: "manual_not_recorded",
    rg_candidate_count: null,
    rg_corrob_status: "unknown",
    trap_only: false,
    corroborated_files: [],
    adapter_errors: [],
    candidate_pool_recall: null,
    final_top_k_recall: null,
    answer_score: 0,
  }),
  semanticSliceResourceExhausted: buildTelemetryExample({
    query_id: "S08",
    dataset: "semantic-slice",
    query_text: "conceptual retrieval boundary question with quota failure",
    run_id: "example-semantic-slice",
    platform: "codex",
    semantic_in_plan: true,
    semantic_order: 1,
    fallback_hint_present: true,
    intents: ["cross-cutting-discovery"],
    routes: ["semantic-fast-context", "exact-rg-primary"],
    project_file_count: 800,
    tools_called: ["rg", "fast_context_search", "rg", "ReadFile"],
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
    answer_score: 4,
  }),
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
    (route) =>
      route.role === "semantic" ||
      route.id === "semantic-fast-context" ||
      route.id === "platform-semantic",
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
