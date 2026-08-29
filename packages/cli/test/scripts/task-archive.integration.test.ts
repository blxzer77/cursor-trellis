/**
 * Integration tests for `task.py archive` auto-commit behavior.
 *
 * The python script lives under
 * `src/templates/trellis/scripts/common/task_store.py`; this test stamps
 * the templates into a fresh git repo and exercises the real
 * `task.py archive` path. Two scenarios:
 *
 *   1. Scope-creep — archive must NOT bundle dirty changes from OTHER
 *      active task dirs into the archive commit.
 *   2. Phantom-delete — after `shutil.move` of a tracked task dir, the
 *      source-side deletions must land in the archive commit (so the
 *      working tree stays clean against HEAD).
 *   3. Lite + blocked auto-commit — archive move still Close-succeeds;
 *      VCS failure is on-demand, not a Lite completion condition.
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

function pythonExe(): string | null {
  for (const exe of ["python", "py", "python3"]) {
    if (spawnSync(exe, ["--version"], { encoding: "utf-8" }).status === 0) {
      return exe;
    }
  }
  return null;
}

const PY = pythonExe();

function git(cwd: string, ...args: string[]): string {
  const r = spawnSync("git", args, { cwd, encoding: "utf-8" });
  if (r.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed (rc=${r.status}): ${r.stderr}`,
    );
  }
  return r.stdout.trim();
}

function setupRepo(tmp: string): void {
  fs.mkdirSync(tmp, { recursive: true });
  git(tmp, "init", "-q", "-b", "main");
  // Local commit identity so commit() works in CI without global config.
  git(tmp, "config", "user.email", "test@example.com");
  git(tmp, "config", "user.name", "Test");

  // Stamp the real templates into the test repo.
  const scriptsDest = path.join(tmp, ".cstl", "scripts");
  fs.mkdirSync(scriptsDest, { recursive: true });
  fs.cpSync(TEMPLATE_SCRIPTS, scriptsDest, { recursive: true });

  // session_auto_commit must be enabled for the archive to commit.
  fs.writeFileSync(
    path.join(tmp, ".cstl", "config.yaml"),
    "session_auto_commit: true\n",
  );
}

function minimalVerifyMd(): string {
  return [
    "# verify",
    "Validation commands: pytest task-archive integration — pass",
    "Final acceptance evidence: archive integration test acceptance",
    "Durable learning decision: no durable learning",
    "",
  ].join("\n");
}

function makeTask(repo: string, name: string, prdBody: string): void {
  const dir = path.join(repo, ".cstl", "tasks", name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "prd.md"), prdBody);
  fs.writeFileSync(path.join(dir, "verify.md"), minimalVerifyMd());
  fs.writeFileSync(
    path.join(dir, "task.json"),
    JSON.stringify({
      id: name,
      name,
      title: name,
      description: prdBody.trim(),
      status: "in_progress",
      dev_type: null,
      scope: null,
      package: null,
      priority: "P2",
      creator: "test",
      assignee: "test",
      createdAt: "2026-05-13",
      completedAt: null,
      branch: null,
      base_branch: null,
      worktree_path: null,
      commit: null,
      pr_url: null,
      subtasks: [],
      children: [],
      parent: null,
      relatedFiles: [],
      notes: "",
      meta: {},
    }) + "\n",
  );
}

const CLI_BIN = path.resolve(__dirname, "../../bin/cstl.js");

/** Full argv for `kernel_command.py` (not just the binary path). */
function kernelCliEnv(): NodeJS.ProcessEnv {
  const quoted = /\s/.test(CLI_BIN) ? `"${CLI_BIN}"` : CLI_BIN;
  return {
    ...process.env,
    TRELLIS_KERNEL_CLI: `node ${quoted} kernel --json`,
  };
}

function runArchive(repo: string, taskName: string): void {
  if (!PY) {
    throw new Error("python executable not found");
  }
  const r = spawnSync(
    PY,
    [".cstl/scripts/task.py", "archive", taskName],
    { cwd: repo, encoding: "utf-8", env: kernelCliEnv() },
  );
  if (r.status !== 0) {
    throw new Error(`archive failed: ${r.stderr}`);
  }
}

