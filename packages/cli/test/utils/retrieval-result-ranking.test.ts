import { describe, expect, it } from "vitest";

import {
  pagedCallerAggregation,
  rankRetrievalResultCandidates,
} from "../../src/utils/retrieval-result-ranking.js";

describe("retrieval result-layer ranking V3", () => {
  it("orders exact, semantic, structural, and external candidate signals", () => {
    const result = rankRetrievalResultCandidates(
      [
        { path: "external", externalFreshness: 1 },
        { path: "structural", structuralMatch: true },
        { path: "semantic", semanticScore: 1 },
        { path: "exact", exactMatch: true },
      ],
      { intents: ["exact", "semantic", "structural", "external"] },
    );
    expect(result.ranked.map((candidate) => candidate.path)).toEqual([
      "exact",
      "structural",
      "semantic",
      "external",
    ]);
    expect(result.total).toBe(4);
  });

  it("boosts a source reference but never calls it assurance", () => {
    const result = rankRetrievalResultCandidates(
      [
        { path: "b.ts", semanticScore: 0.8 },
        {
          path: "a.ts",
          semanticScore: 0.8,
          sourceReference: "source://a.ts:1",
        },
      ],
      { intents: ["semantic"] },
    );
    expect(result.ranked[0]).toMatchObject({
      path: "a.ts",
      reasons: ["semantic-candidate", "source-reference-present"],
    });
    expect(result.ranked[0]).not.toHaveProperty("assurance");
  });

  it("demotes assembly-only structural candidates", () => {
    const result = rankRetrievalResultCandidates(
      [
        { path: "assembly.ts", structuralMatch: true, assemblyOnly: true },
        { path: "caller.ts", structuralMatch: true },
      ],
      { intents: ["structural"] },
    );
    expect(result.ranked.map((candidate) => candidate.path)).toEqual([
      "caller.ts",
      "assembly.ts",
    ]);
  });

  it("uses deterministic UTF-8 path and line tie-breaks", () => {
    const result = rankRetrievalResultCandidates(
      [
        { path: "b.ts", line: 1 },
        { path: "a.ts", line: 9 },
        { path: "A.ts", line: 2 },
      ],
      { intents: ["exact"] },
    );
    expect(result.ranked.map(({ path, line }) => [path, line])).toEqual([
      ["A.ts", 2],
      ["a.ts", 9],
      ["b.ts", 1],
    ]);
  });

  it("deduplicates paged structural candidates by normalized path and line", () => {
    const result = pagedCallerAggregation(
      [
        {
          page: 2,
          candidates: [{ path: "src\\b.ts", line: 2, structuralMatch: true }],
        },
        {
          page: 1,
          candidates: [
            { path: "SRC/b.ts", line: 2 },
            { path: "src/a.ts", line: 1, structuralMatch: true },
          ],
        },
      ],
      { intents: ["structural"] },
    );
    expect(result.total).toBe(2);
    expect(result.ranked.map((candidate) => candidate.path)).toEqual([
      "src/a.ts",
      "SRC/b.ts",
    ]);
  });
});
