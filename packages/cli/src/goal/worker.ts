import fs from "node:fs";
import path from "node:path";

import type { GoalActionPacket } from "./action-packet.js";
import { safeParseGoalActionPacket } from "./action-packet.js";
import { goalContractPath, goalRunDir } from "./paths.js";
import { promptCursorAgent } from "./sdk-client.js";
import type { GoalState, GoalWorkerKind } from "./state.js";
import { buildGoalWorkerPrompt } from "./worker-prompt.js";
import { packAction } from "./review-seam.js";
import { hasCursorApiKey } from "../utils/cursor-sdk-gate.js";
import { cursorApiKeySetupGuide } from "../utils/cursor-sdk-gate.js";

export type { GoalWorkerKind } from "./state.js";

export interface WorkerTurnContext {
  cwd: string;
  state: GoalState;
  contractPath: string;
  agentDefinitionPath: string;
  turnIndex: number;
  timeoutMs: number;
}

export type WorkerTurnKind = "status" | "action" | "error";

export interface WorkerTurnResult {
  kind: WorkerTurnKind;
  summary: string;
  packet?: GoalActionPacket;
  error?: string;
  evidencePath: string;
}

export interface GoalWorkerAdapter {
  readonly id: GoalWorkerKind;
  runTurn(ctx: WorkerTurnContext): Promise<WorkerTurnResult>;
}

export function goalWorkerTurnPath(
  cwd: string,
  goalId: string,
  turnIndex: number,
): string {
  return path.join(goalRunDir(cwd, goalId), "worker-turns", `${turnIndex}.md`);
}

export function extractJsonBlocks(text: string): unknown[] {
  const blocks: unknown[] = [];
  const re = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      // skip invalid JSON fences
    }
  }
  return blocks;
}

export function parseWorkerPacketFromText(
  text: string,
  goalId: string,
): GoalActionPacket | null {
  for (const block of extractJsonBlocks(text)) {
    const parsed = safeParseGoalActionPacket(block);
    if (parsed.valid && parsed.packet.goal_id === goalId) {
      return parsed.packet;
    }
    if (parsed.valid && !parsed.packet.goal_id) {
      return parsed.packet;
    }
  }
  return null;
}

function writeWorkerEvidence(
  evidencePath: string,
  body: {
    adapter: GoalWorkerKind;
    turnIndex: number;
    promptChars: number;
    status: string;
    result: string;
    kind: WorkerTurnKind;
    error?: string;
  },
): void {
  fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
  const content = [
    `# Goal worker turn ${body.turnIndex}`,
    "",
    `adapter: \`${body.adapter}\``,
    `kind: \`${body.kind}\``,
    `status: \`${body.status}\``,
    `prompt_chars: ${body.promptChars}`,
    "",
    "## Result",
    "",
    "```text",
    body.result.slice(0, 8000),
    "```",
    "",
    body.error ? `## Error\n\n${body.error}\n` : "",
  ].join("\n");
  fs.writeFileSync(evidencePath, content, "utf-8");
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

export class MockWorkerAdapter implements GoalWorkerAdapter {
  readonly id = "mock" as const;

  async runTurn(ctx: WorkerTurnContext): Promise<WorkerTurnResult> {
    const evidencePath = goalWorkerTurnPath(ctx.cwd, ctx.state.goal_id, ctx.turnIndex);
    const packet = packAction(ctx.state, {
      summary: "Run focused validation for goal step (mock worker)",
      kind: "shell",
      digest: "pnpm test goal/",
      axes: { A: false, B: false, C: true },
      hardDenyCandidates: [],
    });
    writeWorkerEvidence(evidencePath, {
      adapter: this.id,
      turnIndex: ctx.turnIndex,
      promptChars: 0,
      status: "completed",
      result: `[mock] worker turn ${ctx.turnIndex}`,
      kind: "action",
    });
    return {
      kind: "action",
      summary: `mock worker step ${ctx.turnIndex}`,
      packet,
      evidencePath,
    };
  }
}

export class SdkWorkerAdapter implements GoalWorkerAdapter {
  readonly id = "sdk" as const;

  async runTurn(ctx: WorkerTurnContext): Promise<WorkerTurnResult> {
    const evidencePath = goalWorkerTurnPath(ctx.cwd, ctx.state.goal_id, ctx.turnIndex);
    const prompt = buildGoalWorkerPrompt(ctx);

    try {
      const outcome = await withTimeout(
        promptCursorAgent(prompt, ctx.cwd),
        ctx.timeoutMs,
        "SDK worker turn",
      );
      const packet = parseWorkerPacketFromText(outcome.result, ctx.state.goal_id);
      const kind: WorkerTurnKind = packet ? "action" : "status";
      writeWorkerEvidence(evidencePath, {
        adapter: this.id,
        turnIndex: ctx.turnIndex,
        promptChars: prompt.length,
        status: outcome.status,
        result: outcome.result,
        kind,
      });
      if (packet) {
        return {
          kind: "action",
          summary: `sdk worker proposed action (turn ${ctx.turnIndex})`,
          packet,
          evidencePath,
        };
      }
      const summary =
        outcome.result.trim().slice(0, 240) ||
        `sdk worker status (turn ${ctx.turnIndex})`;
      return { kind: "status", summary, evidencePath };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      writeWorkerEvidence(evidencePath, {
        adapter: this.id,
        turnIndex: ctx.turnIndex,
        promptChars: prompt.length,
        status: "error",
        result: "",
        kind: "error",
        error: message,
      });
      return {
        kind: "error",
        summary: `sdk worker error: ${message}`,
        error: message,
        evidencePath,
      };
    }
  }
}

export function resolveWorkerAdapter(opts: {
  mockWorker?: boolean;
  worker?: GoalWorkerKind;
}): GoalWorkerAdapter {
  if (opts.mockWorker || opts.worker === "mock") {
    return new MockWorkerAdapter();
  }
  if (!hasCursorApiKey()) {
    throw new Error(
      [
        "Runner goal worker requires CURSOR_API_KEY for live SDK turns.",
        "Use --mock-worker for offline/CI, or set the key per `cstl sdk status`.",
        cursorApiKeySetupGuide(),
      ].join(" "),
    );
  }
  return new SdkWorkerAdapter();
}

export function defaultAgentDefinitionPath(cwd: string): string {
  return path.join(cwd, ".cursor", "agents", "cstl-goal-worker.md");
}

export function buildWorkerTurnContext(
  cwd: string,
  state: GoalState,
  turnIndex: number,
): WorkerTurnContext {
  return {
    cwd,
    state,
    contractPath: goalContractPath(cwd, state.goal_id),
    agentDefinitionPath: defaultAgentDefinitionPath(cwd),
    turnIndex,
    timeoutMs: state.walls.workerTurnTimeoutMs,
  };
}
