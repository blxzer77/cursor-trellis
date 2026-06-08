/**
 * File-based advisory lock primitive.
 *
 * Uses `open(path, "wx")` (O_EXCL) for atomic creation across processes —
 * works correctly on local POSIX filesystems and macOS APFS / Linux ext4.
 * NFS is not a supported target (channels live in `~/.trellis/channels`).
 *
 * Each lockfile stores the holder's pid for forensic + stale-lock recovery.
 * If a lock file exists but the owning pid is no longer alive, the next
 * `acquireLock` will steal it (log a warning).
 *
 * Usage:
 *   await withLock(lockPath, async () => { ... critical section ... });
 */

import fs from "node:fs";
import path from "node:path";

const DEFAULT_RETRY_INTERVAL_MS = 25;
const DEFAULT_MAX_WAIT_MS = 5000;

interface AcquireOptions {
  retryIntervalMs?: number;
  maxWaitMs?: number;
}

export async function acquireLock(
  lockFile: string,
  opts: AcquireOptions = {},
): Promise<void> {
  const interval = opts.retryIntervalMs ?? DEFAULT_RETRY_INTERVAL_MS;
  const deadline = Date.now() + (opts.maxWaitMs ?? DEFAULT_MAX_WAIT_MS);

  // Ensure dir exists
  fs.mkdirSync(path.dirname(lockFile), { recursive: true });

  while (true) {
    try {
      const fd = fs.openSync(lockFile, "wx");
      fs.writeSync(fd, String(process.pid));
      fs.closeSync(fd);
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
    }

    // Lock held — check liveness of the holding pid.
    if (await checkAndStealStale(lockFile)) continue;

    if (Date.now() >= deadline) {
      throw new Error(
        `Failed to acquire lock ${lockFile} within ${opts.maxWaitMs ?? DEFAULT_MAX_WAIT_MS}ms`,
      );
    }
    await sleep(interval);
  }
}

export function releaseLock(lockFile: string): void {
  try {
    // Defense in depth: only unlink if the file still belongs to us. A
    // concurrent steal would have re-created the file with another pid.
    const content = fs.readFileSync(lockFile, "utf-8").trim();
    if (content === String(process.pid)) {
      fs.unlinkSync(lockFile);
    }
  } catch {
    // already gone, fine
  }
}

export async function withLock<T>(
  lockFile: string,
  fn: () => Promise<T> | T,
  opts?: AcquireOptions,
): Promise<T> {
  await acquireLock(lockFile, opts);
  try {
    return await fn();
  } finally {
    releaseLock(lockFile);
  }
}

async function checkAndStealStale(lockFile: string): Promise<boolean> {
  let holderPid = 0;
  try {
    holderPid = Number(fs.readFileSync(lockFile, "utf-8").trim());
  } catch {
    // Lock vanished while we checked — let outer loop retry openSync.
    return false;
  }
  if (!holderPid || !pidAlive(holderPid)) {
    try {
      fs.unlinkSync(lockFile);
      process.stderr.write(
        `[channel lock] stale lock from dead pid ${holderPid} stolen at ${lockFile}\n`,
      );
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function pidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
