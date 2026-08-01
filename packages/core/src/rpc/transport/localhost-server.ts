import http from "node:http";
import type { AddressInfo } from "node:net";
import type { Duplex } from "node:stream";

import { InProcessBroker } from "../broker/in-process.js";
import { RpcJournal } from "../broker/journal.js";
import { addressKey, parseRpcAddress } from "../contract/parse.js";
import type { RpcAddress, RpcEnvelope } from "../contract/types.js";
import {
  acceptWebSocket,
  isWebSocketUpgrade,
  type MinimalWebSocket,
} from "./websocket.js";

export interface LocalhostRpcServerOptions {
  broker?: InProcessBroker;
  host?: string;
  port?: number;
  token?: string;
  heartbeatTimeoutMs?: number;
  journalDir?: string;
}

export interface LocalhostRpcServerInfo {
  host: string;
  port: number;
  url: string;
}

function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}

function readJsonBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as unknown);
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function writeJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

/**
 * Localhost RPC-FULL CORE server: HTTP JSON + WebSocket push (+ SSE fallback).
 */
export class LocalhostRpcServer {
  readonly broker: InProcessBroker;
  private readonly host: string;
  private readonly port: number;
  private server: http.Server | null = null;
  private readonly sockets = new Map<string, Set<MinimalWebSocket>>();
  private readonly sse = new Map<string, Set<http.ServerResponse>>();
  private unsubDeliver: (() => void) | null = null;

  constructor(options: LocalhostRpcServerOptions = {}) {
    const host = options.host ?? "127.0.0.1";
    if (!isLoopbackHost(host)) {
      throw new Error(
        `LocalhostRpcServer refuses non-loopback host '${host}' (CORE is localhost-only)`,
      );
    }
    this.host = host === "localhost" ? "127.0.0.1" : host;
    this.port = options.port ?? 0;
    this.broker =
      options.broker ??
      new InProcessBroker({
        token: options.token,
        heartbeatTimeoutMs: options.heartbeatTimeoutMs ?? 30_000,
      });
    if (options.journalDir) {
      this.broker.attachJournal(new RpcJournal(options.journalDir));
    }
  }

  async listen(): Promise<LocalhostRpcServerInfo> {
    if (this.server) return this.info();

    this.unsubDeliver = this.broker.onDeliver((address, envelope) => {
      this.pushToAddress(address, envelope);
    });
    this.broker.startHeartbeatSweeper();

    const server = http.createServer((req, res) => {
      void this.handleHttp(req, res);
    });
    server.on("upgrade", (req, socket, head) => {
      this.handleUpgrade(req, socket, head);
    });

    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(this.port, this.host, () => resolve());
    });
    this.server = server;
    return this.info();
  }

  async close(): Promise<void> {
    this.broker.stopHeartbeatSweeper();
    if (this.unsubDeliver) {
      this.unsubDeliver();
      this.unsubDeliver = null;
    }
    for (const set of this.sockets.values()) {
      for (const ws of set) ws.close();
    }
    this.sockets.clear();
    for (const set of this.sse.values()) {
      for (const res of set) res.end();
    }
    this.sse.clear();
    const server = this.server;
    this.server = null;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  info(): LocalhostRpcServerInfo {
    if (!this.server) {
      throw new Error("LocalhostRpcServer is not listening");
    }
    const address = this.server.address() as AddressInfo;
    return {
      host: this.host,
      port: address.port,
      url: `http://${this.host}:${address.port}`,
    };
  }

  private pushToAddress(address: RpcAddress, envelope: RpcEnvelope): void {
    const key = addressKey(address);
    const payload = JSON.stringify(envelope);
    const wsSet = this.sockets.get(key);
    if (wsSet) {
      for (const ws of wsSet) ws.send(payload);
    }
    const sseSet = this.sse.get(key);
    if (sseSet) {
      for (const res of sseSet) {
        res.write(`data: ${payload}\n\n`);
      }
    }
  }

  private bindSocket(address: RpcAddress, ws: MinimalWebSocket): void {
    const key = addressKey(address);
    let set = this.sockets.get(key);
    if (!set) {
      set = new Set();
      this.sockets.set(key, set);
    }
    set.add(ws);
    ws.onClose(() => {
      set?.delete(ws);
      if (set?.size === 0) this.sockets.delete(key);
    });
    for (const msg of this.broker.drain(address)) {
      ws.send(JSON.stringify(msg));
    }
  }

  private handleUpgrade(
    req: http.IncomingMessage,
    socket: Duplex,
    head: Buffer,
  ): void {
    if (!isWebSocketUpgrade(req) || !req.url?.startsWith("/ws")) {
      socket.destroy();
      return;
    }
    const ws = acceptWebSocket(req, socket, head);
    if (!ws) return;

    let bound: RpcAddress | null = null;
    ws.onMessage((text) => {
      let raw: unknown;
      try {
        raw = JSON.parse(text) as unknown;
      } catch {
        ws.send(
          JSON.stringify({
            error: {
              code: "RPC_BAD_ENVELOPE",
              message: "WebSocket frame must be JSON envelope",
            },
          }),
        );
        return;
      }
      const response = this.broker.handle(raw);
      ws.send(JSON.stringify(response));

      if (
        !bound &&
        response.error === null &&
        response.method === "register" &&
        response.payload.address &&
        typeof response.payload.address === "object"
      ) {
        try {
          bound = parseRpcAddress(response.payload.address);
          this.bindSocket(bound, ws);
        } catch {
          // ignore bind failure
        }
      }
    });
  }

  private async handleHttp(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<void> {
    try {
      const url = new URL(req.url ?? "/", `http://${this.host}`);
      if (req.method === "GET" && url.pathname === "/health") {
        writeJson(res, 200, { ok: true });
        return;
      }
      if (req.method === "GET" && url.pathname === "/status") {
        writeJson(res, 200, this.broker.status());
        return;
      }
      if (req.method === "GET" && url.pathname === "/events") {
        this.handleSse(url, res);
        return;
      }
      if (req.method === "POST" && url.pathname === "/rpc") {
        const body = await readJsonBody(req);
        const response = this.broker.handle(body);
        writeJson(res, response.error ? 400 : 200, response);
        return;
      }
      writeJson(res, 404, {
        error: { code: "RPC_UNKNOWN_METHOD", message: "not found" },
      });
    } catch (error) {
      writeJson(res, 500, {
        error: {
          code: "RPC_INTERNAL",
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }

  private handleSse(url: URL, res: http.ServerResponse): void {
    const kind = url.searchParams.get("kind");
    const id = url.searchParams.get("id");
    if (!kind || !id) {
      writeJson(res, 400, {
        error: {
          code: "RPC_BAD_ENVELOPE",
          message: "SSE requires kind and id query params",
        },
      });
      return;
    }
    let address: RpcAddress;
    try {
      address = parseRpcAddress({ kind, id });
      this.broker.requireRegistered(address);
    } catch (error) {
      writeJson(res, 400, {
        error: {
          code: "RPC_NOT_REGISTERED",
          message: error instanceof Error ? error.message : String(error),
        },
      });
      return;
    }

    res.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    res.write(": ok\n\n");

    const key = addressKey(address);
    let set = this.sse.get(key);
    if (!set) {
      set = new Set();
      this.sse.set(key, set);
    }
    set.add(res);
    res.on("close", () => {
      set?.delete(res);
      if (set?.size === 0) this.sse.delete(key);
    });

    for (const msg of this.broker.drain(address)) {
      res.write(`data: ${JSON.stringify(msg)}\n\n`);
    }
  }
}
