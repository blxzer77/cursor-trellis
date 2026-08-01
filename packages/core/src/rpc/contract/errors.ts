/** RPC-FULL CORE error codes (protocol v1). */

export const RPC_ERROR_CODES = [
  "RPC_BAD_ENVELOPE",
  "RPC_UNKNOWN_METHOD",
  "RPC_NOT_REGISTERED",
  "RPC_TIMEOUT",
  "RPC_UNAUTHORIZED",
  "RPC_HITL_FORBIDDEN",
  "RPC_INTERNAL",
] as const;

export type RpcErrorCode = (typeof RPC_ERROR_CODES)[number];

export const RPC_ERROR_CODE_SET: ReadonlySet<string> = new Set(RPC_ERROR_CODES);

export interface RpcErrorBody {
  code: RpcErrorCode;
  message: string;
  details?: Record<string, unknown>;
}

export class RpcError extends Error {
  readonly code: RpcErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: RpcErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "RpcError";
    this.code = code;
    if (details !== undefined) this.details = details;
  }

  toBody(): RpcErrorBody {
    const body: RpcErrorBody = { code: this.code, message: this.message };
    if (this.details !== undefined) body.details = this.details;
    return body;
  }
}

export function parseRpcErrorCode(value: unknown): RpcErrorCode {
  if (typeof value !== "string" || !RPC_ERROR_CODE_SET.has(value)) {
    throw new RpcError(
      "RPC_BAD_ENVELOPE",
      `Invalid RPC error code: ${String(value)}`,
    );
  }
  return value as RpcErrorCode;
}

export function parseRpcErrorBody(value: unknown): RpcErrorBody {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new RpcError("RPC_BAD_ENVELOPE", "error must be an object");
  }
  const raw = value as Record<string, unknown>;
  const code = parseRpcErrorCode(raw.code);
  if (typeof raw.message !== "string" || raw.message.length === 0) {
    throw new RpcError(
      "RPC_BAD_ENVELOPE",
      "error.message must be a non-empty string",
    );
  }
  const body: RpcErrorBody = { code, message: raw.message };
  if (raw.details !== undefined) {
    if (
      raw.details === null ||
      typeof raw.details !== "object" ||
      Array.isArray(raw.details)
    ) {
      throw new RpcError("RPC_BAD_ENVELOPE", "error.details must be an object");
    }
    body.details = raw.details as Record<string, unknown>;
  }
  return body;
}
