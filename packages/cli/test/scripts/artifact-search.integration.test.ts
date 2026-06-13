import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getAllScripts } from "../../src/templates/trellis/index.js";

function resolvePython(): string | null {
  const candidates = process.platform === "win32" ? ["python", "python3"] : ["python3", "python"];
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

interface ArtifactSearchPayload {
  total: number;
  results: ArtifactSearchResult[];
}

interface ArtifactSearchResult {
  path: string;
  kind: string;
  category: string;
  title: string | null;
  frontmatter: Record<string, unknown>;
  matched_fields: string[];
  snippets: { line: number; text: string; anchor?: string }[];
  score: number;
}

function writeFile(root: string, rel: string, content: string): void {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf-8");
}

function writeTrellisScripts(root: string): void {
  const scriptsDir = path.join(root, ".trellis", "scripts");
  for (const [rel, content] of getAllScripts()) {
    writeFile(path.join(scriptsDir), rel, content);
  }
}

function seedArtifacts(root: string): void {
  writeTrellisScripts(root);
  writeFile(
    root,
    ".trellis/spec/backend/index.md",
    [
      "# Backend Guidelines",
      "",
      "Adapter freshness must be recorded before relying on generated code context.",
      "",
    ].join("\n"),
  );
  writeFile(
    root,
    ".trellis/tasks/06-13-plain/prd.md",
    [
      "# Plain Requirement",
      "",
      "Adapter freshness requires source evidence in a plain markdown task.",
      "",
    ].join("\n"),
  );
  writeFile(
    root,
    ".trellis/tasks/06-13-search/research/retrieval.md",
    [
      "---",
      "title: Retrieval Research",
      "doc_type: research",
      "status: active",
      "confidence: high",
      "related_files:",
      "  - packages/cli/src/templates/trellis/scripts/get_context.py",
      "---",
      "# Retrieval Research",
      "",
      "## Key Evidence",
      "",
      "Adapter freshness should be checked before claims are trusted.",
      "",
    ].join("\n"),
  );
  writeFile(
    root,
    ".trellis/tasks/06-13-search/verify.md",
    [
      "# Verify",
      "",
      "Validation: Adapter freshness behavior was checked.",
      "",
    ].join("\n"),
  );
  writeFile(
    root,
    ".trellis/workspace/test-dev/journal-1.md",
    [
      "# Journal",
      "",
      "Discussed artifact retrieval and durable evidence.",
      "",
    ].join("\n"),
  );
}

function runSearch(root: string, args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    pythonCmd as string,
    [path.join(root, ".trellis", "scripts", "search_artifacts.py"), ...args],
    { cwd: root, encoding: "utf-8" },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function parseJson(stdout: string): ArtifactSearchPayload {
  return JSON.parse(stdout) as ArtifactSearchPayload;
}

describe.skipIf(pythonCmd === null)("search_artifacts.py", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-artifact-search-"));
    seedArtifacts(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("searches plain markdown and frontmatter artifacts with stable JSON", () => {
    const result = runSearch(tmpDir, ["--query", "adapter freshness", "--json"]);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const payload = parseJson(result.stdout);
    expect(payload.total).toBeGreaterThanOrEqual(4);

    const research = payload.results.find((item) =>
      item.path.endsWith("/research/retrieval.md"),
    );
    expect(research).toBeDefined();
    expect(research?.kind).toBe("task_research");
    expect(research?.category).toBe("task");
    expect(research?.title).toBe("Retrieval Research");
    expect(research?.frontmatter.status).toBe("active");
    expect(research?.frontmatter.related_files).toEqual([
      "packages/cli/src/templates/trellis/scripts/get_context.py",
    ]);
    expect(research?.matched_fields).toContain("body");
    expect(research?.snippets[0]?.anchor).toBe("key-evidence");

    const plain = payload.results.find((item) =>
      item.path.endsWith("/06-13-plain/prd.md"),
    );
    expect(plain).toBeDefined();
    expect(plain?.kind).toBe("task_prd");
    expect(plain?.frontmatter).toEqual({});
    expect(plain?.snippets[0]?.text).toContain("plain markdown task");
  });

  it("filters frontmatter with exact, substring, and list matching", () => {
    const result = runSearch(tmpDir, [
      "--filter",
      "status=active",
      "--filter",
      "related_files~=packages/cli",
      "--kind",
      "task_research",
      "--json",
    ]);

    expect(result.status).toBe(0);
    const payload = parseJson(result.stdout);
    expect(payload.total).toBe(1);
    expect(payload.results[0]?.path).toBe(
      ".trellis/tasks/06-13-search/research/retrieval.md",
    );
    expect(payload.results[0]?.matched_fields).toEqual([
      "frontmatter.related_files",
      "frontmatter.status",
    ]);
  });

  it("uses deterministic path ordering after score ties and honors limit", () => {
    writeFile(
      tmpDir,
      ".trellis/tasks/06-13-tie-a/design.md",
      "# Tie A\n\nDeterministic needle text.\n",
    );
    writeFile(
      tmpDir,
      ".trellis/tasks/06-13-tie-b/design.md",
      "# Tie B\n\nDeterministic needle text.\n",
    );

    const result = runSearch(tmpDir, [
      "--query",
      "needle",
      "--kind",
      "task_design",
      "--limit",
      "1",
      "--json",
    ]);

    expect(result.status).toBe(0);
    const payload = parseJson(result.stdout);
    expect(payload.total).toBe(1);
    expect(payload.results[0]?.path).toBe(
      ".trellis/tasks/06-13-tie-a/design.md",
    );
  });

  it("returns an empty result set for no-match queries", () => {
    const result = runSearch(tmpDir, ["--query", "does-not-exist", "--json"]);

    expect(result.status).toBe(0);
    const payload = parseJson(result.stdout);
    expect(payload.total).toBe(0);
    expect(payload.results).toEqual([]);
  });
});
