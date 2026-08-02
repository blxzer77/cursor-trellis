import type { Command } from "commander";

import { resolveRpcToken, resolveRpcUrl } from "../rpc/client.js";
import { runSdkRunCommand, type SdkRunMode } from "./run.js";

/**
 * Register `cstl sdk` — Trellis↔Cursor SDK RUN path (CAP: safe-task/SDK only).
 * Non-goals: fake IDE chat tab, Parent integrate, MIX UI, broker rewrite.
 */
export function registerSdkCommand(program: Command): void {
  const sdk = program
    .command("sdk")
    .description(
      "Cursor SDK RUN bridge for Trellis (explicit --task; mock/live; RPC kind=sdk). Non-goals: IDE chat tab, Parent integrate, MIX UI.",
    );

  sdk
    .command("run")
    .description(
      "Bind an explicit task path, run mock or live Agent.prompt, write dogfood evidence, emit campaign RPC events",
    )
    .requiredOption(
      "--task <path>",
      "Explicit Trellis task directory (must contain prd.md). Required — SDK has no selected_task.",
    )
    .option(
      "--campaign <id>",
      "Campaign id for RPC topic (no colon)",
      "08-01-trellis-intent-multisession",
    )
    .option("--prompt <text>", "Prompt body for the SDK / mock agent")
    .option("--cwd <dir>", "Working directory for live local Agent (default: process.cwd())")
    .option("--live", "Call @cursor/sdk Agent.prompt (requires consent + CURSOR_API_KEY)")
    .option("--mock", "Force mock adapter (default when --live is absent)")
    .option("--rpc-url <url>", "RPC CORE URL (default TRELLIS_RPC_URL or http://127.0.0.1:7843)")
    .option("--token <token>", "RPC token (or TRELLIS_RPC_TOKEN)")
    .option("--no-rpc", "Skip RPC register/publish (still writes dogfood)")
    .action(
      async (opts: {
        task: string;
        campaign?: string;
        prompt?: string;
        cwd?: string;
        live?: boolean;
        mock?: boolean;
        rpcUrl?: string;
        token?: string;
        rpc?: boolean;
      }) => {
        if (opts.live && opts.mock) {
          console.error("SDK RUN error: use only one of --live or --mock");
          process.exitCode = 1;
          return;
        }
        const mode: SdkRunMode = opts.live ? "live" : "mock";
        const code = await runSdkRunCommand({
          task: opts.task,
          campaign: opts.campaign ?? "08-01-trellis-intent-multisession",
          mode,
          prompt: opts.prompt,
          cwd: opts.cwd,
          rpcUrl: opts.rpcUrl ? resolveRpcUrl(opts.rpcUrl) : undefined,
          token: resolveRpcToken(opts.token),
          noRpc: opts.rpc === false,
        });
        process.exitCode = code;
      },
    );
}

export { runSdkRun, runSdkRunCommand, type SdkRunOptions, type SdkRunResult } from "./run.js";
