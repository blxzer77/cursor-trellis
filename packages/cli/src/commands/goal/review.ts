import fs from "node:fs";

import { reviewGoalActionPacket } from "../../goal/reviewer.js";

export interface GoalReviewCommandOptions {
  packet?: string;
  json?: boolean;
}

export async function runGoalReviewCommand(
  options: GoalReviewCommandOptions,
): Promise<number> {
  if (!options.packet) {
    console.error("goal review error: --packet <file> is required");
    return 1;
  }

  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(options.packet, "utf8"));
  } catch (error) {
    console.error(
      "goal review error: failed to read packet JSON:",
      error instanceof Error ? error.message : error,
    );
    return 1;
  }

  const result = reviewGoalActionPacket(raw);
  if (!result.valid) {
    const payload = {
      valid: false,
      invalid_reason: result.invalid_reason ?? "invalid",
    };
    console.log(JSON.stringify(payload));
    return 2;
  }

  console.log(JSON.stringify(result.decision));
  return 0;
}
