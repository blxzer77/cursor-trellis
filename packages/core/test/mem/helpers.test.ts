/**
 * Pure-function unit tests for the mem retrieval primitives.
 *
 * These helpers don't touch the filesystem; strings / objects in, strings /
 * objects out. Migrated from the CLI `mem-helpers` suite when the logic moved
 * into `@mindfoldhq/trellis-core/mem`.
 */

import { describe, it, expect } from "vitest";

import { isBootstrapTurn, stripInjectionTags } from "../../src/mem/dialogue.js";
import { inRange, inRangeOverlap, sameProject } from "../../src/mem/filter.js";
import {
  chunkAround,
  relevanceScore,
  searchInDialogue,
} from "../../src/mem/search.js";
import type { MemFilter } from "../../src/mem/types.js";

// =============================================================================
// relevanceScore
// =============================================================================

describe("relevanceScore", () => {
  it("returns 0 when totalTurns is 0 (avoids divide-by-zero)", () => {
    expect(
      relevanceScore({
        count: 0,
        userCount: 0,
        asstCount: 0,
        totalTurns: 0,
        excerpts: [],
      }),
    ).toBe(0);
  });

  it("weights user hits ×3 vs assistant hits ×1", () => {
    const userOnly = relevanceScore({
      count: 1,
      userCount: 1,
      asstCount: 0,
      totalTurns: 10,
      excerpts: [],
    });
    const asstOnly = relevanceScore({
      count: 3,
      userCount: 0,
      asstCount: 3,
      totalTurns: 10,
      excerpts: [],
    });
    expect(userOnly).toBeCloseTo(0.3);
    expect(asstOnly).toBeCloseTo(0.3);
    const oneUser = relevanceScore({
      count: 1,
      userCount: 1,
      asstCount: 0,
      totalTurns: 10,
      excerpts: [],
    });
    const oneAsst = relevanceScore({
      count: 1,
      userCount: 0,
      asstCount: 1,
      totalTurns: 10,
      excerpts: [],
    });
    expect(oneUser).toBeGreaterThan(oneAsst);
  });

  it("normalizes by totalTurns so a tight short session beats a sprawling long one", () => {
    const tight = relevanceScore({
      count: 18,
      userCount: 18,
      asstCount: 0,
      totalTurns: 30,
      excerpts: [],
    });
    const sprawling = relevanceScore({
      count: 58,
      userCount: 58,
      asstCount: 0,
      totalTurns: 200,
      excerpts: [],
    });
    expect(tight).toBeGreaterThan(sprawling);
  });
});

// =============================================================================
// inRange / inRangeOverlap
// =============================================================================

describe("inRange", () => {
  const f: MemFilter = {
    since: new Date("2026-04-01"),
    until: new Date("2026-04-30T23:59:59.999Z"),
  };

  it("returns true when iso is undefined (no timestamp = don't filter)", () => {
    expect(inRange(undefined, f)).toBe(true);
  });

  it("includes timestamps inside the range", () => {
    expect(inRange("2026-04-15T12:00:00Z", f)).toBe(true);
  });

  it("excludes timestamps before since", () => {
    expect(inRange("2026-03-31T23:59:59Z", f)).toBe(false);
  });

  it("includes the last instant of until-day (end-of-day inclusive)", () => {
    expect(inRange("2026-04-30T23:59:59.500Z", f)).toBe(true);
  });

  it("returns true for unparseable iso strings (don't drop on parse error)", () => {
    expect(inRange("not-a-date", f)).toBe(true);
  });
});

