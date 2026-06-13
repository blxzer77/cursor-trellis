import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildMixedSourceBundle,
  listProjectFiles,
  resolvePython,
  runGetContext,
  seedEvalProject,
  type RetrievalPackPayload,
} from "./retrieval-eval-fixtures.js";

const pythonCmd = resolvePython();

function parseRetrievalPack(stdout: string): RetrievalPackPayload {
  return JSON.parse(stdout) as RetrievalPackPayload;
}

describe.skipIf(pythonCmd === null)("get_context.py --mode retrieval-pack", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(
      path.join(os.tmpdir(), "trellis-get-context-retrieval-pack-"),
    );
    seedEvalProject(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns orchestrator JSON from the explicit retrieval-pack mode", () => {
    const bundle = buildMixedSourceBundle();
    const inputPath = path.join(tmpDir, "evidence-input.json");
    fs.writeFileSync(
      inputPath,
      JSON.stringify({
        artifactSearchResults: bundle.artifactSearchResults,
        sessionMemoryResults: bundle.sessionMemoryResults,
        smartSearchManifests: bundle.smartSearchManifests,
        codebaseCandidates: bundle.codebaseCandidates,
      }),
      "utf-8",
    );

    const result = runGetContext(pythonCmd as string, tmpDir, [
      "--mode",
      "retrieval-pack",
      "--json",
      "--input",
      inputPath,
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const payload = parseRetrievalPack(result.stdout);
    expect(payload.version).toBe(1);
    expect(payload.source).toBe("retrieval-pack-orchestrator");
    expect(payload.collection.recommendations).toBeGreaterThan(0);
    expect(payload.contextPack.selected.length).toBeGreaterThan(0);
    expect(payload.scoredEvidence.total).toBeGreaterThan(0);
  });

  it("works without a selected task and returns an explicit empty pack", () => {
    fs.rmSync(path.join(tmpDir, ".trellis", ".runtime", "sessions"), {
      recursive: true,
      force: true,
    });

    const result = runGetContext(pythonCmd as string, tmpDir, [
      "--mode",
      "retrieval-pack",
      "--json",
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const payload = parseRetrievalPack(result.stdout);
    expect(payload.source).toBe("retrieval-pack-orchestrator");
    expect(payload.bundle).toEqual({});
    expect(payload.collection.recommendations).toBe(0);
    expect(payload.scoredEvidence.total).toBe(0);
    expect(payload.contextPack.selected).toEqual([]);
  });

  it("keeps default get_context JSON output unchanged", () => {
    const result = runGetContext(pythonCmd as string, tmpDir, ["--json"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const payload = JSON.parse(result.stdout) as {
      developer: string;
      retrievalGuide: {
        recommendations: unknown[];
        artifactSearch: { command: string };
      };
    };

    expect(payload.developer).toBeTruthy();
    expect(payload.retrievalGuide.artifactSearch.command).toContain(
      "search_artifacts.py",
    );
    expect(payload.retrievalGuide.recommendations.length).toBeGreaterThan(0);
    expect(result.stdout).not.toContain('"source": "retrieval-pack-orchestrator"');
  });

  it("does not mutate project files while building a retrieval pack", () => {
    const bundle = buildMixedSourceBundle();
    const inputPath = path.join(tmpDir, "evidence-input.json");
    fs.writeFileSync(
      inputPath,
      JSON.stringify({
        smartSearchManifests: bundle.smartSearchManifests,
      }),
      "utf-8",
    );

    const before = listProjectFiles(tmpDir);
    const result = runGetContext(pythonCmd as string, tmpDir, [
      "--mode",
      "retrieval-pack",
      "--json",
      "--input",
      inputPath,
      "--max-items",
      "3",
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(listProjectFiles(tmpDir)).toEqual(before);
  });
});
