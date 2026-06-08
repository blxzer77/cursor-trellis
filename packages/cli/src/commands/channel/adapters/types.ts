import type { ChannelEventKind } from "../store/events.js";

/**
 * Event emitted by an adapter from a single line of worker stdout.
 *
 * The adapter never assigns `seq` / `ts` / `by` — supervisor adds those before
 * appending to events.jsonl. Adapter only decides `kind` + payload.
 */
export interface AdapterEvent {
  kind: ChannelEventKind;
  /** Free-form payload merged into the event. */
  payload?: Record<string, unknown>;
}

/**
 * Side effects the adapter requested while parsing this line.
 * Supervisor performs them after appending the events.
 */
export interface AdapterSideEffect {
  persistSessionId?: string;
  persistThreadId?: string;
  /** Lines (already newline-terminated) the adapter wants written to worker stdin. */
  reply?: string[];
  /** Resolutions to pending outgoing requests, keyed by id. */
  resolved?: { id: number; result?: unknown; error?: unknown }[];
}

export interface ParseResult {
  events: AdapterEvent[];
  side?: AdapterSideEffect;
}
