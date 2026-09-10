import { describe, expect, it } from "vitest";
import { runAdoptionWorkflow } from "../../../src/pactile/adoption/workflow.js";

function discovery(present = true) {
  return {
    context: {
      hostId: "cursor",
      rootId: "project-skills",
      source: "host-native" as const,
      scope: "host" as const,
      owner: { kind: "host" as const, id: "cursor" },
    },
    assets: [
      {
        id: "native-skill",
        kind: "skill" as const,
        locatorToken: "native-skill",
        present,
        enabled: present,
      },
    ],
  };
}

describe("capability adoption workflow public seam", () => {
  it("runs discover -> adopt -> bind -> doctor -> detach without copying borrowed assets", () => {
    const result = runAdoptionWorkflow({
      discovery: discovery(),
      assetId: "native-skill",
      capabilityId: "native-skill",
      claimantId: "adapter.cursor",
      providerId: null,
      intents: ["exact"],
      claims: [],
      detach: true,
    });
    expect(result.status).toBe("complete");
    expect(result.binding?.control).toBe("borrowed");
    expect(result.binding?.deleteBoundary).toBe("preserve");
    expect(result.preserveExternalAsset).toBe(true);
    expect(result.operations.map(({ action }) => action)).toEqual([
      "bind",
      "detach",
    ]);
    expect(result.claims).toEqual([
      {
        resourceId: "adoption.native-skill",
        externalAssetId: "native-skill",
        claimants: [],
      },
    ]);
    expect(result.steps.map(({ phase }) => phase)).toEqual([
      "discover",
      "adopt",
      "bind",
      "doctor",
      "detach",
    ]);
    expect(JSON.stringify(result)).not.toMatch(
      /canary|super-secret|access[_-]?token|oauth_state|password=/i,
    );
  });

  it("returns a safe degraded result for a missing asset and preserves the host-owned boundary", () => {
    const result = runAdoptionWorkflow({
      discovery: discovery(false),
      assetId: "native-skill",
      capabilityId: "native-skill",
      claimantId: "adapter.cursor",
      providerId: null,
      intents: ["exact"],
      claims: [],
      detach: false,
    });
    expect(result.status).toBe("degraded");
    expect(result.diagnostics).toEqual(["adoption-unavailable"]);
    expect(result.binding).toBeNull();
    expect(result.operations).toEqual([]);
    expect(result.remediation).toEqual(["install.skill"]);
    expect(result.preserveExternalAsset).toBe(true);
  });

  it("routes Pactile-owned assets to shared projection instead of borrowing them", () => {
    const result = runAdoptionWorkflow({
      discovery: {
        context: {
          hostId: "pactile",
          rootId: "project-skills",
          source: "pactile-bundled",
          scope: "project",
          owner: { kind: "pactile", id: "pactile" },
        },
        assets: [
          {
            id: "owned-skill",
            kind: "skill",
            locatorToken: "owned-skill",
            present: true,
            enabled: true,
          },
        ],
      },
      assetId: "owned-skill",
      capabilityId: "owned-skill",
      claimantId: "adapter.codex",
      providerId: null,
      intents: ["exact"],
      claims: [],
      detach: false,
    });
    expect(result).toMatchObject({
      status: "degraded",
      diagnostics: ["owned-projection-required"],
      binding: {
        control: "pactile-owned",
        deleteBoundary: "remove-when-unclaimed",
      },
      operations: [],
      claims: [],
      preserveExternalAsset: false,
      remediation: ["route-owned-asset-through-shared-projection"],
    });
  });
});
