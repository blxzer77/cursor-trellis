import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SHARED_HOOKS_BY_PLATFORM,
  getSharedHookScripts,
  getSharedHookScriptsForPlatform,
  type SharedHookPlatform,
} from "../../src/templates/shared-hooks/index.js";

const SHARED_HOOKS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/templates/shared-hooks",
);

function pythonExe(): string {
  for (const exe of ["python", "py", "python3"]) {
    if (spawnSync(exe, ["--version"], { encoding: "utf-8" }).status === 0) {
      return exe;
    }
  }
  return "python";
}

const WORKFLOW_FIXTURE = `# Fixture workflow — sentinels must not reach SessionStart

## Phase Index
UNIQUE_PHASE_INDEX_SENTINEL
ASCII Task Ladder that SessionStart used to dump.

[workflow-state:no_task]
UNIQUE_WORKFLOW_STATE_METHODOLOGY
[/workflow-state:no_task]

[workflow-state:planning]
MANDATORY TRIAGE (hard gate): emit [Triage: No Task|Micro-Grill|Lite|Full|Parent]
[/workflow-state:planning]

## Task Ladder
UNIQUE_TASK_LADDER_SENTINEL

## Phase 1: Plan
UNIQUE_PHASE1_BODY_SENTINEL
`;

const ACTIVE_TASK_STUB = `from __future__ import annotations
from dataclasses import dataclass

@dataclass
class SelectedTask:
    task_path: str | None = None
    source_type: str = "none"
    context_key: str | None = None
    stale: bool = False

    @property
    def source(self) -> str:
        return self.source_type

def resolve_context_key(input_data, platform=None):
    return None

def resolve_selected_task(repo_root, input_data, platform=None):
    return SelectedTask()
`;

function makeFixtureProject(): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cstl-except-old-"));
  const commonDir = path.join(tmpDir, ".cstl", "scripts", "common");
  fs.mkdirSync(commonDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, ".cstl", "workflow.md"), WORKFLOW_FIXTURE);
  fs.writeFileSync(path.join(commonDir, "__init__.py"), "");
  fs.writeFileSync(path.join(commonDir, "active_task.py"), ACTIVE_TASK_STUB);
  return tmpDir;
}

