import { describe, expect, it } from "vitest";

import {
  assessRetrievalClaimV3,
  buildRetrievalRequestV3,
  createRetrievalPlanV3,
  type RetrievalPlanV3,
} from "../../../src/pactile/retrieval/index.js";

function semanticPlan(
  minimumAssurance: "evidence-backed" | "verified" = "evidence-backed",
) {
  return createRetrievalPlanV3(
    buildRetrievalRequestV3({
      query: "How does account behavior work?",
      intents: ["semantic"],
      minimumAssurance,
      requiredEvidenceKinds:
        minimumAssurance === "verified"
          ? ["repeatable-test"]
          : ["source-reference"],
    }),
    {
      providerAvailability: [
        { intent: "semantic", status: "ready", readiness: "ready" },
      ],
    },
  );
}

function resolution(
  plan: RetrievalPlanV3,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const verified = plan.minimumAssurance === "verified";
  return {
    schemaVersion: 1,
    intent: "semantic",
    minimumAssurance: plan.minimumAssurance,
    origin: "provider",
    providerId: "fixture.provider",
    providerVersion: "1.0.0",
    assurance: plan.minimumAssurance,
    readiness: "ready",
    requestedPolicy: plan.requestedPolicy,
    effectivePolicy: plan.requestedPolicy,
    evidenceRefs: ["evidence://provider/probe"],
    freshness: verified ? "fresh" : "unknown",
    probedAt: verified ? "2026-09-09T01:00:00.000Z" : null,
    probeResult: verified ? "passed" : "not-run",
    fallbackFromProviderId: null,
    ...overrides,
  };
}

