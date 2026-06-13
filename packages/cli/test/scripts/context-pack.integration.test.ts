import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getAllScripts } from "../../src/templates/trellis/index.js";
import {
  buildMixedSourceBundle,
  listProjectFiles,
  resolvePython,
  runBuildContextPack,
  runScoreEvidence,
  type ScoredEvidencePayload,
} from "./retrieval-eval-fixtures.js";

const pythonCmd = resolvePython();

interface ContextPackPayload {
  version: number;
  source: string;
  budget: {
    maxItems: number | null;
    maxEstimatedTokens: number | null;
    estimatedTokens: number;
    itemsUsed: number;
  };
  selected: {
    source: string;
    reference: string;
    score: number;
    reason: string;
    status: string;
    estimatedTokens: number;
    metadataOnly: boolean;
  }[];
  omitted: {
    source: string;
    reference: string;
    score: number;
    reason: string;
    status?: string;
  }[];
  warnings: string[];
  summary: {
    totalInput: number;
    selectedCount: number;
    omittedCount: number;
    budgetExceeded: boolean;
  };
}

function scoreBundle(
  root: string,
  bundle: Record<string, unknown>,
): ScoredEvidencePayload {
  const result = runScoreEvidence(pythonCmd as string, root, bundle);
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout) as ScoredEvidencePayload;
}

function buildPack(
  root: string,
  scored: ScoredEvidencePayload,
  options: { maxItems?: number; maxEstimatedTokens?: number } = {},
): ContextPackPayload {
  const result = runBuildContextPack(pythonCmd as string, root, scored, options);
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout) as ContextPackPayload;
}

describe.skipIf(pythonCmd === null)("context_pack.py", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-context-pack-"));
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

  it("returns an explicit empty pack for empty scored evidence", () => {
    const pack = buildPack(tmpDir, { version: 1, total: 0, items: [] }, { maxItems: 8 });
    expect(pack.version).toBe(1);
    expect(pack.source).toBe("retrieval-context-pack");
    expect(pack.selected).toEqual([]);
    expect(pack.omitted).toEqual([]);
    expect(pack.warnings).toEqual([]);
    expect(pack.summary.totalInput).toBe(0);
  });

  it("selects mixed scored sources and omits unavailable evidence by default", () => {
    const scored = scoreBundle(tmpDir, buildMixedSourceBundle());
    const pack = buildPack(tmpDir, scored, { maxItems: 8 });

    expect(pack.selected.length).toBeGreaterThan(0);
    expect(pack.selected[0]?.source).toBe("task-artifacts");
    expect(pack.selected.every((item) => item.status === "ok" || item.status === "degraded")).toBe(
      true,
    );
    expect(pack.omitted.some((item) => item.reason.includes("unavailable"))).toBe(true);
  });

  it("trims selected items when maxItems budget is exceeded", () => {
    const scored = scoreBundle(tmpDir, buildMixedSourceBundle());
    const pack = buildPack(tmpDir, scored, { maxItems: 2 });

    expect(pack.selected.length).toBeLessThanOrEqual(2);
    expect(pack.omitted.length).toBeGreaterThan(0);
    expect(pack.omitted.some((item) => item.reason.includes("budget"))).toBe(true);
    expect(pack.summary.budgetExceeded).toBe(true);
    expect(pack.budget.maxItems).toBe(2);
  });

  it("preserves deterministic ordering across repeated pack builds", () => {
    const scored = scoreBundle(tmpDir, buildMixedSourceBundle());
    const first = buildPack(tmpDir, scored, { maxItems: 6 });
    const second = buildPack(tmpDir, scored, { maxItems: 6 });

    expect(first.selected.map((item) => item.reference)).toEqual(
      second.selected.map((item) => item.reference),
    );
  });

  it("does not mutate project files while building packs in memory", () => {
    const scored = scoreBundle(tmpDir, buildMixedSourceBundle());
    const before = listProjectFiles(tmpDir);
    buildPack(tmpDir, scored, { maxItems: 4 });
    expect(listProjectFiles(tmpDir)).toEqual(before);
  });
});
