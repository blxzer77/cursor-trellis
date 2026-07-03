import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { assessCstlDirectoryMigrate } from "../../src/utils/workflow-ownership.js";

describe("assessCstlDirectoryMigrate (conservative default)", () => {
  const tmpDirs: string[] = [];

  afterEach(() => {
    for (const dir of tmpDirs.splice(0)) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    }
  });

  function makeTmpDir(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cstl-migrate-"));
    tmpDirs.push(dir);
    return dir;
  }

  function writeTrellis(dir: string): void {
    fs.mkdirSync(path.join(dir, ".trellis"), { recursive: true });
  }

  // --- structural preconditions ---

  it("aborts when .cstl already exists", () => {
    const tmpDir = makeTmpDir();
    writeTrellis(tmpDir);
    fs.mkdirSync(path.join(tmpDir, ".cstl"), { recursive: true });
    expect(assessCstlDirectoryMigrate(tmpDir).ok).toBe(false);
  });

  it("aborts when .trellis absent (nothing to migrate)", () => {
    const tmpDir = makeTmpDir();
    const result = assessCstlDirectoryMigrate(tmpDir);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/No .trellis\/ directory to migrate/);
  });

  // --- positive fingerprints (F1/F2/F3) allow migrate when no upstream signal ---

  it("allows migrate when F1 (cstl-*.md command) present and no upstream", () => {
    const tmpDir = makeTmpDir();
    writeTrellis(tmpDir);
    fs.mkdirSync(path.join(tmpDir, ".cursor", "commands"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".cursor", "commands", "cstl-continue.md"),
      "# continue",
    );
    expect(assessCstlDirectoryMigrate(tmpDir).ok).toBe(true);
  });

  it("allows migrate when F2 (cstl-triage.mdc) present and no upstream", () => {
    const tmpDir = makeTmpDir();
    writeTrellis(tmpDir);
    fs.mkdirSync(path.join(tmpDir, ".cursor", "rules"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".cursor", "rules", "cstl-triage.mdc"),
      "# triage",
    );
    expect(assessCstlDirectoryMigrate(tmpDir).ok).toBe(true);
  });

  it("allows migrate when F3 (cstl-flavored cli_adapter.py) present and no upstream", () => {
    const tmpDir = makeTmpDir();
    writeTrellis(tmpDir);
    fs.mkdirSync(path.join(tmpDir, ".trellis", "scripts", "common"), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "scripts", "common", "cli_adapter.py"),
      'name = "cstl"\n',
    );
    expect(assessCstlDirectoryMigrate(tmpDir).ok).toBe(true);
  });

  // --- conservative default: no fingerprint => abort (protects scenario 2) ---

  it("aborts when no fingerprint (bare upstream .trellis/ runtime-only)", () => {
    const tmpDir = makeTmpDir();
    writeTrellis(tmpDir);
    const result = assessCstlDirectoryMigrate(tmpDir);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/fingerprint/i);
  });

  it("aborts when upstream Claude agent (U1) exists without cstl fingerprint", () => {
    const tmpDir = makeTmpDir();
    writeTrellis(tmpDir);
    fs.mkdirSync(path.join(tmpDir, ".claude", "agents"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".claude", "agents", "trellis-implement.md"),
      "# impl",
    );
    const result = assessCstlDirectoryMigrate(tmpDir);
    expect(result.ok).toBe(false);
    // No cstl fingerprint => hits the fingerprint branch first.
    expect(result.reason).toMatch(/fingerprint/i);
  });

  it("aborts when upstream Codex trellis agent (U2) exists without cstl fingerprint", () => {
    const tmpDir = makeTmpDir();
    writeTrellis(tmpDir);
    fs.mkdirSync(path.join(tmpDir, ".codex", "agents"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".codex", "agents", "trellis-research.toml"),
      "# research",
    );
    expect(assessCstlDirectoryMigrate(tmpDir).ok).toBe(false);
  });

  it("aborts when legacy cursor trellis-*.md (U4) exists without cstl fingerprint", () => {
    const tmpDir = makeTmpDir();
    writeTrellis(tmpDir);
    fs.mkdirSync(path.join(tmpDir, ".cursor", "commands"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".cursor", "commands", "trellis-continue.md"),
      "# legacy",
    );
    expect(assessCstlDirectoryMigrate(tmpDir).ok).toBe(false);
  });

  // --- mixed F + U => abort for manual split (design §3.3) ---

  it("aborts mixed layout: cstl fingerprint + upstream signal (manual split)", () => {
    const tmpDir = makeTmpDir();
    writeTrellis(tmpDir);
    // F1
    fs.mkdirSync(path.join(tmpDir, ".cursor", "commands"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".cursor", "commands", "cstl-continue.md"),
      "# continue",
    );
    // U1
    fs.mkdirSync(path.join(tmpDir, ".claude", "agents"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".claude", "agents", "trellis-implement.md"),
      "# impl",
    );
    const result = assessCstlDirectoryMigrate(tmpDir);
    expect(result.ok).toBe(false);
    expect(result.reason).toMatch(/Mixed layout/);
  });

  // --- F5 escape hatch ---

  it("F5 forceCstlMigrate overrides mixed-layout abort", () => {
    const tmpDir = makeTmpDir();
    writeTrellis(tmpDir);
    fs.mkdirSync(path.join(tmpDir, ".cursor", "commands"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".cursor", "commands", "cstl-continue.md"),
      "# continue",
    );
    fs.mkdirSync(path.join(tmpDir, ".claude", "agents"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".claude", "agents", "trellis-implement.md"),
      "# impl",
    );
    expect(
      assessCstlDirectoryMigrate(tmpDir, { forceCstlMigrate: true }).ok,
    ).toBe(true);
  });

  it("F5 does not override .cstl-already-exists", () => {
    const tmpDir = makeTmpDir();
    writeTrellis(tmpDir);
    fs.mkdirSync(path.join(tmpDir, ".cstl"), { recursive: true });
    expect(
      assessCstlDirectoryMigrate(tmpDir, { forceCstlMigrate: true }).ok,
    ).toBe(false);
  });

  it("F5 does not override .trellis-absent", () => {
    const tmpDir = makeTmpDir();
    expect(
      assessCstlDirectoryMigrate(tmpDir, { forceCstlMigrate: true }).ok,
    ).toBe(false);
  });

  it("F5 overrides no-fingerprint abort (0.2.x jump edge case)", () => {
    const tmpDir = makeTmpDir();
    writeTrellis(tmpDir);
    // No cstl fingerprint at all, but user explicitly forces.
    expect(
      assessCstlDirectoryMigrate(tmpDir, { forceCstlMigrate: true }).ok,
    ).toBe(true);
  });
});
