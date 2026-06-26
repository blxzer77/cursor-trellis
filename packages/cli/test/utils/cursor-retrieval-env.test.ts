import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ENV_BYOK,
  ENV_NATIVE,
  ENV_UNKNOWN,
  ccursorHome,
  detectCursorRetrievalEnv,
  detectCursorRetrievalEnvInfo,
  isByokConservative,
  semanticRouteSpec,
} from "../../src/utils/cursor-retrieval-env.js";

describe("cursor retrieval env detection", () => {
  const savedByok = process.env.TRELLIS_CURSOR_BYOK;
  const savedHome = process.env.TRELLIS_CCURSOR_HOME;

  beforeEach(() => {
    delete process.env.TRELLIS_CURSOR_BYOK;
    delete process.env.TRELLIS_CCURSOR_HOME;
  });

  afterEach(() => {
    if (savedByok === undefined) {
      delete process.env.TRELLIS_CURSOR_BYOK;
    } else {
      process.env.TRELLIS_CURSOR_BYOK = savedByok;
    }
    if (savedHome === undefined) {
      delete process.env.TRELLIS_CCURSOR_HOME;
    } else {
      process.env.TRELLIS_CCURSOR_HOME = savedHome;
    }
  });

  it("TRELLIS_CURSOR_BYOK=1 forces byok", () => {
    process.env.TRELLIS_CURSOR_BYOK = "1";
    expect(detectCursorRetrievalEnv()).toBe(ENV_BYOK);
    expect(detectCursorRetrievalEnvInfo()).toMatchObject({
      env: ENV_BYOK,
      source: "env-override",
      byokMode: 1,
    });
  });

  it("TRELLIS_CURSOR_BYOK=0 forces native", () => {
    process.env.TRELLIS_CURSOR_BYOK = "0";
    expect(detectCursorRetrievalEnv()).toBe(ENV_NATIVE);
    expect(detectCursorRetrievalEnvInfo()).toMatchObject({
      env: ENV_NATIVE,
      source: "env-override",
      byokMode: 0,
    });
  });

  it("unset env with missing routes.json yields unknown", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-ccursor-"));
    process.env.TRELLIS_CCURSOR_HOME = tmp;
    expect(fs.existsSync(path.join(ccursorHome(), "routes.json"))).toBe(false);
    expect(detectCursorRetrievalEnv()).toBe(ENV_UNKNOWN);
    expect(detectCursorRetrievalEnvInfo().source).toBe("routes-not-found");
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("unset env reads byokMode from routes.json", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-ccursor-"));
    process.env.TRELLIS_CCURSOR_HOME = tmp;
    fs.writeFileSync(
      path.join(tmp, "routes.json"),
      JSON.stringify({ byokMode: 1, redirect: [] }),
      "utf8",
    );
    expect(detectCursorRetrievalEnv()).toBe(ENV_BYOK);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("isByokConservative treats unknown like BYOK for semantic routing", () => {
    expect(isByokConservative(ENV_BYOK)).toBe(true);
    expect(isByokConservative(ENV_UNKNOWN)).toBe(true);
    expect(isByokConservative(ENV_NATIVE)).toBe(false);
  });
});

describe("semanticRouteSpec Native/BYOK/unknown compliance", () => {
  it("BYOK plan requires fast_context_search, forbids built-in semantic", () => {
    const spec = semanticRouteSpec(ENV_BYOK);
    expect(spec.semanticBackend).toBe("fast-context-mcp");
    expect(spec.commands.join(" ")).toMatch(/fast_context_search/);
    expect(spec.commands.join(" ")).not.toMatch(/@codebase|built-in semantic/i);
    expect(spec.platformNative).toBe(false);
  });

  it("Native plan uses built-in semantic, forbids fast-context MCP", () => {
    const spec = semanticRouteSpec(ENV_NATIVE);
    expect(spec.semanticBackend).toBe("cursor-builtin");
    expect(spec.commands.join(" ")).toMatch(/@codebase|built-in semantic/i);
    expect(spec.commands.join(" ")).not.toMatch(/fast_context_search/);
    expect(spec.platformNative).toBe(true);
  });

  it("unknown uses conservative BYOK fast-context route with caveat", () => {
    const spec = semanticRouteSpec(ENV_UNKNOWN);
    expect(spec.semanticBackend).toBe("fast-context-mcp");
    expect(spec.commands.join(" ")).toMatch(/fast_context_search/);
    expect(spec.rationaleSuffix).toMatch(/Unknown cursorEnv/i);
    expect(spec.platformNative).toBe(false);
  });
});
