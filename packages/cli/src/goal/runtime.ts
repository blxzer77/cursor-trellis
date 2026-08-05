import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { appendAuditLine } from "./audit.js";
import { parseGoalActionPacket } from "./action-packet.js";
import { detectRunMode, proposePreflight, renderContractMarkdown } from "./preflight.js";
import {
  ensureGoalRunDir,
  goalContractPath,
  goalRunsRoot,
  newGoalId,
} from "./paths.js";
import {
  applyReviewDecision,
  minimalReviewFallback,
  packAction,
  recordL1,
  recordL2,
  type ReviewCaller,
  writePacketFiles,
} from "./review-seam.js";
import { reviewGoalActionPacket } from "./reviewer.js";
import {
  createDraftState,
  readGoalState,
  writeGoalState,
  type GoalContract,
  type GoalState,
} from "./state.js";
import { evaluateTaskTriggers, shouldCreateGoalRootTask } from "./task-triggers.js";
import { checkWalls, markNoProgressRound, markProgress } from "./walls.js";
import type { GoalActionPacket } from "./action-packet.js";
import {
  buildWorkerTurnContext,
  resolveWorkerAdapter,
  type GoalWorkerKind,
} from "./worker.js";
import { DIR_NAMES } from "../constants/paths.js";
import { workflowPath } from "../utils/workflow-dir.js";

export interface GoalPreflightOptions {
  cwd: string;
  goal: string;
  window?: boolean;
  goalId?: string;
}

export interface GoalAcceptOptions {
  cwd: string;
  goalId: string;
}

export interface GoalRunOptions {
  cwd: string;
  goalId: string;
  mockWorker?: boolean;
  worker?: GoalWorkerKind;
  maxSteps?: number;
}

function runnerAvailable(): boolean {
  return process.env.CSTL_GOAL_FORCE_WINDOW !== "1";
}

export function runGoalPreflight(opts: GoalPreflightOptions): {
  goalId: string;
  result: ReturnType<typeof proposePreflight>;
} {
  const goalId = opts.goalId ?? newGoalId();
  const mode = detectRunMode({
    forceWindow: opts.window === true,
    runnerAvailable: runnerAvailable(),
  });
  const result = proposePreflight(opts.goal, mode);
  ensureGoalRunDir(opts.cwd, goalId);
  let state = createDraftState(goalId, opts.goal, mode);
  state.lifecycle = result.ok ? "preflight_pending" : "draft";
  writeGoalState(opts.cwd, state);
  return { goalId, result };
}

export function acceptGoalPreflight(opts: GoalAcceptOptions): GoalState {
  const state = readGoalState(opts.cwd, opts.goalId);
  if (state.lifecycle !== "preflight_pending") {
    throw new Error(`Goal ${opts.goalId} is not awaiting preflight acceptance`);
  }
  const proposal = proposePreflight(state.goal_text, state.mode);
  if (!proposal.ok) {
    throw new Error(`Cannot accept preflight: ${proposal.reason}`);
  }

  const contract: GoalContract = {
    goalText: state.goal_text,
    doneWhen: proposal.doneWhen,
    evidenceHow: proposal.evidenceHow,
    acceptedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    goalContractPath(opts.cwd, opts.goalId),
    renderContractMarkdown(proposal, state.goal_text),
    "utf-8",
  );

  let next: GoalState = {
    ...state,
    lifecycle: "running",
    contract,
    started_at: new Date().toISOString(),
    last_progress_at: new Date().toISOString(),
  };

  const hits = evaluateTaskTriggers(next, {
    l1Count: 0,
    justAcceptedPreflight: true,
  });
  if (shouldCreateGoalRootTask(hits)) {
    next.task_dir = createGoalRootTask(opts.cwd, next);
    appendAuditLine(opts.cwd, next.goal_id, "L0", `goal-root task ${next.task_dir}`);
  }

  writeGoalState(opts.cwd, next);
  return next;
}

