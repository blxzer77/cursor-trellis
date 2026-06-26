import { describe, expect, it } from "vitest";

import { routeCodebaseRetrieval } from "../../src/utils/codebase-retrieval-router.js";
import { ENV_BYOK, ENV_NATIVE, ENV_UNKNOWN } from "../../src/utils/cursor-retrieval-env.js";
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
      cursorEnv: ENV_NATIVE,
    });
    const text = renderAgentInstructions(plan);
    expect(text).toContain("## 代码库检索计划");
    expect(text).toContain("codegraph_callers");
    expect(text).toContain("Grep");
    expect(text.indexOf("codegraph_callers")).toBeLessThan(text.indexOf("Grep"));
    const stepsOnly = text.split("**降级**")[0] ?? text;
    expect(stepsOnly).not.toContain("fast_context_search");
  });

  it("renders platform-semantic without fast-context on cursor conceptual query", () => {
    const plan = routeCodebaseRetrieval({
      query: "how does gateway protocol differ from plugin sdk responsibilities",
      cursorEnv: ENV_NATIVE,
    });
    const text = renderAgentInstructions(plan);
    expect(plan.routes.some((r) => r.id === "platform-semantic")).toBe(true);
    expect(text).toContain("内置代码库语义搜索");
    expect(text).toContain("target_directories");
    const stepsOnly = text.split("**降级**")[0] ?? text;
    expect(stepsOnly).not.toContain("fast_context_search");
    expect(text).toContain("语义合规");
    expect(text).toContain("计划门控");
  });

  it("renders BYOK platform-semantic with fast_context_search", () => {
    const plan = routeCodebaseRetrieval({
      query: "WPeLc8 子代理路由如何工作",
      cursorEnv: ENV_BYOK,
    });
    const text = renderAgentInstructions(plan);
    expect(text).toContain("cursorEnv）：byok");
    expect(text).toContain("fast_context_search");
    expect(text).not.toContain("内置代码库语义搜索");
    expect(text).toContain("语义合规（Cursor++ BYOK）");
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

  it("renders unknown cursorEnv with conservative fast_context_search", () => {
    const plan = routeCodebaseRetrieval({
      query: "how does gateway protocol differ from plugin sdk",
      cursorEnv: ENV_UNKNOWN,
    });
    const text = renderAgentInstructions(plan);
    expect(text).toContain("cursorEnv）：unknown");
    expect(text).toContain("fast_context_search");
    expect(text).toContain("保守");
    expect(text).not.toContain("内置代码库语义搜索");
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
