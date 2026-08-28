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

import {
  assertFullQualityForPhase,
  assertIndependentCheckGateRecord,
  normalizeRequiredControlsInExtras,
} from "./full-quality.js";
import { normalizeStage6InExtrasAndAssert } from "./adapter-middleware.js";
import { normalizeStage5InExtrasAndAssert } from "./ondemand-topology.js";
import { loadTaskRecord, writeTaskRecord } from "./records.js";
import {
  TASK_RECORD_FIELD_ORDER,
  isPlainObject,
  taskRecordSchema,
  type TrellisTaskRecord,
} from "./schema.js";
import {
  KERNEL_JSON_BASENAME,
  KERNEL_SCHEMA_VERSION,
  KernelError,
  deriveStateForPhase,
  emptyKernelGates,
  hookIsPresent,
  hopsToClose,
  hopsToExecute,
  isKernelPhase,
  isLegalPhaseEdge,
  isNonNegativeInt,
  kernelPhaseToLegacyStatus,
  parseKernelSnapshot,
  projectLegacyStatus,
  requireNonEmptyString,
  type KernelAuditEvent,
  type KernelLegacyProjection,
  type KernelPhase,
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

export interface KernelCommandResult extends KernelReadResult {
  idempotent: boolean;
  audit: KernelAuditEvent;
  projected: boolean;
}

export interface KernelCreateRequest {
  taskDir: string;
  actor: string;
  idempotencyKey: string;
  record: TrellisTaskRecord;
  extras?: Record<string, unknown>;
  evidence?: string;
  gate?: unknown;
  policy?: unknown;
  cwd?: string;
}

export interface KernelStartRequest {
  taskDir: string;
  expectedRevision: number;
  actor: string;
  idempotencyKey: string;
  record: TrellisTaskRecord;
  extras?: Record<string, unknown>;
  evidence?: string;
  gate?: unknown;
  policy?: unknown;
  cwd?: string;
}

export interface KernelRecordGateRequest {
  taskDir: string;
  expectedRevision: number;
  actor: string;
  idempotencyKey: string;
  transition: string;
  gateName: string;
  record: Record<string, unknown>;
  extras?: Record<string, unknown>;
  evidence?: string;
  cwd?: string;
}

export interface KernelArchiveRequest {
  taskDir: string;
  expectedRevision: number;
  actor: string;
  idempotencyKey: string;
  record: TrellisTaskRecord;
  extras?: Record<string, unknown>;
  evidence?: string;
  gate?: unknown;
  policy?: unknown;
  cwd?: string;
}

export interface KernelPatchRequest {
  taskDir: string;
  expectedRevision: number;
  actor: string;
  idempotencyKey: string;
  /** Canonical field patch and/or full record. Status hops are rejected. */
  record?: unknown;
  extras?: Record<string, unknown>;
  evidence?: string;
  gate?: unknown;
  policy?: unknown;
  cwd?: string;
}

let kernelAfterWriteHook: (() => void) | null = null;

/** Test-only interceptor between kernel.json persist and task.json projection. */
export function setKernelAfterWriteHook(hook: (() => void) | null): void {
  kernelAfterWriteHook = hook;
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
      gates: current.kernel.gates,
      projection: current.kernel.projection,
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

function validateTransitionHooks(request: {
  gate?: unknown;
  policy?: unknown;
}): void {
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
  const file = kernelJsonPath(dir);
  const taskFile = path.join(dir, "task.json");

  if (!fs.existsSync(taskFile)) {
    if (!fs.existsSync(file)) {
      throw new KernelError("NOT_FOUND", `task.json not found in ${dir}`);
    }
    const kernel = loadKernelFile(file);
    return {
      kernel,
      persisted: true,
      legacy: legacyFromSnapshot(kernel),
    };
  }

  const record: TrellisTaskRecord = loadTaskRecord({ taskDir: dir });

  const legacy: LegacyTaskProjection = {
    status: record.status,
    id: record.id,
    name: record.name,
    title: record.title,
  };

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
      gates: emptyKernelGates(),
      projection: null,
    };
    return { kernel, persisted: false, legacy };
  }

  const kernel = loadKernelFile(file);
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

function loadKernelFile(file: string): KernelSnapshot {
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
  return parseKernelSnapshot(parsed);
}

function legacyFromSnapshot(kernel: KernelSnapshot): LegacyTaskProjection {
  const record = kernel.projection?.record;
  if (record) {
    return {
      status: kernel.projection?.status ?? record.status,
      id: record.id,
      name: record.name,
      title: record.title,
    };
  }
  return {
    status: kernelPhaseToLegacyStatus(kernel.phase),
    id: kernel.identity.taskId,
    name: kernel.identity.taskId,
    title: kernel.identity.taskId,
  };
}

function cloneJsonObject(value: Record<string, unknown>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}

function mergeExtras(
  current: Record<string, unknown>,
  incoming: Record<string, unknown> | undefined,
  record?: { id?: string; parent?: string | null; children?: string[] },
  phase: "create" | "start" | "archive" | "patch" = "patch",
): Record<string, unknown> {
  const merged = {
    ...cloneJsonObject(current),
    ...(incoming === undefined ? {} : cloneJsonObject(incoming)),
  };
  normalizeRequiredControlsInExtras(merged);
  normalizeStage5InExtrasAndAssert(merged, record ?? {}, phase);
  normalizeStage6InExtrasAndAssert(merged, phase);
  return merged;
}

function requireEvidence(
  value: string | undefined,
  field: string,
): string | null {
  if (value === undefined || value === null) return null;
  return requireNonEmptyString(value, field);
}

function persistKernelSnapshot(dir: string, snapshot: KernelSnapshot): void {
  atomicWriteFile(
    kernelJsonPath(dir),
    `${JSON.stringify(snapshot, null, 2)}\n`,
  );
}

function commitKernelAndProject(
  dir: string,
  snapshot: KernelSnapshot,
): KernelCommandResult {
  if (!snapshot.projection) {
    throw new KernelError(
      "INVALID_REQUEST",
      "Kernel command requires a legacy projection",
    );
  }
  persistKernelSnapshot(dir, snapshot);
  try {
    if (kernelAfterWriteHook) {
      kernelAfterWriteHook();
    }
    writeTaskRecord({
      taskDir: dir,
      record: snapshot.projection.record,
      extra: snapshot.projection.extras,
    });
  } catch (err) {
    if (err instanceof KernelError && err.code === "HALF_CONVERSION") {
      throw err;
    }
    throw new KernelError(
      "HALF_CONVERSION",
      `kernel.json committed at revision ${snapshot.revision} but task.json projection failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
  return {
    kernel: snapshot,
    persisted: true,
    legacy: legacyFromSnapshot(snapshot),
    idempotent: false,
    audit: snapshot.audit[snapshot.audit.length - 1] as KernelAuditEvent,
    projected: true,
  };
}

function hopKernelSnapshot(
  current: KernelSnapshot,
  hops: KernelPhase[],
  meta: { actor: string; idempotencyKey: string; evidence: string | null },
): { snapshot: KernelSnapshot; audit: KernelAuditEvent; idempotent: boolean } {
  const prior = current.audit.find(
    (event) => event.idempotencyKey === meta.idempotencyKey,
  );
  if (prior) {
    return { snapshot: current, audit: prior, idempotent: true };
  }

  if (hops.length === 0) {
    const nextRevision = current.revision + 1;
    const state: KernelState = {
      phase: current.phase,
      condition: current.condition,
      outcome: current.outcome,
    };
    const audit: KernelAuditEvent = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      actor: meta.actor,
      idempotencyKey: meta.idempotencyKey,
      evidence: meta.evidence,
      from: { ...state, revision: current.revision },
      to: { ...state, revision: nextRevision },
    };
    return {
      snapshot: {
        ...current,
        revision: nextRevision,
        audit: [...current.audit, audit],
      },
      audit,
      idempotent: false,
    };
  }

  let snapshot = current;
  let lastAudit: KernelAuditEvent | undefined;
  hops.forEach((target, index) => {
    const key =
      index === hops.length - 1
        ? meta.idempotencyKey
        : `${meta.idempotencyKey}#${target}`;
    if (!isLegalPhaseEdge(snapshot.phase, target)) {
      throw new KernelError(
        "INVALID_TRANSITION",
        `illegal Kernel edge ${snapshot.phase} -> ${target}`,
      );
    }
    const fromState: KernelState & { revision: number } = {
      phase: snapshot.phase,
      condition: snapshot.condition,
      outcome: snapshot.outcome,
      revision: snapshot.revision,
    };
    const nextState = deriveStateForPhase(target);
    const nextRevision = snapshot.revision + 1;
    lastAudit = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      actor: meta.actor,
      idempotencyKey: key,
      evidence: meta.evidence,
      from: fromState,
      to: { ...nextState, revision: nextRevision },
    };
    snapshot = {
      ...snapshot,
      revision: nextRevision,
      phase: nextState.phase,
      condition: nextState.condition,
      outcome: nextState.outcome,
      audit: [...snapshot.audit, lastAudit],
    };
  });
  if (!lastAudit) {
    throw new KernelError("INVALID_REQUEST", "Kernel hop produced no audit event");
  }
  return { snapshot, audit: lastAudit, idempotent: false };
}

