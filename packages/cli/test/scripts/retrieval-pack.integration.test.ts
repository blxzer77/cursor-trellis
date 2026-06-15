import { afterEach, beforeEach, describe, expect, it } from "vitest";

import fs from "node:fs";

import os from "node:os";

import path from "node:path";

import { getAllScripts } from "../../src/templates/trellis/index.js";

import {

  EVAL_TASK_PATH,

  buildMixedSourceBundle,

  listProjectFiles,

  resolvePython,

  runBuildRetrievalPack,

  seedEvalProject,

  type RetrievalPackPayload,

} from "./retrieval-eval-fixtures.js";



const pythonCmd = resolvePython();



function buildRetrievalPack(

  root: string,

  input: Record<string, unknown>,

  options: { maxItems?: number; maxEstimatedTokens?: number; repoRoot?: string } = {},

): RetrievalPackPayload {

  const result = runBuildRetrievalPack(pythonCmd as string, root, input, options);

  expect(result.status).toBe(0);

  return JSON.parse(result.stdout) as RetrievalPackPayload;

}



describe.skipIf(pythonCmd === null)("retrieval_pack.py", () => {

  let tmpDir: string;



  beforeEach(() => {

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-retrieval-pack-"));

    const scriptsDir = path.join(tmpDir, ".trellis", "scripts");

    for (const [rel, content] of getAllScripts()) {

      const target = path.join(scriptsDir, rel);

      fs.mkdirSync(path.dirname(target), { recursive: true });

      fs.writeFileSync(target, content, "utf-8");

    }

  });



  afterEach(() => {

    fs.rmSync(tmpDir, { recursive: true, force: true });

  });



  it("returns an explicit empty payload for missing source input", () => {

    const payload = buildRetrievalPack(tmpDir, {});



    expect(payload.version).toBe(1);

    expect(payload.source).toBe("retrieval-pack-orchestrator");

    expect(payload.bundle).toEqual({});

    expect(payload.scoredEvidence.total).toBe(0);

    expect(payload.scoredEvidence.items).toEqual([]);

    expect(payload.contextPack.selected).toEqual([]);

    expect(payload.contextPack.omitted).toEqual([]);

    expect(payload.collection).toEqual({

      recommendations: 0,

      artifactSearchResults: 0,

      sessionMemoryResults: 0,

      smartSearchManifests: 0,

      codebaseCandidates: 0,

    });

    expect(payload.warnings).toEqual([]);
    expect(payload.evidenceEnvelope.version).toBe(1);
    expect(payload.evidenceEnvelope.adapterState.some((item) => item.adapter === "rg")).toBe(
      true,
    );

  });



  it("selects mixed sources and omits unavailable evidence by default", () => {

    const bundle = buildMixedSourceBundle();

    const payload = buildRetrievalPack(tmpDir, {

      retrievalGuide: {

        recommendations: bundle.recommendations,

        selectedTaskArtifacts: bundle.selectedTaskArtifacts,

      },

      artifactSearchResults: bundle.artifactSearchResults,

      sessionMemoryResults: bundle.sessionMemoryResults,

      smartSearchManifests: bundle.smartSearchManifests,

      codebaseCandidates: bundle.codebaseCandidates,

    });



    expect(payload.scoredEvidence.total).toBeGreaterThan(0);

    expect(payload.contextPack.selected.length).toBeGreaterThan(0);

    expect(payload.contextPack.selected[0]?.source).toBe("task-artifacts");

    expect(

      payload.contextPack.selected.every(

        (item) => item.status === "ok" || item.status === "degraded",

      ),

    ).toBe(true);

    expect(payload.contextPack.omitted.some((item) => item.reason.includes("unavailable"))).toBe(

      true,

    );

    expect(payload.collection.recommendations).toBeGreaterThan(0);

    expect(payload.collection.smartSearchManifests).toBe(4);

  });



  it("discovers existing Smart Search manifests from the selected task evidence directory", () => {

    seedEvalProject(tmpDir);



    const payload = buildRetrievalPack(

      tmpDir,

      {

        retrievalGuide: {

          selectedTaskArtifacts: { taskPath: EVAL_TASK_PATH },

        },

      },

      { repoRoot: tmpDir },

    );



    expect(payload.collection.smartSearchManifests).toBe(4);

    expect(payload.scoredEvidence.items.some((item) => item.source === "smart-search")).toBe(true);

    expect(payload.warnings).toEqual([]);

  });



  it("records a warning for invalid Smart Search manifest JSON", () => {
    const manifestPath = `${EVAL_TASK_PATH}/research/smart-search/bad-run/manifest.json`;
    const manifestDir = path.join(tmpDir, manifestPath);
    fs.mkdirSync(path.dirname(manifestDir), { recursive: true });
    fs.writeFileSync(manifestDir, "{ not-json", "utf-8");


    const payload = buildRetrievalPack(

      tmpDir,

      {

        retrievalGuide: {

          selectedTaskArtifacts: { taskPath: EVAL_TASK_PATH },

        },

      },

      { repoRoot: tmpDir },

    );



    expect(payload.warnings.some((warning) => warning.includes("invalid Smart Search manifest"))).toBe(
      true,
    );
  });

  it("does not discover manifests outside repoRoot through selected task paths", () => {
    const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-retrieval-outside-"));
    try {
      const outsideManifest = path.join(
        outsideDir,
        "research",
        "smart-search",
        "outside-run",
        "manifest.json",
      );
      fs.mkdirSync(path.dirname(outsideManifest), { recursive: true });
      fs.writeFileSync(
        outsideManifest,
        JSON.stringify({
          source: "smart-search",
          status: "ok",
          manifestPath: outsideManifest,
          query: "outside",
        }),
        "utf-8",
      );

      const payload = buildRetrievalPack(
        tmpDir,
        {
          retrievalGuide: {
            selectedTaskArtifacts: { taskPath: outsideDir },
          },
        },
        { repoRoot: tmpDir },
      );

      expect(payload.collection.smartSearchManifests).toBe(0);
      expect(payload.warnings.some((warning) => warning.includes("outside repo_root"))).toBe(
        true,
      );
    } finally {
      fs.rmSync(outsideDir, { recursive: true, force: true });
    }
  });

  it("propagates budget options to contextPack.budget", () => {
    const bundle = buildMixedSourceBundle();
    const payload = buildRetrievalPack(
      tmpDir,

      {

        retrievalGuide: {

          recommendations: bundle.recommendations,

          selectedTaskArtifacts: bundle.selectedTaskArtifacts,

        },

        artifactSearchResults: bundle.artifactSearchResults,

        sessionMemoryResults: bundle.sessionMemoryResults,

        smartSearchManifests: bundle.smartSearchManifests,

        codebaseCandidates: bundle.codebaseCandidates,

      },

      { maxItems: 2 },

    );



    expect(payload.contextPack.budget.maxItems).toBe(2);

    expect(payload.contextPack.selected.length).toBeLessThanOrEqual(2);

    expect(payload.contextPack.summary.budgetExceeded).toBe(true);

  });



  it("preserves deterministic ordering across repeated orchestrator runs", () => {

    const bundle = buildMixedSourceBundle();

    const input = {

      retrievalGuide: {

        recommendations: bundle.recommendations,

        selectedTaskArtifacts: bundle.selectedTaskArtifacts,

      },

      artifactSearchResults: bundle.artifactSearchResults,

      sessionMemoryResults: bundle.sessionMemoryResults,

      smartSearchManifests: bundle.smartSearchManifests,

      codebaseCandidates: bundle.codebaseCandidates,

    };



    const first = buildRetrievalPack(tmpDir, input, { maxItems: 6 });

    const second = buildRetrievalPack(tmpDir, input, { maxItems: 6 });



    expect(first.scoredEvidence.items.map((item) => item.reference)).toEqual(

      second.scoredEvidence.items.map((item) => item.reference),

    );

    expect(first.contextPack.selected.map((item) => item.reference)).toEqual(

      second.contextPack.selected.map((item) => item.reference),

    );

  });



  it("does not mutate project files while orchestrating in memory", () => {

    seedEvalProject(tmpDir);

    const bundle = buildMixedSourceBundle();

    const before = listProjectFiles(tmpDir);



    buildRetrievalPack(

      tmpDir,

      {

        retrievalGuide: {

          recommendations: bundle.recommendations,

          selectedTaskArtifacts: bundle.selectedTaskArtifacts,

        },

        smartSearchManifests: bundle.smartSearchManifests,

      },

      { repoRoot: tmpDir, maxItems: 4 },

    );



    expect(listProjectFiles(tmpDir)).toEqual(before);

  });

});
