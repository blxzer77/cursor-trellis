import {
  buildContextEntries,
  createChannel as coreCreateChannel,
  resolveChannelRef,
  type ChannelScope,
  type ChannelType,
} from "@mindfoldhq/trellis-core/channel";

import {
  parseChannelScope,
  parseChannelType,
  parseCsv,
} from "./store/schema.js";

export interface CreateOptions {
  task?: string;
  project?: string;
  labels?: string;
  cwd?: string;
  scope?: string;
  type?: string;
  description?: string;
  /** New canonical flag list. */
  contextFile?: string[];
  contextRaw?: string[];
  /** Legacy aliases accepted while users migrate scripts. */
  linkedContextFile?: string[];
  linkedContextRaw?: string[];
  by?: string;
  force?: boolean;
  ephemeral?: boolean;
  /**
   * Optional mode marker for callers like `channel run` that produce
   * one-shot channels. Stored as `meta.trellis.createMode` so the
   * channel event keeps an `origin: "cli"` write entrypoint while still
   * exposing the mode for downstream consumers.
   */
  origin?: string;
}

export async function createChannel(
  name: string,
  opts: CreateOptions,
): Promise<void> {
  const scope: ChannelScope = parseChannelScope(opts.scope) ?? "project";
  const channelType: ChannelType = parseChannelType(opts.type);
  const context = buildContextEntries(
    [...(opts.contextFile ?? []), ...(opts.linkedContextFile ?? [])],
    [...(opts.contextRaw ?? []), ...(opts.linkedContextRaw ?? [])],
  );
  const labels = parseCsv(opts.labels);

  const createMode = opts.origin;

  const event = await coreCreateChannel({
    channel: name,
    by: opts.by ?? "main",
    scope,
    type: channelType,
    ...(opts.cwd ? { cwd: opts.cwd } : {}),
    ...(opts.task ? { task: opts.task } : {}),
    ...(opts.project ? { project: opts.project } : {}),
    ...(labels ? { labels } : {}),
    ...(opts.description ? { description: opts.description } : {}),
    ...(context ? { context } : {}),
    ...(opts.ephemeral ? { ephemeral: true } : {}),
    ...(opts.force ? { force: true } : {}),
    origin: "cli",
    ...(createMode ? { meta: { trellis: { createMode } } } : {}),
  });

  console.log(
    `Created channel '${name}' (${channelType}) at ${channelDirFromEvent(name, event.scope as ChannelScope, opts.cwd)}`,
  );
  if (opts.ephemeral) {
    process.stderr.write(
      "ephemeral channel is hidden from `channel list`; use `channel list --all` or `channel prune --ephemeral`\n",
    );
  }
}

function channelDirFromEvent(
  name: string,
  scope: ChannelScope,
  cwd: string | undefined,
): string {
  const ref = resolveChannelRef({
    channel: name,
    scope,
    forCreate: true,
    ...(cwd !== undefined ? { cwd } : {}),
  });
  return ref.dir;
}
