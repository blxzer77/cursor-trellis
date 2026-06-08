import {
  clearChannelTitle,
  setChannelTitle,
  type ChannelScope,
} from "@mindfoldhq/trellis-core/channel";

import { parseChannelScope } from "./store/schema.js";

export interface TitleSetCliOptions {
  as?: string;
  title: string;
  scope?: string;
}

export interface TitleClearCliOptions {
  as?: string;
  scope?: string;
}

export async function channelTitleSet(
  channelName: string,
  opts: TitleSetCliOptions,
): Promise<void> {
  const scope: ChannelScope | undefined = parseChannelScope(opts.scope);
  const event = await setChannelTitle({
    channel: channelName,
    by: opts.as ?? "main",
    title: opts.title,
    ...(scope !== undefined ? { scope } : {}),
    origin: "cli",
  });
  console.log(JSON.stringify(event));
}

export async function channelTitleClear(
  channelName: string,
  opts: TitleClearCliOptions,
): Promise<void> {
  const scope: ChannelScope | undefined = parseChannelScope(opts.scope);
  const event = await clearChannelTitle({
    channel: channelName,
    by: opts.as ?? "main",
    ...(scope !== undefined ? { scope } : {}),
    origin: "cli",
  });
  console.log(JSON.stringify(event));
}
