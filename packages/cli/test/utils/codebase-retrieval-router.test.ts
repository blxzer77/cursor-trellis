import { describe, expect, it } from "vitest";

import {
  CODEBASE_RETRIEVAL_ROUTER_VERSION,
  emptyCodebaseRetrievalPlan,
  routeCodebaseRetrieval,
} from "../../src/utils/codebase-retrieval-router.js";

describe("codebase retrieval router V3 compatibility entrypoint", () => {
  it("emits the neutral V3 envelope", () => {
    const plan = routeCodebaseRetrieval(
      "who calls the loader and lists dependencies",
    );
    expect(plan.schemaVersion).toBe(CODEBASE_RETRIEVAL_ROUTER_VERSION);
    expect(plan.intents).toEqual(["structural"]);
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0]).toMatchObject({
      intent: "structural",
      kind: "provider-request",
      localToolHint: null,
    });
    expect(plan.stopReasons).toEqual([
      {
        code: "provider-resolution-required",
        intent: "structural",
        blocking: true,
      },
    ]);
  });

  it("uses only rg as the exact local hint", () => {
    const plan = routeCodebaseRetrieval({
      query: "where is routeCodebaseRetrieval defined",
      intents: ["exact"],
    });
    expect(plan.steps).toEqual([
      {
        order: 1,
        intent: "exact",
        kind: "local-exact",
        localToolHint: "rg",
        providerRequirement: null,
        outputRole: "candidate",
      },
    ]);
  });

  it("honors neutral readiness without emitting an identity", () => {
    const plan = routeCodebaseRetrieval({
      query: "how does account behavior work",
      intents: ["semantic"],
      providerAvailability: [
        { intent: "semantic", status: "ready", readiness: "ready" },
      ],
    });
    expect(plan.stopReasons).toEqual([]);
    expect(plan.steps[0]?.providerRequirement?.status).toBe("ready");
    expect(JSON.stringify(plan)).not.toMatch(/providerId|hostId|adapterId/);
  });

  it.each([
    ["degraded", "provider-degraded"],
    ["unavailable", "provider-unavailable"],
    ["unsupported", "provider-unsupported"],
  ] as const)("maps %s to a generic stop reason", (status, code) => {
    const plan = routeCodebaseRetrieval({
      query: "latest release note",
      intents: ["external"],
      providerAvailability: [
        {
          intent: "external",
          status,
          readiness: status === "unsupported" ? "unavailable" : status,
        },
      ],
    });
    expect(plan.stopReasons).toEqual([
      { code, intent: "external", blocking: true },
    ]);
  });

  it("ignores pre-V3 route metadata", () => {
    const baseline = routeCodebaseRetrieval({
      query: "how does behavior work",
    });
    expect(
      routeCodebaseRetrieval({
        query: "how does behavior work",
        platformLabel: "anything",
        projectFileCount: 999_999,
        codebaseRetrievalSelected: false,
      }),
    ).toEqual(baseline);
  });

  it("is deterministic and exposes a stable fingerprint", () => {
    const first = routeCodebaseRetrieval("caller dependency impact");
    const second = routeCodebaseRetrieval("caller dependency impact");
    expect(second).toEqual(first);
    expect(first.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it("retains an explicit best-effort empty-plan helper", () => {
    expect(emptyCodebaseRetrievalPlan()).toMatchObject({
      schemaVersion: 3,
      intents: ["exact"],
      minimumAssurance: "best-effort",
      requiredEvidenceKinds: [],
    });
  });

  it("rejects accessors and throwing proxies without reading or echoing canaries", () => {
    const getterCanary = "TOKEN=router-getter-canary";
    let reads = 0;
    const accessor = { intents: ["exact"] } as Record<string, unknown>;
    Object.defineProperty(accessor, "query", {
      enumerable: true,
      get() {
        reads += 1;
        throw new Error(getterCanary);
      },
    });
    const proxyCanary = "TOKEN=router-proxy-canary";
    const proxy = new Proxy(
      { query: "where is Widget defined", intents: ["exact"] },
      {
        get() {
          throw new Error(proxyCanary);
        },
      },
    );

    for (const candidate of [accessor, proxy]) {
      let rendered = "";
      try {
        routeCodebaseRetrieval(candidate as never);
      } catch (error) {
        rendered = String(error);
      }
      expect(rendered).toBe(
        "RetrievalRequestValidationError: PACTILE_RETRIEVAL_REQUEST_INVALID",
      );
      expect(rendered).not.toContain("TOKEN=");
    }
    expect(reads).toBe(0);
  });

  it("rejects unknown compatibility fields without echoing their names", () => {
    const canary = "TOKEN=router-unknown-canary";
    let thrown: unknown;
    try {
      routeCodebaseRetrieval({
        query: "where is Widget defined",
        [canary]: true,
      } as never);
    } catch (error) {
      thrown = error;
    }
    expect(String(thrown)).toBe(
      "RetrievalRequestValidationError: PACTILE_RETRIEVAL_REQUEST_INVALID",
    );
    expect(JSON.stringify(thrown)).not.toContain(canary);
  });

  it.each([
    {
      field: "query",
      input: { intents: ["exact"] },
      expectedError:
        "RetrievalRequestValidationError: PACTILE_RETRIEVAL_REQUEST_INVALID",
    },
    {
      field: "scopeHints",
      input: { query: "where is Widget defined", intents: ["exact"] },
      expectedError: null,
    },
  ] as const)(
    "does not read an inherited $field getter when the own field is missing",
    ({ field, input, expectedError }) => {
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
          result = routeCodebaseRetrieval(input as never);
        } catch (error) {
          thrown = error;
        }
      } finally {
        Reflect.deleteProperty(Object.prototype, field);
      }

      expect(reads).toBe(0);
      expect(String(thrown ?? "")).toBe(expectedError ?? "");
      expect(
        JSON.stringify({ result, error: String(thrown ?? "") }),
      ).not.toContain(canary);
      if (expectedError === null) {
        expect(result).toMatchObject({ schemaVersion: 3, intents: ["exact"] });
      }
    },
  );
});
