import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { campaignBroadcastTopic } from "@blxzer/cursor-trellis-core/rpc";

import {
  resolveRpcToken,
  resolveRpcUrl,
  rpcPublish,
  rpcRegister,
} from "../rpc/client.js";

export type SdkRunMode = "mock" | "live";

export interface SdkRunOptions {
  task: string;
  campaign: string;
  mode: SdkRunMode;
  prompt?: string;
  cwd?: string;
  rpcUrl?: string;
  token?: string;
  noRpc?: boolean;
  /** When set, write dogfood under this absolute path instead of <task>/research/ */
  evidencePath?: string;
}

export interface SdkRunResult {
  ok: boolean;
  runId: string;
  mode: SdkRunMode;
  taskPath: string;
  evidencePath: string;
  rpc: {
    attempted: boolean;
    ok: boolean;
    url?: string;
    detail: string;
  };
  agent: {
    status: string;
    result: string;
  };
  errors: string[];
}

const DEFAULT_PROMPT =
  "Trellis SDK RUN (S1 worker): confirm task path binding by restating the absolute taskPath; do not call integrate-child or start-execution --approved; summarize readiness in one short paragraph.";

function resolveTaskPath(taskArg: string): string {
  return path.resolve(process.cwd(), taskArg);
}

function assertTaskDir(taskPath: string): void {
  if (!fs.existsSync(taskPath) || !fs.statSync(taskPath).isDirectory()) {
    throw new Error(`Task path is not a directory: ${taskPath}`);
  }
  const prd = path.join(taskPath, "prd.md");
  if (!fs.existsSync(prd)) {
    throw new Error(
      `Task path missing prd.md (refusing unbound SDK RUN; pass --task <dir> that contains prd.md): ${prd}`,
    );
  }
}

/**
 * Build the Agent prompt for SDK RUN. Always prepends an explicit --task binding
 * block so SessionStart "Selected task: none" cannot be misread as unbound.
 */
export function buildSdkRunPrompt(
  taskPath: string,
  userPrompt?: string,
): string {
  const absoluteTask = path.resolve(taskPath);
  const prdPath = path.join(absoluteTask, "prd.md");
  const instruction = userPrompt?.trim() || DEFAULT_PROMPT;
  return [
    "## SDK RUN task binding (authoritative)",
    `- Bound via CLI \`--task\` (not \`selected_task\` / SessionStart).`,
    `- taskPath (absolute): \`${absoluteTask}\``,
    `- prd.md (absolute): \`${prdPath}\``,
    `- Binding status: **BOUND**.`,
    `- Do **not** report unbound solely because SessionStart says \`Selected task: none\` — that pointer is irrelevant for SDK RUN.`,
    "",
    "## Instructions",
    instruction,
  ].join("\n");
}

async function runMockAgent(prompt: string): Promise<{
  status: string;
  result: string;
}> {
  return {
    status: "completed",
    result: `[mock] SDK RUN accepted prompt (${prompt.length} chars). No @cursor/sdk call. CAP: safe-task/SDK only; no Parent integrate.`,
  };
}

async function runLiveAgent(
  prompt: string,
  cwd: string,
): Promise<{ status: string; result: string }> {
  const apiKey = process.env.CURSOR_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      [
        "Live SDK RUN requires CURSOR_API_KEY (and prior user consent to use it).",
        "Use --mock or omit --live.",
        "Discovery: run `cstl sdk status` for setup steps (never commit the key).",
      ].join(" "),
    );
  }

  interface CursorAgent {
    prompt: (
      p: string,
      opts: {
        apiKey: string;
        model: { id: string };
        local: { cwd: string };
      },
    ) => Promise<{ status?: string; result?: string }>;
  }
  let Agent: CursorAgent;
  try {
    // Avoid static resolution so mock/CI builds do not require @cursor/sdk installed.
    const dynamicImport = new Function(
      "specifier",
      "return import(specifier)",
    ) as (specifier: string) => Promise<{ Agent: CursorAgent }>;
    const mod = await dynamicImport("@cursor/sdk");
    Agent = mod.Agent;
  } catch {
    throw new Error(
      "@cursor/sdk is not installed. After explicit consent, add the optional dependency, or use --mock.",
    );
  }

  const outcome = await Agent.prompt(prompt, {
    apiKey,
    model: { id: "composer-2.5" },
    local: { cwd },
  });
  return {
    status: outcome.status ?? "unknown",
    result: outcome.result ?? "",
  };
}

