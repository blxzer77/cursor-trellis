import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { findHarnessRoot } from "./trellis-load.js";
import type { CampaignStatusSnapshot } from "./types.js";

/**
 * Cursor project slug for `~/.cursor/projects/<slug>/`.
 * Example: `D:\\MyHarness` → `d-MyHarness`.
 */
export function cursorProjectSlug(absPath: string): string {
  const normalized = path.resolve(absPath).replace(/\\/g, "/");
  const win = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (win) {
    const drive = win[1]!.toLowerCase();
    const rest = win[2]!.replace(/\/+/g, "-").replace(/^-|-$/g, "");
    return rest ? `${drive}-${rest}` : drive;
  }
  return normalized.replace(/^\//, "").replace(/\/+/g, "-");
}

/**
 * Resolve the Cursor canvases directory for a harness root.
 * When harness is known, always returns `~/.cursor/projects/<slug>/canvases`
 * (directory need not exist yet — callers mkdir on write).
 * Returns null only when neither env override nor harness root is available.
 */
export function resolveCanvasesDir(harnessRoot: string | null): string | null {
  const fromEnv =
    process.env.TRELLIS_CAMPAIGN_CANVAS_DIR?.trim() ||
    process.env.CURSOR_CANVAS_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);

  if (!harnessRoot) return null;
  const slug =
    process.env.TRELLIS_CURSOR_PROJECT_SLUG?.trim() ||
    cursorProjectSlug(harnessRoot);
  const candidate = path.join(
    os.homedir(),
    ".cursor",
    "projects",
    slug,
    "canvases",
  );
  if (fs.existsSync(candidate)) return candidate;

  // Soft match unusual project folder names; if projects root is missing, still
  // return the candidate so write can mkdir.
  const projectsRoot = path.join(os.homedir(), ".cursor", "projects");
  if (fs.existsSync(projectsRoot)) {
    const soft = softMatchCanvasesDir(projectsRoot, slug, harnessRoot);
    if (soft) return soft;
  }
  return candidate;
}

/**
 * Soft-match `~/.cursor/projects/<name>/canvases` when the exact slug folder
 * is missing or differently cased / hyphenated.
 * Does **not** pick longer nested names (e.g. `d-MyHarness-Trellis` for harness
 * `D:\\MyHarness`) — those would steal writes from the canonical slug mkdir path.
 * Skips pure-numeric agent project ids.
 */
export function softMatchCanvasesDir(
  projectsRoot: string,
  slug: string,
  _harnessRoot: string,
): string | null {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
  } catch {
    return null;
  }
  const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  const slugLower = slug.toLowerCase();
  const slugNorm = slugLower.replace(/_/g, "-");

  const exact = dirs.find((n) => n.toLowerCase() === slugLower);
  if (exact) {
    return path.join(projectsRoot, exact, "canvases");
  }

  // Same path slug with `_` vs `-` (or mixed), not a longer nested project name.
  const normalized = dirs.find((n) => {
    const lower = n.toLowerCase();
    if (/^\d+$/.test(lower)) return false;
    return lower.replace(/_/g, "-") === slugNorm;
  });
  if (normalized) {
    return path.join(projectsRoot, normalized, "canvases");
  }

  return null;
}

/** True when `absPath` is under `canvasDir` (Windows case-insensitive). */
export function isUnderCanvasDir(
  absPath: string,
  canvasDir: string | null,
): boolean {
  if (!canvasDir) return false;
  const file = path.resolve(absPath);
  const root = path.resolve(canvasDir);
  if (process.platform === "win32") {
    const f = file.toLowerCase();
    const r = root.toLowerCase().replace(/[/\\]+$/, "");
    return f.startsWith(`${r}\\`) || f.startsWith(`${r}/`);
  }
  const rel = path.relative(root, file);
  return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
}

/**
 * Heuristic: path sits under `~/.cursor/projects/<any>/canvases/` even when
 * `resolveCanvasesDir` returned null (no harness / no env).
 */
export function looksLikeCursorCanvasesPath(absPath: string): boolean {
  const normalized = path.resolve(absPath).replace(/\\/g, "/").toLowerCase();
  return /\/\.cursor\/projects\/[^/]+\/canvases\//.test(`${normalized}/`);
}

export type CanvasWriteEvaluation = {
  underCanvasDir: boolean;
  usedWorkspaceFallback: boolean;
  warnings: string[];
  hints: string[];
};

const OPEN_HINT =
  "Open this file in Cursor Canvas view (not a normal text editor). " +
  "Cursor only renders .canvas.tsx under ~/.cursor/projects/<slug>/canvases/ " +
  "(or TRELLIS_CAMPAIGN_CANVAS_DIR / CURSOR_CANVAS_DIR). " +
  "Opening outside that folder in a normal editor shows source only — no graphics. " +
  "Use --open to best-effort launch Cursor on the file; use --quiet to suppress hints.";

/**
 * Evaluate write destination for warnings/hints after `campaign canvas` succeeds.
 * Does not change exit code; callers print warnings on stderr.
 */
