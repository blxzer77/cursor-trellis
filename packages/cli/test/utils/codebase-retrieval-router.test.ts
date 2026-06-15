import { describe, expect, it } from "vitest";

import {
  CODEBASE_RETRIEVAL_ROUTER_VERSION,
  routeCodebaseRetrieval,
} from "../../src/utils/codebase-retrieval-router.js";

describe("codebase retrieval router", () => {
  it("returns version 1 envelope with empty adapterState and freshness", () => {
    const plan = routeCodebaseRetrieval({
      query: "who calls deliverPayload in server-runtime",
    });
    expect(plan.version).toBe(CODEBASE_RETRIEVAL_ROUTER_VERSION);
    expect(plan.adapterState).toEqual([]);
    expect(plan.freshness).toEqual([]);
    expect(plan.routes.length).toBeGreaterThan(0);
    expect(plan.verification.length).toBeGreaterThan(0);
  });

  it("classifies caller-chain intent with caller verification", () => {
    const plan = routeCodebaseRetrieval({
      query: "Which modules invoke the facade loader and list call sites?",
    });
    expect(plan.intents.map((i) => i.id)).toContain("caller-chain");
    expect(plan.verification.some((v) => v.id === "caller-sites")).toBe(true);
    expect(plan.routes.some((r) => r.id === "caller-chain-ast")).toBe(true);
  });

  it("classifies policy-document without demoting exact-symbol when both match", () => {
    const plan = routeCodebaseRetrieval({
      query:
        "routeCodebaseRetrieval storage policy sidecar forbidden in AGENTS.md",
    });
    expect(plan.intents.map((i) => i.id)).toContain("policy-document");
    expect(plan.intents.map((i) => i.id)).toContain("exact-symbol-path");
    const first = plan.routes[0];
    expect(first?.id).toBe("exact-rg-primary");
    expect(plan.routes.some((r) => r.id === "policy-docs-rg")).toBe(true);
    expect(plan.verification.some((v) => v.id === "policy-doc-top1")).toBe(
      true,
    );
  });

  it("policy-only query leads with policy-docs before optional semantic", () => {
    const plan = routeCodebaseRetrieval({
      query: "storage policy sidecar SQLite only persistence boundaries",
    });
    expect(plan.intents.map((i) => i.id)).toContain("policy-document");
    const policyIndex = plan.routes.findIndex((r) => r.id === "policy-docs-rg");
    const semanticIndex = plan.routes.findIndex(
      (r) => r.id === "semantic-fast-context",
    );
    expect(policyIndex).toBeGreaterThanOrEqual(0);
    if (semanticIndex >= 0) {
      expect(policyIndex).toBeLessThan(semanticIndex);
    }
  });

  it("preserves F/G protocol route with exact primary and skips policy-first", () => {
    const plan = routeCodebaseRetrieval({
      query: "packages/gateway-protocol schema contract constant",
    });
    expect(plan.intents.map((i) => i.id)).toContain(
      "protocol-platform-preserve",
    );
    expect(plan.routes[0]?.id).toBe("exact-rg-primary");
    expect(plan.routes.some((r) => r.id === "policy-docs-rg")).toBe(false);
  });

  it("classifies trap-package disambiguation", () => {
    const plan = routeCodebaseRetrieval({
      query: "trap demotion packages/foo-core vs src/agents overlay",
    });
    expect(plan.intents.map((i) => i.id)).toContain(
      "trap-package-disambiguation",
    );
    expect(plan.routes.some((r) => r.id === "trap-demote-rg")).toBe(true);
  });

  it("classifies extension shared-symbol branch", () => {
    const plan = routeCodebaseRetrieval({
      query: "legacyConfigRules across extensions/ trees",
    });
    expect(plan.intents.map((i) => i.id)).toContain(
      "extension-shared-symbol",
    );
    expect(plan.routes.some((r) => r.id === "extension-rg")).toBe(true);
  });

  it("classifies env-config literal branch", () => {
    const plan = routeCodebaseRetrieval({
      query: "OPENCLAW_E2E env var in e2e bench startup script",
    });
    expect(plan.intents.map((i) => i.id)).toContain("env-config-literal");
    expect(plan.routes.some((r) => r.id === "env-scripts-rg")).toBe(true);
  });

  it("omits optional adapter routes when capability not selected", () => {
    const plan = routeCodebaseRetrieval({
      query: "storage policy architecture",
      codebaseRetrievalSelected: false,
    });
    expect(plan.routes.some((r) => r.role === "semantic")).toBe(false);
    expect(plan.routes.some((r) => r.role === "ast")).toBe(false);
    expect(plan.fallback.some((f) => f.when.includes("not selected"))).toBe(
      true,
    );
  });

  it("is deterministic for the same query", () => {
    const query = "caller chain who calls MyFacade in packages/cli/src/foo.ts";
    const a = routeCodebaseRetrieval({ query });
    const b = routeCodebaseRetrieval({ query });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});