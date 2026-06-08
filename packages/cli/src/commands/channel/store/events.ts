/**
 * Channel events local module.
 *
 * Canonical types and reducers come from `@mindfoldhq/trellis-core`.
 * The legacy local `appendEvent` / `readLastSeq` primitives remain
 * here for CLI runtime callers (supervisor / spawn / kill) that still
 * write directly to the JSONL during the Phase 5 supervisor migration.
 *
 * Local `appendEvent` shares the channel-level lock with core, so
 * concurrent writes stay mutually exclusive. Core's seq sidecar
 * self-repairs on the next core append if a CLI-runtime write lands
 * without updating it.
 */

import fs from "node:fs";
import fsp from "node:fs/promises";

import {
  reduceChannelMetadata,
  type ChannelEvent,
  type ChannelMetadata,
} from "@mindfoldhq/trellis-core/channel";

import { withLock } from "./lock.js";
import { eventsPath, channelDir, lockPath } from "./paths.js";

export {
  CHANNEL_EVENT_KINDS,
  parseChannelKind,
  parseChannelKinds,
  isCreateEvent,
  isThreadEvent,
  isContextEvent,
  isChannelMetadataEvent,
  reduceChannelMetadata,
} from "@mindfoldhq/trellis-core/channel";

export type {
  ChannelEvent,
  ChannelEventKind,
  CreateChannelEvent,
  MessageChannelEvent,
  ThreadChannelEvent,
  ContextChannelEvent,
  ChannelMetadataEvent,
  SpawnedChannelEvent,
  KilledChannelEvent,
  DoneChannelEvent,
  ErrorChannelEvent,
  ProgressChannelEvent,
  SupervisorWarningChannelEvent,
} from "@mindfoldhq/trellis-core/channel";

export async function ensureChannelDir(
  name: string,
  project?: string,
): Promise<string> {
  const dir = channelDir(name, project);
  await fsp.mkdir(dir, { recursive: true, mode: 0o700 });
  return dir;
}

export async function readLastSeq(
  name: string,
  project?: string,
): Promise<number> {
  const file = eventsPath(name, project);
  if (!fs.existsSync(file)) return 0;
  const content = await fsp.readFile(file, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim() !== "");
  if (lines.length === 0) return 0;
  const last = lines[lines.length - 1];
  try {
    const obj = JSON.parse(last) as { seq?: number };
    return typeof obj.seq === "number" ? obj.seq : 0;
  } catch {
    return 0;
  }
}

export interface AppendablePartial {
  kind: ChannelEvent["kind"];
  by: string;
  ts?: string;
  [extra: string]: unknown;
}

/**
 * Local channel append used by CLI runtime code (supervisor / spawn /
 * kill) until the Phase 5 supervisor migration moves those callers to
 * core's typed APIs. Shares the channel-level lock with core, so
 * concurrent writes stay mutually exclusive.
 */
export async function appendEvent(
  name: string,
  partial: AppendablePartial,
  project?: string,
): Promise<ChannelEvent> {
  await ensureChannelDir(name, project);
  return withLock(lockPath(name, project), async () => {
    const lastSeq = await readLastSeq(name, project);
    const event = {
      ...partial,
      seq: lastSeq + 1,
      ts: partial.ts ?? new Date().toISOString(),
    } as ChannelEvent;
    await fsp.appendFile(
      eventsPath(name, project),
      JSON.stringify(event) + "\n",
      "utf-8",
    );
    return event;
  });
}

export async function readChannelEvents(
  name: string,
  project?: string,
): Promise<ChannelEvent[]> {
  const file = eventsPath(name, project);
  if (!fs.existsSync(file)) return [];
  const text = await fsp.readFile(file, "utf-8");
  const events: ChannelEvent[] = [];
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    try {
      events.push(JSON.parse(line) as ChannelEvent);
    } catch {
      continue;
    }
  }
  return events;
}

/**
 * Read projected channel metadata from disk. Delegates to the core
 * reducer so list / messages / forum commands share projection
 * semantics with downstream consumers.
 */
export async function readChannelMetadata(
  name: string,
  project?: string,
): Promise<ChannelMetadata> {
  return reduceChannelMetadata(await readChannelEvents(name, project));
}
