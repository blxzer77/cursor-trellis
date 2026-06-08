import type { ChannelEvent } from "../internal/store/events.js";
import type { ChannelEventFilter } from "../internal/store/filter.js";
import {
  channelDir,
  listChannelNamesInProject,
} from "../internal/store/paths.js";
import {
  GLOBAL_PROJECT_KEY,
  type ChannelRef,
  type ChannelScope,
} from "../internal/store/schema.js";
import { watchEvents } from "../internal/store/watch.js";

/** Stable per-channel cursor key: `${scope}/${project}/${name}`. */
export type ChannelCursorKey = string;

/** Per-channel resume cursor for the cross-channel watcher. */
export type ChannelCursor = Record<ChannelCursorKey, number>;

export function channelCursorKey(ref: ChannelRef): ChannelCursorKey {
  return `${ref.scope}/${ref.project}/${ref.name}`;
}

export interface WatchChannelsInput {
  /** Project bucket scope, or the global bucket. */
  scope: { projectKey: string } | "global";
  filter?: ChannelEventFilter;
  /** Per-channel resume cursors keyed by {@link channelCursorKey}. */
  cursor?: ChannelCursor;
  signal?: AbortSignal;
  /**
   * When a channel is discovered after the watcher starts, read its
   * backlog from seq 0. Default false (tail from end).
   */
  fromStartNewChannels?: boolean;
  /** Channel-discovery poll interval in ms. Default 500. */
  discoveryIntervalMs?: number;
}

export interface CrossChannelEvent {
  channel: ChannelRef;
  event: ChannelEvent;
  /** Snapshot of the full cursor map after applying this event. */
  cursor: ChannelCursor;
}

function resolveScope(input: WatchChannelsInput): {
  project: string;
  scope: ChannelScope;
} {
  if (input.scope === "global") {
    return { project: GLOBAL_PROJECT_KEY, scope: "global" };
  }
  return { project: input.scope.projectKey, scope: "project" };
}

/**
 * Watch every channel in a project (or the global) scope and fan their
 * events into a single stream. Channels created inside the scope after
 * the watcher starts are discovered dynamically. Each yielded event
 * carries a snapshot of the per-channel cursor map so consumers can
 * checkpoint `(channel, seq)` — delivery is at-least-once.
 */
export async function* watchChannels(
  input: WatchChannelsInput,
): AsyncGenerator<CrossChannelEvent, void, unknown> {
  const { project, scope } = resolveScope(input);
  const filter = input.filter ?? {};
  const discoveryIntervalMs = input.discoveryIntervalMs ?? 500;
  const cursor: ChannelCursor = { ...(input.cursor ?? {}) };

  const queue: CrossChannelEvent[] = [];
  const active = new Set<ChannelCursorKey>();
  const controllers = new Map<ChannelCursorKey, AbortController>();
  const tasks = new Set<Promise<void>>();
  let wake: (() => void) | null = null;
  let done = false;
  let discovery: ReturnType<typeof setInterval> | undefined;
  let cleaned = false;

  const notify = (): void => {
    if (wake) {
      const w = wake;
      wake = null;
      w();
    }
  };

  const cleanup = (): void => {
    if (cleaned) return;
    cleaned = true;
    for (const controller of controllers.values()) {
      controller.abort();
    }
    controllers.clear();
    if (discovery !== undefined) {
      clearInterval(discovery);
      discovery = undefined;
    }
    input.signal?.removeEventListener("abort", abortHandler);
  };

  const abortHandler = (): void => {
    done = true;
    cleanup();
    notify();
  };
  input.signal?.addEventListener("abort", abortHandler);

  let initialScan = true;

  const startWatcher = (name: string): void => {
    const ref: ChannelRef = {
      name,
      scope,
      project,
      dir: channelDir(name, project),
    };
    const key = channelCursorKey(ref);
    if (active.has(key)) return;
    active.add(key);
    const controller = new AbortController();
    controllers.set(key, controller);
    const resume = cursor[key];
    const watchOpts: {
      signal?: AbortSignal;
      fromStart?: boolean;
      sinceSeq?: number;
      project?: string;
    } = { project };
    watchOpts.signal = controller.signal;
    if (resume !== undefined) {
      watchOpts.sinceSeq = resume;
    } else {
      // No prior cursor: initial channels read their backlog; channels
      // discovered later follow `fromStartNewChannels`.
      watchOpts.fromStart = initialScan
        ? true
        : (input.fromStartNewChannels ?? false);
    }
    const task = (async () => {
      try {
        for await (const ev of watchEvents(name, filter, watchOpts)) {
          cursor[key] = ev.seq;
          queue.push({ channel: ref, event: ev, cursor: { ...cursor } });
          notify();
        }
      } catch {
        // Watcher ended (abort / fs error). Discovery may restart it
        // while the parent watcher is still active.
      } finally {
        active.delete(key);
        controllers.delete(key);
      }
    })();
    tasks.add(task);
    void task.finally(() => {
      tasks.delete(task);
    });
  };

  for (const name of listChannelNamesInProject(project)) {
    startWatcher(name);
  }
  initialScan = false;

  discovery = setInterval(() => {
    if (done) return;
    for (const name of listChannelNamesInProject(project)) {
      startWatcher(name);
    }
  }, discoveryIntervalMs);

  try {
    while (!done) {
      if (input.signal?.aborted) return;
      if (queue.length > 0) {
        yield queue.shift() as CrossChannelEvent;
        continue;
      }
      await new Promise<void>((resolve) => {
        wake = resolve;
      });
    }
    // Drain anything that landed during the final wake.
    while (queue.length > 0) {
      yield queue.shift() as CrossChannelEvent;
    }
  } finally {
    done = true;
    cleanup();
    await Promise.allSettled([...tasks]);
  }
}
