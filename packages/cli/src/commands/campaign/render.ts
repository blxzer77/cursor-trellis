import fs from "node:fs";
import path from "node:path";

import { findHarnessRoot } from "./trellis-load.js";
import type { CampaignStatusSnapshot } from "./types.js";

export function renderCampaignStatusMarkdown(
  snapshot: CampaignStatusSnapshot,
): string {
  const lines: string[] = [
    `# Campaign status — \`${snapshot.parent.id}\``,
    "",
    `- Generated: \`${snapshot.generatedAt}\``,
    `- Parent path: \`${snapshot.parent.path}\``,
    `- contract_epoch: ${snapshot.parent.contractEpoch ?? "?"}`,
    `- execution_topology: ${snapshot.parent.executionTopology ?? "?"}`,
    `- merge_limit: ${snapshot.parent.mergeLimit ?? "?"}`,
    "",
    "## Notes",
    "",
    ...snapshot.notes.map((n) => `- ${n}`),
    "",
    "## Stages (Trellis)",
    "",
  ];

  if (snapshot.parent.stages.length === 0) {
    lines.push("(no stages)");
    lines.push("");
  } else {
    for (const stage of snapshot.parent.stages) {
      const title = stage.title ? ` — ${stage.title}` : "";
      lines.push(`### \`${stage.id}\`${title}`);
      for (const unit of stage.units) {
        const blocked =
          unit.readiness === "blocked" && unit.blockedBy.length > 0
            ? ` — blocked (${unit.blockedBy.join(", ")})`
            : "";
        lines.push(
          `- \`${unit.id}\` — \`${unit.state}\` — ${unit.readiness}${blocked}`,
        );
      }
      lines.push("");
    }
  }

  lines.push("## Children", "");
  for (const child of snapshot.parent.children) {
    lines.push(`### \`${child.id}\` — \`${child.state}\``);
    if (child.dependsOn.length) {
      lines.push(`- depends_on: ${child.dependsOn.join(", ")}`);
    }
    if (child.ref) lines.push(`- ref: ${child.ref}`);
    if (child.evidence) lines.push(`- evidence: ${child.evidence}`);
    lines.push("");
  }

  lines.push("## RPC broker", "");
  lines.push(`- URL: \`${snapshot.rpc.url}\``);
  lines.push(`- reachable: **${snapshot.rpc.reachable}**`);
  if (snapshot.rpc.protocolVersion !== undefined) {
    lines.push(`- protocolVersion: ${snapshot.rpc.protocolVersion}`);
  }
  if (snapshot.rpc.error) {
    lines.push(`- error: \`${snapshot.rpc.error}\``);
  }
  lines.push("");

  if (snapshot.rpc.clients.length === 0) {
    lines.push("(no registered clients)");
    lines.push("");
  } else {
    lines.push("| kind | id | capLabel | campaignId | lastSeenAt |");
    lines.push("| --- | --- | --- | --- | --- |");
    for (const c of snapshot.rpc.clients) {
      lines.push(
        `| \`${c.kind}\` | \`${c.id}\` | **${c.capLabel}** | ${c.campaignId ?? "—"} | ${c.lastSeenAt ?? "—"} |`,
      );
    }
    lines.push("");
  }

  if (snapshot.rpc.topics.length > 0) {
    lines.push("### Topics");
    lines.push("");
    for (const t of snapshot.rpc.topics) {
      lines.push(`- \`${t}\``);
    }
    lines.push("");
  }

  lines.push("## Suggested Parent commands", "");
  lines.push("```bash");
  lines.push(
    `python ./.cstl/scripts/task.py parent-status ${snapshot.parent.path}`,
  );
  lines.push(
    `python ./.cstl/scripts/task.py publish-pack ${snapshot.parent.path}`,
  );
  lines.push("```");
  lines.push("");
  lines.push(
    "Open this file in Cursor via `open_resource` (cursor-app-control MCP).",
  );
  lines.push("");

  return lines.join("\n");
}

export function defaultPanelPath(
  snapshot: CampaignStatusSnapshot,
  parentDir: string,
): string {
  const harness =
    findHarnessRoot(parentDir) ?? findHarnessRoot(process.cwd());
  const base = harness
    ? path.join(harness, ".cstl", "workspace", "campaign-status")
    : path.join(process.cwd(), ".cstl", "workspace", "campaign-status");
  return path.join(base, `campaign-status-${snapshot.parent.id}.md`);
}

export function writeCampaignPanel(
  snapshot: CampaignStatusSnapshot,
  outPath: string,
): string {
  const abs = path.resolve(outPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, renderCampaignStatusMarkdown(snapshot), "utf8");
  return abs;
}
