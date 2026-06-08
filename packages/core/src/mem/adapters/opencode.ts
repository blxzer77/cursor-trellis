/**
 * OpenCode session reader — currently a degraded no-op.
 *
 * OpenCode 1.2+ moved to a SQLite store at
 * `~/.local/share/opencode/opencode.db`. The previous SQLite reader required a
 * native dependency (`better-sqlite3`) whose prebuilt-tarball + node-gyp
 * fallback chain broke `npm install` on Windows + restricted networks, so it
 * was reverted. These adapter functions are kept (dispatch / phase slicing
 * rely on them) but degraded to silent no-ops.
 *
 * The "OpenCode reader unavailable" warning is a presentation concern owned by
 * the CLI — core never prints. Re-enabled in a future release once a
 * non-native backend ships.
 */

import { searchInDialogue } from "../search.js";
import type {
  DialogueTurn,
  MemFilter,
  MemSessionInfo,
  SearchHit,
} from "../types.js";

export function opencodeListSessions(_f: MemFilter): MemSessionInfo[] {
  return [];
}

export function opencodeExtractDialogue(_s: MemSessionInfo): DialogueTurn[] {
  return [];
}

export function opencodeSearch(kw: string): SearchHit {
  return searchInDialogue([], kw);
}
