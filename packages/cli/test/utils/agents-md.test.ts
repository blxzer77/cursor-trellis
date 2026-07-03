import { describe, expect, it } from "vitest";

import {
  CSTL_BLOCK_END,
  CSTL_BLOCK_START,
  LEGACY_TRELLIS_BLOCK_END,
  LEGACY_TRELLIS_BLOCK_START,
  insertCstlManagedBlock,
  hasCstlBlock,
  hasLegacyTrellisBlock,
} from "../../src/utils/agents-md.js";

const CSTL_BLOCK = `${CSTL_BLOCK_START}\n# cursor-trellis managed\n${CSTL_BLOCK_END}`;
const TRELLIS_BLOCK = `${LEGACY_TRELLIS_BLOCK_START}\n# upstream trellis managed\n${LEGACY_TRELLIS_BLOCK_END}`;
const TEMPLATE_WITH_CSTL = `${CSTL_BLOCK_START}\n# cursor-trellis managed\n${CSTL_BLOCK_END}`;

describe("insertCstlManagedBlock", () => {
  it("appends CSTL block when no managed block exists", () => {
    const existing = "# My project\n\nSome user content.";
    const result = insertCstlManagedBlock(existing, TEMPLATE_WITH_CSTL);
    expect(hasCstlBlock(result)).toBe(true);
    expect(hasLegacyTrellisBlock(result)).toBe(false);
    expect(result).toContain("Some user content.");
    // User content preserved before the appended block.
    expect(result.indexOf("Some user content.")).toBeLessThan(
      result.indexOf(CSTL_BLOCK_START),
    );
  });

  it("replaces existing CSTL block in place, preserving surrounding user content", () => {
    const existing = `# Header\n\n${CSTL_BLOCK_START}\n# OLD cstl content\n${CSTL_BLOCK_END}\n\n# Footer`;
    const result = insertCstlManagedBlock(existing, TEMPLATE_WITH_CSTL);
    expect(hasCstlBlock(result)).toBe(true);
    expect(result).not.toContain("OLD cstl content");
    expect(result).toContain("# Header");
    expect(result).toContain("# Footer");
  });

  it("coexists: inserts CSTL block after legacy TRELLIS block without modifying it", () => {
    const existing = `# Project\n\n${TRELLIS_BLOCK}\n\n# User footer`;
    const result = insertCstlManagedBlock(existing, TEMPLATE_WITH_CSTL);
    // Both blocks present.
    expect(hasCstlBlock(result)).toBe(true);
    expect(hasLegacyTrellisBlock(result)).toBe(true);
    // TRELLIS block content untouched.
    expect(result).toContain("# upstream trellis managed");
    // CSTL block placed after TRELLIS block.
    expect(result.indexOf(LEGACY_TRELLIS_BLOCK_END)).toBeLessThan(
      result.indexOf(CSTL_BLOCK_START),
    );
    // User footer preserved after CSTL block.
    expect(result).toContain("# User footer");
    expect(result.indexOf(CSTL_BLOCK_END)).toBeLessThan(
      result.indexOf("# User footer"),
    );
  });

  it("idempotent: running twice on a coexistence file yields the same CSTL block", () => {
    const existing = `# Project\n\n${TRELLIS_BLOCK}\n\n# Footer`;
    const once = insertCstlManagedBlock(existing, TEMPLATE_WITH_CSTL);
    const twice = insertCstlManagedBlock(once, TEMPLATE_WITH_CSTL);
    // Only one CSTL block remains after the second pass (replace-in-place).
    expect(twice.match(new RegExp(CSTL_BLOCK_START, "g"))?.length).toBe(1);
    expect(twice).toBe(once);
  });

  it("falls back to whole templateContent when template has no CSTL markers", () => {
    const existing = "# Project";
    const result = insertCstlManagedBlock(existing, "# bare template");
    expect(result).toContain("# bare template");
  });
});

describe("hasCstlBlock / hasLegacyTrellisBlock", () => {
  it("detects cstl block", () => {
    expect(hasCstlBlock(CSTL_BLOCK)).toBe(true);
    expect(hasCstlBlock(TRELLIS_BLOCK)).toBe(false);
    expect(hasCstlBlock("# nothing")).toBe(false);
  });

  it("detects legacy trellis block", () => {
    expect(hasLegacyTrellisBlock(TRELLIS_BLOCK)).toBe(true);
    expect(hasLegacyTrellisBlock(CSTL_BLOCK)).toBe(false);
  });
});
