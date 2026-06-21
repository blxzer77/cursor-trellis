import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cliDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

describe("check-router-copy-sync", () => {
  it("hash-only guard passes for Trellis dogfood copies", () => {
    const out = execSync("node scripts/check-router-copy-sync.js --hash-only", {
      cwd: cliDir,
      encoding: "utf-8",
    });
    expect(out).toContain("All sync guard checks passed");
  });
});