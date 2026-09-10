#!/usr/bin/env node
/**
 * Maintainer guard: dogfood .cursor/{rules,agents} + AGENTS.md must mirror CLI templates.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPackageRoot = path.resolve(__dirname, "..");
const pactileRoot = path.resolve(cliPackageRoot, "../..");
const templateCursorDir = path.join(cliPackageRoot, "src/templates/cursor");
const templateAgentsPath = path.join(
  cliPackageRoot,
  "src/templates/markdown/agents.md",
);
const dogfoodCursor = path.join(pactileRoot, ".cursor");
const dogfoodAgents = path.join(pactileRoot, "AGENTS.md");

// Thin-connected checkouts deliberately do not own a local .cursor tree: the
// harness root owns that projection. Keep the standalone parity guard strict
// whenever dogfood exists, but report the declared thin-connect topology as
// not applicable instead of manufacturing host files in the product repo.
const isThinConnected =
  fs.existsSync(dogfoodAgents) &&
  /\bthin-connect(?:ed)?\b/iu.test(fs.readFileSync(dogfoodAgents, "utf-8"));
if (isThinConnected && !fs.existsSync(dogfoodCursor)) {
  console.log(
    "Mirror check not applicable: thin-connected checkout has no product-owned .cursor dogfood tree.",
  );
  process.exit(0);
}

function normalizeText(content) {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/u, ""))
    .join("\n");
}

function listRelativeFiles(root, subdir) {
  const dir = path.join(root, subdir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => !name.startsWith("."))
    .sort()
    .map((name) => path.posix.join(subdir, name));
}

const PACTILE_BLOCK_START = "<!-- PACTILE:START -->";
const PACTILE_BLOCK_END = "<!-- PACTILE:END -->";

function extractManagedBlock(content) {
  const startIdx = content.indexOf(PACTILE_BLOCK_START);
  const endIdx = content.indexOf(PACTILE_BLOCK_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return normalizeText(
      content.slice(startIdx, endIdx + PACTILE_BLOCK_END.length),
    );
  }
  return normalizeText(content);
}

function comparePair(relativePath, dogfoodPath, templatePath, diffs) {
  const dogfoodExists = fs.existsSync(dogfoodPath);
  const templateExists = fs.existsSync(templatePath);

  if (!dogfoodExists && templateExists) {
    diffs.push(`${relativePath}: present in template, missing in dogfood`);
    return;
  }
  if (dogfoodExists && !templateExists) {
    diffs.push(`${relativePath}: present in dogfood, missing in template`);
    return;
  }
  if (!dogfoodExists && !templateExists) return;

  let dogfood;
  let template;
  if (relativePath === "AGENTS.md") {
    dogfood = extractManagedBlock(
      fs.readFileSync(dogfoodPath, "utf-8"),
    );
    template = extractManagedBlock(
      fs.readFileSync(templatePath, "utf-8"),
    );
  } else {
    dogfood = normalizeText(fs.readFileSync(dogfoodPath, "utf-8"));
    template = normalizeText(fs.readFileSync(templatePath, "utf-8"));
  }

  if (dogfood !== template) {
    diffs.push(`${relativePath}: content differs (normalized)`);
  }
}

const diffs = [];
for (const subdir of ["rules", "agents"]) {
  const dogfoodFiles = listRelativeFiles(dogfoodCursor, subdir);
  const templateFiles = listRelativeFiles(templateCursorDir, subdir);
  const allFiles = [...new Set([...dogfoodFiles, ...templateFiles])].sort();
  for (const relativePath of allFiles) {
    comparePair(
      relativePath,
      path.join(dogfoodCursor, relativePath),
      path.join(templateCursorDir, relativePath),
      diffs,
    );
  }
}

comparePair(
  "AGENTS.md",
  dogfoodAgents,
  templateAgentsPath,
  diffs,
);

if (diffs.length === 0) {
  console.log("Mirror check passed: dogfood .cursor and AGENTS.md match templates.");
  process.exit(0);
}

console.error("Mirror check failed:");
for (const line of diffs) {
  console.error(`- ${line}`);
}
process.exit(1);
