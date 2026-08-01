import { randomUUID } from "node:crypto";

import { RpcAuditLog } from "./audit.js";
import type { RpcJournal } from "./journal.js";
import { RpcError } from "../contract/errors.js";
import {
  addressKey,
  assertMethodAllowed,
  isHitlForbiddenMethod,
  parseRpcAddress,
  parseRpcEnvelope,
} from "../contract/parse.js";
import { parseCampaignTopic } from "../contract/topics.js";
import {
  RPC_PROTOCOL_VERSION,
  type RpcAddress,
  type RpcEnvelope,
  type RpcEventName,
  type RpcStatusSnapshot,
} from "../contract/types.js";

export type RpcDeliveryListener = (
  address: RpcAddress,
  envelope: RpcEnvelope,
) => void;

export interface InProcessBrokerOptions {
  token?: string;
  requestTimeoutMs?: number;
  /** Drop clients that miss heartbeats; `0` disables. Default `30_000`. */
  heartbeatTimeoutMs?: number;
  heartbeatSweepIntervalMs?: number;
}

interface RegisteredClient {
  address: RpcAddress;
  campaignId?: string;
  lastSeenAt: string;
  inbox: RpcEnvelope[];
  topics: Set<string>;
}

interface PendingWaiter {
  resolve: (envelope: RpcEnvelope) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function brokerAddress(): RpcAddress {
  return { kind: "broker", id: "local" };
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  return randomUUID();
}

/** In-process RPC-FULL CORE broker (transport lives outside). */
export class InProcessBroker {
  readonly audit = new RpcAuditLog();
  private readonly clients = new Map<string, RegisteredClient>();
  private readonly waiters = new Map<string, PendingWaiter>();
  private readonly deliveryListeners = new Set<RpcDeliveryListener>();
  private readonly token: string | undefined;
  private readonly requestTimeoutMs: number;
  private readonly heartbeatTimeoutMs: number;
  private readonly heartbeatSweepIntervalMs: number;
  private journal: RpcJournal | undefined;
  private sweeper: ReturnType<typeof setInterval> | null = null;

  constructor(options: InProcessBrokerOptions = {}) {
    this.token = options.token;
    this.requestTimeoutMs = options.requestTimeoutMs ?? 2_000;
    this.heartbeatTimeoutMs = options.heartbeatTimeoutMs ?? 30_000;
    this.heartbeatSweepIntervalMs = options.heartbeatSweepIntervalMs ?? 1_000;
  }

  attachJournal(journal: RpcJournal): void {
    this.journal = journal;
  }

  onDeliver(listener: RpcDeliveryListener): () => void {
    this.deliveryListeners.add(listener);
    return () => this.deliveryListeners.delete(listener);
  }

  startHeartbeatSweeper(): void {
    if (this.sweeper || this.heartbeatTimeoutMs <= 0) return;
    this.sweeper = setInterval(() => {
      this.sweepExpired();
    }, this.heartbeatSweepIntervalMs);
    this.sweeper.unref?.();
  }

  stopHeartbeatSweeper(): void {
    if (!this.sweeper) return;
    clearInterval(this.sweeper);
    this.sweeper = null;
  }

  sweepExpired(nowMs = Date.now()): string[] {
    if (this.heartbeatTimeoutMs <= 0) return [];
    const removed: string[] = [];
    for (const [key, client] of this.clients) {
      const last = Date.parse(client.lastSeenAt);
      if (Number.isNaN(last) || nowMs - last <= this.heartbeatTimeoutMs) {
        continue;
      }
      this.clients.delete(key);
      removed.push(key);
      this.recordAudit("expire", {
        address: client.address,
        lastSeenAt: client.lastSeenAt,
      });
    }
    return removed;
  }

  requireRegistered(address: RpcAddress): void {
    this.requireClient(address);
  }

  emitAdvisory(
    from: RpcAddress,
    event: RpcEventName,
    payload: Record<string, unknown>,
    options: { to?: RpcAddress; topic?: string; campaignId?: string } = {},
  ): RpcEnvelope {
    return this.handle({
      v: RPC_PROTOCOL_VERSION,
      id: newId(),
      type: "event",
      event,
      from,
      to: options.to ?? null,
      topic: options.topic ?? null,
      campaignId: options.campaignId ?? null,
      ts: nowIso(),
      payload,
    });
  }

  status(): RpcStatusSnapshot {
    return {
      protocolVersion: RPC_PROTOCOL_VERSION,
      clients: [...this.clients.values()].map((c) => ({
        address: c.address,
        ...(c.campaignId !== undefined ? { campaignId: c.campaignId } : {}),
        lastSeenAt: c.lastSeenAt,
      })),
      topics: [
        ...new Set([...this.clients.values()].flatMap((c) => [...c.topics])),
      ].sort(),
      auditCount: this.audit.size,
    };
  }

