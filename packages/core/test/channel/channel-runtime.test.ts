import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  channelCursorKey,
  createChannel,
  interruptWorker,
  listWorkers,
  readChannelEvents,
  requestInterrupt,
  sendMessage,
  spawnWorker,
  watchChannels,
  watchWorkers,
  type CrossChannelEvent,
  type WorkerRuntime,
  type WorkerState,
} from "../../src/channel/index.js";
import { appendEvent } from "../../src/channel/internal/store/events.js";
import { setupChannelTmp, type TmpEnv } from "./setup.js";

const fakeRuntime: WorkerRuntime = {
  start: async (input) => ({
    workerId: input.workerId,
    provider: "claude",
    pid: 4242,
    startedAt: new Date().toISOString(),
  }),
  interrupt: async () => ({ method: "provider", outcome: "interrupted" }),
};

async function takeN<T>(
  gen: AsyncGenerator<T>,
  n: number,
  timeoutMs = 4000,
): Promise<T[]> {
  const out: T[] = [];
  const deadline = Date.now() + timeoutMs;
  while (out.length < n && Date.now() < deadline) {
    const next = await Promise.race([
      gen.next(),
      new Promise<{ done: true; value: undefined }>((r) =>
        setTimeout(() => r({ done: true, value: undefined }), 250),
      ),
    ]);
    if (next.done) {
      if (next.value === undefined) continue; // poll timeout, retry
      break;
    }
    out.push(next.value as T);
  }
  return out;
}

describe("readChannelEvents pagination", () => {
  let env: TmpEnv;
  beforeEach(() => {
    env = setupChannelTmp();
    vi.spyOn(process, "cwd").mockReturnValue(env.projectDir);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    env.cleanup();
  });

  async function seed(): Promise<void> {
    await createChannel({ channel: "c", by: "main" }); // seq 1
    for (let i = 0; i < 5; i++) {
      await sendMessage({ channel: "c", by: "main", text: `m${i}` }); // seq 2..6
    }
  }

  it("returns all events with no pagination options", async () => {
    await seed();
    const all = await readChannelEvents({ channel: "c" });
    expect(all).toHaveLength(6);
    expect(all.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("afterSeq returns events with seq > afterSeq ascending", async () => {
    await seed();
    const page = await readChannelEvents({ channel: "c", afterSeq: 3 });
    expect(page.map((e) => e.seq)).toEqual([4, 5, 6]);
  });

  it("beforeSeq returns events with seq < beforeSeq ascending", async () => {
    await seed();
    const page = await readChannelEvents({ channel: "c", beforeSeq: 4 });
    expect(page.map((e) => e.seq)).toEqual([1, 2, 3]);
  });

  it("limit alone returns the latest N events ascending", async () => {
    await seed();
    const page = await readChannelEvents({ channel: "c", limit: 2 });
    expect(page.map((e) => e.seq)).toEqual([5, 6]);
  });

  it("limit caps a cursor page", async () => {
    await seed();
    const page = await readChannelEvents({ channel: "c", afterSeq: 1, limit: 2 });
    expect(page.map((e) => e.seq)).toEqual([2, 3]);
  });

  it("rejects beforeSeq + afterSeq together", async () => {
    await seed();
    await expect(
      readChannelEvents({ channel: "c", afterSeq: 1, beforeSeq: 5 }),
    ).rejects.toThrow(/only one of/);
  });

  it("empty log returns empty under any option", async () => {
    await createChannel({ channel: "empty", by: "main" });
    const page = await readChannelEvents({ channel: "empty", afterSeq: 99 });
    expect(page).toEqual([]);
  });
});

describe("sendMessage delivery modes", () => {
  let env: TmpEnv;
  beforeEach(() => {
    env = setupChannelTmp();
    vi.spyOn(process, "cwd").mockReturnValue(env.projectDir);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    env.cleanup();
  });

  it("appendOnly never writes undeliverable (default)", async () => {
    await createChannel({ channel: "c", by: "main" });
    await sendMessage({ channel: "c", by: "main", text: "hi", to: "ghost" });
    const events = await readChannelEvents({ channel: "c" });
    expect(events.some((e) => e.kind === "undeliverable")).toBe(false);
  });

  it("requireKnownWorker signals undeliverable for unknown targets", async () => {
    await createChannel({ channel: "c", by: "main" });
    const msg = await sendMessage({
      channel: "c",
      by: "main",
      text: "hi",
      to: "ghost",
      deliveryMode: "requireKnownWorker",
    });
    const events = await readChannelEvents({ channel: "c" });
    const undeliverable = events.find((e) => e.kind === "undeliverable");
    expect(undeliverable).toMatchObject({
      targetWorker: "ghost",
      messageSeq: msg.seq,
      reason: "worker-unknown",
    });
  });

  it("requireRunningWorker signals undeliverable for terminal targets", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      { channel: "c", cwd: env.projectDir, by: "main", workerId: "w", systemPrompt: "x" },
      fakeRuntime,
    );
    await appendEvent("c", {
      kind: "killed",
      by: "cli:kill",
      worker: "w",
      reason: "explicit-kill",
    });
    const msg = await sendMessage({
      channel: "c",
      by: "main",
      text: "hi",
      to: "w",
      deliveryMode: "requireRunningWorker",
    });
    const events = await readChannelEvents({ channel: "c" });
    const undeliverable = events.find((e) => e.kind === "undeliverable");
    expect(undeliverable).toMatchObject({
      targetWorker: "w",
      messageSeq: msg.seq,
      reason: "worker-terminal",
    });
  });

  it("requireRunningWorker accepts a running worker", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      { channel: "c", cwd: env.projectDir, by: "main", workerId: "w", systemPrompt: "x" },
      fakeRuntime,
    );
    await sendMessage({
      channel: "c",
      by: "main",
      text: "hi",
      to: "w",
      deliveryMode: "requireRunningWorker",
    });
    const events = await readChannelEvents({ channel: "c" });
    expect(events.some((e) => e.kind === "undeliverable")).toBe(false);
  });

  it("requireRunningWorker still accepts a worker after a completed turn", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      { channel: "c", cwd: env.projectDir, by: "main", workerId: "w", systemPrompt: "x" },
      fakeRuntime,
    );
    await appendEvent("c", { kind: "done", by: "w" });
    await appendEvent("c", {
      kind: "turn_finished",
      by: "w",
      worker: "w",
      inputSeq: 2,
      turnId: "msg:2",
      outcome: "done",
    });
    await sendMessage({
      channel: "c",
      by: "main",
      text: "next",
      to: "w",
      deliveryMode: "requireRunningWorker",
    });
    const events = await readChannelEvents({ channel: "c" });
    expect(events.some((e) => e.kind === "undeliverable")).toBe(false);
  });

  it("strict mode does not flag broadcast messages", async () => {
    await createChannel({ channel: "c", by: "main" });
    await sendMessage({
      channel: "c",
      by: "main",
      text: "hi",
      deliveryMode: "requireRunningWorker",
    });
    const events = await readChannelEvents({ channel: "c" });
    expect(events.some((e) => e.kind === "undeliverable")).toBe(false);
  });
});

