#!/usr/bin/env node

import { createRequire } from "node:module";
import { spawn } from "node:child_process";

const require = createRequire(import.meta.url);

// Resolve @blxzer/smart-search package location
let smartSearchBin;
try {
  const smartSearchPackage = require.resolve("@blxzer/smart-search/package.json");
  const smartSearchRoot = smartSearchPackage.replace(/[\/\\]package\.json$/, "");
  smartSearchBin = `${smartSearchRoot}/bin/smart-search.js`;
} catch (err) {
  console.error("Error: @blxzer/smart-search dependency not found.");
  console.error("Please reinstall: npm install -g @blxzer/cursor-trellis");
  process.exit(1);
}

const child = spawn(process.execPath, [smartSearchBin, ...process.argv.slice(2)], {
  stdio: "inherit",
  windowsHide: true,
});

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
