import chalk from "chalk";
import {
  PactileExitManager,
  type PurgeApplyResult,
  type PurgePlan,
} from "../pactile/exit/service.js";
import {
  homedirBypassEnabled,
  homedirGuardMessage,
  isCwdHomedir,
} from "../utils/cwd-guard.js";

export interface PurgeOptions {
  readonly dryRun?: boolean;
  readonly yes?: boolean;
  readonly previewFingerprint?: string;
}

/** Purge has no interactive fallback: preview fingerprint + --yes are mandatory. */
export function purge(options: PurgeOptions): PurgePlan | PurgeApplyResult {
  if (isCwdHomedir() && !homedirBypassEnabled())
    throw new Error(homedirGuardMessage("purge"));
  const manager = new PactileExitManager(process.cwd());
  const planned = manager.planPurge();
  if (planned.status !== "ready")
    throw new Error(`Cannot safely purge Pactile state: ${planned.reason}`);

  if (options.dryRun) {
    console.log(chalk.bold("\nPactile purge preview\n"));
    console.log("  Canonical root: .pactile/");
    console.log(`  Exact targets: ${planned.targets.length}`);
    console.log(`  Preview fingerprint: ${planned.manifestFingerprint}`);
    console.log(
      chalk.gray(
        "\nNo files were modified. Re-run with --yes and --preview-fingerprint <value> only if this exact preview is approved.",
      ),
    );
    return planned;
  }
  if (!options.yes || !options.previewFingerprint)
    throw new Error(
      "Purge requires --yes and the exact --preview-fingerprint emitted by a prior --dry-run.",
    );
  const result = manager.applyPurge(planned, options.previewFingerprint);
  if (result.status !== "applied")
    throw new Error(`Purge stopped safely: ${result.reason}`);
  console.log(
    chalk.green(
      `Purged ${result.deletedTargets} verified target(s) from .pactile/.`,
    ),
  );
  console.log(
    chalk.gray(
      `Final purge receipt (returned, not persisted): ${result.receipt.fingerprint}`,
    ),
  );
  return result;
}
