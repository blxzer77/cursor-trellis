import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cursorProjectSlug,
  defaultCanvasPath,
  evaluateCanvasWritePath,
  isUnderCanvasDir,
  looksLikeCursorCanvasesPath,
  renderCampaignCanvasTsx,
  resolveCanvasesDir,
  shouldAutoOpenCanvas,
  softMatchCanvasesDir,
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
  "TRELLIS_CURSOR_PROJECT_SLUG",
  "TRELLIS_CAMPAIGN_CANVAS_OPEN",
  "CURSOR_BIN",
] as const;

afterEach(() => {
  for (const key of envKeys) {
    delete process.env[key];
  }
  vi.restoreAllMocks();
});

describe("cursorProjectSlug", () => {
  it("maps drive-letter roots to Cursor-style slugs (encoding only)", () => {
    expect(cursorProjectSlug("D:\\MyHarness")).toBe("d-MyHarness");
  });

  it("maps POSIX absolute paths when resolved without a Windows drive", () => {
    // On Windows, path.resolve("/home/...") becomes "<drive>:/home/..." — skip.
    if (process.platform === "win32") return;
    expect(cursorProjectSlug("/home/user/acme")).toBe("home-user-acme");
  });
});

describe("isUnderCanvasDir / looksLike / evaluateCanvasWritePath", () => {
  it("detects paths under the canvases directory", () => {
    const canvasDir = path.join(os.tmpdir(), "canvases-under-test");
    const inside = path.join(canvasDir, "campaign-x.canvas.tsx");
    const outside = path.join(os.tmpdir(), "elsewhere", "campaign-x.canvas.tsx");
    expect(isUnderCanvasDir(inside, canvasDir)).toBe(true);
    expect(isUnderCanvasDir(outside, canvasDir)).toBe(false);
    expect(isUnderCanvasDir(inside, null)).toBe(false);
  });

  it("looksLikeCursorCanvasesPath matches any ~/.cursor/projects/*/canvases file", () => {
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "canvas-like-"));
    const inside = path.join(
      fakeHome,
      ".cursor",
      "projects",
      "any-user-slug",
      "canvases",
      "campaign.canvas.tsx",
    );
    expect(looksLikeCursorCanvasesPath(inside)).toBe(true);
    expect(
      looksLikeCursorCanvasesPath(
        path.join(fakeHome, "workspace", "out.canvas.tsx"),
      ),
    ).toBe(false);
  });

  it("does not false-warn when canvasDir is null but --out is under canvases", () => {
    const under = path.join(
      os.homedir(),
      ".cursor",
      "projects",
      "user-workspace",
      "canvases",
      "campaign.canvas.tsx",
    );
    const evalUnder = evaluateCanvasWritePath(under, null);
    expect(evalUnder.underCanvasDir).toBe(true);
    expect(evalUnder.warnings).toHaveLength(0);
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

describe("softMatchCanvasesDir", () => {
  it("matches case and underscore variants, not longer nested names", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "soft-canvas-"));
    fs.mkdirSync(path.join(root, "D_Acme_App", "canvases"), { recursive: true });
    fs.mkdirSync(path.join(root, "d-Acme-App-extra", "canvases"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(root, "1234567890", "canvases"), { recursive: true });

    const matched = softMatchCanvasesDir(root, "d-Acme-App", root);
    expect(matched).toBe(path.join(root, "D_Acme_App", "canvases"));

    // No exact/normalized match → null (caller mkdir's canonical slug)
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "soft-empty-"));
    fs.mkdirSync(path.join(empty, "d-Acme-App-extra", "canvases"), {
      recursive: true,
    });
    expect(softMatchCanvasesDir(empty, "d-Acme-App", empty)).toBeNull();
  });
});

describe("resolveCanvasesDir / defaultCanvasPath", () => {
  it("honors TRELLIS_CAMPAIGN_CANVAS_DIR", () => {
    const dir = path.join(os.tmpdir(), "env-canvas-dir");
    process.env.TRELLIS_CAMPAIGN_CANVAS_DIR = dir;
    expect(resolveCanvasesDir(null)).toBe(path.resolve(dir));
  });

  it("honors TRELLIS_CURSOR_PROJECT_SLUG when harness is known", () => {
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "canvas-slug-"));
    vi.spyOn(os, "homedir").mockReturnValue(fakeHome);
    process.env.TRELLIS_CURSOR_PROJECT_SLUG = "custom-user-slug";
    const harness = path.join(fakeHome, "WhateverRoot");
    expect(resolveCanvasesDir(harness)).toBe(
      path.join(fakeHome, ".cursor", "projects", "custom-user-slug", "canvases"),
    );
  });

  it("returns canvases candidate when harness is known even if projects dir is missing", () => {
    const fakeHome = fs.mkdtempSync(path.join(os.tmpdir(), "canvas-home-"));
    const harness = path.join(fakeHome, "AcmeApp");
    vi.spyOn(os, "homedir").mockReturnValue(fakeHome);
    const slug = cursorProjectSlug(harness);
    const resolved = resolveCanvasesDir(harness);
    expect(resolved).toBe(
      path.join(fakeHome, ".cursor", "projects", slug, "canvases"),
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
    const harnessRoot = path.join(fakeHome, "PortableHarness");
    // findHarnessRoot requires .cstl/scripts/task.py (not merely .cstl/)
    const taskPy = path.join(harnessRoot, ".cstl", "scripts", "task.py");
    fs.mkdirSync(path.dirname(taskPy), { recursive: true });
    fs.writeFileSync(taskPy, "# test fixture\n", "utf8");
    vi.spyOn(os, "homedir").mockReturnValue(fakeHome);
    const slug = cursorProjectSlug(harnessRoot);
    const out = defaultCanvasPath(snapshot, harnessRoot);
    expect(out.replace(/\\/g, "/")).toBe(
      path
        .join(
          fakeHome,
          ".cursor",
          "projects",
          slug,
          "canvases",
          "campaign-08-01-demo-parent.canvas.tsx",
        )
        .replace(/\\/g, "/"),
    );
    expect(out).not.toMatch(/campaign-status/);
  });
});

describe("shouldAutoOpenCanvas", () => {
  it("respects --open and TRELLIS_CAMPAIGN_CANVAS_OPEN", () => {
    expect(shouldAutoOpenCanvas({})).toBe(false);
    expect(shouldAutoOpenCanvas({ open: true })).toBe(true);
    process.env.TRELLIS_CAMPAIGN_CANVAS_OPEN = "1";
    expect(shouldAutoOpenCanvas({})).toBe(true);
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
