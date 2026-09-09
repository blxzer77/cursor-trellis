import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ENV_UNKNOWN,
  detectCursorRetrievalEnv,
  detectCursorRetrievalEnvInfo,
} from "../../src/utils/cursor-retrieval-env.js";

afterEach(() => vi.unstubAllEnvs());

describe("legacy retrieval environment import path", () => {
  it("always returns neutral unknown", () => {
    expect(detectCursorRetrievalEnv()).toBe(ENV_UNKNOWN);
    expect(detectCursorRetrievalEnvInfo()).toEqual({
      env: "unknown",
      source: "neutral-compat",
      detail: null,
    });
  });

  it("does not vary with process environment", () => {
    const baseline = detectCursorRetrievalEnvInfo();
    vi.stubEnv("RETRIEVAL_ROUTE_OVERRIDE", "implementation-a");
    expect(detectCursorRetrievalEnvInfo()).toEqual(baseline);
  });

  it("contains no filesystem or environment probing", () => {
    const source = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../src/utils/cursor-retrieval-env.ts",
      ),
      "utf8",
    );
    expect(source).not.toMatch(/process\.env|readFile|homedir|routes\.json/);
  });
});
