import { InvalidArgumentError, type Command } from "commander";

import {
  RPC_ADDRESS_KINDS,
  type RpcAddressKind,
} from "@blxzer/cursor-trellis-core/rpc";

import {
  exitForEnvelope,
  getJson,
  parseAddressArg,
  parseJsonObject,
  printEnvelope,
  resolveRpcToken,
  resolveRpcUrl,
  rpcPublish,
  rpcRegister,
  rpcSend,
  rpcSubscribe,
} from "./client.js";
import { runRpcServeCommand } from "./serve.js";
import { runRpcSmoke } from "./smoke.js";

function parsePort(value: string): number {
  if (!/^\d+$/.test(value)) {
    throw new InvalidArgumentError(`expected port integer, got '${value}'`);
  }
  return Number(value);
}

function parseKind(value: string): RpcAddressKind {
  if (!(RPC_ADDRESS_KINDS as readonly string[]).includes(value)) {
    throw new InvalidArgumentError(
      `kind must be one of: ${RPC_ADDRESS_KINDS.join(", ")}`,
    );
  }
  return value as RpcAddressKind;
}

/**
 * Register `cstl rpc` — localhost RPC-FULL CORE control plane.
 * Does not replace durable `channel` event logs. Does not auto-approve HITL gates.
 */
