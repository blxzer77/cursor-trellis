import { afterEach, describe, expect, it } from "vitest";

import {
  parseAddressArg,
  resolveRpcUrl,
  runRpcSmoke,
  startRpcServe,
  rpcRegister,
  rpcSend,
} from "../../src/commands/rpc/index.js";

const handles: { close(): Promise<void> }[] = [];

afterEach(async () => {
  while (handles.length > 0) {
    const handle = handles.pop();
    if (handle) await handle.close();
  }
});

describe("rpc CLI helpers", () => {
  it("parses kind:id addresses", () => {
    expect(parseAddressArg("worker:w1")).toEqual({
      kind: "worker",
      id: "w1",
    });
    expect(() => parseAddressArg("bad")).toThrow(/kind:id/);
  });

  it("resolves default broker URL", () => {
    const prev = process.env.TRELLIS_RPC_URL;
    delete process.env.TRELLIS_RPC_URL;
    expect(resolveRpcUrl()).toBe("http://127.0.0.1:7843");
    if (prev !== undefined) process.env.TRELLIS_RPC_URL = prev;
  });
});

describe("rpc smoke / localhost CLI path", () => {
  it("runs two-client + topic round-trip", async () => {
    const result = await runRpcSmoke();
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.sendDelivered).toBe(true);
    expect(result.topicDelivered).toBeGreaterThanOrEqual(1);
    expect(result.statusClients).toBeGreaterThanOrEqual(2);
  });

  it("serves and accepts register/send via HTTP client helpers", async () => {
    const handle = await startRpcServe({
      port: 0,
      journalDir: null,
      heartbeatTimeoutMs: 0,
    });
    handles.push(handle);

    const url = handle.info.url;
    const a = await rpcRegister({ url, kind: "cli", id: "cli-1" });
    const b = await rpcRegister({ url, kind: "worker", id: "w-1" });
    expect(a.error).toBeNull();
    expect(b.error).toBeNull();

    const sent = await rpcSend({
      url,
      from: { kind: "cli", id: "cli-1" },
      to: { kind: "worker", id: "w-1" },
      body: { ping: true },
    });
    expect(sent.error).toBeNull();
    expect(sent.payload.delivered).toBe(true);
  });

  it("rejects non-loopback serve host", async () => {
    await expect(
      startRpcServe({ host: "0.0.0.0", port: 0, journalDir: null }),
    ).rejects.toThrow(/localhost-only/);
  });
});
