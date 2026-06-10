#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const vendorRoot = path.join(packageRoot, "vendor", "smart-search");
const smartSearchPostinstall = path.join(
  vendorRoot,
  "npm",
  "scripts",
  "postinstall.js",
);

if (process.env.TRELLIS_SKIP_SMART_SEARCH_POSTINSTALL === "1") {
  console.log(
    "Skipping smart-search runtime setup (TRELLIS_SKIP_SMART_SEARCH_POSTINSTALL=1).",
  );
  process.exit(0);
}

if (!fs.existsSync(smartSearchPostinstall)) {
  console.error(
    `Trellis smart-search runtime setup script was not found: ${smartSearchPostinstall}`,
  );
  process.exit(1);
}

const result = spawnSync(process.execPath, [smartSearchPostinstall], {
  cwd: vendorRoot,
  stdio: "inherit",
  windowsHide: true,
});

if (result.error) {
  console.error(`Trellis smart-search runtime setup failed: ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
