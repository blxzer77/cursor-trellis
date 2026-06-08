import {
  addChannelContext,
  addThreadContext,
  buildContextEntries,
  deleteChannelContext,
  deleteThreadContext,
  listChannelContext,
  listThreadContext,
  type ChannelScope,
} from "@mindfoldhq/trellis-core/channel";

import { parseChannelScope } from "./store/schema.js";

export interface ContextMutateCliOptions {
  as?: string;
  scope?: string;
  thread?: string;
  file?: string[];
  raw?: string[];
}

export interface ContextListCliOptions {
  scope?: string;
  thread?: string;
  raw?: boolean;
}

export async function channelContextAdd(
  channelName: string,
  opts: ContextMutateCliOptions,
): Promise<void> {
  const context = buildContextEntries(opts.file, opts.raw);
  if (!context) {
    throw new Error("Provide at least one --file <abs-path> or --raw <text>");
  }
  const scope: ChannelScope | undefined = parseChannelScope(opts.scope);
  const event = opts.thread
    ? await addThreadContext({
        channel: channelName,
        by: opts.as ?? "main",
        thread: opts.thread,
        context,
        ...(scope !== undefined ? { scope } : {}),
        origin: "cli",
      })
    : await addChannelContext({
        channel: channelName,
        by: opts.as ?? "main",
        context,
        ...(scope !== undefined ? { scope } : {}),
        origin: "cli",
      });
  console.log(JSON.stringify(event));
}

export async function channelContextDelete(
  channelName: string,
  opts: ContextMutateCliOptions,
): Promise<void> {
  const context = buildContextEntries(opts.file, opts.raw);
  if (!context) {
    throw new Error("Provide at least one --file <abs-path> or --raw <text>");
  }
  const scope: ChannelScope | undefined = parseChannelScope(opts.scope);
  const event = opts.thread
    ? await deleteThreadContext({
        channel: channelName,
        by: opts.as ?? "main",
        thread: opts.thread,
        context,
        ...(scope !== undefined ? { scope } : {}),
        origin: "cli",
      })
    : await deleteChannelContext({
        channel: channelName,
        by: opts.as ?? "main",
        context,
        ...(scope !== undefined ? { scope } : {}),
        origin: "cli",
      });
  console.log(JSON.stringify(event));
}

export async function channelContextList(
  channelName: string,
  opts: ContextListCliOptions,
): Promise<void> {
  const scope: ChannelScope | undefined = parseChannelScope(opts.scope);
  const entries = opts.thread
    ? await listThreadContext({
        channel: channelName,
        thread: opts.thread,
        ...(scope !== undefined ? { scope } : {}),
      })
    : await listChannelContext({
        channel: channelName,
        ...(scope !== undefined ? { scope } : {}),
      });
  if (opts.raw) {
    for (const entry of entries) console.log(JSON.stringify(entry));
    return;
  }
  if (entries.length === 0) {
    console.log("(no context)");
    return;
  }
  for (const entry of entries) {
    if (entry.type === "file") {
      console.log(`file ${entry.path}`);
    } else {
      const oneLine = entry.text.replace(/\s+/g, " ").trim();
      const display =
        oneLine.length > 200 ? `${oneLine.slice(0, 200)}…` : oneLine;
      console.log(`raw  ${display}`);
    }
  }
}