function writeDogfoodEvidence(options: {
  evidencePath: string;
  result: Omit<SdkRunResult, "ok" | "errors"> & { errors: string[] };
}): void {
  const dir = path.dirname(options.evidencePath);
  fs.mkdirSync(dir, { recursive: true });
  const body = `# SDK RUN dogfood

generated: ${new Date().toISOString()}
runId: \`${options.result.runId}\`
mode: \`${options.result.mode}\`
taskPath: \`${options.result.taskPath}\`

## Agent

- status: \`${options.result.agent.status}\`
- result:

\`\`\`text
${options.result.agent.result}
\`\`\`

## RPC

- attempted: ${options.result.rpc.attempted}
- ok: ${options.result.rpc.ok}
- url: ${options.result.rpc.url ?? "(none)"}
- detail: ${options.result.rpc.detail}

## CAP / HITL

- Claim: SDK / safe-task automation RUN only
- Does **not** call \`task.py start-execution --approved\` or \`integrate-child\`
- Not an IDE chat tab

## Errors

${
  options.result.errors.length === 0
    ? "(none)"
    : options.result.errors.map((e) => `- ${e}`).join("\n")
}
`;
  fs.writeFileSync(options.evidencePath, body, "utf-8");
}

async function emitRpcEvents(options: {
  url: string;
  token?: string;
  runId: string;
  campaign: string;
  taskPath: string;
  mode: SdkRunMode;
  status: string;
}): Promise<{ ok: boolean; detail: string }> {
  const from = { kind: "sdk" as const, id: options.runId };
  const topic = campaignBroadcastTopic(options.campaign);

  const reg = await rpcRegister({
    url: options.url,
    kind: from.kind,
    id: from.id,
    campaignId: options.campaign,
    token: options.token,
  });
  if (reg.error) {
    return {
      ok: false,
      detail: `register failed: ${reg.error.code} ${reg.error.message}`,
    };
  }

  const body = {
    event: "trellis.child.state",
    taskPath: options.taskPath,
    mode: options.mode,
    status: options.status,
    runId: options.runId,
    clientKind: "sdk",
  };

  const published = await rpcPublish({
    url: options.url,
    from,
    topic,
    campaignId: options.campaign,
    body,
    token: options.token,
  });
  if (published.error) {
    return {
      ok: false,
      detail: `publish failed: ${published.error.code} ${published.error.message}`,
    };
  }

  const delivered =
    typeof published.payload.delivered === "number"
      ? published.payload.delivered
      : 0;
  return {
    ok: true,
    detail: `registered sdk:${options.runId}; published ${topic} (delivered=${delivered})`,
  };
}

/**
 * Minimal Trellis SDK RUN: bind explicit task path, run mock/live agent, write dogfood, emit RPC.
 */
export async function runSdkRun(options: SdkRunOptions): Promise<SdkRunResult> {
  const errors: string[] = [];
  const runId = randomUUID().slice(0, 8);
  const taskPath = resolveTaskPath(options.task);
  assertTaskDir(taskPath);

  const cwd = options.cwd ? path.resolve(options.cwd) : process.cwd();
  const prompt = buildSdkRunPrompt(taskPath, options.prompt);
  const evidencePath =
    options.evidencePath ??
    path.join(taskPath, "research", "sdk-run-dogfood.md");

  let agent: { status: string; result: string };
  if (options.mode === "live") {
    agent = await runLiveAgent(prompt, cwd);
  } else {
    agent = await runMockAgent(prompt);
  }

  let rpc: SdkRunResult["rpc"] = {
    attempted: false,
    ok: false,
    detail: "skipped (--no-rpc)",
  };

  if (!options.noRpc) {
    const url = resolveRpcUrl(options.rpcUrl);
    const token = resolveRpcToken(options.token);
    rpc = { attempted: true, ok: false, url, detail: "" };
    try {
      const outcome = await emitRpcEvents({
        url,
        token,
        runId,
        campaign: options.campaign,
        taskPath,
        mode: options.mode,
        status: agent.status,
      });
      rpc.ok = outcome.ok;
      rpc.detail = outcome.detail;
      if (!outcome.ok) {
        errors.push(`rpc: ${outcome.detail}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      rpc.ok = false;
      rpc.detail = `unavailable: ${message}`;
      errors.push(`rpc: ${rpc.detail}`);
    }
  }

  const partial = {
    runId,
    mode: options.mode,
    taskPath,
    evidencePath,
    rpc,
    agent,
    errors,
  };
  writeDogfoodEvidence({ evidencePath, result: partial });

  // RPC degrade is allowed (LAYERED); validation failures already threw.
  const ok = options.mode === "mock" || agent.status.length > 0;
  return { ok, ...partial };
}

export async function runSdkRunCommand(
  options: SdkRunOptions,
): Promise<number> {
  try {
    const result = await runSdkRun(options);
    if (result.ok) {
      console.log(
        `SDK RUN OK mode=${result.mode} runId=${result.runId} task=${result.taskPath}`,
      );
      console.log(`evidence: ${result.evidencePath}`);
      console.log(`rpc: ${result.rpc.detail}`);
      if (result.errors.length > 0) {
        console.warn(`notes: ${result.errors.join("; ")}`);
      }
      return 0;
    }
    console.error(`SDK RUN FAILED: ${result.errors.join("; ") || "unknown"}`);
    return 1;
  } catch (error) {
    console.error(
      "SDK RUN error:",
      error instanceof Error ? error.message : error,
    );
    return 1;
  }
}
