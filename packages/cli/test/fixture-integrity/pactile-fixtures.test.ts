import { createHash } from "node:crypto";
import {
  cpSync,
  existsSync,
  lstatSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const FIXTURE_ROOT = fileURLToPath(
  new URL("../fixtures/pactile", import.meta.url),
);
const SHA256_RE = /^[a-f0-9]{64}$/;
const RELEASE_COMMIT_RE = /^[a-f0-9]{40}$/;
const OWNERSHIP_DISPOSITIONS_V1 = [
  "no-op",
  "write-generated",
  "restore-preimage",
  "remove-generated",
  "preserve-modified",
  "preserve-borrowed",
  "manual-review",
] as const;
const FIXTURE_POLICIES = [
  ...OWNERSHIP_DISPOSITIONS_V1,
  "active-transform",
  "byte-preserved",
  "legacy-read-only",
  "canonical-state",
  "resume-journal",
] as const;
const REQUIRED_TRAITS = [
  "fresh",
  "legacy:.trellis",
  "release:0.4.3",
  "release:0.5.0-beta.0",
  "release:0.5.0-beta.5",
  "mixed-roots",
  "interrupted",
  "generated-unchanged",
  "managed-modified",
  "preexisting-adopted",
  "adoption-candidate",
  "requires-explicit-adoption",
  "requires-explicit-import",
  "legacy-read-only",
  "contract:v1",
  "foreign-config",
  "unknown-ledger",
  "missing-ledger",
  "malformed-manifest",
  "closed-byte-preserved",
  "active-schema-transform",
  "generated-write",
  "rollback-restore",
  "uninstall-remove",
] as const;

interface FixtureIndex {
  schemaVersion: number;
  scenarios: FixtureIndexEntry[];
}

interface FixtureIndexEntry {
  id: string;
  provenanceKind: "release-derived" | "representative";
  sourceRef: string | null;
  sourceCommit: string | null;
  sourcePath: string | null;
  contentClasses: ("active" | "closed-history")[];
  manifestSha256: string;
}

interface FixtureFile {
  path: string;
  sha256: string;
  policy: string;
}

interface ScenarioManifest {
  schemaVersion: number;
  id: string;
  provenance: {
    kind: "release-derived" | "representative";
    ref?: string;
    commit?: string;
    sourcePath?: string;
    derivation?: string;
    reason?: string;
  };
  traits: string[];
  expectations?: {
    legacyInputs: "read-only";
    allowedWriteRoots: string[];
    requiresExplicitImport: boolean;
  };
  lifecycleExpectations?: {
    targetPath: string;
    disposition: "write-generated" | "restore-preimage" | "remove-generated";
    sourcePath: string | null;
  }[];
  files: FixtureFile[];
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function listFiles(root: string): string[] {
  if (!existsSync(root)) return [];
  const result: string[] = [];

  const visit = (directory: string): void => {
    for (const name of readdirSync(directory).sort()) {
      const absolute = join(directory, name);
      const metadata = lstatSync(absolute);
      const kind = metadata.isSymbolicLink()
        ? "symlink"
        : metadata.isDirectory()
          ? "directory"
          : metadata.isFile()
            ? "file"
            : "other";
      assertSafeEntry(absolute, kind);
      if (kind === "directory") {
        visit(absolute);
      } else {
        result.push(relative(root, absolute).split(sep).join("/"));
      }
    }
  };

  visit(root);
  return result;
}

function assertSafeEntry(
  path: string,
  kind: "directory" | "file" | "other" | "symlink",
): void {
  if (kind === "symlink")
    throw new Error(`fixture symlink is forbidden: ${path}`);
  if (kind === "other")
    throw new Error(`unsupported fixture entry is forbidden: ${path}`);
}

function validatePath(inputRoot: string, path: string): string {
  expect(path).not.toContain("\\");
  expect(path.startsWith("/")).toBe(false);
  expect(path.split("/")).not.toContain("..");
  const resolved = resolve(inputRoot, path);
  expect(
    resolved === inputRoot || resolved.startsWith(`${inputRoot}${sep}`),
  ).toBe(true);
  return resolved;
}

function physicalPathIdentity(path: string): string {
  return path.normalize("NFC").toLowerCase();
}

function isWithinPhysicalRoot(path: string, root: string): boolean {
  const physicalPath = physicalPathIdentity(path);
  const physicalRoot = physicalPathIdentity(root);
  return (
    physicalPath === physicalRoot || physicalPath.startsWith(`${physicalRoot}/`)
  );
}

function verifyBytes(bytes: Buffer, expected: string): string | null {
  const actual = sha256(bytes);
  return actual === expected
    ? null
    : `checksum mismatch: expected ${expected}, received ${actual}`;
}

function inventoryErrors(actual: string[], expected: string[]): string[] {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return [
    ...expected
      .filter((path) => !actualSet.has(path))
      .map((path) => `missing:${path}`),
    ...actual
      .filter((path) => !expectedSet.has(path))
      .map((path) => `extra:${path}`),
  ];
}

describe("Pactile lifecycle fixture integrity", () => {
  const index = readJson<FixtureIndex>(join(FIXTURE_ROOT, "index.json"));
  const scenarioIds = index.scenarios.map((scenario) => scenario.id);

  it("has a deterministic, unique scenario index and the complete baseline trait set", () => {
    expect(index.schemaVersion).toBe(1);
    expect(scenarioIds).toEqual([...scenarioIds].sort());
    expect(new Set(scenarioIds).size).toBe(scenarioIds.length);

    const diskScenarios = readdirSync(FIXTURE_ROOT)
      .filter((name) => existsSync(join(FIXTURE_ROOT, name, "scenario.json")))
      .sort();
    expect(diskScenarios).toEqual(scenarioIds);

    const allTraits = new Set(
      scenarioIds.flatMap(
        (id) =>
          readJson<ScenarioManifest>(join(FIXTURE_ROOT, id, "scenario.json"))
            .traits,
      ),
    );
    for (const trait of REQUIRED_TRAITS)
      expect(allTraits.has(trait)).toBe(true);
  });

  it.each(scenarioIds)(
    "verifies %s provenance, inventory, and SHA-256",
    (id) => {
      const scenarioRoot = join(FIXTURE_ROOT, id);
      const inputRoot = join(scenarioRoot, "input");
      const manifestPath = join(scenarioRoot, "scenario.json");
      const manifestBytes = readFileSync(manifestPath);
      const manifest = JSON.parse(
        manifestBytes.toString("utf8"),
      ) as ScenarioManifest;
      const indexEntry = index.scenarios.find((scenario) => scenario.id === id);

      expect(manifest.schemaVersion).toBe(1);
      expect(manifest.id).toBe(id);
      expect(indexEntry).toBeDefined();
      expect(indexEntry?.provenanceKind).toBe(manifest.provenance.kind);
      expect(indexEntry?.sourceRef).toBe(manifest.provenance.ref ?? null);
      expect(indexEntry?.sourceCommit).toBe(manifest.provenance.commit ?? null);
      expect(indexEntry?.sourcePath).toBe(
        manifest.provenance.sourcePath ?? null,
      );
      expect(
        verifyBytes(manifestBytes, indexEntry?.manifestSha256 ?? ""),
      ).toBeNull();
      const expectedContentClasses: ("active" | "closed-history")[] = [];
      if (manifest.files.some((file) => file.policy !== "byte-preserved")) {
        expectedContentClasses.push("active");
      }
      if (manifest.traits.includes("closed-byte-preserved")) {
        expectedContentClasses.push("closed-history");
      }
      expect(indexEntry?.contentClasses).toEqual(expectedContentClasses);
      expect(manifest.traits.length).toBeGreaterThan(0);
      expect(manifest.files.map((file) => file.path)).toEqual(
        [...manifest.files.map((file) => file.path)].sort(),
      );
      expect(new Set(manifest.files.map((file) => file.path)).size).toBe(
        manifest.files.length,
      );

      if (manifest.provenance.kind === "release-derived") {
        expect(manifest.provenance.ref).toMatch(/^cstl-v/);
        expect(manifest.provenance.commit).toMatch(RELEASE_COMMIT_RE);
        expect(manifest.provenance.sourcePath).toBeTruthy();
        expect(manifest.provenance.derivation).toBeTruthy();
      } else {
        expect(manifest.provenance.reason).toBeTruthy();
      }

      const actualFiles = listFiles(inputRoot);
      const expectedFiles = manifest.files.map((file) => file.path);
      expect(inventoryErrors(actualFiles, expectedFiles)).toEqual([]);
      for (const file of manifest.files) {
        expect(file.sha256).toMatch(SHA256_RE);
        expect(FIXTURE_POLICIES).toContain(file.policy);
        const absolute = validatePath(inputRoot, file.path);
        expect(verifyBytes(readFileSync(absolute), file.sha256)).toBeNull();
      }
      for (const lifecycle of manifest.lifecycleExpectations ?? []) {
        const target = manifest.files.find(
          (file) => file.path === lifecycle.targetPath,
        );
        expect(target?.policy).toBe(lifecycle.disposition);
        expect(isWithinPhysicalRoot(lifecycle.targetPath, ".pactile")).toBe(
          false,
        );
        validatePath(inputRoot, lifecycle.targetPath);
        if (lifecycle.disposition === "remove-generated") {
          expect(lifecycle.sourcePath).toBeNull();
        } else {
          expect(lifecycle.sourcePath).toMatch(
            lifecycle.disposition === "restore-preimage"
              ? /^\.pactile\/runtime\/preimages\//
              : /^\.pactile\/runtime\/generated\//,
          );
          expect(
            manifest.files.some((file) => file.path === lifecycle.sourcePath),
          ).toBe(true);
          if (lifecycle.sourcePath !== null)
            validatePath(inputRoot, lifecycle.sourcePath);
        }
      }
    },
  );

  it("covers every frozen v1 ownership disposition with golden bytes", () => {
    const dispositions = new Set(
      scenarioIds.flatMap((id) =>
        readJson<ScenarioManifest>(
          join(FIXTURE_ROOT, id, "scenario.json"),
        ).files.map((file) => file.policy),
      ),
    );
    expect(
      OWNERSHIP_DISPOSITIONS_V1.filter(
        (disposition) => !dispositions.has(disposition),
      ),
    ).toEqual([]);

    const lifecycle = readJson<ScenarioManifest>(
      join(FIXTURE_ROOT, "generated-lifecycle", "scenario.json"),
    );
    expect(
      lifecycle.lifecycleExpectations?.map((item) => item.disposition),
    ).toEqual(["remove-generated", "restore-preimage", "write-generated"]);
  });

  it("compares protected roots with portable case-folded physical identities", () => {
    expect(isWithinPhysicalRoot(".pactile", ".pactile")).toBe(true);
    expect(
      isWithinPhysicalRoot(".PACTILE/runtime/install-state.json", ".pactile"),
    ).toBe(true);
    expect(isWithinPhysicalRoot(".CSTL/workflow.md", ".cstl")).toBe(true);
    expect(isWithinPhysicalRoot(".TRELLIS/tasks/legacy.json", ".trellis")).toBe(
      true,
    );
    expect(isWithinPhysicalRoot(".pactile-other/file", ".pactile")).toBe(false);
  });

  it("reports missing and extra files independently", () => {
    expect(inventoryErrors(["kept.txt"], ["kept.txt", "missing.txt"])).toEqual([
      "missing:missing.txt",
    ]);
    expect(inventoryErrors(["extra.txt", "kept.txt"], ["kept.txt"])).toEqual([
      "extra:extra.txt",
    ]);
  });

  it("rejects symlinks before resolving or hashing their target", () => {
    expect(() => assertSafeEntry("input/escape", "symlink")).toThrow(
      "fixture symlink is forbidden: input/escape",
    );
  });

  it("keeps legacy inputs read-only and requires explicit .trellis import", () => {
    for (const id of scenarioIds) {
      const manifest = readJson<ScenarioManifest>(
        join(FIXTURE_ROOT, id, "scenario.json"),
      );
      const hasCstl = manifest.files.some((file) =>
        isWithinPhysicalRoot(file.path, ".cstl"),
      );
      const hasTrellis = manifest.files.some((file) =>
        isWithinPhysicalRoot(file.path, ".trellis"),
      );
      if (!hasCstl && !hasTrellis) continue;
      expect(manifest.expectations?.legacyInputs).toBe("read-only");
      expect(manifest.expectations?.allowedWriteRoots).toEqual([".pactile"]);
      expect(manifest.expectations?.requiresExplicitImport).toBe(hasTrellis);
    }
  });

  it("distinguishes adoption candidates from evidence-backed adopted resources", () => {
    const unknown = readJson<ScenarioManifest>(
      join(FIXTURE_ROOT, "unknown-ledger", "scenario.json"),
    );
    expect(unknown.traits).toContain("adoption-candidate");
    expect(unknown.traits).toContain("requires-explicit-adoption");
    expect(unknown.traits).not.toContain("preexisting-adopted");
    expect(unknown.files.every((file) => file.policy === "manual-review")).toBe(
      true,
    );

    const adopted = readJson<ScenarioManifest>(
      join(FIXTURE_ROOT, "user-modified-adopted", "scenario.json"),
    );
    expect(adopted.traits).toContain("preexisting-adopted");
    expect(adopted.files).toContainEqual(
      expect.objectContaining({
        path: ".pactile/runtime/ownership-ledger.json",
        policy: "no-op",
      }),
    );
    expect(adopted.files.map((file) => file.policy)).toEqual(
      expect.arrayContaining(["preserve-borrowed", "preserve-modified"]),
    );
  });

  it("models a v1 canonical commit with one Adapter still reconciling", () => {
    const inputRoot = join(FIXTURE_ROOT, "mixed-interrupted", "input");
    const installState = readJson<{
      product: string;
      canonicalRoot: string;
      status: string;
      lastMigrationJournalId: string;
    }>(join(inputRoot, ".pactile/runtime/install-state.json"));
    const journal = readJson<{
      state: string;
      canonicalCommit: { status: string };
      adapterReconciliations: {
        adapterId: string;
        status: string;
        attempts: number;
      }[];
      events: { event: string; adapterId: string | null }[];
    }>(join(inputRoot, ".pactile/runtime/migrations/journal.beta5.json"));

    expect(installState).toMatchObject({
      product: "pactile",
      canonicalRoot: ".pactile",
      status: "degraded",
      lastMigrationJournalId: "journal.beta5",
    });
    expect(journal.state).toBe("reconciling");
    expect(journal.canonicalCommit.status).toBe("committed");
    expect(journal.adapterReconciliations).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          adapterId: "cursor",
          status: "succeeded",
          attempts: 1,
        }),
        expect.objectContaining({
          adapterId: "codex",
          status: "in-progress",
          attempts: 1,
        }),
      ]),
    );
    expect(
      journal.events.filter(
        (event) => event.event === "adapter-reconcile-started",
      ),
    ).toHaveLength(2);
  });

  it("fails deterministically when a byte-preserved fixture is changed", () => {
    const scenarioRoot = join(FIXTURE_ROOT, "cstl-0.4.3");
    const manifest = readJson<ScenarioManifest>(
      join(scenarioRoot, "scenario.json"),
    );
    const closed = manifest.files.find(
      (file) => file.policy === "byte-preserved",
    );
    expect(closed).toBeDefined();
    if (!closed) return;

    const original = readFileSync(join(scenarioRoot, "input", closed.path));
    const tampered = Buffer.concat([original, Buffer.from([0])]);
    expect(verifyBytes(tampered, closed.sha256)).toMatch(/^checksum mismatch:/);
  });

  it("contains no obvious credentials or developer-machine paths", () => {
    const forbidden = [
      /\bsk-[A-Za-z0-9_-]{12,}/,
      /\bghp_[A-Za-z0-9]{12,}/,
      /[A-Za-z]:\\Users\\/i,
      /\/home\/[A-Za-z0-9._-]+\//,
    ];
    for (const id of scenarioIds) {
      const inputRoot = join(FIXTURE_ROOT, id, "input");
      for (const path of listFiles(inputRoot)) {
        const text = readFileSync(join(inputRoot, path), "utf8");
        for (const pattern of forbidden) expect(text).not.toMatch(pattern);
      }
    }
  });

  it("pins byte and tracking policy for hidden runtime fixture roots", () => {
    const attributes = readFileSync(
      join(FIXTURE_ROOT, ".gitattributes"),
      "utf8",
    );
    const ignores = readFileSync(join(FIXTURE_ROOT, ".gitignore"), "utf8");

    expect(attributes).toContain("**/input/** -text");
    for (const root of [".cstl", ".cursor", ".trellis"]) {
      expect(ignores).toContain(`!**/input/${root}/**`);
    }
  });

  it("remains valid after a scenario is copied to a temporary directory", () => {
    const temporaryRoot = mkdtempSync(join(tmpdir(), "pactile-fixture-"));
    try {
      const copiedScenario = join(temporaryRoot, "copied");
      cpSync(join(FIXTURE_ROOT, "cstl-0.4.3"), copiedScenario, {
        recursive: true,
      });
      const manifest = readJson<ScenarioManifest>(
        join(copiedScenario, "scenario.json"),
      );
      const inputRoot = join(copiedScenario, "input");

      expect(
        inventoryErrors(
          listFiles(inputRoot),
          manifest.files.map((file) => file.path),
        ),
      ).toEqual([]);
      for (const file of manifest.files) {
        expect(
          verifyBytes(
            readFileSync(validatePath(inputRoot, file.path)),
            file.sha256,
          ),
        ).toBeNull();
      }
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
