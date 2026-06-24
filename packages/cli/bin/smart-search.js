#!/usr/bin/env node

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Get the directory of this wrapper script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// smart-search npm wrapper is at: node_modules/@blxzer/smart-search/npm/bin/smart-search.js
const smartSearchBin = join(
  __dirname,
  "..",
  "node_modules",
  "@blxzer",
  "smart-search",
  "npm",
  "bin",
  "smart-search.js"
);

const child = spawn(process.execPath, [smartSearchBin, ...process.argv.slice(2)], {
  stdio: "inherit",
  windowsHide: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