describe.skipIf(!PY)(
  "task.py archive auto-commit",
  () => {
    let tmp: string;

    beforeEach(() => {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-archive-test-"));
      setupRepo(tmp);
    });

    afterEach(() => {
      fs.rmSync(tmp, { recursive: true, force: true });
    });

    it("does not bundle dirty changes from other task dirs (scope-creep fix)", () => {
      makeTask(tmp, "task-a", "task A prd\n");
      makeTask(tmp, "task-b", "task B prd v1\n");
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");

      // Dirty edit in task-b BEFORE archiving task-a.
      fs.appendFileSync(
        path.join(tmp, ".cstl", "tasks", "task-b", "prd.md"),
        "DIRTY EDIT IN TASK-B SHOULD NOT BE COMMITTED\n",
      );

      runArchive(tmp, "task-a");

      // Last commit: which files?
      const lastFiles = git(
        tmp,
        "show",
        "HEAD",
        "--name-only",
        "--pretty=format:",
      )
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);

      // task-b paths must NOT appear in the archive commit.
      const leaked = lastFiles.filter((f) => f.includes("/task-b/"));
      expect(leaked).toEqual([]);

      // task-b dirty change still in working tree.
      const status = git(tmp, "status", "--porcelain");
      expect(status).toMatch(/M\s+\.cstl\/tasks\/task-b\/prd\.md/);
    });

    it(
      "stages source-side deletions in the archive commit (phantom-delete fix)",
      () => {
        makeTask(tmp, "big", "# big task\n");
        // Add many files under research/ to mimic the production case that
        // surfaced the bug.
        const researchDir = path.join(
          tmp,
          ".cstl",
          "tasks",
          "big",
          "research",
        );
        fs.mkdirSync(researchDir, { recursive: true });
        for (let i = 0; i < 100; i++) {
          fs.writeFileSync(
            path.join(researchDir, `file-${i}.json`),
            `{"n":${i}}\n`,
          );
        }
        git(tmp, "add", "-A");
        git(tmp, "commit", "-q", "-m", "initial");

        runArchive(tmp, "big");

        // Working tree must be clean (no phantom deletes against HEAD).
        const status = git(tmp, "status", "--porcelain");
        const meaningful = status
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
          .filter((s) => !s.includes("__pycache__")); // ignore .pyc noise
        expect(meaningful).toEqual([]);

        // Archive commit has deletions at the source location.
        const deletes = git(
          tmp,
          "show",
          "HEAD",
          "--diff-filter=D",
          "--name-only",
          "--pretty=format:",
        )
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean);
        expect(deletes.length).toBeGreaterThan(0);
        expect(
          deletes.every((p) => p.startsWith(".cstl/tasks/big/")),
        ).toBe(true);
      },
      30_000, // python startup + 100-file ops can be slow
    );

    it("Lite Close still succeeds when git auto-commit is blocked", () => {
      makeTask(tmp, "tracked", "# tracked task\n");
      git(tmp, "add", "-A");
      git(tmp, "commit", "-q", "-m", "initial");

      // Failing hook is deterministic even when the machine has a global
      // git identity. Lite treats VCS as on-demand: Close Outcome stands.
      const hookPath = path.join(tmp, ".git", "hooks", "pre-commit");
      fs.writeFileSync(
        hookPath,
        "#!/bin/sh\necho archive commit blocked >&2\nexit 1\n",
      );
      fs.chmodSync(hookPath, 0o755);

      const r = spawnSync(
        PY!,
        [".cstl/scripts/task.py", "archive", "tracked"],
        { cwd: tmp, encoding: "utf-8", env: kernelCliEnv() },
      );

      expect(r.status, r.stderr).toBe(0);
      expect(r.stderr).toMatch(/Auto-commit failed|Lite Close Outcome stands/);

      const status = git(tmp, "status", "--porcelain");
      expect(status).toContain(".cstl/tasks/archive/");
    });
  },
);
