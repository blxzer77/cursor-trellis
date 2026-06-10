import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  contextCollector,
  isTrellisSubagent,
  TrellisContext,
} from "../../src/templates/opencode/lib/trellis-context.js";
import {
  buildSessionContext,
  hasInjectedTrellisContext,
} from "../../src/templates/opencode/lib/session-utils.js";
import injectSubagentContextPlugin from "../../src/templates/opencode/plugins/inject-subagent-context.js";
import sessionStartPlugin from "../../src/templates/opencode/plugins/session-start.js";
import injectWorkflowStatePlugin from "../../src/templates/opencode/plugins/inject-workflow-state.js";

interface TestContextCollector {
  processed: Set<string>;
  markProcessed(directory: string, sessionID: string): void;
  isProcessed(directory: string, sessionID: string): boolean;
  clear(sessionID: string): void;
}

interface OpenCodeInjectHooks {
  "tool.execute.before": (
    input: unknown,
    output: { args: { command: string } },
  ) => Promise<void>;
}

async function createOpenCodeInjectHooks(
  platform: NodeJS.Platform = "linux",
  env: NodeJS.ProcessEnv = {},
): Promise<OpenCodeInjectHooks> {
  return (await injectSubagentContextPlugin({
    directory: "/tmp/trellis-opencode-test",
    platform,
    env,
  })) as OpenCodeInjectHooks;
}

describe("opencode session context dedupe", () => {
  let collector: TestContextCollector;

  beforeEach((): void => {
    collector = contextCollector as TestContextCollector;
  });

  afterEach((): void => {
    collector.clear("session-a");
    collector.clear("session-b");
    collector.processed.clear();
  });

  it("tracks processed sessions in memory for the active process", () => {
    expect(collector.isProcessed("session-a")).toBe(false);

    collector.markProcessed("session-a");
    expect(collector.isProcessed("session-a")).toBe(true);

    collector.clear("session-a");

    expect(collector.isProcessed("session-a")).toBe(false);
  });

  it("does not treat a different session id as already processed", () => {
    collector.markProcessed("session-a");

    expect(collector.isProcessed("session-b")).toBe(false);
  });
});

describe("opencode session-start history detection", () => {
  it("includes the one-shot first-reply notice in injected context", () => {
    const context = buildSessionContext({
      directory: "/tmp/trellis-opencode-test",
      getActiveTask: () => ({ taskPath: null, source: "none", stale: false }),
      getContextKey: () => null,
      getCurrentTask: () => null,
      readFile: () => "",
      readProjectFile: () => "",
      resolveTaskDir: () => null,
      runScript: () => "",
    });

    expect(context).toContain("<first-reply-notice>");
    expect(context).toContain("First visible reply");
    expect(context).toContain("Trellis SessionStart context is loaded");
    expect(context).toContain("This notice is one-shot");
    expect(context.indexOf("<first-reply-notice>")).toBeLessThan(
      context.indexOf("<guidelines>"),
    );
  });

  it("detects persisted Trellis context from metadata", () => {
    const messages = [
      {
        info: { role: "user" },
        parts: [
          {
            type: "text",
            text: "hello",
            metadata: {
              trellis: {
                sessionStart: true,
              },
            },
          },
        ],
      },
    ];

    expect(hasInjectedTrellisContext(messages)).toBe(true);
  });

  it("ignores unrelated user messages", () => {
    const messages = [
      {
        info: { role: "user" },
        parts: [
          {
            type: "text",
            text: "normal prompt",
          },
        ],
      },
    ];

    expect(hasInjectedTrellisContext(messages)).toBe(false);
  });
});

