/**
 * Channel schema re-exports.
 *
 * Canonical source: `@mindfoldhq/trellis-core/channel`. This module is
 * kept as a thin pass-through during the supervisor/wait migration so
 * CLI runtime code (supervisor, spawn, kill, wait) can continue to
 * import from a stable local path while command files migrate to the
 * core public API directly.
 */

export {
  GLOBAL_PROJECT_KEY,
  CHANNEL_TYPES,
  THREAD_ACTIONS,
  parseChannelScope,
  parseChannelType,
  parseThreadAction,
  normalizeThreadKey,
  asStringArray,
  asContextEntries,
  buildContextEntries,
} from "@mindfoldhq/trellis-core/channel";

export type {
  ChannelScope,
  ChannelType,
  ChannelRef,
  ChannelMetadata,
  ContextEntry,
  FileContextEntry,
  RawContextEntry,
  ThreadAction,
  EventOrigin,
} from "@mindfoldhq/trellis-core/channel";

import { buildContextEntries } from "@mindfoldhq/trellis-core/channel";
import type { ContextEntry } from "@mindfoldhq/trellis-core/channel";

/**
 * CSV parser kept colocated with the schema for CLI command files that
 * trim comma-separated label / target lists. Pure helper — does not
 * touch the channel store.
 */
export function parseCsv(value: string | undefined): string[] | undefined {
  const out = value
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return out && out.length > 0 ? out : undefined;
}

/**
 * Legacy alias accepted by CLI flag parsers — old code calls this when
 * processing `--linked-context-file` / `--linked-context-raw`. New code
 * uses {@link buildContextEntries} directly.
 *
 * @deprecated Use buildContextEntries.
 */
export function parseLinkedContext(
  files: string[] | undefined,
  raw: string[] | undefined,
): ContextEntry[] | undefined {
  return buildContextEntries(files, raw);
}
