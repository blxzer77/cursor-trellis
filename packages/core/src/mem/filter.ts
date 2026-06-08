/**
 * Project / time-range / source filters for mem session selection.
 *
 * These primitives belong to mem session filtering only — they are not
 * promoted into a cross-domain `core/internal` until another core subdomain
 * needs exactly the same semantics.
 */

import * as path from "node:path";

import type { MemFilter } from "./types.js";

/** Single-point range check: `since ≤ t ≤ until`. Pass-through when `iso` is
 * undefined or unparseable. Internal-only — session list filtering uses
 * {@link inRangeOverlap}. */
export function inRange(iso: string | undefined, f: MemFilter): boolean {
  if (!iso) return true;
  const t = new Date(iso);
  if (Number.isNaN(+t)) return true;
  if (f.since && t < f.since) return false;
  if (f.until && t > f.until) return false;
  return true;
}

/**
 * Interval-overlap range check for sessions with both a start and an end
 * timestamp. A session is kept iff its lifetime `[start, end]` overlaps the
 * query window `[since, until]`.
 *
 * Long / cross-day sessions (created before `--since` but still active inside
 * the window) must survive — single-point `inRange(created, f)` dropped them.
 *
 * Degenerate inputs:
 *   - both undefined → pass through (no timestamp = don't filter)
 *   - one undefined  → fall back to single-point semantics on the other end
 *   - unparseable iso → defer to the parsable end (or pass through if both bad)
 */
export function inRangeOverlap(
  start: string | undefined,
  end: string | undefined,
  f: MemFilter,
): boolean {
  const s = start ?? end;
  const e = end ?? start;
  if (!s && !e) return true;
  if (f.since && e) {
    const eT = new Date(e);
    if (!Number.isNaN(+eT) && eT < f.since) return false;
  }
  if (f.until && s) {
    const sT = new Date(s);
    if (!Number.isNaN(+sT) && sT > f.until) return false;
  }
  return true;
}

/** True iff `sessionCwd` is within `target` (exact match or descendant
 * directory). When `target` is undefined there is no scoping and everything
 * matches; sessions with an unknown cwd are dropped under scoping. */
export function sameProject(
  sessionCwd: string | undefined,
  target: string | undefined,
): boolean {
  if (!target) return true;
  if (!sessionCwd) return false;
  const a = path.resolve(sessionCwd);
  const b = path.resolve(target);
  return a === b || a.startsWith(b + path.sep);
}
