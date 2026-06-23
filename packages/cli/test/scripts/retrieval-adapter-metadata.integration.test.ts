import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getAllScripts } from "../../src/templates/trellis/index.js";
import {
  buildMixedSourceBundle,
  resolvePython,
  runBuildRetrievalPack,
  type EvidenceEnvelopePayload,
} from "./retrieval-eval-fixtures.js";

function resolvePythonLocal(): string | null {
  return resolvePython();
}

const pythonCmd = resolvePythonLocal();

function writeTrellisScripts(root: string): void {
  const scriptsDir = path.join(root, ".trellis", "scripts");
  for (const [rel, content] of getAllScripts()) {
    const target = path.join(scriptsDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf-8");
  }
}

function runBuildEnvelope(
  root: string,
  input: Record<string, unknown>,
): EvidenceEnvelopePayload {
  const result = runBuildRetrievalPack(pythonCmd as string, root, input);
  expect(result.status).toBe(0);
  const payload = JSON.parse(result.stdout) as { evidenceEnvelope: EvidenceEnvelopePayload };
  return payload.evidenceEnvelope;
}

function runAdapterMetadataDirect(
  root: string,
  args: Record<string, unknown>,
): EvidenceEnvelopePayload {
  const script = `
import json, sys
sys.path.insert(0, r"${path.join(root, ".trellis", "scripts").replace(/\\/g, "\\\\")}")
from common.retrieval_adapter_metadata import build_evidence_envelope
print(json.dumps(build_evidence_envelope(**json.loads(sys.stdin.read())), ensure_ascii=False))
`;
  const result = spawnSync(pythonCmd as string, ["-c", script], {
    cwd: root,
    encoding: "utf-8",
    input: JSON.stringify(args),
  });
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout) as EvidenceEnvelopePayload;
}

