/**
 * Supervisor pre-timeout warning scheduler.
 *
 * Emits a one-shot `supervisor_warning` channel event when the worker
 * is approaching its lifetime timeout, so observers (dispatchers /
 * `trellis channel messages`) can see the impending kill without
 * having to poll. The event is observability-only — it never replaces
 * the eventual `killed` / `done` / `error` terminal event, and is
 * not part of the meaningful-event set so plain `wait` does not wake
 * on it unless `--kind supervisor_warning` is explicit.
 *
 * Scheduling lives outside `createShutdown()` because the warning is a
 * pre-terminal observability event, not a terminal one — the shutdown
 * funnel deliberately only owns kill ladder + `killed` append.
 */

import { appendEvent } from "../store/events.js";

/** Default lead time before the supervisor timeout (ms) to fire the warning. */
export const SUPERVISOR_TIMEOUT_WARNING_REMAINING_MS = 5 * 60_000;

export interface SupervisorShutdownProbe {
  isShuttingDown(): boolean;
  hasTerminalEvent(): boolean;
}

export interface ScheduleSupervisorTimeoutWarningArgs {
  channelName: string;
  workerName: string;
  timeoutMs: number;
  /** Warning lead time in ms. `<= 0` disables the pre-timeout warning. */
  warnBeforeMs?: number;
  shutdown: SupervisorShutdownProbe;
  /** Returns true once the child process has exited (exitCode/signalCode set). */
  isChildExited: () => boolean;
  log: { write: (data: string) => void };
  project?: string;
}

/**
 * Schedule a single `supervisor_warning` append at `timeoutMs - warnBeforeMs`
 * (clamped at 0 when the warning lead time is greater than the timeout).
 * Guarded so the warning is emitted at most once, never after shutdown
 * has been requested, never after a terminal event has been emitted,
 * and never after the worker child has exited.
 *
 * Returns a cancel handle that callers can invoke to drop the pending
 * timer (e.g. on supervisor teardown). Append failures are logged via
 * `log.write` only and do not affect worker lifecycle.
 */
export function scheduleSupervisorTimeoutWarning(
  args: ScheduleSupervisorTimeoutWarningArgs,
): () => void {
  const { channelName, workerName, timeoutMs, shutdown, isChildExited, log } =
    args;
  if (timeoutMs <= 0) return () => undefined;
  const warnBeforeMs =
    args.warnBeforeMs ?? SUPERVISOR_TIMEOUT_WARNING_REMAINING_MS;
  if (warnBeforeMs <= 0) return () => undefined;

  const remaining = Math.min(timeoutMs, warnBeforeMs);
  const delay = Math.max(0, timeoutMs - remaining);

  let warningEmitted = false;
  let cancelled = false;

  const fire = (): void => {
    if (cancelled || warningEmitted) return;
    if (
      shutdown.isShuttingDown() ||
      shutdown.hasTerminalEvent() ||
      isChildExited()
    ) {
      return;
    }
    // Claim the slot synchronously so a re-entrant fire (or future
    // caller wiring) cannot race two appends.
    warningEmitted = true;
    void (async () => {
      try {
        await appendEvent(
          channelName,
          {
            kind: "supervisor_warning",
            by: `supervisor:${workerName}`,
            worker: workerName,
            reason: "approaching_timeout",
            timeout_ms: timeoutMs,
            remaining_ms: remaining,
          },
          args.project,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.write(`[supervisor] warning append failed: ${msg}\n`);
      }
    })();
  };

  const timer = setTimeout(fire, delay);
  // Don't keep the supervisor alive solely for the warning timer.
  timer.unref?.();

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}