describe("spawnWorker / interrupt APIs", () => {
  let env: TmpEnv;
  beforeEach(() => {
    env = setupChannelTmp();
    vi.spyOn(process, "cwd").mockReturnValue(env.projectDir);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    env.cleanup();
  });

  it("spawnWorker starts via runtime and appends spawned with inboxPolicy", async () => {
    await createChannel({ channel: "c", by: "main" });
    const state = await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        provider: "claude",
        systemPrompt: "x",
        inboxPolicy: "broadcastAndExplicit",
      },
      fakeRuntime,
    );
    expect(state).toMatchObject({
      workerId: "w",
      lifecycle: "running",
      inboxPolicy: "broadcastAndExplicit",
    });
    const events = await readChannelEvents({ channel: "c" });
    const spawned = events.find((e) => e.kind === "spawned");
    expect(spawned).toMatchObject({
      as: "w",
      inboxPolicy: "broadcastAndExplicit",
      pid: 4242,
    });
  });

  it("requestInterrupt appends a durable-only interrupt_requested event", async () => {
    await createChannel({ channel: "c", by: "main" });
    const evt = await requestInterrupt({
      channel: "c",
      by: "main",
      workerId: "w",
      reason: "user",
    });
    expect(evt.kind).toBe("interrupt_requested");
    const events = await readChannelEvents({ channel: "c" });
    expect(events.filter((e) => e.kind === "interrupted")).toHaveLength(0);
  });

  it("interruptWorker orchestrates runtime interrupt and records outcome", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      { channel: "c", cwd: env.projectDir, by: "main", workerId: "w", systemPrompt: "x" },
      fakeRuntime,
    );
    const result = await interruptWorker(
      { channel: "c", by: "main", workerId: "w", reason: "user" },
      fakeRuntime,
    );
    expect(result.interrupted).toBe(true);
    expect(result.delivery).toBe("no-active-turn");
    const events = await readChannelEvents({ channel: "c" });
    expect(events.some((e) => e.kind === "interrupt_requested")).toBe(true);
    const interrupted = events.find((e) => e.kind === "interrupted");
    expect(interrupted).toMatchObject({
      worker: "w",
      method: "provider",
      outcome: "interrupted",
    });
  });

  it("interruptWorker reports worker-unknown and skips the runtime", async () => {
    await createChannel({ channel: "c", by: "main" });
    let called = false;
    const probe: WorkerRuntime = {
      start: fakeRuntime.start,
      interrupt: async () => {
        called = true;
        return { method: "provider", outcome: "interrupted" };
      },
    };
    const result = await interruptWorker(
      { channel: "c", by: "main", workerId: "ghost" },
      probe,
    );
    expect(result.delivery).toBe("worker-unknown");
    expect(result.interrupted).toBe(false);
    expect(called).toBe(false);
  });

  it("interruptWorker reports interrupted-current-turn for a mid-turn worker", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      { channel: "c", cwd: env.projectDir, by: "main", workerId: "w", systemPrompt: "x" },
      fakeRuntime,
    );
    await appendEvent("c", {
      kind: "turn_started",
      by: "w",
      worker: "w",
      inputSeq: 0,
      turnId: "t1",
    });
    const result = await interruptWorker(
      { channel: "c", by: "main", workerId: "w" },
      fakeRuntime,
    );
    expect(result.delivery).toBe("interrupted-current-turn");
  });
});