function attachProjection(
  snapshot: KernelSnapshot,
  record: TrellisTaskRecord,
  extras: Record<string, unknown>,
  status: string,
): KernelSnapshot {
  const projection: KernelLegacyProjection = {
    status,
    record: taskRecordSchema.parse({ ...record, status }),
    extras: cloneJsonObject(extras),
  };
  return { ...snapshot, projection };
}

function expectRevision(current: KernelSnapshot, expected: number): void {
  if (expected !== current.revision) {
    throw new KernelError(
      "REVISION_CONFLICT",
      `expected revision ${expected} but kernel is at ${current.revision}`,
    );
  }
}

function assertHonestGateRecord(record: Record<string, unknown>): void {
  const result = record.result;
  if (result !== "PASS" && result !== "FAIL" && result !== "SKIPPED") {
    throw new KernelError(
      "INVALID_REQUEST",
      "gate record.result must be PASS, FAIL, or SKIPPED",
    );
  }
  if (result === "PASS") {
    if (typeof record.evidence !== "string" || record.evidence.trim() === "") {
      throw new KernelError(
        "INVALID_REQUEST",
        "PASS gate records require non-empty evidence (no fake-green)",
      );
    }
  }
  if (result === "SKIPPED") {
    const skip = record.approved_skip;
    if (
      !skip ||
      typeof skip !== "object" ||
      Array.isArray(skip) ||
      typeof (skip as Record<string, unknown>).approved_by !== "string" ||
      typeof (skip as Record<string, unknown>).reason !== "string"
    ) {
      throw new KernelError(
        "INVALID_REQUEST",
        "SKIPPED gate records require approved_skip.approved_by and reason",
      );
    }
  }
}

