/**
 * `trellis channel rm <name>` — kill any live workers, then remove the
 * channel directory under `~/.trellis/channels/`.
 *
 * `trellis channel prune [--all | --idle <duration> | --empty]` — bulk
 * cleanup matching criteria.
 */

import fs from "node:fs";
import path from "node:path";

import {
  channelDir,
  channelRoot,
  currentProjectKey,
  eventsPath,
  listProjects,
  migrateLegacyChannels,
  projectDir,
  resolveExistingChannelRef,
} from "./store/paths.js";
import { GLOBAL_PROJECT_KEY, parseChannelScope } from "./store/schema.js";

export interface RmOptions {
  force?: boolean;
  /** Project bucket override. Defaults to current cwd's project. */
  project?: string;
  scope?: string;
}

export async function channelRm(
  name: string,
  opts: RmOptions = {},
): Promise<void> {
  const project =
    opts.project ??
    resolveExistingChannelRef(name, {
      scope: parseChannelScope(opts.scope),
    }).project;
  const dir = channelDir(name, project);
  if (!fs.existsSync(dir)) {
    throw new Error(`Channel '${name}' not found at ${dir}`);
  }
  await killLiveWorkers(dir);
  fs.rmSync(dir, { recursive: true, force: true });
  if (!opts.force) {
    console.log(`Removed channel '${name}'`);
  }
}

export interface PruneOptions {
  all?: boolean;
  empty?: boolean;
  idleMs?: number;
  /** Remove only channels marked `ephemeral: true` in their create event. */
  ephemeral?: boolean;
  dryRun?: boolean;
  yes?: boolean;
  keep?: string[];
  scope?: string;
}

export async function channelPrune(opts: PruneOptions): Promise<void> {
  // The filter flags are mutually exclusive — combining them gives a
  // silently-ignored second filter under the else-if chain below. Catch
  // that up front so the user knows which one would have applied.
  const modes = [
    opts.ephemeral && "--ephemeral",
    opts.all && "--all",
    opts.empty && "--empty",
    opts.idleMs !== undefined && "--idle",
  ].filter(Boolean);
  if (modes.length > 1) {
    throw new Error(
      `prune flags are mutually exclusive: ${modes.join(" / ")}. Pick one.`,
    );
  }

  migrateLegacyChannels();
  const scope = parseChannelScope(opts.scope);
  const root = channelRoot();
  if (!fs.existsSync(root)) {
    console.log("(no channels)");
    return;
  }

  const keep = new Set(opts.keep ?? []);
  const candidates: {
    name: string;
    project: string;
    reason: string;
    lastTs?: string;
  }[] = [];

  const projects =
    scope === "global"
      ? [GLOBAL_PROJECT_KEY]
      : scope === "project"
        ? [currentProjectKey()]
        : listProjects();
  // Unscoped prune stays repo-wide by design; users want to clean across
  // projects with one command.
  for (const project of projects) {
    const dir = projectDir(project);
    let entries: string[];
    try {
      entries = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of entries) {
      if (name.startsWith(".")) continue; // skip .bucket marker
      if (keep.has(name)) continue;
      const chDir = channelDir(name, project);
      try {
        if (!fs.statSync(chDir).isDirectory()) continue;
      } catch {
        continue;
      }
      // Skip channels that still have a live worker.
      if (hasLiveWorker(chDir)) continue;

      const eventsFile = eventsPath(name, project);
      let totalEvents = 0;
      let lastTs: string | undefined;
      let ephemeralFlag = false;
      try {
        const text = fs.readFileSync(eventsFile, "utf-8");
        const lines = text.split("\n").filter((l) => l.trim());
        totalEvents = lines.length;
        // First event is `create`; read `ephemeral` from it.
        const first = lines[0];
        if (first) {
          try {
            ephemeralFlag =
              (JSON.parse(first) as { ephemeral?: boolean }).ephemeral === true;
          } catch {
            // ignore
          }
        }
        const last = lines[lines.length - 1];
        if (last) {
          try {
            lastTs = (JSON.parse(last) as { ts?: string }).ts;
          } catch {
            // ignore
          }
        }
      } catch {
        // missing or unreadable events.jsonl — count as empty
      }

      let reason: string | null = null;
      if (opts.ephemeral) {
        if (ephemeralFlag) reason = "ephemeral";
      } else if (opts.all) {
        reason = "all";
      } else if (opts.empty && totalEvents <= 1) {
        reason = "empty";
      } else if (opts.idleMs !== undefined && lastTs) {
        const age = Date.now() - Date.parse(lastTs);
        if (age >= opts.idleMs) reason = `idle ${Math.round(age / 60_000)}m`;
      }
      if (reason) candidates.push({ name, project, reason, lastTs });
    }
  }

  if (candidates.length === 0) {
    console.log("(nothing to prune)");
    return;
  }

  // Show what we're about to do
  for (const c of candidates) {
    const last = c.lastTs ? c.lastTs.slice(0, 19).replace("T", " ") : "-";
    console.log(`  ${c.name.padEnd(24)}  ${last}  (${c.reason})`);
  }

  if (opts.dryRun) {
    console.log(`\n(dry-run) would remove ${candidates.length} channel(s)`);
    return;
  }
  if (!opts.yes) {
    console.log(
      `\nRefusing to delete ${candidates.length} channel(s) without --yes. ` +
        `Re-run with --yes (or --dry-run to preview).`,
    );
    return;
  }

  for (const c of candidates) {
    try {
      await channelRm(c.name, { force: true, project: c.project });
    } catch (err) {
      console.error(
        `  failed to remove ${c.name}: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
  console.log(`\nRemoved ${candidates.length} channel(s)`);
}

function hasLiveWorker(dir: string): boolean {
  try {
    for (const f of fs.readdirSync(dir)) {
      if (!f.endsWith(".pid")) continue;
      const pid = Number(fs.readFileSync(path.join(dir, f), "utf-8").trim());
      if (pid && pidAlive(pid)) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

async function killLiveWorkers(dir: string): Promise<void> {
  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch {
    return;
  }
  for (const f of entries) {
    if (!f.endsWith(".pid")) continue;
    const pid = Number(fs.readFileSync(path.join(dir, f), "utf-8").trim());
    if (pid && pidAlive(pid)) {
      try {
        process.kill(pid, "SIGTERM");
        const deadline = Date.now() + 1500;
        while (pidAlive(pid) && Date.now() < deadline) {
          await sleep(50);
        }
        if (pidAlive(pid)) process.kill(pid, "SIGKILL");
      } catch {
        // already dead
      }
    }
  }
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
