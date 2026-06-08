/**
 * Persisted Codex session reader.
 *
 * Layout: `~/.codex/sessions/**\/rollout-<ts>-<id>.jsonl`. Metadata is read
 * from the first event's `payload`; the filename timestamp is a fallback
 * `created`.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { stripInjectionTags, isBootstrapTurn } from "../dialogue.js";
import { inRangeOverlap, sameProject } from "../filter.js";
import { readJsonl, readJsonlFirst } from "../internal/jsonl.js";
import { CODEX_SESSIONS, walkDir } from "../internal/paths.js";
import { parseTaskPyCommandsAll } from "../phase.js";
import { searchInDialogue } from "../search.js";
import type {
  DialogueRole,
  DialogueTurn,
  MemFilter,
  MemSessionInfo,
  SearchHit,
  TaskPyEvent,
} from "../types.js";

// ---------- loose external shapes ----------

interface CodexContentPart {
  type?: string;
  text?: string;
}

interface CodexCompactedItem {
  type?: string;
  role?: string;
  content?: CodexContentPart[];
}

interface CodexPayload {
  type?: string;
  role?: string;
  cwd?: string;
  id?: string;
  content?: CodexContentPart[];
  replacement_history?: CodexCompactedItem[];
  name?: unknown;
  arguments?: unknown;
}

interface CodexEvent {
  timestamp?: string;
  type?: string;
  payload?: CodexPayload;
}

function parseDialogueRole(v: unknown): DialogueRole | undefined {
  return v === "user" || v === "assistant" ? v : undefined;
}

/**
 * Recover the shell command string from a Codex `function_call` event's
 * `arguments` field. Codex versions vary in how they encode it:
 *
 *   - a raw shell string
 *   - a stringified JSON object with `cmd` / `command` (string) or
 *     `argv` (string[] — joined with spaces)
 *   - a raw object with the same `cmd` / `command` / `argv` shape
 *
 * Returns `undefined` when no command can be recovered.
 */
export function commandFromCodexArguments(argsRaw: unknown): string | undefined {
  const fromObject = (obj: Record<string, unknown>): string | undefined => {
    const cmd = obj.cmd;
    if (typeof cmd === "string") return cmd;
    const command = obj.command;
    if (typeof command === "string") return command;
    const argv = obj.argv;
    if (Array.isArray(argv)) {
      const parts = argv.filter((a): a is string => typeof a === "string");
      if (parts.length) return parts.join(" ");
    }
    return undefined;
  };

  if (typeof argsRaw === "string") {
    try {
      const parsed: unknown = JSON.parse(argsRaw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return fromObject(parsed as Record<string, unknown>);
      }
    } catch {
      // Not JSON — some Codex versions inline the raw shell string.
      return argsRaw;
    }
    return undefined;
  }

  if (argsRaw && typeof argsRaw === "object" && !Array.isArray(argsRaw)) {
    return fromObject(argsRaw as Record<string, unknown>);
  }

  return undefined;
}

// ---------- list ----------

export function codexListSessions(f: MemFilter): MemSessionInfo[] {
  if (!fs.existsSync(CODEX_SESSIONS)) return [];
  const out: MemSessionInfo[] = [];
  for (const file of walkDir(CODEX_SESSIONS)) {
    if (!file.endsWith(".jsonl")) continue;
    const base = path.basename(file, ".jsonl");
    const m = base.match(
      /^rollout-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})-(.+)$/,
    );
    const tsFromName = m?.[1]
      ? new Date(
          m[1].replace(/T(\d{2})-(\d{2})-(\d{2})/, "T$1:$2:$3") + "Z",
        ).toISOString()
      : undefined;

    const first = readJsonlFirst<CodexEvent>(file);
    const meta = first?.payload;
    const id = meta?.id ?? m?.[2] ?? base;
    const cwd = meta?.cwd;
    const created = first?.timestamp ?? tsFromName ?? "";

    if (f.cwd && !sameProject(cwd, f.cwd)) continue;
    const updated = fs.statSync(file).mtime.toISOString();
    if (!inRangeOverlap(created, updated, f)) continue;

    out.push({
      platform: "codex",
      id,
      cwd,
      created,
      updated,
      filePath: file,
    });
  }
  return out;
}

