import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  canonicalizePactileJsonV1,
  type OwnershipLedgerV1,
  type ProjectionPlanV1,
} from "@blxzer/pactile-core";
import { afterEach, describe, expect, it } from "vitest";
import { buildCodexProjectionPlan } from "../../../src/pactile/adapters/codex/index.js";
import { PactileExitManager } from "../../../src/pactile/exit/service.js";
import { createDefaultLifecycleAdapters } from "../../../src/pactile/lifecycle/default-adapters.js";
import { runLifecycleCommand } from "../../../src/pactile/lifecycle/command-runner.js";
import {
  runLifecycleTransaction,
  type LifecycleGenerationFile,
} from "../../../src/pactile/lifecycle/orchestrator.js";
import {
  fingerprintBytes,
  type ProjectionInputs,
} from "../../../src/pactile/projection/planner.js";
import { ProjectionStore } from "../../../src/pactile/projection/store.js";
import type { PactilePlatform } from "../../../src/pactile/registry.js";
import { InstallStateStore } from "../../../src/pactile/runtime/stores.js";

const occurredAt = "2026-09-10T09:00:00.000Z";
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
  const root = fs.mkdtempSync(path.join(os.tmpdir(), `p45-coexist-${label}-`));
  roots.push(root);
  return root;
}

function readHostTree(projectRoot: string): Record<string, string> {
  const result: Record<string, string> = {};
  const visit = (relative: string): void => {
    const absolute = path.join(projectRoot, ...relative.split("/"));
    if (!fs.existsSync(absolute)) return;
    const stat = fs.lstatSync(absolute);
    if (stat.isFile()) {
      result[relative] = fs.readFileSync(absolute, "utf8");
      return;
    }
    for (const name of fs.readdirSync(absolute).sort())
      visit(relative ? `${relative}/${name}` : name);
  };
  for (const relative of ["AGENTS.md", ".agents", ".cursor", ".codex"])
    visit(relative);
  return Object.fromEntries(
    Object.entries(result).sort(([left], [right]) => left.localeCompare(right)),
  );
}

function semanticLedger(projectRoot: string): OwnershipLedgerV1 {
  const ledger = new ProjectionStore(projectRoot).readLedger()?.ledger;
  if (!ledger) throw new Error("missing ownership ledger");
  return {
    ...ledger,
    updatedAt: "<normalized>",
    entries: ledger.entries.map((entry) => ({
      ...entry,
      claimants: [...entry.claimants].sort((left, right) =>
        left.id.localeCompare(right.id),
      ),
    })),
  };
}

async function installInOrder(
  projectRoot: string,
  order: readonly [PactilePlatform, PactilePlatform],
) {
  const first = await runLifecycleCommand({
    projectRoot,
    operation: "init",
    runtimeVersion,
    files: generationFiles,
    platforms: [order[0]],
    occurredAt,
  });
  expect(first.status).toBe("completed");
  const second = await runLifecycleCommand({
    projectRoot,
    operation: "reconcile",
    runtimeVersion,
    files: generationFiles,
    platforms: [order[1]],
    occurredAt,
  });
  expect(second.status).toBe("completed");
  return second;
}

