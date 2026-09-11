import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { CapabilityBindingV1 } from "@blxzer/pactile-core";
import { afterEach, describe, expect, it } from "vitest";
import { buildCodexProjectionPlan } from "../../../../src/pactile/adapters/codex/index.js";
import { buildCursorProjectionPlan } from "../../../../src/pactile/adapters/cursor/index.js";
import { planBinding } from "../../../../src/pactile/adoption/bindings.js";
import { discoverSnapshot } from "../../../../src/pactile/adoption/inventory.js";
import { PactileExitManager } from "../../../../src/pactile/exit/service.js";
import { runLifecycleCommand } from "../../../../src/pactile/lifecycle/command-runner.js";
import { createDefaultLifecycleAdapters } from "../../../../src/pactile/lifecycle/default-adapters.js";
import {
  runLifecycleTransaction,
  type LifecycleGenerationFile,
} from "../../../../src/pactile/lifecycle/orchestrator.js";
import {
  fingerprintBytes,
  planProjection,
} from "../../../../src/pactile/projection/planner.js";
import { buildSharedProjectionPlan } from "../../../../src/pactile/projection/shared/index.js";
import { ProjectionStore } from "../../../../src/pactile/projection/store.js";
import {
  runProviderProbeMatrix,
  type PactileProviderProbeId,
  type ProviderProbeRunnerResult,
} from "../../../../src/pactile/providers/probes.js";
import {
  composeBatch2Plan,
  loadBatch2TileCatalog,
  type PactilePlatform,
} from "../../../../src/pactile/registry.js";
import { loadBaselineTileContent } from "../../../../src/pactile/tiles/content/baseline/index.js";
import {
  ADAPTER_CONFORMANCE_CASES,
  CAPABILITY_CONFORMANCE_CASES,
  FAULT_CONFORMANCE_CASES,
  HOST_CONFORMANCE_CASES,
  OWNERSHIP_CONFORMANCE_CASES,
  type AdapterConformanceCase,
  type AdapterConformanceMode,
} from "./cases.js";

const occurredAt = "2026-09-11T00:00:00.000Z";
const runtimeVersion = "0.5.0";
const generationFiles: readonly LifecycleGenerationFile[] = [
  { path: ".version", bytes: Buffer.from(`${runtimeVersion}\n`) },
  { path: "framework/index.md", bytes: Buffer.from("# Framework\n") },
  { path: "workflow.md", bytes: Buffer.from("# Workflow\n") },
];
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

function temporaryRoot(label: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `p45-adapter-${label}-`));
  roots.push(root);
  return root;
}

function absolute(root: string, relative: string): string {
  return path.join(root, ...relative.split("/"));
}

function write(root: string, relative: string, contents: string): void {
  const target = absolute(root, relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, contents);
}

function read(root: string, relative: string): string {
  return fs.readFileSync(absolute(root, relative), "utf8");
}

