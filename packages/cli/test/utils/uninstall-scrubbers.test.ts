/**
 * Unit tests for uninstall-scrubbers.
 *
 * Each scrubber gets coverage for:
 *  - Strips trellis content
 *  - Preserves user-added content
 *  - Reports `fullyEmpty: true` when nothing meaningful remains
 */

import { describe, it, expect } from "vitest";
import { scrubHooksJson } from "../../src/utils/uninstall-scrubbers.js";

const CLAUDE_DELETE_PATHS = [
  ".claude/hooks/session-start.py",
  ".claude/hooks/inject-subagent-context.py",
  ".claude/hooks/inject-workflow-state.py",
];

const CURSOR_DELETE_PATHS = [
  ".cursor/hooks/inject-subagent-context.py",
  ".cursor/hooks/session-start.py",
  ".cursor/hooks/inject-workflow-state.py",
  ".cursor/hooks/inject-shell-session-context.py",
];

describe("scrubHooksJson — nested schema", () => {
  it("strips trellis hook entries from a Claude-style file", () => {
    const input = {
      env: { CLAUDE_BASH_MAINTAIN_PROJECT_WORKING_DIR: "1" },
      hooks: {
        SessionStart: [
          {
            matcher: "startup",
            hooks: [
              {
                type: "command",
                command: "python3 .claude/hooks/session-start.py",
                timeout: 10,
              },
            ],
          },
        ],
        UserPromptSubmit: [
          {
            hooks: [
              {
                type: "command",
                command: "python3 .claude/hooks/inject-workflow-state.py",
                timeout: 5,
              },
            ],
          },
        ],
      },
      enabledPlugins: {},
    };

    const { content, fullyEmpty } = scrubHooksJson(
      JSON.stringify(input, null, 2),
      CLAUDE_DELETE_PATHS,
      "nested",
    );
    const parsed = JSON.parse(content);
    expect(parsed.hooks).toBeUndefined();
    expect(parsed.env).toEqual(input.env);
    expect(parsed.enabledPlugins).toEqual({});
    expect(fullyEmpty).toBe(false);
  });

  it("preserves user-added hook entry inside the same matcher block", () => {
    const input = {
      hooks: {
        SessionStart: [
          {
            matcher: "startup",
            hooks: [
              {
                type: "command",
                command: "python3 .claude/hooks/session-start.py",
                timeout: 10,
              },
              {
                type: "command",
                command: "python3 .claude/hooks/my-custom-hook.py",
                timeout: 5,
              },
            ],
          },
        ],
      },
    };

    const { content, fullyEmpty } = scrubHooksJson(
      JSON.stringify(input, null, 2),
      CLAUDE_DELETE_PATHS,
      "nested",
    );
    const parsed = JSON.parse(content);
    expect(parsed.hooks.SessionStart).toHaveLength(1);
    expect(parsed.hooks.SessionStart[0].hooks).toHaveLength(1);
    expect(parsed.hooks.SessionStart[0].hooks[0].command).toBe(
      "python3 .claude/hooks/my-custom-hook.py",
    );
    expect(fullyEmpty).toBe(false);
  });

  it("reports fullyEmpty when only trellis hooks existed", () => {
    const input = {
      hooks: {
        SessionStart: [
          {
            matcher: "startup",
            hooks: [
              {
                type: "command",
                command: "python3 .claude/hooks/session-start.py",
                timeout: 10,
              },
            ],
          },
        ],
      },
    };

    const { content, fullyEmpty } = scrubHooksJson(
      JSON.stringify(input, null, 2),
      CLAUDE_DELETE_PATHS,
      "nested",
    );
    expect(fullyEmpty).toBe(true);
    // Content should still be valid JSON (an empty object).
    expect(JSON.parse(content)).toEqual({});
  });

  it("does NOT strip hook entries that merely mention a deleted path inside a string argument", () => {
    // Regression: substring-only matching would incorrectly delete a user
    // hook whose command happens to embed a manifest path in an echo/log arg.
    const input = {
      hooks: {
        SessionStart: [
          {
            matcher: "startup",
            hooks: [
              {
                type: "command",
                command:
                  'echo "see .claude/hooks/session-start.py for inspiration" && python3 my-hook.py',
              },
            ],
          },
        ],
      },
    };
    const { content, fullyEmpty } = scrubHooksJson(
      JSON.stringify(input, null, 2),
      CLAUDE_DELETE_PATHS,
      "nested",
    );
    const parsed = JSON.parse(content);
    // Token-based matcher should preserve the user's hook intact.
    expect(parsed.hooks.SessionStart).toHaveLength(1);
    expect(parsed.hooks.SessionStart[0].hooks).toHaveLength(1);
    expect(fullyEmpty).toBe(false);
  });

  it("collapses empty matcher blocks (whole block dropped when its hooks list goes to 0)", () => {
    const input = {
      hooks: {
        SessionStart: [
          {
            matcher: "startup",
            hooks: [
              {
                type: "command",
                command: "python3 .claude/hooks/session-start.py",
              },
            ],
          },
          {
            matcher: "user",
            hooks: [
              { type: "command", command: "python3 .claude/hooks/user.py" },
            ],
          },
        ],
      },
    };
    const { content } = scrubHooksJson(
      JSON.stringify(input, null, 2),
      CLAUDE_DELETE_PATHS,
      "nested",
    );
    const parsed = JSON.parse(content);
    expect(parsed.hooks.SessionStart).toHaveLength(1);
    expect(parsed.hooks.SessionStart[0].matcher).toBe("user");
  });
});

