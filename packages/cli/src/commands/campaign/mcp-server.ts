import { composeCampaignStatus } from "./compose.js";

type JsonRpcId = string | number | null;

interface JsonRpcRequest {
  jsonrpc?: string;
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
}

/**
 * MCP stdio framing used by @modelcontextprotocol/sdk (and Cursor host):
 * one JSON-RPC message per line (NDJSON). Not LSP Content-Length.
 */
function writeMessage(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
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

function negotiatedProtocolVersion(params: unknown): string {
  const p =
    params && typeof params === "object"
      ? (params as Record<string, unknown>)
      : {};
  const requested =
    typeof p.protocolVersion === "string" ? p.protocolVersion.trim() : "";
  return requested || "2024-11-05";
}

async function handleRequest(msg: JsonRpcRequest): Promise<void> {
  const method = msg.method ?? "";
  const id = msg.id ?? null;

  if (method === "initialize") {
    ok(id, {
      protocolVersion: negotiatedProtocolVersion(msg.params),
      capabilities: {
        tools: {},
      },
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

  if (method === "resources/list") {
    ok(id, { resources: [] });
    return;
  }

  if (method === "prompts/list") {
    ok(id, { prompts: [] });
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
 * Run MCP stdio server (newline-delimited JSON-RPC, SDK dialect).
 * Blocks until stdin closes.
 */
export async function runCampaignMcpServer(): Promise<void> {
  let buffer = "";
  let chain: Promise<void> = Promise.resolve();

  const processLines = async (): Promise<void> => {
    while (true) {
      const index = buffer.indexOf("\n");
      if (index === -1) return;
      const line = buffer.slice(0, index).replace(/\r$/, "").trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      let msg: JsonRpcRequest;
      try {
        msg = JSON.parse(line) as JsonRpcRequest;
      } catch {
        continue;
      }
      await handleRequest(msg);
    }
  };

  if (typeof process.stdin.resume === "function") {
    process.stdin.resume();
  }
  process.stdin.setEncoding("utf8");

  process.stdin.on("data", (chunk: string | Buffer) => {
    buffer += typeof chunk === "string" ? chunk : chunk.toString("utf8");
    chain = chain.then(() => processLines()).catch(() => undefined);
  });

  await new Promise<void>((resolve) => {
    process.stdin.on("end", () => resolve());
    process.stdin.on("close", () => resolve());
  });
}
