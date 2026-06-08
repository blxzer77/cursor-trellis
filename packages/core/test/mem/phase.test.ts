/**
 * Tests for brainstorm-window phase slicing.
 *
 * brainstorm window = [task.py create, task.py start)
 *
 * Boundary signals are recovered from raw Claude JSONL `tool_use` blocks, so
 * `collectClaudeTurnsAndEvents` does its own pass producing both cleaned turns
 * and `task.py` event metadata.
 *
 * Migrated from the CLI `mem-phase-slice` suite.
 */

import { describe, it, expect, afterAll, afterEach, vi } from "vitest";
import * as nodeFs from "node:fs";
import * as nodePath from "node:path";

const { fakeHome } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const f = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const o = require("node:os") as typeof import("node:os");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require("node:path") as typeof import("node:path");
  const fakeHome = f.mkdtempSync(p.join(o.tmpdir(), "trellis-mem-phase-"));
  return { fakeHome };
});

vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return { ...actual, homedir: () => fakeHome };
});

const { parseTaskPyCommand, parseTaskPyCommandsAll, buildBrainstormWindows } =
  await import("../../src/mem/phase.js");
const { collectClaudeTurnsAndEvents } =
  await import("../../src/mem/adapters/claude.js");
const { collectCodexTurnsAndEvents, commandFromCodexArguments } =
  await import("../../src/mem/adapters/codex.js");
import type { MemSessionInfo, TaskPyEvent } from "../../src/mem/types.js";

afterAll(() => {
  nodeFs.rmSync(fakeHome, { recursive: true, force: true });
});

// =============================================================================
// parseTaskPyCommand — invoker / path-separator variants + false-positive guard
// =============================================================================

describe("parseTaskPyCommand", () => {
  it("returns null for empty / non-string input", () => {
    expect(parseTaskPyCommand("")).toBeNull();
    expect(parseTaskPyCommand("ls")).toBeNull();
    // @ts-expect-error testing runtime guard
    expect(parseTaskPyCommand(undefined)).toBeNull();
  });

  it('matches `python ./.trellis/scripts/task.py create "foo"`', () => {
    const r = parseTaskPyCommand(
      'python ./.trellis/scripts/task.py create "fix bug"',
    );
    expect(r).toEqual({
      action: "create",
      slug: undefined,
      titleArg: "fix bug",
    });
  });

  it("matches `python3 ./.trellis/scripts/task.py create ...`", () => {
    const r = parseTaskPyCommand(
      "python3 ./.trellis/scripts/task.py create my-task",
    );
    expect(r?.action).toBe("create");
  });

  it("matches `py -3 .trellis/scripts/task.py create ...` (Windows launcher)", () => {
    const r = parseTaskPyCommand("py -3 .trellis/scripts/task.py create foo");
    expect(r?.action).toBe("create");
  });

  it("matches Windows backslash path (single)", () => {
    const r = parseTaskPyCommand(
      "python3 .trellis\\scripts\\task.py start .trellis\\tasks\\05-08-foo",
    );
    expect(r).toEqual({
      action: "start",
      taskDir: ".trellis\\tasks\\05-08-foo",
    });
  });

  it("matches Windows backslash path (double — JSONL re-escape)", () => {
    const r = parseTaskPyCommand(
      "python3 .trellis\\\\scripts\\\\task.py create my-task",
    );
    expect(r?.action).toBe("create");
  });

  it("matches `task.py start` with no invoker prefix", () => {
    const r = parseTaskPyCommand("task.py start .trellis/tasks/05-08-foo/");
    expect(r).toEqual({
      action: "start",
      taskDir: ".trellis/tasks/05-08-foo/",
    });
  });

  it("matches absolute path", () => {
    const r = parseTaskPyCommand(
      "python3 /Users/me/proj/.trellis/scripts/task.py create new-thing",
    );
    expect(r?.action).toBe("create");
  });

  it("captures --slug FOO flag value", () => {
    const r = parseTaskPyCommand(
      'python3 .trellis/scripts/task.py create "Title" --slug my-slug',
    );
    expect(r).toMatchObject({ action: "create", slug: "my-slug" });
  });

  it("captures --slug=FOO equals form", () => {
    const r = parseTaskPyCommand(
      "python3 .trellis/scripts/task.py create --slug=my-slug",
    );
    expect(r).toMatchObject({ action: "create", slug: "my-slug" });
  });

  it("does NOT match `--slug task.py-create-foo` (false-positive guard)", () => {
    expect(parseTaskPyCommand("ls --slug task.py-create-foo")).toBeNull();
  });

  it("does NOT match arbitrary text containing task.py without verb", () => {
    expect(parseTaskPyCommand("see task.py for details")).toBeNull();
  });

  it("does NOT match `task.py update` (only create/start are signals)", () => {
    expect(
      parseTaskPyCommand("python3 .trellis/scripts/task.py update foo"),
    ).toBeNull();
  });

  it("rejects `task.py-create` (must have whitespace before verb)", () => {
    expect(parseTaskPyCommand("task.py-create foo")).toBeNull();
  });
});

