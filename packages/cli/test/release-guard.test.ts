import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  assertMatchingVersions,
  assertPublishProvenance,
  assertReleaseBranch,
  createCommandRunner,
  parseReleaseTag,
} from "../scripts/release-guard.js";
import {
  assertCredentialFreePreparation,
  runCandidatePreparation,
  runPreparedPublish,
  runPublishPipeline,
  writeManifestReceiptOutput,
} from "../scripts/publish-packages.js";
import {
  RELEASE_ARTIFACT_MANIFEST,
  REQUIRED_CORE_RELEASE_FILES,
  validateCorePackPaths,
} from "../scripts/release-validation.js";
import {
  computeReleaseTarget,
  runReleaseCandidate,
} from "../scripts/release.js";
import {
  REQUIRED_RELEASE_FILES,
  validateReleasePackPaths,
} from "../scripts/check-release-pack-contents.js";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "../../..");

interface RecordedCall {
  command: string;
  args: string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
}

interface FakeGitOptions {
  status?: string;
  branch?: string;
  head?: string;
  tagCommit?: string;
  ancestors?: string[];
}

function fakeRunner(options: FakeGitOptions = {}): {
  calls: RecordedCall[];
  runner: (
    command: string,
    args?: string[],
    run?: {
      cwd?: string;
      env?: Record<string, string | undefined>;
    },
  ) => string;
} {
  const calls: RecordedCall[] = [];
  const head = options.head ?? "candidate-head";
  const ancestorPairs = new Set(options.ancestors ?? []);
  const runner = (
    command: string,
    args: string[] = [],
    run: {
      cwd?: string;
      env?: Record<string, string | undefined>;
    } = {},
  ): string => {
    calls.push({
      command,
      args: [...args],
      cwd: run.cwd,
      env: run.env === undefined ? undefined : { ...run.env },
    });
    if (command !== "git") return "";
    if (args[0] === "status") return options.status ?? "";
    if (args[0] === "branch") return options.branch ?? "beta";
    if (args[0] === "rev-parse" && args[1] === "HEAD") return head;
    if (args[0] === "rev-parse") return options.tagCommit ?? head;
    if (args[0] === "merge-base") {
      const key = `${args[2]}>${args[3]}`;
      if (ancestorPairs.has(key)) return "";
      throw new Error(`not ancestor: ${key}`);
    }
    throw new Error(`unexpected git command: ${args.join(" ")}`);
  };
  return { calls, runner };
}

const packageInfo = {
  cliName: "@blxzer/cursor-trellis",
  cliVersion: "0.5.0-beta.5",
  cliDir: path.join(REPO_ROOT, "packages/cli"),
  coreName: "@blxzer/cursor-trellis-core",
  coreVersion: "0.5.0-beta.5",
  coreDir: path.join(REPO_ROOT, "packages/core"),
};

function fakeArtifacts(
  artifactDir = path.join(os.tmpdir(), "release-artifacts"),
) {
  return {
    schemaVersion: 1,
    version: packageInfo.cliVersion,
    npmTag: "beta",
    releaseTag: "cstl-v0.5.0-beta.5",
    commit: "candidate-head",
    manifestSha256: `sha256:${"c".repeat(64)}`,
    packages: [
      {
        key: "core",
        name: packageInfo.coreName,
        version: packageInfo.coreVersion,
        filename: "blxzer-cursor-trellis-core-0.5.0-beta.5.tgz",
        size: 100,
        sha256: `sha256:${"a".repeat(64)}`,
        tarballPath: path.join(
          artifactDir,
          "blxzer-cursor-trellis-core-0.5.0-beta.5.tgz",
        ),
      },
      {
        key: "cli",
        name: packageInfo.cliName,
        version: packageInfo.cliVersion,
        filename: "blxzer-cursor-trellis-0.5.0-beta.5.tgz",
        size: 200,
        sha256: `sha256:${"b".repeat(64)}`,
        tarballPath: path.join(
          artifactDir,
          "blxzer-cursor-trellis-0.5.0-beta.5.tgz",
        ),
      },
    ],
  };
}

function sha256File(file: string): string {
  return `sha256:${crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex")}`;
}

