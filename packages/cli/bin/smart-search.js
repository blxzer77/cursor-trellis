#!/usr/bin/env node

import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { spawn } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");

// Forward to @blxzer/smart-search dependency
const smartSearchBin = join(
  packageRoot,
  "node_modules",
  "@blxzer",
  "smart-search",
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
