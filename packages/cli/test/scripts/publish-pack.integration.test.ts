/**
 * Integration tests for task-map stages + task.py publish-pack.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEMPLATE_SCRIPTS = path.resolve(
  __dirname,
  "../../src/templates/trellis/scripts",
);

function hasPython(): boolean {
  for (const bin of ["python3", "python"]) {
    try {
      execFileSync(bin, ["--version"], { stdio: "ignore" });
      return true;
    } catch {
      /* try next */
    }
  }
  return false;
}

function pythonBin(): string {
  try {
    execFileSync("python3", ["--version"], { stdio: "ignore" });
    return "python3";
  } catch {
    return "python";
  }
}

function runPython(cwd: string, script: string, args: string[] = []): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const r = spawnSync(pythonBin(), [script, ...args], {
    cwd,
    encoding: "utf-8",
  });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

function stampRepo(tmp: string): void {
  fs.mkdirSync(tmp, { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, path.join(tmp, ".cstl", "scripts"), {
    recursive: true,
  });
}

function writeTask(dir: string, id: string): void {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "task.json"),
    JSON.stringify(
      {
        id,
        name: id,
        title: id,
        status: "planning",
        parent: id.startsWith("child") ? "parent-campaign" : null,
        children: id === "parent-campaign" ? ["child-a", "child-b", "child-c"] : [],
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(dir, "prd.md"),
    `# ${id}\n\n## Goal\n\nFixture goal for ${id}.\n`,
  );
}

describe("publish-pack integration", () => {
  let tmp = "";

  beforeEach(() => {
    if (!hasPython()) return;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-publish-pack-"));
    stampRepo(tmp);
  });

  afterEach(() => {
    if (tmp && fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("round-trips stages in task-map frontmatter", () => {
    if (!hasPython()) return;

    const parentDir = path.join(tmp, ".cstl", "tasks", "parent-campaign");
    writeTask(parentDir, "parent-campaign");
    writeTask(path.join(tmp, ".cstl", "tasks", "child-a"), "child-a");
    writeTask(path.join(tmp, ".cstl", "tasks", "child-b"), "child-b");

    fs.writeFileSync(
      path.join(parentDir, "task-map.md"),
      `---
parent_id: parent-campaign
contract_epoch: 1
execution_topology: parallel
merge_limit: 1
children:
  - id: child-a
    state: open
    depends_on: []
    touches: []
    isolation: none
    ref: null
  - id: child-b
    state: open
    depends_on: []
    touches: []
    isolation: none
    ref: null
stages:
  - id: stage-1
    title: First wave
    units: [child-a, child-b]
integration_queue: []
---
# Task Map
`,
    );

    const probePath = path.join(tmp, "probe_stages.py");
    const scriptsPath = path.join(tmp, ".cstl", "scripts").replace(/\\/g, "/");
    const parentPosix = parentDir.replace(/\\/g, "/");
    fs.writeFileSync(
      probePath,
      `
from pathlib import Path
import sys
sys.path.insert(0, r"${scriptsPath}")
from common.task_map import load_task_map, write_task_map

parent = Path(r"${parentPosix}")
data, body = load_task_map(parent)
assert data is not None, data
assert len(data.get("stages") or []) == 1, data.get("stages")
assert data["stages"][0]["id"] == "stage-1"
assert data["stages"][0]["units"] == ["child-a", "child-b"]
write_task_map(parent, data, body)
data2, _ = load_task_map(parent)
assert data2["stages"][0]["title"] == "First wave"
assert data2["stages"][0]["units"] == ["child-a", "child-b"]
print("ok")
`,
    );
    const { status, stdout, stderr } = runPython(tmp, probePath, []);
    expect(stderr).toBe("");
    expect(status).toBe(0);
    expect(stdout).toContain("ok");
  });

  it("publish-pack writes PACK.md and ready prompts; blocks unmet deps", () => {
    if (!hasPython()) return;

    const tasks = path.join(tmp, ".cstl", "tasks");
    const parentDir = path.join(tasks, "parent-campaign");
    writeTask(parentDir, "parent-campaign");
    writeTask(path.join(tasks, "child-a"), "child-a");
    writeTask(path.join(tasks, "child-b"), "child-b");
    writeTask(path.join(tasks, "child-c"), "child-c");

    fs.writeFileSync(
      path.join(parentDir, "task-map.md"),
      `---
parent_id: parent-campaign
contract_epoch: 1
execution_topology: parallel
merge_limit: 1
children:
  - id: child-a
    state: working
    depends_on: []
    touches: []
    isolation: none
    ref: null
  - id: child-b
    state: open
    depends_on: [child-a]
    touches: []
    isolation: none
    ref: null
  - id: child-c
    state: open
    depends_on: []
    touches: []
    isolation: none
    ref: null
stages:
  - id: stage-1
    title: Wave one
    units: [child-a, child-b]
  - id: stage-2
    title: Wave two
    units: [child-c]
integration_queue: []
---
# Task Map
`,
    );

    const { status, stdout, stderr } = runPython(tmp, ".cstl/scripts/task.py", [
      "publish-pack",
      ".cstl/tasks/parent-campaign",
    ]);
    expect(stderr).toBe("");
    expect(status).toBe(0);
    expect(stdout).toContain("ready: 2");
    expect(stdout).toContain("blocked: 1");
    expect(stdout).toContain("child-prompts/PACK.md");

    const pack = fs.readFileSync(
      path.join(parentDir, "child-prompts", "PACK.md"),
      "utf-8",
    );
    expect(pack).toContain("Manual window path");
    expect(pack).toContain("child-a");
    expect(pack).toContain("**blocked**");

    const readyA = fs.readFileSync(
      path.join(parentDir, "child-prompts", "child-a.md"),
      "utf-8",
    );
    expect(readyA).toContain("select .cstl/tasks/child-a");
    expect(readyA).toContain("Fixture goal for child-a");

    const blockedB = fs.readFileSync(
      path.join(parentDir, "child-prompts", "child-b.md"),
      "utf-8",
    );
    expect(blockedB).toContain("BLOCKED");
    expect(blockedB).toContain("child-a");
  });

  it("publish-pack --stage filters and --dry-run writes nothing", () => {
    if (!hasPython()) return;

    const tasks = path.join(tmp, ".cstl", "tasks");
    const parentDir = path.join(tasks, "parent-campaign");
    writeTask(parentDir, "parent-campaign");
    writeTask(path.join(tasks, "child-a"), "child-a");
    writeTask(path.join(tasks, "child-c"), "child-c");

    fs.writeFileSync(
      path.join(parentDir, "task-map.md"),
      `---
parent_id: parent-campaign
contract_epoch: 1
execution_topology: parallel
merge_limit: 1
children:
  - id: child-a
    state: open
    depends_on: []
    touches: []
    isolation: none
    ref: null
  - id: child-c
    state: open
    depends_on: []
    touches: []
    isolation: none
    ref: null
stages:
  - id: stage-1
    title: Wave one
    units: [child-a]
  - id: stage-2
    title: Wave two
    units: [child-c]
integration_queue: []
---
# Task Map
`,
    );

    const dry = runPython(tmp, ".cstl/scripts/task.py", [
      "publish-pack",
      ".cstl/tasks/parent-campaign",
      "--stage",
      "stage-2",
      "--dry-run",
    ]);
    expect(dry.status).toBe(0);
    expect(dry.stdout).toContain("stage-2");
    expect(dry.stdout).toContain("child-c");
    expect(dry.stdout).not.toContain("### `stage-1`");
    expect(fs.existsSync(path.join(parentDir, "child-prompts"))).toBe(false);

    const filtered = runPython(tmp, ".cstl/scripts/task.py", [
      "publish-pack",
      ".cstl/tasks/parent-campaign",
      "--stage",
      "stage-1",
    ]);
    expect(filtered.status).toBe(0);
    expect(fs.existsSync(path.join(parentDir, "child-prompts", "child-a.md"))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(parentDir, "child-prompts", "child-c.md"))).toBe(
      false,
    );
  });

  it("parent-status shows stages section", () => {
    if (!hasPython()) return;

    const tasks = path.join(tmp, ".cstl", "tasks");
    const parentDir = path.join(tasks, "parent-campaign");
    writeTask(parentDir, "parent-campaign");
    writeTask(path.join(tasks, "child-a"), "child-a");

    fs.writeFileSync(
      path.join(parentDir, "task-map.md"),
      `---
parent_id: parent-campaign
contract_epoch: 1
execution_topology: parallel
merge_limit: 1
children:
  - id: child-a
    state: working
    depends_on: []
    touches: []
    isolation: none
    ref: null
stages:
  - id: stage-1
    title: Solo
    units: [child-a]
integration_queue: []
---
# Task Map
`,
    );

    const { status, stdout } = runPython(tmp, ".cstl/scripts/task.py", [
      "parent-status",
      ".cstl/tasks/parent-campaign",
    ]);
    expect(status).toBe(0);
    expect(stdout).toContain("## Stages");
    expect(stdout).toContain("`stage-1` — Solo");
    expect(stdout).toContain("ready");
    expect(stdout).toContain("publish-pack");
  });
});
