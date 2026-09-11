/**
 * Credential-free, write-free release conformance for the four Pactile packages.
 *
 * The command packs the exact workspace bytes, seals and re-opens the artifact
 * manifest, rejects an ambiguous shared `cstl` bin before creating an install
 * prefix, then proves two explicit recovery profiles. A read-only registry pass
 * warms an isolated npm cache for public third-party dependencies; the actual
 * canonical and legacy profile checks are fresh `--offline` installs of the
 * local tarballs.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { createCommandRunner } from "./release-guard.js";
import {
  assertReleasePackageOrder,
  releasePackageDefinitions,
} from "./release-preflight.js";
import {
  inspectReleaseTarball,
  prepareReleaseArtifacts,
  readPreparedReleaseArtifacts,
} from "./release-validation.js";
import {
  assertCredentialFreePreparation,
  readPackageInfo,
} from "./publish-packages.js";

const MINIMUM_NODE_ENGINE = ">=18.17.0";

export const RELEASE_INSTALL_PROFILES = {
  canonical: {
    keys: ["core", "cli"],
    owners: {
      pactile: "cli",
      cstl: "cli",
      "smart-search": "cli",
    },
  },
  legacy: {
    keys: ["core", "cli", "legacyCore", "legacyCli"],
    owners: {
      pactile: "cli",
      cstl: "legacyCli",
      "smart-search": "cli",
    },
  },
};

function normalizeBinTarget(value) {
  return typeof value === "string"
    ? value.replace(/^\.\//, "").replace(/\\/g, "/")
    : value;
}

function defaultBinName(packageName) {
  return packageName.split("/").pop();
}

export function collectBinClaims(packages, keys) {
  const selected = new Set(keys);
  const claims = new Map();
  for (const item of packages) {
    if (!selected.has(item.key)) continue;
    const value = item.packedPackage.bin;
    const entries =
      typeof value === "string"
        ? [[defaultBinName(item.packedPackage.name), value]]
        : Object.entries(value ?? {});
    for (const [name, target] of entries) {
      if (typeof name !== "string" || typeof target !== "string") continue;
      const claim = {
        key: item.key,
        packageName: item.packedPackage.name,
        target: normalizeBinTarget(target),
      };
      const current = claims.get(name) ?? [];
      current.push(claim);
      claims.set(name, current);
    }
  }
  return claims;
}

export function assertResolvedBinOwnership({
  claims,
  owners = {},
  profile = "shared",
}) {
  const resolved = {};
  for (const configured of Object.keys(owners)) {
    if (!claims.has(configured)) {
      throw new Error(
        `Release install profile "${profile}" assigns unclaimed bin "${configured}".`,
      );
    }
  }
  for (const [name, contenders] of claims) {
    const configured = owners[name];
    if (contenders.length > 1 && configured === undefined) {
      throw new Error(
        `Release install profile "${profile}" has unresolved bin "${name}" ` +
          `claimed by ${contenders.map((claim) => claim.key).join(", ")}. ` +
          "No installation started. Recovery: choose the canonical profile, " +
          "or use the isolated legacy profile with legacyCli as the explicit cstl owner.",
      );
    }
    const owner = configured ?? contenders[0]?.key;
    if (!contenders.some((claim) => claim.key === owner)) {
      throw new Error(
        `Release install profile "${profile}" assigns bin "${name}" to ` +
          `non-claimant "${owner}".`,
      );
    }
    resolved[name] = owner;
  }
  return resolved;
}

export function createInstallPlan({ packages, artifacts, profileName }) {
  const profile = RELEASE_INSTALL_PROFILES[profileName];
  if (!profile)
    throw new Error(`Unknown release install profile "${profileName}".`);
  const order = assertReleasePackageOrder(packages.map((item) => item.key));
  const selectedOrder = order.filter((key) => profile.keys.includes(key));
  const claims = collectBinClaims(packages, selectedOrder);
  const owners = assertResolvedBinOwnership({
    claims,
    owners: profile.owners,
    profile: profileName,
  });
  const tarballs = selectedOrder.map((key) => {
    const artifact = artifacts.find((item) => item.key === key);
    if (!artifact) throw new Error(`Release artifact is missing ${key}.`);
    return artifact.tarballPath;
  });
  return { profileName, keys: selectedOrder, owners, claims, tarballs };
}

export function assertSupportedNodeEngines(packages) {
  const mismatched = packages
    .filter((item) => item.packedPackage.engines?.node !== MINIMUM_NODE_ENGINE)
    .map(
      (item) => `${item.key}=${item.packedPackage.engines?.node ?? "missing"}`,
    );
  if (mismatched.length > 0) {
    throw new Error(
      `Release packages must declare node ${MINIMUM_NODE_ENGINE}: ${mismatched.join(", ")}.`,
    );
  }
  return MINIMUM_NODE_ENGINE;
}

function installEnvironment(userConfig) {
  return {
    NODE_AUTH_TOKEN: undefined,
    NPM_TOKEN: undefined,
    NPM_CONFIG_USERCONFIG: userConfig,
    PACTILE_SKIP_SMART_SEARCH_POSTINSTALL: "1",
  };
}

function runInstall({ runner, plan, prefix, cacheDir, userConfig, offline }) {
  if (fs.existsSync(prefix)) {
    throw new Error(`Release install prefix must not exist yet: ${prefix}.`);
  }
  const args = [
    "--prefix",
    prefix,
    "install",
    "--ignore-scripts",
    "--no-audit",
    "--no-fund",
    "--no-save",
    "--package-lock=false",
    "--omit=optional",
    "--cache",
    cacheDir,
    "--registry=https://registry.npmjs.org/",
    offline ? "--offline" : "--prefer-online",
    ...plan.tarballs,
  ];
  runner("npm", args, {
    capture: false,
    env: installEnvironment(userConfig),
  });
}

function binLauncher(prefix, name) {
  const base = path.join(prefix, "node_modules", ".bin", name);
  if (process.platform === "win32") return `${base}.cmd`;
  return base;
}

function launcherSource(file) {
  if (!fs.existsSync(file))
    throw new Error(`Installed bin launcher is missing: ${file}.`);
  return fs.lstatSync(file).isSymbolicLink()
    ? fs.readlinkSync(file)
    : fs.readFileSync(file, "utf-8");
}

function assertInstalledProfile({
  runner,
  plan,
  packages,
  prefix,
  userConfig,
}) {
  for (const key of plan.keys) {
    const expected = packages.find((item) => item.key === key);
    if (!expected)
      throw new Error(`Release package metadata is missing ${key}.`);
    const installedManifest = path.join(
      prefix,
      "node_modules",
      ...expected.packedPackage.name.split("/"),
      "package.json",
    );
    if (!fs.existsSync(installedManifest)) {
      throw new Error(
        `Installed release package is missing: ${expected.packedPackage.name}.`,
      );
    }
    const installed = JSON.parse(fs.readFileSync(installedManifest, "utf-8"));
    if (installed.version !== expected.packedPackage.version) {
      throw new Error(
        `Installed ${installed.name} version ${installed.version} does not match ` +
          `${expected.packedPackage.version}.`,
      );
    }
  }

  for (const [name, ownerKey] of Object.entries(plan.owners)) {
    const owner = packages.find((item) => item.key === ownerKey);
    const target = owner?.packedPackage.bin?.[name];
    if (!owner || typeof target !== "string") {
      throw new Error(
        `Resolved bin owner ${ownerKey} does not expose "${name}".`,
      );
    }
    const source = launcherSource(binLauncher(prefix, name))
      .replace(/\\/g, "/")
      .toLowerCase();
    const marker =
      `${owner.packedPackage.name}/${normalizeBinTarget(target)}`.toLowerCase();
    if (!source.includes(marker)) {
      throw new Error(
        `Installed bin "${name}" is not owned by ${owner.packedPackage.name}.`,
      );
    }
  }

  for (const name of ["pactile", "cstl"]) {
    const ownerKey = plan.owners[name];
    if (!ownerKey) continue;
    const owner = packages.find((item) => item.key === ownerKey);
    const target = owner?.packedPackage.bin?.[name];
    if (!owner || typeof target !== "string") continue;
    const executable = path.join(
      prefix,
      "node_modules",
      ...owner.packedPackage.name.split("/"),
      normalizeBinTarget(target),
    );
    const output = String(
      runner(process.execPath, [executable, "--version"], {
        capture: true,
        cwd: prefix,
        env: installEnvironment(userConfig),
      }),
    );
    if (!output.includes(owner.packedPackage.version)) {
      throw new Error(
        `Installed ${name} did not report ${owner.packedPackage.version}.`,
      );
    }
  }
}

export function verifyReleaseConformance({
  runner = createCommandRunner(),
  packageInfo = readPackageInfo(),
  temporaryRoot,
  log = console.log,
} = {}) {
  assertCredentialFreePreparation(process.env);
  const ownedTemporary = temporaryRoot === undefined;
  const root =
    temporaryRoot ??
    fs.mkdtempSync(path.join(os.tmpdir(), "pactile-release-matrix-"));
  const artifactDir = path.join(root, "artifacts");
  const cacheDir = path.join(root, "npm-cache");
  const userConfig = path.join(root, "empty-npmrc");
  fs.writeFileSync(userConfig, "", "utf-8");

  try {
    const prepared = prepareReleaseArtifacts({
      runner,
      repoRoot: path.resolve(packageInfo.cliDir, "../.."),
      artifactDir,
      packageInfo,
      provenance: {
        head: process.env.GITHUB_SHA ?? "local-conformance",
        tag: null,
      },
    });
    const artifacts = readPreparedReleaseArtifacts({
      runner,
      artifactDir,
      packageInfo,
      expectedReleaseTag: null,
      expectedManifestSha256: prepared.manifestSha256,
    });
    assertReleasePackageOrder(artifacts.packages.map((item) => item.key));

    const definitions = releasePackageDefinitions(packageInfo);
    const packages = definitions.map((definition) => {
      const artifact = artifacts.packages.find(
        (item) => item.key === definition.key,
      );
      if (!artifact)
        throw new Error(`Release artifact is missing ${definition.key}.`);
      const inspected = inspectReleaseTarball({
        runner,
        tarballPath: artifact.tarballPath,
        key: definition.key,
        expected: definition,
      });
      return { key: definition.key, packedPackage: inspected.packedPackage };
    });
    assertSupportedNodeEngines(packages);

    const rejectedPrefix = path.join(root, "rejected-shared-prefix");
    const allKeys = definitions.map((item) => item.key);
    const ambiguousClaims = collectBinClaims(packages, allKeys);
    let rejected = false;
    try {
      assertResolvedBinOwnership({
        claims: ambiguousClaims,
        owners: {},
        profile: "ambiguous-shared-prefix",
      });
    } catch (error) {
      if (!String(error).includes("No installation started")) throw error;
      rejected = true;
    }
    if (!rejected || fs.existsSync(rejectedPrefix)) {
      throw new Error(
        "Ambiguous shared-prefix install was not rejected before mutation.",
      );
    }

    const canonical = createInstallPlan({
      packages,
      artifacts: artifacts.packages,
      profileName: "canonical",
    });
    const legacy = createInstallPlan({
      packages,
      artifacts: artifacts.packages,
      profileName: "legacy",
    });

    const warmPrefix = path.join(root, "cache-warm-legacy");
    runInstall({
      runner,
      plan: legacy,
      prefix: warmPrefix,
      cacheDir,
      userConfig,
      offline: false,
    });
    assertInstalledProfile({
      runner,
      plan: legacy,
      packages,
      prefix: warmPrefix,
      userConfig,
    });

    for (const plan of [canonical, legacy]) {
      const prefix = path.join(root, `offline-${plan.profileName}`);
      runInstall({
        runner,
        plan,
        prefix,
        cacheDir,
        userConfig,
        offline: true,
      });
      assertInstalledProfile({ runner, plan, packages, prefix, userConfig });
    }

    const result = {
      version: artifacts.version,
      manifestSha256: artifacts.manifestSha256,
      packageOrder: artifacts.packages.map((item) => item.key),
      profiles: [canonical.profileName, legacy.profileName],
      rejectedAmbiguousBin: true,
      offlineVerified: true,
    };
    log(
      `ok release conformance ${result.version}: four sealed tarballs, ` +
        "ambiguous cstl rejected before install, canonical and legacy profiles " +
        "installed from a fresh offline cache snapshot.",
    );
    return result;
  } finally {
    if (ownedTemporary && fs.existsSync(root)) {
      fs.rmSync(root, { recursive: true, force: true, maxRetries: 3 });
    }
  }
}

function main() {
  verifyReleaseConformance();
}

const invokedAs = process.argv[1];
if (
  invokedAs &&
  import.meta.url === pathToFileURL(path.resolve(invokedAs)).href
) {
  try {
    main();
  } catch (error) {
    console.error(
      `x ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