export function evaluateCanvasWritePath(
  absOut: string,
  canvasDir: string | null,
  opts?: { usedWorkspaceFallback?: boolean },
): CanvasWriteEvaluation {
  const underCanvasDir =
    isUnderCanvasDir(absOut, canvasDir) || looksLikeCursorCanvasesPath(absOut);
  const usedWorkspaceFallback = opts?.usedWorkspaceFallback === true;
  const warnings: string[] = [];
  if (!underCanvasDir) {
    warnings.push(
      "⚠ Warning: output is outside the Cursor canvases directory" +
        (canvasDir ? ` (${canvasDir})` : "") +
        ". Opening this path in a normal editor shows TypeScript source only — no Canvas UI.",
    );
  }
  if (usedWorkspaceFallback) {
    warnings.push(
      "⚠ Warning: fell back to .cstl/workspace/campaign-status/ because no harness root " +
        "and no TRELLIS_CAMPAIGN_CANVAS_DIR / CURSOR_CANVAS_DIR were available. " +
        "Prefer the default path under ~/.cursor/projects/<slug>/canvases/.",
    );
  }
  return {
    underCanvasDir,
    usedWorkspaceFallback,
    warnings,
    hints: [OPEN_HINT],
  };
}

export type CanvasOpenAttempt = {
  attempted: boolean;
  ok: boolean;
  detail: string;
};

/**
 * Best-effort open of a `.canvas.tsx` via the Cursor CLI (`cursor` / `CURSOR_BIN`).
 * Does not guarantee Canvas view (IDE may open as text); callers still print hints.
 */
export function resolveCursorCliBin(): string | null {
  const fromEnv = process.env.CURSOR_BIN?.trim();
  if (fromEnv) return fromEnv;
  try {
    const finder = process.platform === "win32" ? "where.exe" : "which";
    const out = execFileSync(finder, ["cursor"], {
      encoding: "utf8",
      windowsHide: true,
    });
    const first = out
      .split(/\r?\n/)
      .map((s) => s.trim())
      .find(Boolean);
    return first ?? null;
  } catch {
    return null;
  }
}

export function tryOpenCanvasFile(absPath: string): CanvasOpenAttempt {
  const abs = path.resolve(absPath);
  const bin = resolveCursorCliBin();
  if (!bin) {
    return {
      attempted: true,
      ok: false,
      detail:
        "Cursor CLI not found on PATH (set CURSOR_BIN or install the `cursor` shell command)",
    };
  }
  try {
    const child = spawn(bin, [abs], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
      shell: process.platform === "win32",
    });
    child.unref();
    return {
      attempted: true,
      ok: true,
      detail: `spawned ${bin} ${abs}`,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return {
      attempted: true,
      ok: false,
      detail: `failed to spawn Cursor CLI (${bin}): ${msg}`,
    };
  }
}

export function shouldAutoOpenCanvas(opts?: {
  open?: boolean;
}): boolean {
  if (opts?.open === true) return true;
  const env = process.env.TRELLIS_CAMPAIGN_CANVAS_OPEN?.trim().toLowerCase();
  return env === "1" || env === "true" || env === "yes";
}

export function resolveHarnessForCanvas(parentDir: string): string | null {
  return findHarnessRoot(parentDir) ?? findHarnessRoot(process.cwd());
}

export function defaultCanvasPath(
  snapshot: CampaignStatusSnapshot,
  parentDir: string,
): string {
  const harness = resolveHarnessForCanvas(parentDir);
  const canvases = resolveCanvasesDir(harness);
  const fileName = `campaign-${snapshot.parent.id}.canvas.tsx`;
  if (canvases) {
    return path.join(canvases, fileName);
  }
  // Last resort: no harness and no env canvas dir.
  const base = path.join(process.cwd(), ".cstl", "workspace", "campaign-status");
  return path.join(base, fileName);
}

/** Whether `defaultCanvasPath` would use the workspace fallback for this parent. */
export function defaultCanvasUsesWorkspaceFallback(parentDir: string): boolean {
  const harness = resolveHarnessForCanvas(parentDir);
  return resolveCanvasesDir(harness) === null;
}

