import { randomUUID } from "node:crypto";

import {
  RPC_PROTOCOL_VERSION,
  parseRpcAddress,
  type RpcAddress,
  type RpcAddressKind,
  type RpcEnvelope,
} from "@blxzer/cursor-trellis-core/rpc";

export const DEFAULT_RPC_URL = "http://127.0.0.1:7843";

export function resolveRpcUrl(explicit?: string): string {
  const fromArg = explicit?.trim();
  if (fromArg) return fromArg;
  const fromEnv = process.env.TRELLIS_RPC_URL?.trim();
  if (fromEnv) return fromEnv;
  return DEFAULT_RPC_URL;
}

export function resolveRpcToken(explicit?: string): string | undefined {
  const fromArg = explicit?.trim();
  if (fromArg) return fromArg;
  const fromEnv = process.env.TRELLIS_RPC_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  return undefined;
}

/** Parse `kind:id` address strings. */
export function parseAddressArg(value: string): RpcAddress {
  const idx = value.indexOf(":");
  if (idx <= 0 || idx === value.length - 1) {
    throw new Error(
      `Invalid address '${value}'. Expected kind:id (e.g. worker:w1)`,
    );
  }
  return parseRpcAddress({
    kind: value.slice(0, idx),
    id: value.slice(idx + 1),
  });
}

export function formatAddress(address: RpcAddress): string {
  return `${address.kind}:${address.id}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function postRpc(
  url: string,
  body: Record<string, unknown>,
): Promise<RpcEnvelope> {
  const res = await fetch(`${url.replace(/\/$/, "")}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as RpcEnvelope;
  return json;
}

export async function getJson(url: string, path: string): Promise<unknown> {
  const res = await fetch(`${url.replace(/\/$/, "")}${path}`);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${path}`);
  }
  return res.json();
}

export function buildReq(options: {
  method: string;
  from: RpcAddress;
  to?: RpcAddress | null;
  topic?: string | null;
  campaignId?: string | null;
  correlationId?: string | null;
  payload?: Record<string, unknown>;
  token?: string;
}): Record<string, unknown> {
  const payload = { ...(options.payload ?? {}) };
  if (options.token !== undefined) {
    payload.token = options.token;
  }
  return {
    v: RPC_PROTOCOL_VERSION,
    id: randomUUID(),
    type: "req",
    method: options.method,
    from: options.from,
    ...(options.to !== undefined ? { to: options.to } : {}),
    ...(options.topic !== undefined ? { topic: options.topic } : {}),
    ...(options.campaignId !== undefined
      ? { campaignId: options.campaignId }
      : {}),
    ...(options.correlationId !== undefined
      ? { correlationId: options.correlationId }
      : {}),
    ts: nowIso(),
    payload,
  };
}

export async function rpcRegister(options: {
  url: string;
  kind: RpcAddressKind;
  id: string;
  campaignId?: string;
  token?: string;
}): Promise<RpcEnvelope> {
  const from = { kind: options.kind, id: options.id };
  return postRpc(
    options.url,
    buildReq({
      method: "register",
      from,
      campaignId: options.campaignId ?? null,
      token: options.token,
      payload: {
        kind: options.kind,
        id: options.id,
        ...(options.campaignId ? { campaignId: options.campaignId } : {}),
      },
    }),
  );
}

export async function rpcSend(options: {
  url: string;
  from: RpcAddress;
  to: RpcAddress;
  body: Record<string, unknown>;
  token?: string;
}): Promise<RpcEnvelope> {
  return postRpc(
    options.url,
    buildReq({
      method: "send",
      from: options.from,
      to: options.to,
      token: options.token,
      payload: { body: options.body },
    }),
  );
}

export async function rpcSubscribe(options: {
  url: string;
  from: RpcAddress;
  topic: string;
  token?: string;
}): Promise<RpcEnvelope> {
  return postRpc(
    options.url,
    buildReq({
      method: "subscribe",
      from: options.from,
      topic: options.topic,
      token: options.token,
      payload: {},
    }),
  );
}

export async function rpcPublish(options: {
  url: string;
  from: RpcAddress;
  topic: string;
  body: Record<string, unknown>;
  campaignId?: string;
  token?: string;
}): Promise<RpcEnvelope> {
  return postRpc(
    options.url,
    buildReq({
      method: "publish",
      from: options.from,
      topic: options.topic,
      campaignId: options.campaignId ?? null,
      token: options.token,
      payload: { body: options.body },
    }),
  );
}

export function parseJsonObject(raw: string, flag: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`${flag} must be valid JSON object`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${flag} must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

export function printEnvelope(envelope: RpcEnvelope, json: boolean): void {
  if (json) {
    console.log(JSON.stringify(envelope, null, 2));
    return;
  }
  if (envelope.error) {
    console.error(
      `RPC error ${envelope.error.code}: ${envelope.error.message}`,
    );
    return;
  }
  console.log(JSON.stringify(envelope.payload, null, 2));
}

export function exitForEnvelope(envelope: RpcEnvelope): number {
  return envelope.error ? 1 : 0;
}
