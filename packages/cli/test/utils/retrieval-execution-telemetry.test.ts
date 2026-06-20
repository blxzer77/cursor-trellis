import { describe, expect, it } from "vitest";

import { routeCodebaseRetrieval } from "../../src/utils/codebase-retrieval-router.js";
import {
  deriveRetrievalTelemetryMetrics,
  evaluateO2SemanticFallback,
  RETRIEVAL_TELEMETRY_EXAMPLES,
  RETRIEVAL_TELEMETRY_FIELD_OWNERSHIP,
} from "../../src/utils/retrieval-execution-telemetry.js";

describe("retrieval execution telemetry", () => {
  it("defines plan-owned and execution-owned fields", () => {
    expect(RETRIEVAL_TELEMETRY_FIELD_OWNERSHIP.router_plan).toContain(
      "semantic_in_plan",
    );
    expect(RETRIEVAL_TELEMETRY_FIELD_OWNERSHIP.execution_harness).toContain(
      "semantic_executed",
    );
    expect(RETRIEVAL_TELEMETRY_FIELD_OWNERSHIP.execution_harness).toContain(
      "semantic_skip_reason",
    );
    expect(RETRIEVAL_TELEMETRY_FIELD_OWNERSHIP.execution_harness).toContain(
      "candidate_pool_recall",
    );
    expect(RETRIEVAL_TELEMETRY_FIELD_OWNERSHIP.execution_harness).toContain(
      "final_top_k_recall",
    );
  });

  it("derives plan and execution rates from per-query rows", () => {
    const metrics = deriveRetrievalTelemetryMetrics([
      RETRIEVAL_TELEMETRY_EXAMPLES.main50RgSufficientSkip,
      RETRIEVAL_TELEMETRY_EXAMPLES.semanticSliceExecutedSuccess,
    ]);

    expect(metrics.total_queries).toBe(2);
    expect(metrics.semantic_plan_count).toBe(2);
    expect(metrics.semantic_exec_count).toBe(1);
    expect(metrics.semantic_attempt_count).toBe(1);
    expect(metrics.semantic_exec_success_count).toBe(1);
    expect(metrics.semantic_plan_rate).toBe(1);
    expect(metrics.semantic_exec_rate).toBe(0.5);
    expect(metrics.semantic_attempt_rate).toBe(0.5);
    expect(metrics.semantic_skip_reason_counts.rg_corrob_sufficient).toBe(1);
  });

  it("counts resource_exhausted as attempted execution but not success", () => {
    const metrics = deriveRetrievalTelemetryMetrics([
      RETRIEVAL_TELEMETRY_EXAMPLES.semanticSliceResourceExhausted,
    ]);

    expect(metrics.semantic_exec_count).toBe(1);
    expect(metrics.semantic_attempt_count).toBe(1);
    expect(metrics.semantic_exec_success_count).toBe(0);
    expect(metrics.semantic_exec_success_rate).toBe(0);
    expect(metrics.semantic_outcome_counts.resource_exhausted).toBe(1);
    expect(
      RETRIEVAL_TELEMETRY_EXAMPLES.semanticSliceResourceExhausted.adapter_errors[0]
        ?.fallback,
    ).toEqual(["exact-rg", "codegraph", "source-read"]);
  });

  it("computes avg_candidate_pool_recall and avg_final_top_k_recall from non-null values", () => {
    const metrics = deriveRetrievalTelemetryMetrics([
      {
        ...RETRIEVAL_TELEMETRY_EXAMPLES.main50RgSufficientSkip,
        candidate_pool_recall: 0.9,
        final_top_k_recall: 0.6,
      },
      {
        ...RETRIEVAL_TELEMETRY_EXAMPLES.semanticSliceExecutedSuccess,
        candidate_pool_recall: 0.7,
        final_top_k_recall: 0.5,
      },
      {
        ...RETRIEVAL_TELEMETRY_EXAMPLES.semanticSliceResourceExhausted,
        candidate_pool_recall: null,
        final_top_k_recall: null,
      },
    ]);

    expect(metrics.avg_candidate_pool_recall).toBeCloseTo(0.8);
    expect(metrics.avg_final_top_k_recall).toBeCloseTo(0.55);
  });

  it("computes recall_drop_rate from dual metrics", () => {
    const metrics = deriveRetrievalTelemetryMetrics([
      {
        ...RETRIEVAL_TELEMETRY_EXAMPLES.main50RgSufficientSkip,
        candidate_pool_recall: 1.0,
        final_top_k_recall: 0.5,
      },
    ]);

    expect(metrics.recall_drop_rate).toBeCloseTo(0.5);
  });

  it("returns 0 recall metrics when all values are null", () => {
    const metrics = deriveRetrievalTelemetryMetrics([
      RETRIEVAL_TELEMETRY_EXAMPLES.main50RgSufficientSkip,
      RETRIEVAL_TELEMETRY_EXAMPLES.semanticSliceExecutedSuccess,
    ]);

    expect(metrics.avg_candidate_pool_recall).toBe(0);
    expect(metrics.avg_final_top_k_recall).toBe(0);
    expect(metrics.recall_drop_rate).toBe(0);
  });
});

describe("O2 semantic fallback compliance harness", () => {
  it("selects semantic next when rg has no corroborated candidates", () => {
    const plan = routeCodebaseRetrieval({
      query: "routeCodebaseRetrieval storage policy sidecar forbidden in AGENTS.md",
    });

    const decision = evaluateO2SemanticFallback(plan, { status: "rg_empty" });

    expect(decision.next_action).toBe("invoke_semantic");
    expect(decision.telemetry.semantic_in_plan).toBe(true);
    expect(decision.telemetry.fallback_hint_present).toBe(true);
    expect(decision.telemetry.rg_corrob_status).toBe("none");
    expect(decision.telemetry.semantic_skip_reason).toBeNull();
  });

  it("selects semantic or trap-demotion continuation for trap-only rg hits", () => {
    const plan = routeCodebaseRetrieval({
      query: "trap demotion packages/foo-core vs src/agents overlay",
    });

    const decision = evaluateO2SemanticFallback(plan, {
      status: "trap_only",
      files: ["src/agents/plugin-registry-snapshot.ts"],
    });

    expect(decision.next_action).toBe("invoke_semantic");
    expect(decision.telemetry.trap_only).toBe(true);
    expect(decision.telemetry.rg_corrob_status).toBe("trap_only");
    expect(decision.rationale).toMatch(/trap candidates/i);
  });

  it("does not force semantic when exact evidence is already corroborated", () => {
    const plan = routeCodebaseRetrieval({
      query: "who calls routeCodebaseRetrieval in packages/cli/src/utils",
    });

    const decision = evaluateO2SemanticFallback(plan, {
      status: "corroborated_exact_sufficient",
      files: ["packages/cli/test/utils/codebase-retrieval-router.test.ts"],
    });

    expect(decision.next_action).toBe("stop_with_skip_reason");
    expect(decision.telemetry.rg_corrob_status).toBe("sufficient");
    expect(decision.telemetry.semantic_skip_reason).toBe("rg_corrob_sufficient");
  });
});

