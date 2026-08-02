import { getJson, resolveRpcUrl } from "../rpc/client.js";
import { capLabelForKind } from "./kind-map.js";
import { loadTrellisParentSnapshot } from "./trellis-load.js";
import type {
  CampaignParentSnapshot,
  CampaignRpcClientView,
  CampaignRpcSnapshot,
  CampaignStatusSnapshot,
} from "./types.js";

const DEFAULT_NOTES = [
  "Read-only observation. HITL gates remain task.py / human.",
  "capLabel is advisory; Task ≠ Agent window (CAP MATRIX).",
  "Refresh Canvas: cstl campaign canvas --parent <parent-task-dir>.",
];

export type TrellisLoader = (
  parentDir: string,
) => Promise<CampaignParentSnapshot>;

export type RpcStatusFetcher = (url: string) => Promise<unknown>;

export interface ComposeCampaignStatusOptions {
  parentDir: string;
  rpcUrl?: string;
  rpcTimeoutMs?: number;
  loadTrellis?: TrellisLoader;
  fetchRpcStatus?: RpcStatusFetcher;
}

function nowIso(): string {
  return new Date().toISOString();
}

function mapRpcClients(raw: unknown): {
  protocolVersion?: number;
  clients: CampaignRpcClientView[];
  topics: string[];
  auditCount?: number;
} {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { clients: [], topics: [] };
  }
  const o = raw as Record<string, unknown>;
  const clientsRaw = Array.isArray(o.clients) ? o.clients : [];
  const clients: CampaignRpcClientView[] = [];
  for (const item of clientsRaw) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const address =
      c.address && typeof c.address === "object"
        ? (c.address as Record<string, unknown>)
        : null;
    const kind =
      typeof address?.kind === "string"
        ? address.kind
        : typeof c.kind === "string"
          ? c.kind
          : "unknown";
    const id =
      typeof address?.id === "string"
        ? address.id
        : typeof c.id === "string"
          ? c.id
          : "?";
    clients.push({
      kind,
      id,
      capLabel: capLabelForKind(kind),
      ...(typeof c.campaignId === "string" ? { campaignId: c.campaignId } : {}),
      ...(typeof c.lastSeenAt === "string" ? { lastSeenAt: c.lastSeenAt } : {}),
    });
  }
  const topics = Array.isArray(o.topics)
    ? o.topics.filter((t): t is string => typeof t === "string")
    : [];
  return {
    protocolVersion:
      typeof o.protocolVersion === "number" ? o.protocolVersion : undefined,
    clients,
    topics,
    auditCount: typeof o.auditCount === "number" ? o.auditCount : undefined,
  };
}

async function defaultFetchRpcStatus(
  url: string,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/status`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status} for /status`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function composeCampaignStatus(
  options: ComposeCampaignStatusOptions,
): Promise<CampaignStatusSnapshot> {
  const loadTrellis = options.loadTrellis ?? loadTrellisParentSnapshot;
  const parent = await loadTrellis(options.parentDir);
  const url = resolveRpcUrl(options.rpcUrl);
  const timeoutMs = options.rpcTimeoutMs ?? 1500;

  let rpc: CampaignRpcSnapshot;
  try {
    const fetchRpc =
      options.fetchRpcStatus ??
      ((u: string) => defaultFetchRpcStatus(u, timeoutMs));
    const raw = await fetchRpc(url);
    const mapped = mapRpcClients(raw);
    rpc = {
      url,
      reachable: true,
      protocolVersion: mapped.protocolVersion,
      clients: mapped.clients,
      topics: mapped.topics,
      auditCount: mapped.auditCount,
      error: null,
    };
  } catch (error) {
    rpc = {
      url,
      reachable: false,
      clients: [],
      topics: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }

  return {
    v: 1,
    generatedAt: nowIso(),
    parent,
    rpc,
    notes: [...DEFAULT_NOTES],
  };
}

/** Re-export for tests that want getJson-shaped helpers. */
export { getJson };
