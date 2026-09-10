import chalk from "chalk";
import inquirer from "inquirer";
import { PactileExitManager } from "../pactile/exit/service.js";
import { InstallStateStore } from "../pactile/runtime/stores.js";
import {
  homedirBypassEnabled,
  homedirGuardMessage,
  isCwdHomedir,
} from "../utils/cwd-guard.js";

export interface UninstallOptions {
  yes?: boolean;
  dryRun?: boolean;
}

export interface UninstallDryRun {
  readonly status: "dry-run";
  readonly adapterIds: readonly string[];
  readonly previews: readonly {
    adapterId: string;
    previewFingerprint: string;
    decisions: readonly { disposition: string }[];
  }[];
}

async function confirmUninstall(): Promise<boolean> {
  if (!process.stdin.isTTY)
    throw new Error(
      "Refusing to prompt in a non-interactive shell. Pass --yes/-y or use --dry-run.",
    );
  const answer = await inquirer.prompt<{ proceed: boolean }>([
    {
      type: "confirm",
      name: "proceed",
      message:
        "Detach Pactile from every installed host? Canonical project state will be preserved.",
      default: false,
    },
  ]);
  return answer.proceed;
}

/**
 * Default uninstall is deliberately non-destructive: it releases Adapter
 * claims and marks the install inactive while retaining all `.pactile` state.
 * Destructive canonical cleanup is available only through `pactile purge`.
 */
export async function uninstall(
  options: UninstallOptions = {},
): Promise<ReturnType<PactileExitManager["uninstall"]> | UninstallDryRun | null> {
  if (isCwdHomedir() && !homedirBypassEnabled())
    throw new Error(homedirGuardMessage("uninstall"));

  const projectRoot = process.cwd();
  const installed = new InstallStateStore(projectRoot).read();
  if (!installed) {
    console.log(chalk.gray("Pactile is not installed in this project."));
    return null;
  }
  const adapterIds = installed.state.installedAdapters
    .filter((adapter) => adapter.status !== "detached")
    .map((adapter) => adapter.id)
    .sort();
  const manager = new PactileExitManager(projectRoot);

  if (options.dryRun) {
    const previews: UninstallDryRun["previews"][number][] = [];
    for (const adapterId of adapterIds) {
      const planned = manager.planDetach(adapterId);
      if (planned.status !== "ready")
        throw new Error(`Cannot safely detach ${adapterId}: ${planned.reason}`);
      previews.push({
        adapterId,
        previewFingerprint: planned.previewFingerprint,
        decisions: planned.preview.decisions,
      });
    }
    console.log(chalk.bold("\nPactile uninstall preview\n"));
    console.log(
      `  Adapters: ${adapterIds.length > 0 ? adapterIds.join(", ") : "none"}`,
    );
    console.log("  Canonical state: preserve .pactile/ in full");
    console.log(chalk.gray("\nDry run — no files or state were modified."));
    return { status: "dry-run", adapterIds, previews };
  }

  if (!options.yes && !(await confirmUninstall())) {
    console.log(chalk.yellow("Uninstall cancelled. No files were modified."));
    return null;
  }
  const result = manager.uninstall();
  if (result.status === "degraded")
    throw new Error(
      `Pactile uninstall stopped safely: ${result.reason}. Canonical state was preserved.`,
    );
  console.log(
    chalk.green(
      `Pactile is inactive; ${result.adapterIds.length} Adapter(s) detached.`,
    ),
  );
  console.log(chalk.gray("Canonical .pactile/ state was preserved."));
  console.log(chalk.gray(`Exit receipt: ${result.receipt.fingerprint}`));
  return result;
}
