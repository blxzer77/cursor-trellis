import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  listProjectFiles,
  resolvePython,
  runBuildRetrievalPack,
  runGetContext,
  writeFile,
  writeJson,
  writeTrellisScripts,
  type RetrievalPackPayload,
} from "./retrieval-eval-fixtures.js";

export const DOGFOOD_TASK_PATH = ".trellis/tasks/06-13-dogfood-retrieval";
export const DOGFOOD_DEVELOPER = "dogfood-dev";
export const DOGFOOD_SESSION_ID = "retrieval-dogfood-test";
export const DOGFOOD_ARCHIVE_TASK_PREFIX = ".trellis/tasks/archive-fixtures";

const fixtureRoot = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../fixtures/retrieval-dogfood/archive",
);

export const archiveFixtureSources = [
  {
    slug: "06-13-retrieval-evidence-scoring",
    files: ["prd.md", "design.md", "implement.md", "verify.md", "handoff.md"],
    role: "Phase 3 scoring contract and handoff",
  },
  {
    slug: "06-13-retrieval-context-pack-builder",
    files: ["prd.md", "design.md", "implement.md", "verify.md", "handoff.md"],
    role: "Phase 3 context pack contract",
  },
  {
    slug: "06-13-retrieval-eval-harness",
    files: ["prd.md", "design.md", "implement.md", "verify.md", "handoff.md"],
    role: "Phase 3 eval harness coverage matrix",
  },
  {
    slug: "06-13-trellis-retrieval-phase-3-evaluation-context-packing",
    files: ["prd.md", "design.md", "implement.md", "verify.md"],
    role: "Phase 3 parent integration proof",
  },
  {
    slug: "06-13-retrieval-context-ranking",
    files: ["prd.md", "design.md", "implement.md", "verify.md", "handoff.md"],
    role: "Ranking policy archive reference",
  },
  {
    slug: "06-13-retrieval-session-memory",
    files: ["prd.md", "design.md", "implement.md", "verify.md", "handoff.md"],
    role: "Session memory downstream contract",
  },
  {
    slug: "06-13-retrieval-smart-search-integration",
    files: ["prd.md", "design.md", "implement.md", "verify.md", "handoff.md"],
    role: "Smart Search manifest contract",
  },
] as const;

const smartSearchBase = `${DOGFOOD_TASK_PATH}/research/smart-search`;

function manifestFixture(
  run: string,
  status: string,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const evidenceDir = `${smartSearchBase}/${run}`;
  return {
    version: 1,
    source: "smart-search",
    query: `dogfood archive fixture ${run}`,
    intent: "deep-research",
    command: "smart-search research ...",
    outputPath: `${evidenceDir}/deep_research.json`,
    evidenceDir,
    manifestPath: `${evidenceDir}/manifest.json`,
    status,
    createdAt: "2026-06-13T00:00:00Z",
    summary: status === "degraded" ? "partial archive-backed summary" : "archive-backed summary",
    citations: [],
    gapCheck: status === "degraded" ? { missing: ["official docs"] } : {},
    providerAttempts: [],
    degraded: status === "degraded" || status === "failed",
    doctor: { ok: status === "ok" || status === "degraded" },
    ...overrides,
  };
}

function copyArchiveFixture(root: string, slug: string, files: readonly string[]): void {
  for (const file of files) {
    const source = path.join(fixtureRoot, slug, file);
    if (!fs.existsSync(source)) {
      continue;
    }
    const destination = path.join(
      root,
      DOGFOOD_ARCHIVE_TASK_PREFIX,
      slug,
      file,
    );
    writeFile(root, path.relative(root, destination).replace(/\\/g, "/"), fs.readFileSync(source, "utf-8"));
  }
}

function readBundledFixture(slug: string, file: string): string {
  return fs.readFileSync(path.join(fixtureRoot, slug, file), "utf-8");
}

