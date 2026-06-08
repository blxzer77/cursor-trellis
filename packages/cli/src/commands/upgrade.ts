import { spawnSync } from "node:child_process";
import chalk from "chalk";
import { PACKAGE_NAME, VERSION } from "../constants/version.js";

export interface UpgradeOptions {
  tag?: string;
  dryRun?: boolean;
}

interface SpawnResult {
  status: number | null;
  signal: NodeJS.Signals | null;
  error?: Error;
}

interface SpawnOptions {
  stdio: "inherit";
  shell: false;
}

type SpawnRunner = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => SpawnResult;

export interface UpgradeCommandPlan {
  command: string;
  args: string[];
  spawnOptions: SpawnOptions;
  displayCommand: string;
  target: string;
  tag: string;
  binaryCheckCommand: string;
}

const NPM_TAG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function resolveUpgradeTag(
  currentVersion: string = VERSION,
  requestedTag?: string,
): string {
  if (requestedTag) {
    if (!NPM_TAG_RE.test(requestedTag)) {
      throw new Error(
        `Invalid npm tag/version "${requestedTag}". Use a simple dist-tag or version such as latest, beta, rc, or 0.6.0-beta.8.`,
      );
    }
    return requestedTag;
  }

  if (currentVersion.includes("-beta")) return "beta";
  if (currentVersion.includes("-rc")) return "rc";
  return "latest";
}

function binaryCheckCommand(
  platform: NodeJS.Platform = process.platform,
): string {
  return platform === "win32" ? "where trellis" : "which trellis";
}

export function buildUpgradeCommand(
  options: UpgradeOptions = {},
  currentVersion: string = VERSION,
  platform: NodeJS.Platform = process.platform,
): UpgradeCommandPlan {
  const tag = resolveUpgradeTag(currentVersion, options.tag);
  const target = `${PACKAGE_NAME}@${tag}`;
  const npmArgs = ["install", "-g", target];
  const displayCommand = `npm ${npmArgs.join(" ")}`;
  const spawnOptions: SpawnOptions = { stdio: "inherit", shell: false };

  if (platform === "win32") {
    return {
      command: "cmd.exe",
      args: ["/d", "/s", "/c", displayCommand],
      spawnOptions,
      displayCommand,
      target,
      tag,
      binaryCheckCommand: binaryCheckCommand(platform),
    };
  }

  return {
    command: "npm",
    args: npmArgs,
    spawnOptions,
    displayCommand,
    target,
    tag,
    binaryCheckCommand: binaryCheckCommand(platform),
  };
}

function troubleshooting(plan: UpgradeCommandPlan): string {
  return [
    "",
    "Troubleshooting:",
    `- Manual command: ${plan.displayCommand}`,
    "- Check npm global prefix and PATH: npm config get prefix",
    `- Check which Trellis binary your shell resolves: ${plan.binaryCheckCommand}`,
    "- If this is a permissions error, fix your Node/npm install or npm prefix; Trellis does not run sudo.",
    "- If npm reports an existing binary or locked file, resolve that npm error manually; Trellis does not run --force.",
  ].join("\n");
}

export async function upgrade(
  options: UpgradeOptions = {},
  runner: SpawnRunner = spawnSync,
): Promise<void> {
  const plan = buildUpgradeCommand(options);

  console.log(chalk.cyan(`Upgrading Trellis CLI to ${plan.target}`));
  console.log(chalk.gray(`Run: ${plan.displayCommand}`));

  if (options.dryRun) {
    console.log(chalk.gray("Dry run: no changes made."));
    return;
  }

  const result = runner(plan.command, plan.args, plan.spawnOptions);
  if (result.error) {
    throw new Error(
      `Failed to run npm. Install npm or run manually: ${plan.displayCommand}${troubleshooting(plan)}`,
    );
  }
  if (result.signal) {
    throw new Error(
      `npm install was interrupted by ${result.signal}.${troubleshooting(plan)}`,
    );
  }
  if (result.status === null) {
    throw new Error(
      `npm install failed without an exit status.${troubleshooting(plan)}`,
    );
  }
  if (result.status !== 0) {
    throw new Error(
      `npm install failed with exit code ${result.status}.${troubleshooting(plan)}`,
    );
  }

  console.log(chalk.green("\n✓ Trellis CLI upgrade completed"));
  console.log(chalk.gray("Run: trellis --version"));
  console.log(chalk.gray(`Run: ${plan.binaryCheckCommand}`));
}
