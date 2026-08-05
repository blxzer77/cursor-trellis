import fs from "node:fs";

import type { GoalRunMode } from "./constants.js";
import { goalAuditPath } from "./paths.js";

export function appendAuditLine(
  cwd: string,
  goalId: string,
  layer: "L0" | "L1" | "L2",
  line: string,
): void {
  const file = goalAuditPath(cwd, goalId);
  fs.mkdirSync(file.replace(/[/\\][^/\\]+$/, ""), { recursive: true });
  const stamp = new Date().toISOString();
  fs.appendFileSync(file, `[${stamp}] ${layer} ${line}\n`, "utf-8");
}

export function formatL1Line(l1: {
  time: string;
  action: string;
  axes: { A: boolean; B: boolean; C: boolean };
  reviewer: string;
  decision: string;
  rollback_hint: string;
}): string {
  return JSON.stringify(l1);
}