// =============================================================================
// parseTaskPyCommandsAll — dogfood-driven edge cases
// =============================================================================

function ev(
  action: "create" | "start",
  turnIndex: number,
  extra: { slug?: string; taskDir?: string } = {},
): TaskPyEvent {
  return {
    action,
    timestamp: `2026-05-08T00:00:0${turnIndex}Z`,
    turnIndex,
    ...extra,
  };
}

describe("parseTaskPyCommandsAll (dogfood-driven edge cases)", () => {
  it("strips $(...) closing paren from --slug value", () => {
    const all = parseTaskPyCommandsAll(
      'TASK_DIR=$(python3 ./.trellis/scripts/task.py create "fix: tl mem --since drops cross-day sessions" --slug mem-since-cross-day-filter)',
    );
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({
      action: "create",
      slug: "mem-since-cross-day-filter",
    });
  });

  it("captures BOTH task.py invocations in one Bash command", () => {
    const cmd =
      'SMOKE_TASK=$(python3 ./.trellis/scripts/task.py create "smoke" 2>&1); python3 ./.trellis/scripts/task.py start ".trellis/tasks/$SMOKE_TASK" 2>&1 | tail -3';
    const all = parseTaskPyCommandsAll(cmd);
    expect(all).toHaveLength(2);
    expect(all[0]).toMatchObject({ action: "create" });
    expect(all[1]).toMatchObject({ action: "start" });
    if (all[1] && all[1].action === "start") {
      expect(all[1].taskDir).toContain("$SMOKE_TASK");
    }
  });

  it("rejects prose-embedded matches (heredoc / commit-message text)", () => {
    const cmd =
      'git commit -m "Previous text said `.current-task` is a CLI fallback. Current code never writes that file — task.py start exits with hint to set TRELLIS_CONTEXT_ID."';
    expect(parseTaskPyCommandsAll(cmd)).toEqual([]);
  });

  it("rejects empty restRaw (no positional, just trailing whitespace)", () => {
    expect(parseTaskPyCommandsAll("python3 ./scripts/task.py start  ")).toEqual(
      [],
    );
  });

  it("does not match action embedded in flag value (--something=task.py-create-foo)", () => {
    expect(parseTaskPyCommandsAll("foo --bar=task.py-create-baz xyz")).toEqual(
      [],
    );
  });
});

describe("slugFromTaskDir (via buildBrainstormWindows pairing)", () => {
  it("pairs --slug FOO with start .trellis/tasks/MM-DD-FOO via prefix strip", () => {
    const events: TaskPyEvent[] = [
      {
        action: "create",
        timestamp: "2026-05-08T00:00:05Z",
        turnIndex: 5,
        slug: "mem-fix",
      },
      {
        action: "start",
        timestamp: "2026-05-08T00:00:10Z",
        turnIndex: 10,
        taskDir: ".trellis/tasks/05-08-mem-fix",
      },
    ];
    const ws = buildBrainstormWindows(events, 20);
    expect(ws).toHaveLength(1);
    expect(ws[0]).toMatchObject({
      label: "mem-fix",
      startTurn: 5,
      endTurn: 10,
    });
  });
});

