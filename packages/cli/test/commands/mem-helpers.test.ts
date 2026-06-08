/**
 * Tier-1 unit tests for the `trellis mem` CLI-layer helpers.
 *
 * The reusable retrieval / search / cleaning primitives moved to
 * `@mindfoldhq/trellis-core/mem` and are covered by `packages/core/test/mem/*`.
 * What remains here is CLI-only: argv parsing, flag → core-filter translation,
 * and terminal formatting.
 */

import { describe, it, expect } from "vitest";

import {
  parseArgv,
  buildFilter,
  shortDate,
  shortPath,
} from "../../src/commands/mem.js";

// =============================================================================
// parseArgv
// =============================================================================

describe("parseArgv", () => {
  it("defaults cmd to 'list' when argv is empty", () => {
    const r = parseArgv([]);
    expect(r.cmd).toBe("list");
    expect(r.positional).toEqual([]);
    expect(r.flags).toEqual({});
  });

  it("collects positional args after the command", () => {
    const r = parseArgv(["search", "memory", "leak"]);
    expect(r.cmd).toBe("search");
    expect(r.positional).toEqual(["memory", "leak"]);
  });

  it("parses --flag value pairs and standalone --flag as boolean", () => {
    const r = parseArgv([
      "list",
      "--platform",
      "claude",
      "--global",
      "--limit",
      "10",
    ]);
    expect(r.flags.platform).toBe("claude");
    expect(r.flags.global).toBe(true);
    expect(r.flags.limit).toBe("10");
  });

  it("treats trailing --flag (no value) as boolean true", () => {
    const r = parseArgv(["list", "--json"]);
    expect(r.flags.json).toBe(true);
  });
});

// =============================================================================
// buildFilter
// =============================================================================

describe("buildFilter", () => {
  it("defaults platform to 'all' and limit to 50, scoping to cwd", () => {
    const f = buildFilter({});
    expect(f.platform).toBe("all");
    expect(f.limit).toBe(50);
    expect(f.cwd).toBe(process.cwd());
    expect(f.since).toBeUndefined();
    expect(f.until).toBeUndefined();
  });

  it("--global drops the cwd scope", () => {
    const f = buildFilter({ global: true });
    expect(f.cwd).toBeUndefined();
  });

  it("parses --since as inclusive lower bound and --until as end-of-day UTC", () => {
    const f = buildFilter({ since: "2026-04-01", until: "2026-04-30" });
    expect(f.since?.toISOString()).toBe("2026-04-01T00:00:00.000Z");
    // until gets `T23:59:59.999Z` appended so the filter is inclusive of the
    // entire day, not midnight (off-by-one trap the PRD called out).
    expect(f.until?.toISOString()).toBe("2026-04-30T23:59:59.999Z");
  });

  it("--cwd overrides process.cwd() and resolves relative paths", () => {
    const f = buildFilter({ cwd: "/some/abs/path" });
    expect(f.cwd).toBe("/some/abs/path");
  });
});

// =============================================================================
// shortDate / shortPath
// =============================================================================

describe("shortDate", () => {
  it("returns blank padding when iso is undefined", () => {
    expect(shortDate(undefined)).toBe("         ");
  });

  it("trims iso to 'YYYY-MM-DD HH:MM' and replaces T with space", () => {
    expect(shortDate("2026-04-15T13:30:45.123Z")).toBe("2026-04-15 13:30");
  });

  it("preserves a too-short iso without crashing", () => {
    expect(shortDate("2026")).toBe("2026");
  });
});

describe("shortPath", () => {
  it("returns '(no cwd)' for undefined", () => {
    expect(shortPath(undefined)).toBe("(no cwd)");
  });

  it("replaces $HOME with ~", async () => {
    const os = await import("node:os");
    const home = os.homedir();
    expect(shortPath(`${home}/projects/foo`)).toBe("~/projects/foo");
  });

  it("leaves paths outside HOME untouched", () => {
    expect(shortPath("/etc/hosts")).toBe("/etc/hosts");
  });
});
