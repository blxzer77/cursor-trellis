import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  cursorProjectSlug,
  defaultCanvasPath,
  renderCampaignCanvasTsx,
  writeCampaignCanvas,
} from "../../src/commands/campaign/canvas-render.js";
import { composeCampaignStatus } from "../../src/commands/campaign/compose.js";
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

describe("cursorProjectSlug", () => {
  it("maps Windows harness roots to Cursor project slugs", () => {
    expect(cursorProjectSlug("D:\\MyHarness")).toBe("d-MyHarness");
  });
});

describe("renderCampaignCanvasTsx", () => {
  it("embeds real snapshot data and cursor/canvas imports without fetch", async () => {
    const snapshot = await composeCampaignStatus({
      parentDir: "/unused",
      loadTrellis: async () => fixtureParent,
      fetchRpcStatus: async () => {
        throw new Error("offline");
      },
    });
    const tsx = renderCampaignCanvasTsx(snapshot);
    expect(tsx).toContain('from "cursor/canvas"');
    expect(tsx).toContain("08-01-demo-parent");
    expect(tsx).toContain("08-01-child-a");
    expect(tsx).toContain("stage-1");
    expect(tsx).toContain("export default function CampaignStatusCanvas");
    expect(tsx).not.toMatch(/\bfetch\s*\(/);
    expect(tsx).toContain("Refresh Canvas");
  });

  it("writes a non-empty .canvas.tsx file", async () => {
    const snapshot = await composeCampaignStatus({
      parentDir: "/unused",
      loadTrellis: async () => fixtureParent,
      fetchRpcStatus: async () => ({
        protocolVersion: 1,
        clients: [
          {
            address: { kind: "sdk", id: "agent-1" },
            campaignId: "camp-1",
          },
        ],
        topics: ["campaign:camp-1:broadcast"],
      }),
    });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "campaign-canvas-"));
    const out = path.join(dir, "campaign-08-01-demo-parent.canvas.tsx");
    const abs = writeCampaignCanvas(snapshot, out);
    expect(abs).toBe(path.resolve(out));
    const body = fs.readFileSync(abs, "utf8");
    expect(body.length).toBeGreaterThan(200);
    expect(body).toContain("capLabel");
    expect(defaultCanvasPath(snapshot, process.cwd())).toMatch(
      /campaign-08-01-demo-parent\.canvas\.tsx$/,
    );
  });
});
