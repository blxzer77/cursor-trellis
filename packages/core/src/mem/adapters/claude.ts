/**
 * Persisted Claude Code session reader.
 *
 * Layout: `~/.claude/projects/<sanitized-cwd>/<sessionId>.jsonl`, with an
 * optional `<projectDir>/sessions-index.json` providing cwd / created / title.
 */

import * as fs from "node:fs";
import * as path from "node:path";

import { stripInjectionTags, isBootstrapTurn } from "../dialogue.js";
import { inRangeOverlap, sameProject } from "../filter.js";
import {
  findInJsonl,
  readJsonFile,
  readJsonl,
  readJsonlFirst,
} from "../internal/jsonl.js";
import { CLAUDE_PROJECTS, claudeProjectDirFromCwd } from "../internal/paths.js";
import { parseTaskPyCommandsAll } from "../phase.js";
import { searchInDialogue } from "../search.js";
import type {
  DialogueTurn,
  MemFilter,
  MemSessionInfo,
  SearchHit,
  TaskPyEvent,
} from "../types.js";

// ---------- loose external shapes ----------

interface ClaudeBlock {
  type?: string;
  text?: string;
  name?: unknown;
  input?: unknown;
}

interface ClaudeMessage {
  role?: string;
  content?: string | ClaudeBlock[];
}

interface ClaudeEvent {
  type?: string;
  cwd?: string;
  timestamp?: string;
  message?: ClaudeMessage;
  isCompactSummary?: boolean;
}

interface ClaudeIndexEntry {
  id?: string;
  cwd?: string;
  created?: string;
  title?: string;
}

interface ClaudeIndex {
  entries?: ClaudeIndexEntry[];
}

// ---------- list ----------

export function claudeListSessions(f: MemFilter): MemSessionInfo[] {
  if (!fs.existsSync(CLAUDE_PROJECTS)) return [];
  const out: MemSessionInfo[] = [];
  const projectDirs: string[] = f.cwd
    ? [claudeProjectDirFromCwd(f.cwd)].filter((d) => fs.existsSync(d))
    : fs.readdirSync(CLAUDE_PROJECTS).map((d) => path.join(CLAUDE_PROJECTS, d));

  for (const dir of projectDirs) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    const indexFile = path.join(dir, "sessions-index.json");
    const index = readJsonFile<ClaudeIndex>(indexFile);
    const indexById = new Map<string, ClaudeIndexEntry>();
    for (const e of Array.isArray(index?.entries) ? index.entries : []) {
      if (typeof e.id === "string") indexById.set(e.id, e);
    }

    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".jsonl")) continue;
      const filePath = path.join(dir, e.name);
      const id = e.name.replace(/\.jsonl$/, "");
      const idx = indexById.get(id);
      let cwd: string | undefined = idx?.cwd;
      let created: string | undefined = idx?.created;
      const title: string | undefined = idx?.title;

      if (!cwd || !created) {
        const evt = findInJsonl<ClaudeEvent>(
          filePath,
          (o) => typeof o.cwd === "string",
          100,
        );
        cwd = cwd ?? evt?.cwd;
        created =
          created ??
          evt?.timestamp ??
          readJsonlFirst<ClaudeEvent>(filePath)?.timestamp;
      }

      const stat = fs.statSync(filePath);
      const updated = stat.mtime.toISOString();
      // Interval overlap: cross-day sessions that started before --since but
      // were still active inside the window must survive.
      if (!inRangeOverlap(created, updated, f)) continue;
      if (f.cwd && cwd && !sameProject(cwd, f.cwd)) continue;

      out.push({
        platform: "claude",
        id,
        title,
        cwd,
        created,
        updated,
        filePath,
      });
    }
  }
  return out;
}

// ---------- extract ----------

