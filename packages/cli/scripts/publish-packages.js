/**
 * Prepare and publish the Core + CLI pair across an explicit credential wall.
 *
 * `--prepare-only` must run without publish credentials. It validates the full
 * candidate, creates both tarballs once, validates their packed contracts, and
 * seals their byte hashes in a manifest. It also returns a SHA-256 receipt that
 * must travel outside the artifact directory. `--publish-only` requires that
 * receipt through `--expected-manifest-sha256`, verifies it before parsing the
 * manifest, and publishes those exact tarballs; it never builds or packs from a
 * source directory. `--dry-run` exercises both phases in one process, passes
 * the generated receipt internally, and performs no registry writes, though
 * the manifest-continuity gate still performs its documented read-only query.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  assertCleanTree,
  assertMatchingVersions,
  createCommandRunner,
  inspectLocalRelease,
  inspectPublishRelease,
  parseReleaseTag,
  resolveReleaseTag,
} from "./release-guard.js";
import {
  assertManifestSha256,
  prepareReleaseArtifacts,
  readPreparedReleaseArtifacts,
  runCandidateValidation,
} from "./release-validation.js";
import {
  computeNpmTag,
  createPublishPlan,
  npmVersionExists,
  releasePackageDefinitions,
} from "./release-preflight.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_DIR = path.resolve(__dirname, "..");
const REPO_ROOT = path.resolve(CLI_DIR, "../..");
const CORE_DIR = path.resolve(CLI_DIR, "../core");
const LEGACY_CORE_DIR = path.resolve(CLI_DIR, "../cursor-trellis-core-shim");
const LEGACY_CLI_DIR = path.resolve(CLI_DIR, "../cursor-trellis-shim");

export const PUBLISH_CREDENTIAL_ENV_KEYS = ["NODE_AUTH_TOKEN", "NPM_TOKEN"];

function readPackage(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

export function readPackageInfo() {
  const cli = readPackage(path.join(CLI_DIR, "package.json"));
  const core = readPackage(path.join(CORE_DIR, "package.json"));
  const legacyCore = readPackage(path.join(LEGACY_CORE_DIR, "package.json"));
  const legacyCli = readPackage(path.join(LEGACY_CLI_DIR, "package.json"));
  return {
    cliName: cli.name,
    cliVersion: cli.version,
    cliDir: CLI_DIR,
    coreName: core.name,
    coreVersion: core.version,
    coreDir: CORE_DIR,
    legacyCoreName: legacyCore.name,
    legacyCoreVersion: legacyCore.version,
    legacyCoreDir: LEGACY_CORE_DIR,
    legacyCliName: legacyCli.name,
    legacyCliVersion: legacyCli.version,
    legacyCliDir: LEGACY_CLI_DIR,
  };
}

export function assertCredentialFreePreparation(env = process.env) {
  const present = PUBLISH_CREDENTIAL_ENV_KEYS.filter(
    (key) => typeof env[key] === "string" && env[key].trim() !== "",
  );
  if (present.length > 0) {
    throw new Error(
      `Release preparation refuses publish credentials (${present.join(
        ", ",
      )}). Run validation/packing in a credential-free step.`,
    );
  }
}

function validationEnvironment(cliDir, env) {
  const bin = path.join(cliDir, "bin", "pactile.js");
  const quoted = /\s/.test(bin) ? `"${bin}"` : bin;
  return {
    PACTILE_KERNEL_CLI:
      env.PACTILE_KERNEL_CLI ?? `node ${quoted} kernel --json`,
    PACTILE_SKIP_SMART_SEARCH_POSTINSTALL: "1",
    NODE_AUTH_TOKEN: undefined,
    NPM_TOKEN: undefined,
  };
}

function credentialFreeRunner(runner) {
  return (command, args = [], options = {}) =>
    runner(command, args, {
      ...options,
      env: {
        ...options.env,
        // The parent process writes the receipt only after validation and
        // packing finish. Candidate scripts must not be able to pre-seed or
        // replace the GitHub step output used as the independent channel.
        GITHUB_OUTPUT: undefined,
        NODE_AUTH_TOKEN: undefined,
        NPM_TOKEN: undefined,
      },
    });
}

function isPathInside(parent, candidate) {
  const relative = path.relative(path.resolve(parent), path.resolve(candidate));
  return (
    relative === "" ||
    (!relative.startsWith(`..${path.sep}`) &&
      relative !== ".." &&
      !path.isAbsolute(relative))
  );
}

export function writeManifestReceiptOutput({
  outputPath,
  artifactDir,
  manifestSha256,
}) {
  assertManifestSha256(manifestSha256);
  if (!outputPath) throw new Error("--receipt-output requires a path.");
  if (isPathInside(artifactDir, outputPath)) {
    throw new Error(
      "Manifest receipt output must remain outside the release artifact directory.",
    );
  }
  fs.appendFileSync(
    path.resolve(outputPath),
    `manifest_sha256=${manifestSha256}${os.EOL}`,
    "utf-8",
  );
}

function dryRunPlan(packageInfo) {
  const plan = {
    version: packageInfo.cliVersion,
    tag: computeNpmTag(packageInfo.cliVersion),
    registryChecked: false,
  };
  for (const definition of releasePackageDefinitions(packageInfo)) {
    plan[definition.key] = {
      name: definition.name,
      publish: true,
      alreadyOnNpm: null,
    };
  }
  return plan;
}

function statusAfter(runner, repoRoot) {
  return String(
    runner("git", ["status", "--porcelain=v1", "--untracked-files=all"], {
      cwd: repoRoot,
      capture: true,
      env: {
        GITHUB_OUTPUT: undefined,
        NODE_AUTH_TOKEN: undefined,
        NPM_TOKEN: undefined,
      },
    }) ?? "",
  ).trim();
}

/** Credential-free source validation plus creation of the immutable pair. */
export function runCandidatePreparation({
  dryRun = false,
  explicitTag,
  remote = "private",
  artifactDir,
  runner = createCommandRunner(),
  packageInfo = readPackageInfo(),
  repoRoot = REPO_ROOT,
  validateCandidate = runCandidateValidation,
  prepareArtifacts = prepareReleaseArtifacts,
  env = process.env,
  log = console.log,
} = {}) {
  assertCredentialFreePreparation(process.env);
  assertCredentialFreePreparation(env);
  if (!artifactDir)
    throw new Error("Release preparation requires --artifact-dir.");
  const preparationRunner = credentialFreeRunner(runner);
  const version = assertMatchingVersions(packageInfo);
  const provenance = dryRun
    ? inspectLocalRelease({
        runner: preparationRunner,
        cwd: repoRoot,
        version,
        remote,
      })
    : inspectPublishRelease({
        runner: preparationRunner,
        cwd: repoRoot,
        packageVersion: version,
        explicitTag,
        remote,
        env,
      });

  const validationCommands = validateCandidate({
    runner: preparationRunner,
    repoRoot,
    cliDir: packageInfo.cliDir,
    env: validationEnvironment(packageInfo.cliDir, env),
  });
  assertCleanTree(statusAfter(preparationRunner, repoRoot));

  const artifacts = prepareArtifacts({
    runner: preparationRunner,
    repoRoot,
    artifactDir,
    packageInfo,
    provenance,
  });
  const manifestSha256 = assertManifestSha256(artifacts.manifestSha256);
  assertCleanTree(statusAfter(preparationRunner, repoRoot));
  log(
    `prepared ${artifacts.packages.length} immutable release tarballs for ${version} (${artifacts.npmTag}); manifest receipt ${manifestSha256}.`,
  );
  return { artifacts, manifestSha256, provenance, validationCommands };
}

