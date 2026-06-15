import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { PATHS } from "../constants/paths.js";
import { replacePythonCommandLiterals } from "../configurators/shared.js";
import type { UpdateSmokeCheckResult } from "./update-rollout-report.js";

function runCheck(command: string, cwd: string): UpdateSmokeCheckResult {
  try {
    execSync(command, {
      cwd,
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 120_000,
    });
    return { command, ok: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "command failed";
    return { command, ok: false, detail: message.replace(/\s+/g, " ").trim() };
  }
}

/**
 * Repeatable, non-destructive checks after a successful `trellis update` apply.
 * Verifies generated Trellis Python entrypoints compile and respond to --help.
 */
export function runPostUpdateSmoke(cwd: string): UpdateSmokeCheckResult[] {
  const results: UpdateSmokeCheckResult[] = [];
  const pyScript = path.join(cwd, PATHS.SCRIPTS, "get_context.py");
  const taskScript = path.join(cwd, PATHS.SCRIPTS, "task.py");

  const py = process.platform === "win32" ? "python" : "python3";

  if (fs.existsSync(pyScript)) {
    const cmd = replacePythonCommandLiterals(
      `${py} ./${PATHS.SCRIPTS}/get_context.py --help`,
    );
    results.push(runCheck(cmd, cwd));
  }

  if (fs.existsSync(taskScript)) {
    const cmd = replacePythonCommandLiterals(
      `${py} ./${PATHS.SCRIPTS}/task.py --help`,
    );
    results.push(runCheck(cmd, cwd));
  }

  return results;
}