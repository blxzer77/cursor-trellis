import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";

import {
  loadProjectCapabilities,
  updateCapabilityReadinessStatus,
  type ProjectCapabilityId,
  type ProjectCapabilityReadinessStatus,
} from "../utils/project-capabilities.js";
import {
  getCodegraphIndexMarkers,
  probeProjectCapability,
  type ProjectCapabilityProbe,
} from "../utils/readiness.js";

export interface CapabilitySmokeOptions {
  cwd: string;
  json?: boolean;
  writeStatus?: boolean;
}

interface CapabilitySmokeResult {
  id: ProjectCapabilityId;
  ok: boolean;
  infos: string[];
  warnings: string[];
  failures: string[];
  readiness_status: ProjectCapabilityReadinessStatus;
}

export interface CapabilitySmokeReport {
  ok: boolean;
  cwd: string;
  selected: ProjectCapabilityId[];
  results: CapabilitySmokeResult[];
}

function normalizeProbe(
  cwd: string,
  probe: ProjectCapabilityProbe,
): CapabilitySmokeResult {
  const failures = [...probe.failures];
  const warnings = [...probe.warnings];

  if (probe.id === "codebase-retrieval") {
    const markers = getCodegraphIndexMarkers(cwd);
    if (markers.length === 0) {
      failures.push(
        "No common CodeGraph index marker was found; run `codegraph init` (or equivalent first indexing flow) before marking retrieval ready.",
      );
    } else {
      warnings.push(
        `CodeGraph index marker present (${markers.join(", ")}); live MCP freshness still requires a host-level query smoke or source verification when results look stale.`,
      );
    }
  }

  return {
    id: probe.id,
    ok: failures.length === 0,
    infos: probe.infos,
    warnings,
    failures,
    readiness_status: failures.length === 0 ? "ready" : "failed",
  };
}

function updateStatuses(
  cwd: string,
  results: readonly CapabilitySmokeResult[],
): void {
  for (const result of results) {
    const detail =
      result.failures[0] ??
      result.warnings[0] ??
      result.infos[0] ??
      `capability smoke ${result.ok ? "passed" : "failed"}`;
    updateCapabilityReadinessStatus(
      cwd,
      result.id,
      result.readiness_status,
      detail,
    );
  }
}

function printHumanReport(report: CapabilitySmokeReport): void {
  if (report.selected.length === 0) {
    console.log(chalk.gray("No project capabilities selected."));
    return;
  }

  for (const result of report.results) {
    const summary = result.ok
      ? chalk.green(`✓ ${result.id}: ready`)
      : chalk.red(`✗ ${result.id}: failed`);
    console.log(summary);
    for (const info of result.infos) {
      console.log(chalk.gray(`  info: ${info}`));
    }
    for (const warning of result.warnings) {
      console.log(chalk.yellow(`  warning: ${warning}`));
    }
    for (const failure of result.failures) {
      console.log(chalk.red(`  failure: ${failure}`));
    }
  }
}

export async function runCapabilitySmokeCommand(
  options: CapabilitySmokeOptions,
): Promise<CapabilitySmokeReport> {
  const selected = loadProjectCapabilities(options.cwd);
  const results = selected.map((id) =>
    normalizeProbe(options.cwd, probeProjectCapability(options.cwd, id)),
  );
  const report: CapabilitySmokeReport = {
    ok: results.every((result) => result.ok),
    cwd: options.cwd,
    selected,
    results,
  };

  if (options.writeStatus) {
    updateStatuses(options.cwd, results);
  }

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    printHumanReport(report);
  }

  return report;
}

export function ensureCapabilitiesFileExists(cwd: string): void {
  const capabilitiesPath = path.join(cwd, ".trellis", "capabilities.json");
  if (!fs.existsSync(capabilitiesPath)) {
    throw new Error(
      "No .trellis/capabilities.json found. Run `cstl init` with at least one capability first.",
    );
  }
}
