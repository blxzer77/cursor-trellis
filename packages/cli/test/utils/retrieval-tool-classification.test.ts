import { describe, expect, it } from "vitest";

import {
  classifyToolCalls,
  structuralRoutesInPlan,
} from "../../src/utils/retrieval-tool-classification.js";

describe("retrieval tool classification", () => {
  it("detects Cursor Grep, Read, and codegraph MCP tools", () => {
    const result = classifyToolCalls([
      "Grep",
      "Read",
      "project-0-MyHarness-codegraph-codegraph_explore",
    ]);

    expect(result.grep_count).toBe(1);
    expect(result.read_count).toBe(1);
    expect(result.codegraph_executed).toBe(true);
    expect(result.semantic_executed).toBe(false);
  });

  it("detects platform semantic tool names when present in logs", () => {
    const result = classifyToolCalls(["Grep", "codebase_search", "Read"], {
      platform: "cursor",
    });
    expect(result.semantic_executed).toBe(true);
    expect(result.platform_semantic_executed).toBe(true);
    expect(result.fast_context_count).toBe(0);
  });

  it("REC-06: on cursor, fast-context does not count as semantic_exec", () => {
    const result = classifyToolCalls(["Grep", "fast_context_search", "Read"], {
      platform: "cursor",
    });
    expect(result.semantic_executed).toBe(false);
    expect(result.fast_context_count).toBe(1);
    expect(result.cursor_fast_context_misuse).toBe(true);
  });

  it("flags structural routes in plan", () => {
    expect(
      structuralRoutesInPlan([
        "exact-rg-primary",
        "caller-chain-ast",
        "platform-semantic",
      ]),
    ).toBe(true);
  });
});