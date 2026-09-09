import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { routeCodebaseRetrieval } from "../../src/utils/codebase-retrieval-router.js";

interface GoldenCase {
  id: string;
  query: string;
  expectedIntents: string[];
  expectedStopCodes: string[];
}

const fixture = JSON.parse(
  readFileSync(
    path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "../fixtures/retrieval-router-l1/cases.json",
    ),
    "utf8",
  ),
) as { version: number; cases: GoldenCase[] };

describe("retrieval router V3 L1 golden", () => {
  it("loads a V3 fixture", () => {
    expect(fixture.version).toBe(3);
    expect(fixture.cases.length).toBeGreaterThanOrEqual(8);
  });

  it.each(fixture.cases)("$id", (entry) => {
    const plan = routeCodebaseRetrieval(entry.query);
    expect(plan.schemaVersion).toBe(3);
    expect(plan.intents).toEqual(entry.expectedIntents);
    expect(plan.stopReasons.map((reason) => reason.code)).toEqual(
      entry.expectedStopCodes,
    );
    expect(plan.fingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});
