import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

import { DIR_NAMES } from "../constants/paths.js";
import { workflowPath } from "../utils/workflow-dir.js";

export function newGoalId(now = new Date()): string {
  const ymd = now.toISOString().slice(0, 10).replace(/-/g, "");
  const short = randomBytes(3).toString("hex");
  return `goal-${ymd}-${short}`;
}

export function goalRunsRoot(cwd: string): string {
  const root = workflowPath(cwd, DIR_NAMES.WORKSPACE, "goal-runs");
  if (!root) {
    throw new Error("Trellis workflow not initialized (.cstl missing)");
  }
  return root;
}

export function goalRunDir(cwd: string, goalId: string): string {
  return path.join(goalRunsRoot(cwd), goalId);
}

export function ensureGoalRunDir(cwd: string, goalId: string): string {
  const dir = goalRunDir(cwd, goalId);
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(dir, "packets"), { recursive: true });
  return dir;
}

export function goalStatePath(cwd: string, goalId: string): string {
  return path.join(goalRunDir(cwd, goalId), "state.json");
}

export function goalContractPath(cwd: string, goalId: string): string {
  return path.join(goalRunDir(cwd, goalId), "contract.md");
}

export function goalAuditPath(cwd: string, goalId: string): string {
  return path.join(goalRunDir(cwd, goalId), "audit.log");
}
