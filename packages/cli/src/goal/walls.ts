import type { GoalState } from "./state.js";

export type WallCheckResult =
  | { ok: true }
  | { ok: false; reason: string; crash: true };

function elapsedSeconds(state: GoalState, nowMs: number): number {
  if (!state.started_at) return 0;
  return Math.max(0, (nowMs - Date.parse(state.started_at)) / 1000);
}

function noProgressSeconds(state: GoalState, nowMs: number): number {
  const anchor = state.last_progress_at ?? state.started_at;
  if (!anchor) return 0;
  return Math.max(0, (nowMs - Date.parse(anchor)) / 1000);
}

export function checkWalls(state: GoalState, nowMs = Date.now()): WallCheckResult {
  const w = state.walls;

  if (state.started_at && elapsedSeconds(state, nowMs) >= w.wallClockSeconds) {
    return {
      ok: false,
      crash: true,
      reason: `wall-clock reached (${w.wallClockSeconds}s)`,
    };
  }

  if (state.worker_turns >= w.workerTurnLimit) {
    return {
      ok: false,
      crash: true,
      reason: `worker turn hard-cap (${w.workerTurnLimit})`,
    };
  }

  if (state.total_turns >= w.totalTurnLimit) {
    return {
      ok: false,
      crash: true,
      reason: `total turn hard-cap (${w.totalTurnLimit})`,
    };
  }

  if (
    state.started_at &&
    noProgressSeconds(state, nowMs) >= w.noProgressSeconds
  ) {
    return {
      ok: false,
      crash: true,
      reason: `no-progress wall (${w.noProgressSeconds}s)`,
    };
  }

  if (state.no_progress_rounds >= w.noProgressRounds) {
    return {
      ok: false,
      crash: true,
      reason: `no-progress rounds (${w.noProgressRounds})`,
    };
  }

  return { ok: true };
}

export function markProgress(state: GoalState, nowMs = Date.now()): GoalState {
  return {
    ...state,
    last_progress_at: new Date(nowMs).toISOString(),
    no_progress_rounds: 0,
  };
}

export function markNoProgressRound(state: GoalState): GoalState {
  return {
    ...state,
    no_progress_rounds: state.no_progress_rounds + 1,
  };
}
