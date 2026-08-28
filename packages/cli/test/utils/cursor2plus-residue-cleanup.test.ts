import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import {
  cleanupCursor2plusResidue,
  hasCursor2plusBundleResidue,
} from "../../src/utils/cursor2plus-residue-cleanup.js";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "../../../..");

/** Pre-P23 commit that still contains Cursor++ template bytes for hash fixtures. */
const PRE_P23 = "2dbb8e456aa28d8abf0e371c35e46699afb9de1e";

function gitShow(repoRelPath: string): string {
  return execSync(`git -C "${repoRoot}" show ${PRE_P23}:${repoRelPath}`, {
    encoding: "utf-8",
  });
}

describe("cleanupCursor2plusResidue (P23 hash-safe)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-c2p-residue-"));
    fs.mkdirSync(path.join(tmpDir, ".cstl", "local", "cursor2plus"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(tmpDir, ".cursor", "commands"), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("deletes pristine managed files and preserves user-modified ones", () => {
    const pristinePatch = gitShow(
      "packages/cli/src/templates/trellis/local/patch_wpelc8.py",
    );

    const patchPath = path.join(
      tmpDir,
      ".cstl",
      "local",
      "cursor2plus",
      "patch_wpelc8.py",
    );
    const readmePath = path.join(
      tmpDir,
      ".cstl",
      "local",
      "cursor2plus",
      "README.md",
    );
    const cmdPath = path.join(
      tmpDir,
      ".cursor",
      "commands",
      "cstl-cursor2plus-setup.md",
    );

    fs.writeFileSync(patchPath, pristinePatch, "utf-8");
    fs.writeFileSync(
      readmePath,
      gitShow("packages/cli/src/templates/trellis/local/README.md"),
      "utf-8",
    );
    fs.writeFileSync(cmdPath, "# user customized setup\n", "utf-8");

    expect(hasCursor2plusBundleResidue(tmpDir)).toBe(true);

    const dry = cleanupCursor2plusResidue(tmpDir, { dryRun: true });
    expect(dry.deleted).toContain(".cstl/local/cursor2plus/patch_wpelc8.py");
    expect(dry.deleted).toContain(".cstl/local/cursor2plus/README.md");
    expect(dry.preservedModified).toContain(
      ".cursor/commands/cstl-cursor2plus-setup.md",
    );
    expect(fs.existsSync(patchPath)).toBe(true);

    const applied = cleanupCursor2plusResidue(tmpDir);
    expect(applied.deleted).toContain(
      ".cstl/local/cursor2plus/patch_wpelc8.py",
    );
    expect(applied.deleted).toContain(".cstl/local/cursor2plus/README.md");
    expect(applied.preservedModified).toContain(
      ".cursor/commands/cstl-cursor2plus-setup.md",
    );
    expect(fs.existsSync(patchPath)).toBe(false);
    expect(fs.existsSync(readmePath)).toBe(false);
    expect(fs.existsSync(cmdPath)).toBe(true);
    expect(fs.readFileSync(cmdPath, "utf-8")).toContain("user customized");
  });

  it("writes command file from pristine template bytes and deletes it", () => {
    const cmdPath = path.join(
      tmpDir,
      ".cursor",
      "commands",
      "cstl-cursor2plus-setup.md",
    );
    fs.writeFileSync(
      cmdPath,
      gitShow("packages/cli/src/templates/cursor/commands/cursor2plus-setup.md"),
      "utf-8",
    );
    const result = cleanupCursor2plusResidue(tmpDir);
    expect(result.deleted).toContain(
      ".cursor/commands/cstl-cursor2plus-setup.md",
    );
    expect(fs.existsSync(cmdPath)).toBe(false);
  });
});
