/** Campaign UI MIX snapshot (v1) — read-only observation. */

export interface CampaignUnitStatus {
  id: string;
  state: string;
  readiness: string;
  blockedBy: string[];
}

export interface CampaignStageStatus {
  id: string;
  title: string;
  units: CampaignUnitStatus[];
}

export interface CampaignChildStatus {
  id: string;
  state: string;
  dependsOn: string[];
  touches: string[];
  isolation?: string | null;
  branch?: string | null;
  worktreePath?: string | null;
  evidence?: string | null;
  ref?: string | null;
  verifyMd?: boolean;
  handoffMd?: boolean;
}

export interface CampaignParentSnapshot {
  id: string;
  path: string;
  contractEpoch: number | string | null;
  executionTopology: string | null;
  mergeLimit: number | null;
  stages: CampaignStageStatus[];
  children: CampaignChildStatus[];
  integrationQueue: unknown[];
  stageErrors?: string[];
  legacyStages?: boolean;
}

export interface CampaignRpcClientView {
  kind: string;
  id: string;
  capLabel: string;
  campaignId?: string;
  lastSeenAt?: string;
}

export interface CampaignRpcSnapshot {
  url: string;
  reachable: boolean;
  protocolVersion?: number;
  clients: CampaignRpcClientView[];
  topics: string[];
  auditCount?: number;
  error: string | null;
}

export interface CampaignStatusSnapshot {
  v: 1;
  generatedAt: string;
  parent: CampaignParentSnapshot;
  rpc: CampaignRpcSnapshot;
  notes: string[];
}
