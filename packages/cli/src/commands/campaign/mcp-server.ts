import { composeCampaignStatus } from "./compose.js";

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
}

function writeMessage(message: unknown): void {
  const body = JSON.stringify(message);
  const header = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
  process.stdout.write(header + body);
}

function ok(id: JsonRpcId, result: unknown): void {
  writeMessage({ jsonrpc: "2.0", id: id ?? null, result });
}

function err(id: JsonRpcId, code: number, message: string): void {
  writeMessage({
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message },
  });
}

const TOOL_NAME = "campaign_status";

function toolList(): { tools: Record<string, unknown>[] } {
  return {
    tools: [
      {
        name: TOOL_NAME,
        description:
          "Read-only Trellis campaign status (task-map stages/children + optional RPC broker clients/topics). Never approves HITL gates.",
        inputSchema: {
          type: "object",
          properties: {
            parent: {
              type: "string",
              description:
                "Parent task directory (default: TRELLIS_CAMPAIGN_PARENT env)",
            },
            rpcUrl: {
              type: "string",
              description: "RPC broker base URL (default TRELLIS_RPC_URL)",
            },
          },
          additionalProperties: false,
        },
      },
    ],
  };
}

async function callCampaignStatus(params: unknown): Promise<string> {
  const p =
    params && typeof params === "object"
      ? (params as Record<string, unknown>)
      : {};
  const args =
    p.arguments && typeof p.arguments === "object"
      ? (p.arguments as Record<string, unknown>)
      : p;

  const parent =
    (typeof args.parent === "string" && args.parent.trim()) ||
    process.env.TRELLIS_CAMPAIGN_PARENT?.trim();
  if (!parent) {
    throw new Error(
      "campaign_status requires parent path or TRELLIS_CAMPAIGN_PARENT",
    );
  }
  const rpcUrl =
    typeof args.rpcUrl === "string" && args.rpcUrl.trim()
      ? args.rpcUrl.trim()
      : undefined;

  const snapshot = await composeCampaignStatus({ parentDir: parent, rpcUrl });
  return JSON.stringify(snapshot, null, 2);
}

async function handleRequest(msg: JsonRpcRequest): Promise<void> {
  const method = msg.method ?? "";
  const id = msg.id ?? null;

  if (method === "initialize") {
    ok(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "trellis-campaign", version: "0.1.0" },
    });
    return;
  }

  if (method === "notifications/initialized" || method === "initialized") {
    return;
  }

  if (method === "ping") {
    ok(id, {});
    return;
  }

  if (method === "tools/list") {
    ok(id, toolList());
    return;
  }

  if (method === "tools/call") {
    try {
      const params = msg.params as Record<string, unknown> | undefined;
      const name = typeof params?.name === "string" ? params.name : "";
      if (name !== TOOL_NAME) {
        err(id, -32601, `Unknown tool: ${name}`);
        return;
      }
      const text = await callCampaignStatus(params);
      ok(id, {
        content: [{ type: "text", text }],
        isError: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      ok(id, {
        content: [{ type: "text", text: message }],
        isError: true,
      });
    }
    return;
  }

  if (id !== undefined && id !== null) {
    err(id, -32601, `Method not found: ${method}`);
  }
}

/**
 * Run minimal MCP stdio server (Content-Length framing).
 * Blocks until stdin closes.
 */
export async function runCampaignMcpServer(): Promise<void> {
  let buffer = Buffer.alloc(0);

  const processBuffer = async (): Promise<void> => {
    while (true) {
      let headerEnd = buffer.indexOf("\r\n\r\n");
      let sepLen = 4;
      if (headerEnd === -1) {
        headerEnd = buffer.indexOf("\n\n");
        sepLen = 2;
      }
      if (headerEnd === -1) return;
      const header = buffer.subarray(0, headerEnd).toString("utf8");
      const match = /Content-Length:\s*(\d+)/i.exec(header);
      if (!match) {
        buffer = buffer.subarray(headerEnd + sepLen);
        continue;
      }
      const length = Number(match[1]);
      const bodyStart = headerEnd + sepLen;
      if (buffer.length < bodyStart + length) return;
      const body = buffer.subarray(bodyStart, bodyStart + length).toString("utf8");
      buffer = buffer.subarray(bodyStart + length);
      let msg: JsonRpcRequest;
      try {
        msg = JSON.parse(body) as JsonRpcRequest;
      } catch {
        continue;
      }
      await handleRequest(msg);
    }
  };

  process.stdin.on("data", (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    void processBuffer();
  });

  await new Promise<void>((resolve) => {
    process.stdin.on("end", () => resolve());
    process.stdin.on("close", () => resolve());
  });
}
