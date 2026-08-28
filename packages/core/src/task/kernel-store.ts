/**
 * Repo-local Kernel store: atomic snapshot write (state + audit in one
 * file) with optimistic revision and a process lock.
 *
 * Stage 1 does not mutate `task.json.status` — legacy lifecycle remains
 * a read projection. `writeTaskRecord` stays the low-level task.json
 * primitive; this module is the new core-state write entry.
 */

import fs from "node:fs";
import path from "node:path";

import { loadTaskRecord } from "./records.js";
import type { TrellisTaskRecord } from "./schema.js";
import {
  KERNEL_JSON_BASENAME,
  KERNEL_SCHEMA_VERSION,
  KernelError,
  deriveStateForPhase,
  hookIsPresent,
  isKernelPhase,
  isLegalPhaseEdge,
  isNonNegativeInt,
  parseKernelSnapshot,
  projectLegacyStatus,
  requireNonEmptyString,
  type KernelAuditEvent,
  type KernelSnapshot,
  type KernelState,
  type LegacyTaskProjection,
  type TransitionRequest,
} from "./kernel-contract.js";

const LOCK_BASENAME = "kernel.json.lock";
const LOCK_MAX_WAIT_MS = 5000;
const LOCK_RETRY_MS = 25;

export interface KernelReadResult {
  kernel: KernelSnapshot;
  persisted: boolean;
  legacy: LegacyTaskProjection;
}

export interface KernelTransitionResult extends KernelReadResult {
  idempotent: boolean;
  audit: KernelAuditEvent;
}

export function resolveTaskDir(taskDir: string, cwd?: string): string {
  if (path.isAbsolute(taskDir)) return taskDir;
  return path.resolve(cwd ?? process.cwd(), taskDir);
}

export function kernelJsonPath(taskDir: string): string {
  return path.join(taskDir, KERNEL_JSON_BASENAME);
}

export function readKernel(options: {
  taskDir: string;
  cwd?: string;
}): KernelReadResult {
  const dir = resolveTaskDir(options.taskDir, options.cwd);
  assertTaskJson(dir);
  return withKernelLock(dir, () => readKernelUnlocked(dir));
}

export function applyKernelTransition(
  request: TransitionRequest,
): KernelTransitionResult {
  validateTransitionHooks(request);
  const dir = resolveTaskDir(request.taskDir, request.cwd);
  const actor = requireNonEmptyString(request.actor, "actor");
  const idempotencyKey = requireNonEmptyString(
    request.idempotencyKey,
    "idempotencyKey",
  );
  if (!isKernelPhase(request.targetPhase)) {
    throw new KernelError("INVALID_REQUEST", "targetPhase is not a Kernel phase");
  }
  if (!isNonNegativeInt(request.expectedRevision)) {
    throw new KernelError(
      "INVALID_REQUEST",
      "expectedRevision must be a non-negative integer",
    );
  }
  const evidence =
    request.evidence === undefined || request.evidence === null
      ? null
      : requireNonEmptyString(request.evidence, "evidence");

  assertTaskJson(dir);
  return withKernelLock(dir, () => {
    const current = readKernelUnlocked(dir);
    const prior = current.kernel.audit.find(
      (event) => event.idempotencyKey === idempotencyKey,
    );
    if (prior) {
      if (prior.to.phase !== request.targetPhase) {
        throw new KernelError(
          "IDEMPOTENCY_MISMATCH",
          `idempotencyKey ${idempotencyKey} already applied to ${prior.to.phase}`,
        );
      }
      return {
        ...current,
        idempotent: true,
        audit: prior,
      };
    }

    if (request.expectedRevision !== current.kernel.revision) {
      throw new KernelError(
        "REVISION_CONFLICT",
        `expected revision ${request.expectedRevision} but kernel is at ${current.kernel.revision}`,
      );
    }

    if (!isLegalPhaseEdge(current.kernel.phase, request.targetPhase)) {
      throw new KernelError(
        "INVALID_TRANSITION",
        `illegal Kernel edge ${current.kernel.phase} -> ${request.targetPhase}`,
      );
    }

    const fromState: KernelState & { revision: number } = {
      phase: current.kernel.phase,
      condition: current.kernel.condition,
      outcome: current.kernel.outcome,
      revision: current.kernel.revision,
    };
    const nextState = deriveStateForPhase(request.targetPhase);
    const nextRevision = current.kernel.revision + 1;
    const audit: KernelAuditEvent = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      actor,
      idempotencyKey,
      evidence,
      from: fromState,
      to: { ...nextState, revision: nextRevision },
    };
    const next: KernelSnapshot = {
      schemaVersion: KERNEL_SCHEMA_VERSION,
      identity: { taskId: current.kernel.identity.taskId },
      revision: nextRevision,
      phase: nextState.phase,
      condition: nextState.condition,
      outcome: nextState.outcome,
      audit: [...current.kernel.audit, audit],
    };
    atomicWriteFile(
      kernelJsonPath(dir),
      `${JSON.stringify(next, null, 2)}\n`,
    );
    const legacy = current.legacy;
    return {
      kernel: next,
      persisted: true,
      legacy,
      idempotent: false,
      audit,
    };
  });
}

