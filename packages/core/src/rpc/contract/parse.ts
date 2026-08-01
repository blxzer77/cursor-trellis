import { parseRpcErrorBody, RpcError } from "./errors.js";
import {
  RPC_ADDRESS_KINDS,
  RPC_EVENT_NAMES,
  RPC_HITL_FORBIDDEN_METHODS,
  RPC_MESSAGE_TYPES,
  RPC_METHODS,
  RPC_PROTOCOL_VERSION,
  type RpcAddress,
  type RpcAddressKind,
  type RpcEnvelope,
  type RpcEventName,
  type RpcMessageType,
  type RpcMethod,
} from "./types.js";

const ADDRESS_KIND_SET: ReadonlySet<string> = new Set(RPC_ADDRESS_KINDS);
const MESSAGE_TYPE_SET: ReadonlySet<string> = new Set(RPC_MESSAGE_TYPES);
const METHOD_SET: ReadonlySet<string> = new Set(RPC_METHODS);
const EVENT_SET: ReadonlySet<string> = new Set(RPC_EVENT_NAMES);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireNonEmptyString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RpcError("RPC_BAD_ENVELOPE", `${field} must be a non-empty string`);
  }
  return value;
}

export function parseRpcAddress(value: unknown): RpcAddress {
  if (!isRecord(value)) {
    throw new RpcError("RPC_BAD_ENVELOPE", "address must be an object");
  }
  const kindRaw = requireNonEmptyString(value.kind, "address.kind");
  if (!ADDRESS_KIND_SET.has(kindRaw)) {
    throw new RpcError(
      "RPC_BAD_ENVELOPE",
      `Invalid address.kind: ${kindRaw}`,
    );
  }
  return {
    kind: kindRaw as RpcAddressKind,
    id: requireNonEmptyString(value.id, "address.id"),
  };
}

export function parseRpcMethod(value: unknown): RpcMethod {
  const method = requireNonEmptyString(value, "method");
  if (!METHOD_SET.has(method)) {
    throw new RpcError("RPC_UNKNOWN_METHOD", `Unknown RPC method: ${method}`, {
      method,
    });
  }
  return method as RpcMethod;
}

export function parseRpcEventName(value: unknown): RpcEventName {
  const event = requireNonEmptyString(value, "event");
  if (!EVENT_SET.has(event)) {
    throw new RpcError("RPC_BAD_ENVELOPE", `Unknown RPC event: ${event}`, {
      event,
    });
  }
  return event as RpcEventName;
}

export function isHitlForbiddenMethod(method: string): boolean {
  if ((RPC_HITL_FORBIDDEN_METHODS as readonly string[]).includes(method)) {
    return true;
  }
  return (
    method.startsWith("trellis.approve") ||
    method.startsWith("trellis.integrate") ||
    method.startsWith("trellis.startExecution")
  );
}

export function assertMethodAllowed(method: string): void {
  if (isHitlForbiddenMethod(method)) {
    throw new RpcError(
      "RPC_HITL_FORBIDDEN",
      `Broker must not auto-approve Trellis HITL gates via method '${method}'`,
      { method },
    );
  }
}

export function parseRpcEnvelope(value: unknown): RpcEnvelope {
  if (!isRecord(value)) {
    throw new RpcError("RPC_BAD_ENVELOPE", "envelope must be an object");
  }

  if (value.v !== RPC_PROTOCOL_VERSION) {
    throw new RpcError(
      "RPC_BAD_ENVELOPE",
      `Unsupported protocol version: ${String(value.v)}`,
      { expected: RPC_PROTOCOL_VERSION },
    );
  }

  const typeRaw = requireNonEmptyString(value.type, "type");
  if (!MESSAGE_TYPE_SET.has(typeRaw)) {
    throw new RpcError("RPC_BAD_ENVELOPE", `Invalid message type: ${typeRaw}`);
  }
  const type = typeRaw as RpcMessageType;

  const envelope: RpcEnvelope = {
    v: RPC_PROTOCOL_VERSION,
    id: requireNonEmptyString(value.id, "id"),
    type,
    from: parseRpcAddress(value.from),
    ts: requireNonEmptyString(value.ts, "ts"),
    payload: {},
  };

  if (value.method !== undefined && value.method !== null) {
    envelope.method = requireNonEmptyString(value.method, "method");
  }
  if (value.event !== undefined && value.event !== null) {
    envelope.event = requireNonEmptyString(value.event, "event");
  }
  if (value.to === null) {
    envelope.to = null;
  } else if (value.to !== undefined) {
    envelope.to = parseRpcAddress(value.to);
  }
  if (value.campaignId === null) {
    envelope.campaignId = null;
  } else if (value.campaignId !== undefined) {
    envelope.campaignId = requireNonEmptyString(value.campaignId, "campaignId");
  }
  if (value.correlationId === null) {
    envelope.correlationId = null;
  } else if (value.correlationId !== undefined) {
    envelope.correlationId = requireNonEmptyString(
      value.correlationId,
      "correlationId",
    );
  }
  if (value.topic === null) {
    envelope.topic = null;
  } else if (value.topic !== undefined) {
    envelope.topic = requireNonEmptyString(value.topic, "topic");
  }
  if (value.payload === undefined || value.payload === null) {
    envelope.payload = {};
  } else if (!isRecord(value.payload)) {
    throw new RpcError("RPC_BAD_ENVELOPE", "payload must be an object");
  } else {
    envelope.payload = value.payload;
  }
  if (value.error === null) {
    envelope.error = null;
  } else if (value.error !== undefined) {
    envelope.error = parseRpcErrorBody(value.error);
  }

  if (type === "req" || type === "res") {
    if (!envelope.method) {
      throw new RpcError(
        "RPC_BAD_ENVELOPE",
        `${type} messages require method`,
      );
    }
    if (type === "req") {
      assertMethodAllowed(envelope.method);
    }
  }
  if (type === "event") {
    if (!envelope.event) {
      throw new RpcError("RPC_BAD_ENVELOPE", "event messages require event");
    }
    parseRpcEventName(envelope.event);
  }

  return envelope;
}

export function addressKey(address: RpcAddress): string {
  return `${address.kind}:${address.id}`;
}
