/**
 * Regression guard for default hook timeouts (GitHub issue #267).
 *
 * Windows Python cold start + session-start.py + nested subprocess calls
 * routinely exceed 10s, causing silent SessionStart drops. Cursor-only fork:
 * asserts timeouts on `.cursor/hooks.json` template.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const TEMPLATES_ROOT = join(
  dirname(__filename),
  "..",
  "..",
  "src",
  "templates",
);

const CURSOR_HOOK_CONFIG = {
  platform: "cursor",
  path: "cursor/hooks.json",
  schema: "flat" as const,
  sessionStartEvent: "sessionStart",
  sessionStartTimeoutField: "timeout",
  userPromptEvent: "beforeSubmitPrompt",
  userPromptTimeoutField: "timeout",
  unit: "s" as const,
};

function extractHookEntries(
  events: unknown,
  schema: "nested" | "flat",
): Record<string, unknown>[] {
  if (!Array.isArray(events)) return [];
  const out: Record<string, unknown>[] = [];
  for (const entry of events) {
    if (!entry || typeof entry !== "object") continue;
    if (schema === "nested") {
      const inner = (entry as { hooks?: unknown }).hooks;
      if (Array.isArray(inner)) {
        for (const hook of inner) {
          if (hook && typeof hook === "object") {
            out.push(hook as Record<string, unknown>);
          }
        }
      }
    } else {
      out.push(entry as Record<string, unknown>);
    }
  }
  return out;
}

describe("hook-timeouts: default timeouts survive Windows Python cold start (issue #267)", () => {
  const MIN_SESSION_START_S = 30;
  const MIN_USER_PROMPT_S = 15;
  const cfg = CURSOR_HOOK_CONFIG;

  describe(cfg.platform, () => {
    const raw = readFileSync(join(TEMPLATES_ROOT, cfg.path), "utf-8");
    const parsed = JSON.parse(raw) as {
      hooks?: Record<string, unknown>;
    };

    it(`SessionStart timeout >= ${MIN_SESSION_START_S}${cfg.unit}`, () => {
      const min =
        cfg.unit === "ms" ? MIN_SESSION_START_S * 1000 : MIN_SESSION_START_S;
      const events = parsed.hooks?.[cfg.sessionStartEvent];
      const hooks = extractHookEntries(events, cfg.schema);
      expect(hooks.length).toBeGreaterThan(0);
      for (const hook of hooks) {
        const value = hook[cfg.sessionStartTimeoutField];
        expect(typeof value).toBe("number");
        expect(value as number).toBeGreaterThanOrEqual(min);
      }
    });

    it(`${cfg.userPromptEvent} timeout >= ${MIN_USER_PROMPT_S}${cfg.unit}`, () => {
      const min =
        cfg.unit === "ms" ? MIN_USER_PROMPT_S * 1000 : MIN_USER_PROMPT_S;
      const events = parsed.hooks?.[cfg.userPromptEvent];
      const hooks = extractHookEntries(events, cfg.schema);
      expect(hooks.length).toBeGreaterThan(0);
      for (const hook of hooks) {
        const value = hook[cfg.userPromptTimeoutField];
        expect(typeof value).toBe("number");
        expect(value as number).toBeGreaterThanOrEqual(min);
      }
    });
  });
});
