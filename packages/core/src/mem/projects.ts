/**
 * Project aggregation: distinct session cwds with last-active timestamp and
 * per-platform counts.
 */

import { listAll, resolveFilter, WIDE_LIMIT } from "./sessions.js";
import type { ListMemProjectsOptions, MemProjectSummary } from "./types.js";

/**
 * Aggregate distinct project cwds across every platform. Always scans
 * globally (cwd scoping is dropped) — `since` / `until` / `platform` still
 * apply. Results are sorted by `last_active` descending; the caller decides
 * any display cap.
 */
export function listMemProjects(
  options?: ListMemProjectsOptions,
): MemProjectSummary[] {
  const f = resolveFilter(options?.filter);
  const all = listAll({ ...f, cwd: undefined, limit: WIDE_LIMIT });

  const byCwd = new Map<string, MemProjectSummary>();
  for (const s of all) {
    if (!s.cwd) continue;
    const ts = s.updated ?? s.created ?? "";
    let agg = byCwd.get(s.cwd);
    if (!agg) {
      agg = {
        cwd: s.cwd,
        last_active: ts,
        sessions: 0,
        by_platform: { claude: 0, codex: 0, opencode: 0 },
      };
      byCwd.set(s.cwd, agg);
    }
    agg.sessions++;
    agg.by_platform[s.platform]++;
    if (ts > agg.last_active) agg.last_active = ts;
  }

  return [...byCwd.values()].sort((a, b) =>
    b.last_active.localeCompare(a.last_active),
  );
}
