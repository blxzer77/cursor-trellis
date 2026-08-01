import { describe, expect, it } from "vitest";

import {
  InProcessBroker,
  RPC_PROTOCOL_VERSION,
  RpcError,
  assertMethodAllowed,
  campaignBroadcastTopic,
  campaignStageTopic,
  isHitlForbiddenMethod,
  parseCampaignTopic,
  parseRpcEnvelope,
} from "../../src/rpc/index.js";

function baseEnvelope(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    v: RPC_PROTOCOL_VERSION,
    id: "msg-1",
    type: "req",
    method: "status",
    from: { kind: "cli", id: "c1" },
    ts: "2026-08-01T00:00:00.000Z",
    payload: {},
    ...overrides,
  };
}

describe("rpc contract parse", () => {
  it("accepts a valid v1 envelope", () => {
    const env = parseRpcEnvelope(baseEnvelope());
    expect(env.v).toBe(1);
    expect(env.method).toBe("status");
    expect(env.from).toEqual({ kind: "cli", id: "c1" });
  });

  it("rejects unknown protocol version", () => {
    expect(() => parseRpcEnvelope(baseEnvelope({ v: 99 }))).toThrow(RpcError);
    try {
      parseRpcEnvelope(baseEnvelope({ v: 99 }));
    } catch (error) {
      expect(error).toBeInstanceOf(RpcError);
      expect((error as RpcError).code).toBe("RPC_BAD_ENVELOPE");
    }
  });

  it("rejects invalid address kind", () => {
    expect(() =>
      parseRpcEnvelope(baseEnvelope({ from: { kind: "alien", id: "x" } })),
    ).toThrow(/address\.kind/);
  });

  it("requires event name on event messages", () => {
    expect(() =>
      parseRpcEnvelope(
        baseEnvelope({ type: "event", method: undefined, event: undefined }),
      ),
    ).toThrow(/require event/);
  });

  it("accepts known advisory events", () => {
    const env = parseRpcEnvelope(
      baseEnvelope({
        type: "event",
        method: undefined,
        event: "trellis.gate.pending",
        payload: { gate: "start-execution" },
      }),
    );
    expect(env.event).toBe("trellis.gate.pending");
  });
});

describe("rpc HITL non-bypass", () => {
  it("flags forbidden methods", () => {
    expect(isHitlForbiddenMethod("trellis.approveGate")).toBe(true);
    expect(isHitlForbiddenMethod("trellis.startExecution")).toBe(true);
    expect(isHitlForbiddenMethod("trellis.integrateChild")).toBe(true);
    expect(isHitlForbiddenMethod("trellis.approveAnything")).toBe(true);
    expect(isHitlForbiddenMethod("status")).toBe(false);
  });

  it("assertMethodAllowed throws RPC_HITL_FORBIDDEN", () => {
    expect(() => assertMethodAllowed("trellis.integrateChild")).toThrow(
      RpcError,
    );
    try {
      assertMethodAllowed("trellis.integrateChild");
    } catch (error) {
      expect((error as RpcError).code).toBe("RPC_HITL_FORBIDDEN");
    }
  });

  it("broker returns RPC_HITL_FORBIDDEN for gate bypass req", () => {
    const broker = new InProcessBroker();
    const res = broker.handle(
      baseEnvelope({
        method: "trellis.approveGate",
        payload: { gate: "start-execution" },
      }),
    );
    expect(res.error?.code).toBe("RPC_HITL_FORBIDDEN");
  });
});

describe("rpc campaign topics", () => {
  it("builds and parses broadcast/stage topics", () => {
    const broadcast = campaignBroadcastTopic("camp-1");
    expect(broadcast).toBe("campaign:camp-1:broadcast");
    expect(parseCampaignTopic(broadcast)).toEqual({
      kind: "broadcast",
      campaignId: "camp-1",
    });

    const stage = campaignStageTopic("camp-1", "s2");
    expect(stage).toBe("campaign:camp-1:stage:s2");
    expect(parseCampaignTopic(stage)).toEqual({
      kind: "stage",
      campaignId: "camp-1",
      stageId: "s2",
    });
  });

  it("rejects malformed topics", () => {
    expect(() => parseCampaignTopic("not-a-topic")).toThrow(RpcError);
  });
});

