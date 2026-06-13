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

interface ContextPayload {
  developer: string;
  tasks: {
    active: unknown[];
  };
  retrievalGuide: {
    artifactSearch: {
      command: string;
      purpose: string;
    };
    sessionMemory: {
      command: string;
      purpose: string;
    };
    smartSearchEvidence: {
      command: string;
      purpose: string;
    };
    codebaseEvidence: string;
    evidenceSinks: {
      exploratory: string;
      final: string;
    };
    selectedTaskArtifacts?: {
      taskPath: string;
      prd: boolean;
      design: boolean;
      implement: boolean;
      research: boolean;
      researchCount: number;
      verify: boolean;
    };
  };
}

function writeFile(root: string, rel: string, content: string): void {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf-8");
}

function writeJson(root: string, rel: string, data: unknown): void {
  writeFile(root, rel, `${JSON.stringify(data, null, 2)}\n`);
}

function writeTrellisScripts(root: string): void {
  const scriptsDir = path.join(root, ".trellis", "scripts");
  for (const [rel, content] of getAllScripts()) {
    writeFile(scriptsDir, rel, content);
  }
}

function seedProject(root: string): void {
  writeTrellisScripts(root);
  writeFile(root, ".trellis/.developer", "name=test-dev\n");
  writeJson(root, ".trellis/.runtime/sessions/context-loading-test.json", {
    selected_task: ".trellis/tasks/06-13-context",
  });
  writeJson(root, ".trellis/tasks/06-13-context/task.json", {
    id: "context",
    name: "context",
    title: "Context Loading",
    description: "Exercise selected-task retrieval context output.",
    status: "in_progress",
    assignee: "test-dev",
    priority: "P1",
    createdAt: "2026-06-13",
    children: [],
    parent: null,
    package: "trellis",
  });
  writeFile(root, ".trellis/tasks/06-13-context/prd.md", "# PRD\n");
  writeFile(root, ".trellis/tasks/06-13-context/design.md", "# Design\n");
  writeFile(
    root,
    ".trellis/tasks/06-13-context/research/baseline.md",
    "# Baseline\n",
  );
}

function runGetContext(
  root: string,
  args: string[] = [],
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    pythonCmd as string,
    [path.join(root, ".trellis", "scripts", "get_context.py"), ...args],
    {
      cwd: root,
      encoding: "utf-8",
      env: { ...process.env, TRELLIS_CONTEXT_ID: "context-loading-test" },
    },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe.skipIf(pythonCmd === null)("get_context.py retrieval guidance", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-context-loading-"));
    seedProject(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("renders retrieval guidance and selected-task artifact state in text output", () => {
    const result = runGetContext(tmpDir);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toContain("## RETRIEVAL GUIDE");
    expect(result.stdout).toContain(
      'Artifact search: python3 ./.trellis/scripts/search_artifacts.py --query "<topic>" --json',
    );
    expect(result.stdout).toContain(
      'Session memory: python3 ./.trellis/scripts/search_memory.py --query "<topic>" --json',
    );
    expect(result.stdout).toContain(
      "Use session memory for reusable prior decisions",
    );
    expect(result.stdout).toContain(
      'Smart Search evidence: python3 ./.trellis/scripts/run_smart_search.py "<question>" --intent deep-research --json',
    );
    expect(result.stdout).toContain(
      "Run Smart Search evidence only when external/current source evidence is needed",
    );
    expect(result.stdout).toContain(
      "Codebase evidence: adapter output is candidate evidence",
    );
    expect(result.stdout).toContain(
      ".trellis/tasks/06-13-context/research/*.md for exploratory chains",
    );
    expect(result.stdout).toContain(
      ".trellis/tasks/06-13-context/verify.md for final proof",
    );
    expect(result.stdout).toContain("Selected-task artifacts:");
    expect(result.stdout).toContain("- prd.md: present");
    expect(result.stdout).toContain("- design.md: present");
    expect(result.stdout).toContain("- implement.md: missing");
    expect(result.stdout).toContain("- research/: 1 markdown file(s)");
    expect(result.stdout).toContain("- verify.md: missing");
  });

  it("adds retrieval guidance to JSON without removing existing context keys", () => {
    const result = runGetContext(tmpDir, ["--json"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const payload = JSON.parse(result.stdout) as ContextPayload;
    expect(payload.developer).toBe("test-dev");
    expect(payload.tasks.active).toHaveLength(1);
    expect(payload.retrievalGuide.artifactSearch.command).toBe(
      'python3 ./.trellis/scripts/search_artifacts.py --query "<topic>" --json',
    );
    expect(payload.retrievalGuide.sessionMemory.command).toBe(
      'python3 ./.trellis/scripts/search_memory.py --query "<topic>" --json',
    );
    expect(payload.retrievalGuide.sessionMemory.purpose).toContain(
      "workspace journals",
    );
    expect(payload.retrievalGuide.smartSearchEvidence.command).toBe(
      'python3 ./.trellis/scripts/run_smart_search.py "<question>" --intent deep-research --json',
    );
    expect(payload.retrievalGuide.smartSearchEvidence.purpose).toContain(
      "task-local evidence manifest",
    );
    expect(payload.retrievalGuide.codebaseEvidence).toContain(
      "candidate evidence",
    );
    expect(payload.retrievalGuide.evidenceSinks.exploratory).toBe(
      "selected task research/*.md",
    );
    expect(payload.retrievalGuide.selectedTaskArtifacts).toEqual({
      taskPath: ".trellis/tasks/06-13-context",
      prd: true,
      design: true,
      implement: false,
      research: true,
      researchCount: 1,
      verify: false,
    });
  });
});
