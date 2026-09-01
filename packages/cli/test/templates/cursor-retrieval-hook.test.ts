import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getHooksConfig } from "../../src/templates/cursor/index.js";
import { getSharedHookScripts } from "../../src/templates/shared-hooks/index.js";

const templatesRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "src",
  "templates",
);

describe("cursor retrieval plan hook", () => {
  it("hooks.json wires beforeSubmitPrompt to inject-retrieval-plan.py", () => {
    const parsed = JSON.parse(getHooksConfig()) as {
      hooks?: {
        beforeSubmitPrompt?: { command?: string; timeout?: number }[];
      };
    };
    const entry = parsed.hooks?.beforeSubmitPrompt?.[0];
    expect(entry?.command).toContain("inject-retrieval-plan.py");
    expect(entry?.timeout).toBeGreaterThanOrEqual(15);
  });

  it("inject-retrieval-plan.py is telemetry-only and does not claim prompt injection", () => {
    const hook = getSharedHookScripts().find(
      (h) => h.name === "inject-retrieval-plan.py",
    );
    const content = hook?.content ?? "";
    expect(content).toContain("telemetry-only");
    expect(content).toContain("beforeSubmitPrompt");
    expect(content).toContain("promptInjected");
    expect(content).toContain("additionalContextDelivered");
    expect(content).toContain("retrieval-extended");
    expect(content).toContain("context-progressive");
    expect(content).toContain("## 代码库检索计划");
    expect(content).not.toContain("已注入 Prompt");
    expect(content).not.toMatch(/"additional_context"\s*:/);
    expect(content).not.toMatch(/^\s*(?:from|import)\s+smart[_-]?search\b/m);
  });

  it("default Cursor rules are bootstrap-only", () => {
    const rule = readFileSync(
      join(templatesRoot, "cursor/rules/cstl-bootstrap.mdc"),
      "utf-8",
    );
    expect(rule).toContain("Event Bridge");
    expect(rule).not.toMatch(/alwaysApply rules \(triage/);
  });
});