function packageArtifact(artifacts, key) {
  const item = artifacts.packages.find((entry) => entry.key === key);
  if (!item) throw new Error(`Prepared release artifact is missing ${key}.`);
  return item;
}

/** Registry plan/auth and publication of the already-validated byte artifacts. */
export function runPreparedPublish({
  dryRun = false,
  explicitTag,
  artifactDir,
  expectedManifestSha256,
  runner = createCommandRunner(),
  packageInfo = readPackageInfo(),
  repoRoot = REPO_ROOT,
  loadArtifacts = readPreparedReleaseArtifacts,
  npmExists = npmVersionExists,
  env = process.env,
  log = console.log,
} = {}) {
  if (!artifactDir)
    throw new Error("Prepared publish requires --artifact-dir.");
  assertManifestSha256(expectedManifestSha256);
  assertMatchingVersions(packageInfo);

  let releaseTag;
  if (!dryRun) {
    releaseTag = resolveReleaseTag({ explicitTag, env });
    const parsed = parseReleaseTag(releaseTag);
    if (parsed.version !== packageInfo.cliVersion) {
      throw new Error(
        `Release tag ${releaseTag} does not match package version ${packageInfo.cliVersion}.`,
      );
    }
  }
  const artifacts = loadArtifacts({
    runner,
    artifactDir,
    packageInfo,
    expectedReleaseTag: releaseTag,
    expectedManifestSha256,
  });
  const currentCommit =
    env.GITHUB_SHA ??
    String(
      runner("git", ["rev-parse", "HEAD"], {
        cwd: repoRoot,
        capture: true,
        env: {
          GITHUB_OUTPUT: undefined,
          NODE_AUTH_TOKEN: undefined,
          NPM_TOKEN: undefined,
        },
      }),
    ).trim();
  if (artifacts.commit !== currentCommit) {
    throw new Error(
      `Prepared artifact commit ${artifacts.commit} does not match checkout ${currentCommit}.`,
    );
  }

  // All artifact parsing, content checks, and checksum verification are above
  // the first registry query and therefore above the first possible publish.
  const plan = dryRun
    ? dryRunPlan(packageInfo)
    : {
        ...createPublishPlan({
          versions: packageInfo,
          exists: (name, version) => npmExists(name, version, { runner }),
        }),
        registryChecked: true,
      };
  if (plan.tag !== artifacts.npmTag || plan.version !== artifacts.version) {
    throw new Error("Prepared artifact manifest does not match publish plan.");
  }

  log(
    `publish plan: ${plan.version} -> ${plan.tag} ` +
      `(core=${plan.core.publish ? "publish" : "skip"}, ` +
      `cli=${plan.cli.publish ? "publish" : "skip"}, ` +
      `legacyCore=${plan.legacyCore.publish ? "publish" : "skip"}, ` +
      `legacyCli=${plan.legacyCli.publish ? "publish" : "skip"})`,
  );
  const orderedPlan = releasePackageDefinitions(packageInfo).map(({ key }) => ({
    key,
    item: plan[key],
  }));
  if (!dryRun && orderedPlan.some((entry) => entry.item.publish)) {
    try {
      runner("npm", ["whoami"], { cwd: repoRoot, capture: true });
    } catch {
      throw new Error(
        "npm authentication failed after artifact validation; no publish command ran.",
      );
    }
  }

  for (const entry of orderedPlan) {
    if (!entry.item.publish) continue;
    const artifact = packageArtifact(artifacts, entry.key);
    runner(
      "npm",
      [
        "publish",
        artifact.tarballPath,
        ...(dryRun ? ["--dry-run"] : []),
        "--access",
        "public",
        "--ignore-scripts",
        "--tag",
        plan.tag,
      ],
      {
        cwd: repoRoot,
        capture: false,
        env: dryRun
          ? {
              GITHUB_OUTPUT: undefined,
              NODE_AUTH_TOKEN: undefined,
              NPM_TOKEN: undefined,
            }
          : undefined,
      },
    );
    log(
      `${dryRun ? "dry-run" : "published"} ${entry.item.name}@${plan.version} from ${artifact.filename}`,
    );
  }
  return { artifacts, plan };
}

