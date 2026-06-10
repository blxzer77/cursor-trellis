#!/usr/bin/env node

import path from "node:path";

import {
  collectDirectoryFiles,
  collectSmartSearchVendorFiles,
  resolveSourceRoot,
  syncSmartSearchVendor,
} from "./smart-search-vendor-utils.js";

function usage() {
  console.error(
    "Usage: node scripts/sync-smart-search-vendor.js --source <smartsearch-private-root>",
  );
  console.error(
    "Or set SMARTSEARCH_PRIVATE_PATH to the canonical Smart Search source root.",
  );
}

function parseArgs(args) {
  let source = "";
  let dryRun = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--") {
      continue;
    }
    if (arg === "--help" || arg === "-h") {
      return { help: true, source, dryRun };
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--source") {
      source = args[i + 1] || "";
      i += 1;
      continue;
    }
    if (!arg.startsWith("-") && !source) {
      source = arg;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  return { help: false, source, dryRun };
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  usage();
  process.exit(2);
}

if (options.help) {
  usage();
  process.exit(0);
}

const sourceRoot = resolveSourceRoot(options.source);
if (!sourceRoot) {
  usage();
  process.exit(2);
}

try {
  if (options.dryRun) {
    const vendorFiles = collectSmartSearchVendorFiles(sourceRoot).length;
    const bundledSkillFiles = collectDirectoryFiles(
      path.join(sourceRoot, "skills", "smart-search-cli"),
    ).length;
    console.log(
      `Would sync Smart Search vendor from ${sourceRoot} (${vendorFiles} runtime files, ${bundledSkillFiles} bundled skill files).`,
    );
    process.exit(0);
  }

  const result = syncSmartSearchVendor({ sourceRoot });
  console.log(`Synced Smart Search vendor from ${result.sourceRoot}`);
  console.log(`  vendor: ${result.vendorRoot} (${result.vendorFiles} files)`);
  console.log(
    `  bundled skill: ${result.bundledSkillRoot} (${result.bundledSkillFiles} files)`,
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
