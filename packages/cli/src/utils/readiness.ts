import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";

import {
  getProjectCapability,
  type ProjectCapabilityId,
} from "./project-capabilities.js";

const SMART_SEARCH_READINESS_COMMAND = "smart-search doctor --format json";
const CODEBASE_REQUIRED_EXACT_COMMAND = "rg";
const CODEGRAPH_INDEX_MARKERS = [
  ".codegraph",
  "codegraph.json",
  ".codegraph/index.json",
];
const CODEBASE_GENERATED_ADAPTER_SERVERS = [
  {
    label: "semantic fast-context adapter",
    serverName: "fast-context",
    missing:
      "Generated semantic MCP server `fast-context` is not launchable; remove the server from generated config or fix `npx fast-context-mcp` availability before claiming semantic recall output. Treat semantic recall as unavailable, not as proof.",
  },
  {
    label: "AST CodeGraph adapter",
    serverName: "codegraph",
    missing:
      "Generated AST MCP server `codegraph` is not launchable; remove the server from generated config or fix `npx @colbymchenry/codegraph serve --mcp` availability before claiming structural graph output. Treat graph evidence as unavailable, not as proof.",
  },
] as const;

interface SmartSearchDoctorResult {
  ok?: unknown;
  minimum_profile_ok?: unknown;
  minimum_profile_missing?: unknown;
  error_type?: unknown;
  error?: unknown;
}

interface ExecSyncFailure {
  stdout?: unknown;
  status?: unknown;
  code?: unknown;
  signal?: unknown;
}

interface ProjectCapabilityProbe {
  id: ProjectCapabilityId;
  infos: string[];
  failures: string[];
  warnings: string[];
}

function childOutputToString(output: unknown): string {
  if (typeof output === "string") return output;
  if (Buffer.isBuffer(output)) return output.toString("utf-8");
  return "";
}

function parseSmartSearchDoctorOutput(
  output: string,
): SmartSearchDoctorResult | undefined {
  if (!output.trim()) return undefined;
  try {
    const parsed = JSON.parse(output) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as SmartSearchDoctorResult;
    }
  } catch {
    // Command success is the primary readiness signal; JSON is parsed only
    // when available so we can reject explicit ok=false diagnostics.
  }
  return undefined;
}

function singleLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function smartSearchDoctorDetails(
  result: SmartSearchDoctorResult | undefined,
): string[] {
  if (!result) return [];

  const details: string[] = [];
  if (typeof result.error_type === "string" && result.error_type.trim()) {
    details.push(`error_type=${singleLine(result.error_type)}`);
  }
  if (Array.isArray(result.minimum_profile_missing)) {
    const missing = result.minimum_profile_missing
      .filter((item): item is string => typeof item === "string")
      .map(singleLine)
      .filter(Boolean);
    if (missing.length > 0) {
      details.push(`missing=${missing.join(", ")}`);
    }
  }
  if (typeof result.error === "string" && result.error.trim()) {
    details.push(`error=${singleLine(result.error)}`);
  }
  return details;
}

function smartSearchReadinessError(
  details: string[],
  skipReadinessCommand: string,
): Error {
  const detailLine =
    details.length > 0
      ? `Details: ${details.join("; ")}`
      : "Details: smart-search doctor did not complete successfully.";
  const lines = [
    "Smart Search readiness failed.",
    detailLine,
    "Recovery:",
    `  ${SMART_SEARCH_READINESS_COMMAND}`,
    "  smart-search setup",
    `  ${skipReadinessCommand}`,
  ];
  return new Error(lines.join("\n"));
}

