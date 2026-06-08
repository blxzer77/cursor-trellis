/**
 * `task.py` command parsing and brainstorm-window slicing.
 *
 * Pure logic only — boundary signals are recovered from raw shell-call strings;
 * the per-platform raw-JSONL pass that produces those strings lives in the
 * adapters.
 */

import type {
  BrainstormWindow,
  ParsedTaskPyCommand,
  TaskPyEvent,
} from "./types.js";

/**
 * Find ALL `task.py create|start` invocations in a single Bash command string.
 * A real Bash invocation can contain several (e.g.
 * `SMOKE=$(task.py create …); task.py start "$SMOKE"`). Returned in source
 * order; each entry's args are bounded to the next `task.py` invocation or
 * end-of-line.
 *
 * False-positive guard: `task.py` must appear at the start of the command,
 * after whitespace, or after a path separator — never embedded inside a flag
 * value like `--slug=task.py-create-foo`.
 */
export function parseTaskPyCommandsAll(cmd: string): ParsedTaskPyCommand[] {
  if (typeof cmd !== "string" || cmd.length === 0) return [];
  const all: ParsedTaskPyCommand[] = [];
  const findRe = /(^|[\s/\\])task\.py\s+(create|start)(?:\s+|$)/g;
  const matches: { action: "create" | "start"; bodyStart: number }[] = [];
  for (const m of cmd.matchAll(findRe)) {
    const action = m[2] as "create" | "start";
    const bodyStart = m.index + m[0].length;
    matches.push({ action, bodyStart });
  }
  for (let i = 0; i < matches.length; i++) {
    const cur = matches[i];
    if (!cur) continue;
    const next = matches[i + 1];
    const slice = cmd.slice(cur.bodyStart, next?.bodyStart ?? cmd.length);
    const restRaw = (slice.split("\n")[0] ?? "").trim();
    // Reject prose-embedded matches: a bare alphanumeric word followed by
    // another all-letters word is English prose, not a real invocation.
    if (/^[A-Za-z][A-Za-z0-9_-]*\s+[A-Za-z]{2,}\b/.test(restRaw)) continue;
    const parsed = parseRestOfTaskPyCommand(cur.action, restRaw);
    if (
      cur.action === "create" &&
      parsed.action === "create" &&
      !parsed.slug &&
      !parsed.titleArg
    )
      continue;
    if (cur.action === "start" && parsed.action === "start" && !parsed.taskDir)
      continue;
    all.push(parsed);
  }
  return all;
}

/** Single-result wrapper — returns the first occurrence, or `null` if none. */
export function parseTaskPyCommand(cmd: string): ParsedTaskPyCommand | null {
  const all = parseTaskPyCommandsAll(cmd);
  return all[0] ?? null;
}

function parseRestOfTaskPyCommand(
  action: "create" | "start",
  restRaw: string,
): ParsedTaskPyCommand {
  if (action === "create") {
    const args = splitShellArgs(restRaw);
    let slug: string | undefined;
    let titleArg: string | undefined;
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === undefined) continue;
      if (a === "--slug" || a === "-s") {
        slug = args[i + 1];
        i++;
        continue;
      }
      if (a.startsWith("--slug=")) {
        slug = a.slice("--slug=".length);
        continue;
      }
      if (a.startsWith("-")) continue;
      titleArg ??= a;
    }
    return { action: "create", slug, titleArg };
  }
  const args = splitShellArgs(restRaw);
  let taskDir: string | undefined;
  for (const a of args) {
    if (a.startsWith("-")) continue;
    taskDir = a;
    break;
  }
  return { action: "start", taskDir };
}

/** Best-effort shell-arg splitter: respects `"…"` / `'…'` quoting, splits on
 * whitespace, treats `;`, `|`, `&`, `(`, `)` as token boundaries, and strips
 * trailing shell-meta cruft (`)};&|>`) from each token. Not a full POSIX
 * parser — sufficient for pulling slugs / paths out of `task.py` invocations. */
