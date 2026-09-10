import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  discoverRuntimeRoots,
  resolveCanonicalPaths,
  assertCanonicalWriteTarget,
  normalizeRuntimeRelativePath,
  caseFoldComponent,
} from "../../../src/pactile/runtime/paths.js";
import { resolveWorkflowDirName } from "../../../src/utils/workflow-dir.js";

const roots: string[] = [];
function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pactile-runtime-"));
  roots.push(root);
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

describe("canonical discovery and legacy compatibility", () => {
  it("discovers a fresh project without writing and keeps legacy precedence separate", () => {
    const root = fixture();
    expect(resolveCanonicalPaths(root).installStatePath).toBe(
      path.join(root, ".pactile/runtime/install-state.json"),
    );
    expect(discoverRuntimeRoots(root)).toEqual({
      canonical: { root: ".pactile", present: false, access: "canonical-only" },
      legacy: [
        { kind: "cstl", root: ".cstl", present: false, access: "read-only" },
        {
          kind: "trellis",
          root: ".trellis",
          present: false,
          access: "read-only",
        },
      ],
      diagnostics: [],
    });
    expect(fs.readdirSync(root)).toEqual([]);
    fs.mkdirSync(path.join(root, ".trellis"));
    expect(resolveWorkflowDirName(root)).toBe(".trellis");
    fs.mkdirSync(path.join(root, ".cstl"));
    fs.mkdirSync(path.join(root, ".pactile"));
    expect(resolveWorkflowDirName(root)).toBe(".pactile");
    expect(
      discoverRuntimeRoots(root).legacy.map((item) => item.present),
    ).toEqual([true, true]);
    expect(discoverRuntimeRoots(root).canonical.present).toBe(true);
  });
});

describe("canonical write boundary", () => {
  it("rejects legacy, escapes and portable filename aliases while allowing canonical files", () => {
    const root = fixture();
    expect(
      assertCanonicalWriteTarget(root, ".pactile/runtime/install-state.json"),
    ).toBe(path.join(root, ".pactile/runtime/install-state.json"));
    for (const name of [".cstl/task.json", ".TRELLIS/task.json"])
      expect(() => assertCanonicalWriteTarget(root, name)).toThrow(
        "legacy-write-denied",
      );
    for (const name of [
      "../escape",
      ".pactile/../escape",
      ".pactile/nul.json",
      ".pactile/file:stream",
      ".pactile/name.",
      "D:relative",
    ]) {
      expect(() => assertCanonicalWriteTarget(root, name)).toThrow(
        "outside-project",
      );
    }
    expect(normalizeRuntimeRelativePath(".pactile\\cafe\u0301")).toBe(
      ".pactile/café",
    );
    expect(caseFoldComponent("Straße Σς ﬃ İ ı")).toBe(
      "strasse σσ ffi i\u0307 ı",
    );
  });

  it("fails closed on canonical casing variants and NFC/casefold sibling aliases", () => {
    const root = fixture();
    fs.mkdirSync(path.join(root, ".PACTILE"));
    expect(discoverRuntimeRoots(root).diagnostics).toContainEqual({
      code: "canonical-collision",
      root: ".pactile",
    });
    expect(() => assertCanonicalWriteTarget(root, ".pactile/new")).toThrow(
      "canonical-collision",
    );
    const normalized = fixture();
    fs.mkdirSync(path.join(normalized, ".pactile"));
    fs.writeFileSync(
      path.join(normalized, ".pactile/cafe\u0301"),
      "foreign NFD bytes",
    );
    expect(() =>
      assertCanonicalWriteTarget(normalized, ".pactile/café"),
    ).toThrow("canonical-collision");
    fs.writeFileSync(
      path.join(normalized, ".pactile/straße"),
      "foreign casefold bytes",
    );
    expect(() =>
      assertCanonicalWriteTarget(normalized, ".pactile/STRASSE"),
    ).toThrow("canonical-collision");
    expect(
      fs.readFileSync(path.join(normalized, ".pactile/straße"), "utf8"),
    ).toBe("foreign casefold bytes");
  });

  it("rejects a directory listing with both canonical spellings even on case-insensitive Windows", () => {
    const root = fixture();
    fs.mkdirSync(path.join(root, ".pactile"));
    // Boundary fixture: default Windows directories cannot contain both spellings
    // without privileged per-directory setup. The real variant is tested above.
    const io = {
      ...fs,
      readdirSync: (() => [".pactile", ".PACTILE"]) as typeof fs.readdirSync,
    };
    expect(() =>
      assertCanonicalWriteTarget(root, ".pactile/state", io),
    ).toThrow("canonical-collision");
    expect(discoverRuntimeRoots(root, io).diagnostics).toContainEqual({
      code: "canonical-collision",
      root: ".pactile",
    });
  });

  it("rejects real junction/symlink escapes and hardlinks without changing the external tree", () => {
    const root = fixture();
    const outside = fixture();
    fs.writeFileSync(path.join(outside, "protected.txt"), "foreign");
    fs.mkdirSync(path.join(root, ".pactile"));
    fs.symlinkSync(
      outside,
      path.join(root, ".pactile/jump"),
      process.platform === "win32" ? "junction" : "dir",
    );
    expect(() =>
      assertCanonicalWriteTarget(root, ".pactile/jump/protected.txt"),
    ).toThrow("link-escape");
    fs.linkSync(
      path.join(outside, "protected.txt"),
      path.join(root, ".pactile/hardlinked.txt"),
    );
    expect(() =>
      assertCanonicalWriteTarget(root, ".pactile/hardlinked.txt"),
    ).toThrow("link-escape");
    const linkedRoot = fixture();
    fs.symlinkSync(
      outside,
      path.join(linkedRoot, ".pactile"),
      process.platform === "win32" ? "junction" : "dir",
    );
    expect(discoverRuntimeRoots(linkedRoot).diagnostics).toContainEqual({
      code: "link-escape",
      root: ".pactile",
    });
    expect(() =>
      assertCanonicalWriteTarget(linkedRoot, ".pactile/new"),
    ).toThrow("link-escape");
    expect(fs.readFileSync(path.join(outside, "protected.txt"), "utf8")).toBe(
      "foreign",
    );
    expect(fs.readdirSync(outside)).toEqual(["protected.txt"]);
  });
});
