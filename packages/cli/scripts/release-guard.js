#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const VERSION_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-(beta|rc|alpha)\.(0|[1-9]\d*))?$/;

export const RELEASE_TAG_PREFIX = "cstl-v";

function commandName(command) {
  if (process.platform !== "win32") return command;
  if (command === "pnpm") return "pnpm.cmd";
  if (command === "npm") return "npm.cmd";
  return command;
}

function quoteCmdArgument(value) {
  const text = String(value);
  if (!/[\s"&|<>^()%!]/.test(text)) return text;
  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Default command seam for release scripts. Tests inject a recorder instead,
 * so no credential, tag, push, or publish is needed to exercise the gates.
 */
export function createCommandRunner({ baseEnv = process.env } = {}) {
  return (command, args = [], options = {}) => {
    const windowsPackageShim =
      process.platform === "win32" && (command === "pnpm" || command === "npm");
    const executable = windowsPackageShim
      ? process.env.ComSpec || "cmd.exe"
      : commandName(command);
    const executableArgs = windowsPackageShim
      ? [
          "/d",
          "/s",
          "/c",
          [commandName(command), ...args].map(quoteCmdArgument).join(" "),
        ]
      : args;
    const env = { ...baseEnv, ...options.env };
    // `undefined` is an explicit request to remove a value inherited by the
    // parent process. Release preparation uses this to keep registry publish
    // credentials out of every build/test/pack child process.
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete env[key];
    }
    return execFileSync(executable, executableArgs, {
      cwd: options.cwd,
      encoding: "utf-8",
      env,
      stdio: options.capture === false ? "inherit" : ["ignore", "pipe", "pipe"],
    });
  };
}

function outputOf(result) {
  if (result === undefined || result === null) return "";
  return Buffer.isBuffer(result) ? result.toString("utf-8") : String(result);
}

function capture(runner, command, args, cwd) {
  return outputOf(runner(command, args, { cwd, capture: true })).trim();
}

function commandSucceeds(runner, command, args, cwd) {
  try {
    runner(command, args, { cwd, capture: true });
    return true;
  } catch {
    return false;
  }
}

export function parseReleaseVersion(version) {
  const match = VERSION_RE.exec(version);
  if (!match) {
    throw new Error(
      `Unsupported release version "${version}". Expected stable semver or ` +
        `a beta.N, rc.N, or alpha.N prerelease.`,
    );
  }
  return {
    version,
    baseVersion: `${match[1]}.${match[2]}.${match[3]}`,
    channel: match[4] ?? "stable",
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
    prereleaseNumber: match[5] === undefined ? null : Number(match[5]),
  };
}

export function compareReleaseVersions(left, right) {
  const a = parseReleaseVersion(left);
  const b = parseReleaseVersion(right);
  for (const key of ["major", "minor", "patch"]) {
    if (a[key] !== b[key]) return a[key] < b[key] ? -1 : 1;
  }
  const channelRank = { alpha: 0, beta: 1, rc: 2, stable: 3 };
  if (channelRank[a.channel] !== channelRank[b.channel]) {
    return channelRank[a.channel] < channelRank[b.channel] ? -1 : 1;
  }
  if (a.channel === "stable") return 0;
  if (a.prereleaseNumber === b.prereleaseNumber) return 0;
  return a.prereleaseNumber < b.prereleaseNumber ? -1 : 1;
}

export function parseReleaseTag(tag) {
  const prefix = RELEASE_TAG_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = new RegExp(`^${prefix}(.+)$`).exec(tag);
  if (!match) {
    throw new Error(
      `Invalid release tag "${tag}". Expected ${RELEASE_TAG_PREFIX}<semver>.`,
    );
  }
  const parsed = parseReleaseVersion(match[1]);
  return { ...parsed, tag };
}

export function resolveReleaseTag({ explicitTag, env = process.env } = {}) {
  let raw = explicitTag ?? "";
  if (!raw && env.GITHUB_REF?.startsWith("refs/tags/")) {
    raw = env.GITHUB_REF;
  } else if (!raw && env.GITHUB_REF_TYPE === "tag") {
    raw = env.GITHUB_REF_NAME ?? "";
  } else if (!raw && env.GITHUB_REF_NAME?.startsWith(RELEASE_TAG_PREFIX)) {
    raw = env.GITHUB_REF_NAME;
  }
  if (raw.startsWith("refs/tags/")) return raw.slice("refs/tags/".length);
  return raw;
}

export function assertMatchingVersions({
  coreVersion,
  cliVersion,
  expectedVersion,
}) {
  parseReleaseVersion(coreVersion);
  parseReleaseVersion(cliVersion);
  if (coreVersion !== cliVersion) {
    throw new Error(
      `Version mismatch: core=${coreVersion}, cli=${cliVersion}. Both packages ` +
        `must share the exact release version.`,
    );
  }
  if (expectedVersion !== undefined && cliVersion !== expectedVersion) {
    throw new Error(
      `Version mismatch: tag/target=${expectedVersion}, packages=${cliVersion}.`,
    );
  }
  return cliVersion;
}

export function assertCleanTree(status) {
  if (status.trim() !== "") {
    throw new Error(
      `Release requires a clean working tree. Commit, stash, or discard these ` +
        `changes before retrying:\n${status}`,
    );
  }
}

export function allowedReleaseBranches(version) {
  const { baseVersion, channel } = parseReleaseVersion(version);
  if (channel === "beta" || channel === "alpha") return ["beta"];
  if (channel === "rc") return ["beta", `release/${baseVersion}`];
  return ["main", `release/${baseVersion}`];
}

export function assertReleaseBranch({ branch, version }) {
  const allowed = allowedReleaseBranches(version);
  if (!allowed.includes(branch)) {
    throw new Error(
      `Release ${version} cannot be prepared from branch "${branch || "(detached)"}". ` +
        `Allowed branches: ${allowed.join(", ")}.`,
    );
  }
}

function requireAncestor(isAncestor, ancestor, descendant, message) {
  if (!isAncestor(ancestor, descendant)) throw new Error(message);
}

function requireSameCommit(isAncestor, head, remoteRef) {
  if (!isAncestor(head, remoteRef) || !isAncestor(remoteRef, head)) {
    throw new Error(
      `Release branch HEAD (${head}) must exactly match ${remoteRef}; refusing ` +
        `an unintegrated, ahead, or stale candidate.`,
    );
  }
}

/** Validate a local release candidate before any build or file mutation. */
export function assertLocalReleaseAncestry({
  branch,
  head,
  version,
  remote,
  isAncestor,
}) {
  const { channel } = parseReleaseVersion(version);
  const betaRef = `${remote}/beta`;
  const mainRef = `${remote}/main`;

  if (branch === "beta") {
    requireSameCommit(isAncestor, head, betaRef);
    return;
  }
  if (branch === "main") {
    requireSameCommit(isAncestor, head, mainRef);
    return;
  }

  // A release/X.Y.Z branch may carry an rc or stable candidate, but it must
  // descend from the integrated beta line. Branch-name validation is separate.
  if (channel === "rc" || channel === "stable") {
    requireAncestor(
      isAncestor,
      betaRef,
      head,
      `Release candidate ${head} is not descended from ${betaRef}.`,
    );
    return;
  }

  throw new Error(`No ancestry policy for ${version} on ${branch}.`);
}

/** Validate an immutable tag's channel provenance in CI or local publish. */
export function assertPublishProvenance({
  tag,
  packageVersion,
  head,
  tagCommit,
  remote,
  isAncestor,
}) {
  const parsed = parseReleaseTag(tag);
  assertMatchingVersions({
    coreVersion: packageVersion,
    cliVersion: packageVersion,
    expectedVersion: parsed.version,
  });
  if (tagCommit !== head) {
    throw new Error(
      `Release tag ${tag} resolves to ${tagCommit}, but checked-out HEAD is ${head}.`,
    );
  }

  const betaRef = `${remote}/beta`;
  const mainRef = `${remote}/main`;
  if (parsed.channel === "stable") {
    requireAncestor(
      isAncestor,
      head,
      mainRef,
      `Stable tag ${tag} is not contained in ${mainRef}.`,
    );
    return parsed;
  }
  if (parsed.channel === "beta" || parsed.channel === "alpha") {
    requireAncestor(
      isAncestor,
      head,
      betaRef,
      `${parsed.channel} tag ${tag} is not contained in ${betaRef}.`,
    );
    return parsed;
  }

  const releaseRef = `${remote}/release/${parsed.baseVersion}`;
  if (!isAncestor(head, betaRef) && !isAncestor(head, releaseRef)) {
    throw new Error(
      `rc tag ${tag} is contained in neither ${betaRef} nor ${releaseRef}.`,
    );
  }
  return parsed;
}

export function inspectLocalRelease({
  runner,
  cwd,
  version,
  remote = "private",
}) {
  const status = capture(
    runner,
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    cwd,
  );
  // Deliberately stop here: a dirty tree does not need any more Git facts and
  // certainly must not reach build, bump, stage, tag, or publish commands.
  assertCleanTree(status);

  const branch = capture(runner, "git", ["branch", "--show-current"], cwd);
  assertReleaseBranch({ branch, version });
  const head = capture(runner, "git", ["rev-parse", "HEAD"], cwd);
  const isAncestor = (ancestor, descendant) =>
    commandSucceeds(
      runner,
      "git",
      ["merge-base", "--is-ancestor", ancestor, descendant],
      cwd,
    );
  assertLocalReleaseAncestry({
    branch,
    head,
    version,
    remote,
    isAncestor,
  });
  return { branch, head, remote, status };
}

export function inspectPublishRelease({
  runner,
  cwd,
  packageVersion,
  explicitTag,
  remote = "origin",
  env = process.env,
}) {
  const status = capture(
    runner,
    "git",
    ["status", "--porcelain=v1", "--untracked-files=all"],
    cwd,
  );
  assertCleanTree(status);
  const tag = resolveReleaseTag({ explicitTag, env });
  // Parsing before additional Git calls gives malformed tags the smallest
  // possible blast radius and a deterministic error.
  parseReleaseTag(tag);
  const head = capture(runner, "git", ["rev-parse", "HEAD"], cwd);
  const tagCommit = capture(
    runner,
    "git",
    ["rev-parse", `${tag}^{commit}`],
    cwd,
  );
  const isAncestor = (ancestor, descendant) =>
    commandSucceeds(
      runner,
      "git",
      ["merge-base", "--is-ancestor", ancestor, descendant],
      cwd,
    );
  const parsed = assertPublishProvenance({
    tag,
    packageVersion,
    head,
    tagCommit,
    remote,
    isAncestor,
  });
  return { ...parsed, head, remote, status };
}
