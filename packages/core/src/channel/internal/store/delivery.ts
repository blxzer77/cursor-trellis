import type { UndeliverableReason } from "./events.js";
import type { WorkerRegistry } from "./worker-state.js";

/**
 * Delivery validation mode for targeted `sendMessage`.
 *
 * - `appendOnly`: current behavior — append the message, never signal.
 *   Preserves pre-spawn backlog delivery.
 * - `requireKnownWorker`: signal `undeliverable` for targets that have
 *   never existed in the durable worker registry.
 * - `requireRunningWorker`: signal `undeliverable` for targets that are
 *   unknown or terminal in the durable worker registry.
 */
export type DeliveryMode =
  | "appendOnly"
  | "requireKnownWorker"
  | "requireRunningWorker";

export const DELIVERY_MODES: ReadonlySet<DeliveryMode> = new Set([
  "appendOnly",
  "requireKnownWorker",
  "requireRunningWorker",
]);

export function parseDeliveryMode(
  v: string | undefined,
): DeliveryMode | undefined {
  if (v === undefined) return undefined;
  if (!DELIVERY_MODES.has(v as DeliveryMode)) {
    throw new Error(
      `Invalid delivery mode '${v}'. Must be one of: ${[...DELIVERY_MODES].join(", ")}`,
    );
  }
  return v as DeliveryMode;
}

export interface UndeliverableTarget {
  targetWorker: string;
  reason: UndeliverableReason;
}

/**
 * Classify which targeted workers a message cannot reach under the given
 * delivery mode. Pure — decides only from the durable worker registry,
 * never from OS liveness. `appendOnly` always returns an empty list.
 * Broadcast messages (no targets) never produce undeliverable signals.
 */
export function classifyDelivery(
  registry: WorkerRegistry,
  targets: string[],
  mode: DeliveryMode,
): UndeliverableTarget[] {
  if (mode === "appendOnly" || targets.length === 0) return [];
  const byId = new Map(registry.workers.map((w) => [w.workerId, w]));
  const failed: UndeliverableTarget[] = [];
  for (const target of targets) {
    const worker = byId.get(target);
    if (!worker) {
      failed.push({ targetWorker: target, reason: "worker-unknown" });
      continue;
    }
    if (mode === "requireRunningWorker" && worker.terminal) {
      failed.push({ targetWorker: target, reason: "worker-terminal" });
    }
  }
  return failed;
}