function runHook(
  hookName: string,
  tmpDir: string,
  extraEnv: Record<string, string> = {},
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(pythonExe(), [path.join(SHARED_HOOKS_DIR, hookName)], {
    cwd: tmpDir,
    encoding: "utf-8",
    input: JSON.stringify({ cwd: tmpDir, cursor_version: "1.0" }),
    env: {
      ...process.env,
      CURSOR_PROJECT_DIR: tmpDir,
      ...extraEnv,
    },
    timeout: 20_000,
  });
  return {
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

const ALL_HOOK_FILES = [
  "session-start.py",
  "event-bridge.py",
  "inject-shell-session-context.py",
  "rename-session-for-task.py",
  "inject-retrieval-plan.py",
  "inject-workflow-state.py",
  "inject-subagent-context.py",
  "research-end-retrieval-pack.py",
] as const;

describe("shared-hooks capability table", () => {
  it("every capability-table entry names a real shared-hook file", () => {
    const realFiles = new Set(getSharedHookScripts().map((h) => h.name));
    for (const [platform, hooks] of Object.entries(
      SHARED_HOOKS_BY_PLATFORM,
    )) {
      for (const hook of hooks) {
        expect(
          realFiles.has(hook),
          `${platform} declares ${hook} but no such file exists under shared-hooks/`,
        ).toBe(true);
      }
    }
  });

  it("every shared-hook file is distributed to at least one platform", () => {
    const distributed = new Set<string>();
    for (const hooks of Object.values(SHARED_HOOKS_BY_PLATFORM)) {
      for (const h of hooks) distributed.add(h);
    }
    for (const hook of getSharedHookScripts()) {
      expect(
        distributed.has(hook.name),
        `${hook.name} exists under shared-hooks/ but no platform installs it — dead template`,
      ).toBe(true);
    }
  });

  it("statusline.py is not distributed by default", () => {
    const realFiles = new Set(getSharedHookScripts().map((h) => h.name));
    expect(realFiles.has("statusline.py")).toBe(false);
    for (const [platform, hooks] of Object.entries(
      SHARED_HOOKS_BY_PLATFORM,
    )) {
      expect(
        (hooks as readonly string[]).includes("statusline.py"),
        `${platform} must not install the generated statusline.py hook by default`,
      ).toBe(false);
    }
  });

  it("inject-subagent-context.py is restricted to class-1 push-based platforms", () => {
    // Class-2 (pull-based) platforms load context via agent-definition prelude,
    // not a hook-mutated prompt.
    const class2 = new Set(["codex", "copilot", "gemini", "qoder"]);
    for (const [platform, hooks] of Object.entries(
      SHARED_HOOKS_BY_PLATFORM,
    )) {
      const has = hooks.includes("inject-subagent-context.py");
      if (class2.has(platform))
        expect(
          has,
          `${platform} is class-2 pull-based and must not ship inject-subagent-context.py`,
        ).toBe(false);
    }
  });

  it("codex + copilot do not take the shared session-start.py (they bundle their own)", () => {
    expect(SHARED_HOOKS_BY_PLATFORM.codex).not.toContain("session-start.py");
    expect(SHARED_HOOKS_BY_PLATFORM.copilot).not.toContain("session-start.py");
  });

  it("inject-retrieval-plan.py goes to Cursor only", () => {
    for (const [platform, hooks] of Object.entries(
      SHARED_HOOKS_BY_PLATFORM,
    )) {
      const has = hooks.includes("inject-retrieval-plan.py");
      if (platform === "cursor") expect(has).toBe(true);
      else
        expect(
          has,
          `${platform} declares inject-retrieval-plan.py but only Cursor wires beforeSubmitPrompt`,
        ).toBe(false);
    }
  });

  it("inject-shell-session-context.py goes to Cursor only", () => {
    for (const [platform, hooks] of Object.entries(
      SHARED_HOOKS_BY_PLATFORM,
    )) {
      const has = hooks.includes("inject-shell-session-context.py");
      if (platform === "cursor") expect(has).toBe(true);
      else
        expect(
          has,
          `${platform} declares inject-shell-session-context.py but does not use Cursor beforeShellExecution`,
        ).toBe(false);
    }
  });

  it("rename-session-for-task.py goes to Cursor only", () => {
    for (const [platform, hooks] of Object.entries(
      SHARED_HOOKS_BY_PLATFORM,
    )) {
      const has = hooks.includes("rename-session-for-task.py");
      if (platform === "cursor") expect(has).toBe(true);
      else
        expect(
          has,
          `${platform} declares rename-session-for-task.py but only Cursor wires afterShellExecution rename`,
        ).toBe(false);
    }
  });

  it("rename-session-for-task.py targets select and start-execution only", () => {
    const hook = getSharedHookScripts().find(
      (h) => h.name === "rename-session-for-task.py",
    );
    expect(hook).toBeDefined();
    const content = hook?.content ?? "";
    expect(content).toContain('subcommand == "select"');
    expect(content).toContain('subcommand == "start-execution"');
    expect(content).toContain("--approved");
    expect(content).toContain("rename_chat");
    expect(content).not.toContain("create");
  });

  it("kiro registers only inject-subagent-context.py (agentSpawn is its only hook event)", () => {
    expect([...SHARED_HOOKS_BY_PLATFORM.kiro]).toEqual([
      "inject-subagent-context.py",
    ]);
  });

  it("getSharedHookScriptsForPlatform returns exactly the declared set per platform", () => {
    for (const platform of Object.keys(
      SHARED_HOOKS_BY_PLATFORM,
    ) as SharedHookPlatform[]) {
      const names = getSharedHookScriptsForPlatform(platform)
        .map((h) => h.name)
        .sort();
      const expected = [...SHARED_HOOKS_BY_PLATFORM[platform]].sort();
      expect(names).toEqual(expected);
    }
  });

  it("shared-hooks directory only contains files enumerated by ALL_HOOK_FILES", () => {
    // Guards against a new shared hook being added without the capability
    // table being updated.
    const actual = new Set(getSharedHookScripts().map((h) => h.name));
    const expected = new Set(ALL_HOOK_FILES);
    expect(actual).toEqual(expected);
  });

  it("shared hooks do not read legacy .current-task state", () => {
    for (const hook of getSharedHookScripts()) {
      expect(
        hook.content,
        `${hook.name} must use the session-scoped active task resolver`,
      ).not.toContain(".current-task");
      expect(hook.content).not.toContain("global fallback");
    }
  });

  it("shared session-start.py injects compact task artifact guidance", () => {
    const sessionStart = getSharedHookScripts().find(
      (h) => h.name === "session-start.py",
    );
    expect(sessionStart, "session-start.py is missing from shared-hooks/").toBeDefined();
    const content = sessionStart ? sessionStart.content : "";
    expect(content).toContain("<trellis-workflow>");
    expect(content).toContain("Task context order");
    expect(content).toContain("jsonl entries -> `prd.md`");
    expect(content).toContain("Lightweight task can request start review with PRD-only");
    expect(content).toContain("complex task must add");
    expect(content).not.toContain("Status: READY");
    expect(content).not.toContain("<workflow>");
    expect(content).toContain('if _detect_platform(hook_input) == "cursor"');
    expect(content).toContain("External web research (Cursor)");
    expect(content).toContain("./.cstl/scripts/run_smart_search.py");
    expect(content).toContain("retrieval-daily-guide.md");
    expect(content).toContain("not a file under `.cursor/skills/`");
    expect(content).not.toContain("Trellis/packages/cli/bin/smart-search.js");
    expect(content).toContain("cursor-web-fallback");
    expect(content).not.toContain("_extract_range");
    expect(content).not.toContain('Phase 1: Plan');
  });

  it("session-start and inject-workflow-state do not require [Triage:] prints", () => {
    for (const name of ["session-start.py", "inject-workflow-state.py"] as const) {
      const hook = getSharedHookScripts().find((h) => h.name === name);
      expect(hook, `${name} is missing from shared-hooks/`).toBeDefined();
      const content = hook?.content ?? "";
      expect(content).not.toMatch(/\[Triage: No Task\|Micro-Grill/);
      expect(content).not.toContain(
        "Emit the classification as the first line",
      );
    }
  });

  it("session-start.py resolves the trellis dir upward, not hardcoded to project_dir", () => {
    // Regression: the template previously hardcoded `trellis_dir = project_dir / ".cstl"`,
    // which crashes in thin-connect sub-repos that resolve to a root cstl instance
    // (2026-08-16 instance-boundary decision). Must mirror the deployed root hook's
    // _resolve_trellis_dir(): nearest .cstl upward, fallback to project_dir/.cstl.
    const sessionStart = getSharedHookScripts().find(
      (h) => h.name === "session-start.py",
    );
    expect(sessionStart, "session-start.py is missing from shared-hooks/").toBeDefined();
    const content = sessionStart ? sessionStart.content : "";
    expect(content).not.toContain('trellis_dir = project_dir / ".cstl"');
    expect(content).toContain("def _resolve_trellis_dir(project_dir");
    expect(content).toContain("trellis_dir = _resolve_trellis_dir(project_dir)");
    expect(content).toContain('(current / ".cstl").is_dir()');
    expect(content).toContain("current.parent == current");
    expect(content).toContain('return project_dir / ".cstl"');
  });

  it("session-start does not dump fixture Phase Index / Task Ladder into trellis-workflow", () => {
    const tmpDir = makeFixtureProject();
    try {
      const overview = spawnSync(
        pythonExe(),
        [
          "-c",
          "import importlib.util, os, sys\n"
          + "from pathlib import Path\n"
          + "hook = Path(os.environ['CSTL_HOOK'])\n"
          + "wf = Path(os.environ['CSTL_WORKFLOW'])\n"
          + "spec = importlib.util.spec_from_file_location('session_start', hook)\n"
          + "mod = importlib.util.module_from_spec(spec)\n"
          + "spec.loader.exec_module(mod)\n"
          + "sys.stdout.write(mod._build_workflow_overview(wf))\n",
        ],
        {
          encoding: "utf-8",
          env: {
            ...process.env,
            CSTL_HOOK: path.join(SHARED_HOOKS_DIR, "session-start.py"),
            CSTL_WORKFLOW: path.join(tmpDir, ".cstl", "workflow.md"),
          },
          timeout: 20_000,
        },
      );
      expect(overview.status, overview.stderr).toBe(0);
      expect(overview.stdout).not.toContain("UNIQUE_PHASE_INDEX_SENTINEL");
      expect(overview.stdout).not.toContain("UNIQUE_TASK_LADDER_SENTINEL");
      expect(overview.stdout).not.toContain("UNIQUE_PHASE1_BODY_SENTINEL");
      expect(overview.stdout).not.toContain("UNIQUE_WORKFLOW_STATE_METHODOLOGY");
      expect(overview.stdout).not.toContain("[Triage: No Task");

      const ran = runHook("session-start.py", tmpDir);
      expect(ran.status, ran.stderr).toBe(0);
      const payload = JSON.parse(ran.stdout) as {
        additional_context?: string;
        hookSpecificOutput?: { additionalContext?: string };
      };
      const context =
        payload.additional_context ||
        payload.hookSpecificOutput?.additionalContext ||
        "";
      expect(context).not.toContain("UNIQUE_PHASE_INDEX_SENTINEL");
      expect(context).not.toContain("UNIQUE_TASK_LADDER_SENTINEL");
      expect(context).not.toContain("UNIQUE_PHASE1_BODY_SENTINEL");
      expect(context).not.toContain("UNIQUE_WORKFLOW_STATE_METHODOLOGY");
      expect(context).not.toContain("[Triage: No Task");
      const block = context.match(
        /<trellis-workflow>([\s\S]*?)<\/trellis-workflow>/,
      );
      expect(block).not.toBeNull();
      expect(block?.[1].trim().length ?? 0).toBeLessThan(400);
      expect(block?.[1]).not.toContain("UNIQUE_PHASE_INDEX_SENTINEL");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("inject-workflow-state.py no-ops with exit 0 and no methodology block", () => {
    const tmpDir = makeFixtureProject();
    try {
      const ran = runHook("inject-workflow-state.py", tmpDir);
      expect(ran.status, ran.stderr).toBe(0);
      expect(ran.stdout).not.toContain("[workflow-state:");
      expect(ran.stdout).not.toContain("UNIQUE_WORKFLOW_STATE_METHODOLOGY");
      expect(ran.stdout).not.toContain("[Triage: No Task");

      const missing = fs.mkdtempSync(path.join(os.tmpdir(), "cstl-except-old-none-"));
      try {
        const silent = runHook("inject-workflow-state.py", missing);
        expect(silent.status, silent.stderr).toBe(0);
        expect(silent.stdout).not.toContain("[workflow-state:");
      } finally {
        fs.rmSync(missing, { recursive: true, force: true });
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