describe("listWorkers / watchWorkers", () => {
  let env: TmpEnv;
  beforeEach(() => {
    env = setupChannelTmp();
    vi.spyOn(process, "cwd").mockReturnValue(env.projectDir);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    env.cleanup();
  });

  it("listWorkers hides terminal workers by default", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      { channel: "c", cwd: env.projectDir, by: "main", workerId: "live", systemPrompt: "x" },
      fakeRuntime,
    );
    await spawnWorker(
      { channel: "c", cwd: env.projectDir, by: "main", workerId: "gone", systemPrompt: "x" },
      fakeRuntime,
    );
    await appendEvent("c", {
      kind: "killed",
      by: "cli:kill",
      worker: "gone",
      reason: "explicit-kill",
    });

    const active = await listWorkers({ channel: "c" });
    expect(active.map((w) => w.workerId)).toEqual(["live"]);

    const all = await listWorkers({ channel: "c", includeTerminal: true });
    expect(all.map((w) => w.workerId).sort()).toEqual(["gone", "live"]);
    expect(all.find((w) => w.workerId === "live")?.channel?.name).toBe("c");
  });

  it("listWorkers keeps a worker active after adapter done events", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      { channel: "c", cwd: env.projectDir, by: "main", workerId: "w", systemPrompt: "x" },
      fakeRuntime,
    );
    await appendEvent("c", { kind: "done", by: "w" });

    const active = await listWorkers({ channel: "c" });
    expect(active.map((w) => w.workerId)).toEqual(["w"]);
    expect(active[0]).toMatchObject({ lifecycle: "running", terminal: false });
  });

  it("watchWorkers yields a snapshot then updates on new events", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      { channel: "c", cwd: env.projectDir, by: "main", workerId: "w", systemPrompt: "x" },
      fakeRuntime,
    );
    const ac = new AbortController();
    const gen = watchWorkers({ channel: "c", signal: ac.signal });

    const first = await gen.next();
    expect((first.value as WorkerState[])[0].workerId).toBe("w");

    await appendEvent("c", {
      kind: "turn_started",
      by: "w",
      worker: "w",
      inputSeq: 0,
      turnId: "t1",
    });
    const updates = await takeN(gen, 1);
    ac.abort();
    expect(updates[0]?.[0]?.activity).toBe("mid-turn");
  });
});

describe("watchChannels cross-channel fan-in", () => {
  let env: TmpEnv;
  beforeEach(() => {
    env = setupChannelTmp();
    vi.spyOn(process, "cwd").mockReturnValue(env.projectDir);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    env.cleanup();
  });

  it("channelCursorKey is stable per scope/project/name", () => {
    expect(
      channelCursorKey({ name: "n", scope: "project", project: "p", dir: "/x" }),
    ).toBe("project/p/n");
  });

  it("fans in events from multiple channels in a project scope", async () => {
    await createChannel({ channel: "a", by: "main" });
    await createChannel({ channel: "b", by: "main" });
    await sendMessage({ channel: "a", by: "main", text: "from-a" });
    await sendMessage({ channel: "b", by: "main", text: "from-b" });

    const projectKey = env.projectDir.replace(/[\\/_]/g, "-").replace(/[^A-Za-z0-9.-]/g, "-");
    const ac = new AbortController();
    const gen = watchChannels({
      scope: { projectKey },
      signal: ac.signal,
      discoveryIntervalMs: 100,
    });
    const events = await takeN(gen, 4);
    ac.abort();
    await gen.return(undefined);

    const channelNames = new Set(events.map((e) => e.channel.name));
    expect(channelNames).toEqual(new Set(["a", "b"]));
    const last = events[events.length - 1] as CrossChannelEvent;
    expect(Object.keys(last.cursor).length).toBeGreaterThanOrEqual(2);
  });

  it("discovers channels created after the watcher starts", async () => {
    await createChannel({ channel: "a", by: "main" });
    const projectKey = env.projectDir.replace(/[\\/_]/g, "-").replace(/[^A-Za-z0-9.-]/g, "-");
    const ac = new AbortController();
    const gen = watchChannels({
      scope: { projectKey },
      signal: ac.signal,
      discoveryIntervalMs: 100,
      fromStartNewChannels: true,
    });
    // consume the backlog from channel "a"
    await takeN(gen, 1);
    await createChannel({ channel: "late", by: "main" });
    await sendMessage({ channel: "late", by: "main", text: "hello" });
    const more = await takeN(gen, 1, 5000);
    ac.abort();
    await gen.return(undefined);
    expect(more.some((e) => e.channel.name === "late")).toBe(true);
  });
});