describe("opencode bash session context", () => {
  it("injects TRELLIS_CONTEXT_ID into Bash commands from plugin sessionID", async () => {
    const hooks = await createOpenCodeInjectHooks();
    const output = {
      args: {
        command: "python3 ./.trellis/scripts/task.py select .trellis/tasks/demo",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "oc-a" },
      output,
    );

    expect(output.args.command).toBe(
      "export TRELLIS_CONTEXT_ID='opencode_oc-a'; python3 ./.trellis/scripts/task.py select .trellis/tasks/demo",
    );
  });

  it("uses PowerShell environment syntax on Windows", async () => {
    const hooks = await createOpenCodeInjectHooks("win32");
    const output = {
      args: {
        command: "python ./.trellis/scripts/task.py select .trellis/tasks/demo",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "oc-a" },
      output,
    );

    expect(output.args.command).toBe(
      "$env:TRELLIS_CONTEXT_ID = 'opencode_oc-a'; python ./.trellis/scripts/task.py select .trellis/tasks/demo",
    );
  });

  it("uses POSIX environment syntax on Windows Git Bash", async () => {
    const hooks = await createOpenCodeInjectHooks("win32", {
      MSYSTEM: "MINGW64",
    });
    const output = {
      args: {
        command: "git diff --name-only",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "oc-a" },
      output,
    );

    expect(output.args.command).toBe(
      "export TRELLIS_CONTEXT_ID='opencode_oc-a'; git diff --name-only",
    );
  });

  it("uses POSIX environment syntax when Windows OSTYPE indicates MSYS", async () => {
    const hooks = await createOpenCodeInjectHooks("win32", {
      OSTYPE: "msys",
    });
    const output = {
      args: {
        command: "git status --short",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "oc-a" },
      output,
    );

    expect(output.args.command).toBe(
      "export TRELLIS_CONTEXT_ID='opencode_oc-a'; git status --short",
    );
  });

  it("uses POSIX environment syntax when Windows MINGW_PREFIX is set", async () => {
    const hooks = await createOpenCodeInjectHooks("win32", {
      MINGW_PREFIX: "/mingw64",
    });
    const output = {
      args: {
        command: "git log --oneline -1",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "oc-a" },
      output,
    );

    expect(output.args.command).toBe(
      "export TRELLIS_CONTEXT_ID='opencode_oc-a'; git log --oneline -1",
    );
  });

  it("uses POSIX environment syntax when Windows SHELL is bash", async () => {
    const hooks = await createOpenCodeInjectHooks("win32", {
      SHELL: "/usr/bin/bash",
    });
    const output = {
      args: {
        command: "git branch --show-current",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "oc-a" },
      output,
    );

    expect(output.args.command).toBe(
      "export TRELLIS_CONTEXT_ID='opencode_oc-a'; git branch --show-current",
    );
  });

  it("uses POSIX environment syntax when OpenCode Git Bash path is configured", async () => {
    const hooks = await createOpenCodeInjectHooks("win32", {
      OPENCODE_GIT_BASH_PATH: "C:\\Program Files\\Git\\bin\\bash.exe",
    });
    const output = {
      args: {
        command: "git rev-parse --show-toplevel",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "oc-a" },
      output,
    );

    expect(output.args.command).toBe(
      "export TRELLIS_CONTEXT_ID='opencode_oc-a'; git rev-parse --show-toplevel",
    );
  });

  it("does not duplicate an explicit TRELLIS_CONTEXT_ID assignment", async () => {
    const hooks = await createOpenCodeInjectHooks();
    const output = {
      args: {
        command:
          "TRELLIS_CONTEXT_ID=manual python3 ./.trellis/scripts/task.py selected",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "oc-a" },
      output,
    );

    expect(output.args.command).toBe(
      "TRELLIS_CONTEXT_ID=manual python3 ./.trellis/scripts/task.py selected",
    );
  });

  it("does not duplicate an explicit exported TRELLIS_CONTEXT_ID", async () => {
    const hooks = await createOpenCodeInjectHooks();
    const output = {
      args: {
        command:
          "export TRELLIS_CONTEXT_ID=manual; python3 ./.trellis/scripts/task.py selected",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "oc-a" },
      output,
    );

    expect(output.args.command).toBe(
      "export TRELLIS_CONTEXT_ID=manual; python3 ./.trellis/scripts/task.py selected",
    );
  });

  it("does not duplicate an explicit env TRELLIS_CONTEXT_ID assignment", async () => {
    const hooks = await createOpenCodeInjectHooks();
    const output = {
      args: {
        command:
          "env FOO=bar TRELLIS_CONTEXT_ID=manual python3 ./.trellis/scripts/task.py selected",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "oc-a" },
      output,
    );

    expect(output.args.command).toBe(
      "env FOO=bar TRELLIS_CONTEXT_ID=manual python3 ./.trellis/scripts/task.py selected",
    );
  });

  it("does not duplicate an explicit PowerShell TRELLIS_CONTEXT_ID assignment", async () => {
    const hooks = await createOpenCodeInjectHooks("win32");
    const output = {
      args: {
        command:
          "$env:TRELLIS_CONTEXT_ID = 'manual'; python ./.trellis/scripts/task.py selected",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "oc-a" },
      output,
    );

    expect(output.args.command).toBe(
      "$env:TRELLIS_CONTEXT_ID = 'manual'; python ./.trellis/scripts/task.py selected",
    );
  });

  it("does not treat a grep pattern as an explicit TRELLIS_CONTEXT_ID assignment", async () => {
    const hooks = await createOpenCodeInjectHooks();
    const output = {
      args: {
        command: "env | sort | grep '^TRELLIS_CONTEXT_ID='",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "bash", sessionID: "oc-a" },
      output,
    );

    expect(output.args.command).toBe(
      "export TRELLIS_CONTEXT_ID='opencode_oc-a'; env | sort | grep '^TRELLIS_CONTEXT_ID='",
    );
  });
});

