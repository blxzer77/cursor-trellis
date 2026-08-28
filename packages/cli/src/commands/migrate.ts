import chalk from "chalk";

import { planArtifactMigration } from "@blxzer/cursor-trellis-core/task";
import { loadHashes } from "../utils/template-hash.js";
import { isWorkflowInitialized } from "../utils/workflow-dir.js";
import {
  composeP36Plan,
  planOfficialSurfaceA,
  printP36Vernacular,
} from "../utils/p36-upgrade.js";

export interface MigrateCommandOptions {
  dryRun?: boolean;
  writeArtifacts?: boolean;
}

/**
 * Optional deepening preview for P36. Writes nothing. Apply stays on
 * `cstl update` + one confirm.
 */
export function migratePreview(options: MigrateCommandOptions = {}): void {
  const cwd = process.cwd();
  if (!isWorkflowInitialized(cwd)) {
    console.log(chalk.red("Error: Trellis not initialized in this directory."));
    console.log(chalk.gray("Run 'cstl init' first, or apply with 'cstl update'."));
    return;
  }

  const writeArtifacts = Boolean(options.writeArtifacts);
  const official = planOfficialSurfaceA({
    cwd,
    hashes: loadHashes(cwd),
    refresh: [],
    preserved: [],
  });
  const artifacts = planArtifactMigration({ root: cwd });
  const plan = composeP36Plan({ official, artifacts, writeArtifacts });

  console.log(chalk.cyan("\nP36 migrate preview"));
  console.log(chalk.cyan("═══════════════════\n"));
  printP36Vernacular(plan);
  console.log(chalk.gray("[Dry run] No changes made. Apply with: cstl update"));
  if (writeArtifacts) {
    console.log(
      chalk.gray("Maintainer apply: cstl update --write-artifacts"),
    );
  }
}
