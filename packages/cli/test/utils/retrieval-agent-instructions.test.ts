import { describe, expect, it } from "vitest";

import { routeCodebaseRetrieval } from "../../src/utils/codebase-retrieval-router.js";
import {
  guessSymbolFromQuery,
  renderAgentInstructions,
} from "../../src/utils/retrieval-agent-instructions.js";

describe("retrieval agent instructions", () => {
  it("extracts symbol from caller query", () => {
    expect(
      guessSymbolFromQuery(
        "buildAgentRunTerminalOutcomeFromWaitResult 都被哪些文件调用了",
      ),
    ).toBe("buildAgentRunTerminalOutcomeFromWaitResult");
  });

  it("renders caller-chain steps with codegraph_callers first on cursor", () => {
    const plan = routeCodebaseRetrieval({
      query: "Which modules invoke buildToolPlan and list call sites?",
    });
    const text = renderAgentInstructions(plan);
    expect(text).toContain("## 代码库检索计划");
    expect(text).toContain("codegraph_callers");
    expect(text).toContain("Grep");
    expect(text.indexOf("codegraph_callers")).toBeLessThan(text.indexOf("Grep"));
    expect(text).not.toContain("fast_context_search");
  });

  it("renders platform-semantic without fast-context on cursor conceptual query", () => {
    const plan = routeCodebaseRetrieval({
      query: "how does gateway protocol differ from plugin sdk responsibilities",
    });
    const text = renderAgentInstructions(plan);
    expect(plan.routes.some((r) => r.id === "platform-semantic")).toBe(true);
    expect(text).toContain("内置代码库语义搜索");
    expect(text).not.toContain("fast_context_search");
    expect(text).toContain("语义合规");
    expect(text).toContain("计划门控");
  });

  it("renders trap intent with codegraph disambiguation", () => {
    const plan = routeCodebaseRetrieval({
      query: "trap demotion packages/foo-core vs src/agents overlay",
    });
    const text = renderAgentInstructions(plan);
    expect(text).toMatch(/codegraph_search|codegraph_explore/);
    expect(text).toContain("trap");
    expect(text).toContain("结果层排序");
  });

  it("appends result-layer ranking hint for caller-chain intent", () => {
    const plan = routeCodebaseRetrieval({
      query: "Which modules invoke buildToolPlan and list call sites?",
    });
    const text = renderAgentInstructions(plan);
    expect(text).toContain("结果层排序");
    expect(text).toContain("调用链");
  });
});