function hostTree(root: string): Record<string, string> {
  const result: Record<string, string> = {};
  const visit = (relative: string): void => {
    const target = absolute(root, relative);
    if (!fs.existsSync(target)) return;
    const stat = fs.lstatSync(target);
    if (stat.isFile()) {
      result[relative] = fs.readFileSync(target, "utf8");
      return;
    }
    for (const name of fs.readdirSync(target).sort())
      visit(relative ? `${relative}/${name}` : name);
  };
  for (const relative of ["AGENTS.md", ".agents", ".cursor", ".codex"])
    visit(relative);
  return Object.fromEntries(
    Object.entries(result).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function ownedBinding(
  platform: PactilePlatform,
  tileId = "intake-basic",
): CapabilityBindingV1 {
  const asset = discoverSnapshot({
    context: {
      hostId: platform,
      rootId: "project",
      source: "pactile-bundled",
      scope: "project",
      owner: { kind: "pactile", id: "pactile" },
    },
    assets: [
      {
        id: tileId,
        kind: "skill",
        locatorToken: tileId,
        present: true,
        enabled: true,
      },
    ],
  }).assets[0];
  const proposal = planBinding({
    asset,
    capabilityId: tileId,
    intents: ["exact"],
  });
  if (!proposal.binding) throw new Error(JSON.stringify(proposal));
  return proposal.binding;
}

function sharedInputs(platform: PactilePlatform) {
  const loaded = loadBaselineTileContent();
  if (!loaded.success) throw new Error(JSON.stringify(loaded.diagnostics));
  const tile = loaded.data.find(
    ({ manifest }) => manifest.identity.id === "intake-basic",
  );
  if (!tile) throw new Error("missing intake-basic fixture");
  const shared = buildSharedProjectionPlan({
    adapterId: `adapter.${platform}`,
    claimantId: `adapter.${platform}`,
    generationId: "generation-adapter-conformance",
    canonicalFingerprint: fingerprintBytes("canonical"),
    updatedAt: occurredAt,
    action: "attach",
    ledger: null,
    claims: [
      {
        tile: tile.manifest,
        binding: ownedBinding(platform),
        skillBody: tile.skillText,
      },
    ],
    surfaces: [{ targetPath: "AGENTS.md", content: null }],
  });
  if (shared.status !== "ready") throw new Error(JSON.stringify(shared));
  return shared.inputs;
}

interface ObservedCapability {
  readonly mode: AdapterConformanceMode;
  readonly evidence: string;
  readonly ownership: AdapterConformanceCase["expectedOwnership"];
  readonly userAction: string;
}

function externalClaimEvidence(
  result:
    | ReturnType<typeof buildCursorProjectionPlan>
    | ReturnType<typeof buildCodexProjectionPlan>,
  mode: "native" | "provider",
): ObservedCapability {
  if (result.status !== "ready") throw new Error(JSON.stringify(result));
  const preview = planProjection(result.inputs);
  if (preview.status !== "ready") throw new Error(JSON.stringify(preview));
  const claim = preview.externalClaims[0];
  if (!claim) throw new Error("missing external claim evidence");
  return {
    mode,
    evidence: `external-claim:${claim.resourceId}`,
    ownership: "borrowed",
    userAction: "none",
  };
}

async function observeCapability(
  testCase: (typeof CAPABILITY_CONFORMANCE_CASES)[number],
): Promise<ObservedCapability> {
  if (testCase.id === "capability.cursor-hooks-native")
    return externalClaimEvidence(
      buildCursorProjectionPlan({
        shared: sharedInputs("cursor"),
        hostCapabilities: { hooks: true },
        composition: ["hooks"],
        nativeBindings: { hooks: ["fixture-hook"] },
      }),
      "native",
    );
  if (testCase.id === "capability.cursor-mcp-provider")
    return externalClaimEvidence(
      buildCursorProjectionPlan({
        shared: sharedInputs("cursor"),
        hostCapabilities: { mcp: true },
        composition: ["mcp"],
        providerIds: ["provider-fixture"],
      }),
      "provider",
    );
  if (testCase.id === "capability.codex-hooks-native")
    return externalClaimEvidence(
      buildCodexProjectionPlan({
        shared: sharedInputs("codex"),
        appReadiness: "ready",
        supportsHooks: true,
        composition: ["hooks"],
        nativeBindings: { hooks: ["fixture-hook"] },
      }),
      "native",
    );
  if (testCase.id === "capability.codex-mcp-provider")
    return externalClaimEvidence(
      buildCodexProjectionPlan({
        shared: sharedInputs("codex"),
        appReadiness: "ready",
        composition: ["mcp"],
        providerIds: ["provider-fixture"],
      }),
      "provider",
    );
  if (testCase.id === "capability.codex-app-degraded") {
    const result = buildCodexProjectionPlan({
      shared: sharedInputs("codex"),
      appReadiness: "degraded",
      composition: [],
    });
    if (result.status !== "degraded") throw new Error(JSON.stringify(result));
    return {
      mode: "degraded",
      evidence: `probe-hint:${result.probeHints[0].code}`,
      ownership: "pactile-owned",
      userAction: "restore-or-authenticate-chatgpt-desktop-app",
    };
  }
  if (testCase.id === "capability.cursor-rules-unsupported") {
    const result = buildCursorProjectionPlan({
      shared: sharedInputs("cursor"),
      hostCapabilities: { rules: false },
      composition: ["rules"],
    });
    if (result.status !== "unsupported")
      throw new Error(JSON.stringify(result));
    const diagnostic = result.diagnostics[0];
    return {
      mode: "unsupported",
      evidence: `diagnostic:${diagnostic.code}:${diagnostic.capability}`,
      ownership: "preserved",
      userAction: "enable-a-supported-cursor-rules-surface",
    };
  }

  const probeByCase: Record<
    string,
    {
      providerId: PactileProviderProbeId;
      result: ProviderProbeRunnerResult;
    }
  > = {
    "capability.provider-heuristic": {
      providerId: "cursor-semantic",
      result: {
        exitCode: 0,
        observedAt: occurredAt,
        capabilityAvailable: true,
      },
    },
    "capability.provider-degraded": {
      providerId: "cursor-semantic",
      result: {
        exitCode: 0,
        observedAt: occurredAt,
        capabilityAvailable: false,
      },
    },
    "capability.provider-unavailable": {
      providerId: "codex-explorer",
      result: { exitCode: 127, observedAt: occurredAt },
    },
    "capability.assurance-evidence-backed": {
      providerId: "smart-search",
      result: {
        exitCode: 0,
        observedAt: occurredAt,
        capabilityAvailable: true,
      },
    },
  };
  const fixture = probeByCase[testCase.id];
  if (!fixture) throw new Error(`unhandled capability case ${testCase.id}`);
  const matrix = await runProviderProbeMatrix(
    { providerIds: [fixture.providerId] },
    {
      now: () => occurredAt,
      run: () => fixture.result,
    },
  );
  if (!matrix.ok) throw new Error(JSON.stringify(matrix));
  const probe = matrix.probes[0];
  const mode: AdapterConformanceMode =
    probe.status === "unavailable"
      ? "unsupported"
      : probe.status === "degraded"
        ? "degraded"
        : probe.assurance === "best-effort"
          ? "heuristic"
          : "provider";
  return {
    mode,
    evidence: probe.evidence.reference,
    ownership: mode === "unsupported" ? "preserved" : "borrowed",
    userAction: probe.remediation,
  };
}

describe("Pactile Adapter conformance matrix", () => {
  it("is complete, explicit, and permits unsupported only for non-core rows", () => {
    expect(ADAPTER_CONFORMANCE_CASES).toHaveLength(20);
    expect(new Set(ADAPTER_CONFORMANCE_CASES.map(({ id }) => id)).size).toBe(
      ADAPTER_CONFORMANCE_CASES.length,
    );
    expect(
      HOST_CONFORMANCE_CASES.map(
        ({ installOrder, repeatUpdate }) =>
          `${installOrder.join("->")}${repeatUpdate ? ":repeat-update" : ""}`,
      ),
    ).toEqual([
      "cursor",
      "codex",
      "cursor->codex",
      "codex->cursor",
      "cursor->codex:repeat-update",
    ]);
    expect(
      new Set(
        ADAPTER_CONFORMANCE_CASES.map(({ expectedMode }) => expectedMode),
      ),
    ).toEqual(
      new Set(["native", "provider", "heuristic", "degraded", "unsupported"]),
    );
    expect(
      new Set(ADAPTER_CONFORMANCE_CASES.map(({ capability }) => capability)),
    ).toEqual(
      new Set([
        "skills-agents",
        "hooks",
        "mcp",
        "rules",
        "assurance",
        "projection-recovery",
      ]),
    );
    expect(
      new Set(
        ADAPTER_CONFORMANCE_CASES.map(
          ({ preexistingState }) => preexistingState,
        ),
      ),
    ).toEqual(new Set(["none", "foreign", "modified", "borrowed", "shared"]));
    for (const testCase of ADAPTER_CONFORMANCE_CASES) {
      expect(testCase.hosts.length).toBeGreaterThan(0);
      expect(testCase.installOrder.length).toBeGreaterThan(0);
      expect(testCase.expectedEvidence).not.toBe("");
      if (
        testCase.expectedMode === "degraded" ||
        testCase.expectedMode === "unsupported"
      )
        expect(testCase.userAction).not.toBe("none");
      if (testCase.expectedMode === "unsupported")
        expect(testCase.nonCore).toBe(true);
    }
  });

  it.each(HOST_CONFORMANCE_CASES)(
    "$id executes the declared host order without leaking ownership",
    async (testCase) => {
      const root = temporaryRoot(testCase.id.replaceAll(".", "-"));
      write(root, "AGENTS.md", "# User policy\n\nkeep-this-rule\n");
      let result: Awaited<ReturnType<typeof runLifecycleCommand>> | null = null;
      for (const [index, platform] of testCase.installOrder.entries())
        result = await runLifecycleCommand({
          projectRoot: root,
          operation: index === 0 ? "init" : "reconcile",
          runtimeVersion,
          files: generationFiles,
          platforms: [platform],
          occurredAt,
        });
      if (!result) throw new Error("host case did not execute");
      expect(result.status).toBe("completed");

      const store = new ProjectionStore(root);
      const ledger = store.readLedger();
      if (!ledger) throw new Error("missing ownership ledger");
      const expectedAdapters = testCase.hosts
        .map((host) => `adapter.${host}`)
        .sort();
      expect(
        result.installState?.state.installedAdapters
          .filter(({ status }) => status === "active")
          .map(({ id }) => id)
          .sort(),
      ).toEqual(expectedAdapters);
      for (const adapter of result.installState?.state.installedAdapters ??
        []) {
        if (adapter.status !== "active") continue;
        const verification = store.verifyAdapterState(
          adapter.id,
          adapter.lastProjectionFingerprint,
        );
        expect(verification.status, JSON.stringify(verification)).toBe(
          "applied",
        );
      }
      const shared = ledger.ledger.entries.filter(({ resourceId }) =>
        resourceId.startsWith("shared."),
      );
      expect(shared.length).toBeGreaterThan(1);
      expect(
        shared.every(
          ({ owner, claimants }) =>
            owner.kind === "pactile" &&
            expectedAdapters.every((id) =>
              claimants.some((claimant) => claimant.id === id),
            ),
        ),
      ).toBe(true);
      expect(read(root, "AGENTS.md")).toContain("keep-this-rule");
      expect(
        read(root, "AGENTS.md").match(/<!-- PACTILE:START -->/g),
      ).toHaveLength(1);
      expect(fs.existsSync(absolute(root, ".cursor/commands/pactile.md"))).toBe(
        testCase.hosts.includes("cursor"),
      );
      expect(fs.existsSync(absolute(root, ".codex"))).toBe(false);

      let evidence = "ownership-ledger+projection-receipt";
      if ("repeatUpdate" in testCase && testCase.repeatUpdate) {
        const beforeTree = hostTree(root);
        const beforeLedger = ledger.fingerprint;
        for (let index = 0; index < 2; index += 1) {
          const repeated = await runLifecycleCommand({
            projectRoot: root,
            operation: "update",
            runtimeVersion,
            files: generationFiles,
            platforms: testCase.hosts,
            occurredAt,
          });
          expect(repeated.status).toBe("completed");
          expect(hostTree(root)).toEqual(beforeTree);
          expect(new ProjectionStore(root).readLedger()?.fingerprint).toBe(
            beforeLedger,
          );
        }
        evidence = "stable-ledger+stable-host-tree";
      }
      expect({
        mode: "native",
        evidence,
        ownership: expectedAdapters.length > 1 ? "shared" : "pactile-owned",
        userAction: "none",
      }).toEqual({
        mode: testCase.expectedMode,
        evidence: testCase.expectedEvidence,
        ownership: testCase.expectedOwnership,
        userAction: testCase.userAction,
      });
    },
  );

  it.each(CAPABILITY_CONFORMANCE_CASES)(
    "$id exposes mode, evidence, ownership, and recovery action",
    async (testCase) => {
      const observed = await observeCapability(testCase);
      expect(observed).toEqual({
        mode: testCase.expectedMode,
        evidence: testCase.expectedEvidence,
        ownership: testCase.expectedOwnership,
        userAction: testCase.userAction,
      });
    },
  );

  it.each(OWNERSHIP_CONFORMANCE_CASES)(
    "$id preserves foreign, modified, borrowed, and shared state",
    async (testCase) => {
      const root = temporaryRoot(testCase.id.replaceAll(".", "-"));
      if (testCase.id === "ownership.foreign-skill") {
        const foreign = "# User-owned intake\n\ndo not replace\n";
        write(root, ".agents/skills/intake-basic/SKILL.md", foreign);
        const result = await runLifecycleCommand({
          projectRoot: root,
          operation: "init",
          runtimeVersion,
          files: generationFiles,
          platforms: ["cursor"],
          occurredAt,
        });
        expect(result.status).toBe("degraded");
        expect(read(root, ".agents/skills/intake-basic/SKILL.md")).toBe(
          foreign,
        );
        expect(result.adapters).toEqual([
          expect.objectContaining({
            adapterId: "adapter.cursor",
            status: "failed",
            reason: "whole-file-not-owned",
          }),
        ]);
        expect({
          mode: "degraded",
          evidence: `adapter-result:${result.adapters[0]?.reason}`,
          ownership: "preserved",
          userAction: "review-the-foreign-skill-before-adoption",
        }).toEqual({
          mode: testCase.expectedMode,
          evidence: testCase.expectedEvidence,
          ownership: testCase.expectedOwnership,
          userAction: testCase.userAction,
        });
        return;
      }
      if (testCase.id === "ownership.modified-skill") {
        const first = await runLifecycleCommand({
          projectRoot: root,
          operation: "init",
          runtimeVersion,
          files: generationFiles,
          platforms: ["cursor"],
          occurredAt,
        });
        expect(first.status).toBe("completed");
        const relative = ".agents/skills/intake-basic/SKILL.md";
        const modified = `${read(root, relative)}\nuser modification\n`;
        write(root, relative, modified);
        const update = await runLifecycleCommand({
          projectRoot: root,
          operation: "update",
          runtimeVersion,
          files: generationFiles,
          platforms: ["cursor"],
          occurredAt,
        });
        expect(update.status).toBe("degraded");
        expect(read(root, relative)).toBe(modified);
        expect(update.adapters).toEqual([
          expect.objectContaining({
            adapterId: "adapter.cursor",
            status: "failed",
            reason: "whole-file-not-owned",
          }),
        ]);
        expect({
          mode: "degraded",
          evidence: `adapter-result:${update.adapters[0]?.reason}`,
          ownership: "preserved",
          userAction: "review-the-user-modification-before-reconcile",
        }).toEqual({
          mode: testCase.expectedMode,
          evidence: testCase.expectedEvidence,
          ownership: testCase.expectedOwnership,
          userAction: testCase.userAction,
        });
        return;
      }
      if (testCase.id === "ownership.borrowed-skill") {
        const catalog = loadBatch2TileCatalog();
        if (!catalog.success)
          throw new Error(JSON.stringify(catalog.diagnostics));
        const tile = catalog.data.entries.find(
          ({ manifest }) => manifest.identity.id === "intake-basic",
        );
        if (!tile) throw new Error("missing intake-basic fixture");
        const asset = discoverSnapshot({
          context: {
            hostId: "codex",
            rootId: "user-tools",
            source: "user-installed",
            scope: "user",
            owner: { kind: "user", id: null },
          },
          assets: [
            {
              id: "user-intake",
              kind: "skill",
              locatorToken: "user-intake",
              present: true,
              enabled: true,
            },
          ],
        }).assets[0];
        const binding = planBinding({
          asset,
          capabilityId: "intake-basic",
          intents: ["exact"],
        }).binding;
        if (!binding) throw new Error("missing borrowed binding");
        const composed = composeBatch2Plan({
          platform: "codex",
          catalog: catalog.data,
          selection: {
            requestedSelection: ["intake-basic"],
            capabilities: [],
          },
          shared: {
            generationId: "generation-borrowed",
            canonicalFingerprint: fingerprintBytes("canonical"),
            updatedAt: occurredAt,
            action: "attach",
            ledger: null,
            claims: [{ tile: tile.manifest, binding }],
            surfaces: [{ targetPath: "AGENTS.md", content: null }],
          },
          adapter: { appReadiness: "ready", composition: [] },
        });
        expect(composed.status).toBe("ready");
        if (composed.status !== "ready")
          throw new Error(JSON.stringify(composed));
        const store = new ProjectionStore(root);
        const preview = store.inspect({
          plan: composed.projection.plan,
          canonicalFingerprint: composed.projection.canonicalFingerprint,
          updatedAt: composed.projection.updatedAt,
          resolveContent: composed.projection.resolveContent,
          externalClaims: composed.projection.externalClaims,
        });
        expect(preview.status).toBe("ready");
        if (preview.status !== "ready") throw new Error(preview.reason);
        expect(preview.externalClaims).toEqual([
          {
            resourceId: "shared.skill.user-intake",
            externalAssetId: "user-intake",
            claimants: ["adapter.codex"],
          },
        ]);
        expect(store.apply(preview).status).toBe("applied");
        expect(
          fs.existsSync(absolute(root, ".agents/skills/user-intake/SKILL.md")),
        ).toBe(false);
        expect({
          mode: "provider",
          evidence: `external-claim:${preview.externalClaims[0]?.resourceId}`,
          ownership: "borrowed",
          userAction: "none",
        }).toEqual({
          mode: testCase.expectedMode,
          evidence: testCase.expectedEvidence,
          ownership: testCase.expectedOwnership,
          userAction: testCase.userAction,
        });
        return;
      }

      const installed = await runLifecycleCommand({
        projectRoot: root,
        operation: "init",
        runtimeVersion,
        files: generationFiles,
        platforms: ["cursor", "codex"],
        occurredAt,
      });
      expect(installed.status).toBe("completed");
      const exit = new PactileExitManager(root, { now: () => occurredAt });
      const detach = exit.planDetach("adapter.cursor");
      expect(detach.status).toBe("ready");
      if (detach.status !== "ready") throw new Error(detach.reason);
      expect(exit.applyDetach(detach).status).toBe("applied");
      const ledger = new ProjectionStore(root).readLedger()?.ledger;
      if (!ledger) throw new Error("missing detached ledger");
      expect(
        ledger.entries
          .filter(({ resourceId }) => resourceId.startsWith("shared."))
          .every(({ claimants }) =>
            claimants.some(({ id }) => id === "adapter.codex"),
          ),
      ).toBe(true);
      expect(
        ledger.entries.every(({ claimants }) =>
          claimants.every(({ id }) => id !== "adapter.cursor"),
        ),
      ).toBe(true);
      expect(
        fs.existsSync(absolute(root, ".agents/skills/intake-basic/SKILL.md")),
      ).toBe(true);
      expect(fs.existsSync(absolute(root, ".cursor/commands/pactile.md"))).toBe(
        false,
      );
      expect(fs.existsSync(absolute(root, ".cursor/rules/pactile.mdc"))).toBe(
        false,
      );
      expect(fs.existsSync(absolute(root, ".cursor/agents/pactile.md"))).toBe(
        false,
      );
      expect({
        mode: "native",
        evidence: "ledger-claimant:adapter.codex",
        ownership: "shared",
        userAction: "none",
      }).toEqual({
        mode: testCase.expectedMode,
        evidence: testCase.expectedEvidence,
        ownership: testCase.expectedOwnership,
        userAction: testCase.userAction,
      });
    },
  );

  it.each(FAULT_CONFORMANCE_CASES)(
    "$id commits canonical truth, isolates the failed host, and retries only that host",
    async (testCase) => {
      class BusyProjectionStore extends ProjectionStore {
        override recover(): ReturnType<ProjectionStore["recover"]> {
          return { status: "busy", reason: "fixture-busy" };
        }
      }

      const root = temporaryRoot(testCase.id.replaceAll(".", "-"));
      const generationId = "generation.adapter-conformance.busy";
      const adapters = createDefaultLifecycleAdapters(
        root,
        generationId,
        runtimeVersion,
        ["cursor", "codex"],
      );
      const request = {
        projectRoot: root,
        id: "lifecycle.adapter-conformance.busy",
        generationId,
        runtimeVersion,
        expectedInstallStateFingerprint: null,
        occurredAt,
        source: { kind: "fresh" as const, files: generationFiles },
        adapters,
      };
      const degraded = await runLifecycleTransaction(request, {
        projectionStore: (projectRoot, adapterId) =>
          adapterId === "adapter.codex"
            ? new BusyProjectionStore(projectRoot)
            : new ProjectionStore(projectRoot),
      });
      expect(degraded.status).toBe("degraded");
      expect(degraded.generationFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
      expect(degraded.adapters).toEqual([
        expect.objectContaining({
          adapterId: "adapter.codex",
          status: "failed",
          reason: "projection-busy",
          retryable: true,
          attempts: 1,
        }),
        expect.objectContaining({
          adapterId: "adapter.cursor",
          status: "succeeded",
          attempts: 1,
        }),
      ]);
      const recovered = await runLifecycleTransaction(request);
      expect(recovered.status).toBe("completed");
      expect(recovered.adapters).toEqual([
        expect.objectContaining({
          adapterId: "adapter.codex",
          status: "succeeded",
          attempts: 2,
        }),
        expect.objectContaining({
          adapterId: "adapter.cursor",
          status: "succeeded",
          attempts: 1,
        }),
      ]);
      expect({
        mode: degraded.status,
        evidence: `adapter-result:${degraded.adapters[0]?.adapterId}:retryable`,
        ownership: "pactile-owned",
        userAction: "retry-the-failed-adapter",
      }).toEqual({
        mode: testCase.expectedMode,
        evidence: testCase.expectedEvidence,
        ownership: testCase.expectedOwnership,
        userAction: testCase.userAction,
      });
    },
  );
});
