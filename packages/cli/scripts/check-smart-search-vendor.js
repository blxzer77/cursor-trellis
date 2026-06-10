#!/usr/bin/env node

import {
  compareSmartSearchVendor,
  resolveSourceRoot,
  vendorRootForPackage,
} from "./smart-search-vendor-utils.js";

const vendorRoot = vendorRootForPackage();
const sourceArg = process.argv.slice(2).find((arg) => arg !== "--");
const sourceRoot = resolveSourceRoot(sourceArg);

function usage() {
  console.error(
    "Usage: node scripts/check-smart-search-vendor.js <smartsearch-private-root>",
  );
  console.error(
    "Or set SMARTSEARCH_PRIVATE_PATH to the canonical Smart Search source root.",
  );
}

if (!sourceRoot) {
  usage();
  process.exit(2);
}

let errors;
try {
  errors = compareSmartSearchVendor(sourceRoot, vendorRoot);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(2);
}

if (errors.length > 0) {
  console.error("Smart Search vendor drift detected:");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(`Smart Search vendor matches source: ${sourceRoot}`);
