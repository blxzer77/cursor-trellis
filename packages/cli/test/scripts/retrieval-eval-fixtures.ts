import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { getAllScripts } from "../../src/templates/trellis/index.js";

export const EVAL_TASK_PATH = ".trellis/tasks/06-13-eval";
export const EVAL_DEVELOPER = "eval-dev";
export const EVAL_SESSION_ID = "retrieval-eval-test";

export interface ScoredEvidenceItem {
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

export interface ScoredEvidencePayload {
  version: number;
  total: number;
  items: ScoredEvidenceItem[];
}

export function resolvePython(): string | null {
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

export function writeFile(root: string, rel: string, content: string): void {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf-8");
}

export function writeJson(root: string, rel: string, data: unknown): void {
  writeFile(root, rel, `${JSON.stringify(data, null, 2)}\n`);
}

export function writeTrellisScripts(root: string): void {
  const scriptsDir = path.join(root, ".trellis", "scripts");
  for (const [rel, content] of getAllScripts()) {
    writeFile(scriptsDir, rel, content);
  }
}

export function contextPackModulePath(root: string): string {
  return path.join(root, ".trellis", "scripts", "common", "context_pack.py");
}

export function hasContextPackModule(root: string): boolean {
  return fs.existsSync(contextPackModulePath(root));
}

export function listProjectFiles(root: string): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__pycache__") {
          continue;
        }
        walk(fullPath);
        continue;
      }
      if (entry.name.endsWith(".pyc")) {
        continue;
      }
      files.push(path.relative(root, fullPath).replace(/\\/g, "/"));
    }
  };
  walk(root);
  return files.sort();
}

export function readFileMtime(root: string, rel: string): number {
  return fs.statSync(path.join(root, rel)).mtimeMs;
}

const smartSearchBase = `${EVAL_TASK_PATH}/research/smart-search`;

