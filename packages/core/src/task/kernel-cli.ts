/**
 * Stateless Kernel JSON CLI (stdin → stdout). This is the Stage 1 write
 * channel for core Task state. Python/old callers stay on the read
 * projection until Stage 2 Writer Strangler.
 */

import { isPlainObject } from "./schema.js";
import {
  KernelError,
  isKernelPhase,
  isNonNegativeInt,
  type KernelErrorCode,
  type TransitionRequest,
} from "./kernel-contract.js";
import {
  applyKernelTransition,
  readKernel,
  type KernelReadResult,
  type KernelTransitionResult,
} from "./kernel-store.js";

export type KernelCliSuccess =
  | ({ ok: true; op: "read" } & KernelReadResult)
  | ({ ok: true; op: "transition" } & KernelTransitionResult);

export interface KernelCliFailure {
  ok: false;
  error: { code: KernelErrorCode | "INVALID_REQUEST"; message: string };
}

export type KernelCliResponse = KernelCliSuccess | KernelCliFailure;

export interface KernelCliIo {
  stdin?: NodeJS.ReadableStream;
  stdout?: NodeJS.WritableStream;
  cwd?: string;
}

export function handleKernelRequest(
  input: unknown,
  options: { cwd?: string } = {},
): KernelCliResponse {
  try {
    return dispatchKernelRequest(input, options.cwd);
  } catch (err) {
    return toFailure(err);
  }
}

export async function runKernelJsonCli(io: KernelCliIo = {}): Promise<number> {
  const stdin = io.stdin ?? process.stdin;
  const stdout = io.stdout ?? process.stdout;
  const raw = (await readAll(stdin)).trim();
  let parsed: unknown;
  try {
    parsed = raw === "" ? {} : JSON.parse(raw);
  } catch (err) {
    const response: KernelCliFailure = {
      ok: false,
      error: {
        code: "INVALID_REQUEST",
        message: `stdin is not JSON: ${err instanceof Error ? err.message : String(err)}`,
      },
    };
    stdout.write(`${JSON.stringify(response)}\n`);
    return 1;
  }
  const response = handleKernelRequest(parsed, { cwd: io.cwd });
  stdout.write(`${JSON.stringify(response)}\n`);
  return response.ok ? 0 : 1;
}

function dispatchKernelRequest(
  input: unknown,
  cwd: string | undefined,
): KernelCliSuccess {
  if (!isPlainObject(input)) {
    throw new KernelError("INVALID_REQUEST", "request must be a JSON object");
  }
  const op = input.op;
  if (op === "read") {
    const taskDir = requireTaskDir(input.taskDir);
    const result = readKernel({
      taskDir,
      cwd: optionalCwd(input.cwd, cwd),
    });
    return { ok: true, op: "read", ...result };
  }
  if (op === "transition") {
    const request = parseTransitionRequest(input, cwd);
    const result = applyKernelTransition(request);
    return { ok: true, op: "transition", ...result };
  }
  throw new KernelError(
    "INVALID_REQUEST",
    `unsupported Kernel op: ${String(op)}`,
  );
}

function parseTransitionRequest(
  input: Record<string, unknown>,
  cwd: string | undefined,
): TransitionRequest {
  if (!isKernelPhase(input.targetPhase)) {
    throw new KernelError("INVALID_REQUEST", "targetPhase is not a Kernel phase");
  }
  if (!isNonNegativeInt(input.expectedRevision)) {
    throw new KernelError(
      "INVALID_REQUEST",
      "expectedRevision must be a non-negative integer",
    );
  }
  const request: TransitionRequest = {
    taskDir: requireTaskDir(input.taskDir),
    expectedRevision: input.expectedRevision,
    targetPhase: input.targetPhase,
    actor: requireString(input.actor, "actor"),
    idempotencyKey: requireString(input.idempotencyKey, "idempotencyKey"),
    cwd: optionalCwd(input.cwd, cwd),
  };
  if (input.evidence !== undefined) {
    request.evidence = requireString(input.evidence, "evidence");
  }
  if (input.gate !== undefined) {
    request.gate = input.gate;
  }
  if (input.policy !== undefined) {
    request.policy = input.policy;
  }
  return request;
}

function requireTaskDir(value: unknown): string {
  return requireString(value, "taskDir");
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new KernelError("INVALID_REQUEST", `${field} must be a non-empty string`);
  }
  return value;
}

function optionalCwd(fromRequest: unknown, fallback: string | undefined): string | undefined {
  if (fromRequest === undefined || fromRequest === null) return fallback;
  if (typeof fromRequest !== "string" || fromRequest.trim() === "") {
    throw new KernelError("INVALID_REQUEST", "cwd must be a non-empty string");
  }
  return fromRequest;
}

function toFailure(err: unknown): KernelCliFailure {
  if (err instanceof KernelError) {
    return { ok: false, error: { code: err.code, message: err.message } };
  }
  return {
    ok: false,
    error: {
      code: "INVALID_REQUEST",
      message: err instanceof Error ? err.message : String(err),
    },
  };
}

function readAll(stream: NodeJS.ReadableStream): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer | string) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });
    stream.on("end", () => {
      resolve(Buffer.concat(chunks).toString("utf-8"));
    });
    stream.on("error", reject);
  });
}
