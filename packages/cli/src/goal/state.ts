import fs from "node:fs";

import type { GoalLifecycleState, GoalRunMode } from "./constants.js";
import { GOAL_WALL_DEFAULTS } from "./constants.js";
import { goalStatePath } from "./paths.js";

export interface GoalContract {
  goalText: string;
  doneWhen: string[];
  evidenceHow: string;
  acceptedAt: string;
}

export interface GoalWallCounters {
  wallClockSeconds: number;
  noProgressSeconds: number;
  noProgressRounds: number;
  workerTurnLimit: number;
  totalTurnLimit: number;
  workerTurnTimeoutMs: number;
  maxReroutes: number;
  maxReviewRetries: number;
}

export interface GoalState {
  goal_id: string;
  lifecycle: GoalLifecycleState;
  mode: GoalRunMode;
  goal_text: string;
  contract?: GoalContract;
  task_dir: string | null;
  started_at: string | null;
  last_progress_at: string | null;
  worker_turns: number;
  total_turns: number;
  no_progress_rounds: number;
  reroute_counts: Record<string, number>;
  walls: GoalWallCounters;
  channel_name: string | null;
}

export function defaultWalls(mode: GoalRunMode): GoalWallCounters {
  return { ...GOAL_WALL_DEFAULTS[mode] };
}

export function createDraftState(
  goalId: string,
  goalText: string,
  mode: GoalRunMode,
): GoalState {
  return {
    goal_id: goalId,
    lifecycle: "draft",
    mode,
    goal_text: goalText,
    task_dir: null,
    started_at: null,
    last_progress_at: null,
    worker_turns: 0,
    total_turns: 0,
    no_progress_rounds: 0,
    reroute_counts: {},
    walls: defaultWalls(mode),
    channel_name: null,
  };
}

export function readGoalState(cwd: string, goalId: string): GoalState {
  const file = goalStatePath(cwd, goalId);
  if (!fs.existsSync(file)) {
    throw new Error(`Goal state not found: ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf-8")) as GoalState;
}

export function writeGoalState(cwd: string, state: GoalState): void {
  const file = goalStatePath(cwd, state.goal_id);
  fs.mkdirSync(file.replace(/[/\\][^/\\]+$/, ""), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(state, null, 2)}\n`, "utf-8");
}
