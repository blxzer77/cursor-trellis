/**
 * Integration tests for `task.py generate-dispatch-prompt` (CLI Layer 2).
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
const TEMPLATE_HOOK = path.resolve(
  __dirname,
  "../../src/templates/shared-hooks/inject-subagent-context.py",
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
  fs.cpSync(TEMPLATE_SCRIPTS, path.join(tmp, ".trellis", "scripts"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(tmp, ".cursor", "hooks"), { recursive: true });
  fs.copyFileSync(
    TEMPLATE_HOOK,
    path.join(tmp, ".cursor", "hooks", "inject-subagent-context.py"),
  );
}

describe("generate-dispatch-prompt integration", () => {
  let tmp = "";

  beforeEach(() => {
    if (!hasPython()) return;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-dispatch-"));
    stampRepo(tmp);
  });

  afterEach(() => {
    if (tmp && fs.existsSync(tmp)) {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("stdout includes marker and prd title for in_progress implement task", () => {
    if (!hasPython()) return;

    const taskDir = path.join(tmp, ".trellis", "tasks", "06-22-fixture");
    fs.mkdirSync(taskDir, { recursive: true });
    fs.writeFileSync(
      path.join(taskDir, "task.json"),
      JSON.stringify({ status: "in_progress" }, null, 2),
    );
    fs.writeFileSync(
      path.join(taskDir, "prd.md"),
      "# Fixture PRD Title\n\nAcceptance line.",
    );
    fs.writeFileSync(
      path.join(taskDir, "implement.jsonl"),
      '{"_example": "seed"}\n',
    );

    const relTask = ".trellis/tasks/06-22-fixture";
    const { status, stdout, stderr } = runPython(tmp, ".trellis/scripts/task.py", [
      "generate-dispatch-prompt",
      relTask,
      "implement",
      "--scope",
      "Implement the fixture.",
    ]);

    expect(status).toBe(0);
    expect(stdout).toContain("<!-- cstl-hook-injected -->");
    expect(stdout).toContain("Fixture PRD Title");
    expect(stdout).toContain(`Selected task: ${relTask}`);
    expect(stderr).toMatch(/no curated entries/i);
  });

  it("fails implement when task is not in_progress", () => {
    if (!hasPython()) return;

    const taskDir = path.join(tmp, ".trellis", "tasks", "06-22-planning");
    fs.mkdirSync(taskDir, { recursive: true });
    fs.writeFileSync(
      path.join(taskDir, "task.json"),
      JSON.stringify({ status: "planning" }, null, 2),
    );
    fs.writeFileSync(path.join(taskDir, "prd.md"), "# Planning\n");

    const { status, stderr } = runPython(tmp, ".trellis/scripts/task.py", [
      "generate-dispatch-prompt",
      ".trellis/tasks/06-22-planning",
      "implement",
    ]);

    expect(status).toBe(1);
    expect(stderr).toMatch(/in_progress/);
  });

  it("hook skips when prompt already has injection marker", () => {
    if (!hasPython()) return;

    const hookInput = {
      tool_name: "Task",
      cwd: tmp,
      tool_input: {
        subagent_type: "cstl-implement",
        prompt: "<!-- cstl-hook-injected -->\nAlready embedded",
      },
    };

    const r = spawnSync(pythonBin(), [".cursor/hooks/inject-subagent-context.py"], {
      cwd: tmp,
      input: JSON.stringify(hookInput),
      encoding: "utf-8",
    });

    expect(r.status).toBe(0);
    expect((r.stdout ?? "").trim()).toBe("");
  });

  it("hook and CLI share the same builder output shape", () => {
    if (!hasPython()) return;

    const taskDir = path.join(tmp, ".trellis", "tasks", "06-22-shared");
    fs.mkdirSync(taskDir, { recursive: true });
    fs.writeFileSync(
      path.join(taskDir, "task.json"),
      JSON.stringify({ status: "in_progress" }, null, 2),
    );
    fs.writeFileSync(path.join(taskDir, "prd.md"), "# Shared Builder\n");
    fs.writeFileSync(path.join(taskDir, "implement.jsonl"), '{"_example": "seed"}\n');

    const relTask = ".trellis/tasks/06-22-shared";
    const cli = runPython(tmp, ".trellis/scripts/task.py", [
      "generate-dispatch-prompt",
      relTask,
      "implement",
    ]);
    expect(cli.status).toBe(0);

    const hookInput = {
      tool_name: "Task",
      cwd: tmp,
      tool_input: {
        subagent_type: "cstl-implement",
        prompt: `Selected task: ${relTask}\n\nDo the work.`,
      },
    };
    const hook = spawnSync(
      pythonBin(),
      [".cursor/hooks/inject-subagent-context.py"],
      {
        cwd: tmp,
        input: JSON.stringify(hookInput),
        encoding: "utf-8",
      },
    );
    expect(hook.status).toBe(0);
    const payload = JSON.parse(hook.stdout ?? "{}");
    const hookPrompt = payload.updated_input?.prompt ?? "";
    expect(hookPrompt).toContain("<!-- cstl-hook-injected -->");
    expect(hookPrompt).toContain("Shared Builder");
    expect(hookPrompt).toContain("# Implement Agent Task");
    expect(cli.stdout).toContain("# Implement Agent Task");
  });
});