function quoteForLookup(value: string): string {
  if (process.platform === "win32") {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function commandLookupCommand(command: string): string {
  if (process.platform === "win32") {
    return `where ${quoteForLookup(command)}`;
  }
  return `command -v ${quoteForLookup(command)}`;
}

function commandIsAvailable(command: string): boolean {
  try {
    execSync(commandLookupCommand(command), {
      encoding: "utf-8",
      stdio: "pipe",
    });
    return true;
  } catch {
    return false;
  }
}

function shellQuote(value: string): string {
  if (process.platform === "win32") {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function npxPackageName(args: readonly string[]): string | undefined {
  return args.find((arg) => arg.trim() && !arg.startsWith("-"));
}

function safeVisibilitySmokeCommand(
  id: ProjectCapabilityId,
  command: string,
  args: readonly string[] = [],
): string | undefined {
  if (command === "npx") {
    const packageName = npxPackageName(args);
    return packageName
      ? `npm view ${shellQuote(packageName)} bin --json`
      : undefined;
  }

  if (id === "playwright-mcp") return undefined;

  return `${shellQuote(command)} --help`;
}

function runSafeVisibilitySmoke(
  id: ProjectCapabilityId,
  command: string,
  args: readonly string[] = [],
): { info?: string; warning?: string; failure?: string } {
  const smokeCommand = safeVisibilitySmokeCommand(id, command, args);
  if (!smokeCommand) {
    return {
      warning:
        "No safe non-starting host-level MCP visibility smoke is available from ordinary init/update; run an explicit host MCP smoke before claiming this capability.",
    };
  }

  try {
    execSync(smokeCommand, {
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 5_000,
    });
    return {
      info: `host-level command/package visibility smoke passed with \`${smokeCommand}\``,
    };
  } catch {
    return {
      failure: `Host-level command/package visibility smoke failed for \`${smokeCommand}\`; generated MCP server startup is not verified.`,
    };
  }
}

function existingRelativePaths(cwd: string, relativePaths: string[]): string[] {
  return relativePaths.filter((relativePath) =>
    fs.existsSync(path.join(cwd, ...relativePath.split("/"))),
  );
}

function hasGithubApiCredentialEnv(): boolean {
  return Boolean(
    process.env.GITHUB_TOKEN ?? process.env.GITHUB_PERSONAL_ACCESS_TOKEN,
  );
}

function hasLegacyGithubCredentialEnv(): boolean {
  return Boolean(process.env.GH_TOKEN);
}

function probeProjectCapability(
  cwd: string,
  id: ProjectCapabilityId,
): ProjectCapabilityProbe {
  if (id === "codebase-retrieval") {
    return probeCodebaseRetrievalCapability(cwd);
  }

  const capability = getProjectCapability(id);
  const [server] = capability.mcpServers;
  if (!server) {
    return {
      id,
      infos: [],
      failures: ["capability has no MCP server template to probe"],
      warnings: [],
    };
  }

  const command = server.command;
  const commandAvailable = commandIsAvailable(command);
  const infos: string[] = [];
  const failures: string[] = [];
  const warnings: string[] = [];

  if (!commandAvailable) {
    failures.push(`command \`${command}\` is not available on PATH`);
  }

  if (commandAvailable) {
    const smoke = runSafeVisibilitySmoke(id, command, server.args);
    if (smoke.info) {
      infos.push(smoke.info);
    }
    if (smoke.warning) {
      warnings.push(smoke.warning);
    }
    if (smoke.failure) {
      failures.push(smoke.failure);
    }
  }

  if (id === "github-mcp" && commandAvailable && !hasGithubApiCredentialEnv()) {
    failures.push(
      "`GITHUB_TOKEN` or `GITHUB_PERSONAL_ACCESS_TOKEN` is not visible to Trellis readiness checks",
    );
  }

  if (
    id === "github-mcp" &&
    commandAvailable &&
    !hasGithubApiCredentialEnv() &&
    hasLegacyGithubCredentialEnv()
  ) {
    warnings.push(
      "`GH_TOKEN` is present, but Trellis GitHub MCP readiness expects `GITHUB_TOKEN` or `GITHUB_PERSONAL_ACCESS_TOKEN`; mirror the token into one of those variables before claiming GitHub MCP readiness.",
    );
  }

  if (id === "playwright-mcp" && commandAvailable) {
    warnings.push(
      "Playwright MCP package and browser runtime were not started by readiness; run a host MCP smoke before claiming rendered UI evidence.",
    );
  }

  return { id, infos, failures, warnings };
}

function probeCodebaseRetrievalCapability(cwd: string): ProjectCapabilityProbe {
  const id: ProjectCapabilityId = "codebase-retrieval";
  const infos: string[] = [];
  const failures: string[] = [];
  const warnings: string[] = [];

  if (!commandIsAvailable(CODEBASE_REQUIRED_EXACT_COMMAND)) {
    failures.push(
      `required exact search command \`${CODEBASE_REQUIRED_EXACT_COMMAND}\` is not available on PATH`,
    );
  } else {
    const smoke = runSafeVisibilitySmoke(id, CODEBASE_REQUIRED_EXACT_COMMAND);
    if (smoke.info) {
      infos.push(smoke.info);
    }
    if (smoke.warning) {
      warnings.push(smoke.warning);
    }
  }

  const capability = getProjectCapability(id);
  const serversByName = new Map(
    capability.mcpServers.map((server) => [server.name, server]),
  );

  for (const adapter of CODEBASE_GENERATED_ADAPTER_SERVERS) {
    const server = serversByName.get(adapter.serverName);
    if (!server) {
      warnings.push(adapter.missing);
      continue;
    }

    const commandAvailable = commandIsAvailable(server.command);
    if (!commandAvailable) {
      failures.push(
        `${adapter.missing} Missing command: \`${server.command}\`.`,
      );
      continue;
    }

    const smoke = runSafeVisibilitySmoke(id, server.command, server.args);
    if (smoke.info) {
      infos.push(`${adapter.label}: ${smoke.info}`);
    }
    if (smoke.warning) {
      warnings.push(`${adapter.label}: ${smoke.warning}`);
    }
    if (smoke.failure) {
      failures.push(`${adapter.label}: ${smoke.failure}`);
    }

    if (adapter.serverName === "fast-context") {
      warnings.push(
        "fast-context host MCP visibility and a project-scoped smoke search still require host-level confirmation; semantic recall remains candidate evidence until exact source/Git/test verification.",
      );
    }

    if (adapter.serverName === "codegraph") {
      const markers = existingRelativePaths(cwd, CODEGRAPH_INDEX_MARKERS);
      if (markers.length === 0) {
        warnings.push(
          "No common CodeGraph index marker was found; initialize or refresh the index after explicit approval, or fall back to source reads before graph-derived impact claims. Structural graph output remains unverified.",
        );
      } else {
        warnings.push(
          `CodeGraph index marker found (${markers.join(", ")}), but Trellis has not verified index freshness; run a host-level status/query smoke or confirm with Git/source evidence before graph-derived impact claims. Structural graph output remains unverified until then.`,
        );
      }
    }
  }

  warnings.push(
    "LSP adapter readiness is host-specific; Trellis does not start language servers during ordinary init/update, and navigation output remains candidate evidence until confirmed by source reads.",
  );

  return { id, infos, failures, warnings };
}

function projectCapabilityReadinessError(
  probes: ProjectCapabilityProbe[],
  skipReadinessCommand: string,
): Error {
  const failed = probes.filter((probe) => probe.failures.length > 0);
  const lines = [
    "Selected project capability readiness failed.",
    "Failed capabilities:",
  ];

  for (const probe of failed) {
    lines.push(`- ${probe.id}: ${probe.failures.join("; ")}`);
  }

  lines.push("", "Fallback:");
  for (const probe of failed) {
    const capability = getProjectCapability(probe.id);
    for (const fallback of capability.fallback) {
      lines.push(`  - ${probe.id}: ${fallback}`);
    }
  }

  lines.push(
    "",
    "Recovery:",
    "  Fix the selected capability setup, remove the capability selection, or use the explicit repair/debug bypass.",
    `  ${skipReadinessCommand}`,
    "  Skipped capability readiness is not ready and must not be claimed as used.",
  );

  return new Error(lines.join("\n"));
}

export function checkSmartSearchReadiness(options: {
  skipReadiness?: boolean;
  skipReadinessCommand: string;
}): void {
  if (options.skipReadiness) {
    console.warn(
      chalk.yellow(
        "⚠ Smart Search readiness skipped (--skip-readiness); framework readiness is not verified.",
      ),
    );
    return;
  }

  console.log(chalk.blue("🔎 Checking Smart Search readiness..."));

  try {
    const output = execSync(SMART_SEARCH_READINESS_COMMAND, {
      encoding: "utf-8",
      stdio: "pipe",
    });
    const doctor = parseSmartSearchDoctorOutput(output);
    if (doctor?.ok === false || doctor?.minimum_profile_ok === false) {
      throw smartSearchReadinessError(
        smartSearchDoctorDetails(doctor),
        options.skipReadinessCommand,
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Smart Search")) {
      throw error;
    }

    const failure = error as ExecSyncFailure;
    const stdout = childOutputToString(failure.stdout);
    const doctor = parseSmartSearchDoctorOutput(stdout);
    const details = smartSearchDoctorDetails(doctor);

    if (details.length === 0) {
      if (typeof failure.status === "number") {
        details.push(`exit_status=${failure.status}`);
      } else if (typeof failure.code === "string") {
        details.push(`code=${failure.code}`);
      } else if (typeof failure.signal === "string") {
        details.push(`signal=${failure.signal}`);
      } else if (error instanceof Error && error.message.trim()) {
        details.push(singleLine(error.message));
      }
    }

    throw smartSearchReadinessError(details, options.skipReadinessCommand);
  }

  console.log(chalk.green("✓ Smart Search readiness verified"));
}

export function checkProjectCapabilityReadiness(options: {
  cwd: string;
  selected: readonly ProjectCapabilityId[];
  skipReadiness?: boolean;
  skipReadinessCommand: string;
}): void {
  if (options.selected.length === 0) {
    return;
  }

  if (options.skipReadiness) {
    console.warn(
      chalk.yellow(
        "⚠ Selected project capability readiness skipped (--skip-readiness); selected capabilities are not verified.",
      ),
    );
    return;
  }

  console.log(chalk.blue("🔌 Checking selected project capabilities..."));
  const probes = options.selected.map((id) =>
    probeProjectCapability(options.cwd, id),
  );

  for (const probe of probes) {
    if (probe.failures.length === 0) {
      console.log(
        chalk.green(`✓ ${probe.id} capability readiness baseline checked`),
      );
    }
    for (const info of probe.infos) {
      console.log(chalk.gray(`  ${probe.id}: ${info}`));
    }
    for (const warning of probe.warnings) {
      console.warn(chalk.yellow(`⚠ ${probe.id}: ${warning}`));
    }
  }

  if (probes.some((probe) => probe.failures.length > 0)) {
    throw projectCapabilityReadinessError(probes, options.skipReadinessCommand);
  }
}