describe("scrubHooksJson — flat schema", () => {
  it("strips trellis hook entries from a Cursor-style file", () => {
    const input = {
      version: 1,
      hooks: {
        preToolUse: [
          {
            command: "python3 .cursor/hooks/inject-subagent-context.py",
            matcher: "Task|Subagent",
            timeout: 30,
          },
        ],
        sessionStart: [
          { command: "python3 .cursor/hooks/session-start.py", timeout: 10 },
        ],
      },
    };

    const { content, fullyEmpty } = scrubHooksJson(
      JSON.stringify(input, null, 2),
      CURSOR_DELETE_PATHS,
      "flat",
    );
    const parsed = JSON.parse(content);
    expect(parsed.hooks).toBeUndefined();
    expect(parsed.version).toBe(1);
    expect(fullyEmpty).toBe(false);
  });

  it("preserves user-added flat hook entries", () => {
    const input = {
      hooks: {
        preToolUse: [
          { command: "python3 .cursor/hooks/inject-subagent-context.py" },
          { command: "python3 .cursor/hooks/my-rule.py" },
        ],
      },
    };
    const { content, fullyEmpty } = scrubHooksJson(
      JSON.stringify(input, null, 2),
      CURSOR_DELETE_PATHS,
      "flat",
    );
    const parsed = JSON.parse(content);
    expect(parsed.hooks.preToolUse).toHaveLength(1);
    expect(parsed.hooks.preToolUse[0].command).toBe(
      "python3 .cursor/hooks/my-rule.py",
    );
    expect(fullyEmpty).toBe(false);
  });

  it("matches Copilot bash/powershell command fields", () => {
    const copilotPaths = [
      ".github/copilot/hooks/session-start.py",
      ".github/copilot/hooks/inject-workflow-state.py",
    ];
    const input = {
      hooks: {
        SessionStart: [
          {
            type: "command",
            command: "python3 .github/copilot/hooks/session-start.py",
            timeout: 10,
          },
        ],
        userPromptSubmitted: [
          {
            type: "command",
            bash: "python3 .github/copilot/hooks/inject-workflow-state.py",
            powershell: "python3 .github/copilot/hooks/inject-workflow-state.py",
            timeoutSec: 5,
          },
        ],
      },
    };
    const { content, fullyEmpty } = scrubHooksJson(
      JSON.stringify(input, null, 2),
      copilotPaths,
      "flat",
    );
    expect(fullyEmpty).toBe(true);
    expect(JSON.parse(content)).toEqual({});
  });

  it("reports fullyEmpty when only trellis hooks existed", () => {
    const input = {
      hooks: {
        sessionStart: [
          { command: "python3 .cursor/hooks/session-start.py", timeout: 10 },
        ],
      },
    };
    const { fullyEmpty } = scrubHooksJson(
      JSON.stringify(input, null, 2),
      CURSOR_DELETE_PATHS,
      "flat",
    );
    expect(fullyEmpty).toBe(true);
  });
});