describe("Pactile Cursor/Codex coexistence matrix", () => {
  it("is order-independent, repeat-idempotent, and preserves shared claimants across detach/re-attach", async () => {
    const cursorFirst = temporaryRoot("cursor-first");
    const codexFirst = temporaryRoot("codex-first");
    const left = await installInOrder(cursorFirst, ["cursor", "codex"]);
    const right = await installInOrder(codexFirst, ["codex", "cursor"]);
    expect(left.generationFingerprint).toBe(right.generationFingerprint);
    expect(left.installState.state.generationId).toBe(
      right.installState.state.generationId,
    );
    expect(canonicalizePactileJsonV1(semanticLedger(cursorFirst))).toBe(
      canonicalizePactileJsonV1(semanticLedger(codexFirst)),
    );
    expect(readHostTree(cursorFirst)).toEqual(readHostTree(codexFirst));

    const beforeLedger = new ProjectionStore(cursorFirst).readLedger()
      ?.fingerprint;
    const beforeHost = readHostTree(cursorFirst);
    const repeated = await runLifecycleCommand({
      projectRoot: cursorFirst,
      operation: "reconcile",
      runtimeVersion,
      files: generationFiles,
      platforms: ["cursor", "codex"],
      occurredAt,
    });
    expect(repeated.status).toBe("completed");
    expect(new ProjectionStore(cursorFirst).readLedger()?.fingerprint).toBe(
      beforeLedger,
    );
    expect(readHostTree(cursorFirst)).toEqual(beforeHost);
    const repeatFingerprint = repeated.installState.fingerprint;
    const replay = await runLifecycleCommand({
      projectRoot: cursorFirst,
      operation: "reconcile",
      runtimeVersion,
      files: generationFiles,
      platforms: ["cursor", "codex"],
      occurredAt,
    });
    expect(replay.status).toBe("completed");
    expect(replay.installState.fingerprint).toBe(repeatFingerprint);
    expect(
      (readHostTree(cursorFirst)["AGENTS.md"] ?? "").match(
        /<!-- PACTILE:START -->/g,
      ),
    ).toHaveLength(1);

    const exit = new PactileExitManager(cursorFirst, {
      now: () => occurredAt,
    });
    const detach = exit.planDetach("adapter.cursor");
    expect(detach.status).toBe("ready");
    if (detach.status !== "ready") throw new Error(detach.reason);
    expect(exit.applyDetach(detach).status).toBe("applied");
    const detachedLedger = semanticLedger(cursorFirst);
    expect(
      detachedLedger.entries
        .filter((entry) => entry.resourceId.startsWith("shared."))
        .every((entry) =>
          entry.claimants.some(({ id }) => id === "adapter.codex"),
        ),
    ).toBe(true);
    expect(
      detachedLedger.entries.every((entry) =>
        entry.claimants.every(({ id }) => id !== "adapter.cursor"),
      ),
    ).toBe(true);
    const detachedHost = readHostTree(cursorFirst);
    for (const [targetPath, contents] of Object.entries(beforeHost).filter(
      ([targetPath]) =>
        targetPath === "AGENTS.md" || targetPath.startsWith(".agents/"),
    ))
      expect(detachedHost[targetPath]).toBe(contents);
    expect(
      Object.keys(detachedHost).some((targetPath) =>
        targetPath.startsWith(".cursor/"),
      ),
    ).toBe(false);

    const reattached = await runLifecycleCommand({
      projectRoot: cursorFirst,
      operation: "reconcile",
      runtimeVersion,
      files: generationFiles,
      platforms: ["cursor"],
      occurredAt,
    });
    expect(reattached.status).toBe("completed");
    const reattachedLedger = semanticLedger(cursorFirst);
    expect(
      reattachedLedger.entries
        .filter((entry) => entry.resourceId.startsWith("shared."))
        .every(({ claimants }) =>
          ["adapter.codex", "adapter.cursor"].every((id) =>
            claimants.some((claimant) => claimant.id === id),
          ),
        ),
    ).toBe(true);
    expect(
      reattachedLedger.entries
        .filter((entry) => entry.resourceId.startsWith("cursor."))
        .every(({ claimants }) =>
          claimants.some(({ id }) => id === "adapter.cursor"),
        ),
    ).toBe(true);
    expect(readHostTree(cursorFirst)).toEqual(beforeHost);
  });

  it("preserves foreign TOML/JSON regions and represents borrowed bindings without copying bodies", async () => {
    const projectRoot = temporaryRoot("foreign");
    const lifecycle = await runLifecycleCommand({
      projectRoot,
      operation: "init",
      runtimeVersion,
      files: generationFiles,
      platforms: ["codex"],
      occurredAt,
    });
    expect(lifecycle.status).toBe("completed");
    if (lifecycle.status !== "completed") throw new Error("init failed");
    const seal = lifecycle.generationFingerprint;
    const generationId = lifecycle.installState.state.generationId;
    const codexConfig = path.join(projectRoot, ".codex/config.toml");
    fs.mkdirSync(path.dirname(codexConfig), { recursive: true });
    fs.writeFileSync(codexConfig, "[foreign]\nkeep = true\n");

    let store = new ProjectionStore(projectRoot);
    let ledger = store.readLedger();
    const externalOperation = {
      id: "fixture.native.bind",
      resourceId: "fixture.native",
      claimantId: "adapter.codex",
      action: "bind" as const,
      control: "borrowed" as const,
      targetPath: null,
      format: "external-ref" as const,
      contentRef: null,
      desiredFingerprint: null,
      expectedCurrentFingerprint: null,
      externalAssetId: "fixture.native",
    };
    const shared: ProjectionInputs = {
      plan: {
        schemaVersion: 1,
        id: "fixture.shared.attach",
        adapterId: "adapter.codex",
        generationId,
        canonicalFingerprint: seal,
        expectedLedgerFingerprint: ledger?.fingerprint ?? null,
        operations: [externalOperation],
      } satisfies ProjectionPlanV1,
      ledger: ledger?.ledger ?? null,
      canonicalFingerprint: seal,
      updatedAt: occurredAt,
      observe: () => null,
      resolveContent: () => {
        throw new Error("borrowed content must not be resolved");
      },
      externalClaims: [],
    };
    const codex = buildCodexProjectionPlan({
      shared,
      appReadiness: "ready",
      supportsProjectConfig: true,
      composition: ["project-config"],
      projectConfig: {
        content: "[tool]\npactile_enabled = true\n",
        ownedTomlKeys: [{ table: ["tool"], key: "pactile_enabled" }],
      },
      surfaces: [
        {
          targetPath: ".codex/config.toml",
          content: fs.readFileSync(codexConfig, "utf8"),
        },
      ],
    });
    expect(codex.status).toBe("ready");
    if (codex.status !== "ready") throw new Error(JSON.stringify(codex));
    const codexPreview = store.inspect({
      plan: codex.inputs.plan,
      canonicalFingerprint: codex.inputs.canonicalFingerprint,
      updatedAt: codex.inputs.updatedAt,
      resolveContent: codex.inputs.resolveContent,
      externalClaims: codex.inputs.externalClaims,
    });
    expect(codexPreview.status).toBe("ready");
    if (codexPreview.status !== "ready") throw new Error(codexPreview.reason);
    expect(store.apply(codexPreview).status).toBe("applied");
    expect(fs.readFileSync(codexConfig, "utf8")).toContain("[foreign]");
    expect(fs.readFileSync(codexConfig, "utf8")).toContain(
      "pactile_enabled = true",
    );
    expect(codexPreview.externalClaims).toEqual([
      {
        resourceId: "fixture.native",
        externalAssetId: "fixture.native",
        claimants: ["adapter.codex"],
      },
    ]);
    expect(
      fs.existsSync(
        path.join(projectRoot, ".agents/skills/fixture.native/SKILL.md"),
      ),
    ).toBe(false);

    const cursorHooks = path.join(projectRoot, ".cursor/hooks.json");
    fs.mkdirSync(path.dirname(cursorHooks), { recursive: true });
    fs.writeFileSync(cursorHooks, '{ "foreign": { "keep": true } }\n');
    const desired = Buffer.from('{"pactile":{"enabled":true}}');
    const contentRef = `fixture.cursor.${fingerprintBytes(desired).slice(7)}`;
    store = new ProjectionStore(projectRoot);
    ledger = store.readLedger();
    const cursorPreview = store.inspect({
      plan: {
        schemaVersion: 1,
        id: "fixture.cursor.json",
        adapterId: "adapter.cursor",
        generationId,
        canonicalFingerprint: seal,
        expectedLedgerFingerprint: ledger?.fingerprint ?? null,
        operations: [
          {
            id: "fixture.cursor.hooks",
            resourceId: "fixture.cursor.hooks",
            claimantId: "adapter.cursor",
            action: "merge",
            control: "pactile-owned",
            targetPath: ".cursor/hooks.json",
            format: "json",
            contentRef,
            desiredFingerprint: fingerprintBytes(desired),
            expectedCurrentFingerprint: fingerprintBytes(
              fs.readFileSync(cursorHooks),
            ),
            externalAssetId: null,
          },
        ],
      },
      canonicalFingerprint: seal,
      updatedAt: occurredAt,
      resolveContent: (reference) => {
        if (reference !== contentRef) throw new Error("unknown content");
        return { bytes: desired, ownedJsonPointers: ["/pactile"] };
      },
    });
    expect(cursorPreview.status).toBe("ready");
    if (cursorPreview.status !== "ready") throw new Error(cursorPreview.reason);
    expect(store.apply(cursorPreview).status).toBe("applied");
    expect(JSON.parse(fs.readFileSync(cursorHooks, "utf8"))).toEqual({
      foreign: { keep: true },
      pactile: { enabled: true },
    });
  });

  it("isolates a locked or interrupted Adapter and retries only the failed lane", async () => {
    class BusyProjectionStore extends ProjectionStore {
      override recover(): ReturnType<ProjectionStore["recover"]> {
        return { status: "busy", reason: "fixture-busy" };
      }
    }

    const busyRoot = temporaryRoot("busy");
    const generationId = "generation.coexist.busy";
    const adapters = createDefaultLifecycleAdapters(
      busyRoot,
      generationId,
      runtimeVersion,
      ["cursor", "codex"],
    );
    const request = {
      projectRoot: busyRoot,
      id: "lifecycle.coexist.busy",
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
    expect(degraded.adapters).toEqual([
      expect.objectContaining({
        adapterId: "adapter.codex",
        status: "failed",
        retryable: true,
      }),
      expect.objectContaining({
        adapterId: "adapter.cursor",
        status: "succeeded",
        attempts: 1,
      }),
    ]);
    expect(
      new InstallStateStore(busyRoot).read()?.state.installedAdapters,
    ).toEqual([
      expect.objectContaining({ id: "adapter.codex", status: "degraded" }),
      expect.objectContaining({ id: "adapter.cursor", status: "active" }),
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

    const interruptedRoot = temporaryRoot("interrupted");
    const interruptedGeneration = "generation.coexist.interrupted";
    const interruptedAdapters = createDefaultLifecycleAdapters(
      interruptedRoot,
      interruptedGeneration,
      runtimeVersion,
      ["cursor", "codex"],
    );
    let injected = false;
    const interruptedRequest = {
      projectRoot: interruptedRoot,
      id: "lifecycle.coexist.interrupted",
      generationId: interruptedGeneration,
      runtimeVersion,
      expectedInstallStateFingerprint: null,
      occurredAt,
      source: { kind: "fresh" as const, files: generationFiles },
      adapters: interruptedAdapters,
    };
    const first = await runLifecycleTransaction(interruptedRequest, {
      projectionStore: (projectRoot, adapterId) =>
        new ProjectionStore(
          projectRoot,
          adapterId === "adapter.cursor"
            ? {
                fault: (phase) => {
                  if (phase === "after-journal" && !injected) {
                    injected = true;
                    throw new Error("fixture-interruption");
                  }
                },
              }
            : {},
        ),
    });
    expect(first.status).toBe("degraded");
    expect(
      fs.existsSync(
        path.join(
          interruptedRoot,
          ".pactile/runtime/projection-transaction.json",
        ),
      ),
    ).toBe(true);
    const resumed = await runLifecycleTransaction(interruptedRequest);
    expect(resumed.status).toBe("completed");
    expect(resumed.adapters).toEqual([
      expect.objectContaining({
        adapterId: "adapter.codex",
        status: "succeeded",
        attempts: 1,
      }),
      expect.objectContaining({
        adapterId: "adapter.cursor",
        status: "succeeded",
        attempts: 2,
      }),
    ]);
    expect(
      fs.existsSync(
        path.join(
          interruptedRoot,
          ".pactile/runtime/projection-transaction.json",
        ),
      ),
    ).toBe(false);
  });
});
