#!/usr/bin/env node
/**
 * Publish @blxzer/trellis-core and @blxzer/trellis to npm in dependency order.
 *
 * Why this exists: release.js only does the git side (bump + commit + tag +
 * push). npm publishing was manual, and manual publishing repeatedly forgot
 * core (core's 1.1.0 was never published; 1.1.1 was missed until the manifest
 * continuity gate caught it). This script makes the publish step a single
 * command so both packages always land together.
 *
 * Order matters: core is a dependency of cli. If cli is published first, the
 * cli tarball references a core version that does not exist on npm yet, and
 * `npm install -g @blxzer/trellis` fails with ETARGET until core catches up
 * (this exact breakage happened during 1.1.2 release).
 *
 * Safety:
 *   - Both package.json versions must match before anything is published.
 *   - core is built fresh (dist/ is gitignored, never committed).
 *   - cli relies on its own `prepublishOnly` (test + build + copy-release-assets).
 *
 * Usage:
 *   node scripts/publish-packages.js              # publish both
 *   node scripts/publish-packages.js --dry-run    # npm pack --dry-run, no upload
 *
 * Prerequisite: run `pnpm release <type>` first (git side: bump + tag + push).
 * This script does NOT bump versions or touch git.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_DIR = path.resolve(__dirname, "..");
const CORE_DIR = path.resolve(CLI_DIR, "../core");

function readVersion(pkgDir) {
  const pkg = JSON.parse(
    fs.readFileSync(path.join(pkgDir, "package.json"), "utf-8"),
  );
  return pkg.version;
}

function run(command, options = {}) {
  execSync(command, {
    cwd: options.cwd ?? CLI_DIR,
    env: process.env,
    stdio: "inherit",
  });
}

function fail(message) {
  console.error(`\x1b[31m✗ ${message}\x1b[0m`);
  process.exit(1);
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const publishArgs = dryRun
    ? "npm pack --dry-run"
    : "pnpm publish --access public --no-git-checks";

  // Step 1: version parity guard — both packages must be at the same version
  // before anything ships. release.js bumps them together via bump-versions.js,
  // so a mismatch here means someone edited one package.json by hand.
  const cliVersion = readVersion(CLI_DIR);
  const coreVersion = readVersion(CORE_DIR);
  if (cliVersion !== coreVersion) {
    fail(
      `Version mismatch: @blxzer/trellis@${cliVersion} vs @blxzer/trellis-core@${coreVersion}. ` +
        `Reconcile both package.json files before publishing.`,
    );
  }
  console.log(`\x1b[32m✓\x1b[0m versions match: ${cliVersion}`);

  // Step 2: npm auth guard — fail fast with a clear message instead of a
  // cryptic 403 mid-publish.
  try {
    execSync("npm whoami", { stdio: "pipe", encoding: "utf-8" });
  } catch {
    fail(
      "Not logged in to npm. Run `npm login` as the package owner first.",
    );
  }

  // Step 3: publish core first (cli depends on it). Build fresh because
  // dist/ is gitignored and may be stale or absent after a clean checkout.
  console.log("\n— @blxzer/trellis-core —");
  run("pnpm run build", { cwd: CORE_DIR });
  run(publishArgs, { cwd: CORE_DIR });

  // Step 4: publish cli. Its prepublishOnly (test + build + copy-release-assets)
  // runs as part of `pnpm publish` and is the final safety gate. In --dry-run
  // mode we skip publish entirely (npm pack --dry-run does not trigger
  // prepublishOnly), so build manually to exercise the same artifact shape.
  console.log("\n— @blxzer/trellis —");
  if (dryRun) {
    run("pnpm run build", { cwd: CLI_DIR });
    run("pnpm run copy:release-assets", { cwd: CLI_DIR });
  }
  run(publishArgs, { cwd: CLI_DIR });

  console.log(
    `\n\x1b[32m✓ Published @blxzer/trellis-core@${coreVersion} and @blxzer/trellis@${cliVersion}\x1b[0m`,
  );
}

main();
