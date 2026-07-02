#!/usr/bin/env node

import { execSync } from "node:child_process";

const required = [
  "bin/cstl.js",
  "bin/smart-search.js",
  "dist/cli/index.js",
  "dist/templates/trellis/scripts/task.py",
  "dist/templates/trellis/scripts/get_context.py",
  "dist/templates/trellis/scripts/common/retrieval_pack.py",
  "dist/templates/trellis/scripts/common/codebase_retrieval_router.py",
  "dist/templates/trellis/scripts/common/retrieval_adapter_metadata.py",
  "dist/templates/trellis/workflow.md",
  "scripts/postinstall.js",
  "README.md",
  "LICENSE",
];

const forbiddenFragments = [
  ".smart-search-python",
  "vendor/",
  "__pycache__",
  ".egg-info",
];

const forbiddenSuffixes = [".pyc", ".pyo"];

const raw = execSync("npm pack --dry-run --json", {
  encoding: "utf-8",
  stdio: ["pipe", "pipe", "pipe"],
  env: {
    ...process.env,
    TRELLIS_SKIP_SMART_SEARCH_POSTINSTALL: "1",
  },
});

const payload = JSON.parse(raw);
const paths = new Set(
  (payload[0]?.files ?? []).map((file) => String(file.path).replace(/\\/g, "/")),
);
const errors = [];

for (const file of required) {
  if (!paths.has(file)) {
    errors.push(`missing required packed file: ${file}`);
  }
}

for (const file of paths) {
  for (const fragment of forbiddenFragments) {
    if (file.includes(fragment)) {
      errors.push(`forbidden packed path: ${file}`);
    }
  }
  for (const suffix of forbiddenSuffixes) {
    if (file.endsWith(suffix)) {
      errors.push(`forbidden packed path: ${file}`);
    }
  }
}

if (![...paths].some((file) => file.startsWith("dist/migrations/manifests/"))) {
  errors.push("missing migration manifests under dist/migrations/manifests/");
}

if (![...paths].some((file) => file.startsWith("dist/templates/common/bundled-skills/"))) {
  errors.push("missing bundled skill templates under dist/templates/common/bundled-skills/");
}

if (errors.length > 0) {
  console.error("Release pack contents check failed:");
  for (const error of errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

console.log(`ok release pack contents include runtime assets and exclude generated artifacts (${paths.size} files).`);