// ---------------------------------------------------------------------------
// Issue #264 — sub-agent context injection + chat.message skip
// ---------------------------------------------------------------------------

interface TaskToolOutput {
  args: {
    subagent_type?: string;
    prompt?: string;
  };
}

interface TaskToolHooks {
  "tool.execute.before": (
    input: { tool: string; sessionID?: string; agent?: string },
    output: TaskToolOutput,
  ) => Promise<void>;
}

interface ChatMessagePart {
  type: string;
  text?: string;
  metadata?: Record<string, unknown>;
}

interface ChatMessageHooks {
  "chat.message": (
    input: { sessionID: string; agent?: string },
    output: { parts: ChatMessagePart[] },
  ) => Promise<void>;
}

function setupTrellisProject(): string {
  const dir = mkdtempSync(join(tmpdir(), "trellis-opencode-264-"));
  const taskDir = join(dir, ".trellis", "tasks", "demo-task");
  mkdirSync(taskDir, { recursive: true });
  mkdirSync(join(dir, ".trellis", ".runtime", "sessions"), { recursive: true });
  writeFileSync(
    join(taskDir, "task.json"),
    JSON.stringify(
      {
        title: "Demo task",
        status: "in_progress",
        assignee: "test-dev",
      },
      null,
      2,
    ),
  );
  writeFileSync(join(taskDir, "prd.md"), "# Demo PRD\n\nGoal: verify injection.");
  writeFileSync(join(taskDir, "implement.jsonl"), "");
  writeFileSync(join(taskDir, "check.jsonl"), "");
  writeFileSync(
    join(dir, ".trellis", "workflow.md"),
    [
      "# Workflow",
      "",
      "[workflow-state:in_progress]",
      "Selected task: <task path>. Dispatch trellis-implement or trellis-check.",
      "[/workflow-state:in_progress]",
      "",
    ].join("\n"),
  );
  return dir;
}

function writeSessionFile(dir: string, key: string, taskRef: string): void {
  const file = join(dir, ".trellis", ".runtime", "sessions", `${key}.json`);
  writeFileSync(file, JSON.stringify({ selected_task: taskRef }, null, 2));
}

describe("opencode subagent helper", () => {
  it("isTrellisSubagent matches the three trellis sub-agent names", () => {
    expect(isTrellisSubagent({ agent: "trellis-implement" })).toBe(true);
    expect(isTrellisSubagent({ agent: "trellis-check" })).toBe(true);
    expect(isTrellisSubagent({ agent: "trellis-research" })).toBe(true);
  });

  it("isTrellisSubagent rejects unrelated agents", () => {
    expect(isTrellisSubagent({ agent: "build" })).toBe(false);
    expect(isTrellisSubagent({ agent: "trellis-implement-extra" })).toBe(false);
    expect(isTrellisSubagent({ agent: undefined })).toBe(false);
    expect(isTrellisSubagent({})).toBe(false);
    expect(isTrellisSubagent(null)).toBe(false);
  });
});

describe("opencode TrellisContext selected-task resolution", () => {
  let dir: string;

  beforeEach(() => {
    dir = setupTrellisProject();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not infer a selected task from another session file", () => {
    writeSessionFile(dir, "opencode_sole", ".trellis/tasks/demo-task");
    const ctx = new TrellisContext(dir);
    const active = ctx.getActiveTask({ sessionID: "missing-key" });

    expect(active.taskPath).toBeNull();
    expect(active.source).toBe("none");
    expect(active.stale).toBe(false);
  });

  it("refuses to guess when two or more session files exist", () => {
    writeSessionFile(dir, "opencode_a", ".trellis/tasks/demo-task");
    writeSessionFile(dir, "opencode_b", ".trellis/tasks/demo-task");
    const ctx = new TrellisContext(dir);
    const active = ctx.getActiveTask({ sessionID: "missing-key" });

    expect(active.taskPath).toBeNull();
    expect(active.source).toBe("none");
  });

  it("returns no task when zero session files exist (Python parity)", () => {
    // sessions/ exists from setupTrellisProject but contains no files
    const ctx = new TrellisContext(dir);
    const active = ctx.getActiveTask({ sessionID: "missing-key" });

    expect(active.taskPath).toBeNull();
    expect(active.source).toBe("none");
  });

  it("uses an exact context-key match", () => {
    writeSessionFile(dir, "opencode_exact", ".trellis/tasks/demo-task");
    writeSessionFile(dir, "opencode_other", ".trellis/tasks/demo-task");
    const ctx = new TrellisContext(dir);
    const active = ctx.getActiveTask({ sessionID: "exact" });

    expect(active.taskPath).toBe(".trellis/tasks/demo-task");
    expect(active.source).toBe("session:opencode_exact");
    expect(active.stale).toBe(false);
  });
});