function createGoalRootTask(cwd: string, state: GoalState): string {
  const slug = `goal-${state.goal_id.replace(/^goal-/, "")}`;
  const scripts = workflowPath(cwd, DIR_NAMES.SCRIPTS);
  const taskPy = scripts ? path.join(scripts, "task.py") : null;
  const title = `goal: ${state.goal_text.slice(0, 80)}`;

  if (taskPy && fs.existsSync(taskPy)) {
    const proc = spawnSync(
      process.platform === "win32" ? "python" : "python3",
      [taskPy, "create", title, "--slug", slug, "--package", "cursor-trellis"],
      { cwd, encoding: "utf-8" },
    );
    if (proc.status === 0) {
      const taskDir = workflowPath(cwd, "tasks", slug);
      if (taskDir && fs.existsSync(path.join(taskDir, "task.json"))) {
        patchGoalMeta(taskDir, state.goal_id);
        return taskDir;
      }
    }
  }

  const fallbackDir = workflowPath(cwd, "tasks", slug);
  if (!fallbackDir) throw new Error("Cannot resolve tasks directory");
  fs.mkdirSync(fallbackDir, { recursive: true });
  fs.writeFileSync(
    path.join(fallbackDir, "task.json"),
    `${JSON.stringify(
      {
        id: slug,
        title,
        status: "in_progress",
        meta: { created_by: "cstl-goal", goal_id: state.goal_id },
      },
      null,
      2,
    )}\n`,
    "utf-8",
  );
  fs.writeFileSync(path.join(fallbackDir, "prd.md"), `# ${title}\n\nGoal-root task for ${state.goal_id}.\n`, "utf-8");
  return fallbackDir;
}

function patchGoalMeta(taskDir: string, goalId: string): void {
  const file = path.join(taskDir, "task.json");
  if (!fs.existsSync(file)) return;
  const data = JSON.parse(fs.readFileSync(file, "utf-8")) as Record<string, unknown>;
  const meta =
    typeof data.meta === "object" && data.meta !== null
      ? (data.meta as Record<string, unknown>)
      : {};
  meta.created_by = "cstl-goal";
  meta.goal_id = goalId;
  data.meta = meta;
  data.status = "in_progress";
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, "utf-8");
}

export function pauseGoal(cwd: string, goalId: string, reason: string): GoalState {
  const state = readGoalState(cwd, goalId);
  const hits = evaluateTaskTriggers(state, { l1Count: 0, aboutToPause: true });
  if (hits.length > 0 && state.task_dir) {
    appendVerifySnippet(state.task_dir, `pause: ${reason}`);
  }
  recordL2(cwd, goalId, reason);
  const next = { ...state, lifecycle: "paused" as const };
  writeGoalState(cwd, next);
  return next;
}

export function crashGoal(cwd: string, goalId: string, reason: string): GoalState {
  const state = readGoalState(cwd, goalId);
  recordL2(cwd, goalId, reason);
  if (state.task_dir) appendVerifySnippet(state.task_dir, `crash-wall: ${reason}`);
  const next = { ...state, lifecycle: "crashed" as const };
  writeGoalState(cwd, next);
  return next;
}

function appendVerifySnippet(taskDir: string, line: string): void {
  const verify = path.join(taskDir, "verify.md");
  if (!fs.existsSync(taskDir)) {
    return;
  }
  const stamp = new Date().toISOString();
  const chunk = `\n## Goal runtime (${stamp})\n\n- ${line}\n`;
  if (fs.existsSync(verify)) {
    fs.appendFileSync(verify, chunk, "utf-8");
  } else {
    fs.writeFileSync(verify, `# verify\n${chunk}`, "utf-8");
  }
}