// =============================================================================
// buildBrainstormWindows — pairing strategy + fallbacks
// =============================================================================

describe("buildBrainstormWindows", () => {
  it("returns [] when there are no events", () => {
    expect(buildBrainstormWindows([], 10)).toEqual([]);
  });

  it("pairs a single create→start in order", () => {
    const events = [ev("create", 2, { slug: "foo" }), ev("start", 8)];
    expect(buildBrainstormWindows(events, 12)).toEqual([
      { label: "foo", startTurn: 2, endTurn: 8 },
    ]);
  });

  it("pairs multi-task FIFO when slugs are missing", () => {
    const events = [
      ev("create", 1),
      ev("start", 3, { taskDir: ".trellis/tasks/aaa" }),
      ev("create", 5),
      ev("start", 9, { taskDir: ".trellis/tasks/bbb" }),
    ];
    expect(buildBrainstormWindows(events, 12)).toEqual([
      { label: "aaa", startTurn: 1, endTurn: 3 },
      { label: "bbb", startTurn: 5, endTurn: 9 },
    ]);
  });

  it("prefers slug match over FIFO order", () => {
    const events = [
      ev("create", 1, { slug: "aaa" }),
      ev("create", 2, { slug: "bbb" }),
      ev("start", 5, { taskDir: ".trellis/tasks/bbb" }),
      ev("start", 6, { taskDir: ".trellis/tasks/aaa" }),
    ];
    expect(buildBrainstormWindows(events, 10)).toEqual([
      { label: "aaa", startTurn: 1, endTurn: 6 },
      { label: "bbb", startTurn: 2, endTurn: 5 },
    ]);
  });

  it("fallback A: create with no following start → [create, totalTurns)", () => {
    const events = [ev("create", 4, { slug: "interrupted" })];
    expect(buildBrainstormWindows(events, 12)).toEqual([
      { label: "interrupted", startTurn: 4, endTurn: 12 },
    ]);
  });

  it("fallback B: start with no preceding create → [0, start)", () => {
    const events = [ev("start", 7, { taskDir: ".trellis/tasks/earlier" })];
    expect(buildBrainstormWindows(events, 12)).toEqual([
      { label: "earlier", startTurn: 0, endTurn: 7 },
    ]);
  });

  it("skips malformed window where start.turnIndex < create.turnIndex (event order quirk)", () => {
    const events = [
      ev("create", 8, { slug: "weird" }),
      ev("start", 3, { taskDir: ".trellis/tasks/weird" }),
    ];
    expect(buildBrainstormWindows(events, 10)).toEqual([]);
  });

  it("uses window-N label when neither create.slug nor start.taskDir resolve", () => {
    const events = [ev("create", 1), ev("start", 5)];
    expect(buildBrainstormWindows(events, 10)).toEqual([
      { label: "window-1", startTurn: 1, endTurn: 5 },
    ]);
  });
});

// =============================================================================
// collectClaudeTurnsAndEvents — end-to-end raw JSONL → turns + events
// =============================================================================

const CLAUDE_PROJECTS = nodePath.join(fakeHome, ".claude", "projects");

function writeJsonl(file: string, lines: readonly unknown[]): void {
  nodeFs.mkdirSync(nodePath.dirname(file), { recursive: true });
  nodeFs.writeFileSync(
    file,
    lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
  );
}

function rimraf(p: string): void {
  nodeFs.rmSync(p, { recursive: true, force: true });
}