describe("rpc in-process broker contracts", () => {
  it("registers clients, routes send, and records audit", () => {
    const broker = new InProcessBroker();
    const a = { kind: "worker" as const, id: "w-a" };
    const b = { kind: "worker" as const, id: "w-b" };

    expect(
      broker.handle(
        baseEnvelope({
          id: "r1",
          method: "register",
          from: a,
          payload: { kind: a.kind, id: a.id, campaignId: "camp-1" },
        }),
      ).error,
    ).toBeNull();

    expect(
      broker.handle(
        baseEnvelope({
          id: "r2",
          method: "register",
          from: b,
          payload: { kind: b.kind, id: b.id },
        }),
      ).error,
    ).toBeNull();

    const sendRes = broker.handle(
      baseEnvelope({
        id: "s1",
        method: "send",
        from: a,
        to: b,
        payload: { body: { hello: "world" } },
      }),
    );
    expect(sendRes.error).toBeNull();
    expect(sendRes.payload.delivered).toBe(true);

    const inbox = broker.drain(b);
    expect(inbox).toHaveLength(1);
    expect(inbox[0]?.method).toBe("send");
    expect(inbox[0]?.payload).toEqual({ body: { hello: "world" } });
    expect(broker.audit.size).toBeGreaterThan(0);
  });

  it("supports correlated request/response between two clients", async () => {
    const broker = new InProcessBroker({ requestTimeoutMs: 1_000 });
    const a = { kind: "sdk" as const, id: "sdk-a" };
    const b = { kind: "session" as const, id: "sess-b" };

    for (const addr of [a, b]) {
      expect(
        broker.handle(
          baseEnvelope({
            method: "register",
            from: addr,
            payload: { kind: addr.kind, id: addr.id },
          }),
        ).error,
      ).toBeNull();
    }

    const pending = broker.request(a, b, "ping", { n: 1 });
    await Promise.resolve();
    const queued = broker.poll(b);
    expect(queued?.method).toBe("request");
    const correlationId = queued?.correlationId;
    if (!correlationId) {
      throw new Error("expected correlationId on queued request");
    }

    broker.respond(b, a, correlationId, { pong: true });
    const res = await pending;
    expect(res.error).toBeNull();
    expect(res.payload).toEqual({ pong: true });
  });

  it("pub/sub delivers campaign topic to subscribers only", () => {
    const broker = new InProcessBroker();
    const pub = { kind: "cli" as const, id: "publisher" };
    const sub = { kind: "worker" as const, id: "subscriber" };
    const other = { kind: "worker" as const, id: "nosub" };
    const topic = campaignBroadcastTopic("camp-x");

    for (const addr of [pub, sub, other]) {
      expect(
        broker.handle(
          baseEnvelope({
            method: "register",
            from: addr,
            payload: { kind: addr.kind, id: addr.id },
          }),
        ).error,
      ).toBeNull();
    }

    expect(
      broker.handle(
        baseEnvelope({
          method: "subscribe",
          from: sub,
          topic,
          payload: {},
        }),
      ).error,
    ).toBeNull();

    const published = broker.handle(
      baseEnvelope({
        method: "publish",
        from: pub,
        topic,
        campaignId: "camp-x",
        payload: { body: { stage: "ready" } },
      }),
    );
    expect(published.error).toBeNull();
    expect(published.payload.delivered).toBe(1);

    const subInbox = broker.drain(sub);
    expect(subInbox).toHaveLength(1);
    expect(subInbox[0]?.event).toBe("trellis.campaign.topic");
    expect(subInbox[0]?.topic).toBe(topic);
    expect(broker.drain(other)).toHaveLength(0);
  });

  it("enforces local token when configured", () => {
    const broker = new InProcessBroker({ token: "secret" });
    const from = { kind: "cli" as const, id: "authed" };

    const denied = broker.handle(
      baseEnvelope({
        method: "register",
        from,
        payload: { kind: from.kind, id: from.id },
      }),
    );
    expect(denied.error?.code).toBe("RPC_UNAUTHORIZED");

    const ok = broker.handle(
      baseEnvelope({
        method: "register",
        from,
        payload: { kind: from.kind, id: from.id, token: "secret" },
      }),
    );
    expect(ok.error).toBeNull();
  });

  it("status reports protocol version and registered clients", () => {
    const broker = new InProcessBroker();
    const from = { kind: "cli" as const, id: "s1" };
    broker.handle(
      baseEnvelope({
        method: "register",
        from,
        payload: { kind: from.kind, id: from.id },
      }),
    );
    const status = broker.handle(
      baseEnvelope({ method: "status", from, payload: {} }),
    );
    expect(status.error).toBeNull();
    expect(status.payload.protocolVersion).toBe(1);
    expect(status.payload.clients).toHaveLength(1);
  });

  it("expires clients that miss heartbeats", () => {
    const broker = new InProcessBroker({ heartbeatTimeoutMs: 50 });
    const from = { kind: "worker" as const, id: "stale" };
    broker.handle(
      baseEnvelope({
        method: "register",
        from,
        payload: { kind: from.kind, id: from.id },
      }),
    );
    const removed = broker.sweepExpired(Date.now() + 200);
    expect(removed).toContain("worker:stale");
    const send = broker.handle(
      baseEnvelope({
        method: "status",
        from,
        payload: {},
      }),
    );
    expect(send.error?.code).toBe("RPC_NOT_REGISTERED");
  });

  it("emits advisory trellis events without HITL side effects", () => {
    const broker = new InProcessBroker();
    const from = { kind: "cli" as const, id: "orchestrator" };
    const to = { kind: "worker" as const, id: "unit-1" };
    for (const addr of [from, to]) {
      broker.handle(
        baseEnvelope({
          method: "register",
          from: addr,
          payload: { kind: addr.kind, id: addr.id },
        }),
      );
    }
    const res = broker.emitAdvisory(
      from,
      "trellis.gate.pending",
      { gate: "start-execution" },
      { to },
    );
    expect(res.error).toBeNull();
    const inbox = broker.drain(to);
    expect(inbox[0]?.event).toBe("trellis.gate.pending");
  });
});
