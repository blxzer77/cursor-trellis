import { campaignBroadcastTopic } from "@blxzer/cursor-trellis-core/rpc";

import {
  getJson,
  rpcPublish,
  rpcRegister,
  rpcSend,
  rpcSubscribe,
} from "./client.js";
import { startRpcServe } from "./serve.js";

export interface RpcSmokeResult {
  ok: boolean;
  url: string;
  sendDelivered: boolean;
  topicDelivered: number;
  statusClients: number;
  errors: string[];
}

/**
 * Two-client + campaign topic round-trip against a fresh localhost broker.
 * Used by tests and `cstl rpc smoke`.
 */
export async function runRpcSmoke(options: {
  token?: string;
} = {}): Promise<RpcSmokeResult> {
  const errors: string[] = [];
  const handle = await startRpcServe({
    port: 0,
    token: options.token,
    heartbeatTimeoutMs: 0,
    journalDir: null,
  });

  const url = handle.info.url;
  const a = { kind: "cli" as const, id: "smoke-a" };
  const b = { kind: "worker" as const, id: "smoke-b" };
  const topic = campaignBroadcastTopic("smoke-camp");

  try {
    const regA = await rpcRegister({
      url,
      kind: a.kind,
      id: a.id,
      campaignId: "smoke-camp",
      token: options.token,
    });
    const regB = await rpcRegister({
      url,
      kind: b.kind,
      id: b.id,
      token: options.token,
    });
    if (regA.error) errors.push(`register A: ${regA.error.message}`);
    if (regB.error) errors.push(`register B: ${regB.error.message}`);

    const sent = await rpcSend({
      url,
      from: a,
      to: b,
      body: { hello: "smoke" },
      token: options.token,
    });
    if (sent.error) errors.push(`send: ${sent.error.message}`);

    const sub = await rpcSubscribe({
      url,
      from: b,
      topic,
      token: options.token,
    });
    if (sub.error) errors.push(`subscribe: ${sub.error.message}`);

    const published = await rpcPublish({
      url,
      from: a,
      topic,
      body: { stage: "ready" },
      campaignId: "smoke-camp",
      token: options.token,
    });
    if (published.error) errors.push(`publish: ${published.error.message}`);

    const status = (await getJson(url, "/status")) as {
      clients?: unknown[];
    };

    const sendDelivered = sent.payload.delivered === true;
    const topicDelivered =
      typeof published.payload.delivered === "number"
        ? published.payload.delivered
        : 0;
    const statusClients = Array.isArray(status.clients)
      ? status.clients.length
      : 0;

    if (topicDelivered < 1) errors.push("topic deliver count < 1");
    if (statusClients < 2) errors.push("status clients < 2");
    if (!sendDelivered) errors.push("send not delivered");

    return {
      ok: errors.length === 0,
      url,
      sendDelivered,
      topicDelivered,
      statusClients,
      errors,
    };
  } finally {
    await handle.close();
  }
}
