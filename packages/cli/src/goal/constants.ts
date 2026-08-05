/** Frozen MVP wall defaults (runtime Child design §8). */
export const GOAL_WALL_DEFAULTS = {
  runner: {
    wallClockSeconds: 3 * 60 * 60,
    noProgressSeconds: 20 * 60,
    noProgressRounds: 3,
    workerTurnLimit: 12,
    totalTurnLimit: 24,
    workerTurnTimeoutMs: 30 * 60 * 1000,
    maxReroutes: 3,
    maxReviewRetries: 2,
  },
  window: {
    wallClockSeconds: 45 * 60,
    noProgressSeconds: 20 * 60,
    noProgressRounds: 3,
    workerTurnLimit: 8,
    totalTurnLimit: 16,
    workerTurnTimeoutMs: 15 * 60 * 1000,
    maxReroutes: 3,
    maxReviewRetries: 2,
  },
} as const;

export type GoalRunMode = keyof typeof GOAL_WALL_DEFAULTS;

export type GoalLifecycleState =
  | "draft"
  | "preflight_pending"
  | "running"
  | "paused"
  | "completed"
  | "crashed";