export function applyKernelCreate(
  request: KernelCreateRequest,
): KernelCommandResult {
  validateTransitionHooks(request);
  const dir = resolveTaskDir(request.taskDir, request.cwd);
  const actor = requireNonEmptyString(request.actor, "actor");
  const idempotencyKey = requireNonEmptyString(
    request.idempotencyKey,
    "idempotencyKey",
  );
  const record = taskRecordSchema.parse({
    ...request.record,
    status: request.record.status || "planning",
  });
  const extras = mergeExtras({}, request.extras, record, "create");
  const evidence = requireEvidence(request.evidence, "evidence");

  fs.mkdirSync(dir, { recursive: true });
  return withKernelLock(dir, () => {
    if (fs.existsSync(kernelJsonPath(dir))) {
      const current = readKernelUnlocked(dir);
      const prior = current.kernel.audit.find(
        (event) => event.idempotencyKey === idempotencyKey,
      );
      if (prior) {
        if (!fs.existsSync(path.join(dir, "task.json")) && current.kernel.projection) {
          return commitKernelAndProject(dir, current.kernel);
        }
        return {
          ...current,
          idempotent: true,
          audit: prior,
          projected: fs.existsSync(path.join(dir, "task.json")),
        };
      }
      throw new KernelError(
        "INVALID_REQUEST",
        `kernel.json already exists for ${current.kernel.identity.taskId}`,
      );
    }

    const openState = deriveStateForPhase("open");
    const defineState = deriveStateForPhase("define");
    const audit: KernelAuditEvent = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      actor,
      idempotencyKey,
      evidence,
      from: { ...openState, revision: 0 },
      to: { ...defineState, revision: 1 },
    };
    const snapshot: KernelSnapshot = {
      schemaVersion: KERNEL_SCHEMA_VERSION,
      identity: { taskId: record.id },
      revision: 1,
      phase: defineState.phase,
      condition: defineState.condition,
      outcome: defineState.outcome,
      audit: [audit],
      gates: emptyKernelGates(),
      projection: null,
    };
    const next = attachProjection(snapshot, record, extras, "planning");
    const result = commitKernelAndProject(dir, next);
    return { ...result, audit, idempotent: false };
  });
}

