import { describe, expect, it } from "vitest";

import { composeCampaignStatus } from "../../src/commands/campaign/compose.js";
import { capLabelForKind } from "../../src/commands/campaign/kind-map.js";
import { renderCampaignStatusMarkdown } from "../../src/commands/campaign/render.js";
import type { CampaignParentSnapshot } from "../../src/commands/campaign/types.js";

const fixtureParent: CampaignParentSnapshot = {
  id: "08-01-demo-parent",
  path: ".cstl/tasks/08-01-demo-parent",
  contractEpoch: 1,
  executionTopology: "parallel",
  mergeLimit: 1,
  stages: [
    {
      id: "stage-1",
      title: "Demo",
      units: [
        {
          id: "08-01-child-a",
          state: "working",
          readiness: "ready",
          blockedBy: [],
        },
      ],
    },
  ],
  children: [
    {
      id: "08-01-child-a",
      state: "working",
      dependsOn: [],
      touches: [],
      ref: null,
      evidence: "implement.md",
    },
  ],
  integrationQueue: [],
};

describe("campaign kind map", () => {
  it("maps RPC kinds to CAP labels", () => {
    expect(capLabelForKind("worker")).toBe("Task");
    expect(capLabelForKind("session")).toBe("window");
    expect(capLabelForKind("sdk")).toBe("SDK");
    expect(capLabelForKind("cli")).toBe("CLI");
    expect(capLabelForKind("broker")).toBe("broker");
    expect(capLabelForKind("other")).toBe("unknown");
  });
});

describe("composeCampaignStatus", () => {
  it("composes Trellis + online RPC with capLabel", async () => {
    const snapshot = await composeCampaignStatus({
      parentDir: "/unused",
      rpcUrl: "http://127.0.0.1:17999",
      loadTrellis: async () => fixtureParent,
      fetchRpcStatus: async () => ({
        protocolVersion: 1,
        clients: [
          {
            address: { kind: "sdk", id: "agent-1" },
            campaignId: "camp-1",
            lastSeenAt: "2026-08-02T00:00:00.000Z",
          },
          {
            address: { kind: "worker", id: "task-1" },
            lastSeenAt: "2026-08-02T00:00:01.000Z",
          },
        ],
        topics: ["campaign:camp-1:broadcast"],
        auditCount: 2,
      }),
    });

    expect(snapshot.v).toBe(1);
    expect(snapshot.parent.id).toBe("08-01-demo-parent");
    expect(snapshot.rpc.reachable).toBe(true);
    expect(snapshot.rpc.clients).toEqual([
      {
        kind: "sdk",
        id: "agent-1",
        capLabel: "SDK",
        campaignId: "camp-1",
        lastSeenAt: "2026-08-02T00:00:00.000Z",
      },
      {
        kind: "worker",
        id: "task-1",
        capLabel: "Task",
        lastSeenAt: "2026-08-02T00:00:01.000Z",
      },
    ]);
    expect(snapshot.rpc.topics).toContain("campaign:camp-1:broadcast");
    expect(snapshot.notes.some((n) => n.includes("Task ≠ Agent window"))).toBe(
      true,
    );
  });

  it("keeps Trellis snapshot when RPC is offline", async () => {
    const snapshot = await composeCampaignStatus({
      parentDir: "/unused",
      loadTrellis: async () => fixtureParent,
      fetchRpcStatus: async () => {
        throw new Error("ECONNREFUSED");
      },
    });

    expect(snapshot.parent.stages[0]?.units[0]?.id).toBe("08-01-child-a");
    expect(snapshot.rpc.reachable).toBe(false);
    expect(snapshot.rpc.clients).toEqual([]);
    expect(snapshot.rpc.error).toMatch(/ECONNREFUSED/);
  });
});

describe("renderCampaignStatusMarkdown", () => {
  it("includes stages and RPC offline banner fields", async () => {
    const snapshot = await composeCampaignStatus({
      parentDir: "/unused",
      loadTrellis: async () => fixtureParent,
      fetchRpcStatus: async () => {
        throw new Error("offline");
      },
    });
    const md = renderCampaignStatusMarkdown(snapshot);
    expect(md).toContain("08-01-demo-parent");
    expect(md).toContain("stage-1");
    expect(md).toContain("reachable: **false**");
    expect(md).toContain("Task ≠ Agent window");
  });
});
