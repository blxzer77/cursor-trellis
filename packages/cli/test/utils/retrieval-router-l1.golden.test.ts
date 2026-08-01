import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  routeCodebaseRetrieval,
  type CodebaseRetrievalPlanEnvelope,
} from "../../src/utils/codebase-retrieval-router.js";
import type { CursorRetrievalEnv } from "../../src/utils/cursor-retrieval-env.js";

interface L1Expect {
  intentsInclude?: string[];
  intentsExclude?: string[];
  primaryRouteIdsPrefix?: string[];
  routeIdPresent?: string[];
  routeIdAbsent?: string[];
  maxOrder?: Record<string, number>;
  semanticBackend?: string;
  fallbackSubstring?: string;
}

interface L1Case {
  id: string;
  bucket: string;
  query: string;
  cursorEnv?: CursorRetrievalEnv;
  expect: L1Expect;
}

interface L1FixtureFile {
  version: number;
  cases: L1Case[];
}

const fixturePath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../fixtures/retrieval-router-l1/cases.json",
);

const fixture = JSON.parse(
  readFileSync(fixturePath, "utf8"),
) as L1FixtureFile;

function assertCase(
  plan: CodebaseRetrievalPlanEnvelope,
  c: L1Case,
): void {
  const intentIds = plan.intents.map((i) => i.id);
  const routeIds = plan.routes.map((r) => r.id);
  const exp = c.expect;

  for (const id of exp.intentsInclude ?? []) {
    expect(intentIds, `${c.id} intentsInclude`).toContain(id);
  }
  for (const id of exp.intentsExclude ?? []) {
    expect(intentIds, `${c.id} intentsExclude`).not.toContain(id);
  }
  for (const id of exp.routeIdPresent ?? []) {
    expect(routeIds, `${c.id} routeIdPresent`).toContain(id);
  }
  for (const id of exp.routeIdAbsent ?? []) {
    expect(routeIds, `${c.id} routeIdAbsent`).not.toContain(id);
  }
  const prefix = exp.primaryRouteIdsPrefix ?? [];
  if (prefix.length > 0) {
    expect(
      routeIds.slice(0, prefix.length),
      `${c.id} primaryRouteIdsPrefix`,
    ).toEqual(prefix);
  }
  if (exp.maxOrder) {
    for (const [routeId, max] of Object.entries(exp.maxOrder)) {
      const route = plan.routes.find((r) => r.id === routeId);
      expect(route, `${c.id} maxOrder missing ${routeId}`).toBeTruthy();
      if (!route) continue;
      expect(route.order, `${c.id} maxOrder ${routeId}`).toBeLessThanOrEqual(
        max,
      );
    }
  }
  if (exp.semanticBackend) {
    const semantic = plan.routes.find((r) => r.id === "platform-semantic");
    expect(semantic?.semanticBackend, `${c.id} semanticBackend`).toBe(
      exp.semanticBackend,
    );
  }
  if (exp.fallbackSubstring) {
    const needle = exp.fallbackSubstring;
    expect(
      plan.fallback.some((f) => f.when.includes(needle)),
      `${c.id} fallbackSubstring`,
    ).toBe(true);
  }
}

describe("retrieval router L1 golden", () => {
  it("loads versioned fixture file", () => {
    expect(fixture.version).toBe(1);
    expect(fixture.cases.length).toBeGreaterThanOrEqual(20);
  });

  for (const c of fixture.cases) {
    it(`${c.id} [${c.bucket}]`, () => {
      const plan = routeCodebaseRetrieval({
        query: c.query,
        cursorEnv: c.cursorEnv ?? "native",
      });
      assertCase(plan, c);
    });
  }
});