export function applyKernelStart(
  request: KernelStartRequest,
): KernelCommandResult {
  validateTransitionHooks(request);
  const dir = resolveTaskDir(request.taskDir, request.cwd);
  const actor = requireNonEmptyString(request.actor, "actor");
  const idempotencyKey = requireNonEmptyString(
    request.idempotencyKey,
    "idempotencyKey",
  );
  if (!isNonNegativeInt(request.expectedRevision)) {
    throw new KernelError(
      "INVALID_REQUEST",
      "expectedRevision must be a non-negative integer",
    );
  }
  const record = taskRecordSchema.parse(request.record);
  const evidence = requireEvidence(request.evidence, "evidence");

  return withKernelLock(dir, () => {
    const current = readKernelUnlocked(dir);
    const prior = current.kernel.audit.find(
      (event) => event.idempotencyKey === idempotencyKey,
    );
    if (prior) {
      if (!fs.existsSync(path.join(dir, "task.json")) && current.kernel.projection) {
        return commitKernelAndProject(dir, current.kernel);
      }
      return {
        ...current,
        idempotent: true,
        audit: prior,
        projected: true,
      };
    }
    expectRevision(current.kernel, request.expectedRevision);
    const extras = mergeExtras(
      current.kernel.projection?.extras ?? {},
      request.extras,
      record,
      "start",
    );
    assertFullQualityForPhase(dir, extras, "start");
    const hops = hopsToExecute(current.kernel.phase);
    const hopped = hopKernelSnapshot(current.kernel, hops, {
      actor,
      idempotencyKey,
      evidence,
    });
    const next = attachProjection(
      hopped.snapshot,
      record,
      extras,
      "in_progress",
    );
    const result = commitKernelAndProject(dir, next);
    return { ...result, audit: hopped.audit, idempotent: hopped.idempotent };
  });
}

