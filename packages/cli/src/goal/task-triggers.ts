import type { GoalState } from "./state.js";

export type TaskTriggerId = "T-1" | "T-2" | "T-3" | "T-4" | "T-5";

export interface TaskTriggerHit {
  id: TaskTriggerId;
  reason: string;
}

export function evaluateTaskTriggers(
  state: GoalState,
  ctx: {
    l1Count: number;
    estimatedHours?: number;
    independentDeliverables?: number;
    aboutToPause?: boolean;
    justAcceptedPreflight?: boolean;
  },
): TaskTriggerHit[] {
  const hits: TaskTriggerHit[] = [];

  if (ctx.justAcceptedPreflight) {
    hits.push({ id: "T-5", reason: "preflight accepted — goal-root task required" });
  }

  if ((ctx.estimatedHours ?? 0) > 1) {
    hits.push({ id: "T-1", reason: "estimated or elapsed >1h" });
  }

  if ((ctx.independentDeliverables ?? 0) >= 2) {
    hits.push({ id: "T-2", reason: "≥2 independent deliverables planned" });
  }

  if (ctx.l1Count >= 1 && !state.task_dir) {
    hits.push({ id: "T-3", reason: "≥1 L1 audit without bound task_dir" });
  }

  if (ctx.aboutToPause) {
    hits.push({ id: "T-4", reason: "pause or crash-wall imminent" });
  }

  return hits;
}

export function shouldCreateGoalRootTask(hits: TaskTriggerHit[]): boolean {
  return hits.some((h) => h.id === "T-5" || h.id === "T-3");
}
