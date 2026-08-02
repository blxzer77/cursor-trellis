import path from "node:path";

import { type Command } from "commander";

import { resolveRpcUrl } from "../rpc/client.js";
import { composeCampaignStatus } from "./compose.js";
import { runCampaignMcpServer } from "./mcp-server.js";
import {
  defaultPanelPath,
  renderCampaignStatusMarkdown,
  writeCampaignPanel,
} from "./render.js";

export { composeCampaignStatus } from "./compose.js";
export { capLabelForKind } from "./kind-map.js";
export {
  renderCampaignStatusMarkdown,
  writeCampaignPanel,
} from "./render.js";
export { loadTrellisParentSnapshot } from "./trellis-load.js";
export type { CampaignStatusSnapshot } from "./types.js";

function resolveParentDir(explicit?: string): string {
  const fromArg = explicit?.trim();
  if (fromArg) return path.resolve(fromArg);
  const fromEnv = process.env.TRELLIS_CAMPAIGN_PARENT?.trim();
  if (fromEnv) return path.resolve(fromEnv);
  throw new Error(
    "Missing parent task directory. Pass --parent <dir> or set TRELLIS_CAMPAIGN_PARENT.",
  );
}

/**
 * Register `cstl campaign` — Cursor MIX observation (CMD + MCP).
 * Read-only; never auto-approves Trellis HITL gates.
 */
export function registerCampaignCommand(program: Command): void {
  const campaign = program
    .command("campaign")
    .description(
      "Campaign observation MIX (CMD + MCP). Trellis task-map + optional RPC status. Read-only; no HITL bypass. Canvas Should deferred.",
    );

  campaign
    .command("status")
    .description(
      "Compose campaign status (Trellis parent-status + RPC /status when reachable)",
    )
    .option("--parent <dir>", "Parent task directory (or TRELLIS_CAMPAIGN_PARENT)")
    .option("--url <url>", "RPC broker base URL (or TRELLIS_RPC_URL)")
    .option("--json", "Print JSON snapshot")
    .option(
      "--panel",
      "Write Markdown panel and print absolute path for open_resource",
    )
    .option("--panel-out <path>", "Panel output path (implies --panel)")
    .action(
      async (opts: {
        parent?: string;
        url?: string;
        json?: boolean;
        panel?: boolean;
        panelOut?: string;
      }) => {
        try {
          const parentDir = resolveParentDir(opts.parent);
          const snapshot = await composeCampaignStatus({
            parentDir,
            rpcUrl: opts.url,
          });

          const panelOut = opts.panelOut?.trim();
          const wantPanel = opts.panel === true || Boolean(panelOut);
          if (wantPanel) {
            const out = panelOut ?? defaultPanelPath(snapshot, parentDir);
            const abs = writeCampaignPanel(snapshot, out);
            console.log(abs);
          }

          if (opts.json) {
            console.log(JSON.stringify(snapshot, null, 2));
          } else if (!wantPanel) {
            console.log(renderCampaignStatusMarkdown(snapshot));
          }
        } catch (error) {
          console.error(
            error instanceof Error ? error.message : String(error),
          );
          process.exitCode = 1;
        }
      },
    );

  campaign
    .command("mcp")
    .description(
      "Stdio MCP server exposing tool campaign_status (read-only). Configure as trellis-campaign in .cursor/mcp.json.",
    )
    .option("--parent <dir>", "Default parent (sets TRELLIS_CAMPAIGN_PARENT)")
    .option("--url <url>", "Default RPC URL (sets TRELLIS_RPC_URL for process)")
    .action(async (opts: { parent?: string; url?: string }) => {
      if (opts.parent?.trim()) {
        process.env.TRELLIS_CAMPAIGN_PARENT = path.resolve(opts.parent.trim());
      }
      if (opts.url?.trim()) {
        process.env.TRELLIS_RPC_URL = resolveRpcUrl(opts.url);
      }
      await runCampaignMcpServer();
    });
}
