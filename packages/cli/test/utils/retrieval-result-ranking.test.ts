import { describe, expect, it } from "vitest";

import {
  pagedCallerAggregation,
  rankRetrievalResultCandidates,
} from "../../src/utils/retrieval-result-ranking.js";

describe("retrieval result-layer ranking", () => {
  it("B03 keeps an expanded caller pool before final Top-5 compression", () => {
    const result = rankRetrievalResultCandidates(
      [
        {
          path: "packages/openclaw-core/src/facade-runtime.ts",
          baseRank: 1,
          evidenceType: "assembly",
        },
        {
          path: "packages/openclaw-discord/src/commands/send-message.ts",
          baseRank: 2,
          evidenceType: "caller-callsite",
          expectedHint: true,
        },
        {
          path: "packages/openclaw-slack/src/events/notify.ts",
          baseRank: 3,
          evidenceType: "caller-callsite",
          expectedHint: true,
        },
        {
          path: "packages/openclaw-github/src/webhook/comment.ts",
          baseRank: 4,
          evidenceType: "caller-callsite",
          expectedHint: true,
        },
        {
          path: "packages/openclaw-cli/src/run/deliver.ts",
          baseRank: 5,
          evidenceType: "caller-callsite",
          expectedHint: true,
        },
        {
          path: "packages/openclaw-core/src/barrel.ts",
          baseRank: 6,
          evidenceType: "assembly",
        },
      ],
      { intents: ["caller-chain"], topK: 5, expandedPoolSize: 6 },
    );

    expect(result.expandedPool).toHaveLength(6);
    expect(result.topCandidates[0]?.path).toBe(
      "packages/openclaw-discord/src/commands/send-message.ts",
    );
    expect(result.topCandidates.map((candidate) => candidate.evidenceType)).toContain(
      "caller-callsite",
    );
    expect(result.topCandidates.at(-1)?.path).not.toBe(
      "packages/openclaw-core/src/barrel.ts",
    );
  });

  it("B05 demotes plugin-registry-snapshot trap candidates", () => {
    const result = rankRetrievalResultCandidates(
      [
        {
          path: "src/agents/plugin-registry-snapshot.ts",
          baseRank: 1,
          trapHint: true,
          evidenceType: "trap",
        },
        {
          path: "packages/plugin-core/src/plugin-registry.ts",
          baseRank: 2,
          corroborated: true,
          evidenceType: "implementation",
        },
      ],
      { intents: ["trap-package-disambiguation"], topK: 2 },
    );

    expect(result.topCandidates[0]?.path).toBe(
      "packages/plugin-core/src/plugin-registry.ts",
    );
    expect(result.topCandidates[1]?.rankingReasons).toContain("trap-demotion");
  });

  it("D03 prefers env scripts, e2e, and bench paths over generic src files", () => {
    const result = rankRetrievalResultCandidates(
      [
        {
          path: "src/paths.ts",
          baseRank: 1,
          evidenceType: "implementation",
        },
        {
          path: "src/auth/env.ts",
          baseRank: 2,
          evidenceType: "implementation",
        },
        {
          path: "scripts/e2e/run-openclaw-env.ts",
          baseRank: 3,
          evidenceType: "env-script",
          expectedHint: true,
        },
        {
          path: "bench/startup-env.ts",
          baseRank: 4,
          evidenceType: "env-script",
          expectedHint: true,
        },
      ],
      { intents: ["env-config-literal"], topK: 3 },
    );

    expect(result.topCandidates[0]?.path).toBe("scripts/e2e/run-openclaw-env.ts");
    expect(result.topCandidates[1]?.path).toBe("bench/startup-env.ts");
    expect(result.topCandidates[0]?.rankingReasons).toContain("env-script-priority");
  });

  it("protects exact/protocol preserve candidates from focused demotions", () => {
    const result = rankRetrievalResultCandidates(
      [
        {
          path: "scripts/e2e/protocol-env.ts",
          baseRank: 1,
          evidenceType: "env-script",
        },
        {
          path: "packages/gateway-protocol/src/schema.ts",
          baseRank: 2,
          evidenceType: "protocol",
          exactPreserve: true,
          matchedIntents: ["protocol-platform-preserve"],
        },
      ],
      { intents: ["env-config-literal", "protocol-platform-preserve"], topK: 2 },
    );

    expect(result.topCandidates[0]?.path).toBe(
      "packages/gateway-protocol/src/schema.ts",
    );
    expect(result.topCandidates[0]?.rankingReasons).toContain(
      "exact-preserve-protected",
    );
  });
});

describe("B03 multi-file assembly fixture with dual recall metrics", () => {
  const b03Candidates = [
    { path: "packages/core/src/facade-runtime.ts", baseRank: 1, evidenceType: "assembly" as const },
    { path: "packages/discord/src/commands/send-message.ts", baseRank: 2, evidenceType: "caller-callsite" as const, expectedHint: true },
    { path: "packages/slack/src/events/notify.ts", baseRank: 3, evidenceType: "caller-callsite" as const, expectedHint: true },
    { path: "packages/github/src/webhook/comment.ts", baseRank: 4, evidenceType: "caller-callsite" as const, expectedHint: true },
    { path: "packages/cli/src/run/deliver.ts", baseRank: 5, evidenceType: "caller-callsite" as const, expectedHint: true },
    { path: "packages/api/src/routes/handle.ts", baseRank: 6, evidenceType: "caller-callsite" as const, expectedHint: true },
    { path: "packages/core/src/barrel.ts", baseRank: 7, evidenceType: "assembly" as const },
  ];

  it("verifies candidate_pool_recall > final_top_k_recall in compressed pool", () => {
    const expectedFiles = new Set(b03Candidates.filter(c => c.expectedHint).map(c => c.path));
    const totalExpected = expectedFiles.size;

    const result = rankRetrievalResultCandidates(b03Candidates, {
      intents: ["caller-chain"],
      topK: 3,
      expandedPoolSize: 7,
    });

    const poolHits = result.expandedPool.filter(c => expectedFiles.has(c.path)).length;
    const topKHits = result.topCandidates.filter(c => expectedFiles.has(c.path)).length;

    const candidatePoolRecall = poolHits / totalExpected;
    const finalTopKRecall = topKHits / totalExpected;

    expect(candidatePoolRecall).toBeGreaterThan(finalTopKRecall);
    expect(candidatePoolRecall).toBe(1);
    expect(finalTopKRecall).toBeLessThan(1);
  });
});

