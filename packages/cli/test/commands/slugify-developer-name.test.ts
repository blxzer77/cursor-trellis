/**
 * Unit tests for slugifyDeveloperName().
 *
 * Ensures arbitrary developer names produce filesystem-safe task directory
 * suffixes (task name format: `00-join-<slug>`). Must handle spaces,
 * punctuation, Unicode letters, npm scopes, and pure-symbol fallback cases.
 */

import { describe, it, expect } from "vitest";
import { slugifyDeveloperName } from "../../src/commands/init.js";

describe("slugifyDeveloperName()", () => {
  it("lowercases simple ASCII", () => {
    expect(slugifyDeveloperName("taosu")).toBe("taosu");
  });

  it("replaces spaces with hyphens", () => {
    expect(slugifyDeveloperName("Tao Su")).toBe("tao-su");
  });

  it("collapses npm scope punctuation to hyphens", () => {
    expect(slugifyDeveloperName("@user/nested")).toBe("user-nested");
  });

  it("preserves Unicode letters (non-empty, filesystem-safe)", () => {
    const result = slugifyDeveloperName("田中 太郎");
    expect(result).not.toBe("");
    expect(result).not.toBe("user");
    // Whitespace replaced, letters preserved
    expect(result).toContain("田中");
    expect(result).toContain("太郎");
    // No leading/trailing hyphens
    expect(result.startsWith("-")).toBe(false);
    expect(result.endsWith("-")).toBe(false);
  });

  it("pure-symbol input falls back to 'user'", () => {
    expect(slugifyDeveloperName("---")).toBe("user");
  });

  it("empty string falls back to 'user'", () => {
    expect(slugifyDeveloperName("")).toBe("user");
  });

  it("trims leading and trailing separators", () => {
    expect(slugifyDeveloperName("  bob  ")).toBe("bob");
    expect(slugifyDeveloperName("--bob--")).toBe("bob");
  });

  it("collapses runs of separators into one hyphen", () => {
    expect(slugifyDeveloperName("a   b")).toBe("a-b");
    expect(slugifyDeveloperName("a!!!@@b")).toBe("a-b");
  });
});
