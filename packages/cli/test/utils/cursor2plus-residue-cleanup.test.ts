import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import {
  CURSOR2PLUS_RESIDUE_TARGETS,
  cleanupCursor2plusResidue,
  hasCursor2plusBundleResidue,
} from "../../src/utils/cursor2plus-residue-cleanup.js";
import { computeHash } from "../../src/utils/template-hash.js";

/**
 * Synthetic pristine bytes. Do not `git show` retired Cursor++ templates:
 * those blobs left the tree in P23, and rewritten / shallow clones have no
 * pre-rewrite SHA (CI fetch-depth: 1).
 */
const PRISTINE_PATCH = "# pristine cursor++ patch fixture\n";
const PRISTINE_README = "# pristine cursor++ readme fixture\n";
const PRISTINE_CMD = "# pristine cursor++ setup command fixture\n";

const TEST_TARGETS = [
  {
    pathTemplate: "{workflow}/local/cursor2plus/patch_wpelc8.py",
    allowedHashes: [computeHash(PRISTINE_PATCH)],
  },
  {
    pathTemplate: "{workflow}/local/cursor2plus/README.md",
    allowedHashes: [computeHash(PRISTINE_README)],
  },
  {
    pathTemplate: ".cursor/commands/cstl-cursor2plus-setup.md",
    allowedHashes: [computeHash(PRISTINE_CMD)],
  },
] as const;

function cleanup(
  cwd: string,
  extra: { dryRun?: boolean } = {},
): ReturnType<typeof cleanupCursor2plusResidue> {
  return cleanupCursor2plusResidue(cwd, { ...extra, targets: TEST_TARGETS });
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

  it("keeps a hash allow-list for retired Cursor++ paths (no git history)", () => {
    expect(CURSOR2PLUS_RESIDUE_TARGETS.length).toBeGreaterThan(0);
    for (const target of CURSOR2PLUS_RESIDUE_TARGETS) {
      expect(target.pathTemplate).toMatch(/cursor2plus|trellis-task-models|subagent-models/i);
      expect(target.allowedHashes.length).toBeGreaterThan(0);
      for (const hash of target.allowedHashes) {
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
      }
    }
  });

  it("deletes pristine managed files and preserves user-modified ones", () => {
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

    fs.writeFileSync(patchPath, PRISTINE_PATCH, "utf-8");
    fs.writeFileSync(readmePath, PRISTINE_README, "utf-8");
    fs.writeFileSync(cmdPath, "# user customized setup\n", "utf-8");

    expect(hasCursor2plusBundleResidue(tmpDir)).toBe(true);

    const dry = cleanup(tmpDir, { dryRun: true });
    expect(dry.deleted).toContain(".cstl/local/cursor2plus/patch_wpelc8.py");
    expect(dry.deleted).toContain(".cstl/local/cursor2plus/README.md");
    expect(dry.preservedModified).toContain(
      ".cursor/commands/cstl-cursor2plus-setup.md",
    );
    expect(fs.existsSync(patchPath)).toBe(true);

    const applied = cleanup(tmpDir);
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

  it("writes command file from pristine fixture bytes and deletes it", () => {
    const cmdPath = path.join(
      tmpDir,
      ".cursor",
      "commands",
      "cstl-cursor2plus-setup.md",
    );
    fs.writeFileSync(cmdPath, PRISTINE_CMD, "utf-8");
    const result = cleanup(tmpDir);
    expect(result.deleted).toContain(
      ".cursor/commands/cstl-cursor2plus-setup.md",
    );
    expect(fs.existsSync(cmdPath)).toBe(false);
  });

  it("never deletes user files under .cstl/middleware/", () => {
    const overlayPath = path.join(
      tmpDir,
      ".cstl",
      "middleware",
      "smart-search.yaml",
    );
    fs.mkdirSync(path.dirname(overlayPath), { recursive: true });
    const content = "id: smart-search\nprotocol: 1\nsource: user\n";
    fs.writeFileSync(overlayPath, content, "utf-8");

    const result = cleanup(tmpDir);
    expect(result.deleted.some((rel) => rel.includes("middleware"))).toBe(
      false,
    );
    expect(fs.readFileSync(overlayPath, "utf-8")).toBe(content);
  });
});
