import type { ChannelEvent, MessageChannelEvent } from "./events.js";
import type { InboxPolicy } from "./schema.js";

/** Default inbox policy applied to workers / spawned events without one. */
export const DEFAULT_INBOX_POLICY: InboxPolicy = "explicitOnly";

function toList(to: string | string[] | undefined): string[] {
  if (to === undefined) return [];
  return Array.isArray(to) ? to : [to];
}

/**
 * Decide whether a channel `message` event should be delivered to a
 * worker's inbox under the given policy. Single source of truth shared
 * by the worker registry reducer, the delivery helper, and the CLI
 * supervisor inbox watcher.
 *
 * - `explicitOnly`: deliver only when `to` targets the worker.
 * - `broadcastAndExplicit`: also deliver broadcast messages (no `to`).
 *
 * A worker never consumes its own message events.
 */
export function matchesInboxPolicy(
  ev: ChannelEvent,
  workerId: string,
  policy: InboxPolicy,
): ev is MessageChannelEvent {
  if (ev.kind !== "message") return false;
  if (ev.by === workerId) return false;
  const targets = toList(ev.to);
  if (targets.length > 0) return targets.includes(workerId);
  // Broadcast (no `to`).
  return policy === "broadcastAndExplicit";
}