describe("opencode SessionStart Task Dashboard", () => {
  let dir: string;

  beforeEach(() => {
    dir = setupTrellisProject();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("renders dashboard routing without inferring a task from another session", () => {
    writeSessionFile(dir, "opencode_other", ".trellis/tasks/demo-task");
    const ctx = new TrellisContext(dir);
    const context = buildSessionContext(ctx, { sessionID: "fresh-session" });

    expect(context).toContain("<current-state>");
    expect(context).toContain("Trellis framework: active");
    expect(context).toContain("<task-dashboard>");
    expect(context).toContain("Task Dashboard");
    expect(context).toContain("Selected task: none");
    expect(context).toContain(".trellis/tasks/demo-task (in_progress)");
    expect(context).toContain("Suggested actions:");
    expect(context).toContain("task.py select <task>");
  });

  it("renders the exact live-session selected_task in the dashboard", () => {
    writeSessionFile(dir, "opencode_dash", ".trellis/tasks/demo-task");
    const ctx = new TrellisContext(dir);
    const context = buildSessionContext(ctx, { sessionID: "dash" });

    expect(context).toContain(
      "Selected task: .trellis/tasks/demo-task; status=in_progress.",
    );
    expect(context).toContain(
      "Selected task: .trellis/tasks/demo-task (session:opencode_dash)",
    );
  });
});

describe("opencode inject-subagent-context (issue #264)", () => {
  let dir: string;
  let hooks: TaskToolHooks;

  beforeEach(async () => {
    dir = setupTrellisProject();
    hooks = (await injectSubagentContextPlugin({
      directory: dir,
      platform: "linux",
      env: {},
    })) as TaskToolHooks;
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("mutates implement prompt using exact-session selected_task", async () => {
    writeSessionFile(dir, "opencode_stranger", ".trellis/tasks/demo-task");
    const output: TaskToolOutput = {
      args: {
        subagent_type: "trellis-implement",
        prompt: "do the implementation",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "task", sessionID: "stranger" },
      output,
    );

    expect(output.args.prompt).toContain("<!-- trellis-hook-injected -->");
    expect(output.args.prompt).toContain("# Implement Agent Task");
    expect(output.args.prompt).toContain("Demo PRD");
    expect(output.args.prompt).toContain("do the implementation");
    // Marker must be at the top so generated agent definitions can detect
    // successful injection via a prefix check.
    expect(output.args.prompt.startsWith("<!-- trellis-hook-injected -->")).toBe(
      true,
    );
  });

  it("inlines JSONL-referenced spec content into the implement prompt", async () => {
    // Cover AC #1: "JSONL-referenced context" — the seed-only jsonl path
    // is exercised above; this one verifies a curated entry is inlined.
    const specPath = join(dir, ".trellis", "spec", "demo.md");
    mkdirSync(join(dir, ".trellis", "spec"), { recursive: true });
    writeFileSync(specPath, "# Demo Spec\n\nUNIQUE_SPEC_MARKER_42");
    writeFileSync(
      join(dir, ".trellis", "tasks", "demo-task", "implement.jsonl"),
      JSON.stringify({ file: ".trellis/spec/demo.md", reason: "test" }) + "\n",
    );
    writeSessionFile(dir, "opencode_stranger", ".trellis/tasks/demo-task");

    const output: TaskToolOutput = {
      args: {
        subagent_type: "trellis-implement",
        prompt: "do the implementation",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "task", sessionID: "stranger" },
      output,
    );

    expect(output.args.prompt).toContain("<!-- trellis-hook-injected -->");
    expect(output.args.prompt).toContain("=== .trellis/spec/demo.md ===");
    expect(output.args.prompt).toContain("UNIQUE_SPEC_MARKER_42");
    expect(output.args.prompt).toContain("Demo PRD");
  });

  it("mutates check prompt using Selected task hint when runtime resolution fails", async () => {
    // No session file: hint is the only resolver.
    const output: TaskToolOutput = {
      args: {
        subagent_type: "trellis-check",
        prompt: "Selected task: .trellis/tasks/demo-task\n\nplease check",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "task", sessionID: "stranger" },
      output,
    );

    expect(output.args.prompt).toContain("<!-- trellis-hook-injected -->");
    expect(output.args.prompt).toContain("# Check Agent Task");
    expect(output.args.prompt).toContain("Demo PRD");
  });

  it("uses Selected task hint when exact-session selected_task is absent", async () => {
    // Session file points at demo-task but does not match the input sessionID.
    // The prompt hint points at a different task path and should be used.
    writeSessionFile(dir, "opencode_sole", ".trellis/tasks/another-task");
    const hintTask = join(dir, ".trellis", "tasks", "hint-task");
    mkdirSync(hintTask, { recursive: true });
    writeFileSync(join(hintTask, "prd.md"), "# Hint PRD\n\nfrom hint");
    writeFileSync(join(hintTask, "implement.jsonl"), "");

    const output: TaskToolOutput = {
      args: {
        subagent_type: "trellis-implement",
        prompt: "Selected task: .trellis/tasks/hint-task\n\ngo",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "task", sessionID: "stranger" },
      output,
    );

    expect(output.args.prompt).toContain("Hint PRD");
    expect(output.args.prompt).not.toContain("Demo PRD");
  });

  it("emits the trellis-hook-injected marker for research agent too", async () => {
    const output: TaskToolOutput = {
      args: {
        subagent_type: "trellis-research",
        prompt: "investigate something",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "task", sessionID: "stranger" },
      output,
    );

    expect(output.args.prompt).toContain("<!-- trellis-hook-injected -->");
    expect(output.args.prompt).toContain("# Research Agent Task");
  });

  it("skips when no task can be resolved through any path", async () => {
    const output: TaskToolOutput = {
      args: {
        subagent_type: "trellis-implement",
        prompt: "implement without context",
      },
    };

    await hooks["tool.execute.before"](
      { tool: "task", sessionID: "stranger" },
      output,
    );

    // Prompt is left untouched when implement/check can't find a task
    expect(output.args.prompt).toBe("implement without context");
  });
});

describe("opencode chat.message subagent skip (issue #264)", () => {
  let dir: string;

  beforeEach(() => {
    dir = setupTrellisProject();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    contextCollector.clear("subagent-session");
    contextCollector.clear("main-session");
  });

  it("session-start.js early-returns when input.agent is a trellis sub-agent", async () => {
    const hooks = (await sessionStartPlugin({
      directory: dir,
      client: undefined,
    })) as ChatMessageHooks;
    const parts: ChatMessagePart[] = [{ type: "text", text: "original" }];

    await hooks["chat.message"](
      { sessionID: "subagent-session", agent: "trellis-implement" },
      { parts },
    );

    expect(parts).toHaveLength(1);
    expect(parts[0].text).toBe("original");
    expect(parts[0].metadata).toBeUndefined();
  });

  it("session-start.js skips trellis-check and trellis-research", async () => {
    const hooks = (await sessionStartPlugin({
      directory: dir,
      client: undefined,
    })) as ChatMessageHooks;

    for (const agent of ["trellis-check", "trellis-research"]) {
      const parts: ChatMessagePart[] = [{ type: "text", text: "untouched" }];
      await hooks["chat.message"](
        { sessionID: "subagent-session", agent },
        { parts },
      );
      expect(parts[0].text).toBe("untouched");
    }
  });

  it("inject-workflow-state.js early-returns when input.agent is a trellis sub-agent", async () => {
    const hooks = (await injectWorkflowStatePlugin({
      directory: dir,
    })) as ChatMessageHooks;
    const parts: ChatMessagePart[] = [{ type: "text", text: "original" }];

    await hooks["chat.message"](
      { sessionID: "subagent-session", agent: "trellis-implement" },
      { parts },
    );

    expect(parts).toHaveLength(1);
    expect(parts[0].text).toBe("original");
  });

  it("inject-workflow-state.js still injects breadcrumb for main-session turns", async () => {
    const hooks = (await injectWorkflowStatePlugin({
      directory: dir,
    })) as ChatMessageHooks;
    const parts: ChatMessagePart[] = [{ type: "text", text: "user prompt" }];

    await hooks["chat.message"](
      { sessionID: "main-session", agent: "build" },
      { parts },
    );

    expect(parts[0].text).toContain("<workflow-state>");
    expect(parts[0].text).toContain("user prompt");
  });
});
