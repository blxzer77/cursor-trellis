import { describe, expect, it } from "vitest";

import {
  DEFAULT_RETRIEVAL_POLICY_V3,
  buildRetrievalRequestV3,
  classifyRetrievalIntentsV3,
  parseRetrievalRequestV3,
  planRetrievalV3,
} from "../../../src/pactile/retrieval/index.js";
import { routeCodebaseRetrieval } from "../../../src/utils/codebase-retrieval-router.js";

function request(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    schemaVersion: 3,
    query: "where is Widget defined",
    intents: ["exact"],
    scopeHints: [],
    minimumAssurance: "evidence-backed",
    requestedPolicy: {
      ...DEFAULT_RETRIEVAL_POLICY_V3,
      egressDestinations: [],
    },
    requiredEvidenceKinds: ["source-reference"],
    budget: { maxSteps: 16, maxCandidatesPerStep: 50 },
    ...overrides,
  };
}

describe("Pactile retrieval V3 intent classifier", () => {
  it.each([
    ["where is Widget defined", ["exact"]],
    ["how does this behavior work", ["semantic"]],
    ["show caller dependency impact", ["structural"]],
    ["read the latest official docs", ["external"]],
    ["unrecognized request", ["exact"]],
  ])("classifies %s", (query, expected) => {
    expect(classifyRetrievalIntentsV3(query)).toEqual(expected);
  });

  it("decomposes a multi-intent query in canonical order", () => {
    expect(
      classifyRetrievalIntentsV3(
        "find the exact symbol behavior, its caller impact, and latest official docs",
      ),
    ).toEqual(["exact", "semantic", "structural", "external"]);
  });
});

describe("Pactile retrieval V3 strict request parser", () => {
  it("normalizes Unicode, whitespace, intent order, and set-like fields", () => {
    const parsed = parseRetrievalRequestV3(
      request({
        query: "  Cafe\u0301\tbehavior  ",
        intents: ["external", "exact", "semantic"],
        scopeHints: ["z", "cafe\u0301", "a"],
        requiredEvidenceKinds: ["repeatable-test", "source-reference"],
      }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).toMatchObject({
      query: "Café behavior",
      intents: ["exact", "semantic", "external"],
      scopeHints: ["a", "café", "z"],
      requiredEvidenceKinds: ["repeatable-test", "source-reference"],
    });
  });

  it.each([
    ["unknown field", request({ surprise: true }), "unknown-field"],
    [
      "duplicate intent",
      request({ intents: ["exact", "exact"] }),
      "duplicate-value",
    ],
    [
      "duplicate normalized scope",
      request({ scopeHints: ["café", "cafe\u0301"] }),
      "duplicate-value",
    ],
    ["lone surrogate", request({ query: "bad\ud800" }), "invalid-value"],
    [
      "oversized query",
      request({ query: "x".repeat(16 * 1024 + 1) }),
      "limit-exceeded",
    ],
    [
      "policy contradiction",
      request({
        requestedPolicy: {
          ...DEFAULT_RETRIEVAL_POLICY_V3,
          egressDestinations: ["outside.example"],
        },
      }),
      "policy-violation",
    ],
  ])("rejects %s", (_label, candidate, issueCode) => {
    const parsed = parseRetrievalRequestV3(candidate);
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.issues.map((issue) => issue.code)).toContain(issueCode);
  });

  it("does not execute accessor properties", () => {
    let reads = 0;
    const candidate = request();
    Object.defineProperty(candidate, "query", {
      enumerable: true,
      get() {
        reads += 1;
        return "where is Widget defined";
      },
    });
    expect(parseRetrievalRequestV3(candidate).success).toBe(false);
    expect(reads).toBe(0);
  });

  it("rejects benign proxies at every request and context boundary", () => {
    const proxiedRequest = new Proxy(request(), {});
    const proxiedPolicy = request({
      requestedPolicy: new Proxy(
        {
          ...DEFAULT_RETRIEVAL_POLICY_V3,
          egressDestinations: [],
        },
        {},
      ),
    });
    const proxiedIntents = request({ intents: new Proxy(["exact"], {}) });
    const proxiedContext = new Proxy({ providerAvailability: [] }, {});
    const proxiedContextArray = {
      providerAvailability: new Proxy([], {}),
    };
    const proxiedContextEntry = {
      providerAvailability: [
        new Proxy(
          { intent: "semantic", status: "ready", readiness: "ready" },
          {},
        ),
      ],
    };

    expect(parseRetrievalRequestV3(proxiedRequest).success).toBe(false);
    expect(parseRetrievalRequestV3(proxiedPolicy).success).toBe(false);
    expect(parseRetrievalRequestV3(proxiedIntents).success).toBe(false);
    expect(planRetrievalV3(request(), proxiedContext).success).toBe(false);
    expect(planRetrievalV3(request(), proxiedContextArray).success).toBe(false);
    expect(planRetrievalV3(request(), proxiedContextEntry).success).toBe(false);
  });

  it("returns a fixed redacted issue for unknown caller fields", () => {
    const canary = "TOKEN=unknown-field-canary";
    const parsed = parseRetrievalRequestV3(request({ [canary]: true }));
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed)).not.toContain(canary);
    if (parsed.success) return;
    expect(parsed.issues).toContainEqual({
      code: "unknown-field",
      path: "$",
      message: "contains an unknown field",
    });
  });

  it("rejects explicit malformed context instead of defaulting it", () => {
    for (const context of [null, [], false, 0, ""] as const) {
      const planned = planRetrievalV3(request(), context as never);
      expect(planned).toEqual({
        success: false,
        issues: [
          {
            code: "invalid-type",
            path: "$context",
            message: "must be a plain data value",
          },
        ],
      });
    }
  });

  it("fails closed on hostile proxy input", () => {
    const candidate = new Proxy(request(), {
      ownKeys() {
        throw new Error("hostile");
      },
    });
    expect(parseRetrievalRequestV3(candidate)).toEqual({
      success: false,
      issues: [
        {
          code: "invalid-type",
          path: "$",
          message: "must be a plain data value",
        },
      ],
    });
  });

  it("rejects every non-plain JSON-tree shape at the request boundary", () => {
    const customPrototype = Object.assign(
      Object.create({ inherited: true }) as Record<string, unknown>,
      request(),
    );
    const symbolField = request();
    Object.defineProperty(symbolField, Symbol("hidden"), {
      enumerable: true,
      value: true,
    });
    const forbiddenField = request();
    Object.defineProperty(forbiddenField, "__proto__", {
      enumerable: true,
      value: "forbidden",
    });
    const sparseIntents = new Array<string>(2);
    sparseIntents[0] = "exact";
    const cyclic = request();
    cyclic.self = cyclic;
    const candidates: unknown[] = [
      customPrototype,
      symbolField,
      forbiddenField,
      request({ intents: sparseIntents }),
      cyclic,
      request({ budget: { maxSteps: Number.NaN, maxCandidatesPerStep: 50 } }),
      request({
        budget: {
          maxSteps: Number.POSITIVE_INFINITY,
          maxCandidatesPerStep: 50,
        },
      }),
    ];

    for (const candidate of candidates) {
      expect(parseRetrievalRequestV3(candidate)).toEqual({
        success: false,
        issues: [
          {
            code: "invalid-type",
            path: "$",
            message: "must be a plain data value",
          },
        ],
      });
    }
  });
});