describe("release guard negative paths", () => {
  it("stops on a dirty tree before branch, build, version, or tag work", () => {
    const fake = fakeRunner({ status: " M package.json" });

    expect(() =>
      runReleaseCandidate({
        type: "beta",
        packageInfo,
        repoRoot: REPO_ROOT,
        cliDir: packageInfo.cliDir,
        runner: fake.runner,
      }),
    ).toThrow(/clean working tree/);
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0].args[0]).toBe("status");
  });

  it("rejects a beta candidate from a feature branch", () => {
    expect(() =>
      assertReleaseBranch({
        branch: "feat/unsafe-release",
        version: "0.5.0-beta.6",
      }),
    ).toThrow(/cannot be prepared/);
  });

  it("requires the exact cstl tag namespace", () => {
    expect(() => parseReleaseTag("v0.5.0-beta.5")).toThrow(
      /Invalid release tag/,
    );
    expect(() => parseReleaseTag("prefix-cstl-v0.5.0-beta.5")).toThrow(
      /Invalid release tag/,
    );
  });

  it("rejects a stable tag whose commit is not in main", () => {
    expect(() =>
      assertPublishProvenance({
        tag: "cstl-v0.5.0",
        packageVersion: "0.5.0",
        head: "feature-head",
        tagCommit: "feature-head",
        remote: "origin",
        isAncestor: () => false,
      }),
    ).toThrow(/not contained in origin\/main/);
  });

  it("rejects a non-ancestor beta tag", () => {
    expect(() =>
      assertPublishProvenance({
        tag: "cstl-v0.5.0-beta.5",
        packageVersion: "0.5.0-beta.5",
        head: "orphan-head",
        tagCommit: "orphan-head",
        remote: "origin",
        isAncestor: () => false,
      }),
    ).toThrow(/not contained in origin\/beta/);
  });

  it("rejects package and target version mismatch", () => {
    expect(() =>
      assertMatchingVersions({
        coreVersion: "0.5.0-beta.4",
        cliVersion: "0.5.0-beta.5",
        expectedVersion: "0.5.0-beta.5",
      }),
    ).toThrow(/Version mismatch/);
  });

  it("rejects an explicit target version that is not newer", () => {
    expect(() => computeReleaseTarget("0.5.0-beta.5", "0.4.0")).toThrow(
      /must be newer/,
    );
  });

  it("reports missing required CLI and Core tarball files", () => {
    const cliPaths = [
      ...REQUIRED_RELEASE_FILES.filter((file) => file !== "bin/cstl.js"),
      "dist/migrations/manifests/0.5.0.json",
      "dist/templates/common/bundled-skills/example/SKILL.md",
    ];
    expect(validateReleasePackPaths(cliPaths)).toContain(
      "missing required packed file: bin/cstl.js",
    );
    expect(
      validateCorePackPaths(
        REQUIRED_CORE_RELEASE_FILES.filter((file) => file !== "dist/index.js"),
      ),
    ).toContain("missing required packed core file: dist/index.js");
  });
});

