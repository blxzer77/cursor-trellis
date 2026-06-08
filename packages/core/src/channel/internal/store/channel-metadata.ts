import {
  isChannelMetadataEvent,
  isContextEvent,
  isCreateEvent,
  type ChannelEvent,
} from "./events.js";
import {
  asContextEntries,
  asStringArray,
  contextEntryKey,
  type ChannelMetadata,
  type ChannelType,
  type ContextEntry,
} from "./schema.js";

/**
 * Single source of truth for projecting a channel's metadata from its
 * event stream.
 *
 * Covers:
 *   - create event metadata (type, description, labels, context)
 *   - legacy `linkedContext` field on create / thread events
 *   - legacy `type:"thread"` / `type:"threads"` are NOT normalized to
 *     `forum`; they project to `chat` so thread APIs reject them
 *   - `kind:"context", target:"channel"` add/delete projection
 *   - `kind:"channel", action:"title"` set/clear projection
 */
export function reduceChannelMetadata(
  events: ChannelEvent[],
): ChannelMetadata {
  let type: ChannelType = "chat";
  let description: string | undefined;
  let labels: string[] | undefined;
  let title: string | undefined;
  const contextMap = new Map<string, ContextEntry>();

  const addEntries = (entries: ContextEntry[] | undefined): void => {
    if (!entries) return;
    for (const entry of entries) {
      contextMap.set(contextEntryKey(entry), entry);
    }
  };
  const deleteEntries = (entries: ContextEntry[] | undefined): void => {
    if (!entries) return;
    for (const entry of entries) {
      contextMap.delete(contextEntryKey(entry));
    }
  };

  for (const ev of events) {
    if (isCreateEvent(ev)) {
      type = normalizeChannelType(ev.type);
      if (typeof ev.description === "string") description = ev.description;
      labels = asStringArray(ev.labels) ?? labels;
      // Initial context comes from `context` (new) or legacy
      // `linkedContext`. New entries replace any prior state because a
      // `create` event is always seq 1.
      const initial =
        asContextEntries(ev.context) ?? asContextEntries(ev.linkedContext);
      contextMap.clear();
      addEntries(initial);
      continue;
    }

    if (isContextEvent(ev) && ev.target === "channel") {
      const entries = asContextEntries(ev.context);
      if (ev.action === "add") addEntries(entries);
      else if (ev.action === "delete") deleteEntries(entries);
      continue;
    }

    if (isChannelMetadataEvent(ev) && ev.action === "title") {
      const next = ev.title;
      if (typeof next === "string" && next.length > 0) title = next;
      else if (next === null || next === "") title = undefined;
      continue;
    }
  }

  const context = contextMap.size > 0 ? [...contextMap.values()] : undefined;

  return {
    type,
    ...(title !== undefined ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(context !== undefined ? { context } : {}),
    ...(labels !== undefined ? { labels } : {}),
  };
}

/**
 * Legacy compatibility: project a single create event into channel
 * metadata. New callers should use {@link reduceChannelMetadata} over
 * the full event stream so context add/delete, title set/clear, and
 * legacy `linkedContext` projection are honored.
 */
export function metadataFromCreateEvent(
  create: ChannelEvent | undefined,
): ChannelMetadata {
  if (!create || !isCreateEvent(create)) return { type: "chat" };
  return reduceChannelMetadata([create]);
}

function normalizeChannelType(value: unknown): ChannelType {
  if (value === "forum") return "forum";
  // Legacy `"thread"` / `"threads"` values are intentionally not
  // upgraded to `forum`; they fall through to `chat` so forum/thread
  // APIs reject pre-rename channels.
  return "chat";
}
