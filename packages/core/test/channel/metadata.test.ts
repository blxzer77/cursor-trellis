import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  addChannelContext,
  clearChannelTitle,
  createChannel,
  deleteChannelContext,
  listChannelContext,
  parseChannelType,
  readChannelEvents,
  readChannelMetadata,
  reduceChannelMetadata,
  sendMessage,
  setChannelTitle,
} from "../../src/channel/index.js";
import { setupChannelTmp, type TmpEnv } from "./setup.js";

describe("reduceChannelMetadata", () => {
  let env: TmpEnv;
  beforeEach(() => {
    env = setupChannelTmp();
    vi.spyOn(process, "cwd").mockReturnValue(env.projectDir);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    env.cleanup();
  });

  it("projects type/description/labels/context from create event", async () => {
    await createChannel({
      channel: "meta",
      by: "main",
      type: "forum",
      description: "Test feed",
      labels: ["x", "y"],
      context: [
        { type: "file", path: "/abs/a.md" },
        { type: "raw", text: "note" },
      ],
    });
    const md = await readChannelMetadata({ channel: "meta" });
    expect(md).toMatchObject({
      type: "forum",
      description: "Test feed",
      labels: ["x", "y"],
    });
    expect(md.context).toHaveLength(2);
    expect(md.title).toBeUndefined();
  });

  it("does not normalize legacy type:'thread'/'threads' to 'forum'", () => {
    const fromThread = reduceChannelMetadata([
      {
        seq: 1,
        ts: "2026-05-13T00:00:00.000Z",
        kind: "create",
        by: "main",
        type: "thread",
      },
    ]);
    const fromThreads = reduceChannelMetadata([
      {
        seq: 1,
        ts: "2026-05-13T00:00:00.000Z",
        kind: "create",
        by: "main",
        type: "threads",
      },
    ]);
    expect(fromThread.type).toBe("chat");
    expect(fromThreads.type).toBe("chat");
  });

  it("reads legacy linkedContext into normalized context", () => {
    const md = reduceChannelMetadata([
      {
        seq: 1,
        ts: "2026-05-13T00:00:00.000Z",
        kind: "create",
        by: "main",
        type: "forum",
        linkedContext: [
          { type: "file", path: "/abs/legacy.md" },
          { type: "raw", text: "legacy" },
        ],
      },
    ]);
    expect(md.context).toEqual([
      { type: "file", path: "/abs/legacy.md" },
      { type: "raw", text: "legacy" },
    ]);
  });

  it("rejects '--type thread'/'--type threads' with helpful error", () => {
    expect(() => parseChannelType("thread")).toThrow(/Use '--type forum'/);
    expect(() => parseChannelType("threads")).toThrow(/Use '--type forum'/);
  });

  it("rejects legacy type values at the core create boundary", async () => {
    await expect(
      createChannel({
        channel: "legacy-thread",
        by: "main",
        type: "thread" as "forum",
      }),
    ).rejects.toThrow(/Use '--type forum'/);
    await expect(
      createChannel({
        channel: "legacy-threads",
        by: "main",
        type: "threads" as "forum",
      }),
    ).rejects.toThrow(/Use '--type forum'/);
  });

  it("projects channel-level context add/delete", async () => {
    await createChannel({ channel: "ctx", by: "main", type: "forum" });
    await addChannelContext({
      channel: "ctx",
      by: "main",
      context: [{ type: "raw", text: "first" }],
    });
    await addChannelContext({
      channel: "ctx",
      by: "main",
      context: [{ type: "file", path: "/abs/two.md" }],
    });
    let listed = await listChannelContext({ channel: "ctx" });
    expect(listed).toHaveLength(2);

    await deleteChannelContext({
      channel: "ctx",
      by: "main",
      context: [{ type: "raw", text: "first" }],
    });
    listed = await listChannelContext({ channel: "ctx" });
    expect(listed).toEqual([{ type: "file", path: "/abs/two.md" }]);

    // raw event log retains the full history
    const events = await readChannelEvents({ channel: "ctx" });
    expect(events.filter((e) => e.kind === "context")).toHaveLength(3);
  });

  it("projects channel title set/clear", async () => {
    await createChannel({ channel: "named", by: "main", type: "forum" });
    await setChannelTitle({
      channel: "named",
      by: "main",
      title: "Readable Title",
    });
    let md = await readChannelMetadata({ channel: "named" });
    expect(md.title).toBe("Readable Title");

    await clearChannelTitle({ channel: "named", by: "main" });
    md = await readChannelMetadata({ channel: "named" });
    expect(md.title).toBeUndefined();
  });

  it("validates origin and meta at the event boundary", async () => {
    await createChannel({ channel: "base-validation", by: "main" });
    await expect(
      sendMessage({
        channel: "base-validation",
        by: "main",
        text: "invalid origin",
        origin: "bad-origin" as "cli",
      }),
    ).rejects.toThrow(/Invalid origin/);
    await expect(
      sendMessage({
        channel: "base-validation",
        by: "main",
        text: "invalid meta",
        meta: [] as unknown as Record<string, unknown>,
      }),
    ).rejects.toThrow(/meta must be a plain JSON object/);
    await expect(
      sendMessage({
        channel: "base-validation",
        by: "main",
        text: "invalid meta null",
        meta: null as unknown as Record<string, unknown>,
      }),
    ).rejects.toThrow(/meta must be a plain JSON object/);
    await expect(
      sendMessage({
        channel: "base-validation",
        by: "main",
        text: "invalid meta primitive",
        meta: "x" as unknown as Record<string, unknown>,
      }),
    ).rejects.toThrow(/meta must be a plain JSON object/);
  });
});
