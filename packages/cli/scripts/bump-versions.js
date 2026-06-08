#!/usr/bin/env node
/**
 * Bump @mindfoldhq/trellis and @mindfoldhq/trellis-core to the same next
 * version. Replaces the per-package `pnpm version --no-git-tag-version`
 * calls in the release scripts so the two packages can never drift.
 *
 * Usage:
 *   node scripts/bump-versions.js <type>
 *
 * <type>:
 *   patch | minor | major
 *   beta | rc                  -- prerelease bump using the given preid
 *   promote                    -- strip prerelease suffix (X.Y.Z-rc.N -> X.Y.Z)
 *
 * Reads current version from packages/cli/package.json; refuses to run if
 * core and cli already disagree (call `release-preflight check-versions`
 * separately to diagnose). Writes the new version into both package.json
 * files atomically (read -> compute -> write both).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../../..");
const CORE_PKG = path.join(REPO_ROOT, "packages/core/package.json");
const CLI_PKG = path.join(REPO_ROOT, "packages/cli/package.json");

const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const RESET = "\x1b[0m";

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, "utf-8"));
}

function writeJSON(p, obj) {
  // Preserve trailing newline that npm/pnpm write.
  fs.writeFileSync(p, JSON.stringify(obj, null, 2) + "\n");
}

function fail(msg) {
  console.error(`${RED}x ${msg}${RESET}`);
  process.exit(1);
}

function parseVersion(v) {
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-([A-Za-z0-9.+-]+))?$/);
  if (!m) fail(`unparseable version: ${v}`);
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
    prerelease: m[4] ?? null,
  };
}

function bumpPrerelease(current, preid) {
  const parsed = parseVersion(current);
  if (parsed.prerelease) {
    // Existing prerelease: if same preid, bump its counter; otherwise switch
    // track (rc.N -> beta.0 is unusual but we mirror what pnpm/npm do).
    const m = parsed.prerelease.match(/^([A-Za-z0-9-]+)\.(\d+)$/);
    if (m && m[1] === preid) {
      return `${parsed.major}.${parsed.minor}.${parsed.patch}-${preid}.${Number(m[2]) + 1}`;
    }
    const seed = parsed.prerelease.match(/^(\d+)$/);
    if (seed) {
      // X.Y.Z-N seed format lifts to X.Y.Z-<preid>.0.
      return `${parsed.major}.${parsed.minor}.${parsed.patch}-${preid}.0`;
    }
    // Track switch: drop any other prerelease and start <preid>.0 on same base.
    return `${parsed.major}.${parsed.minor}.${parsed.patch}-${preid}.0`;
  }
  // Stable -> prerelease bumps the patch first (npm semver behavior).
  return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}-${preid}.0`;
}

export function computeNext(current, type) {
  const v = parseVersion(current);
  switch (type) {
    case "patch":
      if (v.prerelease) return `${v.major}.${v.minor}.${v.patch}`;
      return `${v.major}.${v.minor}.${v.patch + 1}`;
    case "minor":
      return `${v.major}.${v.minor + 1}.0`;
    case "major":
      return `${v.major + 1}.0.0`;
    case "beta":
      return bumpPrerelease(current, "beta");
    case "rc":
      return bumpPrerelease(current, "rc");
    case "promote":
      if (!v.prerelease) {
        fail(`promote requires a prerelease version (got ${current}).`);
      }
      return `${v.major}.${v.minor}.${v.patch}`;
    default:
      fail(`unknown bump type: ${type}`);
      return null; // unreachable
  }
}

function main() {
  const [type] = process.argv.slice(2);
  if (!type) fail(`usage: bump-versions.js <patch|minor|major|beta|rc|promote>`);

  const core = readJSON(CORE_PKG);
  const cli = readJSON(CLI_PKG);
  if (core.version !== cli.version) {
    fail(
      `Pre-bump version mismatch: core=${core.version} cli=${cli.version}.\n` +
        `Reconcile them manually (edit both package.json files to the same value)\n` +
        `before running release scripts again.`,
    );
  }

  const next = computeNext(cli.version, type);
  core.version = next;
  cli.version = next;
  writeJSON(CORE_PKG, core);
  writeJSON(CLI_PKG, cli);
  // Human message to stderr so stdout stays a clean machine-readable value.
  process.stderr.write(
    `${GREEN}ok${RESET} bumped @mindfoldhq/trellis and @mindfoldhq/trellis-core (${type}) -> ${next}\n`,
  );
  process.stdout.write(next + "\n");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
