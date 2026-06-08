/**
 * Cross-day session filtering regression for the persisted-session adapters.
 *
 * List filtering must apply interval overlap, not a single-point `created`
 * comparison — long-running cross-day sessions whose start falls outside the
 * window must survive when activity inside it is heavy.
 *
 * Each platform is exercised against the five interval relations:
 *   1. Entirely before window  → excluded
 *   2. Entirely after window   → excluded
 *   3. Embedded inside window  → included
 *   4. Crosses left bound      → included (the bug case)
 *   5. Crosses right bound     → included
 *
 * Migrated from the CLI `mem-since-cross-day` suite. The `inRangeOverlap` unit
 * tests live in `helpers.test.ts`.
 */

import {
  describe,
  it,
  expect,
  afterAll,
  beforeEach,
  afterEach,
  vi,
} from "vitest";
import * as nodeFs from "node:fs";
import * as nodePath from "node:path";

const { fakeHome } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const f = require("node:fs") as typeof import("node:fs");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const o = require("node:os") as typeof import("node:os");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const p = require("node:path") as typeof import("node:path");
  const fakeHome = f.mkdtempSync(p.join(o.tmpdir(), "trellis-mem-cross-"));
  return { fakeHome };
});

vi.mock("node:os", async () => {
  const actual = await vi.importActual<typeof import("node:os")>("node:os");
  return { ...actual, homedir: () => fakeHome };
});

const { claudeListSessions } = await import("../../src/mem/adapters/claude.js");
const { codexListSessions } = await import("../../src/mem/adapters/codex.js");

import type { MemFilter } from "../../src/mem/types.js";

const CLAUDE_PROJECTS = nodePath.join(fakeHome, ".claude", "projects");
const CODEX_SESSIONS = nodePath.join(fakeHome, ".codex", "sessions");

function writeJsonl(file: string, lines: readonly unknown[]): void {
  nodeFs.mkdirSync(nodePath.dirname(file), { recursive: true });
  nodeFs.writeFileSync(
    file,
    lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
  );
}

function setMtime(file: string, iso: string): void {
  const t = new Date(iso);
  nodeFs.utimesSync(file, t, t);
}

function rimraf(p: string): void {
  nodeFs.rmSync(p, { recursive: true, force: true });
}

afterAll(() => {
  rimraf(fakeHome);
});

interface IntervalCase {
  name: string;
  start: string;
  end: string;
  since?: string;
  until?: string;
  expectIncluded: boolean;
}

const CASES: readonly IntervalCase[] = [
  {
    name: "#1 entirely before window",
    start: "2026-04-01T00:00:00Z",
    end: "2026-04-05T00:00:00Z",
    since: "2026-05-01",
    expectIncluded: false,
  },
  {
    name: "#2 entirely after window",
    start: "2026-06-01T00:00:00Z",
    end: "2026-06-05T00:00:00Z",
    until: "2026-05-31",
    expectIncluded: false,
  },
  {
    name: "#3 embedded inside window",
    start: "2026-05-10T00:00:00Z",
    end: "2026-05-12T00:00:00Z",
    since: "2026-05-01",
    until: "2026-05-20",
    expectIncluded: true,
  },
  {
    name: "#4 crosses window left bound (cross-day bug case)",
    start: "2026-04-25T00:00:00Z",
    end: "2026-05-05T00:00:00Z",
    since: "2026-05-01",
    expectIncluded: true,
  },
  {
    name: "#5 crosses window right bound",
    start: "2026-05-25T00:00:00Z",
    end: "2026-06-05T00:00:00Z",
    until: "2026-05-31",
    expectIncluded: true,
  },
];

function filterForCase(c: IntervalCase): MemFilter {
  return {
    platform: "all",
    limit: 50,
    cwd: undefined,
    since: c.since ? new Date(c.since) : undefined,
    until: c.until ? new Date(`${c.until}T23:59:59.999Z`) : undefined,
  };
}

// =============================================================================
// Claude
// =============================================================================

describe("claudeListSessions interval-overlap filter", () => {
  const projectCwd = "/tmp/cross-day-claude";
  const encodedCwd = projectCwd.replace(/[/_]/g, "-");
  const projectDir = nodePath.join(CLAUDE_PROJECTS, encodedCwd);

  beforeEach(() => {
    nodeFs.mkdirSync(projectDir, { recursive: true });
  });

  afterEach(() => {
    rimraf(CLAUDE_PROJECTS);
  });

  for (const c of CASES) {
    it(c.name, () => {
      const sessionId = `claude-${c.name.split(" ")[0]?.slice(1)}-id`;
      const sessionFile = nodePath.join(projectDir, `${sessionId}.jsonl`);
      writeJsonl(sessionFile, [
        {
          type: "user",
          cwd: projectCwd,
          timestamp: c.start,
          message: { role: "user", content: "hello" },
        },
      ]);
      setMtime(sessionFile, c.end);
      const r = claudeListSessions(filterForCase(c));
      expect(r.some((s) => s.id === sessionId)).toBe(c.expectIncluded);
    });
  }
});

// =============================================================================
// Codex
// =============================================================================

describe("codexListSessions interval-overlap filter", () => {
  const projectCwd = "/tmp/cross-day-codex";

  afterEach(() => {
    rimraf(CODEX_SESSIONS);
  });

  for (const c of CASES) {
    it(c.name, () => {
      const sessionId = `codex-${c.name.split(" ")[0]?.slice(1)}-id`;
      const startDate = new Date(c.start);
      const fnameTs = startDate
        .toISOString()
        .slice(0, 19)
        .replace(/T(\d{2}):(\d{2}):(\d{2})/, "T$1-$2-$3");
      const fileName = `rollout-${fnameTs}-${sessionId}.jsonl`;
      const yyyy = String(startDate.getUTCFullYear());
      const mm = String(startDate.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(startDate.getUTCDate()).padStart(2, "0");
      const sessionFile = nodePath.join(CODEX_SESSIONS, yyyy, mm, dd, fileName);
      writeJsonl(sessionFile, [
        {
          timestamp: c.start,
          type: "session_meta",
          payload: { id: sessionId, cwd: projectCwd },
        },
      ]);
      setMtime(sessionFile, c.end);
      const r = codexListSessions(filterForCase(c));
      expect(r.some((s) => s.id === sessionId)).toBe(c.expectIncluded);
    });
  }
});
