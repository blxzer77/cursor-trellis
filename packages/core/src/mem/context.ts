/**
 * Dialogue-window context extraction: resolve a session, optionally merge
 * sub-agent children, then select a token-budgeted window of turns around the
 * top hits.
 */

import {
  buildChildIndex,
  extractDialogue,
  findSessionById,
  listAll,
  MemSessionNotFoundError,
  resolveFilter,
  WIDE_LIMIT,
} from "./sessions.js";
import type {
  DialogueRole,
  DialogueTurn,
  MemContextResult,
  MemContextTurn,
  ReadMemContextOptions,
} from "./types.js";

interface SelectedContext {
  turns: MemContextTurn[];
  totalHitTurns: number;
  budgetUsed: number;
}

/**
 * Pure selection: rank turns against `grep` (user-role first, then hit
 * density), take the top `nTurns`, expand each by `around` turns of context,
 * then emit turns within `maxChars` — head-truncating any single turn that
 * exceeds half the budget. With no `grep`, returns the first `nTurns` turns.
 */
export function selectContextTurns(
  turns: readonly DialogueTurn[],
  grep: string | undefined,
  nTurns: number,
  around: number,
  maxChars: number,
): SelectedContext {
  let hitIndices: number[] = [];
  let totalHitTurns = 0;

  if (grep) {
    const tokens = grep.toLowerCase().split(/\s+/).filter(Boolean);
    const matchCount = (text: string): number => {
      const hay = text.toLowerCase();
      if (!tokens.every((tok) => hay.includes(tok))) return 0;
      let n = 0;
      for (const tok of tokens) {
        let from = 0;
        while (true) {
          const idx = hay.indexOf(tok, from);
          if (idx === -1) break;
          n++;
          from = idx + tok.length;
        }
      }
      return n;
    };
    const ranked: { idx: number; role: DialogueRole; hits: number }[] = [];
    for (let i = 0; i < turns.length; i++) {
      const turn = turns[i];
      if (!turn) continue;
      const h = tokens.length === 0 ? 0 : matchCount(turn.text);
      if (h > 0) ranked.push({ idx: i, role: turn.role, hits: h });
    }
    totalHitTurns = ranked.length;
    ranked.sort((a, b) => {
      if (a.role !== b.role) return a.role === "user" ? -1 : 1;
      if (b.hits !== a.hits) return b.hits - a.hits;
      return a.idx - b.idx;
    });
    hitIndices = ranked.slice(0, nTurns).map((r) => r.idx);
  } else {
    for (let i = 0; i < Math.min(nTurns, turns.length); i++) hitIndices.push(i);
  }

  // Expand each hit by `around` turns on either side; dedupe via Set.
  const display = new Set<number>();
  for (const idx of hitIndices) {
    for (
      let j = Math.max(0, idx - around);
      j <= Math.min(turns.length - 1, idx + around);
      j++
    ) {
      display.add(j);
    }
  }
  const ordered = [...display].sort((a, b) => a - b);
  const hitSet = new Set(hitIndices);

  const out: MemContextTurn[] = [];
  let used = 0;
  for (const i of ordered) {
    const t = turns[i];
    if (!t) continue;
    let text = t.text;
    const cap = Math.floor(maxChars / 2);
    if (text.length > cap)
      text = text.slice(0, cap) + `\n…[+${t.text.length - cap} chars]`;
    if (used + text.length > maxChars && out.length > 0) break;
    out.push({ idx: i, role: t.role, text, isHit: hitSet.has(i) });
    used += text.length;
  }

  return { turns: out, totalHitTurns, budgetUsed: used };
}

/** Drill into a single session: top-N hit turns plus surrounding context,
 * char-budgeted. With no `grep`, returns the session opening. */
export function readMemContext(
  options: ReadMemContextOptions,
): MemContextResult {
  const f = resolveFilter(options.filter);
  const s = findSessionById(options.sessionId, f);
  if (!s) throw new MemSessionNotFoundError(options.sessionId);

  const grep = typeof options.grep === "string" ? options.grep : undefined;
  const nTurns = options.turns ?? 3;
  const around = options.around ?? 1;
  const maxChars = options.maxChars ?? 6000;

  let turns: DialogueTurn[] = extractDialogue(s);
  let mergedChildren = 0;
  if (options.includeChildren === true) {
    const all = listAll({ ...f, cwd: undefined, limit: WIDE_LIMIT });
    const childIndex = buildChildIndex(all);
    const kids = childIndex.get(s.id) ?? [];
    mergedChildren = kids.length;
    for (const c of kids) turns = [...turns, ...extractDialogue(c)];
  }

  const selected = selectContextTurns(turns, grep, nTurns, around, maxChars);

  return {
    session: s,
    query: grep,
    totalTurns: turns.length,
    totalHitTurns: selected.totalHitTurns,
    mergedChildren,
    budgetUsed: selected.budgetUsed,
    maxChars,
    turns: selected.turns,
    warnings: [],
  };
}
