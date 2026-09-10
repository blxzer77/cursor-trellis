import { describe, expect, it } from "vitest";
import type { CapabilityBindingV1 } from "@blxzer/cursor-trellis-core";
import { planBinding } from "../../../src/pactile/adoption/bindings.js";
import { discoverSnapshot } from "../../../src/pactile/adoption/inventory.js";
import {
  buildCursorProjectionPlan,
  type CursorProjectionCapability,
} from "../../../src/pactile/adapters/cursor/index.js";
import { fingerprintBytes, planProjection } from "../../../src/pactile/projection/planner.js";
import { buildSharedProjectionPlan } from "../../../src/pactile/projection/shared/index.js";
import { loadBaselineTileContent } from "../../../src/pactile/tiles/content/baseline/index.js";

function ownedSkill(): CapabilityBindingV1 {
  const asset = discoverSnapshot({
    context: {
      hostId: "cursor",
      rootId: "project",
      source: "pactile-bundled",
      scope: "project",
      owner: { kind: "pactile", id: "pactile" },
    },
    assets: [
      {
        id: "intake-basic",
        kind: "skill",
        locatorToken: "intake-basic",
        present: true,
        enabled: true,
      },
    ],
  }).assets[0];
  const proposal = planBinding({
    asset,
    capabilityId: "intake-basic",
    intents: ["exact"],
  });
  if (!proposal.binding) throw new Error(JSON.stringify(proposal));
  return proposal.binding;
}

function shared() {
  const loaded = loadBaselineTileContent();
  if (!loaded.success) throw new Error(JSON.stringify(loaded.diagnostics));
  const tile = loaded.data.find(
    ({ manifest }) => manifest.identity.id === "intake-basic",
  );
  if (!tile) throw new Error("missing fixture Tile");
  const result = buildSharedProjectionPlan({
    adapterId: "adapter.cursor",
    claimantId: "adapter.cursor",
    generationId: "generation-b2",
    canonicalFingerprint: fingerprintBytes("canonical"),
    updatedAt: "2026-09-10T00:00:00.000Z",
    action: "attach",
    ledger: null,
    claims: [{ tile: tile.manifest, binding: ownedSkill(), skillBody: tile.skillText }],
    surfaces: [{ targetPath: "AGENTS.md", content: null }],
  });
  if (result.status !== "ready") throw new Error(JSON.stringify(result));
  return result.inputs;
}

const capabilities = {
  commands: true,
  rules: true,
  agents: true,
  hooks: true,
  mcp: true,
} as const;

describe("Cursor projection adapter public seam", () => {
  it("projects only the selected native leaves and binds hooks/MCP without inventing registration", () => {
    const request = {
      shared: shared(),
      hostCapabilities: capabilities,
      composition: ["commands", "rules", "agents", "hooks", "mcp"] as CursorProjectionCapability[],
      providerIds: ["provider.local"],
      nativeBindings: { hooks: ["cursor-hooks"] },
      surfaces: [
        { targetPath: ".cursor/hooks.json", content: '{"unknown":{"keep":true}}' },
        { targetPath: ".cursor/mcp.json", content: '{"unknown":{"keep":true}}' },
      ],
    };
    const built = buildCursorProjectionPlan(request);
    expect(built.status).toBe("ready");
    if (built.status !== "ready") throw new Error(JSON.stringify(built));
    const preview = planProjection(built.inputs);
    expect(preview.status).toBe("ready");
    if (preview.status !== "ready") throw new Error(JSON.stringify(preview));
    expect(preview.mutations.map(({ targetPath }) => targetPath).sort()).toEqual(
      [
        ".agents/skills/intake-basic/SKILL.md",
        ".cursor/agents/pactile.md",
        ".cursor/commands/pactile.md",
        ".cursor/rules/pactile.mdc",
        "AGENTS.md",
      ].sort(),
    );
    expect(preview.externalClaims).toEqual([
      {
        resourceId: "cursor.native.hooks.cursor-hooks",
        externalAssetId: "cursor-hooks",
        claimants: ["adapter.cursor"],
      },
      {
        resourceId: "cursor.native.mcp.provider.local",
        externalAssetId: "provider.local",
        claimants: ["adapter.cursor"],
      },
    ]);
    expect(
      preview.mutations.some(({ targetPath }) => targetPath === ".cursor/hooks.json"),
    ).toBe(false);
    expect(
      preview.mutations.some(({ targetPath }) => targetPath === ".cursor/mcp.json"),
    ).toBe(false);
    const serializedPlan = JSON.stringify(built.inputs.plan);
    expect(serializedPlan).not.toMatch(/cursor\+\+|[a-z]:[\\/]|secret|token|command.*serve/i);
  });

  it("is composition-driven and reports unsupported or missing native leaves explicitly", () => {
    const base = {
      shared: shared(),
      hostCapabilities: capabilities,
      composition: ["commands"] as const,
    };
    const minimal = buildCursorProjectionPlan(base);
    expect(minimal.status).toBe("ready");
    if (minimal.status !== "ready") throw new Error(JSON.stringify(minimal));
    const preview = planProjection(minimal.inputs);
    expect(preview.status).toBe("ready");
    if (preview.status !== "ready") throw new Error(JSON.stringify(preview));
    expect(preview.mutations.map(({ targetPath }) => targetPath)).toContain(
      ".cursor/commands/pactile.md",
    );
    expect(preview.mutations.map(({ targetPath }) => targetPath)).not.toContain(
      ".cursor/rules/pactile.mdc",
    );

    expect(
      buildCursorProjectionPlan({
        ...base,
        composition: ["rules"],
        hostCapabilities: { ...capabilities, rules: false },
      }),
    ).toEqual({
      status: "unsupported",
      diagnostics: [{ code: "unsupported-capability", capability: "rules" }],
    });

    const degraded = buildCursorProjectionPlan({
      ...base,
      composition: ["hooks"],
    });
    expect(degraded.status).toBe("degraded");
    if (degraded.status !== "degraded") throw new Error(JSON.stringify(degraded));
    expect(degraded.diagnostics).toEqual([
      { code: "native-binding-required", capability: "hooks" },
    ]);
  });
});
