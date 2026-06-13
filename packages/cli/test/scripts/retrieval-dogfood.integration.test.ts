import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  DOGFOOD_ARCHIVE_TASK_PREFIX,
  DOGFOOD_TASK_PATH,
  archiveFixtureSources,
  buildDogfoodRetrievalPack,
  getRetrievalGuide,
  listProjectFiles,
  resolvePython,
  runGetContextRetrievalPack,
  runSearchArtifacts,
  runSearchMemory,
  seedDogfoodProject,
  topSelectedScore,
  type RetrievalPackPayload,
} from "./retrieval-dogfood-fixtures.js";
import { runGetContext } from "./retrieval-eval-fixtures.js";

const pythonCmd = resolvePython();

function referencesIncludeHandoff(payload: RetrievalPackPayload): boolean {
  const references = [
    ...payload.scoredEvidence.items.map((item) => item.reference),
    ...payload.contextPack.selected.map((item) => item.reference),
  ];
  return references.some(
    (reference) =>
      reference.includes("handoff.md") ||
      reference.includes(DOGFOOD_TASK_PATH) ||
      reference.includes(DOGFOOD_ARCHIVE_TASK_PREFIX),
  );
}

describe.skipIf(pythonCmd === null)("retrieval dogfood - archive-backed orchestrator", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-retrieval-dogfood-"));
    seedDogfoodProject(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("materializes copied archive fixtures instead of inline-only payloads", () => {
    for (const source of archiveFixtureSources) {
      for (const file of source.files) {
        const rel = `${DOGFOOD_ARCHIVE_TASK_PREFIX}/${source.slug}/${file}`;
        expect(fs.existsSync(path.join(tmpDir, rel))).toBe(true);
      }
    }
    expect(fs.existsSync(path.join(tmpDir, `${DOGFOOD_TASK_PATH}/handoff.md`))).toBe(true);
  });

  it("discovers archive-modeled Smart Search manifests from the selected task", () => {
    const guide = getRetrievalGuide(pythonCmd as string, tmpDir);
    const payload = buildDogfoodRetrievalPack(pythonCmd as string, tmpDir, {
      retrievalGuide: guide,
    });

    expect(payload.source).toBe("retrieval-pack-orchestrator");
    expect(payload.collection.smartSearchManifests).toBe(4);
    expect(payload.scoredEvidence.items.some((item) => item.source === "smart-search")).toBe(true);
    expect(payload.contextPack.selected.some((item) => item.source === "task-artifacts")).toBe(true);
    expect(referencesIncludeHandoff(payload)).toBe(true);
  });

  it("prioritizes durable task and artifact evidence over weak Smart Search signals", () => {
    const guide = getRetrievalGuide(pythonCmd as string, tmpDir);
    const artifacts = runSearchArtifacts(
      pythonCmd as string,
      tmpDir,
      "retrieval evidence scoring context pack",
    );
    const memory = runSearchMemory(pythonCmd as string, tmpDir, "retrieval dogfood phase 3");

    expect(artifacts.status).toBe(0);
    expect(memory.status).toBe(0);
    expect(artifacts.results.length).toBeGreaterThan(0);
    expect(memory.results.length).toBeGreaterThan(0);

    const payload = buildDogfoodRetrievalPack(pythonCmd as string, tmpDir, {
      retrievalGuide: guide,
      artifactSearchResults: artifacts.results,
      sessionMemoryResults: memory.results,
      codebaseCandidates: [
        {
          title: "Candidate symbol match",
          reference: "packages/cli/src/context.ts",
          score: 12,
          reason: "adapter surfaced a candidate symbol",
        },
      ],
    });

    const taskScore = topSelectedScore(payload, "task-artifacts");
    const artifactScore = topSelectedScore(payload, "artifact-search");
    const failedScores = payload.scoredEvidence.items
      .filter(
        (item) =>
          item.source === "smart-search" &&
          (item.status === "failed" || item.status === "not_configured"),
      )
      .map((item) => item.score);

    expect(taskScore).toBeGreaterThan(Math.max(...failedScores, 0));
    expect(artifactScore).toBeGreaterThan(Math.max(...failedScores, 0));
    expect(
      payload.contextPack.selected.some((item) => item.source === "task-artifacts"),
    ).toBe(true);
  });

  it("trims archive-backed payloads to budget with explicit omission reasons", () => {
    const guide = getRetrievalGuide(pythonCmd as string, tmpDir);
    const artifacts = runSearchArtifacts(
      pythonCmd as string,
      tmpDir,
      "retrieval eval harness handoff",
    );
    const memory = runSearchMemory(pythonCmd as string, tmpDir, "retrieval dogfood");

    const payload = buildDogfoodRetrievalPack(
      pythonCmd as string,
      tmpDir,
      {
        retrievalGuide: guide,
        artifactSearchResults: artifacts.results,
        sessionMemoryResults: memory.results,
      },
      { maxItems: 2 },
    );

    expect(payload.contextPack.budget.maxItems).toBe(2);
    expect(payload.contextPack.selected.length).toBeLessThanOrEqual(2);
    expect(payload.contextPack.summary.budgetExceeded).toBe(true);
    expect(payload.contextPack.omitted.length).toBeGreaterThan(0);
    expect(payload.contextPack.omitted.every((item) => item.reason.length > 0)).toBe(true);
    expect(
      payload.contextPack.omitted.some((item) =>
        item.reason.toLowerCase().includes("budget"),
      ),
    ).toBe(true);
  });

  it("omits failed and not_configured Smart Search from selected output by default", () => {
    const guide = getRetrievalGuide(pythonCmd as string, tmpDir);
    const payload = buildDogfoodRetrievalPack(pythonCmd as string, tmpDir, {
      retrievalGuide: guide,
    });

    const selectedStatuses = payload.contextPack.selected
      .filter((item) => item.source === "smart-search")
      .map((item) => item.status);
    expect(selectedStatuses).not.toContain("failed");
    expect(selectedStatuses).not.toContain("not_configured");

    const omittedSmartSearch = payload.contextPack.omitted.filter(
      (item) => item.source === "smart-search",
    );
    expect(
      omittedSmartSearch.some((item) =>
        item.reason.toLowerCase().includes("unavailable") ||
        item.reason.toLowerCase().includes("failed") ||
        item.reason.toLowerCase().includes("not_configured"),
      ),
    ).toBe(true);
  });

  it("preserves deterministic ordering across repeated archive-backed runs", () => {
    const guide = getRetrievalGuide(pythonCmd as string, tmpDir);
    const input = { retrievalGuide: guide };

    const first = buildDogfoodRetrievalPack(pythonCmd as string, tmpDir, input, {
      maxItems: 6,
    });
    const second = buildDogfoodRetrievalPack(pythonCmd as string, tmpDir, input, {
      maxItems: 6,
    });

    expect(first.scoredEvidence.items.map((item) => item.reference)).toEqual(
      second.scoredEvidence.items.map((item) => item.reference),
    );
    expect(first.contextPack.selected.map((item) => item.reference)).toEqual(
      second.contextPack.selected.map((item) => item.reference),
    );
  });

  it("does not mutate archive-backed fixture files during orchestration", () => {
    const guide = getRetrievalGuide(pythonCmd as string, tmpDir);
    const before = listProjectFiles(tmpDir);

    buildDogfoodRetrievalPack(pythonCmd as string, tmpDir, { retrievalGuide: guide }, {
      maxItems: 4,
    });

    expect(listProjectFiles(tmpDir)).toEqual(before);
  });
});

