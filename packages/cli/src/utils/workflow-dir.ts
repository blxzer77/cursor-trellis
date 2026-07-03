import fs from "node:fs";
import path from "node:path";

import { DIR_NAMES } from "../constants/paths.js";

/** Pre-0.3.1 cursor-trellis runtime directory (upstream Trellis still uses this name). */
export const LEGACY_WORKFLOW_DIR = ".trellis";

/**
 * Resolve the active workflow directory name for this project.
 * Prefers `.cstl/`; falls back to legacy `.trellis/` for pre-migration trees.
 */
export function resolveWorkflowDirName(cwd: string): string | null {
  if (fs.existsSync(path.join(cwd, DIR_NAMES.WORKFLOW))) {
    return DIR_NAMES.WORKFLOW;
  }
  if (fs.existsSync(path.join(cwd, LEGACY_WORKFLOW_DIR))) {
    return LEGACY_WORKFLOW_DIR;
  }
  return null;
}

/** Absolute path to the active workflow root, or null when not initialized. */
export function workflowDirPath(cwd: string): string | null {
  const name = resolveWorkflowDirName(cwd);
  return name ? path.join(cwd, name) : null;
}

export function isWorkflowInitialized(cwd: string): boolean {
  return resolveWorkflowDirName(cwd) !== null;
}

/** Join a path segment under the active workflow dir (POSIX-style relative segments). */
export function workflowPath(cwd: string, ...segments: string[]): string | null {
  const root = workflowDirPath(cwd);
  if (!root) {
    return null;
  }
  return path.join(root, ...segments);
}
