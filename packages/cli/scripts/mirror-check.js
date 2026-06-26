#!/usr/bin/env node
/**
 * Maintainer guard: dogfood .cursor/{rules,agents} + AGENTS.md must mirror CLI templates.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPackageRoot = path.resolve(__dirname, "..");
const trellisRoot = path.resolve(cliPackageRoot, "../..");
const templateCursorDir = path.join(cliPackageRoot, "src/templates/cursor");
const templateAgentsPath = path.join(
  cliPackageRoot,
  "src/templates/markdown/agents.md",
);
const dogfoodCursor = path.join(trellisRoot, ".cursor");

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

const TRELLIS_BLOCK_START = "<!-- TRELLIS:START -->";
const TRELLIS_BLOCK_END = "<!-- TRELLIS:END -->";

function extractTrellisManagedBlock(content) {
  const start = content.indexOf(TRELLIS_BLOCK_START);
  const end = content.indexOf(TRELLIS_BLOCK_END);
  if (start === -1 || end === -1 || end <= start) {
    return normalizeText(content);
  }
  return normalizeText(
    content.slice(start, end + TRELLIS_BLOCK_END.length),
  );
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
    dogfood = extractTrellisManagedBlock(
      fs.readFileSync(dogfoodPath, "utf-8"),
    );
    template = extractTrellisManagedBlock(
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
  path.join(trellisRoot, "AGENTS.md"),
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
