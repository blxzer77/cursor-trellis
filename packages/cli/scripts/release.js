#!/usr/bin/env node
/**
 * Release orchestrator for the CLI + core pair.
 *
 * This keeps package.json as a thin command table while the release sequence
 * stays in one place:
 *   manifest guards -> tests -> pre-release commit -> synchronized bump
 *   -> version check -> version commit -> tag -> push
 */
import { execFileSync, execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_DIR = path.resolve(__dirname, "..");

const RELEASE_TYPES = new Set([
  "patch",
  "minor",
  "major",
  "beta",
  "rc",
  "promote",
]);

function fail(message) {
  console.error(`x ${message}`);
  process.exit(1);
}

function run(command, options = {}) {
  execSync(command, {
    cwd: options.cwd ?? CLI_DIR,
    env: process.env,
    stdio: options.capture ? ["pipe", "pipe", "pipe"] : "inherit",
    encoding: "utf-8",
  });
}

/** Avoid shell quoting (Windows cmd/PowerShell do not treat '...' as one argument). */
function gitCommit(message, options = {}) {
  execFileSync("git", ["commit", "-m", message], {
    cwd: options.cwd ?? CLI_DIR,
    env: process.env,
    stdio: "inherit",
  });
}

function output(command, options = {}) {
  return execSync(command, {
    cwd: options.cwd ?? CLI_DIR,
    env: process.env,
    stdio: ["pipe", "pipe", "pipe"],
    encoding: "utf-8",
  }).trim();
}

function hasGitDiff() {
  try {
    execSync("git diff-index --quiet HEAD", {
      cwd: CLI_DIR,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return false;
  } catch {
    return true;
  }
}

function pushTarget(_type) {
  // Fork policy: push only to the `private` remote on the current branch
  // (default: `main`). Do not push to `origin` / upstream.
  return "HEAD";
}

function main() {
  const [type = "patch"] = process.argv.slice(2);
  const explicitVersion = /^\d+\.\d+\.\d+(?:-[A-Za-z0-9.+-]+)?$/.test(type);
  if (!RELEASE_TYPES.has(type) && !explicitVersion) {
    fail(
      `usage: release.js <patch|minor|major|beta|rc|promote|x.y.z[-pre]>`,
    );
  }

  run("node scripts/check-manifest-continuity.js");
  run("pnpm run check:router-copy-sync:hash");
  run("pnpm --filter @blxzer/cursor-trellis-core test");
  run("pnpm test");

  run("git add -A");
  if (hasGitDiff()) {
    gitCommit("chore: pre-release updates");
  }

  const version = output(`node scripts/bump-versions.js ${type}`);
  run("node scripts/release-preflight.js check-versions");
  run("git add package.json ../core/package.json");
  gitCommit(version);
  // Tag with the `cstl-v` prefix to avoid collisions with legacy
  // @blxzer/trellis tags (v0.3.x–v0.6.x) that share this repo's history.
  // release-preflight tagVersionFromEnv still extracts the version from the
  // prefixed tag (its regex is end-anchored, not start-anchored).
  run(`git tag "cstl-v${version}"`);
  // Push HEAD and only this release tag. `git push --tags` also tries to
  // update every local tag and fails when historical tags already exist
  // on the remote with different SHAs.
  run(`git push private ${pushTarget(type)}`);
  run(`git push private "cstl-v${version}"`);
}

main();