describe("inRangeOverlap", () => {
  it("returns true when both endpoints are undefined (no filter applied)", () => {
    const f: MemFilter = { since: new Date("2026-05-01") };
    expect(inRangeOverlap(undefined, undefined, f)).toBe(true);
  });

  it("falls back to single-point semantics when only end is set", () => {
    const f: MemFilter = { since: new Date("2026-05-01") };
    expect(inRangeOverlap(undefined, "2026-04-01T00:00:00Z", f)).toBe(false);
    expect(inRangeOverlap(undefined, "2026-05-15T00:00:00Z", f)).toBe(true);
  });

  it("falls back to single-point semantics when only start is set", () => {
    const f: MemFilter = { until: new Date("2026-05-31T23:59:59.999Z") };
    expect(inRangeOverlap("2026-06-01T00:00:00Z", undefined, f)).toBe(false);
    expect(inRangeOverlap("2026-05-15T00:00:00Z", undefined, f)).toBe(true);
  });

  it("includes intervals that cross the left bound", () => {
    const f: MemFilter = { since: new Date("2026-05-01") };
    expect(
      inRangeOverlap("2026-04-25T00:00:00Z", "2026-05-05T00:00:00Z", f),
    ).toBe(true);
  });

  it("includes intervals that cross the right bound", () => {
    const f: MemFilter = { until: new Date("2026-05-31T23:59:59.999Z") };
    expect(
      inRangeOverlap("2026-05-25T00:00:00Z", "2026-06-05T00:00:00Z", f),
    ).toBe(true);
  });

  it("excludes intervals entirely before the window", () => {
    const f: MemFilter = { since: new Date("2026-05-01") };
    expect(
      inRangeOverlap("2026-04-01T00:00:00Z", "2026-04-05T00:00:00Z", f),
    ).toBe(false);
  });

  it("excludes intervals entirely after the window", () => {
    const f: MemFilter = { until: new Date("2026-05-31T23:59:59.999Z") };
    expect(
      inRangeOverlap("2026-06-01T00:00:00Z", "2026-06-05T00:00:00Z", f),
    ).toBe(false);
  });

  it("includes intervals fully embedded in the window", () => {
    const f: MemFilter = {
      since: new Date("2026-05-01"),
      until: new Date("2026-05-20T23:59:59.999Z"),
    };
    expect(
      inRangeOverlap("2026-05-10T00:00:00Z", "2026-05-12T00:00:00Z", f),
    ).toBe(true);
  });
});

// =============================================================================
// sameProject
// =============================================================================

describe("sameProject", () => {
  it("returns true when target is undefined (no scoping = match all)", () => {
    expect(sameProject("/anything", undefined)).toBe(true);
  });

  it("returns false when sessionCwd is undefined but target is set", () => {
    expect(sameProject(undefined, "/repo")).toBe(false);
  });

  it("returns true for exact path match", () => {
    expect(sameProject("/Users/me/repo", "/Users/me/repo")).toBe(true);
  });

  it("returns true when sessionCwd is a subdirectory of target", () => {
    expect(sameProject("/Users/me/repo/src", "/Users/me/repo")).toBe(true);
  });

  it("returns false for sibling paths sharing a prefix", () => {
    expect(sameProject("/Users/me/repo2", "/Users/me/repo")).toBe(false);
  });
});

// =============================================================================
// isBootstrapTurn
// =============================================================================

describe("isBootstrapTurn", () => {
  it("flags AGENTS.md preamble turns", () => {
    expect(
      isBootstrapTurn("# AGENTS.md instructions for /repo\n\nblah", 200),
    ).toBe(true);
  });

  it("flags large INSTRUCTIONS-only turns (Codex's first user message)", () => {
    expect(
      isBootstrapTurn("<INSTRUCTIONS>\nblah blah blah\n</INSTRUCTIONS>", 5000),
    ).toBe(true);
  });

  it("does NOT flag short turns even if they start with INSTRUCTIONS", () => {
    expect(isBootstrapTurn("<INSTRUCTIONS>fine</INSTRUCTIONS>", 100)).toBe(
      false,
    );
  });

  it("does NOT flag a normal user turn", () => {
    expect(isBootstrapTurn("hey can you help me debug this", 30)).toBe(false);
  });
});

// =============================================================================
// stripInjectionTags
// =============================================================================