describe.skipIf(pythonCmd === null)("retrieval_adapter_metadata.py", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-adapter-metadata-"));
    writeTrellisScripts(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns the parent shared envelope shape for empty offline input", () => {
    const envelope = runAdapterMetadataDirect(tmpDir, {
      bundle: {},
      scored_evidence: { version: 1, total: 0, items: [] },
      collection: {
        recommendations: 0,
        artifactSearchResults: 0,
        sessionMemoryResults: 0,
        smartSearchManifests: 0,
        codebaseCandidates: 0,
      },
      orchestrator_warnings: [],
    });

    expect(envelope.version).toBe(1);
    expect(envelope.intents).toEqual([]);
    expect(envelope.routes).toEqual([]);
    expect(envelope.adapterState.length).toBeGreaterThan(0);
    expect(envelope.freshness).toHaveLength(envelope.adapterState.length);
    expect(envelope.fallback.some((item) => item.fromAdapter === "codegraph")).toBe(true);
    expect(envelope.verification.some((item) => item.adapter === "source-git-tests")).toBe(
      true,
    );
    const rg = envelope.adapterState.find((item) => item.adapter === "rg");
    expect(rg?.state).toBe("available");
    expect(rg?.required).toBe(true);
  });

  it("marks failed Smart Search manifests as failed with rg fallback", () => {
    const envelope = runAdapterMetadataDirect(tmpDir, {
      bundle: {
        smartSearchManifests: [
          {
            status: "failed",
            manifestPath: ".trellis/tasks/x/research/smart-search/run/manifest.json",
            error: "provider auth failed",
          },
        ],
      },
      scored_evidence: {
        version: 1,
        total: 1,
        items: [
          {
            source: "smart-search",
            status: "failed",
            freshness: 40,
            validationState: "failed",
          },
        ],
      },
      collection: {
        recommendations: 0,
        artifactSearchResults: 0,
        sessionMemoryResults: 0,
        smartSearchManifests: 1,
        codebaseCandidates: 0,
      },
      orchestrator_warnings: [],
    });

    const smartSearch = envelope.adapterState.find((item) => item.adapter === "smart-search");
    expect(smartSearch?.state).toBe("failed");
    expect(smartSearch?.invoked).toBe(true);
    expect(
      envelope.fallback.some(
        (item) => item.fromAdapter === "smart-search" && item.toAdapter === "rg",
      ),
    ).toBe(true);
    expect(
      envelope.fallback.some(
        (item) => item.fromAdapter === "smart-search" && item.toAdapter === "task-artifacts",
      ),
    ).toBe(true);
    expect(envelope.warnings.some((warning) => warning.includes("smart-search failed"))).toBe(
      true,
    );
  });

  it("passes through router intents without redefining them", () => {
    const envelope = runAdapterMetadataDirect(tmpDir, {
      bundle: {},
      scored_evidence: { version: 1, total: 0, items: [] },
      collection: {
        recommendations: 0,
        artifactSearchResults: 0,
        sessionMemoryResults: 0,
        smartSearchManifests: 0,
        codebaseCandidates: 0,
      },
      orchestrator_warnings: [],
      router_envelope: {
        version: 1,
        intents: [{ id: "policy-doc", confidence: "high" }],
        routes: [{ adapter: "rg", priority: 1 }],
        fallback: [
          { when: "rg missing on PATH", action: "install rg" },
          {
            when: "semantic Top-1 is implementation-only",
            action: "prefer policy docs",
            replacesRole: "semantic",
          },
        ],
        warnings: ["router confidence is low"],
      },
    });

    expect(envelope.intents).toEqual([{ id: "policy-doc", confidence: "high" }]);
    expect(envelope.routes).toEqual([{ adapter: "rg", priority: 1 }]);
    expect(envelope.fallback).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ when: "rg missing on PATH", action: "install rg" }),
        expect.objectContaining({
          when: "semantic Top-1 is implementation-only",
          action: "prefer policy docs",
          replacesRole: "semantic",
        }),
      ]),
    );
    expect(envelope.warnings).toContain("router confidence is low");
  });

  it("adapter reasons follow cursorEnv on router envelope (BYOK fast-context Primary)", () => {
    const envelope = runAdapterMetadataDirect(tmpDir, {
      bundle: {},
      scored_evidence: { version: 1, total: 0, items: [] },
      collection: {
        recommendations: 0,
        artifactSearchResults: 0,
        sessionMemoryResults: 0,
        smartSearchManifests: 0,
        codebaseCandidates: 0,
      },
      orchestrator_warnings: [],
      router_envelope: { cursorEnv: "byok", version: 1 },
    });

    const platform = envelope.adapterState.find(
      (item) => item.adapter === "platform-semantic",
    );
    const fastCtx = envelope.adapterState.find(
      (item) => item.adapter === "fast-context-mcp",
    );
    expect(platform?.reason).toContain("Experiment D");
    expect(fastCtx?.reason).toContain("compliant Primary");
    expect(platform?.reason).not.toContain("supersedes fast-context");
  });

  it("exposes evidenceEnvelope on retrieval pack orchestrator output", () => {
    const bundle = buildMixedSourceBundle();
    const envelope = runBuildEnvelope(tmpDir, {
      retrievalGuide: {
        recommendations: bundle.recommendations,
        selectedTaskArtifacts: bundle.selectedTaskArtifacts,
      },
      artifactSearchResults: bundle.artifactSearchResults,
      sessionMemoryResults: bundle.sessionMemoryResults,
      smartSearchManifests: bundle.smartSearchManifests,
      codebaseCandidates: bundle.codebaseCandidates,
    });

    expect(envelope.adapterState.some((item) => item.adapter === "artifact-search")).toBe(
      true,
    );
    expect(envelope.freshness.some((item) => item.freshnessScore > 0)).toBe(true);
    expect(envelope.fallback.length).toBeGreaterThan(0);
  });

  it("accepts stale CodeGraph adapter hints without requiring invocation", () => {
    const envelope = runBuildEnvelope(tmpDir, {
      adapterHints: [
        {
          adapter: "codegraph",
          state: "stale",
          invoked: false,
          reason: "index pending re-index",
        },
      ],
    });

    const codegraph = envelope.adapterState.find((item) => item.adapter === "codegraph");
    expect(codegraph?.state).toBe("stale");
    expect(codegraph?.invoked).toBe(false);
    expect(
      envelope.fallback.some(
        (item) => item.fromAdapter === "codegraph" && item.toAdapter === "rg",
      ),
    ).toBe(true);
    expect(
      envelope.verification.some((item) =>
        item.requirement.includes("confirm CodeGraph structural output"),
      ),
    ).toBe(true);
  });
});
