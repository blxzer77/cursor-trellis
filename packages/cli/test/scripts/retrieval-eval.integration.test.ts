import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  EVAL_TASK_PATH,
  assertMonotonicScores,
  buildMixedSourceBundle,
  evalRecommendations,
  hasContextPackModule,
  listProjectFiles,
  readFileMtime,
  resolvePython,
  runBuildContextPack,
  runGetContext,
  runScoreEvidence,
  scoreBySource,
  scoresBySource,
  seedEvalProject,
  type ScoredEvidenceItem,
  type ScoredEvidencePayload,
} from "./retrieval-eval-fixtures.js";

const pythonCmd = resolvePython();

function parseScored(stdout: string): ScoredEvidencePayload {
  return JSON.parse(stdout) as ScoredEvidencePayload;
}

function topScoreForSource(payload: ScoredEvidencePayload, source: string): number {
  return Math.max(...scoresBySource(payload, source).map((item) => item.score), 0);
}

describe.skipIf(pythonCmd === null)("retrieval eval harness - scoring", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-retrieval-eval-"));
    seedEvalProject(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("covers all Phase 2/3 source types in one mixed fixture bundle", () => {
    const payload = parseScored(runScoreEvidence(pythonCmd as string, tmpDir, buildMixedSourceBundle()).stdout);

    const sources = new Set(payload.items.map((item) => item.source));
    expect(sources.has("task-artifacts")).toBe(true);
    expect(sources.has("artifact-search")).toBe(true);
    expect(sources.has("session-memory")).toBe(true);
    expect(sources.has("smart-search")).toBe(true);
    expect(sources.has("codebase-evidence")).toBe(true);
    expect(payload.total).toBe(payload.items.length);
    expect(payload.version).toBe(1);
  });

  it("keeps deterministic ordering across repeated scoring runs", () => {
    const bundle = buildMixedSourceBundle();
    const first = parseScored(runScoreEvidence(pythonCmd as string, tmpDir, bundle).stdout);
    const second = parseScored(runScoreEvidence(pythonCmd as string, tmpDir, bundle).stdout);

    expect(first.items.map((item) => [item.source, item.reference, item.score])).toEqual(
      second.items.map((item) => [item.source, item.reference, item.score]),
    );
    assertMonotonicScores(first.items);
  });

  it("ranks durable task and artifact evidence above availability-only Smart Search signals", () => {
    const payload = parseScored(runScoreEvidence(pythonCmd as string, tmpDir, buildMixedSourceBundle()).stdout);

    const taskArtifacts = topScoreForSource(payload, "task-artifacts");
    const artifactSearch = topScoreForSource(payload, "artifact-search");
    const failed = Math.max(
      ...scoresBySource(payload, "smart-search")
        .filter((item) => item.status === "failed")
        .map((item) => item.score),
    );
    const notConfigured = Math.max(
      ...scoresBySource(payload, "smart-search")
        .filter((item) => item.status === "not_configured")
        .map((item) => item.score),
    );

    expect(taskArtifacts).toBeGreaterThan(failed);
    expect(taskArtifacts).toBeGreaterThan(notConfigured);
    expect(artifactSearch).toBeGreaterThan(failed);
    expect(artifactSearch).toBeGreaterThan(notConfigured);
  });

  it("scores Smart Search manifests across ok, degraded, failed, and not_configured", () => {
    const payload = parseScored(runScoreEvidence(pythonCmd as string, tmpDir, buildMixedSourceBundle()).stdout);
    const smartSearch = scoresBySource(payload, "smart-search");

    const ok = smartSearch.find((item) => item.status === "ok");
    const degraded = smartSearch.find((item) => item.status === "degraded");
    const failed = smartSearch.find((item) => item.status === "failed");
    const notConfigured = smartSearch.find((item) => item.status === "not_configured");

    expect(ok?.validationState).toBe("unverified");
    expect(degraded?.status).toBe("degraded");
    expect(failed?.score).toBeLessThanOrEqual(8);
    expect(failed?.validationState).toBe("failed");
    expect(notConfigured?.score).toBeLessThanOrEqual(12);
    expect(notConfigured?.validationState).toBe("unavailable");
    expect((degraded?.score ?? 0)).toBeGreaterThan(failed?.score ?? 0);
    expect((degraded?.score ?? 0)).toBeGreaterThan(notConfigured?.score ?? 0);
  });

  it("treats session memory as historical unverified context", () => {
    const payload = parseScored(runScoreEvidence(pythonCmd as string, tmpDir, buildMixedSourceBundle()).stdout);
    const memoryItems = scoresBySource(payload, "session-memory");

    expect(memoryItems).toHaveLength(1);
    expect(memoryItems[0]?.validationState).toBe("unverified");
    expect(memoryItems[0]?.trust).toBe("medium");
    expect(memoryItems[0]?.warnings.length).toBeGreaterThan(0);
  });

  it("keeps codebase evidence in candidate validation state", () => {
    const payload = parseScored(runScoreEvidence(pythonCmd as string, tmpDir, buildMixedSourceBundle()).stdout);
    const candidate = scoreBySource(payload, "codebase-evidence");

    expect(candidate?.validationState).toBe("candidate");
    expect(candidate?.warnings.join(" ")).toContain("confirmation");
  });

  it("emits missing recommendation signals when payloads are absent", () => {
    const bundle = {
      recommendations: evalRecommendations,
      selectedTaskArtifacts: {
        taskPath: EVAL_TASK_PATH,
        prd: false,
        design: false,
        implement: false,
        research: false,
        researchCount: 0,
        verify: false,
      },
    };

    const payload = parseScored(runScoreEvidence(pythonCmd as string, tmpDir, bundle).stdout);
    const missingSources = payload.items
      .filter((item) => item.status === "missing")
      .map((item) => item.source);

    expect(missingSources).toContain("artifact-search");
    expect(missingSources).toContain("session-memory");
    expect(missingSources).toContain("smart-search");
    expect(missingSources).toContain("codebase-evidence");
    expect(scoreBySource(payload, "task-artifacts")?.status).toBe("missing");
  });

  it("returns an explicit empty payload for empty input", () => {
    const payload = parseScored(runScoreEvidence(pythonCmd as string, tmpDir, {}).stdout);
    expect(payload).toEqual({ version: 1, total: 0, items: [] });
  });

  it("does not mutate project files while scoring in-memory bundles", () => {
    const before = listProjectFiles(tmpDir);
    const journalPath = `.trellis/workspace/eval-dev/journal-1.md`;
    const manifestPath = `${EVAL_TASK_PATH}/research/smart-search/ok-run/manifest.json`;
    const journalMtime = readFileMtime(tmpDir, journalPath);
    const manifestMtime = readFileMtime(tmpDir, manifestPath);

    const result = runScoreEvidence(pythonCmd as string, tmpDir, buildMixedSourceBundle());
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const after = listProjectFiles(tmpDir);
    expect(after).toEqual(before);
    expect(readFileMtime(tmpDir, journalPath)).toBe(journalMtime);
    expect(readFileMtime(tmpDir, manifestPath)).toBe(manifestMtime);
  });

  it("does not create Smart Search evidence directories during get_context guidance", () => {
    const before = listProjectFiles(tmpDir);
    const result = runGetContext(pythonCmd as string, tmpDir, ["--json"]);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const after = listProjectFiles(tmpDir);
    expect(after).toEqual(before);
    const payload = JSON.parse(result.stdout) as {
      retrievalGuide?: { recommendations?: unknown[] };
    };
    expect(payload.retrievalGuide?.recommendations?.length).toBeGreaterThan(0);
    expect(result.stdout).not.toMatch(/research\/smart-search\/[a-z0-9-]+\/manifest\.json/);
  });
});

