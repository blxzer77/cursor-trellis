/**
 * Integration tests for gate / verify transition contract hardening.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEMPLATE_SCRIPTS = path.resolve(
  __dirname,
  "../../src/templates/trellis/scripts",
);

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
  fs.cpSync(TEMPLATE_SCRIPTS, path.join(tmp, ".trellis", "scripts"), {
    recursive: true,
  });
}

function writeJson(file: string, data: unknown): void {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
}

function fullChildContract(): string {
  return [
    "execution_mode: inline",
    "isolation: main-worktree",
    "verification_profile: standard",
    "retrieval_profile: exact-only",
    "optional_capabilities: []",
    "quality_gates:",
    "  mode: profile",
    "  profile: standard",
    "  enabled: []",
    "  disabled: []",
    "",
  ].join("\n");
}

function substantiveVerify(): string {
  return [
    "# verify",
    "Validation commands: pnpm test packages/cli/test/scripts/task-gates-transition-contract.integration.test.ts — pass",
    "Check evidence: focused gate contract tests executed locally",
    "Reviewed change-set: refs/heads/main",
    "Final acceptance evidence: child acceptance criteria met",
    "Durable learning decision: no durable learning",
    "",
  ].join("\n");
}

function makeFullChild(
  repo: string,
  parentName: string,
  childName: string,
): { parentDir: string; childDir: string } {
  const parentDir = path.join(repo, ".trellis", "tasks", parentName);
  const childDir = path.join(repo, ".trellis", "tasks", childName);
  fs.mkdirSync(parentDir, { recursive: true });
  fs.mkdirSync(childDir, { recursive: true });

  writeJson(path.join(parentDir, "task.json"), {
    id: parentName,
    name: parentName,
    title: parentName,
    status: "in_progress",
    children: [childName],
    parent: null,
    meta: { classification: "parent" },
  });
  writeJson(path.join(childDir, "task.json"), {
    id: childName,
    name: childName,
    title: childName,
    status: "in_progress",
    parent: parentName,
    children: [],
    meta: { classification: "full" },
  });

  fs.writeFileSync(path.join(childDir, "prd.md"), "# prd\n\n## Acceptance Criteria\n\n- [x] ok\n");
  fs.writeFileSync(path.join(childDir, "design.md"), "# design\n");
  fs.writeFileSync(path.join(childDir, "implement.md"), fullChildContract());
  fs.writeFileSync(path.join(childDir, "verify.md"), substantiveVerify());
  fs.writeFileSync(
    path.join(childDir, "handoff.md"),
    "Reviewed change-set: feature/test-child\n",
  );
  fs.writeFileSync(
    path.join(parentDir, "task-map.md"),
    [
      "---",
      "parent_id: parent",
      "merge_limit: 1",
      "children:",
      `  - id: ${childName}`,
      "    state: review",
      "    depends_on: []",
      "    touches: []",
      "---",
      "# Task Map",
      "",
    ].join("\n"),
  );
  return { parentDir, childDir };
}

describe("task_gates transition contract", () => {
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(
      path.join(os.tmpdir(), "trellis-gate-contract-test-"),
    );
    setupRepo(tmp);
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("classifies closeout profiles", () => {
    const r = spawnSync(
      PY,
      [
        "-c",
        [
          "import sys",
          "from pathlib import Path",
          "sys.path.insert(0, '.trellis/scripts')",
          "from common.task_gates import task_closeout_profile",
          "lite = Path('.trellis/tasks/lite')",
          "lite.mkdir(parents=True)",
          "full = Path('.trellis/tasks/full')",
          "full.mkdir(parents=True)",
          "(full / 'design.md').write_text('# d', encoding='utf-8')",
          "(full / 'implement.md').write_text('execution_mode: inline\\n', encoding='utf-8')",
          "parent = Path('.trellis/tasks/parent')",
          "parent.mkdir(parents=True)",
          "print(task_closeout_profile(lite, {'meta': {'classification': 'lite'}}))",
          "print(task_closeout_profile(full, {}))",
          "print(task_closeout_profile(parent, {'children': ['c1'], 'meta': {'classification': 'parent'}}))",
        ].join("\n"),
      ],
      { cwd: tmp, encoding: "utf-8" },
    );
    expect(r.status).toBe(0);
    expect(
      r.stdout
        .trim()
        .split(/\r?\n/)
        .map((line) => line.trim()),
    ).toEqual(["lite", "full", "parent"]);
  });

  it("rejects record-gate PASS when verify evidence is placeholder-only", () => {
    const taskDir = path.join(tmp, ".trellis", "tasks", "full-task");
    fs.mkdirSync(taskDir, { recursive: true });
    writeJson(path.join(taskDir, "task.json"), {
      id: "full-task",
      name: "full-task",
      title: "full-task",
      status: "in_progress",
      meta: { classification: "full" },
    });
    fs.writeFileSync(path.join(taskDir, "design.md"), "# design\n");
    fs.writeFileSync(path.join(taskDir, "implement.md"), fullChildContract());
    fs.writeFileSync(
      path.join(taskDir, "verify.md"),
      [
        "Validation commands: TBD",
        "Check evidence: TODO",
        "Reviewed change-set: -",
        "",
      ].join("\n"),
    );

    const result = runTask(tmp, [
      "record-gate",
      "full-task",
      "--transition",
      "full-task-complete",
      "--gate",
      "code-review",
      "--result",
      "PASS",
      "--reviewer",
      "tester",
      "--evidence",
      "verify.md",
    ]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/substantive validation evidence|check evidence|reviewed change-set/i);
  });

  it("requires Full Child child-review before Parent accept", () => {
    const parentName = "parent-a";
    const childName = "child-full";
    makeFullChild(tmp, parentName, childName);

    const result = runTask(tmp, [
      "integrate-child",
      parentName,
      childName,
      "accepted",
      "--evidence",
      "handoff.md",
      "--ref",
      "abc123",
      "--check",
    ]);
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(
      /missing gate record: child-review\/code-review/,
    );
  });

  it("allows Lite Child accept without child-review gate chain", () => {
    const parentName = "parent-lite";
    const childName = "child-lite";
    makeFullChild(tmp, parentName, childName);
    writeJson(path.join(tmp, ".trellis", "tasks", childName, "task.json"), {
      id: childName,
      name: childName,
      title: childName,
      status: "in_progress",
      parent: parentName,
      children: [],
      meta: { classification: "lite" },
    });
    fs.rmSync(path.join(tmp, ".trellis", "tasks", childName, "design.md"));
    fs.rmSync(path.join(tmp, ".trellis", "tasks", childName, "implement.md"));

    const result = runTask(tmp, [
      "integrate-child",
      parentName,
      childName,
      "accepted",
      "--evidence",
      "handoff.md",
      "--ref",
      "abc123",
      "--check",
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Integrate-child check: PASS");
  });

  it("validates integrate-through using simulated child states", () => {
    const parentName = "parent-through";
    const childName = "child-through";
    makeFullChild(tmp, parentName, childName);

    const gateResult = runTask(tmp, [
      "record-gate",
      childName,
      "--transition",
      "child-review",
      "--gate",
      "code-review",
      "--result",
      "PASS",
      "--reviewer",
      "parent",
      "--evidence",
      "verify.md",
    ]);
    expect(gateResult.status).toBe(0);

    const result = runTask(tmp, [
      "review-child",
      parentName,
      childName,
      "--decision",
      "integrate-through",
      "--ref",
      "abc123",
      "--check",
    ]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Review-child check: PASS");
  });

  it("blocks Parent archive when children remain accepted", () => {
    const parentName = "parent-archive";
    const parentDir = path.join(tmp, ".trellis", "tasks", parentName);
    fs.mkdirSync(parentDir, { recursive: true });
    writeJson(path.join(parentDir, "task.json"), {
      id: parentName,
      name: parentName,
      title: parentName,
      status: "in_progress",
      children: ["child-a"],
      meta: { classification: "parent" },
    });
    fs.writeFileSync(
      path.join(parentDir, "verify.md"),
      [
        "Validation commands: pnpm test — pass",
        "Final acceptance evidence: parent criteria met",
        "Durable learning decision: no durable learning",
        "Final integration evidence: child-a=accepted per task-map.md",
        "",
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(parentDir, "task-map.md"),
      [
        "---",
        "parent_id: parent-archive",
        "merge_limit: 1",
        "children:",
        "  - id: child-a",
        "    state: accepted",
        "    depends_on: []",
        "    touches: []",
        "---",
        "# Task Map",
        "",
      ].join("\n"),
    );

    const result = runTask(tmp, ["archive", parentName, "--check"]);
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(
      /integrated or cancelled before parent archive/,
    );
  });

  it("blocks Parent archive without integration-review gate", () => {
    const parentName = "parent-integrated-gate";
    const parentDir = path.join(tmp, ".trellis", "tasks", parentName);
    fs.mkdirSync(parentDir, { recursive: true });
    writeJson(path.join(parentDir, "task.json"), {
      id: parentName,
      name: parentName,
      title: parentName,
      status: "in_progress",
      children: ["child-a"],
      meta: { classification: "parent" },
    });
    fs.writeFileSync(
      path.join(parentDir, "verify.md"),
      [
        "Validation commands: pnpm test — pass",
        "Final acceptance evidence: parent criteria met",
        "Durable learning decision: no durable learning",
        "Final integration evidence: child-a=integrated per task-map.md",
        "",
      ].join("\n"),
    );
    fs.writeFileSync(
      path.join(parentDir, "task-map.md"),
      [
        "---",
        "parent_id: parent-integrated-gate",
        "merge_limit: 1",
        "children:",
        "  - id: child-a",
        "    state: integrated",
        "    depends_on: []",
        "    touches: []",
        "---",
        "# Task Map",
        "",
      ].join("\n"),
    );

    const result = runTask(tmp, ["archive", parentName, "--check"]);
    expect(result.status).not.toBe(0);
    expect(result.stdout + result.stderr).toMatch(
      /missing gate record: parent-integrated\/integration-review/,
    );
  });
});