describe.skipIf(pythonCmd === null)("retrieval dogfood - get_context retrieval-pack surface", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-retrieval-dogfood-surface-"));
    seedDogfoodProject(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("builds an archive-backed retrieval pack through explicit get_context mode", () => {
    const artifacts = runSearchArtifacts(
      pythonCmd as string,
      tmpDir,
      "retrieval evidence scoring handoff",
    );
    const memory = runSearchMemory(pythonCmd as string, tmpDir, "retrieval dogfood phase 3");
    const inputPath = path.join(tmpDir, "dogfood-evidence.json");
    fs.writeFileSync(
      inputPath,
      JSON.stringify({
        artifactSearchResults: artifacts.results,
        sessionMemoryResults: memory.results,
      }),
      "utf-8",
    );

    const result = runGetContextRetrievalPack(pythonCmd as string, tmpDir, [
      "--json",
      "--input",
      inputPath,
      "--max-items",
      "5",
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const payload = JSON.parse(result.stdout) as RetrievalPackPayload;
    expect(payload.source).toBe("retrieval-pack-orchestrator");
    expect(payload.collection.recommendations).toBeGreaterThan(0);
    expect(payload.collection.artifactSearchResults).toBeGreaterThan(0);
    expect(payload.collection.sessionMemoryResults).toBeGreaterThan(0);
    expect(payload.contextPack.selected.length).toBeGreaterThan(0);
    expect(referencesIncludeHandoff(payload)).toBe(true);
  });

  it("discovers on-disk manifests without caller-supplied Smart Search payloads", () => {
    const result = runGetContextRetrievalPack(pythonCmd as string, tmpDir, ["--json"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const payload = JSON.parse(result.stdout) as RetrievalPackPayload;
    expect(payload.collection.smartSearchManifests).toBe(4);
    expect(payload.contextPack.selected.some((item) => item.source === "task-artifacts")).toBe(
      true,
    );
  });

  it("keeps default get_context JSON retrieval-guide-only", () => {
    const result = runGetContext(
      pythonCmd as string,
      tmpDir,
      ["--json"],
      "retrieval-dogfood-test",
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).not.toContain('"source": "retrieval-pack-orchestrator"');
    expect(result.stdout).toContain("retrievalGuide");
  });

  it("does not mutate archive fixtures while using explicit retrieval-pack mode", () => {
    const before = listProjectFiles(tmpDir);
    const result = runGetContextRetrievalPack(pythonCmd as string, tmpDir, [
      "--json",
      "--max-items",
      "3",
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(listProjectFiles(tmpDir)).toEqual(before);
  });
});
