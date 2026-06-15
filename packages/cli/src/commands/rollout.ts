import fs from "node:fs";
import path from "node:path";

import chalk from "chalk";

import { VERSION } from "../constants/version.js";
import { update, type UpdateOptions } from "./update.js";
import {
  UPDATE_ROLLOUT_REPORT_SCHEMA_VERSION,
  type UpdateRolloutReport,
} from "../utils/update-rollout-report.js";

export interface RolloutOptions {
  projects: string[];
  dryRun?: boolean;
  force?: boolean;
  skipAll?: boolean;
  createNew?: boolean;
  migrate?: boolean;
  allowDowngrade?: boolean;
  skipReadiness?: boolean;
  skipPostUpdateSmoke?: boolean;
  json?: boolean;
  /** When set, write the aggregated JSON document to this path. */
  output?: string;
}

export interface MultiProjectRolloutReport {
  schemaVersion: typeof UPDATE_ROLLOUT_REPORT_SCHEMA_VERSION;
  generatedAt: string;
  trellisCliVersion: string;
  mode: "dry-run" | "apply";
  projects: UpdateRolloutReport[];
  summary: {
    total: number;
    applied: number;
    wouldApply: number;
    noChanges: number;
    cancelled: number;
    blocked: number;
    errors: number;
    postUpdateSmokeFailed: number;
  };
}

function countOutcome(
  reports: UpdateRolloutReport[],
  outcome: UpdateRolloutReport["outcome"],
): number {
  return reports.filter((r) => r.outcome === outcome).length;
}

function blockedCount(reports: UpdateRolloutReport[]): number {
  return reports.filter((r) =>
    [
      "blocked_downgrade",
      "blocked_migration_required",
      "blocked_not_initialized",
    ].includes(r.outcome),
  ).length;
}

function smokeFailedCount(reports: UpdateRolloutReport[]): number {
  return reports.filter((r) =>
    r.postUpdateSmoke.some((s) => !s.ok),
  ).length;
}

export async function rollout(options: RolloutOptions): Promise<void> {
  if (options.projects.length === 0) {
    throw new Error(
      "No project paths provided. Use --project <path> (repeatable).",
    );
  }

  const mode = options.dryRun ? "dry-run" : "apply";
  const projectReports: UpdateRolloutReport[] = [];

  console.log(chalk.cyan("\nTrellis multi-project rollout"));
  console.log(chalk.cyan("════════════════════════════\n"));
  console.log(`Mode: ${mode}`);
  console.log(`Projects: ${options.projects.length}\n`);

  const originalCwd = process.cwd();

  for (const projectPath of options.projects) {
    const resolved = path.resolve(projectPath);
    console.log(chalk.blue(`\n▶ ${resolved}`));

    if (!fs.existsSync(resolved)) {
      console.log(chalk.red("  Skipped: path does not exist"));
      continue;
    }

    const updateOpts: UpdateOptions = {
      dryRun: options.dryRun,
      force: options.force,
      skipAll: options.skipAll,
      createNew: options.createNew,
      migrate: options.migrate,
      allowDowngrade: options.allowDowngrade,
      skipReadiness: options.skipReadiness,
      skipPostUpdateSmoke: options.skipPostUpdateSmoke,
      json: false,
    };

    process.chdir(resolved);
    try {
      await update(updateOpts);
      if (updateOpts.lastReport) {
        projectReports.push(updateOpts.lastReport);
      }
    } catch (error) {
      console.log(
        chalk.red(
          `  Error: ${error instanceof Error ? error.message : String(error)}`,
        ),
      );
    } finally {
      process.chdir(originalCwd);
    }
  }

  const aggregate: MultiProjectRolloutReport = {
    schemaVersion: UPDATE_ROLLOUT_REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    trellisCliVersion: VERSION,
    mode,
    projects: projectReports,
    summary: {
      total: options.projects.length,
      applied: countOutcome(projectReports, "applied"),
      wouldApply: countOutcome(projectReports, "would_apply"),
      noChanges: countOutcome(projectReports, "no_changes"),
      cancelled: countOutcome(projectReports, "cancelled"),
      blocked: blockedCount(projectReports),
      errors: Math.max(0, options.projects.length - projectReports.length),
      postUpdateSmokeFailed: smokeFailedCount(projectReports),
    },
  };

  if (options.json) {
    const line = JSON.stringify(aggregate);
    if (options.output) {
      fs.writeFileSync(options.output, `${line}\n`, "utf-8");
      console.log(chalk.gray(`\nWrote rollout evidence: ${options.output}`));
    } else {
      process.stdout.write(`${line}\n`);
    }
    return;
  }

  console.log(chalk.cyan("\n--- Rollout summary ---"));
  console.log(`  recorded: ${projectReports.length}/${options.projects.length}`);
  console.log(`  applied: ${aggregate.summary.applied}`);
  console.log(`  dry-run (would_apply): ${aggregate.summary.wouldApply}`);
  console.log(`  no_changes: ${aggregate.summary.noChanges}`);
  console.log(`  blocked: ${aggregate.summary.blocked}`);
  if (aggregate.summary.postUpdateSmokeFailed > 0) {
    console.log(
      chalk.yellow(
        `  post-update smoke failures: ${aggregate.summary.postUpdateSmokeFailed}`,
      ),
    );
  }
  console.log(chalk.gray("  Tip: add --json for machine-readable multi-project evidence."));
}