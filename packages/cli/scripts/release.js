#!/usr/bin/env node
/**
 * Release orchestrator for the CLI + core pair.
 *
 * This keeps package.json as a thin command table while the release sequence
 * stays in one place:
 *   manifest/docs guards -> tests -> pre-release commit -> synchronized bump
 *   -> version check -> version commit -> tag -> push
 */
import { execSync } from "node:child_process";
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

function docsGuard(type) {
  if (type === "beta" || type === "rc" || type === "promote") {
    run(`node scripts/check-docs-changelog.js --type ${type}`);
  }
}

function pushTarget(type) {
  return type === "beta" || type === "rc" ? "HEAD" : "main";
}

function main() {
  const [type = "patch"] = process.argv.slice(2);
  if (!RELEASE_TYPES.has(type)) {
    fail(`usage: release.js <patch|minor|major|beta|rc|promote>`);
  }

  run("node scripts/check-manifest-continuity.js");
  docsGuard(type);
  run("pnpm --filter @mindfoldhq/trellis-core test");
  run("pnpm test");

  run("git add -A -- ':!docs-site' ':!marketplace'");
  if (hasGitDiff()) {
    run("git commit -m 'chore: pre-release updates'");
  }

  const version = output(`node scripts/bump-versions.js ${type}`);
  run("node scripts/release-preflight.js check-versions");
  run("git add package.json ../core/package.json");
  run(`git commit -m "${version}"`);
  run(`git tag "v${version}"`);
  run(`git push origin ${pushTarget(type)} --tags`);
}

main();
