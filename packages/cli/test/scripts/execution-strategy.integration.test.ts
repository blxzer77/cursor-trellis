/**
 * Integration tests for suggest-execution-strategy and start-execution drift WARN.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEMPLATE_ROOT = path.resolve(
  __dirname,
  "../../src/templates/trellis",
);
const TEMPLATE_SCRIPTS = path.join(TEMPLATE_ROOT, "scripts");

function pythonExe(): string {
  for (const exe of ["python", "py", "python3"]) {
    if (spawnSync(exe, ["--version"], { encoding: "utf-8" }).status === 0) {
      return exe;
    }
  }
  return "python";
}

const PY = pythonExe();

function runTask(
  repo: string,
  args: string[],
): { status: number | null; stdout: string; stderr: string } {
  const r = spawnSync(PY, [".trellis/scripts/task.py", ...args], {
    cwd: repo,
    encoding: "utf-8",
  });
  return {
    status: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

function setupRepo(tmp: string): void {
  fs.mkdirSync(path.join(tmp, ".trellis", "tasks"), { recursive: true });
  fs.mkdirSync(path.join(tmp, ".trellis", "config"), { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, path.join(tmp, ".trellis", "scripts"), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(TEMPLATE_ROOT, "config", "execution-strategy-rules.json"),
    path.join(tmp, ".trellis", "config", "execution-strategy-rules.json"),
  );
}

function writeJson(file: string, data: unknown): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

function makeFullTask(
  repo: string,
  name: string,
  opts: {
    package?: string;
    scope?: string;
    contractMode?: string;
    contractIso?: string;
    caps?: string[];
    parent?: string | null;
    children?: string[];
    classification?: string;
  } = {},
): string {
  const taskDir = path.join(repo, ".trellis", "tasks", name);
  fs.mkdirSync(taskDir, { recursive: true });
  const mode = opts.contractMode ?? "worker";
  const iso = opts.contractIso ?? "main-worktree";
  const caps = opts.caps ?? ["python-task-scripts"];
  const contractBody = [
    "execution_mode: " + mode,
    "isolation: " + iso,
    "verification_profile: standard",
    "retrieval_profile: structure",
    caps.length
      ? "optional_capabilities:\n" + caps.map((c) => `  - ${c}`).join("\n")
      : "optional_capabilities: []",
    "quality_gates:",
    "  mode: profile",
    "  profile: standard",
    "  enabled: []",
    "  disabled: []",
    "",
  ].join("\n");

  writeJson(path.join(taskDir, "task.json"), {
    id: name,
    name,
    title: name,
    status: "planning",
    parent: opts.parent ?? null,
    children: opts.children ?? [],
    package: opts.package,
    scope: opts.scope,
    meta: { classification: opts.classification ?? "full" },
  });
  fs.writeFileSync(
    path.join(taskDir, "prd.md"),
    "# prd\n\n## Acceptance Criteria\n\n- [ ] ok\n",
  );
  fs.writeFileSync(path.join(taskDir, "design.md"), "# design\n");
  fs.writeFileSync(path.join(taskDir, "implement.md"), contractBody);
  return taskDir;
}

describe("execution-strategy integration", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-exec-strat-"));
    setupRepo(tmp);
    const git = spawnSync("git", ["init"], { cwd: tmp, encoding: "utf-8" });
    expect(git.status).toBe(0);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("suggest-execution-strategy --json recommends worker for code-touching full task", () => {
    makeFullTask(tmp, "code-full", {
      package: "packages/cli",
      caps: ["python-task-scripts"],
    });
    const r = runTask(tmp, [
      "suggest-execution-strategy",
      ".trellis/tasks/code-full",
      "--json",
    ]);
    expect(r.status).toBe(0);
    const payload = JSON.parse(r.stdout) as {
      execution_mode: string;
      isolation: string;
      skipped: boolean;
    };
    expect(payload.skipped).toBe(false);
    expect(payload.execution_mode).toBe("worker");
    expect(payload.isolation).toBe("main-worktree");
  });

  it("suggest-execution-strategy recommends inline for doc-only capabilities", () => {
    makeFullTask(tmp, "doc-only", {
      caps: ["markdown-documentation"],
      contractMode: "inline",
    });
    const r = runTask(tmp, [
      "suggest-execution-strategy",
      ".trellis/tasks/doc-only",
      "--json",
    ]);
    expect(r.status).toBe(0);
    const payload = JSON.parse(r.stdout) as { execution_mode: string };
    expect(payload.execution_mode).toBe("inline");
  });

  it("start-execution --check WARNs when contract drifts from suggestion", () => {
    makeFullTask(tmp, "drift", {
      package: "packages/cli",
      contractMode: "inline",
      contractIso: "main-worktree",
      caps: ["python-task-scripts"],
    });
    const r = runTask(tmp, ["start-execution", ".trellis/tasks/drift", "--check"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PASS");
    expect(r.stderr).toContain("[execution-strategy] WARN");
    expect(r.stderr).toMatch(/execution_mode/);
  });
});