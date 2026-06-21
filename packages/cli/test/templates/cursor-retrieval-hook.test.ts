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

  it("inject-retrieval-plan.py emits dual-schema additional_context", () => {
    const hook = getSharedHookScripts().find(
      (h) => h.name === "inject-retrieval-plan.py",
    );
    expect(hook?.content).toContain("additional_context");
    expect(hook?.content).toContain("beforeSubmitPrompt");
    expect(hook?.content).toContain("## 代码库检索计划");
  });

  it("retrieval-routing.mdc mentions beforeSubmitPrompt injection", () => {
    const rule = readFileSync(
      join(templatesRoot, "cursor/rules/retrieval-routing.mdc"),
      "utf-8",
    );
    expect(rule).toMatch(/beforeSubmitPrompt|inject-retrieval-plan/);
  });
});