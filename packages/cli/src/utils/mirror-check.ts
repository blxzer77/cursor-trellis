import fs from "node:fs";
import path from "node:path";

import { FILE_NAMES } from "../constants/paths.js";
import { normalizeText } from "./normalize-text.js";

export interface MirrorDiffEntry {
  relativePath: string;
  kind: "missing-dogfood" | "missing-template" | "content";
}

export interface MirrorCheckOptions {
  /** Project root containing .cursor/ and AGENTS.md (dogfood instance) */
  dogfoodRoot: string;
  /** Path to packages/cli/src/templates/cursor */
  templateCursorDir: string;
  /** Path to packages/cli/src/templates/markdown/agents.md */
  templateAgentsPath: string;
}

export interface MirrorCheckResult {
  ok: boolean;
  diffs: MirrorDiffEntry[];
}

const MIRROR_SUBDIRS = ["rules", "agents"] as const;

const PACTILE_BLOCK_START = "<!-- PACTILE:START -->";
const PACTILE_BLOCK_END = "<!-- PACTILE:END -->";

/** Extract the canonical managed block for AGENTS.md mirror comparison. */
export function extractPactileManagedBlock(content: string): string {
  const startIdx = content.indexOf(PACTILE_BLOCK_START);
  const endIdx = content.indexOf(PACTILE_BLOCK_END);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    return normalizeText(
      content.slice(startIdx, endIdx + PACTILE_BLOCK_END.length),
    );
  }
  return normalizeText(content);
}

function listRelativeFiles(root: string, subdir: string): string[] {
  const dir = path.join(root, subdir);
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir)
    .filter((name) => !name.startsWith("."))
    .sort()
    .map((name) => path.posix.join(subdir, name));
}

function compareFilePair(
  relativePath: string,
  dogfoodPath: string,
  templatePath: string,
): MirrorDiffEntry | null {
  const dogfoodExists = fs.existsSync(dogfoodPath);
  const templateExists = fs.existsSync(templatePath);

  if (!dogfoodExists && templateExists) {
    return { relativePath, kind: "missing-dogfood" };
  }
  if (dogfoodExists && !templateExists) {
    return { relativePath, kind: "missing-template" };
  }
  if (!dogfoodExists && !templateExists) {
    return null;
  }

  let dogfood: string;
  let template: string;
  if (relativePath === FILE_NAMES.AGENTS) {
    dogfood = extractPactileManagedBlock(
      fs.readFileSync(dogfoodPath, "utf-8"),
    );
    template = extractPactileManagedBlock(
      fs.readFileSync(templatePath, "utf-8"),
    );
  } else {
    dogfood = normalizeText(fs.readFileSync(dogfoodPath, "utf-8"));
    template = normalizeText(fs.readFileSync(templatePath, "utf-8"));
  }

  if (dogfood !== template) {
    return { relativePath, kind: "content" };
  }
  return null;
}

/** Compare dogfood .cursor/{rules,agents} + AGENTS.md against CLI templates. */
export function runMirrorCheck(options: MirrorCheckOptions): MirrorCheckResult {
  const dogfoodCursor = path.join(options.dogfoodRoot, ".cursor");
  const diffs: MirrorDiffEntry[] = [];

  for (const subdir of MIRROR_SUBDIRS) {
    const dogfoodFiles = listRelativeFiles(dogfoodCursor, subdir);
    const templateFiles = listRelativeFiles(options.templateCursorDir, subdir);
    const allFiles = [...new Set([...dogfoodFiles, ...templateFiles])].sort();

    for (const relativePath of allFiles) {
      const diff = compareFilePair(
        relativePath,
        path.join(dogfoodCursor, relativePath),
        path.join(options.templateCursorDir, relativePath),
      );
      if (diff) {
        diffs.push(diff);
      }
    }
  }

  const agentsDiff = compareFilePair(
    FILE_NAMES.AGENTS,
    path.join(options.dogfoodRoot, FILE_NAMES.AGENTS),
    options.templateAgentsPath,
  );
  if (agentsDiff) {
    diffs.push(agentsDiff);
  }

  return { ok: diffs.length === 0, diffs };
}

export function formatMirrorDiffs(diffs: MirrorDiffEntry[]): string {
  return diffs
    .map((entry) => {
      switch (entry.kind) {
        case "missing-dogfood":
          return `- ${entry.relativePath}: present in template, missing in dogfood`;
        case "missing-template":
          return `- ${entry.relativePath}: present in dogfood, missing in template`;
        case "content":
          return `- ${entry.relativePath}: content differs (normalized)`;
      }
    })
    .join("\n");
}