describe.skipIf(pythonCmd === null)("retrieval eval harness - context pack", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-retrieval-eval-pack-"));
    seedEvalProject(tmpDir);
    expect(hasContextPackModule(tmpDir)).toBe(true);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("trims selected items to the requested budget with omission reasons", () => {
    const scored = parseScored(
      runScoreEvidence(pythonCmd as string, tmpDir, buildMixedSourceBundle()).stdout,
    );
    const before = listProjectFiles(tmpDir);
    const result = runBuildContextPack(pythonCmd as string, tmpDir, scored, { maxItems: 2 });
    expect(result.status).toBe(0);

    const pack = JSON.parse(result.stdout) as {
      version: number;
      selected: ScoredEvidenceItem[];
      omitted: { reference: string; reason: string; score: number }[];
      budget: { maxItems: number; estimatedTokens: number };
    };

    expect(pack.version).toBe(1);
    expect(pack.selected.length).toBeLessThanOrEqual(2);
    expect(pack.omitted.length).toBeGreaterThan(0);
    expect(pack.omitted[0]?.reason.length).toBeGreaterThan(0);
    expect(pack.budget.maxItems).toBe(2);
    expect(listProjectFiles(tmpDir)).toEqual(before);
  });

  it("returns an explicit empty pack for empty scored evidence", () => {
    const emptyScored: ScoredEvidencePayload = { version: 1, total: 0, items: [] };
    const result = runBuildContextPack(pythonCmd as string, tmpDir, emptyScored, { maxItems: 8 });
    expect(result.status).toBe(0);

    const pack = JSON.parse(result.stdout) as {
      selected: unknown[];
      omitted: unknown[];
      warnings: string[];
    };
    expect(pack.selected).toEqual([]);
    expect(pack.omitted).toEqual([]);
    expect(pack.warnings).toEqual([]);
  });

  it("preserves deterministic tie-breaking under equal scores", () => {
    const scored = parseScored(
      runScoreEvidence(pythonCmd as string, tmpDir, buildMixedSourceBundle()).stdout,
    );
    const first = JSON.parse(
      runBuildContextPack(pythonCmd as string, tmpDir, scored, { maxItems: 8 }).stdout,
    );
    const second = JSON.parse(
      runBuildContextPack(pythonCmd as string, tmpDir, scored, { maxItems: 8 }).stdout,
    );

    expect(first.selected.map((item: { reference: string }) => item.reference)).toEqual(
      second.selected.map((item: { reference: string }) => item.reference),
    );
  });
});
