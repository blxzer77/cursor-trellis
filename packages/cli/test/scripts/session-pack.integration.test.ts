import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  resolvePython,
  runGetContext,
  seedEvalProject,
} from "./retrieval-eval-fixtures.js";

const pythonCmd = resolvePython();
const modulesSrc = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/templates/trellis/modules",
);
const sessionPackSrc = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/templates/trellis/scripts/common/session_pack.py",
);

function writeModules(root: string): void {
  const dest = path.join(root, ".cstl", "modules");
  fs.cpSync(modulesSrc, dest, { recursive: true });
  fs.mkdirSync(path.join(dest, "ghost-unactivated"), { recursive: true });
  fs.writeFileSync(
    path.join(dest, "ghost-unactivated", "contract.md"),
    "# `ghost-unactivated`\nUNIQUE_UNACTIVATED_MODULE_SENTINEL\n",
    "utf-8",
  );
}

function runPackJson(
  root: string,
  extraArgs: string[] = [],
): { status: number | null; stdout: string; stderr: string } {
  const script = path.join(root, ".cstl", "scripts", "compile_session_pack.py");
  const result = spawnSync(pythonCmd as string, [script, "--json", ...extraArgs], {
    cwd: root,
    encoding: "utf-8",
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

interface SessionPack {
  source: string;
  activationSource: { kind: string; ondemandActive: string[]; baselineActive?: string[] };
  layers: {
    n: number;
    name: string;
    moduleIds?: string[];
    present?: boolean;
    intents?: string[];
    text?: string;
    items?: { path: string; excerpt: string }[];
  }[];
}

describe.skipIf(pythonCmd === null)("compile_session_pack.py", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cstl-session-pack-"));
    seedEvalProject(tmpDir);
    writeModules(tmpDir);
    fs.copyFileSync(
      sessionPackSrc,
      path.join(tmpDir, ".cstl", "scripts", "common", "session_pack.py"),
    );
    fs.writeFileSync(
      path.join(tmpDir, ".cstl", "workflow.md"),
      "# workflow\nUNIQUE_PHASE_INDEX_SENTINEL\n[workflow-state:planning]\n",
    );
    fs.writeFileSync(
      path.join(tmpDir, "AGENTS.md"),
      "UNIQUE_AGENTS_LONGFORM_SENTINEL\n",
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("emits layers 1-5 and activationSource without dumping workflow sentinels", () => {
    const ran = runPackJson(tmpDir);
    expect(ran.status, ran.stderr).toBe(0);
    const pack = JSON.parse(ran.stdout) as SessionPack;
    expect(pack.source).toBe("context-progressive");
    expect(pack.activationSource.kind).toBe("profile-runtime");
    expect(pack.layers.map((layer) => layer.n)).toEqual([1, 2, 3, 4, 5]);
    const layer2 = pack.layers[1]?.moduleIds ?? [];
    expect(layer2.length).toBeLessThan(20);
    expect(ran.stdout).not.toContain("UNIQUE_PHASE_INDEX_SENTINEL");
    expect(ran.stdout).not.toContain("UNIQUE_AGENTS_LONGFORM_SENTINEL");
    expect(ran.stdout).not.toContain("[workflow-state:planning]");
    expect(ran.stdout).not.toContain("[workflow-state:no_task]");
  });

  it("does not load unactivated contract.md files from disk", () => {
    const ran = runPackJson(tmpDir);
    expect(ran.status, ran.stderr).toBe(0);
    const pack = JSON.parse(ran.stdout) as SessionPack;
    const layer2 = pack.layers[1]?.moduleIds ?? [];
    expect(layer2).not.toContain("ghost-unactivated");
    expect(layer2).not.toContain("parent-child");
    expect(JSON.stringify(pack)).not.toContain("UNIQUE_UNACTIVATED_MODULE_SENTINEL");
  });

  it("without a selected task, layer 2 is intake-only and artifacts stay empty", () => {
    fs.rmSync(path.join(tmpDir, ".cstl", ".runtime", "sessions"), {
      recursive: true,
      force: true,
    });
    const ran = runPackJson(tmpDir);
    expect(ran.status, ran.stderr).toBe(0);
    const pack = JSON.parse(ran.stdout) as SessionPack;
    expect(pack.layers[1]?.moduleIds).toEqual(["intake-basic"]);
    expect(pack.layers[2]?.items ?? []).toEqual([]);
    expect(pack.layers[1]?.text ?? "").not.toContain("# `parent-child`");
    expect(pack.layers[1]?.text ?? "").not.toContain("# `worker-orchestration`");
    expect(pack.layers[1]?.text ?? "").not.toContain("# `vcs-integration`");
  });

  it("blocked condition puts debug-recovery on layer 5, not layer 2", () => {
    const taskDir = path.join(tmpDir, ".cstl", "tasks", "blocked-exec");
    fs.mkdirSync(taskDir, { recursive: true });
    fs.writeFileSync(
      path.join(taskDir, "kernel.json"),
      JSON.stringify({
        phase: "execute",
        condition: "blocked",
        outcome: null,
        projection: {
          extras: {
            required_controls: { rigor: "lite" },
            topology: { kind: "single" },
            ondemand_modules: { active: ["debug-recovery"] },
          },
        },
      }),
      "utf-8",
    );
    fs.writeFileSync(
      path.join(taskDir, "task.json"),
      JSON.stringify({
        id: "blocked-exec",
        status: "in_progress",
        required_controls: { rigor: "lite" },
        topology: { kind: "single" },
      }),
      "utf-8",
    );
    const ran = runPackJson(tmpDir, ["--task", ".cstl/tasks/blocked-exec"]);
    expect(ran.status, ran.stderr).toBe(0);
    const pack = JSON.parse(ran.stdout) as SessionPack;
    expect(pack.layers[1]?.moduleIds ?? []).not.toContain("debug-recovery");
    expect(pack.layers[4]?.present).toBe(true);
    expect(pack.layers[4]?.moduleIds).toEqual(["debug-recovery"]);
    expect(pack.layers[4]?.text ?? "").toContain("debug-recovery");
    expect(pack.layers[4]?.text ?? "").not.toContain("## 职责");
  });

  it("get_context --mode session returns the same five-layer shape", () => {
    const result = runGetContext(pythonCmd as string, tmpDir, [
      "--mode",
      "session",
      "--json",
    ]);
    expect(result.status, result.stderr).toBe(0);
    const pack = JSON.parse(result.stdout) as SessionPack;
    expect(pack.source).toBe("context-progressive");
    expect(pack.layers.map((layer) => layer.n)).toEqual([1, 2, 3, 4, 5]);
    expect(pack.activationSource.kind).toBe("profile-runtime");
  });

  it("drops a Baseline id from layer 2 when it is removed from baseline_modules.active", () => {
    const taskDir = path.join(tmpDir, ".cstl", "tasks", "exec-off");
    fs.mkdirSync(taskDir, { recursive: true });
    const baselineSansExecute = [
      "intake-basic",
      "define-basic",
      "approval-personal",
      "verify-basic",
      "close-basic",
      "context-progressive",
      "observability-local",
    ];
    fs.writeFileSync(
      path.join(taskDir, "kernel.json"),
      JSON.stringify({
        phase: "execute",
        condition: "active",
        outcome: null,
        projection: {
          extras: {
            required_controls: { rigor: "lite" },
            topology: { kind: "single" },
            baseline_modules: { active: baselineSansExecute },
            ondemand_modules: { active: [] },
          },
        },
      }),
      "utf-8",
    );
    fs.writeFileSync(
      path.join(taskDir, "task.json"),
      JSON.stringify({
        id: "exec-off",
        status: "in_progress",
        required_controls: { rigor: "lite" },
        topology: { kind: "single" },
        baseline_modules: { active: baselineSansExecute },
      }),
      "utf-8",
    );
    fs.writeFileSync(path.join(taskDir, "prd.md"), "# Exec off\n\n- [ ] AC\n");
    const ran = runPackJson(tmpDir, ["--task", ".cstl/tasks/exec-off"]);
    expect(ran.status, ran.stderr).toBe(0);
    const pack = JSON.parse(ran.stdout) as SessionPack;
    expect(pack.activationSource.kind).toBe("profile-runtime");
    expect(pack.activationSource.kind).not.toBe("wave2-stub");
    expect(pack.layers[1]?.moduleIds ?? []).not.toContain("execute-agent");
    expect(pack.layers[1]?.text ?? "").not.toContain("# `execute-agent`");
  });

  it("omits an On-demand contract until ondemand_modules.active is written", () => {
    const taskDir = path.join(tmpDir, ".cstl", "tasks", "define-ext");
    fs.mkdirSync(taskDir, { recursive: true });
    const writeTask = (active: string[]) => {
      fs.writeFileSync(
        path.join(taskDir, "kernel.json"),
        JSON.stringify({
          phase: "define",
          condition: "ready",
          outcome: null,
          projection: {
            extras: {
              required_controls: { rigor: "full" },
              topology: { kind: "single" },
              ondemand_modules: { active },
            },
          },
        }),
        "utf-8",
      );
      fs.writeFileSync(
        path.join(taskDir, "task.json"),
        JSON.stringify({
          id: "define-ext",
          status: "planning",
          required_controls: { rigor: "full" },
          topology: { kind: "single" },
          ondemand_modules: { active },
        }),
        "utf-8",
      );
      fs.writeFileSync(path.join(taskDir, "prd.md"), "# Define\n\n- [ ] AC\n");
    };
    writeTask([]);
    const off = runPackJson(tmpDir, ["--task", ".cstl/tasks/define-ext"]);
    expect(off.status, off.stderr).toBe(0);
    const offPack = JSON.parse(off.stdout) as SessionPack;
    expect(offPack.layers[1]?.moduleIds ?? []).not.toContain("define-extended");
    expect(offPack.layers[1]?.text ?? "").not.toContain("# `define-extended`");

    writeTask(["define-extended"]);
    const on = runPackJson(tmpDir, ["--task", ".cstl/tasks/define-ext"]);
    expect(on.status, on.stderr).toBe(0);
    const onPack = JSON.parse(on.stdout) as SessionPack;
    expect(onPack.activationSource.kind).toBe("profile-runtime");
    expect(onPack.layers[1]?.moduleIds ?? []).toContain("define-extended");
    expect(onPack.layers[1]?.text ?? "").toContain("# `define-extended`");
  });
});
