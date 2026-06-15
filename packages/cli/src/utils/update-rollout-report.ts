import type { ClassifiedMigrations, MigrationResult } from "../types/migration.js";
import { VERSION, PACKAGE_NAME } from "../constants/version.js";

export const UPDATE_ROLLOUT_REPORT_SCHEMA_VERSION = 1 as const;

export type UpdateRolloutMode = "dry-run" | "apply";

export type UpdateRolloutOutcome =
  | "no_changes"
  | "would_apply"
  | "applied"
  | "cancelled"
  | "blocked_downgrade"
  | "blocked_migration_required"
  | "blocked_not_initialized"
  | "error";

export interface UpdateFileActions {
  added: string[];
  autoUpdated: string[];
  overwritten: string[];
  skipped: string[];
  createdNew: string[];
  unchanged: string[];
  userDeleted: string[];
  safeDeleted: string[];
}

export interface UpdateMigrationPlanSummary {
  pendingCount: number;
  auto: number;
  confirm: number;
  conflict: number;
  safeDeleteCandidates: number;
}

export interface UpdateMigrationApplySummary {
  renamed: number;
  deleted: number;
  skipped: number;
  conflicts: number;
}

export interface UpdateReadinessProbeSnapshot {
  id: string;
  ok: boolean;
  failures: string[];
  warnings: string[];
  smokeCommands: string[];
}

export interface UpdateReadinessSnapshot {
  skipped: boolean;
  smartSearch: {
    command: string;
    ok: boolean;
    details: string[];
  };
  capabilities: UpdateReadinessProbeSnapshot[];
}

export interface UpdateSmokeCheckResult {
  command: string;
  ok: boolean;
  detail?: string;
}

export interface UpdateReleaseBlocker {
  code: string;
  message: string;
  recovery?: string[];
}

export interface UpdateRolloutReport {
  schemaVersion: typeof UPDATE_ROLLOUT_REPORT_SCHEMA_VERSION;
  generatedAt: string;
  mode: UpdateRolloutMode;
  outcome: UpdateRolloutOutcome;
  projectPath: string;
  trellis: {
    cliVersion: string;
    packageName: string;
    projectVersionBefore: string;
    projectVersionAfter: string | null;
    latestNpmVersion: string | null;
    cliBehindNpm: boolean;
  };
  options: {
    dryRun: boolean;
    force: boolean;
    skipAll: boolean;
    createNew: boolean;
    migrate: boolean;
    allowDowngrade: boolean;
    skipReadiness: boolean;
  };
  plan: {
    upgradeDirection: "upgrade" | "downgrade" | "same" | "unknown";
    breakingMigrationGateRequired: boolean;
    files: UpdateFileActions;
    conflictsPending: string[];
    migrations: UpdateMigrationPlanSummary;
    backupPath: string | null;
  };
  apply?: {
    backupPath: string | null;
    migrations: UpdateMigrationApplySummary | null;
    safeDeleted: number;
    configSectionsAppended: number;
  };
  readiness: UpdateReadinessSnapshot;
  postUpdateSmoke: UpdateSmokeCheckResult[];
  releaseBlockers: UpdateReleaseBlocker[];
}

export interface BuildFilePlanInput {
  newFiles: { relativePath: string }[];
  unchangedFiles: { relativePath: string }[];
  autoUpdateFiles: { relativePath: string }[];
  changedFiles: { relativePath: string }[];
  userDeletedFiles: { relativePath: string }[];
  safeDeletePaths?: string[];
}

export function buildFilePlanFromChanges(input: BuildFilePlanInput): UpdateFileActions {
  return {
    added: input.newFiles.map((f) => f.relativePath),
    autoUpdated: input.autoUpdateFiles.map((f) => f.relativePath),
    overwritten: [],
    skipped: [],
    createdNew: [],
    unchanged: input.unchangedFiles.map((f) => f.relativePath),
    userDeleted: input.userDeletedFiles.map((f) => f.relativePath),
    safeDeleted: input.safeDeletePaths ?? [],
  };
}