  handle(raw: unknown): RpcEnvelope {
    let envelope: RpcEnvelope;
    try {
      envelope = parseRpcEnvelope(raw);
    } catch (error) {
      return this.errorResponse(raw, error);
    }

    try {
      if (envelope.method && isHitlForbiddenMethod(envelope.method)) {
        assertMethodAllowed(envelope.method);
      }

      switch (envelope.type) {
        case "req":
          return this.handleRequest(envelope);
        case "res":
          return this.handleResponse(envelope);
        case "ack":
          return this.handleAck(envelope);
        case "heartbeat":
          return this.handleHeartbeat(envelope);
        case "event":
          return this.handleEvent(envelope);
        default:
          throw new RpcError(
            "RPC_BAD_ENVELOPE",
            `Unsupported message type: ${envelope.type}`,
          );
      }
    } catch (error) {
      return this.errorResponse(envelope, error);
    }
  }

  poll(address: RpcAddress): RpcEnvelope | undefined {
    return this.requireClient(address).inbox.shift();
  }

  drain(address: RpcAddress): RpcEnvelope[] {
    const client = this.requireClient(address);
    const out = [...client.inbox];
    client.inbox.length = 0;
    return out;
  }

  async request(
    from: RpcAddress,
    to: RpcAddress,
    peerMethod: string,
    payload: Record<string, unknown> = {},
    timeoutMs = this.requestTimeoutMs,
  ): Promise<RpcEnvelope> {
    assertMethodAllowed(peerMethod);
    const correlationId = newId();
    const req: RpcEnvelope = {
      v: RPC_PROTOCOL_VERSION,
      id: newId(),
      type: "req",
      method: "request",
      from,
      to,
      correlationId,
      ts: nowIso(),
      payload: { peerMethod, ...payload },
    };

    const responsePromise = new Promise<RpcEnvelope>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(correlationId);
        reject(
          new RpcError(
            "RPC_TIMEOUT",
            `Timed out waiting for correlationId ${correlationId}`,
            { correlationId },
          ),
        );
      }, timeoutMs);
      this.waiters.set(correlationId, { resolve, reject, timer });
    });

    const ackOrErr = this.handle(req);
    if (ackOrErr.error) {
      const waiter = this.waiters.get(correlationId);
      if (waiter) {
        clearTimeout(waiter.timer);
        this.waiters.delete(correlationId);
      }
      throw new RpcError(ackOrErr.error.code, ackOrErr.error.message, {
        ...(ackOrErr.error.details ?? {}),
      });
    }

    return responsePromise;
  }

  respond(
    from: RpcAddress,
    to: RpcAddress,
    correlationId: string,
    payload: Record<string, unknown> = {},
    error?: RpcError,
  ): RpcEnvelope {
    return this.handle({
      v: RPC_PROTOCOL_VERSION,
      id: newId(),
      type: "res",
      method: "request",
      from,
      to,
      correlationId,
      ts: nowIso(),
      payload,
      ...(error ? { error: error.toBody() } : { error: null }),
    });
  }

  private handleRequest(envelope: RpcEnvelope): RpcEnvelope {
    const method = envelope.method;
    if (!method) {
      throw new RpcError("RPC_BAD_ENVELOPE", "req messages require method");
    }
    assertMethodAllowed(method);

    switch (method) {
      case "register":
        return this.register(envelope);
      case "heartbeat":
        return this.handleHeartbeat(envelope);
      case "send":
        return this.routeSend(envelope);
      case "request":
        return this.routeRequest(envelope);
      case "ack":
        return this.handleAck(envelope);
      case "subscribe":
        return this.subscribe(envelope);
      case "publish":
        return this.publish(envelope);
      case "status":
        return this.statusResponse(envelope);
      default:
        throw new RpcError(
          "RPC_UNKNOWN_METHOD",
          `Unknown RPC method: ${method}`,
          { method },
        );
    }
  }

  private register(envelope: RpcEnvelope): RpcEnvelope {
    this.assertAuthorized(envelope);
    const address = parseRpcAddress({
      kind: envelope.payload.kind,
      id: envelope.payload.id,
    });

    const campaignId =
      typeof envelope.payload.campaignId === "string"
        ? envelope.payload.campaignId
        : typeof envelope.campaignId === "string"
          ? envelope.campaignId
          : undefined;

    const key = addressKey(address);
    const existing = this.clients.get(key);
    const client: RegisteredClient = existing ?? {
      address,
      inbox: [],
      topics: new Set(),
      lastSeenAt: nowIso(),
    };
    client.lastSeenAt = nowIso();
    if (campaignId !== undefined) client.campaignId = campaignId;
    this.clients.set(key, client);
    this.recordAudit("register", { address, campaignId: campaignId ?? null });

    return this.okResponse(envelope, {
      address,
      ...(campaignId !== undefined ? { campaignId } : {}),
    });
  }

  private handleHeartbeat(envelope: RpcEnvelope): RpcEnvelope {
    this.assertAuthorized(envelope);
    const client = this.requireClient(envelope.from);
    client.lastSeenAt = nowIso();
    this.recordAuditEnvelope("heartbeat", envelope);
    return this.okResponse(envelope, {
      ok: true,
      lastSeenAt: client.lastSeenAt,
    });
  }

  private routeSend(envelope: RpcEnvelope): RpcEnvelope {
    this.assertAuthorized(envelope);
    this.requireClient(envelope.from);
    if (!envelope.to) {
      throw new RpcError("RPC_BAD_ENVELOPE", "send requires to");
    }
    const target = this.requireClient(envelope.to);
    const inboxMsg: RpcEnvelope = {
      v: RPC_PROTOCOL_VERSION,
      id: newId(),
      type: "req",
      method: "send",
      from: envelope.from,
      to: envelope.to,
      correlationId: envelope.correlationId ?? null,
      campaignId: envelope.campaignId ?? null,
      ts: nowIso(),
      payload: envelope.payload,
    };
    this.enqueue(target, inboxMsg);
    this.recordAuditEnvelope("send", inboxMsg);
    return this.okResponse(envelope, {
      delivered: true,
      messageId: inboxMsg.id,
    });
  }

  private routeRequest(envelope: RpcEnvelope): RpcEnvelope {
    this.assertAuthorized(envelope);
    this.requireClient(envelope.from);
    if (!envelope.to) {
      throw new RpcError("RPC_BAD_ENVELOPE", "request requires to");
    }
    if (!envelope.correlationId) {
      throw new RpcError("RPC_BAD_ENVELOPE", "request requires correlationId");
    }
    const peerMethod = envelope.payload.peerMethod;
    if (typeof peerMethod === "string") {
      assertMethodAllowed(peerMethod);
    }
    this.enqueue(this.requireClient(envelope.to), envelope);
    this.recordAuditEnvelope("request", envelope);
    return this.okResponse(envelope, { queued: true });
  }

  private handleResponse(envelope: RpcEnvelope): RpcEnvelope {
    this.assertAuthorized(envelope);
    this.requireClient(envelope.from);
    if (!envelope.correlationId) {
      throw new RpcError("RPC_BAD_ENVELOPE", "res requires correlationId");
    }
    const waiter = this.waiters.get(envelope.correlationId);
    if (waiter) {
      clearTimeout(waiter.timer);
      this.waiters.delete(envelope.correlationId);
      waiter.resolve(envelope);
    } else if (envelope.to) {
      const target = this.clients.get(addressKey(envelope.to));
      if (target) this.enqueue(target, envelope);
    }
    this.recordAuditEnvelope("res", envelope);
    return this.okResponse(envelope, { accepted: true });
  }

  private handleAck(envelope: RpcEnvelope): RpcEnvelope {
    this.assertAuthorized(envelope);
    this.requireClient(envelope.from);
    this.recordAuditEnvelope("ack", envelope);
    return this.okResponse(envelope, { ok: true });
  }

  private subscribe(envelope: RpcEnvelope): RpcEnvelope {
    this.assertAuthorized(envelope);
    const client = this.requireClient(envelope.from);
    const topic =
      typeof envelope.topic === "string"
        ? envelope.topic
        : typeof envelope.payload.topic === "string"
          ? envelope.payload.topic
          : null;
    if (!topic) {
      throw new RpcError("RPC_BAD_ENVELOPE", "subscribe requires topic");
    }
    parseCampaignTopic(topic);
    client.topics.add(topic);
    this.recordAudit("subscribe", { address: client.address, topic });
    return this.okResponse(envelope, { topic, subscribed: true });
  }

  private publish(envelope: RpcEnvelope): RpcEnvelope {
    this.assertAuthorized(envelope);
    this.requireClient(envelope.from);
    const topic =
      typeof envelope.topic === "string"
        ? envelope.topic
        : typeof envelope.payload.topic === "string"
          ? envelope.payload.topic
          : null;
    if (!topic) {
      throw new RpcError("RPC_BAD_ENVELOPE", "publish requires topic");
    }
    parseCampaignTopic(topic);
    const event: RpcEnvelope = {
      v: RPC_PROTOCOL_VERSION,
      id: newId(),
      type: "event",
      event: "trellis.campaign.topic",
      from: envelope.from,
      to: null,
      campaignId: envelope.campaignId ?? null,
      topic,
      correlationId: envelope.correlationId ?? null,
      ts: nowIso(),
      payload: envelope.payload.body
        ? { body: envelope.payload.body }
        : { ...envelope.payload, topic },
    };
    let delivered = 0;
    for (const client of this.clients.values()) {
      if (!client.topics.has(topic)) continue;
      if (addressKey(client.address) === addressKey(envelope.from)) continue;
      this.enqueue(client, event);
      delivered += 1;
    }
    this.recordAudit("publish", { topic, delivered, from: envelope.from });
    return this.okResponse(envelope, { topic, delivered });
  }

  private handleEvent(envelope: RpcEnvelope): RpcEnvelope {
    this.assertAuthorized(envelope);
    this.requireClient(envelope.from);
    if (envelope.to) {
      this.enqueue(this.requireClient(envelope.to), envelope);
    } else if (envelope.topic) {
      parseCampaignTopic(envelope.topic);
      for (const client of this.clients.values()) {
        if (!client.topics.has(envelope.topic)) continue;
        if (addressKey(client.address) === addressKey(envelope.from)) continue;
        this.enqueue(client, envelope);
      }
    }
    this.recordAuditEnvelope("event", envelope);
    return this.okResponse(envelope, { accepted: true });
  }

  private statusResponse(envelope: RpcEnvelope): RpcEnvelope {
    this.assertAuthorized(envelope);
    this.requireClient(envelope.from);
    return this.okResponse(
      envelope,
      this.status() as unknown as Record<string, unknown>,
    );
  }

  private assertAuthorized(envelope: RpcEnvelope): void {
    if (this.token === undefined) return;
    const provided =
      typeof envelope.payload.token === "string"
        ? envelope.payload.token
        : undefined;
    if (provided !== this.token) {
      throw new RpcError(
        "RPC_UNAUTHORIZED",
        "Invalid or missing local RPC token",
      );
    }
  }

  private requireClient(address: RpcAddress): RegisteredClient {
    const client = this.clients.get(addressKey(address));
    if (!client) {
      throw new RpcError(
        "RPC_NOT_REGISTERED",
        `Client not registered: ${addressKey(address)}`,
      );
    }
    return client;
  }

  private enqueue(client: RegisteredClient, envelope: RpcEnvelope): void {
    client.inbox.push(envelope);
    for (const listener of this.deliveryListeners) {
      listener(client.address, envelope);
    }
  }

  private recordAudit(kind: string, detail: Record<string, unknown>): void {
    const entry = this.audit.append(kind, detail);
    this.journal?.append(entry);
  }

  private recordAuditEnvelope(kind: string, envelope: RpcEnvelope): void {
    const entry = this.audit.appendEnvelope(kind, envelope);
    this.journal?.append(entry);
  }

  private okResponse(
    request: RpcEnvelope,
    payload: Record<string, unknown>,
  ): RpcEnvelope {
    return {
      v: RPC_PROTOCOL_VERSION,
      id: newId(),
      type: "res",
      method: request.method ?? "status",
      from: brokerAddress(),
      to: request.from,
      correlationId: request.correlationId ?? request.id,
      campaignId: request.campaignId ?? null,
      ts: nowIso(),
      payload,
      error: null,
    };
  }

  private errorResponse(raw: unknown, error: unknown): RpcEnvelope {
    const rpcError =
      error instanceof RpcError
        ? error
        : new RpcError(
            "RPC_INTERNAL",
            error instanceof Error ? error.message : String(error),
          );
    this.recordAudit("error", { ...rpcError.toBody() });

    let to: RpcAddress = brokerAddress();
    let correlationId: string | null = null;
    let method = "status";
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      const r = raw as Record<string, unknown>;
      try {
        if (r.from) to = parseRpcAddress(r.from);
      } catch {
        // keep broker address
      }
      if (typeof r.correlationId === "string") correlationId = r.correlationId;
      else if (typeof r.id === "string") correlationId = r.id;
      if (typeof r.method === "string") method = r.method;
    }

    return {
      v: RPC_PROTOCOL_VERSION,
      id: newId(),
      type: "res",
      method,
      from: brokerAddress(),
      to,
      correlationId,
      ts: nowIso(),
      payload: {},
      error: rpcError.toBody(),
    };
  }
}