describe("Pactile retrieval V3 planner", () => {
  it("emits local exact and provider-request steps with a fixed evidence chain", () => {
    const result = planRetrievalV3(
      request({ intents: ["exact", "semantic", "structural", "external"] }),
      {
        providerAvailability: [
          { intent: "semantic", status: "ready", readiness: "ready" },
          { intent: "structural", status: "degraded", readiness: "degraded" },
          {
            intent: "external",
            status: "unsupported",
            readiness: "unavailable",
          },
        ],
      },
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.steps.map((step) => [step.intent, step.kind])).toEqual([
      ["exact", "local-exact"],
      ["semantic", "provider-request"],
      ["structural", "provider-request"],
      ["external", "provider-request"],
    ]);
    expect(result.data.verificationChain.map((stage) => stage.stage)).toEqual([
      "candidate",
      "corroborate",
      "classify-evidence",
      "check-assurance",
      "accept-or-stop",
    ]);
    expect(result.data.stopReasons.map((reason) => reason.code)).toEqual([
      "provider-degraded",
      "provider-unsupported",
    ]);
  });

  it("marks unresolved provider intents explicitly", () => {
    const result = planRetrievalV3(
      request({ intents: ["semantic", "external"] }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.stopReasons).toEqual([
      {
        code: "provider-resolution-required",
        intent: "semantic",
        blocking: true,
      },
      {
        code: "provider-resolution-required",
        intent: "external",
        blocking: true,
      },
    ]);
  });

  it("is invariant to input ordering and compatibility platform metadata", () => {
    const first = routeCodebaseRetrieval({
      query: "  behavior caller latest  ",
      intents: ["external", "semantic", "structural"],
      scopeHints: ["z", "a"],
      requiredEvidenceKinds: ["repeatable-test", "source-reference"],
      platformLabel: "host-a",
      projectFileCount: 2,
      codebaseRetrievalSelected: false,
    });
    const second = routeCodebaseRetrieval({
      query: "behavior caller latest",
      intents: ["structural", "semantic", "external"],
      scopeHints: ["a", "z"],
      requiredEvidenceKinds: ["source-reference", "repeatable-test"],
      platformLabel: "host-b",
      projectFileCount: 900_000,
      codebaseRetrievalSelected: true,
    });
    expect(first).toEqual(second);
  });

  it("never serializes a host or concrete provider identity", () => {
    const plan = routeCodebaseRetrieval({
      query: "behavior caller latest",
      intents: ["semantic", "structural", "external"],
    });
    const serialized = JSON.stringify(plan).toLowerCase();
    for (const forbidden of [
      "cursor",
      "codex",
      "codegraph",
      "fast-context",
      "smart-search",
      "ccursor",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
    expect(plan.steps.every((step) => step.localToolHint === null)).toBe(true);
  });

  it("build helper validates rather than weakening the strict parser", () => {
    expect(() =>
      buildRetrievalRequestV3({
        query: "behavior",
        minimumAssurance: "verified",
        requiredEvidenceKinds: [],
      }),
    ).toThrowError("PACTILE_RETRIEVAL_REQUEST_INVALID");
  });

  it("build helper performs zero accessor reads and redacts caller exceptions", () => {
    let reads = 0;
    const canary = "TOKEN=build-getter-canary";
    const candidate = {} as Record<string, unknown>;
    Object.defineProperty(candidate, "query", {
      enumerable: true,
      get() {
        reads += 1;
        throw new Error(canary);
      },
    });
    let rendered = "";
    try {
      buildRetrievalRequestV3(candidate as never);
    } catch (error) {
      rendered = String(error);
    }
    expect(reads).toBe(0);
    expect(rendered).toBe(
      "RetrievalRequestValidationError: PACTILE_RETRIEVAL_REQUEST_INVALID",
    );
    expect(rendered).not.toContain(canary);
  });
});