describe("collectClaudeTurnsAndEvents", () => {
  const projectCwd = "/tmp/phase-slice";
  const projectDir = nodePath.join(
    CLAUDE_PROJECTS,
    projectCwd.replace(/[/_]/g, "-"),
  );

  afterEach(() => {
    rimraf(CLAUDE_PROJECTS);
  });

  function buildSession(
    sessionId: string,
    events: readonly Record<string, unknown>[],
  ): MemSessionInfo {
    nodeFs.mkdirSync(projectDir, { recursive: true });
    const file = nodePath.join(projectDir, `${sessionId}.jsonl`);
    writeJsonl(file, events);
    return { platform: "claude", id: sessionId, filePath: file };
  }

  it("captures task.py create + start events with correct turnIndex", () => {
    const s = buildSession("session-a", [
      {
        type: "user",
        timestamp: "2026-05-08T00:00:00Z",
        cwd: projectCwd,
        message: { role: "user", content: "let's brainstorm something" },
      },
      {
        type: "assistant",
        timestamp: "2026-05-08T00:00:01Z",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "OK, what is it?" }],
        },
      },
      {
        type: "user",
        timestamp: "2026-05-08T00:00:02Z",
        message: { role: "user", content: "do task X" },
      },
      {
        type: "assistant",
        timestamp: "2026-05-08T00:00:03Z",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "creating the task now" },
            {
              type: "tool_use",
              name: "Bash",
              input: {
                command:
                  'python3 ./.trellis/scripts/task.py create "task X" --slug task-x',
              },
            },
          ],
        },
      },
      {
        type: "user",
        timestamp: "2026-05-08T00:00:04Z",
        message: { role: "user", content: "go" },
      },
      {
        type: "assistant",
        timestamp: "2026-05-08T00:00:05Z",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "starting the task" },
            {
              type: "tool_use",
              name: "Bash",
              input: {
                command:
                  "python3 ./.trellis/scripts/task.py start .trellis/tasks/task-x",
              },
            },
          ],
        },
      },
      {
        type: "user",
        timestamp: "2026-05-08T00:00:06Z",
        message: { role: "user", content: "implementing now" },
      },
    ]);

    const { turns, events } = collectClaudeTurnsAndEvents(s);

    expect(turns.length).toBe(7);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      action: "create",
      slug: "task-x",
      turnIndex: 3,
    });
    expect(events[1]).toMatchObject({
      action: "start",
      taskDir: ".trellis/tasks/task-x",
      turnIndex: 5,
    });

    const windows = buildBrainstormWindows(events, turns.length);
    expect(windows).toEqual([{ label: "task-x", startTurn: 3, endTurn: 5 }]);
    const brainstorm = turns.slice(3, 5);
    expect(brainstorm.map((t) => t.role)).toEqual(["assistant", "user"]);
    expect(brainstorm[1]?.text).toBe("go");
  });

  it("ignores non-task.py Bash tool_use events", () => {
    const s = buildSession("session-b", [
      {
        type: "user",
        timestamp: "2026-05-08T00:00:00Z",
        cwd: projectCwd,
        message: { role: "user", content: "hi" },
      },
      {
        type: "assistant",
        timestamp: "2026-05-08T00:00:01Z",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "running ls" },
            { type: "tool_use", name: "Bash", input: { command: "ls -la" } },
          ],
        },
      },
    ]);
    expect(collectClaudeTurnsAndEvents(s).events).toEqual([]);
  });

  it("survives compaction: turns reset, subsequent task.py events still tracked", () => {
    const s = buildSession("session-c", [
      {
        type: "user",
        timestamp: "2026-05-08T00:00:00Z",
        cwd: projectCwd,
        message: { role: "user", content: "early talk" },
      },
      {
        type: "assistant",
        timestamp: "2026-05-08T00:00:01Z",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "early reply" }],
        },
      },
      {
        type: "user",
        timestamp: "2026-05-08T00:00:02Z",
        isCompactSummary: true,
        message: { role: "user", content: "summarized history" },
      },
      {
        type: "user",
        timestamp: "2026-05-08T00:00:03Z",
        message: { role: "user", content: "continuing" },
      },
      {
        type: "assistant",
        timestamp: "2026-05-08T00:00:04Z",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "creating" },
            {
              type: "tool_use",
              name: "Bash",
              input: {
                command:
                  "python3 ./.trellis/scripts/task.py create --slug post-compact",
              },
            },
          ],
        },
      },
    ]);

    const { turns, events } = collectClaudeTurnsAndEvents(s);
    expect(turns.length).toBe(3);
    expect(turns[0]?.text.startsWith("[compact summary]")).toBe(true);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "create",
      slug: "post-compact",
      turnIndex: 2,
    });
  });

  it("compaction discards PRE-compact task.py events (turnIndex no longer valid)", () => {
    const s = buildSession("session-d", [
      {
        type: "user",
        timestamp: "2026-05-08T00:00:00Z",
        cwd: projectCwd,
        message: { role: "user", content: "pre-compact talk" },
      },
      {
        type: "assistant",
        timestamp: "2026-05-08T00:00:01Z",
        message: {
          role: "assistant",
          content: [
            { type: "text", text: "creating ahead of compact" },
            {
              type: "tool_use",
              name: "Bash",
              input: {
                command:
                  "python3 ./.trellis/scripts/task.py create --slug stale",
              },
            },
          ],
        },
      },
      {
        type: "user",
        timestamp: "2026-05-08T00:00:02Z",
        isCompactSummary: true,
        message: { role: "user", content: "summary" },
      },
      {
        type: "user",
        timestamp: "2026-05-08T00:00:03Z",
        message: { role: "user", content: "after compact" },
      },
    ]);

    expect(collectClaudeTurnsAndEvents(s).events).toEqual([]);
  });
});