export function summarizeMigrationPlan(
  classified: ClassifiedMigrations | null,
  safeDeleteCandidateCount: number,
): UpdateMigrationPlanSummary {
  if (!classified) {
    return {
      pendingCount: 0,
      auto: 0,
      confirm: 0,
      conflict: 0,
      safeDeleteCandidates: safeDeleteCandidateCount,
    };
  }
  return {
    pendingCount:
      classified.auto.length +
      classified.confirm.length +
      classified.conflict.length,
    auto: classified.auto.length,
    confirm: classified.confirm.length,
    conflict: classified.conflict.length,
    safeDeleteCandidates: safeDeleteCandidateCount,
  };
}

export function migrationResultToSummary(
  result: MigrationResult | null,
): UpdateMigrationApplySummary | null {
  if (!result) return null;
  return {
    renamed: result.renamed,
    deleted: result.deleted,
    skipped: result.skipped,
    conflicts: result.conflicts,
  };
}

export function createBaseRolloutReport(input: {
  mode: UpdateRolloutMode;
  outcome: UpdateRolloutOutcome;
  projectPath: string;
  projectVersionBefore: string;
  projectVersionAfter?: string | null;
  latestNpmVersion: string | null;
  cliBehindNpm: boolean;
  options: UpdateRolloutReport["options"];
  readiness: UpdateReadinessSnapshot;
  upgradeDirection: UpdateRolloutReport["plan"]["upgradeDirection"];
  files: UpdateFileActions;
  conflictsPending: string[];
  migrations: UpdateMigrationPlanSummary;
  backupPath?: string | null;
  breakingMigrationGateRequired?: boolean;
  apply?: UpdateRolloutReport["apply"];
  postUpdateSmoke?: UpdateSmokeCheckResult[];
  releaseBlockers?: UpdateReleaseBlocker[];
}): UpdateRolloutReport {
  return {
    schemaVersion: UPDATE_ROLLOUT_REPORT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    mode: input.mode,
    outcome: input.outcome,
    projectPath: input.projectPath,
    trellis: {
      cliVersion: VERSION,
      packageName: PACKAGE_NAME,
      projectVersionBefore: input.projectVersionBefore,
      projectVersionAfter: input.projectVersionAfter ?? null,
      latestNpmVersion: input.latestNpmVersion,
      cliBehindNpm: input.cliBehindNpm,
    },
    options: input.options,
    plan: {
      upgradeDirection: input.upgradeDirection,
      breakingMigrationGateRequired: input.breakingMigrationGateRequired ?? false,
      files: input.files,
      conflictsPending: input.conflictsPending,
      migrations: input.migrations,
      backupPath: input.backupPath ?? null,
    },
    apply: input.apply,
    readiness: input.readiness,
    postUpdateSmoke: input.postUpdateSmoke ?? [],
    releaseBlockers: input.releaseBlockers ?? [],
  };
}

export function emitRolloutReport(
  report: UpdateRolloutReport,
  json: boolean | undefined,
): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(report)}\n`);
    return;
  }
  const relBackup = report.plan.backupPath ?? report.apply?.backupPath;
  console.log("");
  console.log("--- Rollout evidence (machine-readable) ---");
  console.log(`  outcome: ${report.outcome}`);
  console.log(`  mode: ${report.mode}`);
  console.log(
    `  versions: ${report.trellis.projectVersionBefore} → ${report.trellis.projectVersionAfter ?? "(unchanged)"} (cli ${report.trellis.cliVersion})`,
  );
  if (relBackup) {
    console.log(`  backup: ${relBackup}`);
  }
  const f = report.plan.files;
  const pending =
    f.added.length +
    f.autoUpdated.length +
    report.plan.conflictsPending.length +
    f.safeDeleted.length;
  if (pending > 0 || report.mode === "dry-run") {
    console.log(
      `  files: +${f.added.length} auto↑${f.autoUpdated.length} conflicts=${report.plan.conflictsPending.length} skip=${f.skipped.length} overwrite=${f.overwritten.length}`,
    );
  }
  if (report.postUpdateSmoke.length > 0) {
    const failed = report.postUpdateSmoke.filter((s) => !s.ok);
    console.log(
      `  post-update smoke: ${report.postUpdateSmoke.length - failed.length}/${report.postUpdateSmoke.length} passed`,
    );
  }
  if (report.releaseBlockers.length > 0) {
    for (const b of report.releaseBlockers) {
      console.log(`  release blocker: ${b.code} — ${b.message}`);
    }
  }
  console.log("  Tip: re-run with --json for full structured evidence.");
}