describe("callerPoolExpansion", () => {
  it("adds concrete callers from outside pool when below minConcreteCallers", () => {
    const result = rankRetrievalResultCandidates(
      [
        { path: "packages/core/src/facade-runtime.ts", baseRank: 1, evidenceType: "assembly" as const },
        { path: "packages/core/src/barrel.ts", baseRank: 2, evidenceType: "assembly" as const },
        { path: "packages/discord/src/commands/send.ts", baseRank: 3, evidenceType: "caller-callsite" as const },
        { path: "packages/slack/src/events/notify.ts", baseRank: 4, evidenceType: "caller-callsite" as const },
      ],
      {
        intents: ["caller-chain"],
        topK: 3,
        expandedPoolSize: 2,
        callerPoolExpansion: { enabled: true, minConcreteCallers: 2 },
      },
    );

    const concreteCallers = result.expandedPool.filter(
      (c) => c.evidenceType === "caller-callsite",
    );
    expect(concreteCallers.length).toBeGreaterThanOrEqual(2);
  });

  it("emits warning when concrete callers < minConcreteCallers", () => {
    const result = rankRetrievalResultCandidates(
      [
        { path: "packages/core/src/facade-runtime.ts", baseRank: 1, evidenceType: "assembly" as const },
        { path: "packages/core/src/barrel.ts", baseRank: 2, evidenceType: "assembly" as const },
      ],
      {
        intents: ["caller-chain"],
        topK: 2,
        expandedPoolSize: 2,
        callerPoolExpansion: { enabled: true, minConcreteCallers: 3 },
      },
    );

    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0]).toMatch(/caller-pool-expansion/);
    expect(result.warnings[0]).toMatch(/below minConcreteCallers=3/);
  });

  it("does not expand when callerPoolExpansion is disabled", () => {
    const result = rankRetrievalResultCandidates(
      [
        { path: "packages/core/src/facade-runtime.ts", baseRank: 1, evidenceType: "assembly" as const },
        { path: "packages/core/src/barrel.ts", baseRank: 2, evidenceType: "assembly" as const },
      ],
      {
        intents: ["caller-chain"],
        topK: 2,
        expandedPoolSize: 2,
        callerPoolExpansion: { enabled: false, minConcreteCallers: 3 },
      },
    );

    expect(result.warnings).toHaveLength(0);
  });
});

describe("pagedCallerAggregation", () => {
  it("deduplicates callers by path and preserves sourceRole", () => {
    const initialCallers = [
      { path: "packages/discord/src/commands/send.ts", baseRank: 1, sourceRole: "direct-caller" },
      { path: "packages/slack/src/events/notify.ts", baseRank: 2, sourceRole: "direct-caller" },
    ];

    const result = pagedCallerAggregation(initialCallers, 1, (page) => {
      if (page === 1) {
        return [
          { path: "packages/discord/src/commands/send.ts", baseRank: 10, sourceRole: "indirect-caller" },
          { path: "packages/github/src/webhook/comment.ts", baseRank: 3, sourceRole: "direct-caller" },
        ];
      }
      return [];
    });

    expect(result.deduplicatedCount).toBe(3);
    expect(result.pagesConsumed).toBe(1);

    const discordCaller = result.callers.find(
      (c) => c.path === "packages/discord/src/commands/send.ts",
    );
    expect(discordCaller?.sourceRole).toBe("direct-caller");
  });

  it("aggregates across multiple pages and stops on empty page", () => {
    const initialCallers = [
      { path: "packages/core/src/facade.ts", baseRank: 1 },
    ];

    const result = pagedCallerAggregation(initialCallers, 5, (page) => {
      if (page === 1) {
        return [{ path: "packages/discord/src/cmd.ts", baseRank: 2 }];
      }
      if (page === 2) {
        return [{ path: "packages/slack/src/evt.ts", baseRank: 3 }];
      }
      return [];
    });

    expect(result.pagesConsumed).toBe(3);
    expect(result.deduplicatedCount).toBe(3);
  });

  it("preserves sourceRole from later callers when first occurrence has none", () => {
    const initialCallers = [
      { path: "packages/core/src/handler.ts", baseRank: 1 },
    ];

    const result = pagedCallerAggregation(initialCallers, 1, (page) => {
      if (page === 1) {
        return [{ path: "packages/core/src/handler.ts", baseRank: 5, sourceRole: "caller-chain" }];
      }
      return [];
    });

    const handler = result.callers.find((c) => c.path === "packages/core/src/handler.ts");
    expect(handler?.sourceRole).toBe("caller-chain");
  });
});