/** Credential/tag-free rehearsal; registry continuity is read-only, not skipped. */
export function runPublishDryRun({ artifactDir, ...options } = {}) {
  const ownDirectory = !artifactDir;
  const target =
    artifactDir ??
    fs.mkdtempSync(path.join(os.tmpdir(), "pactile-release-dry-"));
  try {
    const preparation = runCandidatePreparation({
      ...options,
      dryRun: true,
      artifactDir: target,
    });
    const publication = runPreparedPublish({
      ...options,
      dryRun: true,
      artifactDir: target,
      expectedManifestSha256: preparation.manifestSha256,
    });
    return { ...preparation, plan: publication.plan };
  } finally {
    if (ownDirectory) fs.rmSync(target, { recursive: true, force: true });
  }
}

/** Backwards-compatible programmatic entry point: only safe dry-run is combined. */
export function runPublishPipeline(options = {}) {
  if (!options.dryRun) {
    throw new Error(
      "Real release requires separate --prepare-only and --publish-only invocations.",
    );
  }
  return runPublishDryRun(options);
}

function optionValue(args, flag, fallback) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : fallback;
}

function main() {
  try {
    const args = process.argv.slice(2);
    const prepareOnly = args.includes("--prepare-only");
    const publishOnly = args.includes("--publish-only");
    const dryRun = args.includes("--dry-run");
    if ([prepareOnly, publishOnly, dryRun].filter(Boolean).length !== 1) {
      throw new Error(
        "Choose exactly one mode: --prepare-only, --publish-only, or --dry-run.",
      );
    }
    const remote = optionValue(args, "--remote", "private");
    const explicitTag = optionValue(args, "--tag");
    const artifactDir = optionValue(args, "--artifact-dir");
    const receiptOutput = optionValue(args, "--receipt-output");
    const expectedManifestSha256 = optionValue(
      args,
      "--expected-manifest-sha256",
    );
    if (!remote) throw new Error("--remote requires a remote name.");
    if (args.includes("--tag") && !explicitTag) {
      throw new Error("--tag requires an exact pactile-v<semver> value.");
    }
    if (args.includes("--receipt-output") && !receiptOutput) {
      throw new Error("--receipt-output requires a path.");
    }
    if (
      args.includes("--expected-manifest-sha256") &&
      !expectedManifestSha256
    ) {
      throw new Error("--expected-manifest-sha256 requires a digest.");
    }

    if (prepareOnly) {
      if (expectedManifestSha256) {
        throw new Error(
          "--expected-manifest-sha256 is only valid with --publish-only.",
        );
      }
      const result = runCandidatePreparation({
        explicitTag,
        remote,
        artifactDir,
      });
      if (receiptOutput) {
        writeManifestReceiptOutput({
          outputPath: receiptOutput,
          artifactDir,
          manifestSha256: result.manifestSha256,
        });
      }
      console.log(
        `ok release artifacts prepared for ${result.artifacts.version}; manifest receipt ${result.manifestSha256}; no publish credential was available.`,
      );
      return;
    }
    if (publishOnly) {
      if (receiptOutput) {
        throw new Error("--receipt-output is only valid with --prepare-only.");
      }
      if (!expectedManifestSha256) {
        throw new Error(
          "Real publish-only requires --expected-manifest-sha256 from the independent preparation receipt.",
        );
      }
      const result = runPreparedPublish({
        explicitTag,
        artifactDir,
        expectedManifestSha256,
      });
      console.log(`ok publish completed for ${result.plan.version}.`);
      return;
    }
    if (receiptOutput || expectedManifestSha256) {
      throw new Error(
        "--dry-run creates and consumes its manifest receipt in the same process; receipt flags are not accepted.",
      );
    }
    const result = runPublishDryRun({ remote, artifactDir });
    console.log(
      `ok publish dry-run completed for ${result.plan.version}; registry continuity was read only and no registry state changed.`,
    );
  } catch (error) {
    console.error(
      `x ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

const invokedAs = process.argv[1];
if (
  invokedAs &&
  import.meta.url === pathToFileURL(path.resolve(invokedAs)).href
) {
  main();
}
