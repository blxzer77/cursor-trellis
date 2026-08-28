import { afterEach, describe, expect, it, vi } from "vitest";

import { reportUpdateReadiness } from "../../src/utils/readiness.js";

describe("reportUpdateReadiness", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("warns unverified and does not throw when smoke failed", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(() =>
      reportUpdateReadiness({
        skipped: false,
        smartSearch: {
          command: "smart-search doctor --format json",
          ok: false,
          details: ["error=npm view failed"],
        },
        capabilities: [
          {
            id: "codebase-retrieval",
            ok: false,
            failures: ["Host-level command/package visibility smoke failed"],
            warnings: [],
            smokeCommands: ["npm view fast-context-mcp bin --json"],
          },
        ],
      }),
    ).not.toThrow();

    const text = warn.mock.calls.map((call) => String(call[0])).join("\n");
    expect(text).toMatch(/Smart Search readiness unverified/);
    expect(text).toMatch(/codebase-retrieval capability unverified/);
  });

  it("keeps --skip-readiness as an unverified maintainer hatch", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    reportUpdateReadiness({
      skipped: true,
      smartSearch: {
        command: "smart-search doctor --format json",
        ok: false,
        details: ["readiness skipped via --skip-readiness"],
      },
      capabilities: [],
    });

    const text = warn.mock.calls.map((call) => String(call[0])).join("\n");
    expect(text).toMatch(/framework readiness is not verified/);
  });
});
