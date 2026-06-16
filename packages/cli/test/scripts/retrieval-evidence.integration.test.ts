import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getAllScripts } from "../../src/templates/trellis/index.js";

function resolvePython(): string | null {
  const candidates =
    process.platform === "win32" ? ["python", "python3"] : ["python3", "python"];
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // Try the next common Python launcher name.
    }
  }
  return null;
}

const pythonCmd = resolvePython();

interface ScoredEvidenceItem {
  version: number;
  source: string;
  kind: string;
  reference: string;
  title: string;
  status: string;
  trust: string;
  confidence: string;
  relevance: number;
  freshness: number;
  sourceAuthority: number;
  validationState: string;
  score: number;
  reasons: string[];
  warnings: string[];
}

interface ScoredEvidencePayload {
  version: number;
  total: number;
  items: ScoredEvidenceItem[];
}

function writeFile(root: string, rel: string, content: string): void {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf-8");
}

function writeTrellisScripts(root: string): void {
  const scriptsDir = path.join(root, ".trellis", "scripts");
  for (const [rel, content] of getAllScripts()) {
    writeFile(scriptsDir, rel, content);
  }
}

function runScoreEvidence(
  root: string,
  bundle: Record<string, unknown>,
): { status: number | null; stdout: string; stderr: string } {
  const script = `
import json, sys
sys.path.insert(0, r"${path.join(root, ".trellis", "scripts").replace(/\\/g, "\\\\")}")
from common.retrieval_evidence import score_evidence_bundle
print(json.dumps(score_evidence_bundle(json.loads(sys.stdin.read())), ensure_ascii=False))
`;
  const result = spawnSync(pythonCmd as string, ["-c", script], {
    cwd: root,
    encoding: "utf-8",
    input: JSON.stringify(bundle),
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

const baseRecommendations = [
  {
    source: "task-artifacts",
    priority: 100,
    confidence: "high",
    reason: "Selected task has local planning or evidence artifacts; read them first.",
    action: "Read selected task artifacts.",
    reference: ".trellis/tasks/06-13-scoring",
  },
  {
    source: "artifact-search",
    priority: 90,
    confidence: "high",
    reason: "Search durable Trellis artifacts.",
    action: "python search_artifacts.py",
    reference: ".trellis/tasks/06-13-scoring",
  },
  {
    source: "session-memory",
    priority: 80,
    confidence: "medium",
    reason: "Search local session history.",
    action: "python search_memory.py",
    reference: ".trellis/workspace/",
  },
  {
    source: "smart-search",
    priority: 70,
    confidence: "medium",
    reason: "Capture explicit external evidence.",
    action: "python run_smart_search.py",
    reference: ".trellis/tasks/06-13-scoring/research/smart-search/",
  },
  {
    source: "codebase-evidence",
    priority: 60,
    confidence: "medium",
    reason: "Confirm candidate codebase evidence.",
    action: "Inspect current source.",
    reference: "current source tree",
  },
];

describe.skipIf(pythonCmd === null)("retrieval_evidence.py", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-retrieval-evidence-"));
    writeTrellisScripts(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns an empty stable payload for no inputs", () => {
    const result = runScoreEvidence(tmpDir, {});
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as ScoredEvidencePayload;
    expect(payload).toEqual({ version: 1, total: 0, items: [] });
  });

  it("scores mixed sources with deterministic ordering", () => {
    const bundle = {
      recommendations: baseRecommendations,
      selectedTaskArtifacts: {
        taskPath: ".trellis/tasks/06-13-scoring",
        prd: true,
        design: true,
        implement: false,
        research: true,
        researchCount: 2,
        verify: false,
      },
      artifactSearchResults: [
        {
          path: ".trellis/spec/Trellis/framework/retrieval.md",
          title: "Retrieval Framework",
          kind: "spec",
          category: "spec",
          score: 24,
          matched_fields: ["title", "body"],
          snippets: [],
        },
      ],
      sessionMemoryResults: [
        {
          version: 1,
          source: "session-memory",
          developer: "test-dev",
          session: 2,
          title: "Retrieval scoring",
          date: "2026-06-13",
          task: "Retrieval scoring",
          package: "Trellis",
          branch: "feature/retrieval",
          commits: ["abc1234"],
          summary: "Implemented evidence scoring contract.",
          matchedSections: ["Summary"],
          matchedFields: ["task"],
          path: ".trellis/workspace/test-dev/journal-1.md",
          line: 25,
          score: 16,
          reason: "matched 'retrieval'",
        },
      ],
      smartSearchManifests: [
        {
          version: 1,
          source: "smart-search",
          query: "React docs",
          intent: "deep-research",
          command: "smart-search research ...",
          outputPath:
            ".trellis/tasks/06-13-scoring/research/smart-search/run/deep_research.json",
          evidenceDir: ".trellis/tasks/06-13-scoring/research/smart-search/run",
          manifestPath:
            ".trellis/tasks/06-13-scoring/research/smart-search/run/manifest.json",
          status: "ok",
          createdAt: "2026-06-13T00:00:00Z",
          summary: "short normalized summary",
          citations: [],
          gapCheck: {},
          providerAttempts: [],
          degraded: false,
          doctor: { ok: true },
        },
      ],
      codebaseCandidates: [
        {
          title: "Candidate symbol match",
          reference: "packages/cli/src/context.ts",
          score: 12,
          reason: "adapter surfaced a candidate symbol",
        },
      ],
    };

    const first = JSON.parse(runScoreEvidence(tmpDir, bundle).stdout) as ScoredEvidencePayload;
    const second = JSON.parse(runScoreEvidence(tmpDir, bundle).stdout) as ScoredEvidencePayload;

    expect(first.total).toBeGreaterThan(0);
    expect(first.items.map((item) => item.source)).toEqual(
      second.items.map((item) => item.source),
    );
    expect(first.items[0]?.source).toBe("task-artifacts");
    expect(first.items[0]?.validationState).toBe("verified");
    expect(first.items.some((item) => item.source === "smart-search" && item.status === "ok")).toBe(
      true,
    );
    expect(
      first.items.some((item) => item.source === "codebase-evidence" && item.validationState === "candidate"),
    ).toBe(true);
    for (let index = 1; index < first.items.length; index += 1) {
      const prev = first.items[index - 1];
      const current = first.items[index];
      if (!prev || !current) {
        continue;
      }
      expect(prev.score).toBeGreaterThanOrEqual(current.score);
    }
  });

  it("demotes failed and not_configured Smart Search manifests", () => {
    const bundle = {
      recommendations: baseRecommendations,
      smartSearchManifests: [
        {
          version: 1,
          source: "smart-search",
          query: "missing credentials",
          manifestPath: ".trellis/workspace/smart-search/failed/manifest.json",
          evidenceDir: ".trellis/workspace/smart-search/failed",
          status: "failed",
          createdAt: "2026-06-13T00:00:00Z",
          error: "provider auth failed",
          summary: "",
          citations: [],
          gapCheck: {},
          providerAttempts: [],
          degraded: true,
          doctor: { ok: false },
        },
        {
          version: 1,
          source: "smart-search",
          query: "not configured",
          manifestPath: ".trellis/workspace/smart-search/none/manifest.json",
          evidenceDir: ".trellis/workspace/smart-search/none",
          status: "not_configured",
          createdAt: "2026-06-13T00:00:00Z",
          error: "smart-search CLI could not be resolved (PATH, config, or repo wrapper).",
          summary: "",
          citations: [],
          gapCheck: {},
          providerAttempts: [],
          degraded: false,
          doctor: { ok: false },
        },
        {
          version: 1,
          source: "smart-search",
          query: "degraded run",
          manifestPath: ".trellis/workspace/smart-search/degraded/manifest.json",
          evidenceDir: ".trellis/workspace/smart-search/degraded",
          status: "degraded",
          createdAt: "2026-06-13T00:00:00Z",
          summary: "partial answer with gaps",
          citations: [],
          gapCheck: { missing: ["official docs"] },
          providerAttempts: [],
          degraded: true,
          doctor: { ok: true },
        },
      ],
    };

    const payload = JSON.parse(runScoreEvidence(tmpDir, bundle).stdout) as ScoredEvidencePayload;
    const failed = payload.items.find((item) => item.status === "failed");
    const notConfigured = payload.items.find((item) => item.status === "not_configured");
    const degraded = payload.items.find((item) => item.status === "degraded");

    expect(failed?.score).toBeLessThanOrEqual(8);
    expect(failed?.validationState).toBe("failed");
    expect(notConfigured?.score).toBeLessThanOrEqual(12);
    expect(notConfigured?.validationState).toBe("unavailable");
    expect(degraded?.status).toBe("degraded");
    expect(degraded?.score).toBeGreaterThan(failed?.score ?? 0);
    expect(degraded?.score).toBeGreaterThan(notConfigured?.score ?? 0);
  });

  it("emits missing recommendation signals when payloads are absent", () => {
    const bundle = {
      recommendations: baseRecommendations,
      selectedTaskArtifacts: {
        taskPath: ".trellis/tasks/06-13-scoring",
        prd: false,
        design: false,
        implement: false,
        research: false,
        researchCount: 0,
        verify: false,
      },
    };

    const payload = JSON.parse(runScoreEvidence(tmpDir, bundle).stdout) as ScoredEvidencePayload;
    const missingSources = payload.items
      .filter((item) => item.status === "missing")
      .map((item) => item.source);

    expect(missingSources).toContain("artifact-search");
    expect(missingSources).toContain("session-memory");
    expect(missingSources).toContain("smart-search");
    expect(missingSources).toContain("codebase-evidence");
    expect(payload.items.find((item) => item.source === "task-artifacts")?.status).toBe(
      "missing",
    );
  });
});