// ---------- extract ----------

function buildTurnFromMessage(
  role: DialogueRole,
  parts: CodexContentPart[] | undefined,
): DialogueTurn | null {
  const collected: string[] = [];
  let totalRaw = 0;
  for (const c of parts ?? []) {
    const txt = c.text;
    if (typeof txt !== "string") continue;
    if (c.type !== "input_text" && c.type !== "output_text") continue;
    totalRaw += txt.length;
    const cleaned = stripInjectionTags(txt);
    if (cleaned) collected.push(cleaned);
  }
  if (!collected.length) return null;
  const merged = collected.join("\n\n");
  if (isBootstrapTurn(merged, totalRaw)) return null;
  return { role, text: merged };
}

export function codexExtractDialogue(s: MemSessionInfo): DialogueTurn[] {
  // payload.type=="message" with role in {user, assistant} only.
  // Compaction: a top-level `compacted` event carries payload.replacement_history
  // — the new authoritative history replacing everything before.
  let turns: DialogueTurn[] = [];

  readJsonl<CodexEvent>(s.filePath, (obj) => {
    if (obj.type === "compacted") {
      const rh = obj.payload?.replacement_history;
      turns = [];
      if (!Array.isArray(rh)) return;
      for (const item of rh) {
        if (item.type !== "message") continue;
        const role = parseDialogueRole(item.role);
        if (!role) continue;
        const turn = buildTurnFromMessage(role, item.content);
        if (turn)
          turns.push({ role: turn.role, text: `[compact]\n${turn.text}` });
      }
      return;
    }

    const p = obj.payload;
    if (p?.type !== "message") return;
    const role = parseDialogueRole(p.role);
    if (!role) return;
    const turn = buildTurnFromMessage(role, p.content);
    if (turn) turns.push(turn);
  });
  return turns;
}

export function codexSearch(s: MemSessionInfo, kw: string): SearchHit {
  return searchInDialogue(codexExtractDialogue(s), kw);
}

/**
 * Codex twin of `collectClaudeTurnsAndEvents`. Single pass over the rollout
 * file; emits both the cleaned dialogue turns and the list of
 * `task.py create|start` invocations found inside `function_call` events whose
 * `name === "exec_command"` (or `"shell"`). Compaction resets both `turns` and
 * `events`.
 */
export function collectCodexTurnsAndEvents(s: MemSessionInfo): {
  turns: DialogueTurn[];
  events: TaskPyEvent[];
} {
  let turns: DialogueTurn[] = [];
  let events: TaskPyEvent[] = [];

  readJsonl<CodexEvent>(s.filePath, (obj) => {
    if (obj.type === "compacted") {
      const rh = obj.payload?.replacement_history;
      turns = [];
      events = [];
      if (!Array.isArray(rh)) return;
      for (const item of rh) {
        if (item.type !== "message") continue;
        const role = parseDialogueRole(item.role);
        if (!role) continue;
        const turn = buildTurnFromMessage(role, item.content);
        if (turn)
          turns.push({ role: turn.role, text: `[compact]\n${turn.text}` });
      }
      return;
    }

    const p = obj.payload;
    if (!p) return;

    if (p.type === "function_call") {
      const fnName = p.name;
      if (fnName !== "exec_command" && fnName !== "shell") return;
      const cmd = commandFromCodexArguments(p.arguments);
      if (!cmd) return;
      const parsedAll = parseTaskPyCommandsAll(cmd);
      for (const parsed of parsedAll) {
        const ev: TaskPyEvent = {
          action: parsed.action,
          timestamp: obj.timestamp ?? "",
          turnIndex: turns.length,
          ...(parsed.action === "create"
            ? { slug: parsed.slug }
            : { taskDir: parsed.taskDir }),
        };
        events.push(ev);
      }
      return;
    }

    if (p.type !== "message") return;
    const role = parseDialogueRole(p.role);
    if (!role) return;
    const turn = buildTurnFromMessage(role, p.content);
    if (turn) turns.push(turn);
  });

  return { turns, events };
}
