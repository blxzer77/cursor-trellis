import chalk from "chalk";
import {
  PactileExitManager,
  type RollbackApplyResult,
  type RollbackPlan,
} from "../pactile/exit/service.js";
import {
  homedirBypassEnabled,
  homedirGuardMessage,
  isCwdHomedir,
} from "../utils/cwd-guard.js";

export interface RollbackOptions {
  readonly generation: string;
  readonly dryRun?: boolean;
}

export async function rollback(
  options: RollbackOptions,
): Promise<RollbackPlan | RollbackApplyResult> {
  if (isCwdHomedir() && !homedirBypassEnabled())
    throw new Error(homedirGuardMessage("rollback"));
  const manager = new PactileExitManager(process.cwd());
  const planned = manager.planRollback(options.generation);
  if (planned.status !== "ready")
    throw new Error(`Cannot roll back: ${planned.reason}`);
  if (options.dryRun) {
    console.log(chalk.bold("\nPactile generation rollback preview\n"));
    console.log(`  From: ${planned.fromGenerationId}`);
    console.log(`  To:   ${planned.toGenerationId}`);
    console.log(`  Preview fingerprint: ${planned.planFingerprint}`);
    console.log(chalk.gray("\nDry run — no files or state were modified."));
    return planned;
  }
  const result = await manager.applyRollback(planned);
  if ("reason" in result)
    throw new Error(`Rollback stopped safely: ${result.reason}`);
  const color = result.status === "degraded" ? chalk.yellow : chalk.green;
  console.log(
    color(
      `Active generation is ${result.toGenerationId} (${result.status}).`,
    ),
  );
  console.log(chalk.gray(`Exit receipt: ${result.receipt.fingerprint}`));
  return result;
}