export function seedDogfoodProject(root: string): void {
  writeTrellisScripts(root);
  writeFile(root, ".trellis/.developer", `name=${DOGFOOD_DEVELOPER}\n`);
  writeJson(root, `.trellis/.runtime/sessions/${DOGFOOD_SESSION_ID}.json`, {
    selected_task: DOGFOOD_TASK_PATH,
  });

  for (const source of archiveFixtureSources) {
    copyArchiveFixture(root, source.slug, source.files);
  }

  writeJson(root, `${DOGFOOD_TASK_PATH}/task.json`, {
    id: "dogfood-retrieval",
    name: "dogfood-retrieval",
    title: "Retrieval Dogfood And Real Fixtures",
    description: "Archive-backed retrieval pack dogfood task.",
    status: "in_progress",
    assignee: DOGFOOD_DEVELOPER,
    priority: "P1",
    createdAt: "2026-06-13",
    children: [],
    parent: null,
    package: "trellis",
  });
  writeFile(
    root,
    `${DOGFOOD_TASK_PATH}/prd.md`,
    readBundledFixture(
      "06-13-trellis-retrieval-phase-3-evaluation-context-packing",
      "prd.md",
    ),
  );
  writeFile(
    root,
    `${DOGFOOD_TASK_PATH}/design.md`,
    readBundledFixture("06-13-retrieval-eval-harness", "design.md"),
  );
  writeFile(
    root,
    `${DOGFOOD_TASK_PATH}/implement.md`,
    readBundledFixture("06-13-retrieval-eval-harness", "implement.md"),
  );
  writeFile(
    root,
    `${DOGFOOD_TASK_PATH}/verify.md`,
    readBundledFixture(
      "06-13-trellis-retrieval-phase-3-evaluation-context-packing",
      "verify.md",
    ),
  );
  writeFile(
    root,
    `${DOGFOOD_TASK_PATH}/handoff.md`,
    readBundledFixture("06-13-retrieval-eval-harness", "handoff.md"),
  );
  writeFile(
    root,
    `${DOGFOOD_TASK_PATH}/research/baseline.md`,
    [
      "# Baseline",
      "",
      "Archive-backed exploratory research for retrieval dogfood fixtures.",
      "",
    ].join("\n"),
  );
  writeFile(
    root,
    ".trellis/spec/Trellis/framework/retrieval-evidence-scoring.md",
    [
      "# Retrieval Evidence Scoring",
      "",
      readBundledFixture("06-13-retrieval-evidence-scoring", "handoff.md").split("\n").slice(0, 24).join("\n"),
      "",
    ].join("\n"),
  );
  writeFile(
    root,
    `.trellis/workspace/${DOGFOOD_DEVELOPER}/journal-1.md`,
    [
      "# Journal - dogfood-dev (Part 1)",
      "",
      "## Session 1: Retrieval Dogfood",
      "",
      "**Date**: 2026-06-13",
      "**Task**: Retrieval Dogfood And Real Fixtures",
      "**Package**: Trellis",
      "**Branch**: `feature/retrieval-dogfood`",
      "",
      "### Summary",
      "",
      "Phase 3 parent integrated evidence scoring, context pack builder, and eval harness.",
      "Archive-backed fixtures validate retrieval pack usefulness without live web calls.",
      "",
      "### Main Changes",
      "",
      "Copied archived handoffs into deterministic temp-project fixtures.",
      "",
      "### Git Commits",
      "",
      "| Hash | Message |",
      "|------|---------|",
      "| `abc1234` | (see git log) |",
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

export function runSearchArtifacts(
  pythonCmd: string,
  root: string,
  query: string,
): { status: number | null; stdout: string; stderr: string; results: Record<string, unknown>[] } {
  const result = spawnSync(
    pythonCmd,
    [path.join(root, ".trellis", "scripts", "search_artifacts.py"), "--query", query, "--json"],
    { cwd: root, encoding: "utf-8" },
  );
  const payload = result.stdout ? (JSON.parse(result.stdout) as { results?: Record<string, unknown>[] }) : {};
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    results: payload.results ?? [],
  };
}

export function runSearchMemory(
  pythonCmd: string,
  root: string,
  query: string,
): { status: number | null; stdout: string; stderr: string; results: Record<string, unknown>[] } {
  const result = spawnSync(
    pythonCmd,
    [path.join(root, ".trellis", "scripts", "search_memory.py"), "--query", query, "--json"],
    { cwd: root, encoding: "utf-8" },
  );
  const payload = result.stdout ? (JSON.parse(result.stdout) as { results?: Record<string, unknown>[] }) : {};
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    results: payload.results ?? [],
  };
}

export function getRetrievalGuide(
  pythonCmd: string,
  root: string,
): Record<string, unknown> {
  const result = runGetContext(pythonCmd, root, ["--json"], DOGFOOD_SESSION_ID);
  if (result.status !== 0) {
    throw new Error(result.stderr || "get_context --json failed");
  }
  const payload = JSON.parse(result.stdout) as { retrievalGuide?: Record<string, unknown> };
  return payload.retrievalGuide ?? {};
}

export function buildDogfoodRetrievalPack(
  pythonCmd: string,
  root: string,
  input: Record<string, unknown> = {},
  options: { maxItems?: number; maxEstimatedTokens?: number } = {},
): RetrievalPackPayload {
  const result = runBuildRetrievalPack(pythonCmd, root, input, {
    repoRoot: root,
    ...options,
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || "build_retrieval_pack failed");
  }
  return JSON.parse(result.stdout) as RetrievalPackPayload;
}

export function runGetContextRetrievalPack(
  pythonCmd: string,
  root: string,
  args: string[] = [],
): { status: number | null; stdout: string; stderr: string } {
  return runGetContext(pythonCmd, root, ["--mode", "retrieval-pack", ...args], DOGFOOD_SESSION_ID);
}

export function topSelectedScore(
  payload: RetrievalPackPayload,
  source: string,
): number {
  const scores = payload.contextPack.selected
    .filter((item) => item.source === source)
    .map((item) => ("score" in item ? Number(item.score) : 0));
  return scores.length > 0 ? Math.max(...scores) : 0;
}

export { listProjectFiles, resolvePython, type RetrievalPackPayload };
