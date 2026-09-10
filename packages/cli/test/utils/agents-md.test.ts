import { describe, expect, it } from "vitest";

import {
  FOREIGN_TRELLIS_BLOCK_END,
  FOREIGN_TRELLIS_BLOCK_START,
  LEGACY_CSTL_BLOCK_END,
  LEGACY_CSTL_BLOCK_START,
  PACTILE_BLOCK_END,
  PACTILE_BLOCK_START,
  extractBlock,
  hasForeignTrellisBlock,
  hasLegacyCstlBlock,
  hasPactileBlock,
  insertPactileManagedBlock,
  removePactileManagedBlock,
} from "../../src/utils/agents-md.js";

const pactileBlock = `${PACTILE_BLOCK_START}\n# Pactile managed\n${PACTILE_BLOCK_END}`;
const nextPactileBlock = `${PACTILE_BLOCK_START}\n# Updated Pactile managed\n${PACTILE_BLOCK_END}`;
const cstlBlock = `${LEGACY_CSTL_BLOCK_START}\n# legacy owned\n${LEGACY_CSTL_BLOCK_END}`;
const foreignBlock = `${FOREIGN_TRELLIS_BLOCK_START}\n# upstream owned\n${FOREIGN_TRELLIS_BLOCK_END}`;

describe("Pactile AGENTS.md managed block", () => {
  it("inserts one canonical block and is idempotent", () => {
    const once = insertPactileManagedBlock("# User", pactileBlock);
    const twice = insertPactileManagedBlock(once, pactileBlock);

    expect(twice).toBe(once);
    expect(hasPactileBlock(twice)).toBe(true);
    expect(twice.match(/<!-- PACTILE:START -->/g)).toHaveLength(1);
  });

  it("replaces only the canonical span", () => {
    const existing = `# Header\n\n${pactileBlock}\n\n# Footer\n`;
    expect(insertPactileManagedBlock(existing, nextPactileBlock)).toBe(
      `# Header\n\n${nextPactileBlock}\n\n# Footer\n`,
    );
  });

  it("preserves a foreign TRELLIS block byte-for-byte", () => {
    const existing = `prefix\r\n${foreignBlock}\r\nsuffix`;
    const result = insertPactileManagedBlock(existing, pactileBlock);

    expect(result).toContain(existing);
    expect(extractBlock(result, FOREIGN_TRELLIS_BLOCK_START, FOREIGN_TRELLIS_BLOCK_END)).toBe(
      foreignBlock,
    );
    expect(hasForeignTrellisBlock(result)).toBe(true);
    expect(hasPactileBlock(result)).toBe(true);
  });

  it("will not infer ownership from legacy CSTL markers", () => {
    expect(insertPactileManagedBlock(cstlBlock, pactileBlock)).toBe(cstlBlock);
    expect(hasLegacyCstlBlock(cstlBlock)).toBe(true);
  });

  it("migrates an owned CSTL span only with explicit evidence", () => {
    const existing = `before\n${cstlBlock}\nafter`;
    const result = insertPactileManagedBlock(existing, pactileBlock, {
      migrateOwnedLegacyCstl: true,
    });

    expect(result).toBe(`before\n${pactileBlock}\nafter`);
    expect(hasLegacyCstlBlock(result)).toBe(false);
    expect(hasPactileBlock(result)).toBe(true);
  });

  it("fails closed on duplicate or mixed owned markers", () => {
    const duplicate = `${pactileBlock}\n${pactileBlock}`;
    const mixed = `${pactileBlock}\n${cstlBlock}`;
    expect(insertPactileManagedBlock(duplicate, nextPactileBlock)).toBe(
      duplicate,
    );
    expect(
      insertPactileManagedBlock(mixed, nextPactileBlock, {
        migrateOwnedLegacyCstl: true,
      }),
    ).toBe(mixed);
  });

  it("removes only the canonical block", () => {
    const existing = `before\n${foreignBlock}\n${pactileBlock}\nafter`;
    const result = removePactileManagedBlock(existing);

    expect(result).not.toContain(PACTILE_BLOCK_START);
    expect(result).toContain(foreignBlock);
  });
});