describe("Pactile retrieval V3 evidence escalation", () => {
  it("accepts exact evidence-backed claims only with a candidate and corroboration", () => {
    const plan = createRetrievalPlanV3(
      buildRetrievalRequestV3({
        query: "where is Widget defined",
        intents: ["exact"],
      }),
    );
    expect(
      assessRetrievalClaimV3({
        plan,
        intent: "exact",
        candidateRefs: ["source://src/widget.ts/line12"],
        corroboration: [
          { kind: "source-reference", ref: "source://src/widget.ts/line12" },
        ],
      }),
    ).toMatchObject({
      accepted: true,
      achievedAssurance: "evidence-backed",
      reasonCodes: [],
    });
  });

  it("does not treat a provider score as evidence", () => {
    const plan = semanticPlan();
    const low = assessRetrievalClaimV3({
      plan,
      intent: "semantic",
      candidateRefs: ["source://src/candidate.ts/line1"],
      corroboration: [],
      resolution: resolution(plan),
      providerScore: 0,
    });
    const high = assessRetrievalClaimV3({
      plan,
      intent: "semantic",
      candidateRefs: ["source://src/candidate.ts/line1"],
      corroboration: [],
      resolution: resolution(plan),
      providerScore: Number.MAX_VALUE,
    });
    expect(high).toEqual(low);
    expect(high.accepted).toBe(false);
    expect(high.reasonCodes).toEqual([
      "corroboration-required",
      "required-evidence-missing",
      "minimum-assurance-not-met",
    ]);
  });

  it("accepts semantic candidates only after source corroboration and a matching resolution", () => {
    const plan = semanticPlan();
    expect(
      assessRetrievalClaimV3({
        plan,
        intent: "semantic",
        candidateRefs: ["source://src/candidate.ts/line1"],
        corroboration: [
          { kind: "source-reference", ref: "source://src/candidate.ts/line10" },
        ],
        resolution: resolution(plan),
      }),
    ).toMatchObject({
      accepted: true,
      achievedAssurance: "evidence-backed",
      evidenceRefs: [
        "source://src/candidate.ts/line1",
        "source://src/candidate.ts/line10",
      ],
    });
  });

  it("requires a fresh passed provider proof and repeatable test for verified", () => {
    const plan = semanticPlan("verified");
    const facts = [
      { kind: "repeatable-test", ref: "test://retrieval/semantic" },
    ] as const;
    expect(
      assessRetrievalClaimV3({
        plan,
        intent: "semantic",
        candidateRefs: ["source://src/candidate.ts/line1"],
        corroboration: facts,
        resolution: resolution(plan),
      }),
    ).toMatchObject({ accepted: true, achievedAssurance: "verified" });

    const stale = assessRetrievalClaimV3({
      plan,
      intent: "semantic",
      candidateRefs: ["source://src/candidate.ts/line1"],
      corroboration: facts,
      resolution: resolution(plan, { freshness: "stale" }),
    });
    expect(stale.accepted).toBe(false);
    expect(stale.reasonCodes).toEqual([
      "minimum-assurance-not-met",
      "verified-provider-proof-required",
    ]);
  });

  it.each([
    ["degraded", "provider-degraded"],
    ["unavailable", "provider-unavailable"],
    ["unsupported", "provider-unsupported"],
  ] as const)("honors a %s provider stop", (status, expected) => {
    const plan = createRetrievalPlanV3(
      buildRetrievalRequestV3({
        query: "How does account behavior work?",
        intents: ["semantic"],
      }),
      {
        providerAvailability: [
          {
            intent: "semantic",
            status,
            readiness: status === "unsupported" ? "unavailable" : status,
          },
        ],
      },
    );
    const assessed = assessRetrievalClaimV3({
      plan,
      intent: "semantic",
      candidateRefs: ["source://src/candidate.ts/line1"],
      corroboration: [
        { kind: "source-reference", ref: "source://src/candidate.ts/line1" },
      ],
      resolution: resolution(plan),
    });
    expect(assessed.accepted).toBe(false);
    expect(assessed.reasonCodes).toContain(expected);
  });

  it("rejects a tampered plan fingerprint", () => {
    const plan = { ...semanticPlan(), query: "tampered" };
    expect(
      assessRetrievalClaimV3({
        plan,
        intent: "semantic",
        candidateRefs: ["source://src/candidate.ts/line1"],
        corroboration: [
          { kind: "source-reference", ref: "source://src/candidate.ts/line1" },
        ],
        resolution: resolution(plan),
      }),
    ).toMatchObject({ accepted: false, reasonCodes: ["invalid-plan"] });
  });

  it("rejects non-JSON plans and inherited assessment inputs with zero getter reads", () => {
    const plan = createRetrievalPlanV3(
      buildRetrievalRequestV3({
        query: "where is Widget defined",
        intents: ["exact"],
      }),
    );
    const base = {
      plan,
      intent: "exact",
      candidateRefs: ["source://src/widget.ts"],
      corroboration: [
        { kind: "source-reference", ref: "source://src/widget.ts" },
      ],
    } as const;
    let reads = 0;
    const accessorPlan = { ...plan } as Record<string, unknown>;
    Object.defineProperty(accessorPlan, "query", {
      enumerable: true,
      get() {
        reads += 1;
        return plan.query;
      },
    });
    const hostilePlans: unknown[] = [
      { ...plan, surprise: true },
      Object.assign(Object.create({ inherited: true }) as object, plan),
      new Proxy(plan, {}),
      accessorPlan,
    ];
    for (const hostilePlan of hostilePlans) {
      const assessed = assessRetrievalClaimV3({
        ...base,
        plan: hostilePlan as never,
      });
      expect(assessed.accepted).toBe(false);
      expect(JSON.stringify(assessed)).not.toContain("surprise");
    }
    expect(assessRetrievalClaimV3(Object.create(base) as never).accepted).toBe(
      false,
    );
    expect(reads).toBe(0);
  });

  it("rejects hostile assessment trees without invoking traps or exposing values", () => {
    const plan = createRetrievalPlanV3(
      buildRetrievalRequestV3({
        query: "where is Widget defined",
        intents: ["exact"],
      }),
    );
    const valid = {
      plan,
      intent: "exact",
      candidateRefs: ["source://src/widget.ts"],
      corroboration: [
        { kind: "source-reference", ref: "source://src/widget.ts" },
      ],
    } as Record<string, unknown>;
    const symbolField = { ...valid };
    Object.defineProperty(symbolField, Symbol("hidden"), {
      enumerable: true,
      value: "TOKEN=symbol-canary",
    });
    const sparseRefs = new Array<string>(2);
    sparseRefs[0] = "source://src/widget.ts";
    const cyclic = { ...valid };
    cyclic.self = cyclic;
    const trapCanary = "TOKEN=proxy-trap-canary";
    const trappingProxy = new Proxy(valid, {
      get() {
        throw new Error(trapCanary);
      },
      ownKeys() {
        throw new Error(trapCanary);
      },
    });
    const candidates: unknown[] = [
      symbolField,
      { ...valid, candidateRefs: sparseRefs },
      cyclic,
      { ...valid, providerScore: Number.NaN },
      { ...valid, providerScore: Number.POSITIVE_INFINITY },
      trappingProxy,
    ];

    for (const candidate of candidates) {
      const assessed = assessRetrievalClaimV3(candidate as never);
      expect(assessed).toEqual({
        schemaVersion: 3,
        intent: "exact",
        accepted: false,
        achievedAssurance: null,
        evidenceRefs: [],
        reasonCodes: ["invalid-evidence"],
      });
      expect(JSON.stringify(assessed)).not.toContain("TOKEN=");
    }
  });

  it("redacts invalid intents and sensitive evidence references", () => {
    const plan = createRetrievalPlanV3(
      buildRetrievalRequestV3({
        query: "where is Widget defined",
        intents: ["exact"],
      }),
    );
    const invalidIntentCanary = "TOKEN=invalid-intent-canary";
    const invalidIntent = assessRetrievalClaimV3({
      plan,
      intent: invalidIntentCanary,
      candidateRefs: ["source://src/widget.ts"],
      corroboration: [
        { kind: "source-reference", ref: "source://src/widget.ts" },
      ],
    } as never);
    expect(invalidIntent).toMatchObject({
      accepted: false,
      intent: "exact",
      evidenceRefs: [],
    });
    expect(JSON.stringify(invalidIntent)).not.toContain(invalidIntentCanary);

    const sensitiveCanary = "source://token/secret-canary";
    const sensitive = assessRetrievalClaimV3({
      plan,
      intent: "exact",
      candidateRefs: [sensitiveCanary],
      corroboration: [{ kind: "source-reference", ref: sensitiveCanary }],
    });
    expect(sensitive).toMatchObject({
      accepted: false,
      intent: "exact",
      evidenceRefs: [],
      reasonCodes: ["invalid-evidence"],
    });
    expect(JSON.stringify(sensitive)).not.toContain(sensitiveCanary);
  });

  it.each(["intent", "candidateRefs"] as const)(
    "does not read an inherited %s getter when the own field is missing",
    (field) => {
      const plan = createRetrievalPlanV3(
        buildRetrievalRequestV3({
          query: "where is Widget defined",
          intents: ["exact"],
        }),
      );
      const complete = {
        plan,
        intent: "exact",
        candidateRefs: ["source://src/widget.ts"],
        corroboration: [
          { kind: "source-reference", ref: "source://src/widget.ts" },
        ],
      } as Record<string, unknown>;
      Reflect.deleteProperty(complete, field);
      const canary = `TOKEN=prototype-${field}-canary`;
      let reads = 0;
      let thrown: unknown;
      let result: unknown;
      Object.defineProperty(Object.prototype, field, {
        configurable: true,
        get() {
          reads += 1;
          throw new Error(canary);
        },
      });
      try {
        try {
          result = assessRetrievalClaimV3(complete as never);
        } catch (error) {
          thrown = error;
        }
      } finally {
        Reflect.deleteProperty(Object.prototype, field);
      }

      expect(reads).toBe(0);
      expect(thrown).toBeUndefined();
      expect(result).toEqual({
        schemaVersion: 3,
        intent: "exact",
        accepted: false,
        achievedAssurance: null,
        evidenceRefs: [],
        reasonCodes: ["invalid-evidence"],
      });
      expect(JSON.stringify(result)).not.toContain(canary);
    },
  );
});
