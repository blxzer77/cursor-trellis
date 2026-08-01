/** RPC-FULL CORE wire types (protocol v1). See `.cstl/spec/Trellis/framework/rpc-full-core.md`. */

import type { RpcErrorBody } from "./errors.js";

export const RPC_PROTOCOL_VERSION = 1 as const;

export const RPC_ADDRESS_KINDS = [
  "worker",
  "session",
  "cli",
  "sdk",
  "broker",
] as const;

export type RpcAddressKind = (typeof RPC_ADDRESS_KINDS)[number];

export interface RpcAddress {
  kind: RpcAddressKind;
  id: string;
}

export const RPC_MESSAGE_TYPES = [
  "req",
  "res",
  "event",
  "ack",
  "heartbeat",
] as const;

export type RpcMessageType = (typeof RPC_MESSAGE_TYPES)[number];

export const RPC_METHODS = [
  "register",
  "heartbeat",
  "send",
  "request",
  "ack",
  "subscribe",
  "publish",
  "status",
] as const;

export type RpcMethod = (typeof RPC_METHODS)[number];

export const RPC_EVENT_NAMES = [
  "trellis.child.state",
  "trellis.gate.pending",
  "trellis.unit.ready",
  "trellis.campaign.topic",
] as const;

export type RpcEventName = (typeof RPC_EVENT_NAMES)[number];

/** Methods that must never be executed by the broker (HITL non-bypass). */
export const RPC_HITL_FORBIDDEN_METHODS = [
  "trellis.approveGate",
  "trellis.startExecution",
  "trellis.integrateChild",
] as const;

export type RpcHitlForbiddenMethod = (typeof RPC_HITL_FORBIDDEN_METHODS)[number];

export interface RpcEnvelope {
  v: typeof RPC_PROTOCOL_VERSION;
  id: string;
  type: RpcMessageType;
  method?: string;
  event?: string;
  from: RpcAddress;
  to?: RpcAddress | null;
  campaignId?: string | null;
  correlationId?: string | null;
  topic?: string | null;
  ts: string;
  payload: Record<string, unknown>;
  error?: RpcErrorBody | null;
}

export interface RpcRegisterPayload {
  kind: RpcAddressKind;
  id: string;
  campaignId?: string;
  token?: string;
}

export interface RpcSendPayload {
  body: Record<string, unknown>;
}

export interface RpcStatusClient {
  address: RpcAddress;
  campaignId?: string;
  lastSeenAt: string;
}

export interface RpcStatusSnapshot {
  protocolVersion: typeof RPC_PROTOCOL_VERSION;
  clients: RpcStatusClient[];
  topics: string[];
  auditCount: number;
}