describe("credential wall and immutable publish DAG", () => {
  it("removes an inherited publish token from credential-free child commands", () => {
    const runner = createCommandRunner({
      baseEnv: { ...process.env, NODE_AUTH_TOKEN: "inherited-secret" },
    });
    const output = runner(
      process.execPath,
      ["-e", "process.stdout.write(process.env.NODE_AUTH_TOKEN ?? 'absent')"],
      { env: { NODE_AUTH_TOKEN: undefined } },
    );
    expect(output).toBe("absent");
  });

  it("refuses a publish token before the first preparation command", () => {
    const fake = fakeRunner();
    expect(() =>
      runCandidatePreparation({
        dryRun: true,
        artifactDir: path.join(os.tmpdir(), "unused-release-artifacts"),
        runner: fake.runner,
        packageInfo,
        repoRoot: REPO_ROOT,
        env: { NODE_AUTH_TOKEN: "must-not-cross-boundary" },
      }),
    ).toThrow(/refuses publish credentials/);
    expect(fake.calls).toHaveLength(0);
    expect(() =>
      assertCredentialFreePreparation({ NPM_TOKEN: "also-forbidden" }),
    ).toThrow(/NPM_TOKEN/);
  });

  it("finishes every validator before sealing both package artifacts", () => {
    const fake = fakeRunner({
      ancestors: ["candidate-head>private/beta"],
    });
    let callsAtPreparation = -1;
    const artifacts = fakeArtifacts();

    runCandidatePreparation({
      dryRun: false,
      explicitTag: "cstl-v0.5.0-beta.5",
      remote: "private",
      artifactDir: path.join(os.tmpdir(), "release-artifacts"),
      runner: fake.runner,
      packageInfo,
      repoRoot: REPO_ROOT,
      env: { GITHUB_OUTPUT: "must-not-cross-into-candidate-commands" },
      prepareArtifacts: () => {
        callsAtPreparation = fake.calls.length;
        expect(
          fake.calls.some(
            (call) => call.command === "npm" && call.args[0] === "publish",
          ),
        ).toBe(false);
        return artifacts;
      },
      log: () => undefined,
    });

    expect(callsAtPreparation).toBeGreaterThan(0);
    for (const required of [
      "build",
      "typecheck",
      "lint",
      "test",
      "check:pack-files",
      "check:release-pack",
    ]) {
      const index = fake.calls.findIndex((call) =>
        call.args.includes(required),
      );
      expect(index, required).toBeGreaterThan(-1);
      expect(index, required).toBeLessThan(callsAtPreparation);
    }
    const candidateCalls = fake.calls.slice(0, callsAtPreparation);
    expect(
      candidateCalls.every(
        (call) =>
          call.env?.NODE_AUTH_TOKEN === undefined &&
          call.env?.NPM_TOKEN === undefined &&
          call.env?.GITHUB_OUTPUT === undefined,
      ),
    ).toBe(true);
  });

  it("publishes the two validated tarball paths without repacking directories", () => {
    const fake = fakeRunner();
    const artifacts = fakeArtifacts();
    const registryEvents: string[] = [];

    runPreparedPublish({
      dryRun: false,
      explicitTag: "cstl-v0.5.0-beta.5",
      artifactDir: path.dirname(artifacts.packages[0].tarballPath),
      expectedManifestSha256: artifacts.manifestSha256,
      runner: fake.runner,
      packageInfo,
      repoRoot: REPO_ROOT,
      loadArtifacts: () => artifacts,
      npmExists: (name: string) => {
        registryEvents.push(name);
        return false;
      },
      env: {
        GITHUB_SHA: "candidate-head",
        NODE_AUTH_TOKEN: "publish-step-only",
      },
      log: () => undefined,
    });

    expect(registryEvents).toEqual([
      "@blxzer/cursor-trellis-core",
      "@blxzer/cursor-trellis",
    ]);
    const publishes = fake.calls.filter(
      (call) => call.command === "npm" && call.args[0] === "publish",
    );
    expect(publishes).toHaveLength(2);
    expect(publishes.map((call) => call.args[1])).toEqual(
      artifacts.packages.map((item) => item.tarballPath),
    );
    expect(publishes.every((call) => call.args[1].endsWith(".tgz"))).toBe(true);
    expect(
      fake.calls.some(
        (call) => call.command === "pnpm" && call.args[0] === "publish",
      ),
    ).toBe(false);
  });

  it("rejects a changed artifact hash before registry auth or publish", () => {
    const temporary = fs.mkdtempSync(
      path.join(os.tmpdir(), "release-artifact-tamper-"),
    );
    try {
      const artifacts = fakeArtifacts(temporary);
      for (const item of artifacts.packages) {
        fs.writeFileSync(item.tarballPath, "tampered", "utf-8");
        item.size = Buffer.byteLength("tampered");
      }
      fs.writeFileSync(
        path.join(temporary, RELEASE_ARTIFACT_MANIFEST),
        JSON.stringify({
          ...artifacts,
          packages: artifacts.packages.map((artifact) => {
            const { tarballPath, ...item } = artifact;
            void tarballPath;
            return item.key === "core"
              ? { ...item, sha256: `sha256:${"0".repeat(64)}` }
              : item;
          }),
        }),
        "utf-8",
      );
      const expectedManifestSha256 = sha256File(
        path.join(temporary, RELEASE_ARTIFACT_MANIFEST),
      );
      const fake = fakeRunner();
      expect(() =>
        runPreparedPublish({
          explicitTag: "cstl-v0.5.0-beta.5",
          artifactDir: temporary,
          expectedManifestSha256,
          runner: fake.runner,
          packageInfo,
          repoRoot: REPO_ROOT,
          env: { NODE_AUTH_TOKEN: "publish-step-only" },
        }),
      ).toThrow(/hash changed/);
      expect(fake.calls).toHaveLength(0);
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  it("requires an independently supplied manifest receipt before loading artifacts", () => {
    const fake = fakeRunner();
    let loaded = false;
    expect(() =>
      runPreparedPublish({
        explicitTag: "cstl-v0.5.0-beta.5",
        artifactDir: path.join(os.tmpdir(), "release-artifacts"),
        runner: fake.runner,
        packageInfo,
        repoRoot: REPO_ROOT,
        loadArtifacts: () => {
          loaded = true;
          return fakeArtifacts();
        },
        env: { NODE_AUTH_TOKEN: "publish-step-only" },
      }),
    ).toThrow(/Expected manifest SHA-256/);
    expect(loaded).toBe(false);
    expect(fake.calls).toHaveLength(0);
  });

  it("checks a mismatched receipt before parsing invalid manifest JSON", () => {
    const temporary = fs.mkdtempSync(
      path.join(os.tmpdir(), "release-manifest-order-"),
    );
    try {
      fs.writeFileSync(
        path.join(temporary, RELEASE_ARTIFACT_MANIFEST),
        "{not-json",
        "utf-8",
      );
      const fake = fakeRunner();
      expect(() =>
        runPreparedPublish({
          explicitTag: "cstl-v0.5.0-beta.5",
          artifactDir: temporary,
          expectedManifestSha256: `sha256:${"0".repeat(64)}`,
          runner: fake.runner,
          packageInfo,
          repoRoot: REPO_ROOT,
          env: { NODE_AUTH_TOKEN: "publish-step-only" },
        }),
      ).toThrow(/manifest SHA-256 receipt mismatch/);
      expect(fake.calls).toHaveLength(0);
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  it("rejects coordinated tarball and manifest tampering against the preparation receipt", () => {
    const temporary = fs.mkdtempSync(
      path.join(os.tmpdir(), "release-coordinated-tamper-"),
    );
    try {
      const artifacts = fakeArtifacts(temporary);
      for (const item of artifacts.packages) {
        fs.writeFileSync(item.tarballPath, `original-${item.key}`, "utf-8");
        item.size = fs.statSync(item.tarballPath).size;
        item.sha256 = sha256File(item.tarballPath);
      }
      const manifestPath = path.join(temporary, RELEASE_ARTIFACT_MANIFEST);
      const storedManifest = {
        schemaVersion: artifacts.schemaVersion,
        version: artifacts.version,
        npmTag: artifacts.npmTag,
        releaseTag: artifacts.releaseTag,
        commit: artifacts.commit,
        packages: artifacts.packages.map(({ tarballPath, ...item }) => {
          void tarballPath;
          return item;
        }),
      };
      fs.writeFileSync(manifestPath, JSON.stringify(storedManifest), "utf-8");
      const preparationReceipt = sha256File(manifestPath);

      const core = artifacts.packages[0];
      fs.writeFileSync(core.tarballPath, "coordinated-tamper", "utf-8");
      storedManifest.packages[0].size = fs.statSync(core.tarballPath).size;
      storedManifest.packages[0].sha256 = sha256File(core.tarballPath);
      fs.writeFileSync(manifestPath, JSON.stringify(storedManifest), "utf-8");

      const fake = fakeRunner();
      expect(() =>
        runPreparedPublish({
          explicitTag: "cstl-v0.5.0-beta.5",
          artifactDir: temporary,
          expectedManifestSha256: preparationReceipt,
          runner: fake.runner,
          packageInfo,
          repoRoot: REPO_ROOT,
          env: { NODE_AUTH_TOKEN: "publish-step-only" },
        }),
      ).toThrow(/manifest SHA-256 receipt mismatch/);
      expect(fake.calls).toHaveLength(0);
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  it("keeps a persisted receipt outside the artifact directory", () => {
    const temporary = fs.mkdtempSync(
      path.join(os.tmpdir(), "release-receipt-output-"),
    );
    try {
      const artifactDir = path.join(temporary, "artifacts");
      fs.mkdirSync(artifactDir);
      const outputPath = path.join(temporary, "github-output.txt");
      const manifestSha256 = `sha256:${"d".repeat(64)}`;
      writeManifestReceiptOutput({
        outputPath,
        artifactDir,
        manifestSha256,
      });
      expect(fs.readFileSync(outputPath, "utf-8")).toContain(
        `manifest_sha256=${manifestSha256}`,
      );
      expect(() =>
        writeManifestReceiptOutput({
          outputPath: path.join(artifactDir, "receipt.txt"),
          artifactDir,
          manifestSha256,
        }),
      ).toThrow(/outside the release artifact directory/);
    } finally {
      fs.rmSync(temporary, { recursive: true, force: true });
    }
  });

  it("supports a tag-free dry-run while retaining read-only continuity", () => {
    const fake = fakeRunner({
      branch: "beta",
      ancestors: ["candidate-head>private/beta", "private/beta>candidate-head"],
    });
    const artifacts = { ...fakeArtifacts(), releaseTag: null };

    runPublishPipeline({
      dryRun: true,
      artifactDir: path.join(os.tmpdir(), "release-artifacts"),
      remote: "private",
      runner: fake.runner,
      packageInfo,
      repoRoot: REPO_ROOT,
      env: {},
      prepareArtifacts: () => artifacts,
      loadArtifacts: () => artifacts,
      npmExists: () => {
        throw new Error("dry-run must not perform the publish-plan lookup");
      },
      log: () => undefined,
    });

    expect(
      fake.calls.some((call) =>
        call.args.some((arg) => arg.endsWith("check-manifest-continuity.js")),
      ),
    ).toBe(true);
    expect(
      fake.calls.some(
        (call) => call.command === "npm" && call.args[0] === "whoami",
      ),
    ).toBe(false);
    const publishes = fake.calls.filter(
      (call) => call.command === "npm" && call.args[0] === "publish",
    );
    expect(publishes).toHaveLength(2);
    expect(publishes.every((call) => call.args.includes("--dry-run"))).toBe(
      true,
    );
    expect(
      publishes.every(
        (call) =>
          call.env?.NODE_AUTH_TOKEN === undefined &&
          call.env?.NPM_TOKEN === undefined,
      ),
    ).toBe(true);
  });

  it("refuses to prepare artifacts if a validator changes the tracked tree", () => {
    let status = "";
    const fake = fakeRunner({
      branch: "beta",
      ancestors: ["candidate-head>private/beta", "private/beta>candidate-head"],
    });
    const runner = (
      command: string,
      args: string[] = [],
      options: {
        cwd?: string;
        env?: Record<string, string | undefined>;
      } = {},
    ): string => {
      if (command === "git" && args[0] === "status") {
        fake.calls.push({ command, args: [...args], cwd: options.cwd });
        return status;
      }
      return fake.runner(command, args, options);
    };

    expect(() =>
      runCandidatePreparation({
        dryRun: true,
        remote: "private",
        artifactDir: path.join(os.tmpdir(), "release-artifacts"),
        runner,
        packageInfo,
        repoRoot: REPO_ROOT,
        env: {},
        validateCandidate: () => {
          status = " M packages/cli/package.json";
          return [];
        },
        prepareArtifacts: () => {
          throw new Error("artifact preparation must not run");
        },
        log: () => undefined,
      }),
    ).toThrow(/clean working tree/);
    expect(
      fake.calls.some(
        (call) => call.command === "npm" && call.args[0] === "publish",
      ),
    ).toBe(false);
  });
});

describe("release workflow wiring", () => {
  it("contains no automatic staging, commit, tag, or push path", () => {
    const source = fs.readFileSync(
      path.join(REPO_ROOT, "packages/cli/scripts/release.js"),
      "utf-8",
    );
    expect(source).not.toContain("git add -A");
    expect(source).not.toMatch(/\["commit"|\["tag"|\["push"/);
  });

  it("runs beta/main PR checks and the pack smoke on Linux and Windows", () => {
    const ci = fs.readFileSync(
      path.join(REPO_ROOT, ".github/workflows/ci.yml"),
      "utf-8",
    );
    expect(ci).toContain("branches: [main, beta]");
    expect(ci).toContain("ubuntu-latest");
    expect(ci).toContain("windows-latest");
    expect(ci).toContain("check:release-pack");
    expect(ci).toContain("verify-packed-cli");
  });

  it("keeps publish credentials out of preparation and scopes them to tarball publish", () => {
    const workflow = fs.readFileSync(
      path.join(REPO_ROOT, ".github/workflows/publish.yml"),
      "utf-8",
    );
    const provenance = workflow.indexOf("check-provenance");
    const prepare = workflow.indexOf(
      "Validate candidate and prepare immutable tarballs",
    );
    const publish = workflow.indexOf("Publish verified tarballs");
    const token = workflow.indexOf("NODE_AUTH_TOKEN");
    expect(workflow).toContain("fetch-depth: 0");
    expect(workflow).toContain("persist-credentials: false");
    expect(provenance).toBeGreaterThan(-1);
    expect(provenance).toBeLessThan(prepare);
    expect(prepare).toBeLessThan(publish);
    expect(publish).toBeLessThan(token);
    expect(workflow.slice(prepare, publish)).not.toContain("NODE_AUTH_TOKEN");
    expect(workflow.match(/NODE_AUTH_TOKEN/g)).toHaveLength(1);
    expect(workflow).toContain("--prepare-only");
    expect(workflow).toContain("--publish-only");
    expect(workflow).toContain("${RUNNER_TEMP}/release-artifacts");
    expect(workflow).toContain("id: prepare");
    expect(workflow).toContain('--receipt-output "${GITHUB_OUTPUT}"');
    expect(workflow).toContain("--expected-manifest-sha256");
    expect(workflow).toContain("${{ steps.prepare.outputs.manifest_sha256 }}");
  });
});
