import fs from "node:fs";
import path from "node:path";

import type { RpcAuditEntry } from "./audit.js";

/**
 * Optional append-only journal under a directory (callers use
 * `~/.cstl/rpc/` or a test temp dir). Separate from `~/.cstl/channels/`.
 */
export class RpcJournal {
  readonly filePath: string;

  constructor(dir: string, fileName = "audit.jsonl") {
    fs.mkdirSync(dir, { recursive: true });
    this.filePath = path.join(dir, fileName);
  }

  append(entry: RpcAuditEntry): void {
    fs.appendFileSync(this.filePath, `${JSON.stringify(entry)}\n`, "utf8");
  }
}
