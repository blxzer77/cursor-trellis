#!/usr/bin/env node
/**
 * Maintainer guard: TS router, CLI template Python, and Pactile dogfood copies.
 * Requires `pnpm build` in packages/cli for TS golden smoke (dist/).
 */
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PACTILE_ROOT = path.resolve(__dirname, "../../..");
const GUARD = path.join(PACTILE_ROOT, "scripts", "check_router_copy_sync.py");

const extra = process.argv
  .slice(2)
  .filter((a) => a !== "--")
  .join(" ");
const cmd = `python "${GUARD}"${extra ? ` ${extra}` : ""}`;

try {
  execSync(cmd, { cwd: PACTILE_ROOT, stdio: "inherit", env: process.env });
} catch {
  process.exit(1);
}