export async function runGoalLoop(
  opts: GoalRunOptions,
  reviewCaller: ReviewCaller = async (packetPath) => {
    const raw = JSON.parse(fs.readFileSync(packetPath, "utf-8"));
    const result = reviewGoalActionPacket(raw);
    if (!result.valid || !result.decision) {
      // Invalid packet / decision: fall back so walls can retry or pause.
      return minimalReviewFallback(raw);
    }
    return result.decision;
  },
): Promise<GoalState> {
  let state = readGoalState(opts.cwd, opts.goalId);
  if (state.lifecycle !== "running") {
    throw new Error(`Goal ${opts.goalId} is not running (lifecycle=${state.lifecycle})`);
  }

  const maxSteps = opts.maxSteps ?? 3;
  let packetSeq = 1;

  for (let step = 0; step < maxSteps; step += 1) {
    const wall = checkWalls(state);
    if (!wall.ok) {
      return crashGoal(opts.cwd, state.goal_id, wall.reason);
    }

    state = {
      ...state,
      worker_turns: state.worker_turns + 1,
      total_turns: state.total_turns + 1,
    };

    if (state.mode === "window" && !opts.mockWorker && opts.worker !== "mock") {
      appendAuditLine(
        opts.cwd,
        state.goal_id,
        "L0",
        "window mode — continue in IDE agent; close window stops run",
      );
      writeGoalState(opts.cwd, state);
      return state;
    }

    const adapter = resolveWorkerAdapter({
      mockWorker: opts.mockWorker,
      worker: opts.worker,
    });
    state = { ...state, last_worker_adapter: adapter.id };
    appendAuditLine(
      opts.cwd,
      state.goal_id,
      "L0",
      `worker ${adapter.id} turn ${step + 1} start`,
    );

    const turnResult = await adapter.runTurn(
      buildWorkerTurnContext(opts.cwd, state, step + 1),
    );
    appendAuditLine(opts.cwd, state.goal_id, "L0", turnResult.summary);

    if (turnResult.kind === "error") {
      state = markNoProgressRound(state);
      writeGoalState(opts.cwd, state);
      continue;
    }

    if (turnResult.kind === "status") {
      state = markProgress(state);
      writeGoalState(opts.cwd, state);
      continue;
    }

    const sampleAction: GoalActionPacket =
      turnResult.packet ??
      packAction(state, {
        summary: "Run focused validation for goal step",
        kind: "shell",
        digest: "pnpm test goal/",
        axes: { A: false, B: false, C: true },
        hardDenyCandidates: [],
      });

    const packetPath = writePacketFiles(
      opts.cwd,
      state.goal_id,
      packetSeq,
      sampleAction,
    ).requestPath;

    let reviewAttempts = 0;
    let applied = false;
    while (reviewAttempts <= state.walls.maxReviewRetries && !applied) {
      const decision = await reviewCaller(packetPath);
      writePacketFiles(opts.cwd, state.goal_id, packetSeq, sampleAction, decision);
      const outcome = applyReviewDecision(
        state,
        sampleAction,
        decision,
        sampleAction.action_kind,
      );
      state = outcome.state;

      if (outcome.result.action === "retry_review") {
        reviewAttempts += 1;
        continue;
      }

      recordL1(opts.cwd, state.goal_id, decision);
      applied = true;

      if (outcome.result.action === "crash_wall") {
        return crashGoal(opts.cwd, state.goal_id, outcome.result.reason);
      }
      if (outcome.result.action === "reroute") {
        state = markNoProgressRound(state);
      } else {
        state = markProgress(state);
      }
    }

    if (!applied) {
      return pauseGoal(opts.cwd, state.goal_id, "review retries exhausted");
    }

    packetSeq += 1;
    writeGoalState(opts.cwd, state);
  }

  writeGoalState(opts.cwd, state);
  return state;
}

export function goalStatus(cwd: string, goalId: string): GoalState {
  return readGoalState(cwd, goalId);
}

export function listGoalRuns(cwd: string): string[] {
  const runsRoot = goalRunsRoot(cwd);
  if (!fs.existsSync(runsRoot)) return [];
  return fs
    .readdirSync(runsRoot, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
}