export function splitShellArgs(s: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: '"' | "'" | null = null;
  const flush = (): void => {
    if (!cur) return;
    const cleaned = cur.replace(/[)};&|>]+$/, "");
    if (cleaned) out.push(cleaned);
    cur = "";
  };
  for (const ch of s) {
    if (quote) {
      if (ch === quote) {
        quote = null;
        continue;
      }
      cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      flush();
      continue;
    }
    if (ch === ";" || ch === "|" || ch === "&" || ch === "(" || ch === ")") {
      flush();
      continue;
    }
    cur += ch;
  }
  flush();
  return out;
}

/** Derive a slug from a `start` task-dir path like
 * `.trellis/tasks/05-08-mem-phase-slice/` → `mem-phase-slice` (the `MM-DD-`
 * date prefix is stripped so it matches a `--slug` on the paired `create`). */
export function slugFromTaskDir(p: string | undefined): string | undefined {
  if (!p) return undefined;
  const norm = p.replace(/\\+/g, "/").replace(/\/+$/g, "");
  const parts = norm.split("/").filter(Boolean);
  const last = parts[parts.length - 1];
  if (last === undefined) return undefined;
  return last.replace(/^\d{2}-\d{2}-/, "");
}

/**
 * Pair `create` → `start` events into brainstorm windows.
 *
 * Pairing strategy:
 *   1. Slug match wins regardless of position.
 *   2. FIFO fallback: remaining creates pair with the next unmatched start
 *      appearing after them in event order.
 *   3. Unmatched create → `[create, totalTurns)`.
 *   4. Unmatched start  → `[0, start)`.
 *
 * Windows are sorted by `startTurn` ascending for stable output ordering.
 */
export function buildBrainstormWindows(
  events: readonly TaskPyEvent[],
  totalTurns: number,
): BrainstormWindow[] {
  const creates = events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.action === "create");
  const starts = events
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.action === "start");

  const usedStartIdx = new Set<number>();
  const usedCreateIdx = new Set<number>();
  const windows: BrainstormWindow[] = [];
  let windowCounter = 0;

  // Pass 1: pair by slug match.
  for (const { e: createEv, i: ci } of creates) {
    if (!createEv.slug) continue;
    const matchIdx = starts.findIndex(
      ({ e, i }) =>
        !usedStartIdx.has(i) && slugFromTaskDir(e.taskDir) === createEv.slug,
    );
    if (matchIdx === -1) continue;
    const startEntry = starts[matchIdx];
    if (!startEntry) continue;
    usedStartIdx.add(startEntry.i);
    usedCreateIdx.add(ci);
    pushWindow(
      windows,
      createEv.turnIndex,
      startEntry.e.turnIndex,
      createEv.slug,
      ++windowCounter,
    );
  }

  // Pass 2: FIFO pair remaining creates with later starts.
  for (const { e: createEv, i: ci } of creates) {
    if (usedCreateIdx.has(ci)) continue;
    const pairedStart = starts.find(({ i }) => !usedStartIdx.has(i) && i > ci);
    if (pairedStart) {
      usedStartIdx.add(pairedStart.i);
      usedCreateIdx.add(ci);
      const slug = createEv.slug ?? slugFromTaskDir(pairedStart.e.taskDir);
      pushWindow(
        windows,
        createEv.turnIndex,
        pairedStart.e.turnIndex,
        slug,
        ++windowCounter,
      );
    } else {
      usedCreateIdx.add(ci);
      pushWindow(
        windows,
        createEv.turnIndex,
        totalTurns,
        createEv.slug,
        ++windowCounter,
      );
    }
  }

  // Pass 3: unmatched starts → [0, start).
  for (const { e: startEv, i } of starts) {
    if (usedStartIdx.has(i)) continue;
    pushWindow(
      windows,
      0,
      startEv.turnIndex,
      slugFromTaskDir(startEv.taskDir),
      ++windowCounter,
    );
  }

  windows.sort((a, b) => a.startTurn - b.startTurn);
  return windows;
}

function pushWindow(
  windows: BrainstormWindow[],
  startTurn: number,
  endTurn: number,
  slug: string | undefined,
  counter: number,
): void {
  // Guard against malformed windows (start before create due to event
  // interleave) rather than emitting a negative slice.
  if (endTurn < startTurn) return;
  windows.push({
    label: slug ?? `window-${counter}`,
    startTurn,
    endTurn,
  });
}
