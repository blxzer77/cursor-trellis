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
    const result = classifyToolCalls(["Grep", "codebase_search", "Read"]);
    expect(result.semantic_executed).toBe(true);
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