/**
 * Search scoring and text matching over cleaned dialogue.
 */

import type { DialogueTurn, SearchExcerpt, SearchHit } from "./types.js";

/**
 * Weighted-density relevance score:
 *   `(3 * userCount + asstCount) / totalTurns`
 * Higher = the session is more topically concentrated on the query AND the
 * user themselves brought it up (user hits weighted ×3 — the user's own words
 * anchor "what they actually cared about"; assistant elaboration is downstream
 * noise). Normalized by `totalTurns` so a tight short session can outrank a
 * sprawling long one.
 */
export function relevanceScore(h: SearchHit): number {
  if (h.totalTurns === 0) return 0;
  return (3 * h.userCount + h.asstCount) / h.totalTurns;
}

/** Find the paragraph-aligned chunk surrounding a hit position. A "chunk" is
 * the contiguous text bounded by the nearest blank-line breaks (`\n\n`) on
 * either side. If the natural paragraph exceeds `maxChars`, fall back to a
 * centered char window — and report the truncation so callers can mark it. */
export function chunkAround(
  text: string,
  hitIdx: number,
  maxChars: number,
): { start: number; end: number; truncated: boolean } {
  const startPara = text.lastIndexOf("\n\n", hitIdx);
  let start = startPara === -1 ? 0 : startPara + 2;
  const endPara = text.indexOf("\n\n", hitIdx);
  let end = endPara === -1 ? text.length : endPara;
  let truncated = false;
  if (end - start > maxChars) {
    start = Math.max(0, hitIdx - Math.floor(maxChars / 2));
    end = Math.min(text.length, hitIdx + Math.ceil(maxChars / 2));
    truncated = true;
  }
  return { start, end, truncated };
}

/**
 * Multi-token AND grep over cleaned dialogue. Whitespace-split tokens; a turn
 * matches iff every token (case-insensitive) appears in it. `count` is the
 * total occurrence count across all tokens within matching turns. Excerpts are
 * paragraph-aligned chunks around each hit, deduped by chunk start; user-role
 * chunks are listed before assistant chunks.
 */
export function searchInDialogue(
  turns: readonly DialogueTurn[],
  kw: string,
  maxExcerpts = 3,
  chunkChars = 400,
): SearchHit {
  const tokens = kw.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) {
    return {
      count: 0,
      userCount: 0,
      asstCount: 0,
      totalTurns: turns.length,
      excerpts: [],
    };
  }

  let userCount = 0;
  let asstCount = 0;
  const userExcerpts: SearchExcerpt[] = [];
  const asstExcerpts: SearchExcerpt[] = [];

  for (const t of turns) {
    const hay = t.text.toLowerCase();
    if (!tokens.every((tok) => hay.includes(tok))) continue;

    const hitPositions: { idx: number; tok: string }[] = [];
    const tokenFreq = new Map<string, number>();
    let turnHits = 0;
    for (const tok of tokens) {
      let from = 0;
      let n = 0;
      while (true) {
        const idx = hay.indexOf(tok, from);
        if (idx === -1) break;
        n++;
        turnHits++;
        hitPositions.push({ idx, tok });
        from = idx + tok.length;
      }
      tokenFreq.set(tok, n);
    }
    if (t.role === "user") userCount += turnHits;
    else asstCount += turnHits;
    hitPositions.sort((a, b) => a.idx - b.idx);

    interface Candidate {
      start: number;
      end: number;
      truncated: boolean;
      coverage: number;
      rarity: number;
    }
    const candidates: Candidate[] = [];
    const seenStarts = new Set<number>();
    for (const { idx, tok } of hitPositions) {
      const { start, end, truncated } = chunkAround(t.text, idx, chunkChars);
      if (seenStarts.has(start)) continue;
      seenStarts.add(start);
      const slice = hay.slice(start, end);
      const coverage = tokens.filter((tk) => slice.includes(tk)).length;
      const rarity = 1 / (tokenFreq.get(tok) ?? 1);
      candidates.push({ start, end, truncated, coverage, rarity });
    }
    candidates.sort((a, b) => {
      if (b.coverage !== a.coverage) return b.coverage - a.coverage;
      if (b.rarity !== a.rarity) return b.rarity - a.rarity;
      return a.start - b.start;
    });
    for (const c of candidates) {
      let snippet = t.text.slice(c.start, c.end).trim();
      if (c.truncated) {
        if (c.start > 0) snippet = "…" + snippet;
        if (c.end < t.text.length) snippet += "…";
      }
      (t.role === "user" ? userExcerpts : asstExcerpts).push({
        role: t.role,
        snippet,
      });
    }
  }

  const excerpts = [...userExcerpts, ...asstExcerpts].slice(0, maxExcerpts);
  return {
    count: userCount + asstCount,
    userCount,
    asstCount,
    totalTurns: turns.length,
    excerpts,
  };
}
