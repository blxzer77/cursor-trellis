import fs from "node:fs";

import { parseClaudeLine } from "./adapters/claude.js";
import { createCodexCtx, parseCodexLine } from "./adapters/codex.js";
import type { ParseResult } from "./adapters/types.js";

/**
 * Dev-only command: feed a recorded stream-json / wire trace into the
 * matching adapter and print the resulting channel events as JSON lines.
 *
 * Not user-facing; used during adapter development to verify against
 * real-CLI fixtures (see research/probes/).
 *
 * NOTE: codex traces only contain inbound lines (server → us). For probe
 * fixtures recorded by codex-probe.mjs, outbound request ids are not in the
 * trace; we pre-seed the ctx with the ids the probe used (1 for initialize,
 * 2 for thread/start, 3 for turn/start) so id-matching works.
 */
export function parseTrace(adapter: "claude" | "codex", file: string): void {
  const raw = fs.readFileSync(file, "utf-8");
  const lines = raw.split("\n");
  let lineNo = 0;

  if (adapter === "claude") {
    for (const line of lines) {
      lineNo++;
      if (!line.trim()) continue;
      const result: ParseResult = parseClaudeLine(line);
      printResult(lineNo, result);
    }
    return;
  }

  // adapter === "codex"
  const ctx = createCodexCtx();
  // Pre-seed pending so the recorded responses (id=1,2,3) match.
  ctx.pending.set(1, "initialize");
  ctx.pending.set(2, "thread/start");
  ctx.pending.set(3, "turn/start");
  ctx.nextId = 4;

  for (const line of lines) {
    lineNo++;
    if (!line.trim()) continue;
    const result = parseCodexLine(line, ctx);
    printResult(lineNo, result);
  }
}

function printResult(lineNo: number, result: ParseResult): void {
  for (const ev of result.events) {
    console.log(JSON.stringify({ line: lineNo, ...ev }));
  }
  if (result.side) {
    const { reply, resolved, ...persist } = result.side;
    if (Object.keys(persist).length > 0) {
      console.log(
        JSON.stringify({ line: lineNo, kind: "<side-effect>", ...persist }),
      );
    }
    if (reply && reply.length > 0) {
      for (const r of reply) {
        console.log(
          JSON.stringify({
            line: lineNo,
            kind: "<outbound>",
            text: r.trim(),
          }),
        );
      }
    }
    if (resolved && resolved.length > 0) {
      for (const r of resolved) {
        console.log(
          JSON.stringify({ line: lineNo, kind: "<rpc-resolved>", ...r }),
        );
      }
    }
  }
}
