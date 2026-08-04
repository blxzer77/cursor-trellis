import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cursorProjectSlug,
  defaultCanvasPath,
  evaluateCanvasWritePath,
  isUnderCanvasDir,
  renderCampaignCanvasTsx,
  resolveCanvasesDir,
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

const envKeys = [
  "TRELLIS_CAMPAIGN_CANVAS_DIR",
  "CURSOR_CANVAS_DIR",
] as const;

afterEach(() => {
  for (const key of envKeys) {
    delete process.env[key];
  }
  vi.restoreAllMocks();
});

describe("cursorProjectSlug", () => {
  it("maps Windows harness roots to Cursor project slugs", () => {
    expect(cursorProjectSlug("D:\\MyHarness")).toBe("d-MyHarness");
  });
});

describe("isUnderCanvasDir / evaluateCanvasWritePath", () => {
  it("detects paths under the canvases directory", () => {
    const canvasDir = path.join(os.tmpdir(), "canvases-under-test");
    const inside = path.join(canvasDir, "campaign-x.canvas.tsx");
    const outside = path.join(os.tmpdir(), "elsewhere", "campaign-x.canvas.tsx");
    expect(isUnderCanvasDir(inside, canvasDir)).toBe(true);
    expect(isUnderCanvasDir(outside, canvasDir)).toBe(false);
    expect(isUnderCanvasDir(inside, null)).toBe(false);
  });

  it("warns when outside canvases and always includes open hint", () => {
    const canvasDir = path.join(os.tmpdir(), "canvases-eval");
    const outside = path.join(os.tmpdir(), "workspace", "out.canvas.tsx");
    const evalOutside = evaluateCanvasWritePath(outside, canvasDir);
    expect(evalOutside.underCanvasDir).toBe(false);
    expect(evalOutside.warnings.some((w) => w.includes("⚠ Warning"))).toBe(
      true,
    );
    expect(evalOutside.hints.some((h) => /Canvas view/i.test(h))).toBe(true);

    const inside = path.join(canvasDir, "ok.canvas.tsx");
    const evalInside = evaluateCanvasWritePath(inside, canvasDir);
    expect(evalInside.underCanvasDir).toBe(true);
    expect(evalInside.warnings).toHaveLength(0);
    expect(evalInside.hints.length).toBeGreaterThan(0);
  });

  it("warns on workspace fallback even when path checks are soft", () => {
    const result = evaluateCanvasWritePath(
      path.join(os.tmpdir(), "fallback.canvas.tsx"),
      null,
      { usedWorkspaceFallback: true },
    );
    expect(result.usedWorkspaceFallback).toBe(true);
    expect(
      result.warnings.some((w) => w.includes("campaign-status")),
    ).toBe(true);
  });
});

describe("resolveCanvasesDir / defaultCanvasPath", () => {
  it("honors TRELLIS_CAMPAIGN_CANVAS_DIR", () => {
    const dir = path.join(os.tmpdir(), "env-canvas-dir");
    process.env.TRELLIS_CAMPAIGN_CANVAS_DIR = dir;
    expect(resolveCanvasesDir(null)).toBe(path.resolve(dir));
  });

  it("returns canvases candidate when harness is known even if projects dir is missing", () => {
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "canvas-home-"));
    const harness = "D:\\MyHarness";
    vi.spyOn(os, "homedir").mockReturnValue(fakeHome);
    const resolved = resolveCanvasesDir(harness);
    expect(resolved).toBe(
      path.join(fakeHome, ".cursor", "projects", "d-MyHarness", "canvases"),
    );
    expect(fs.existsSync(path.join(fakeHome, ".cursor", "projects"))).toBe(
      false,
    );
  });

  it("defaultCanvasPath prefers canvases over workspace when harness resolves", async () => {
    const snapshot = await composeCampaignStatus({
      parentDir: "/unused",
      loadTrellis: async () => fixtureParent,
      fetchRpcStatus: async () => {
        throw new Error("offline");
      },
    });
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "canvas-home2-"));
    vi.spyOn(os, "homedir").mockReturnValue(fakeHome);
    // parentDir with .cstl so findHarnessRoot can walk — use real harness if available
    const harnessRoot = path.resolve("D:/MyHarness");
    const out = defaultCanvasPath(snapshot, harnessRoot);
    expect(out.replace(/\\/g, "/")).toMatch(
      /\/\.cursor\/projects\/d-MyHarness\/canvases\/campaign-08-01-demo-parent\.canvas\.tsx$/,
    );
    expect(out).not.toMatch(/campaign-status/);
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
