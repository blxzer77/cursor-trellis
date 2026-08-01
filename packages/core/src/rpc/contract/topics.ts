import { RpcError } from "./errors.js";

const BROADCAST_RE = /^campaign:([^:]+):broadcast$/;
const STAGE_RE = /^campaign:([^:]+):stage:([^:]+)$/;

export function campaignBroadcastTopic(campaignId: string): string {
  const id = campaignId.trim();
  if (!id) {
    throw new RpcError("RPC_BAD_ENVELOPE", "campaignId must be non-empty");
  }
  if (id.includes(":")) {
    throw new RpcError(
      "RPC_BAD_ENVELOPE",
      "campaignId must not contain ':'",
      { campaignId: id },
    );
  }
  return `campaign:${id}:broadcast`;
}

export function campaignStageTopic(campaignId: string, stageId: string): string {
  const c = campaignId.trim();
  const s = stageId.trim();
  if (!c || !s) {
    throw new RpcError(
      "RPC_BAD_ENVELOPE",
      "campaignId and stageId must be non-empty",
    );
  }
  if (c.includes(":") || s.includes(":")) {
    throw new RpcError(
      "RPC_BAD_ENVELOPE",
      "campaignId/stageId must not contain ':'",
    );
  }
  return `campaign:${c}:stage:${s}`;
}

export function parseCampaignTopic(
  topic: string,
):
  | { kind: "broadcast"; campaignId: string }
  | { kind: "stage"; campaignId: string; stageId: string } {
  const broadcast = BROADCAST_RE.exec(topic);
  if (broadcast?.[1]) {
    return { kind: "broadcast", campaignId: broadcast[1] };
  }
  const stage = STAGE_RE.exec(topic);
  if (stage?.[1] && stage[2]) {
    return {
      kind: "stage",
      campaignId: stage[1],
      stageId: stage[2],
    };
  }
  throw new RpcError("RPC_BAD_ENVELOPE", `Invalid campaign topic: ${topic}`, {
    topic,
  });
}
