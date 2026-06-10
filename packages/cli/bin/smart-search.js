#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const vendorRoot = path.join(packageRoot, "vendor", "smart-search");
const callerCwd = process.env.INIT_CWD || process.cwd();
const venvDir = path.join(vendorRoot, ".smart-search-python");
const pythonPath =
  process.platform === "win32"
    ? path.join(venvDir, "Scripts", "python.exe")
    : path.join(venvDir, "bin", "python");
const postinstall = path.join(vendorRoot, "npm", "scripts", "postinstall.js");

function fail(message, code = 5) {
  console.error(message);
  process.exit(code);
}

if (!fs.existsSync(path.join(vendorRoot, "pyproject.toml"))) {
  fail(
    "Trellis smart-search runtime is missing. Reinstall @mindfoldhq/trellis or run the package build again.",
  );
}

if (!fs.existsSync(pythonPath)) {
  if (!fs.existsSync(postinstall)) {
    fail(
      `smart-search Python runtime is missing and repair script was not found: ${postinstall}`,
    );
  }

  console.error("smart-search Python runtime is missing; attempting repair...");
  const repaired = spawnSync(process.execPath, [postinstall], {
    cwd: vendorRoot,
    stdio: "inherit",
    windowsHide: true,
  });
  if (repaired.error) {
    fail(`smart-search runtime repair failed: ${repaired.error.message}`);
  }
  if (repaired.status !== 0 || !fs.existsSync(pythonPath)) {
    console.error("Trellis could not find the smart-search Python runtime.");
    console.error(`Expected: ${pythonPath}`);
    console.error("Repair it by reinstalling Trellis or running:");
    console.error("  node scripts/postinstall.js");
    process.exit(repaired.status || 5);
  }
}

const child = spawn(pythonPath, ["-m", "smart_search.cli", ...process.argv.slice(2)], {
  cwd: callerCwd,
  stdio: "inherit",
  env: {
    ...process.env,
    SMART_SEARCH_PACKAGE_ROOT: vendorRoot,
    PYTHONIOENCODING: process.env.PYTHONIOENCODING || "utf-8",
    PYTHONUTF8: process.env.PYTHONUTF8 || "1",
  },
  windowsHide: true,
});

child.on("error", (error) => {
  fail(`Failed to start smart-search: ${error.message}`);
});

child.on("close", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 5);
});
