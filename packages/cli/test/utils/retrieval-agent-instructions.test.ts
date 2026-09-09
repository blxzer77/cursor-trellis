import { describe, expect, it } from "vitest";

import { routeCodebaseRetrieval } from "../../src/utils/codebase-retrieval-router.js";
import {
  attachAgentInstructions,
  guessSymbolFromQuery,
  renderAgentInstructions,
} from "../../src/utils/retrieval-agent-instructions.js";

describe("neutral retrieval agent instructions", () => {
  it("extracts a likely exact symbol", () => {
    expect(
      guessSymbolFromQuery("where is `routeCodebaseRetrieval` defined?"),
    ).toBe("routeCodebaseRetrieval");
  });

  it("renders the local exact step with rg", () => {
    const text = renderAgentInstructions(
      routeCodebaseRetrieval({
        query: "where is WidgetFactory defined",
        intents: ["exact"],
      }),
      "en",
    );
    expect(text).toContain("Use `rg`");
    expect(text).toContain("`WidgetFactory`");
    expect(text).toContain("candidate -> corroborate");
  });

  it("renders provider requirements without choosing an implementation", () => {
    const text = renderAgentInstructions(
      routeCodebaseRetrieval({
        query: "how does account behavior work",
        intents: ["semantic"],
      }),
      "en",
    );
    expect(text).toContain("project resolver");
    expect(text).toContain("resolution-required");
    expect(text).toContain("Do not infer or choose an implementation");
    expect(text.toLowerCase()).not.toMatch(
      /codegraph|fast-context|smart-search|semanticsearch|@codebase/,
    );
  });

  it("renders Chinese evidence and assurance guidance", () => {
    const text = renderAgentInstructions(
      routeCodebaseRetrieval({
        query: "分析调用链与影响面",
        intents: ["structural"],
        minimumAssurance: "verified",
        requiredEvidenceKinds: ["repeatable-test"],
      }),
    );
    expect(text).toContain("最低 assurance：verified");
    expect(text).toContain("可重复测试");
    expect(text).toContain("阻断原因：provider-resolution-required");
  });

  it("attaches instructions without changing the plan fingerprint", () => {
    const plan = routeCodebaseRetrieval("caller dependency impact");
    const attached = attachAgentInstructions(plan, "en");
    expect(attached.fingerprint).toBe(plan.fingerprint);
    expect(attached.agentInstructions).toContain("Retrieval plan V3");
  });
});
