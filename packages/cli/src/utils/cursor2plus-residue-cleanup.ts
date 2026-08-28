/**
 * Hash-safe cleanup of retired Cursor++ managed residue.
 *
 * Cursor++ product surfaces are no longer shipped. On `cstl update`, delete
 * known managed paths only when on-disk content matches a pristine template
 * hash captured from the last shipped SSOT bytes. User-modified files are
 * preserved with a warning.
 *
 * Never target `.cstl/middleware/` (user overlay). Residue paths are an
 * explicit allow-list; overlay isolation is a separate contract.
 */

import fs from "node:fs";
import path from "node:path";

import { DIR_NAMES } from "../constants/paths.js";
import { computeHash, removeHash } from "./template-hash.js";
import { resolveWorkflowDirName } from "./workflow-dir.js";

/** Relative path under the workflow dir (`.cstl` or `.trellis`) or absolute-from-cwd. */
export interface Cursor2plusResidueTarget {
  /** Posix-style path relative to project cwd (uses `{workflow}` placeholder). */
  pathTemplate: string;
  allowedHashes: readonly string[];
}

/**
 * Pristine hashes computed from packages/cli/src/templates before P23 deletion
 * (LF-normalized SHA-256, same as computeHash).
 */
export const CURSOR2PLUS_RESIDUE_TARGETS: readonly Cursor2plusResidueTarget[] = [
  {
    pathTemplate: "{workflow}/local/cursor2plus/patch_wpelc8.py",
    allowedHashes: [
      "480d24cb0b5f98691938525db2e73326dfc9e2c70783fb3c357bc442f4d4c427",
    ],
  },
  {
    pathTemplate: "{workflow}/local/cursor2plus/smoke.py",
    allowedHashes: [
      "e7eecc069188e1dde85312ac5271932e797a3af37c3ae1bd397bbbbfe4f9785b",
    ],
  },
  {
    pathTemplate: "{workflow}/local/cursor2plus/README.md",
    allowedHashes: [
      "d170822a5f3d2bc01238ca4b9e72acb197b2678da7f5f9ffa0226e09fdb2a312",
    ],
  },
  {
    pathTemplate: "{workflow}/local/cursor2plus/config.local.json.example",
    allowedHashes: [
      "b01b653f74fed06070232eca22f2daeb8c14bf7c99db21446f6ee1105f0ce016",
    ],
  },
  {
    pathTemplate: "{workflow}/local/cursor2plus/trellis_task_models_config.py",
    allowedHashes: [
      "d27ebea2caeb52ec990a99c9e1c20c6a8265f65ceb95f28e01771b4efd6fa891",
    ],
  },
  {
    pathTemplate: "{workflow}/local/subagent-models.json.example",
    allowedHashes: [
      "57212acbb4d2434f13ca5a7b40ec7ca00136870748943a92e8036d8b1e8e7434",
    ],
  },
  {
    pathTemplate: "{workflow}/local/trellis-task-models.json.example",
    allowedHashes: [
      "10b74000b32020fbd5d3be73deeb61c066b51ea6fcfe7c1bba5883deb24fce65",
    ],
  },
  {
    pathTemplate: "{workflow}/local/trellis-task-models.json5.example",
    allowedHashes: [
      "30c7bf1809065eecd9afcafd67ad36d32b5d3a5a3c07f54b9a58a22b4f34f267",
    ],
  },
  {
    pathTemplate: ".cursor/commands/cstl-cursor2plus-setup.md",
    allowedHashes: [
      "7792337f85639e1bd0162d525056ee26cadb3400bf77e98d1a9bfe18d09d885c",
    ],
  },
  {
    pathTemplate: ".cursor/skills/cstl-cursor2plus-setup/SKILL.md",
    allowedHashes: [
      "bc3e11e550caceab6fa3feb994bcc5c4fb45ee612feb5223b0212b061d136d16",
    ],
  },
];

export interface Cursor2plusResidueCleanupResult {
  deleted: string[];
  preservedModified: string[];
  missing: string[];
}

function resolvePathTemplate(
  pathTemplate: string,
  workflowDirName: string,
): string {
  return pathTemplate.replaceAll("{workflow}", workflowDirName);
}

function tryRemoveEmptyParents(filePath: string, stopAt: string): void {
  let dir = path.dirname(filePath);
  const stop = path.resolve(stopAt);
  while (dir.startsWith(stop) && dir !== stop) {
    if (!fs.existsSync(dir)) {
      dir = path.dirname(dir);
      continue;
    }
    const entries = fs.readdirSync(dir);
    if (entries.length > 0) break;
    fs.rmdirSync(dir);
    dir = path.dirname(dir);
  }
}

/**
 * Delete pristine Cursor++ residue under cwd. Never deletes user-modified files.
 */
export function cleanupCursor2plusResidue(
  cwd: string,
  options: { dryRun?: boolean } = {},
): Cursor2plusResidueCleanupResult {
  const workflowDirName = resolveWorkflowDirName(cwd) ?? DIR_NAMES.WORKFLOW;
  const result: Cursor2plusResidueCleanupResult = {
    deleted: [],
    preservedModified: [],
    missing: [],
  };

  for (const target of CURSOR2PLUS_RESIDUE_TARGETS) {
    const rel = resolvePathTemplate(target.pathTemplate, workflowDirName);
    const fullPath = path.join(cwd, rel);
    if (!fs.existsSync(fullPath)) {
      result.missing.push(rel);
      continue;
    }
    const content = fs.readFileSync(fullPath, "utf-8");
    const hash = computeHash(content);
    if (!target.allowedHashes.includes(hash)) {
      result.preservedModified.push(rel);
      continue;
    }
    if (!options.dryRun) {
      fs.unlinkSync(fullPath);
      removeHash(cwd, rel);
      tryRemoveEmptyParents(fullPath, cwd);
    }
    result.deleted.push(rel);
  }

  return result;
}

/**
 * True when any Cursor++ local bundle directory still exists (residue notice).
 */
export function hasCursor2plusBundleResidue(cwd: string): boolean {
  const workflowDirName = resolveWorkflowDirName(cwd) ?? DIR_NAMES.WORKFLOW;
  const candidates = [
    path.join(cwd, workflowDirName, "local", "cursor2plus"),
    path.join(cwd, ".cstl", "local", "cursor2plus"),
    path.join(cwd, ".trellis", "local", "cursor2plus"),
  ];
  return candidates.some((p) => fs.existsSync(p));
}
