import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  LocalhostRpcServer,
  RPC_PROTOCOL_VERSION,
  campaignBroadcastTopic,
  type RpcEnvelope,
} from "../../src/rpc/index.js";

const servers: LocalhostRpcServer[] = [];

afterEach(async () => {
  while (servers.length > 0) {
    const server = servers.pop();
    if (server) await server.close();
  }
});

function envelope(
  overrides: Record<string, unknown>,
): Record<string, unknown> {
  return {
    v: RPC_PROTOCOL_VERSION,
    id: `id-${Math.random().toString(16).slice(2)}`,
    type: "req",
    ts: new Date().toISOString(),
    payload: {},
    ...overrides,
  };
}

async function postRpc(
  baseUrl: string,
  body: Record<string, unknown>,
): Promise<RpcEnvelope> {
  const res = await fetch(`${baseUrl}/rpc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as RpcEnvelope;
}

function wsConnect(url: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.addEventListener("open", () => resolve(ws));
    ws.addEventListener("error", () => reject(new Error("WebSocket error")));
  });
}

function waitForMessage(
  ws: WebSocket,
  predicate: (data: unknown) => boolean,
  timeoutMs = 3_000,
): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("ws message timeout")), timeoutMs);
    const onMessage = (event: MessageEvent) => {
      const data = JSON.parse(String(event.data)) as unknown;
      if (!predicate(data)) return;
      clearTimeout(timer);
      ws.removeEventListener("message", onMessage);
      resolve(data);
    };
    ws.addEventListener("message", onMessage);
  });
}

describe("rpc localhost transport", () => {
  it("refuses non-loopback bind", () => {
    expect(() => new LocalhostRpcServer({ host: "0.0.0.0" })).toThrow(
      /localhost-only/,
    );
  });

  it("serves health/status and HTTP send between clients", async () => {
    const journalDir = fs.mkdtempSync(path.join(os.tmpdir(), "rpc-journal-"));
    const server = new LocalhostRpcServer({
      port: 0,
      journalDir,
      heartbeatTimeoutMs: 0,
    });
    servers.push(server);
    const info = await server.listen();

    const health = await fetch(`${info.url}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true });

    const a = { kind: "worker", id: "http-a" };
    const b = { kind: "worker", id: "http-b" };
    for (const addr of [a, b]) {
      const reg = await postRpc(
        info.url,
        envelope({
          method: "register",
          from: addr,
          payload: { kind: addr.kind, id: addr.id },
        }),
      );
      expect(reg.error).toBeNull();
    }

    const sent = await postRpc(
      info.url,
      envelope({
        method: "send",
        from: a,
        to: b,
        payload: { body: { via: "http" } },
      }),
    );
    expect(sent.error).toBeNull();

    const statusRes = await fetch(`${info.url}/status`);
    const status = (await statusRes.json()) as { clients: unknown[] };
    expect(status.clients.length).toBe(2);

    const journal = fs.readFileSync(
      path.join(journalDir, "audit.jsonl"),
      "utf8",
    );
    expect(journal).toContain('"kind":"register"');
    expect(journal).toContain('"kind":"send"');
  });

  it("pushes inbox over WebSocket after register", async () => {
    const server = new LocalhostRpcServer({ port: 0, heartbeatTimeoutMs: 0 });
    servers.push(server);
    const info = await server.listen();

    const a = { kind: "cli", id: "ws-pub" };
    const b = { kind: "worker", id: "ws-sub" };

    await postRpc(
      info.url,
      envelope({
        method: "register",
        from: a,
        payload: { kind: a.kind, id: a.id },
      }),
    );

    const ws = await wsConnect(`ws://127.0.0.1:${info.port}/ws`);
    const registerAck = waitForMessage(
      ws,
      (data) =>
        typeof data === "object" &&
        data !== null &&
        (data as { method?: string }).method === "register",
    );
    ws.send(
      JSON.stringify(
        envelope({
          method: "register",
          from: b,
          payload: { kind: b.kind, id: b.id },
        }),
      ),
    );
    await registerAck;

    const pushed = waitForMessage(
      ws,
      (data) =>
        typeof data === "object" &&
        data !== null &&
        (data as { method?: string }).method === "send",
    );

    const sendRes = await postRpc(
      info.url,
      envelope({
        method: "send",
        from: a,
        to: b,
        payload: { body: { hello: "ws" } },
      }),
    );
    expect(sendRes.error).toBeNull();

    const msg = (await pushed) as RpcEnvelope;
    expect(msg.payload).toEqual({ body: { hello: "ws" } });
    ws.close();
  });

  it("streams campaign publish over SSE", async () => {
    const server = new LocalhostRpcServer({ port: 0, heartbeatTimeoutMs: 0 });
    servers.push(server);
    const info = await server.listen();
    const topic = campaignBroadcastTopic("sse-camp");
    const pub = { kind: "cli", id: "sse-pub" };
    const sub = { kind: "worker", id: "sse-sub" };

    for (const addr of [pub, sub]) {
      await postRpc(
        info.url,
        envelope({
          method: "register",
          from: addr,
          payload: { kind: addr.kind, id: addr.id },
        }),
      );
    }
    await postRpc(
      info.url,
      envelope({
        method: "subscribe",
        from: sub,
        topic,
        payload: {},
      }),
    );

    const events = await new Promise<RpcEnvelope[]>((resolve, reject) => {
      const out: RpcEnvelope[] = [];
      const req = http.get(
        `${info.url}/events?kind=worker&id=sse-sub`,
        (res) => {
          let buf = "";
          res.on("data", (chunk: Buffer) => {
            buf += chunk.toString("utf8");
            const parts = buf.split("\n\n");
            buf = parts.pop() ?? "";
            for (const part of parts) {
              const line = part
                .split("\n")
                .find((l) => l.startsWith("data: "));
              if (!line) continue;
              out.push(JSON.parse(line.slice(6)) as RpcEnvelope);
              if (out.length >= 1) {
                req.destroy();
                resolve(out);
              }
            }
          });
        },
      );
      req.on("error", (error) => {
        if (out.length > 0) resolve(out);
        else reject(error);
      });
      setTimeout(() => {
        void postRpc(
          info.url,
          envelope({
            method: "publish",
            from: pub,
            topic,
            payload: { body: { ok: true } },
          }),
        );
      }, 50);
      setTimeout(() => reject(new Error("SSE timeout")), 3_000);
    });

    expect(events[0]?.event).toBe("trellis.campaign.topic");
  });

  it("rejects HITL bypass over HTTP", async () => {
    const server = new LocalhostRpcServer({ port: 0, heartbeatTimeoutMs: 0 });
    servers.push(server);
    const info = await server.listen();
    const from = { kind: "cli", id: "bad" };
    await postRpc(
      info.url,
      envelope({
        method: "register",
        from,
        payload: { kind: from.kind, id: from.id },
      }),
    );
    const denied = await postRpc(
      info.url,
      envelope({
        method: "trellis.startExecution",
        from,
        payload: { task: "x" },
      }),
    );
    expect(denied.error?.code).toBe("RPC_HITL_FORBIDDEN");
  });
});