export function registerRpcCommand(program: Command): void {
  const rpc = program
    .command("rpc")
    .description(
      "Localhost RPC-FULL CORE broker (register/send/push/topics). Non-goals: multi-machine, A2A impl, ops console. Never auto-approves Trellis HITL gates.",
    );

  rpc
    .command("serve")
    .description(
      "Start localhost broker on 127.0.0.1 (HTTP+/WS). Non-goals: multi-machine / A2A / ops console.",
    )
    .option("--host <host>", "loopback host only", "127.0.0.1")
    .option("--port <port>", "listen port (0 = ephemeral)", parsePort, 7843)
    .option("--token <token>", "shared local token (or TRELLIS_RPC_TOKEN)")
    .option(
      "--journal-dir <dir>",
      "audit journal directory (default: ~/.cstl/rpc)",
    )
    .option("--no-journal", "disable on-disk audit journal")
    .action(
      async (opts: {
        host?: string;
        port?: number;
        token?: string;
        journalDir?: string;
        journal?: boolean;
      }) => {
        const code = await runRpcServeCommand({
          host: opts.host,
          port: opts.port,
          token: resolveRpcToken(opts.token),
          journalDir: opts.journal === false ? null : opts.journalDir,
        });
        process.exitCode = code;
      },
    );

  rpc
    .command("status")
    .description("Fetch broker status snapshot")
    .option("--url <url>", "broker base URL (or TRELLIS_RPC_URL)")
    .option("--json", "print raw JSON")
    .action(async (opts: { url?: string; json?: boolean }) => {
      const url = resolveRpcUrl(opts.url);
      const status = await getJson(url, "/status");
      console.log(JSON.stringify(status, null, opts.json ? 2 : 2));
    });

  rpc
    .command("register")
    .description("Register a client address with the broker")
    .requiredOption("--kind <kind>", "worker|session|cli|sdk|broker", parseKind)
    .requiredOption("--id <id>", "address id")
    .option("--campaign <id>", "optional campaign id")
    .option("--url <url>", "broker base URL")
    .option("--token <token>", "shared local token")
    .option("--json", "print full envelope JSON")
    .action(
      async (opts: {
        kind: RpcAddressKind;
        id: string;
        campaign?: string;
        url?: string;
        token?: string;
        json?: boolean;
      }) => {
        const envelope = await rpcRegister({
          url: resolveRpcUrl(opts.url),
          kind: opts.kind,
          id: opts.id,
          campaignId: opts.campaign,
          token: resolveRpcToken(opts.token),
        });
        printEnvelope(envelope, Boolean(opts.json));
        process.exitCode = exitForEnvelope(envelope);
      },
    );

  rpc
    .command("send")
    .description("Send an addressable one-way message")
    .requiredOption("--from <addr>", "kind:id sender")
    .requiredOption("--to <addr>", "kind:id recipient")
    .option("--body <json>", "JSON object payload", "{}")
    .option("--url <url>", "broker base URL")
    .option("--token <token>", "shared local token")
    .option("--json", "print full envelope JSON")
    .action(
      async (opts: {
        from: string;
        to: string;
        body: string;
        url?: string;
        token?: string;
        json?: boolean;
      }) => {
        const envelope = await rpcSend({
          url: resolveRpcUrl(opts.url),
          from: parseAddressArg(opts.from),
          to: parseAddressArg(opts.to),
          body: parseJsonObject(opts.body, "--body"),
          token: resolveRpcToken(opts.token),
        });
        printEnvelope(envelope, Boolean(opts.json));
        process.exitCode = exitForEnvelope(envelope);
      },
    );

  rpc
    .command("subscribe")
    .description("Subscribe an address to a campaign topic")
    .requiredOption("--from <addr>", "kind:id subscriber")
    .requiredOption("--topic <topic>", "campaign:<id>:broadcast|stage:<sid>")
    .option("--url <url>", "broker base URL")
    .option("--token <token>", "shared local token")
    .option("--json", "print full envelope JSON")
    .action(
      async (opts: {
        from: string;
        topic: string;
        url?: string;
        token?: string;
        json?: boolean;
      }) => {
        const envelope = await rpcSubscribe({
          url: resolveRpcUrl(opts.url),
          from: parseAddressArg(opts.from),
          topic: opts.topic,
          token: resolveRpcToken(opts.token),
        });
        printEnvelope(envelope, Boolean(opts.json));
        process.exitCode = exitForEnvelope(envelope);
      },
    );

  rpc
    .command("publish")
    .description("Publish to a campaign topic")
    .requiredOption("--from <addr>", "kind:id publisher")
    .requiredOption("--topic <topic>", "campaign topic")
    .option("--body <json>", "JSON object payload", "{}")
    .option("--campaign <id>", "campaign id stamp")
    .option("--url <url>", "broker base URL")
    .option("--token <token>", "shared local token")
    .option("--json", "print full envelope JSON")
    .action(
      async (opts: {
        from: string;
        topic: string;
        body: string;
        campaign?: string;
        url?: string;
        token?: string;
        json?: boolean;
      }) => {
        const envelope = await rpcPublish({
          url: resolveRpcUrl(opts.url),
          from: parseAddressArg(opts.from),
          topic: opts.topic,
          body: parseJsonObject(opts.body, "--body"),
          campaignId: opts.campaign,
          token: resolveRpcToken(opts.token),
        });
        printEnvelope(envelope, Boolean(opts.json));
        process.exitCode = exitForEnvelope(envelope);
      },
    );

  rpc
    .command("smoke")
    .description(
      "Run two-client + topic round-trip against an ephemeral localhost broker",
    )
    .option("--token <token>", "optional shared token for the smoke broker")
    .option("--json", "print machine-readable result")
    .action(async (opts: { token?: string; json?: boolean }) => {
      const result = await runRpcSmoke({
        token: resolveRpcToken(opts.token),
      });
      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
      } else if (result.ok) {
        console.log(
          `RPC smoke OK (url=${result.url}, clients=${result.statusClients}, topicDelivered=${result.topicDelivered})`,
        );
      } else {
        console.error(`RPC smoke FAILED: ${result.errors.join("; ")}`);
      }
      process.exitCode = result.ok ? 0 : 1;
    });
}

export {
  startRpcServe,
  runRpcServeCommand,
  type RpcServeOptions,
  type RpcServeHandle,
} from "./serve.js";
export { runRpcSmoke, type RpcSmokeResult } from "./smoke.js";
export {
  resolveRpcUrl,
  resolveRpcToken,
  parseAddressArg,
  postRpc,
  rpcRegister,
  rpcSend,
  rpcSubscribe,
  rpcPublish,
  getJson,
} from "./client.js";