describe("stripInjectionTags", () => {
  it("removes <system-reminder>...</system-reminder> blocks", () => {
    const out = stripInjectionTags(
      "before<system-reminder>secret</system-reminder>after",
    );
    expect(out).toBe("beforeafter");
  });

  it("strips multiple known injection tags case-insensitively", () => {
    const out = stripInjectionTags(
      "x<INSTRUCTIONS>foo</INSTRUCTIONS>y<workflow-state>bar</workflow-state>z",
    );
    expect(out).toBe("xyz");
  });

  it("strips AGENTS.md preamble up to the first natural paragraph", () => {
    const out = stripInjectionTags(
      "# AGENTS.md instructions for /repo\nrules rules rules\n\nReal user content here.",
    );
    expect(out).toContain("Real user content here.");
    expect(out).not.toContain("AGENTS.md");
  });

  it("preserves regular text without injection tags", () => {
    const text = "hello, this is a normal user turn about <regular> markdown";
    expect(stripInjectionTags(text)).toBe(text);
  });

  it("collapses runs of 3+ newlines to exactly 2 (paragraph break)", () => {
    const out = stripInjectionTags("a\n\n\n\nb");
    expect(out).toBe("a\n\nb");
  });
});

// =============================================================================
// chunkAround
// =============================================================================

describe("chunkAround", () => {
  it("returns the paragraph containing the hit (paragraph-aligned chunk)", () => {
    const text = "para A\n\npara B with hit\n\npara C";
    const hitIdx = text.indexOf("hit");
    const r = chunkAround(text, hitIdx, 400);
    expect(text.slice(r.start, r.end)).toBe("para B with hit");
    expect(r.truncated).toBe(false);
  });

  it("returns the full text when there are no paragraph breaks", () => {
    const text = "single paragraph with the hit inside it";
    const hitIdx = text.indexOf("hit");
    const r = chunkAround(text, hitIdx, 400);
    expect(r.start).toBe(0);
    expect(r.end).toBe(text.length);
  });

  it("falls back to a centered window when paragraph exceeds maxChars", () => {
    const huge = "x".repeat(1000) + "HIT" + "x".repeat(1000);
    const hitIdx = huge.indexOf("HIT");
    const r = chunkAround(huge, hitIdx, 100);
    expect(r.truncated).toBe(true);
    expect(r.end - r.start).toBeLessThanOrEqual(100);
    expect(hitIdx).toBeGreaterThanOrEqual(r.start);
    expect(hitIdx).toBeLessThan(r.end);
  });
});

// =============================================================================
// searchInDialogue
// =============================================================================

describe("searchInDialogue", () => {
  it("returns zero hits and empty excerpts on empty keyword", () => {
    const turns = [{ role: "user" as const, text: "hello world" }];
    const r = searchInDialogue(turns, "");
    expect(r.count).toBe(0);
    expect(r.excerpts).toEqual([]);
    expect(r.totalTurns).toBe(1);
  });

  it("counts case-insensitive substring matches across user and assistant", () => {
    const turns = [
      { role: "user" as const, text: "I want to discuss MEMORY usage" },
      { role: "assistant" as const, text: "Memory is allocated on heap." },
      { role: "user" as const, text: "no relevant content here" },
    ];
    const r = searchInDialogue(turns, "memory");
    expect(r.userCount).toBe(1);
    expect(r.asstCount).toBe(1);
    expect(r.count).toBe(2);
  });

  it("requires AND of all whitespace-split tokens (multi-token AND grep)", () => {
    const turns = [
      { role: "user" as const, text: "memory leak in heap allocator" },
      { role: "user" as const, text: "memory only, no other word" },
      { role: "user" as const, text: "kombucha only, off-topic" },
    ];
    const r = searchInDialogue(turns, "memory leak");
    expect(r.count).toBe(2);
    expect(r.userCount).toBe(2);
  });

  it("places user excerpts before assistant excerpts (user intent ranks higher)", () => {
    const turns = [
      { role: "assistant" as const, text: "FOO appears here" },
      { role: "user" as const, text: "FOO appears here too" },
    ];
    const r = searchInDialogue(turns, "FOO");
    expect(r.excerpts.length).toBeGreaterThan(0);
    expect(r.excerpts[0]?.role).toBe("user");
  });

  it("caps excerpts at maxExcerpts", () => {
    const turns = Array.from({ length: 10 }, (_, i) => ({
      role: "user" as const,
      text: `turn ${i} contains FOO`,
    }));
    const r = searchInDialogue(turns, "FOO", 3);
    expect(r.excerpts.length).toBeLessThanOrEqual(3);
  });
});
