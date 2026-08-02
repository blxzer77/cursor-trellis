import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import type { CampaignParentSnapshot } from "./types.js";

const execFileAsync = promisify(execFile);

/** Walk upward from start until a directory containing `.cstl/scripts/task.py` is found. */
export function findHarnessRoot(start: string): string | null {
  let cur = path.resolve(start);
  for (let i = 0; i < 12; i++) {
    const candidate = path.join(cur, ".cstl", "scripts", "task.py");
    if (fs.existsSync(candidate)) return cur;
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function normalizeParentSnapshot(raw: unknown): CampaignParentSnapshot {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("parent-status --json returned non-object payload");
  }
  const o = raw as Record<string, unknown>;
  if (typeof o.error === "string") {
    throw new Error(o.error);
  }
  if (typeof o.id !== "string" || typeof o.path !== "string") {
    throw new Error("parent-status --json missing id/path");
  }

  const stagesRaw = Array.isArray(o.stages) ? o.stages : [];
  const stages = stagesRaw.map((stage) => {
    const s = stage as Record<string, unknown>;
    const unitsRaw = Array.isArray(s.units) ? s.units : [];
    return {
      id: String(s.id ?? "?"),
      title: typeof s.title === "string" ? s.title : "",
      units: unitsRaw.map((unit) => {
        const u = unit as Record<string, unknown>;
        return {
          id: String(u.id ?? "?"),
          state: String(u.state ?? "?"),
          readiness: String(u.readiness ?? "?"),
          blockedBy: asStringArray(u.blockedBy),
        };
      }),
    };
  });

  const childrenRaw = Array.isArray(o.children) ? o.children : [];
  const children = childrenRaw.map((child) => {
    const c = child as Record<string, unknown>;
    return {
      id: String(c.id ?? "?"),
      state: String(c.state ?? "?"),
      dependsOn: asStringArray(c.dependsOn),
      touches: asStringArray(c.touches),
      isolation: typeof c.isolation === "string" ? c.isolation : null,
      branch: typeof c.branch === "string" ? c.branch : null,
      worktreePath:
        typeof c.worktreePath === "string" ? c.worktreePath : null,
      evidence: typeof c.evidence === "string" ? c.evidence : null,
      ref: typeof c.ref === "string" ? c.ref : null,
      verifyMd: Boolean(c.verifyMd),
      handoffMd: Boolean(c.handoffMd),
    };
  });

  return {
    id: o.id,
    path: o.path,
    contractEpoch:
      typeof o.contractEpoch === "number" || typeof o.contractEpoch === "string"
        ? o.contractEpoch
        : null,
    executionTopology:
      typeof o.executionTopology === "string" ? o.executionTopology : null,
    mergeLimit: typeof o.mergeLimit === "number" ? o.mergeLimit : null,
    stages,
    children,
    integrationQueue: Array.isArray(o.integrationQueue)
      ? o.integrationQueue
      : [],
    stageErrors: asStringArray(o.stageErrors),
    legacyStages: Boolean(o.legacyStages),
  };
}

/**
 * Load Trellis parent snapshot via `python ./.cstl/scripts/task.py parent-status --json`.
 */
export async function loadTrellisParentSnapshot(
  parentDir: string,
  options: { python?: string; harnessRoot?: string } = {},
): Promise<CampaignParentSnapshot> {
  const resolvedParent = path.resolve(parentDir);
  if (!fs.existsSync(resolvedParent)) {
    throw new Error(`Parent directory not found: ${resolvedParent}`);
  }

  const harnessRoot =
    options.harnessRoot ??
    findHarnessRoot(resolvedParent) ??
    findHarnessRoot(process.cwd());
  if (!harnessRoot) {
    throw new Error(
      "Could not locate harness root (.cstl/scripts/task.py). Pass an absolute parent under a Trellis harness.",
    );
  }

  const script = path.join(harnessRoot, ".cstl", "scripts", "task.py");
  const python = options.python ?? process.env.TRELLIS_PYTHON ?? "python";
  const { stdout, stderr } = await execFileAsync(
    python,
    [script, "parent-status", resolvedParent, "--json"],
    {
      cwd: harnessRoot,
      windowsHide: true,
      maxBuffer: 4 * 1024 * 1024,
    },
  );

  if (stderr?.trim()) {
    // parent-status is quiet on success; keep stderr for debug only
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new Error(
      `Failed to parse parent-status --json output from ${script}`,
    );
  }
  return normalizeParentSnapshot(parsed);
}

export { normalizeParentSnapshot };
