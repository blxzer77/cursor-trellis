import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it } from "vitest";

import {
  startRpcServe,
  type RpcServeHandle,
} from "../../src/commands/rpc/serve.js";

const cliRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const distCli = path.join(cliRoot, "dist", "cli", "index.js");
const harnessRoot = path.resolve(cliRoot, "../../../..");
const parentCandidates = [
  path.join(
    harnessRoot,
    ".cstl",
    "tasks",
    "archive",
    "2026-08",
    "08-01-trellis-intent-multisession",
  ),
  path.join(harnessRoot, ".cstl", "tasks", "08-01-trellis-intent-multisession"),
];
const parent =
  parentCandidates.find((p) => fs.existsSync(p)) ?? parentCandidates[0];

/** Official MCP TS SDK stdio dialect: one JSON-RPC object per line. */
function encodeMcp(message: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(message)}\n`, "utf8");
}

class McpClient {
  private buffer = "";
  private waiters: {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: NodeJS.Timeout;
  }[] = [];

  constructor(private readonly child: ReturnType<typeof spawn>) {
    child.stdout?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      this.buffer += chunk;
      this.drain();
    });
  }

  private drain(): void {
    while (this.waiters.length > 0) {
      const index = this.buffer.indexOf("\n");
      if (index === -1) return;
      const line = this.buffer.slice(0, index).replace(/\r$/, "").trim();
      this.buffer = this.buffer.slice(index + 1);
      if (!line) continue;
      const waiter = this.waiters.shift();
      if (!waiter) return;
      clearTimeout(waiter.timer);
      try {
        waiter.resolve(JSON.parse(line));
      } catch (error) {
        waiter.reject(
          error instanceof Error ? error : new Error(String(error)),
        );
      }
    }
  }

  request(message: unknown, timeoutMs = 8000): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.findIndex((w) => w.timer === timer);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(new Error("timeout waiting for MCP response"));
      }, timeoutMs);
      this.waiters.push({ resolve, reject, timer });
      this.child.stdin?.write(encodeMcp(message));
      this.drain();
    });
  }

  close(): void {
    this.child.stdin?.end();
    this.child.kill();
  }
}

describe("campaign mcp stdio", () => {
  const handles: RpcServeHandle[] = [];

  afterEach(async () => {
    while (handles.length) {
      const h = handles.pop();
      if (h) await h.close();
    }
  });

  it("lists and calls campaign_status against live parent + broker", async () => {
    if (!fs.existsSync(parent) || !fs.existsSync(distCli)) {
      return;
    }

    const handle = await startRpcServe({
      port: 0,
      journalDir: null,
      heartbeatTimeoutMs: 0,
    });
    handles.push(handle);

    const child = spawn(process.execPath, [distCli, "campaign", "mcp"], {
      env: {
        ...process.env,
        TRELLIS_CAMPAIGN_PARENT: parent,
        TRELLIS_RPC_URL: handle.info.url,
      },
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    const client = new McpClient(child);

    try {
      const init = (await client.request({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "vitest", version: "0" },
        },
      })) as { result?: { serverInfo?: { name?: string } } };
      expect(init.result?.serverInfo?.name).toBe("trellis-campaign");

      const list = (await client.request({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/list",
        params: {},
      })) as { result?: { tools?: { name: string }[] } };
      expect(list.result?.tools?.some((t) => t.name === "campaign_status")).toBe(
        true,
      );

      const call = (await client.request(
        {
          jsonrpc: "2.0",
          id: 3,
          method: "tools/call",
          params: { name: "campaign_status", arguments: {} },
        },
        20000,
      )) as {
        result?: { content?: { text?: string }[]; isError?: boolean };
      };
      expect(call.result?.isError).toBeFalsy();
      const text = call.result?.content?.[0]?.text ?? "";
      const snapshot = JSON.parse(text) as {
        parent?: { id?: string };
        rpc?: { reachable?: boolean; url?: string };
      };
      expect(snapshot.parent?.id).toBe("08-01-trellis-intent-multisession");
      expect(snapshot.rpc?.reachable).toBe(true);
      expect(snapshot.rpc?.url).toBe(handle.info.url);
    } finally {
      client.close();
    }
  });
});
