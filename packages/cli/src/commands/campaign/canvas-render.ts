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

function resolveCanvasesDir(harnessRoot: string | null): string | null {
  const fromEnv =
    process.env.TRELLIS_CAMPAIGN_CANVAS_DIR?.trim() ||
    process.env.CURSOR_CANVAS_DIR?.trim();
  if (fromEnv) return path.resolve(fromEnv);

  if (!harnessRoot) return null;
  const slug = cursorProjectSlug(harnessRoot);
  const candidate = path.join(
    os.homedir(),
    ".cursor",
    "projects",
    slug,
    "canvases",
  );
  if (fs.existsSync(candidate)) return candidate;

  // Soft match: any project dir whose name ends with the slug or contains harness basename
  const projectsRoot = path.join(os.homedir(), ".cursor", "projects");
  if (!fs.existsSync(projectsRoot)) return null;
  try {
    const entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
    const exact = entries.find(
      (e) => e.isDirectory() && e.name.toLowerCase() === slug.toLowerCase(),
    );
    if (exact) {
      return path.join(projectsRoot, exact.name, "canvases");
    }
  } catch {
    // ignore
  }
  return candidate;
}

export function defaultCanvasPath(
  snapshot: CampaignStatusSnapshot,
  parentDir: string,
): string {
  const harness =
    findHarnessRoot(parentDir) ?? findHarnessRoot(process.cwd());
  const canvases = resolveCanvasesDir(harness);
  const fileName = `campaign-${snapshot.parent.id}.canvas.tsx`;
  if (canvases) {
    return path.join(canvases, fileName);
  }
  const base = harness
    ? path.join(harness, ".cstl", "workspace", "campaign-status")
    : path.join(process.cwd(), ".cstl", "workspace", "campaign-status");
  return path.join(base, fileName);
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