// =============================================================================
// commandFromCodexArguments — argument shape recovery
// =============================================================================

describe("commandFromCodexArguments", () => {
  it("returns a raw shell string unchanged", () => {
    expect(commandFromCodexArguments("task.py create foo")).toBe(
      "task.py create foo",
    );
  });

  it("extracts `cmd` from a stringified JSON object", () => {
    expect(
      commandFromCodexArguments(JSON.stringify({ cmd: "task.py start bar" })),
    ).toBe("task.py start bar");
  });

  it("extracts `command` from a stringified JSON object", () => {
    expect(
      commandFromCodexArguments(
        JSON.stringify({ command: "task.py create baz" }),
      ),
    ).toBe("task.py create baz");
  });

  it("joins `argv[]` with spaces from a stringified JSON object", () => {
    expect(
      commandFromCodexArguments(
        JSON.stringify({ argv: ["python3", "task.py", "create", "qux"] }),
      ),
    ).toBe("python3 task.py create qux");
  });

  it("extracts `cmd` / `command` / `argv` from a raw object", () => {
    expect(commandFromCodexArguments({ cmd: "a" })).toBe("a");
    expect(commandFromCodexArguments({ command: "b" })).toBe("b");
    expect(commandFromCodexArguments({ argv: ["c", "d"] })).toBe("c d");
  });

  it("returns undefined for unrecognized shapes", () => {
    expect(commandFromCodexArguments(undefined)).toBeUndefined();
    expect(commandFromCodexArguments(42)).toBeUndefined();
    expect(commandFromCodexArguments({ other: "x" })).toBeUndefined();
    expect(commandFromCodexArguments("not json, no task.py")).toBe(
      "not json, no task.py",
    );
    expect(commandFromCodexArguments(JSON.stringify(["a", "b"]))).toBeUndefined();
  });
});

// =============================================================================
// collectCodexTurnsAndEvents — raw rollout JSONL → turns + events
// =============================================================================

const CODEX_SESSIONS = nodePath.join(fakeHome, ".codex", "sessions");

