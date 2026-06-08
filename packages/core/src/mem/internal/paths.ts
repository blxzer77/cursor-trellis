/**
 * Default home-based session roots for the persisted-session adapters.
 *
 * `HOME` is captured once at module load — consumers that need to point the
 * adapters at a fake home (tests) must mock `node:os` before importing any
 * mem module.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export const HOME = os.homedir();
export const CLAUDE_PROJECTS = path.join(HOME, ".claude", "projects");
export const CODEX_SESSIONS = path.join(HOME, ".codex", "sessions");

/** Claude sanitizes a cwd into its on-disk project dir name by replacing
 * every `/` and `_` with `-`. */
export function claudeProjectDirFromCwd(cwd: string): string {
  return path.join(CLAUDE_PROJECTS, cwd.replace(/[/_]/g, "-"));
}

/** Lazy stack-based recursive file walk — yields every file path under
 * `root`. Missing roots and unreadable directories are skipped silently. */
export function* walkDir(root: string): Generator<string> {
  if (!fs.existsSync(root)) return;
  const stack: string[] = [root];
  while (stack.length) {
    const cur = stack.pop();
    if (cur === undefined) break;
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = path.join(cur, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile()) yield p;
    }
  }
}
