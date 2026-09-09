import { describe, expect, it } from "vitest";

import {
  classifyToolCalls,
  observedIntentCount,
  semanticRoutesInPlan,
  structuralRoutesInPlan,
} from "../../src/utils/retrieval-tool-classification.js";

describe("retrieval tool observation classification", () => {
  it("classifies all four neutral intent families", () => {
    const result = classifyToolCalls([
      "rg",
      "semantic_lookup",
      "call_graph",
      "web_fetch",
      "read_file",
      "git diff",
      "vitest",
      "route_codebase_retrieval",
      "unknown_tool",
    ]);
    expect(result).toEqual({
      exact_count: 1,
      semantic_count: 1,
      structural_count: 1,
      external_count: 1,
      read_count: 1,
      git_count: 1,
      test_count: 1,
      router_cli_invoked: true,
      unclassified_count: 1,
    });
  });

  it("does not reinterpret blank or unknown tools as execution", () => {
    expect(classifyToolCalls(["", "  ", "opaque"]).unclassified_count).toBe(3);
  });

  it("detects structural and semantic plan intents", () => {
    expect(structuralRoutesInPlan(["exact", "structural"])).toBe(true);
    expect(structuralRoutesInPlan(["exact", "external"])).toBe(false);
    expect(semanticRoutesInPlan(["semantic"])).toBe(true);
  });

  it("reads observation counts through the shared intent vocabulary", () => {
    const result = classifyToolCalls([
      "rg",
      "semantic_lookup",
      "semantic_concept",
    ]);
    expect(observedIntentCount(result, "exact")).toBe(1);
    expect(observedIntentCount(result, "semantic")).toBe(2);
    expect(observedIntentCount(result, "structural")).toBe(0);
    expect(observedIntentCount(result, "external")).toBe(0);
  });
});