export function claudeExtractDialogue(s: MemSessionInfo): DialogueTurn[] {
  // - user: type=="user" + role=="user" + content is a string
  // - assistant: type=="assistant" + role=="assistant", keep only `text` blocks
  // - thinking / tool_use blocks dropped entirely; injection tags stripped
  // - compaction: an `isCompactSummary` user event resets prior turns and
  //   replaces them with a single synthetic [compact summary] turn
  let turns: DialogueTurn[] = [];
  readJsonl<ClaudeEvent>(s.filePath, (obj) => {
    const t = obj.type;
    const msg = obj.message;
    if (!msg) return;
    const content = msg.content;
    if (t === "user" && obj.isCompactSummary === true) {
      let summary = "";
      if (typeof content === "string") {
        summary = stripInjectionTags(content);
      } else if (Array.isArray(content)) {
        const parts: string[] = [];
        for (const block of content) {
          if (block.type === "text" && typeof block.text === "string") {
            const cleaned = stripInjectionTags(block.text);
            if (cleaned) parts.push(cleaned);
          }
        }
        summary = parts.join("\n\n");
      }
      turns = summary
        ? [{ role: "user", text: `[compact summary]\n${summary}` }]
        : [];
      return;
    }
    if (t === "user" && msg.role === "user") {
      if (typeof content === "string") {
        const text = stripInjectionTags(content);
        if (text && !isBootstrapTurn(text, content.length)) {
          turns.push({ role: "user", text });
        }
      }
    } else if (
      t === "assistant" &&
      msg.role === "assistant" &&
      Array.isArray(content)
    ) {
      const parts: string[] = [];
      for (const block of content) {
        if (block.type === "text" && typeof block.text === "string") {
          const cleaned = stripInjectionTags(block.text);
          if (cleaned) parts.push(cleaned);
        }
      }
      if (parts.length)
        turns.push({ role: "assistant", text: parts.join("\n\n") });
    }
  });
  return turns;
}

export function claudeSearch(s: MemSessionInfo, kw: string): SearchHit {
  return searchInDialogue(claudeExtractDialogue(s), kw);
}

/**
 * Single-pass scan of a Claude JSONL file that produces both the cleaned
 * dialogue turns (semantically identical to {@link claudeExtractDialogue}) and
 * the list of `task.py create|start` Bash tool_use events with their
 * `turnIndex`. Compaction resets both `turns` AND `events` — pre-compact event
 * indices stop pointing at real turns once history is collapsed.
 */
export function collectClaudeTurnsAndEvents(s: MemSessionInfo): {
  turns: DialogueTurn[];
  events: TaskPyEvent[];
} {
  let turns: DialogueTurn[] = [];
  let events: TaskPyEvent[] = [];

  readJsonl<ClaudeEvent>(s.filePath, (obj) => {
    const t = obj.type;
    const msg = obj.message;
    if (!msg) return;
    const content = msg.content;

    if (t === "user" && obj.isCompactSummary === true) {
      let summary = "";
      if (typeof content === "string") {
        summary = stripInjectionTags(content);
      } else if (Array.isArray(content)) {
        const parts: string[] = [];
        for (const block of content) {
          if (block.type === "text" && typeof block.text === "string") {
            const cleaned = stripInjectionTags(block.text);
            if (cleaned) parts.push(cleaned);
          }
        }
        summary = parts.join("\n\n");
      }
      turns = summary
        ? [{ role: "user", text: `[compact summary]\n${summary}` }]
        : [];
      events = [];
      return;
    }

    if (t === "user" && msg.role === "user") {
      if (typeof content === "string") {
        const text = stripInjectionTags(content);
        if (text && !isBootstrapTurn(text, content.length)) {
          turns.push({ role: "user", text });
        }
      }
      return;
    }

    if (
      t === "assistant" &&
      msg.role === "assistant" &&
      Array.isArray(content)
    ) {
      const parts: string[] = [];
      for (const block of content) {
        if (block.type === "text" && typeof block.text === "string") {
          const cleaned = stripInjectionTags(block.text);
          if (cleaned) parts.push(cleaned);
        } else if (block.type === "tool_use") {
          if (block.name !== "Bash") continue;
          const inp = block.input;
          if (!inp || typeof inp !== "object") continue;
          const command = (inp as { command?: unknown }).command;
          if (typeof command !== "string") continue;
          const parsedAll = parseTaskPyCommandsAll(command);
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
        }
      }
      if (parts.length)
        turns.push({ role: "assistant", text: parts.join("\n\n") });
    }
  });

  return { turns, events };
}
