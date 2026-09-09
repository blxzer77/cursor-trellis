import { describe, expect, it } from "vitest";

import { routeCodebaseRetrieval } from "../../src/utils/codebase-retrieval-router.js";
import {
  RETRIEVAL_TELEMETRY_SCHEMA_VERSION,
  computeComplianceScore,
  createRetrievalTelemetry,
  deriveRetrievalTelemetryMetrics,
  migrateTelemetryRecord,
  planFactsFromEnvelope,
} from "../../src/utils/retrieval-execution-telemetry.js";
import { classifyToolCalls } from "../../src/utils/retrieval-tool-classification.js";

describe("retrieval execution telemetry V3", () => {
  const plan = routeCodebaseRetrieval({
    query: "where is Widget and how does behavior work",
    intents: ["exact", "semantic"],
  });

  it("records only neutral plan facts", () => {
    expect(planFactsFromEnvelope(plan)).toEqual({
      plan_fingerprint: plan.fingerprint,
      planned_intents: ["exact", "semantic"],
      minimum_assurance: "evidence-backed",
      provider_request_intents: ["semantic"],
      blocking_reason_codes: ["provider-resolution-required"],
    });
  });

  it("derives observations and compliance without provider identity", () => {
    const record = createRetrievalTelemetry({
      queryId: "query-1",
      plan,
      toolsCalled: ["rg", "semantic_lookup", "read_file"],
      corroborationKinds: ["source-reference"],
      accepted: true,
      achievedAssurance: "evidence-backed",
    });
    expect(record).toMatchObject({
      schema_version: RETRIEVAL_TELEMETRY_SCHEMA_VERSION,
      query_id: "query-1",
      accepted: true,
      achieved_assurance: "evidence-backed",
      compliance_score: 1,
    });
    expect(JSON.stringify(record)).not.toMatch(/providerId|hostId|adapterId/);
  });

  it("keeps corroboration separate from intent execution", () => {
    const exactOnly = classifyToolCalls(["rg"]);
    expect(computeComplianceScore(plan, exactOnly, [])).toBe(0.35);
    expect(computeComplianceScore(plan, exactOnly, ["source-reference"])).toBe(
      0.65,
    );
  });

  it("aggregates the four intent dimensions", () => {
    const records = [
      createRetrievalTelemetry({
        queryId: "query-1",
        plan,
        toolsCalled: ["rg", "semantic_lookup"],
        corroborationKinds: ["source-reference"],
        accepted: true,
      }),
      createRetrievalTelemetry({
        queryId: "query-2",
        plan: routeCodebaseRetrieval({
          query: "caller and latest",
          intents: ["structural", "external"],
        }),
        toolsCalled: ["call_graph", "web_fetch"],
      }),
    ];
    expect(deriveRetrievalTelemetryMetrics(records)).toMatchObject({
      total_queries: 2,
      accepted_queries: 1,
      intent_plan_counts: { exact: 1, semantic: 1, structural: 1, external: 1 },
      intent_execution_counts: {
        exact: 1,
        semantic: 1,
        structural: 1,
        external: 1,
      },
      corroborated_queries: 1,
    });
  });

  it("migrates partial historical rows into the neutral schema", () => {
    expect(
      migrateTelemetryRecord(
        {
          query_id: "old-query",
          corroboration_kinds: ["source-reference"],
          accepted: true,
        },
        plan,
      ),
    ).toMatchObject({
      schema_version: 3,
      query_id: "old-query",
      planned_intents: ["exact", "semantic"],
      accepted: true,
      observations: { exact_count: 0, semantic_count: 0 },
    });
  });
});