describe("collectCodexTurnsAndEvents", () => {
  const sessionFile = nodePath.join(CODEX_SESSIONS, "rollout-test.jsonl");

  afterEach(() => {
    rimraf(CODEX_SESSIONS);
  });

  function buildSession(events: readonly Record<string, unknown>[]): MemSessionInfo {
    writeJsonl(sessionFile, events);
    return { platform: "codex", id: "codex-test", filePath: sessionFile };
  }

  it("recognizes task.py boundary from `argv[]` joined with spaces", () => {
    const s = buildSession([
      {
        timestamp: "2026-05-08T00:00:00Z",
        payload: { id: "codex-test", cwd: "/tmp/codex" },
      },
      {
        timestamp: "2026-05-08T00:00:01Z",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "brainstorm a task" }],
        },
      },
      {
        timestamp: "2026-05-08T00:00:02Z",
        payload: {
          type: "function_call",
          name: "shell",
          arguments: JSON.stringify({
            argv: [
              "python3",
              ".trellis/scripts/task.py",
              "create",
              "--slug",
              "codex-task",
            ],
          }),
        },
      },
      {
        timestamp: "2026-05-08T00:00:03Z",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "go" }],
        },
      },
      {
        timestamp: "2026-05-08T00:00:04Z",
        payload: {
          type: "function_call",
          name: "exec_command",
          arguments: JSON.stringify({
            argv: [
              "python3",
              ".trellis/scripts/task.py",
              "start",
              ".trellis/tasks/05-08-codex-task",
            ],
          }),
        },
      },
      {
        timestamp: "2026-05-08T00:00:05Z",
        payload: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: "implementing" }],
        },
      },
    ]);

    const { turns, events } = collectCodexTurnsAndEvents(s);
    expect(turns.length).toBe(3);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      action: "create",
      slug: "codex-task",
      turnIndex: 1,
    });
    expect(events[1]).toMatchObject({
      action: "start",
      taskDir: ".trellis/tasks/05-08-codex-task",
      turnIndex: 2,
    });

    const windows = buildBrainstormWindows(events, turns.length);
    expect(windows).toEqual([
      { label: "codex-task", startTurn: 1, endTurn: 2 },
    ]);
  });

  it("recognizes task.py boundary from a raw `argv[]` object (not stringified)", () => {
    const s = buildSession([
      {
        timestamp: "2026-05-08T00:00:00Z",
        payload: { id: "codex-test", cwd: "/tmp/codex" },
      },
      {
        timestamp: "2026-05-08T00:00:01Z",
        payload: {
          type: "function_call",
          name: "shell",
          arguments: {
            argv: ["task.py", "create", "--slug", "raw-obj"],
          },
        },
      },
    ]);
    const { events } = collectCodexTurnsAndEvents(s);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: "create", slug: "raw-obj" });
  });

  it("still recognizes the raw-string `cmd` form", () => {
    const s = buildSession([
      {
        timestamp: "2026-05-08T00:00:00Z",
        payload: { id: "codex-test", cwd: "/tmp/codex" },
      },
      {
        timestamp: "2026-05-08T00:00:01Z",
        payload: {
          type: "function_call",
          name: "exec_command",
          arguments: JSON.stringify({
            cmd: "python3 .trellis/scripts/task.py create --slug str-cmd",
          }),
        },
      },
    ]);
    const { events } = collectCodexTurnsAndEvents(s);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ action: "create", slug: "str-cmd" });
  });

  it("ignores non-task.py function calls", () => {
    const s = buildSession([
      {
        timestamp: "2026-05-08T00:00:00Z",
        payload: { id: "codex-test", cwd: "/tmp/codex" },
      },
      {
        timestamp: "2026-05-08T00:00:01Z",
        payload: {
          type: "function_call",
          name: "shell",
          arguments: JSON.stringify({ argv: ["ls", "-la"] }),
        },
      },
    ]);
    expect(collectCodexTurnsAndEvents(s).events).toEqual([]);
  });
});
