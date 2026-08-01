import os from "node:os";
import path from "node:path";

import {
  LocalhostRpcServer,
  type LocalhostRpcServerInfo,
} from "@blxzer/cursor-trellis-core/rpc";

export interface RpcServeOptions {
  host?: string;
  port?: number;
  token?: string;
  /** Omit or pass undefined for default `~/.cstl/rpc`; pass `null` to disable. */
  journalDir?: string | null;
  heartbeatTimeoutMs?: number;
  /** When set, return after listen instead of waiting (tests). */
  listenOnly?: boolean;
}

export interface RpcServeHandle {
  server: LocalhostRpcServer;
  info: LocalhostRpcServerInfo;
  close(): Promise<void>;
}

function defaultJournalDir(): string {
  return path.join(os.homedir(), ".cstl", "rpc");
}

/**
 * Start localhost RPC-FULL CORE broker.
 * Non-goals (printed in help): multi-machine, A2A runtime, ops console.
 */
export async function startRpcServe(
  options: RpcServeOptions = {},
): Promise<RpcServeHandle> {
  const host = options.host ?? "127.0.0.1";
  const port =
    options.port ??
    (process.env.TRELLIS_RPC_PORT
      ? Number(process.env.TRELLIS_RPC_PORT)
      : 7843);
  if (!Number.isInteger(port) || port < 0) {
    throw new Error(`Invalid RPC port: ${String(port)}`);
  }

  const journalDir =
    options.journalDir === null
      ? undefined
      : (options.journalDir ?? defaultJournalDir());

  const server = new LocalhostRpcServer({
    host,
    port,
    token: options.token,
    ...(journalDir !== undefined ? { journalDir } : {}),
    heartbeatTimeoutMs: options.heartbeatTimeoutMs ?? 30_000,
  });
  const info = await server.listen();
  return {
    server,
    info,
    close: () => server.close(),
  };
}

export async function runRpcServeCommand(
  options: RpcServeOptions = {},
): Promise<number> {
  const handle = await startRpcServe(options);
  console.log("RPC-FULL CORE listening (localhost only)");
  console.log(`  url:      ${handle.info.url}`);
  console.log(`  health:   ${handle.info.url}/health`);
  console.log(`  rpc:      POST ${handle.info.url}/rpc`);
  console.log(`  ws:       ws://${handle.info.host}:${handle.info.port}/ws`);
  console.log(`  events:   ${handle.info.url}/events?kind=&id=`);
  console.log(
    "Non-goals: multi-machine, A2A implementation, standalone ops console.",
  );
  console.log("HITL gates are never auto-approved by this broker.");

  if (options.listenOnly) {
    await handle.close();
    return 0;
  }

  await new Promise<void>((resolve) => {
    const shutdown = (): void => {
      void handle.close().finally(resolve);
    };
    process.once("SIGINT", shutdown);
    process.once("SIGTERM", shutdown);
  });
  return 0;
}
