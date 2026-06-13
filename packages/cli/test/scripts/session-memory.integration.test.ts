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

interface MemoryPayload {
  total: number;
  results: MemoryResult[];
}

interface MemoryResult {
  version: number;
  source: string;
  developer: string;
  session: number;
  title: string;
  date: string;
  task: string;
  package: string;
  branch: string;
  commits: string[];
  summary: string;
  matchedSections: string[];
  matchedFields: string[];
  path: string;
  line: number;
  score: number;
  reason: string;
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

function seedProject(root: string): void {
  writeTrellisScripts(root);
  writeFile(root, ".trellis/.developer", "name=test-dev\n");
  writeFile(
    root,
    ".trellis/workspace/test-dev/journal-1.md",
    [
      "# Journal - test-dev (Part 1)",
      "",
      "## Session 1: Planning Baseline",
      "",
      "**Date**: 2026-06-10",
      "**Task**: Planning Baseline",
      "",
      "### Summary",
      "",
      "Defined old workflow notes without package metadata.",
      "",
      "### Main Changes",
      "",
      "Captured baseline memory behavior.",
      "",
      "### Git Commits",
      "",
      "(No commits - planning session)",
      "",
      "## Session 2: Smart Search Evidence",
      "",
      "**Date**: 2026-06-13",
      "**Task**: Smart Search Evidence",
      "**Package**: Trellis",
      "**Branch**: `feature/retrieval`",
      "",
      "### Summary",
      "",
      "Implemented Smart Search manifest handoff for retrieval ranking.",
      "",
      "### Main Changes",
      "",
      "Added task-local evidence files and session memory contract.",
      "",
      "### Git Commits",
      "",
      "| Hash | Message |",
      "|------|---------|",
      "| `abc1234` | (see git log) |",
      "",
      "### Next Steps",
      "",
      "Use context ranking to consume session memory.",
      "",
    ].join("\n"),
  );
}

function runSearchMemory(
  root: string,
  args: string[],
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    pythonCmd as string,
    [path.join(root, ".trellis", "scripts", "search_memory.py"), ...args],
    { cwd: root, encoding: "utf-8" },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe.skipIf(pythonCmd === null)("search_memory.py", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-session-memory-"));
    seedProject(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parses session journals and ranks reusable memory with stable JSON", () => {
    const result = runSearchMemory(tmpDir, [
      "--query",
      "smart evidence",
      "--json",
    ]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const payload = JSON.parse(result.stdout) as MemoryPayload;
    expect(payload.total).toBe(1);

    const memory = payload.results[0] as MemoryResult;
    expect(memory).toMatchObject({
      version: 1,
      source: "session-memory",
      developer: "test-dev",
      session: 2,
      title: "Smart Search Evidence",
      date: "2026-06-13",
      task: "Smart Search Evidence",
      package: "Trellis",
      branch: "feature/retrieval",
      commits: ["abc1234"],
      path: ".trellis/workspace/test-dev/journal-1.md",
    });
    expect(memory.summary).toContain("Smart Search manifest handoff");
    expect(memory.matchedSections).toContain("Summary");
    expect(memory.matchedSections).toContain("Main Changes");
    expect(memory.reason).toContain("matched 'smart'");
    expect(memory.score).toBeGreaterThan(0);
  });

  it("filters by package, branch, task, and date", () => {
    const result = runSearchMemory(tmpDir, [
      "--query",
      "context ranking",
      "--package",
      "Trellis",
      "--branch",
      "retrieval",
      "--task",
      "Smart Search",
      "--since",
      "2026-06-12",
      "--until",
      "2026-06-14",
      "--json",
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as MemoryPayload;
    expect(payload.total).toBe(1);
    expect(payload.results[0]?.matchedSections).toContain("Next Steps");
  });

  it("returns empty results for no match and missing workspace", () => {
    const noMatch = runSearchMemory(tmpDir, ["--query", "absent-token", "--json"]);
    expect(noMatch.status).toBe(0);
    expect((JSON.parse(noMatch.stdout) as MemoryPayload).results).toEqual([]);

    const emptyRoot = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-no-memory-"));
    try {
      writeTrellisScripts(emptyRoot);
      const missingWorkspace = runSearchMemory(emptyRoot, ["--query", "anything", "--json"]);
      expect(missingWorkspace.status).toBe(0);
      expect((JSON.parse(missingWorkspace.stdout) as MemoryPayload).total).toBe(0);
    } finally {
      fs.rmSync(emptyRoot, { recursive: true, force: true });
    }
  });
});