/** Escape a JSON text so it is safe as a JS/TS expression. */
function jsonAsTsLiteral(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Render a single-file Cursor Canvas (`.canvas.tsx`) with embedded snapshot.
 * Imports only `cursor/canvas`; no fetch / network.
 */
export function renderCampaignCanvasTsx(
  snapshot: CampaignStatusSnapshot,
): string {
  const dataLiteral = jsonAsTsLiteral(snapshot);
  return `import {
  Callout,
  Card,
  CardBody,
  CardHeader,
  Grid,
  H1,
  H2,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  useHostTheme,
} from "cursor/canvas";

/** Embedded campaign MIX snapshot — refresh via \\\`cstl campaign canvas\\\`. */
const DATA = ${dataLiteral};

type Snapshot = typeof DATA;
type Child = Snapshot["parent"]["children"][number];
type Stage = Snapshot["parent"]["stages"][number];
type RpcClient = Snapshot["rpc"]["clients"][number];

function stateTone(
  state: string,
): "neutral" | "success" | "warning" | "info" | "deleted" {
  const s = state.toLowerCase();
  if (s === "integrated" || s === "done" || s === "completed") return "success";
  if (s === "working" || s === "in_progress" || s === "integrating") return "info";
  if (s === "blocked" || s === "failed") return "deleted";
  if (s === "review" || s === "changes") return "warning";
  return "neutral";
}

export default function CampaignStatusCanvas() {
  const theme = useHostTheme();
  const parent = DATA.parent;
  const rpc = DATA.rpc;

  const stageRows = parent.stages.flatMap((stage: Stage) =>
    stage.units.map((unit) => [
      stage.id,
      stage.title || "—",
      unit.id,
      <Pill key={\`\${stage.id}-\${unit.id}-st\`} tone={stateTone(unit.state)} size="sm">
        {unit.state}
      </Pill>,
      unit.readiness,
    ]),
  );

  const childRows = parent.children.map((child: Child) => [
    child.id,
    <Pill key={\`\${child.id}-st\`} tone={stateTone(child.state)} size="sm">
      {child.state}
    </Pill>,
    child.dependsOn.length ? child.dependsOn.join(", ") : "—",
    child.ref ?? "—",
  ]);

  const clientRows = rpc.clients.map((c: RpcClient) => [
    c.kind,
    c.id,
    <Pill key={\`\${c.kind}-\${c.id}\`} tone="info" size="sm">
      {c.capLabel}
    </Pill>,
    c.campaignId ?? "—",
    c.lastSeenAt ?? "—",
  ]);

  return (
    <Stack gap={20} style={{ padding: 20, maxWidth: 1100 }}>
      <Stack gap={8}>
        <H1>Campaign — {parent.id}</H1>
        <Text style={{ color: theme.text.secondary, fontSize: 12 }}>
          Generated {DATA.generatedAt} · path {parent.path}
        </Text>
        <Text style={{ color: theme.text.tertiary, fontSize: 12 }}>
          Source: Trellis parent-status + optional RPC /status · read-only MIX
        </Text>
      </Stack>

      <Grid columns={4} gap={12}>
        <Stat value={String(parent.contractEpoch ?? "?")} label="contract_epoch" />
        <Stat
          value={String(parent.executionTopology ?? "?")}
          label="execution_topology"
        />
        <Stat value={String(parent.mergeLimit ?? "?")} label="merge_limit" />
        <Stat
          value={rpc.reachable ? "up" : "down"}
          label="RPC broker"
          tone={rpc.reachable ? "success" : "danger"}
        />
      </Grid>

      {stageRows.length > 0 ? (
        <Stack gap={8}>
          <H2>Stages</H2>
          <Table
            headers={["Stage", "Title", "Unit", "State", "Readiness"]}
            rows={stageRows}
          />
        </Stack>
      ) : null}

      {childRows.length > 0 ? (
        <Stack gap={8}>
          <H2>Children</H2>
          <Table
            headers={["Child", "State", "depends_on", "ref"]}
            rows={childRows}
          />
        </Stack>
      ) : null}

      <Card>
        <CardHeader>RPC broker</CardHeader>
        <CardBody>
          <Stack gap={12}>
            <Row gap={8} align="center">
              <Text style={{ fontSize: 12 }}>URL</Text>
              <Text style={{ color: theme.text.secondary, fontSize: 12 }}>
                {rpc.url}
              </Text>
            </Row>
            {!rpc.reachable ? (
              <Callout tone="warning" title="Broker unreachable">
                {rpc.error ?? "reachable: false — Trellis stages/children still shown."}
              </Callout>
            ) : null}
            {clientRows.length > 0 ? (
              <Table
                headers={["kind", "id", "capLabel", "campaignId", "lastSeenAt"]}
                rows={clientRows}
              />
            ) : null}
            {rpc.topics.length > 0 ? (
              <Text style={{ color: theme.text.secondary, fontSize: 12 }}>
                Topics: {rpc.topics.join(", ")}
              </Text>
            ) : null}
          </Stack>
        </CardBody>
      </Card>

      {DATA.notes.length > 0 ? (
        <Stack gap={6}>
          <H2>Notes</H2>
          {DATA.notes.map((note: string) => (
            <Text key={note} style={{ color: theme.text.secondary, fontSize: 12 }}>
              {note}
            </Text>
          ))}
        </Stack>
      ) : null}

      <Text style={{ color: theme.text.tertiary, fontSize: 12 }}>
        Refresh: cstl campaign canvas --parent {parent.path}
      </Text>
    </Stack>
  );
}
`;
}

export function writeCampaignCanvas(
  snapshot: CampaignStatusSnapshot,
  outPath: string,
): string {
  const abs = path.resolve(outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, renderCampaignCanvasTsx(snapshot), "utf8");
  return abs;
}