export const evalRecommendations = [
  {
    source: "task-artifacts",
    priority: 100,
    confidence: "high",
    reason: "Selected task has local planning or evidence artifacts; read them first.",
    action: "Read selected task artifacts.",
    reference: EVAL_TASK_PATH,
  },
  {
    source: "artifact-search",
    priority: 90,
    confidence: "high",
    reason: "Search durable Trellis artifacts.",
    action: "python search_artifacts.py",
    reference: EVAL_TASK_PATH,
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
    reference: `${smartSearchBase}/`,
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

function manifestFixture(
  run: string,
  status: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const evidenceDir = `${smartSearchBase}/${run}`;
  return {
    version: 1,
    source: "smart-search",
    query: `eval fixture ${run}`,
    intent: "deep-research",
    command: "smart-search research ...",
    outputPath: `${evidenceDir}/deep_research.json`,
    evidenceDir,
    manifestPath: `${evidenceDir}/manifest.json`,
    status,
    createdAt: "2026-06-13T00:00:00Z",
    summary: status === "degraded" ? "partial answer with gaps" : "short normalized summary",
    citations: [],
    gapCheck: status === "degraded" ? { missing: ["official docs"] } : {},
    providerAttempts: [],
    degraded: status === "degraded" || status === "failed",
    doctor: { ok: status === "ok" || status === "degraded" },
    ...overrides,
  };
}

export function seedEvalProject(root: string): void {
  writeTrellisScripts(root);
  writeFile(root, ".trellis/.developer", `name=${EVAL_DEVELOPER}\n`);
  writeJson(root, ".trellis/.runtime/sessions/retrieval-eval-test.json", {
    selected_task: EVAL_TASK_PATH,
  });
  writeJson(root, `${EVAL_TASK_PATH}/task.json`, {
    id: "eval",
    name: "eval",
    title: "Retrieval Eval Harness",
    description: "Fixture task for retrieval evaluation harness.",
    status: "in_progress",
    assignee: EVAL_DEVELOPER,
    priority: "P1",
    createdAt: "2026-06-13",
    children: [],
    parent: null,
    package: "trellis",
  });
  writeFile(root, `${EVAL_TASK_PATH}/prd.md`, "# PRD\n\nEval fixture task artifacts.\n");
  writeFile(root, `${EVAL_TASK_PATH}/design.md`, "# Design\n\nEval fixture design.\n");
  writeFile(
    root,
    `${EVAL_TASK_PATH}/research/baseline.md`,
    "# Baseline\n\nExploratory research fixture.\n",
  );
  writeFile(
    root,
    ".trellis/spec/Trellis/framework/retrieval.md",
    "# Retrieval Framework\n\nDurable spec artifact for eval harness.\n",
  );
  writeFile(
    root,
    `.trellis/workspace/${EVAL_DEVELOPER}/journal-1.md`,
    [
      "# Journal 1",
      "",
      "## 2026-06-13 — Retrieval eval",
      "",
      "Task: Retrieval eval harness",
      "Package: Trellis",
      "Branch: feature/retrieval-eval",
      "",
      "### Summary",
      "",
      "Seeded session memory for deterministic eval coverage.",
      "",
    ].join("\n"),
  );

  const manifests = [
    manifestFixture("ok-run", "ok"),
    manifestFixture("degraded-run", "degraded"),
    manifestFixture("failed-run", "failed", {
      error: "provider auth failed",
      summary: "",
    }),
    manifestFixture("not-configured-run", "not_configured", {
      error: "smart-search executable was not found on PATH.",
      summary: "",
      degraded: false,
      doctor: { ok: false },
    }),
  ];

  for (const manifest of manifests) {
    const manifestPath = String(manifest.manifestPath);
    writeJson(root, manifestPath, manifest);
    writeFile(root, String(manifest.outputPath), '{"fixture": true}\n');
  }
}

export function buildMixedSourceBundle(): Record<string, unknown> {
  return {
    recommendations: evalRecommendations,
    selectedTaskArtifacts: {
      taskPath: EVAL_TASK_PATH,
      prd: true,
      design: true,
      implement: false,
      research: true,
      researchCount: 1,
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
        developer: EVAL_DEVELOPER,
        session: 1,
        title: "Retrieval eval",
        date: "2026-06-13",
        task: "Retrieval eval harness",
        package: "Trellis",
        branch: "feature/retrieval-eval",
        commits: ["abc1234"],
        summary: "Seeded session memory for deterministic eval coverage.",
        matchedSections: ["Summary"],
        matchedFields: ["task"],
        path: `.trellis/workspace/${EVAL_DEVELOPER}/journal-1.md`,
        line: 12,
        score: 16,
        reason: "matched 'retrieval'",
      },
    ],
    smartSearchManifests: [
      manifestFixture("ok-run", "ok"),
      manifestFixture("degraded-run", "degraded"),
      manifestFixture("failed-run", "failed", {
        error: "provider auth failed",
        summary: "",
      }),
      manifestFixture("not-configured-run", "not_configured", {
        error: "smart-search executable was not found on PATH.",
        summary: "",
        degraded: false,
        doctor: { ok: false },
      }),
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
}

export function runScoreEvidence(
  pythonCmd: string,
  root: string,
  bundle: Record<string, unknown>,
): { status: number | null; stdout: string; stderr: string } {
  const script = `
import json, sys
sys.path.insert(0, r"${path.join(root, ".trellis", "scripts").replace(/\\/g, "\\\\")}")
from common.retrieval_evidence import score_evidence_bundle
print(json.dumps(score_evidence_bundle(json.loads(sys.stdin.read())), ensure_ascii=False))
`;
  const result = spawnSync(pythonCmd, ["-c", script], {
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

export function runGetContext(
  pythonCmd: string,
  root: string,
  args: string[] = [],
  sessionId: string = EVAL_SESSION_ID,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    pythonCmd,
    [path.join(root, ".trellis", "scripts", "get_context.py"), ...args],
    {
      cwd: root,
      encoding: "utf-8",
      env: { ...process.env, TRELLIS_CONTEXT_ID: sessionId },
    },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function runBuildContextPack(
  pythonCmd: string,
  root: string,
  scoredEvidence: ScoredEvidencePayload,
  options: { maxItems?: number; maxEstimatedTokens?: number } = {},
): { status: number | null; stdout: string; stderr: string } {
  const kwargs: string[] = [];
  if (options.maxItems !== undefined) {
    kwargs.push(`max_items=${options.maxItems}`);
  }
  if (options.maxEstimatedTokens !== undefined) {
    kwargs.push(`max_estimated_tokens=${options.maxEstimatedTokens}`);
  }
  const kwargsExpr = kwargs.length > 0 ? `, ${kwargs.join(", ")}` : "";

  const script = `
import json, sys
sys.path.insert(0, r"${path.join(root, ".trellis", "scripts").replace(/\\/g, "\\\\")}")
from common.context_pack import build_context_pack
print(json.dumps(build_context_pack(json.loads(sys.stdin.read())${kwargsExpr}), ensure_ascii=False))
`;
  const result = spawnSync(pythonCmd, ["-c", script], {
    cwd: root,
    encoding: "utf-8",
    input: JSON.stringify(scoredEvidence),
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export interface RetrievalPackPayload {
  version: number;
  source: string;
  bundle: Record<string, unknown>;
  scoredEvidence: ScoredEvidencePayload;
  contextPack: {
    version: number;
    source: string;
    budget: {
      maxItems: number | null;
      maxEstimatedTokens: number | null;
      estimatedTokens: number;
      itemsUsed: number;
    };
    selected: { source: string; reference: string; status: string }[];
    omitted: { source: string; reference: string; reason: string }[];
    warnings: string[];
    summary: {
      totalInput: number;
      selectedCount: number;
      omittedCount: number;
      budgetExceeded: boolean;
    };
  };
  collection: {
    recommendations: number;
    artifactSearchResults: number;
    sessionMemoryResults: number;
    smartSearchManifests: number;
    codebaseCandidates: number;
  };
  warnings: string[];
  evidenceEnvelope: EvidenceEnvelopePayload;
}

export interface EvidenceEnvelopePayload {
  version: number;
  intents: Record<string, unknown>[];
  routes: Record<string, unknown>[];
  adapterState: {
    adapter: string;
    role: string;
    state: string;
    required: boolean;
    invoked: boolean;
    reason: string;
  }[];
  freshness: {
    adapter: string;
    role: string;
    freshnessScore: number;
    stale: boolean;
    checkedAt: string;
    state: string;
    note: string;
  }[];
  fallback: {
    fromAdapter: string;
    toAdapter: string;
    reason: string;
    origin?: string;
  }[];
  warnings: string[];
  verification: {
    adapter: string;
    requirement: string;
    blocking?: boolean;
  }[];
}

export function runBuildRetrievalPack(
  pythonCmd: string,
  root: string,
  input: Record<string, unknown>,
  options: {
    maxItems?: number;
    maxEstimatedTokens?: number;
    repoRoot?: string;
  } = {},
): { status: number | null; stdout: string; stderr: string } {
  const kwargs: string[] = [];
  if (options.maxItems !== undefined) {
    kwargs.push(`max_items=${options.maxItems}`);
  }
  if (options.maxEstimatedTokens !== undefined) {
    kwargs.push(`max_estimated_tokens=${options.maxEstimatedTokens}`);
  }
  if (options.repoRoot !== undefined) {
    kwargs.push(`repo_root=r"${options.repoRoot.replace(/\\/g, "\\\\")}"`);
  }
  const kwargsExpr = kwargs.length > 0 ? `, ${kwargs.join(", ")}` : "";

  const script = `
import json, sys
sys.path.insert(0, r"${path.join(root, ".trellis", "scripts").replace(/\\/g, "\\\\")}")
from common.retrieval_pack import build_retrieval_pack
payload = json.loads(sys.stdin.read())
print(json.dumps(build_retrieval_pack(
    retrieval_guide=payload.get("retrievalGuide"),
    artifact_search_results=payload.get("artifactSearchResults"),
    session_memory_results=payload.get("sessionMemoryResults"),
    smart_search_manifests=payload.get("smartSearchManifests"),
    smart_search_manifest_paths=payload.get("smartSearchManifestPaths"),
    codebase_candidates=payload.get("codebaseCandidates"),
    router_envelope=payload.get("routerEnvelope"),
    adapter_hints=payload.get("adapterHints")${kwargsExpr}
), ensure_ascii=False))
`;
  const result = spawnSync(pythonCmd, ["-c", script], {
    cwd: root,
    encoding: "utf-8",
    input: JSON.stringify(input),
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

export function scoreBySource(
  payload: ScoredEvidencePayload,
  source: string,
): ScoredEvidenceItem | undefined {
  return payload.items.find((item) => item.source === source);
}

export function scoresBySource(
  payload: ScoredEvidencePayload,
  source: string,
): ScoredEvidenceItem[] {
  return payload.items.filter((item) => item.source === source);
}

export function assertMonotonicScores(items: ScoredEvidenceItem[]): void {
  for (let index = 1; index < items.length; index += 1) {
    const prev = items[index - 1];
    const current = items[index];
    if (!prev || !current) {
      continue;
    }
    if (prev.score < current.score) {
      throw new Error(
        `score ordering violated at index ${index}: ${prev.score} < ${current.score}`,
      );
    }
  }
}
