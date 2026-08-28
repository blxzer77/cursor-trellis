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

const FAKE_KERNEL = `import json, sys
from pathlib import Path
req = json.loads(sys.stdin.read())
op = req.get("op")
task_dir = Path(req["taskDir"])
task_dir.mkdir(parents=True, exist_ok=True)
kernel_path = task_dir / "kernel.json"
task_path = task_dir / "task.json"

def dump(payload, code=0):
    sys.stdout.write(json.dumps(payload) + "\\n")
    sys.exit(code)

def read_kernel():
    if kernel_path.is_file():
        return json.loads(kernel_path.read_text(encoding="utf-8"))
    return {
        "schemaVersion": 1,
        "identity": {"taskId": "missing"},
        "revision": 0,
        "phase": "define",
        "condition": "ready",
        "outcome": None,
        "audit": [],
        "gates": {"schemaVersion": 1, "transitions": {}},
        "projection": None,
    }

if op == "migrate":
    dump({"ok": True, "op": "migrate", "dryRun": True, "wrote": False, "scanned": 0, "findings": []})
if op == "read":
    kernel = read_kernel()
    status = "planning"
    if task_path.is_file():
        status = json.loads(task_path.read_text(encoding="utf-8")).get("status", "planning")
    dump({"ok": True, "op": "read", "kernel": kernel, "persisted": kernel_path.is_file(),
          "legacy": {"status": status, "id": kernel["identity"]["taskId"], "name": kernel["identity"]["taskId"], "title": ""}})

record = req.get("record") or {}
existing_task = json.loads(task_path.read_text(encoding="utf-8")) if task_path.is_file() else {}
status_by_op = {"create": "planning", "start": "in_progress", "archive": "completed"}
status = existing_task.get("status", "planning") if op in {"patch", "record-gate"} else status_by_op.get(op, "planning")
prev = read_kernel()
revision = int(prev.get("revision") or 0) + 1
task_id = (record.get("id") if isinstance(record, dict) else None) or prev.get("identity", {}).get("taskId") or "task"
kernel = {
    "schemaVersion": 1,
    "identity": {"taskId": task_id},
    "revision": revision,
    "phase": prev.get("phase", "define"),
    "condition": "ready",
    "outcome": "completed" if op == "archive" else None,
    "audit": list(prev.get("audit") or []) + [{"id": "a1", "idempotencyKey": req.get("idempotencyKey")}],
    "gates": prev.get("gates") or {"schemaVersion": 1, "transitions": {}},
    "projection": {"status": status, "record": record, "extras": req.get("extras") or {}},
}
if op == "record-gate":
    kernel["gates"].setdefault("transitions", {}).setdefault(req["transition"], {})[req["gate"]] = req["record"]
kernel_path.write_text(json.dumps(kernel, indent=2), encoding="utf-8")
projected = dict(existing_task)
if op != "record-gate" and isinstance(record, dict) and record:
    projected.update(record)
    projected["status"] = status
projected.update(req.get("extras") or {})
if projected:
    task_path.write_text(json.dumps(projected, indent=2), encoding="utf-8")
dump({"ok": True, "op": op, "kernel": kernel, "persisted": True, "projected": True, "idempotent": False,
      "legacy": {"status": status, "id": task_id, "name": task_id, "title": ""}, "audit": kernel["audit"][-1]})
`;

function runTask(
  repo: string,
  args: string[],
): { status: number | null; stdout: string; stderr: string } {
  const fakeKernel = path.join(repo, ".cstl", "scripts", "_fake_kernel.py");
  const r = spawnSync(PY, [".cstl/scripts/task.py", ...args], {
    cwd: repo,
    encoding: "utf-8",
    env: {
      ...process.env,
      TRELLIS_KERNEL_CLI: `${PY} ${fakeKernel}`,
    },
  });
  return {
    status: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

function setupRepo(tmp: string): void {
  fs.mkdirSync(path.join(tmp, ".cstl", "tasks"), { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, path.join(tmp, ".cstl", "scripts"), {
    recursive: true,
  });
  fs.writeFileSync(
    path.join(tmp, ".cstl", "scripts", "_fake_kernel.py"),
    FAKE_KERNEL,
    "utf-8",
  );
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
  const parentDir = path.join(repo, ".cstl", "tasks", parentName);
  const childDir = path.join(repo, ".cstl", "tasks", childName);
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
          "sys.path.insert(0, '.cstl/scripts')",
          "from common.task_gates import task_closeout_profile",
          "lite = Path('.cstl/tasks/lite')",
          "lite.mkdir(parents=True)",
          "full = Path('.cstl/tasks/full')",
          "full.mkdir(parents=True)",
          "(full / 'design.md').write_text('# d', encoding='utf-8')",
          "(full / 'implement.md').write_text('execution_mode: inline\\n', encoding='utf-8')",
          "parent = Path('.cstl/tasks/parent')",
          "parent.mkdir(parents=True)",
          "print(task_closeout_profile(lite, {'meta': {'classification': 'lite'}}))",
          "print(task_closeout_profile(full, {'required_controls': {'rigor': 'full'}}))",
          "print(task_closeout_profile(parent, {'children': ['c1'], 'meta': {'classification': 'parent'}}))",
          "print(task_closeout_profile(full, {}))",
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
    ).toEqual(["lite", "full", "parent", "lite"]);
  });

  it("rejects record-gate PASS when verify evidence is placeholder-only", () => {
    const taskDir = path.join(tmp, ".cstl", "tasks", "full-task");
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
    writeJson(path.join(tmp, ".cstl", "tasks", childName, "task.json"), {
      id: childName,
      name: childName,
      title: childName,
      status: "in_progress",
      parent: parentName,
      children: [],
      meta: { classification: "lite" },
    });
    fs.rmSync(path.join(tmp, ".cstl", "tasks", childName, "design.md"));
    fs.rmSync(path.join(tmp, ".cstl", "tasks", childName, "implement.md"));

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
    expect(gateResult.status, gateResult.stdout + gateResult.stderr).toBe(0);

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
    const parentDir = path.join(tmp, ".cstl", "tasks", parentName);
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
    const parentDir = path.join(tmp, ".cstl", "tasks", parentName);
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

  it("allows Parent archive after parent-integrated gate when implement.md contract is present", () => {
    const parentName = "parent-with-contract";
    const parentDir = path.join(tmp, ".cstl", "tasks", parentName);
    fs.mkdirSync(parentDir, { recursive: true });
    writeJson(path.join(parentDir, "task.json"), {
      id: parentName,
      name: parentName,
      title: parentName,
      status: "in_progress",
      children: ["child-a"],
      meta: { classification: "parent" },
    });
    fs.writeFileSync(path.join(parentDir, "implement.md"), fullChildContract());
    fs.writeFileSync(
      path.join(parentDir, "verify.md"),
      [
        "Validation commands: pnpm test — pass",
        "Check evidence: parent integration gate regression executed",
        "Reviewed change-set: task_gates.py parent contract fingerprint",
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
        "parent_id: parent-with-contract",
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

    const record = runTask(tmp, [
      "record-gate",
      parentName,
      "--transition",
      "parent-integrated",
      "--gate",
      "integration-review",
      "--result",
      "PASS",
      "--reviewer",
      "tester",
      "--evidence",
      "verify.md",
    ]);
    expect(record.status, record.stdout + record.stderr).toBe(0);

    const archive = runTask(tmp, ["archive", parentName, "--check"]);
    expect(archive.status).toBe(0);
    expect(archive.stdout + archive.stderr).not.toMatch(
      /stale contract fingerprint/,
    );
  });
});