export function applyKernelRecordGate(
  request: KernelRecordGateRequest,
): KernelCommandResult {
  const dir = resolveTaskDir(request.taskDir, request.cwd);
  const actor = requireNonEmptyString(request.actor, "actor");
  const idempotencyKey = requireNonEmptyString(
    request.idempotencyKey,
    "idempotencyKey",
  );
  const transition = requireNonEmptyString(request.transition, "transition");
  const gateName = requireNonEmptyString(request.gateName, "gate");
  if (!isNonNegativeInt(request.expectedRevision)) {
    throw new KernelError(
      "INVALID_REQUEST",
      "expectedRevision must be a non-negative integer",
    );
  }
  assertHonestGateRecord(request.record);
  if (gateName === "independent-check") {
    assertIndependentCheckGateRecord(request.record);
  }
  const evidence =
    requireEvidence(request.evidence, "evidence") ??
    (typeof request.record.evidence === "string"
      ? request.record.evidence
      : null);

  return withKernelLock(dir, () => {
    const current = readKernelUnlocked(dir);
    const prior = current.kernel.audit.find(
      (event) => event.idempotencyKey === idempotencyKey,
    );
    if (prior) {
      if (!fs.existsSync(path.join(dir, "task.json")) && current.kernel.projection) {
        return commitKernelAndProject(dir, current.kernel);
      }
      return {
        ...current,
        idempotent: true,
        audit: prior,
        projected: true,
      };
    }
    expectRevision(current.kernel, request.expectedRevision);

    const gates = {
      schemaVersion: 1 as const,
      transitions: {
        ...current.kernel.gates.transitions,
        [transition]: {
          ...(current.kernel.gates.transitions[transition] ?? {}),
          [gateName]: cloneJsonObject(request.record),
        },
      },
    };
    const hopped = hopKernelSnapshot(current.kernel, [], {
      actor,
      idempotencyKey,
      evidence,
    });
    const baseRecord =
      current.kernel.projection?.record ??
      loadTaskRecord({ taskDir: dir });
    const extras = mergeExtras(
      current.kernel.projection?.extras ?? {},
      request.extras,
      baseRecord,
      "patch",
    );
    extras.quality_gate_results =
      extras.quality_gate_results ??
      {
        schema_version: 1,
        transitions: gates.transitions,
      };
    if (gateName === "independent-check" && extras.independent_check === undefined) {
      extras.independent_check = {
        schema_version: 1,
        mode: request.record.mode ?? request.record.assurance,
        readonly: true,
        result: request.record.result,
        evidence: request.record.evidence,
        independent_worker: request.record.independent_worker === true,
        code_fingerprint: request.record.code_fingerprint ?? "",
      };
    }
    const next = attachProjection(
      { ...hopped.snapshot, gates },
      baseRecord,
      extras,
      baseRecord.status,
    );
    const result = commitKernelAndProject(dir, next);
    return { ...result, audit: hopped.audit, idempotent: false };
  });
}

export function applyKernelArchive(
  request: KernelArchiveRequest,
): KernelCommandResult {
  validateTransitionHooks(request);
  const dir = resolveTaskDir(request.taskDir, request.cwd);
  const actor = requireNonEmptyString(request.actor, "actor");
  const idempotencyKey = requireNonEmptyString(
    request.idempotencyKey,
    "idempotencyKey",
  );
  if (!isNonNegativeInt(request.expectedRevision)) {
    throw new KernelError(
      "INVALID_REQUEST",
      "expectedRevision must be a non-negative integer",
    );
  }
  const record = taskRecordSchema.parse(request.record);
  const evidence = requireEvidence(request.evidence, "evidence");

  return withKernelLock(dir, () => {
    const current = readKernelUnlocked(dir);
    const prior = current.kernel.audit.find(
      (event) => event.idempotencyKey === idempotencyKey,
    );
    if (prior) {
      if (!fs.existsSync(path.join(dir, "task.json")) && current.kernel.projection) {
        return commitKernelAndProject(dir, current.kernel);
      }
      return {
        ...current,
        idempotent: true,
        audit: prior,
        projected: true,
      };
    }
    expectRevision(current.kernel, request.expectedRevision);
    const extras = mergeExtras(
      current.kernel.projection?.extras ?? {},
      request.extras,
      record,
      "archive",
    );
    assertFullQualityForPhase(dir, extras, "archive");
    const hops = hopsToClose(current.kernel.phase);
    const hopped = hopKernelSnapshot(current.kernel, hops, {
      actor,
      idempotencyKey,
      evidence,
    });
    const next = attachProjection(
      hopped.snapshot,
      record,
      extras,
      "completed",
    );
    const result = commitKernelAndProject(dir, next);
    return { ...result, audit: hopped.audit, idempotent: hopped.idempotent };
  });
}