function validateTransitionHooks(request: TransitionRequest): void {
  if (hookIsPresent(request.gate)) {
    throw new KernelError(
      "GATE_HOOK_UNIMPLEMENTED",
      "Gate hooks are Stage 1 placeholders and cannot be treated as passing",
    );
  }
  if (hookIsPresent(request.policy)) {
    throw new KernelError(
      "POLICY_HOOK_UNIMPLEMENTED",
      "Policy hooks are Stage 1 placeholders and cannot be treated as passing",
    );
  }
}

function assertTaskJson(dir: string): void {
  if (!fs.existsSync(path.join(dir, "task.json"))) {
    throw new KernelError("NOT_FOUND", `task.json not found in ${dir}`);
  }
}

function readKernelUnlocked(dir: string): KernelReadResult {
  const record: TrellisTaskRecord = loadTaskRecord({ taskDir: dir });

  const legacy: LegacyTaskProjection = {
    status: record.status,
    id: record.id,
    name: record.name,
    title: record.title,
  };

  const file = kernelJsonPath(dir);
  if (!fs.existsSync(file)) {
    const projected = projectLegacyStatus(record.status);
    const kernel: KernelSnapshot = {
      schemaVersion: KERNEL_SCHEMA_VERSION,
      identity: { taskId: record.id },
      revision: 0,
      phase: projected.phase,
      condition: projected.condition,
      outcome: projected.outcome,
      audit: [],
    };
    return { kernel, persisted: false, legacy };
  }

  const raw = fs.readFileSync(file, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new KernelError(
      "CORRUPT_STATE",
      `Failed to parse ${file}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
  const kernel = parseKernelSnapshot(parsed);
  if (kernel.identity.taskId !== record.id) {
    throw new KernelError(
      "CORRUPT_STATE",
      `kernel identity ${kernel.identity.taskId} does not match task.json id ${record.id}`,
    );
  }
  return { kernel, persisted: true, legacy };
}

function withKernelLock<T>(taskDir: string, fn: () => T): T {
  const lockFile = path.join(taskDir, LOCK_BASENAME);
  acquireLockSync(lockFile);
  try {
    return fn();
  } finally {
    releaseLockSync(lockFile);
  }
}

function acquireLockSync(lockFile: string): void {
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });
  const deadline = Date.now() + LOCK_MAX_WAIT_MS;
  while (true) {
    try {
      const fd = fs.openSync(lockFile, "wx");
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }
    stealStaleLock(lockFile);
    if (Date.now() >= deadline) {
      throw new KernelError(
        "LOCK_TIMEOUT",
        `Failed to acquire kernel lock ${lockFile} within ${LOCK_MAX_WAIT_MS}ms`,
      );
    }
    sleepSync(LOCK_RETRY_MS);
  }
}

function stealStaleLock(lockFile: string): void {
  let holderPid = 0;
  try {
    holderPid = Number(fs.readFileSync(lockFile, "utf-8").trim());
  } catch {
    return;
  }
  if (!holderPid || pidAlive(holderPid)) return;
  try {
    fs.unlinkSync(lockFile);
  } catch {
    // lost the race
  }
}

function releaseLockSync(lockFile: string): void {
  try {
    const content = fs.readFileSync(lockFile, "utf-8").trim();
    if (content === String(process.pid)) {
      fs.unlinkSync(lockFile);
    }
  } catch {
    // already gone
  }
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleepSync(ms: number): void {
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}

function atomicWriteFile(targetPath: string, contents: string): void {
  const dir = path.dirname(targetPath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = path.join(
    dir,
    `.${path.basename(targetPath)}.${process.pid}.${Date.now()}.tmp`,
  );
  fs.writeFileSync(tmpPath, contents, "utf-8");
  try {
    fs.renameSync(tmpPath, targetPath);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "EEXIST" || code === "EPERM" || process.platform === "win32") {
      fs.copyFileSync(tmpPath, targetPath);
      fs.unlinkSync(tmpPath);
      return;
    }
    try {
      fs.unlinkSync(tmpPath);
    } catch {
      // ignore leftover tmp
    }
    throw err;
  }
}
