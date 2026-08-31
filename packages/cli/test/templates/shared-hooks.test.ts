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
import os
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
    path = os.environ.get("CSTL_TEST_SELECTED_TASK") or None
    stale = os.environ.get("CSTL_TEST_SELECTED_STALE") == "1"
    return SelectedTask(task_path=path, source_type="test" if path else "none", stale=stale)
`;

const MODULES_SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/templates/trellis/modules",
);
const SESSION_PACK_SRC = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/templates/trellis/scripts/common/session_pack.py",
);

function seedCompiler(tmpDir: string, opts: { sessionPack?: boolean } = {}): void {
  const includePack = opts.sessionPack !== false;
  const modulesDest = path.join(tmpDir, ".cstl", "modules");
  fs.cpSync(MODULES_SRC, modulesDest, { recursive: true });
  fs.mkdirSync(path.join(modulesDest, "ghost-unactivated"), { recursive: true });
  fs.writeFileSync(
    path.join(modulesDest, "ghost-unactivated", "contract.md"),
    "# `ghost-unactivated`\nUNIQUE_UNACTIVATED_MODULE_SENTINEL\n",
    "utf-8",
  );
  if (includePack) {
    const commonDir = path.join(tmpDir, ".cstl", "scripts", "common");
    fs.mkdirSync(commonDir, { recursive: true });
    fs.copyFileSync(SESSION_PACK_SRC, path.join(commonDir, "session_pack.py"));
  }
}

function makeFixtureProject(opts: { sessionPack?: boolean } = {}): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cstl-mod-compiler-"));
  const commonDir = path.join(tmpDir, ".cstl", "scripts", "common");
  fs.mkdirSync(commonDir, { recursive: true });
  fs.writeFileSync(path.join(tmpDir, ".cstl", "workflow.md"), WORKFLOW_FIXTURE);
  fs.writeFileSync(
    path.join(tmpDir, "AGENTS.md"),
    "UNIQUE_AGENTS_LONGFORM_SENTINEL\n[workflow-state:no_task]\n",
  );
  fs.writeFileSync(path.join(commonDir, "__init__.py"), "");
  fs.writeFileSync(path.join(commonDir, "active_task.py"), ACTIVE_TASK_STUB);
  const otherTask = path.join(tmpDir, ".cstl", "tasks", "other-task");
  fs.mkdirSync(otherTask, { recursive: true });
  fs.writeFileSync(
    path.join(otherTask, "prd.md"),
    "# Other task\nUNIQUE_TASK_DIR_DUMP_SENTINEL\n",
  );
  seedCompiler(tmpDir, opts);
  return tmpDir;
}

function hookContext(stdout: string): string {
  const payload = JSON.parse(stdout) as {
    additional_context?: string;
    hookSpecificOutput?: { additionalContext?: string };
  };
  return (
    payload.additional_context ||
    payload.hookSpecificOutput?.additionalContext ||
    ""
  );
}

function packMeta(context: string): {
  activationSource?: { kind?: string };
  layer2ModuleIds?: string[];
  layers?: number[];
} {
  const block = context.match(
    /<session-pack-meta>([\s\S]*?)<\/session-pack-meta>/,
  );
  if (!block) return {};
  return JSON.parse(block[1]) as {
    activationSource?: { kind?: string };
    layer2ModuleIds?: string[];
    layers?: number[];
  };
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

  it("shared session-start.py injects the compiler, not hand-assembled guidelines", () => {
    const sessionStart = getSharedHookScripts().find(
      (h) => h.name === "session-start.py",
    );
    expect(sessionStart, "session-start.py is missing from shared-hooks/").toBeDefined();
    const content = sessionStart ? sessionStart.content : "";
    expect(content).toContain("_compile_session_pack_text");
    expect(content).toContain("cstl_session_pack");
    expect(content).not.toContain("<trellis-workflow>");
    expect(content).not.toContain("<guidelines>");
    expect(content).not.toContain("Task context order");
    expect(content).not.toContain("jsonl entries -> `prd.md`");
    expect(content).not.toContain("External web research (Cursor)");
    expect(content).not.toContain("./.cstl/scripts/run_smart_search.py");
    expect(content).not.toContain("Status: READY");
    expect(content).not.toContain("<workflow>");
    expect(content).not.toContain("_extract_range");
    expect(content).not.toContain("Phase 1: Plan");
    expect(content).not.toContain("_build_workflow_overview");
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

  it("session-start does not dump fixture Phase Index / Task Ladder / AGENTS", () => {
    const tmpDir = makeFixtureProject();
    try {
      const ran = runHook("session-start.py", tmpDir);
      expect(ran.status, ran.stderr).toBe(0);
      const context = hookContext(ran.stdout);
      expect(context).not.toContain("UNIQUE_PHASE_INDEX_SENTINEL");
      expect(context).not.toContain("UNIQUE_TASK_LADDER_SENTINEL");
      expect(context).not.toContain("UNIQUE_PHASE1_BODY_SENTINEL");
      expect(context).not.toContain("UNIQUE_WORKFLOW_STATE_METHODOLOGY");
      expect(context).not.toContain("UNIQUE_AGENTS_LONGFORM_SENTINEL");
      expect(context).not.toContain("[Triage: No Task");
      expect(context).not.toContain("<trellis-workflow>");
      expect(context).not.toContain("<guidelines>");
      expect(context).toContain("<session-pack");
      expect(context).toContain('<layer n="1"');
      expect(context).toContain('<layer n="5"');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("session-start layer 2 omits unactivated module contracts on disk", () => {
    const tmpDir = makeFixtureProject();
    try {
      const ran = runHook("session-start.py", tmpDir);
      expect(ran.status, ran.stderr).toBe(0);
      const context = hookContext(ran.stdout);
      const meta = packMeta(context);
      const ids = meta.layer2ModuleIds ?? [];
      expect(ids).not.toContain("ghost-unactivated");
      expect(ids).not.toContain("parent-child");
      expect(ids).not.toContain("worker-orchestration");
      expect(ids).not.toContain("vcs-integration");
      expect(context).not.toContain("UNIQUE_UNACTIVATED_MODULE_SENTINEL");
      expect(ids.length).toBeLessThan(20);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("session-start without selected_task skips Parent/Worker/VCS teaching and task dumps", () => {
    const tmpDir = makeFixtureProject();
    try {
      const ran = runHook("session-start.py", tmpDir);
      expect(ran.status, ran.stderr).toBe(0);
      const context = hookContext(ran.stdout);
      const meta = packMeta(context);
      const ids = meta.layer2ModuleIds ?? [];
      expect(ids).not.toContain("parent-child");
      expect(ids).not.toContain("worker-orchestration");
      expect(ids).not.toContain("vcs-integration");
      expect(context).not.toContain("UNIQUE_TASK_DIR_DUMP_SENTINEL");
      expect(context).not.toContain("# `parent-child`");
      expect(context).not.toContain("# `worker-orchestration`");
      expect(context).not.toContain("# `vcs-integration`");
      expect(ids).toEqual(["intake-basic"]);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("session-start pack has layers 1-5 and activationSource, not all 20 contracts", () => {
    const tmpDir = makeFixtureProject();
    try {
      const ran = runHook("session-start.py", tmpDir);
      expect(ran.status, ran.stderr).toBe(0);
      const context = hookContext(ran.stdout);
      const meta = packMeta(context);
      expect(meta.activationSource?.kind).toBe("profile-runtime");
      expect(meta.layers).toEqual([1, 2, 3, 4, 5]);
      expect(meta.layer2ModuleIds?.length ?? 0).toBeLessThan(20);
      expect(context).toContain('name="resident-min"');
      expect(context).toContain('name="activated-contracts"');
      expect(context).toContain('name="artifact-snippets"');
      expect(context).toContain('name="retrieval-pointer"');
      expect(context).toContain('name="deep-diagnosis"');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("Lite Single selected task keeps blocked on-demand modules out of layer 2", () => {
    const tmpDir = makeFixtureProject();
    try {
      const taskDir = path.join(tmpDir, ".cstl", "tasks", "lite-exec");
      fs.mkdirSync(taskDir, { recursive: true });
      fs.writeFileSync(
        path.join(taskDir, "task.json"),
        JSON.stringify({
          id: "lite-exec",
          name: "lite-exec",
          title: "Lite exec",
          status: "in_progress",
          required_controls: { rigor: "lite" },
          topology: { kind: "single" },
          ondemand_modules: { active: [] },
        }),
        "utf-8",
      );
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
              ondemand_modules: { active: [] },
            },
          },
        }),
        "utf-8",
      );
      fs.writeFileSync(path.join(taskDir, "prd.md"), "# Lite\n\n- [ ] AC one\n");
      const ran = runHook("session-start.py", tmpDir, {
        CSTL_TEST_SELECTED_TASK: ".cstl/tasks/lite-exec",
      });
      expect(ran.status, ran.stderr).toBe(0);
      const context = hookContext(ran.stdout);
      const meta = packMeta(context);
      const ids = meta.layer2ModuleIds ?? [];
      expect(ids).toContain("execute-agent");
      expect(ids).not.toContain("parent-child");
      expect(ids).not.toContain("vcs-integration");
      expect(ids).not.toContain("personal-memory");
      expect(ids).not.toContain("retention-storage");
      expect(ids).not.toContain("retrieval-extended");
      expect(ids).not.toContain("intake-basic");
      expect(ids.length).toBeLessThan(20);
      expect(context).toContain("# Lite");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("session-start compiler failure no-ops with exit 0", () => {
    const tmpDir = makeFixtureProject({ sessionPack: false });
    try {
      fs.rmSync(path.join(tmpDir, ".cstl", "scripts", "common", "session_pack.py"), {
        force: true,
      });
      const ran = runHook("session-start.py", tmpDir);
      expect(ran.status, ran.stderr).toBe(0);
      const context = hookContext(ran.stdout);
      expect(context).toContain("<first-reply-notice>");
      expect(context).not.toContain("UNIQUE_PHASE_INDEX_SENTINEL");
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