function mergeCanonicalRecord(
  base: TrellisTaskRecord,
  patch: unknown,
): TrellisTaskRecord {
  if (patch === undefined || patch === null) return base;
  if (!isPlainObject(patch)) {
    throw new KernelError("INVALID_REQUEST", "record must be a JSON object");
  }
  const merged: Record<string, unknown> = { ...base };
  for (const field of TASK_RECORD_FIELD_ORDER) {
    if (!(field in patch)) continue;
    if (field === "meta" && isPlainObject(patch.meta) && isPlainObject(base.meta)) {
      merged.meta = { ...base.meta, ...patch.meta };
      continue;
    }
    merged[field] = patch[field];
  }
  try {
    return taskRecordSchema.parse(merged);
  } catch (err) {
    throw new KernelError(
      "INVALID_REQUEST",
      `record is not a canonical task.json shape: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }
}

function assertNoLifecycleStatusHop(from: string, to: string): void {
  if (from === to) return;
  throw new KernelError(
    "INVALID_TRANSITION",
    `Kernel patch cannot change status (${from} -> ${to}); use start or archive`,
  );
}

function currentProjectionRecord(
  dir: string,
  current: KernelReadResult,
): TrellisTaskRecord {
  if (current.kernel.projection?.record) {
    return current.kernel.projection.record;
  }
  return loadTaskRecord({ taskDir: dir });
}

export function applyKernelPatch(
  request: KernelPatchRequest,
): KernelCommandResult {
  validateTransitionHooks(request);
  const dir = resolveTaskDir(request.taskDir, request.cwd);
  const actor = requireNonEmptyString(request.actor, "actor");
  const idempotencyKey = requireNonEmptyString(
    request.idempotencyKey,
    "idempotencyKey",
  );
  if (!isNonNegativeInt(request.expectedRevision)) {
    throw new KernelError(
      "INVALID_REQUEST",
      "expectedRevision must be a non-negative integer",
    );
  }
  if (request.record === undefined && request.extras === undefined) {
    throw new KernelError(
      "INVALID_REQUEST",
      "patch requires record and/or extras",
    );
  }
  const extrasPatch =
    request.extras === undefined ? undefined : cloneJsonObject(request.extras);
  const evidence = requireEvidence(request.evidence, "evidence");

  return withKernelLock(dir, () => {
    const current = readKernelUnlocked(dir);
    const prior = current.kernel.audit.find(
      (event) => event.idempotencyKey === idempotencyKey,
    );
    if (prior) {
      if (!fs.existsSync(path.join(dir, "task.json")) && current.kernel.projection) {
        return commitKernelAndProject(dir, current.kernel);
      }
      return {
        ...current,
        idempotent: true,
        audit: prior,
        projected: true,
      };
    }
    expectRevision(current.kernel, request.expectedRevision);

    const baseRecord = currentProjectionRecord(dir, current);
    const nextRecord = mergeCanonicalRecord(baseRecord, request.record);
    assertNoLifecycleStatusHop(baseRecord.status, nextRecord.status);

    const baseExtras = cloneJsonObject(current.kernel.projection?.extras ?? {});
    const extras =
      extrasPatch === undefined ? baseExtras : { ...baseExtras, ...extrasPatch };
    normalizeRequiredControlsInExtras(extras);
    normalizeStage5InExtrasAndAssert(extras, nextRecord, "patch");
    normalizeStage6InExtrasAndAssert(extras, "patch");

    const hopped = hopKernelSnapshot(current.kernel, [], {
      actor,
      idempotencyKey,
      evidence,
    });
    const next = attachProjection(
      hopped.snapshot,
      nextRecord,
      extras,
      nextRecord.status,
    );
    const result = commitKernelAndProject(dir, next);
    return { ...result, audit: hopped.audit, idempotent: false };
  });
}
