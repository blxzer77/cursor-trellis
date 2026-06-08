/**
 * Streaming JSONL / JSON readers for the persisted-session adapters.
 *
 * Zero-dependency on purpose — `@mindfoldhq/trellis-core` does not depend on
 * `zod`. The original CLI implementation validated every line against a Zod
 * schema; the external session formats were all declared `.loose()` with every
 * field `.optional()`, so the only thing the schema actually rejected was a
 * top-level non-object line — which the `0x7b` byte-prefix fast-reject already
 * filters. Adapters therefore receive each parsed line cast to a hand-written
 * loose interface and read fields defensively.
 */

import * as fs from "node:fs";

const CHUNK = 256 * 1024;
const OPEN_BRACE = 0x7b; // '{'

/**
 * Walk a JSONL file line-by-line, invoking `onLine` with each parsed object.
 * Bad JSON lines are skipped. Returning the literal `"stop"` from `onLine`
 * halts iteration.
 *
 * Chunked sync streaming: 256 KB read window, leftover preserved across chunks
 * for split-line reassembly — bounded heap on multi-MB session files and a
 * `"stop"` short-circuit that avoids reading the whole file when only the head
 * is needed.
 *
 * Byte-prefix fast-reject: a JSONL event line virtually always begins with `{`.
 * Lines whose first byte is not `{` are blanks / log preambles / partial writes
 * and are skipped before paying the `JSON.parse` cost.
 */
export function readJsonl<T>(file: string, onLine: (obj: T) => unknown): void {
  let fd: number;
  try {
    fd = fs.openSync(file, "r");
  } catch {
    return;
  }
  const buf = Buffer.alloc(CHUNK);
  let leftover = "";
  try {
    let stop = false;
    while (!stop) {
      const n = fs.readSync(fd, buf, 0, CHUNK, null);
      if (n === 0) break;
      const chunk = leftover + buf.toString("utf8", 0, n);
      let from = 0;
      while (true) {
        const nl = chunk.indexOf("\n", from);
        if (nl === -1) {
          leftover = chunk.slice(from);
          break;
        }
        const line = chunk.slice(from, nl);
        from = nl + 1;
        if (!line) continue;
        if (line.charCodeAt(0) !== OPEN_BRACE) continue;
        let raw: unknown;
        try {
          raw = JSON.parse(line);
        } catch {
          continue;
        }
        if (onLine(raw as T) === "stop") {
          stop = true;
          break;
        }
      }
    }
    if (!stop && leftover) {
      // File ended without a trailing newline — process the last partial line.
      const line = leftover;
      if (line.charCodeAt(0) === OPEN_BRACE) {
        try {
          const raw: unknown = JSON.parse(line);
          onLine(raw as T);
        } catch {
          /* skip */
        }
      }
    }
  } finally {
    fs.closeSync(fd);
  }
}

/** Read just the first parseable JSONL object (stops after one line). */
export function readJsonlFirst<T>(file: string): T | undefined {
  let result: T | undefined;
  readJsonl<T>(file, (obj) => {
    result = obj;
    return "stop";
  });
  return result;
}

/** Find the first JSONL object satisfying `predicate`, scanning at most
 * `maxLines` lines. */
export function findInJsonl<T>(
  file: string,
  predicate: (obj: T) => boolean,
  maxLines = 200,
): T | undefined {
  let count = 0;
  let hit: T | undefined;
  readJsonl<T>(file, (obj) => {
    count++;
    if (predicate(obj)) {
      hit = obj;
      return "stop";
    }
    if (count >= maxLines) return "stop";
  });
  return hit;
}

/** Read and JSON-parse a whole file; returns `undefined` on read / parse
 * failure. The caller is responsible for shape-checking the result. */
export function readJsonFile<T>(file: string): T | undefined {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return undefined;
  }
}
