import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  WorkerInboxError,
  createChannel,
  readWorkerInbox,
  sendMessage,
  spawnWorker,
  watchWorkerInbox,
  type WorkerInboxMessage,
  type WorkerRuntime,
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

const POLL_TIMEOUT = Symbol("poll-timeout");

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
      new Promise<typeof POLL_TIMEOUT>((r) =>
        setTimeout(() => r(POLL_TIMEOUT), 250),
      ),
    ]);
    if (next === POLL_TIMEOUT) continue;
    if (next.done) break;
    out.push(next.value as T);
  }
  return out;
}

async function drain<T>(
  gen: AsyncGenerator<T>,
  timeoutMs = 4000,
): Promise<T[]> {
  const out: T[] = [];
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const next = await Promise.race([
      gen.next(),
      new Promise<typeof POLL_TIMEOUT>((r) =>
        setTimeout(() => r(POLL_TIMEOUT), 250),
      ),
    ]);
    if (next === POLL_TIMEOUT) continue;
    if (next.done) return out;
    out.push(next.value as T);
  }
  return out;
}

describe("readWorkerInbox", () => {
  let env: TmpEnv;
  beforeEach(() => {
    env = setupChannelTmp();
    vi.spyOn(process, "cwd").mockReturnValue(env.projectDir);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    env.cleanup();
  });

  it("returns only targeted messages for explicitOnly", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
      },
      fakeRuntime,
    );
    await sendMessage({ channel: "c", by: "main", to: "w", text: "to-w-1" });
    await sendMessage({ channel: "c", by: "main", text: "broadcast" });
    await sendMessage({ channel: "c", by: "main", to: "other", text: "skip" });
    await sendMessage({ channel: "c", by: "main", to: "w", text: "to-w-2" });

    const msgs = await readWorkerInbox({ channel: "c", workerId: "w" });
    expect(msgs.map((m) => m.event.text)).toEqual(["to-w-1", "to-w-2"]);
    expect(msgs[0].cursor).toBe(msgs[0].seq);
    expect(msgs[0].workerId).toBe("w");
  });

  it("includes broadcasts for broadcastAndExplicit", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
        inboxPolicy: "broadcastAndExplicit",
      },
      fakeRuntime,
    );
    await sendMessage({ channel: "c", by: "main", to: "w", text: "to-w" });
    await sendMessage({ channel: "c", by: "main", text: "broadcast" });
    await sendMessage({ channel: "c", by: "main", to: "other", text: "skip" });

    const msgs = await readWorkerInbox({ channel: "c", workerId: "w" });
    expect(msgs.map((m) => m.event.text)).toEqual(["to-w", "broadcast"]);
  });

  it("respects afterSeq and limit", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
      },
      fakeRuntime,
    );
    const m1 = await sendMessage({
      channel: "c",
      by: "main",
      to: "w",
      text: "a",
    });
    await sendMessage({ channel: "c", by: "main", to: "w", text: "b" });
    await sendMessage({ channel: "c", by: "main", to: "w", text: "c" });

    const after = await readWorkerInbox({
      channel: "c",
      workerId: "w",
      afterSeq: m1.seq,
    });
    expect(after.map((m) => m.event.text)).toEqual(["b", "c"]);

    const capped = await readWorkerInbox({
      channel: "c",
      workerId: "w",
      limit: 2,
    });
    expect(capped.map((m) => m.event.text)).toEqual(["a", "b"]);
  });

  it("supports zero limit and rejects invalid limits", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
      },
      fakeRuntime,
    );
    await sendMessage({ channel: "c", by: "main", to: "w", text: "a" });

    await expect(
      readWorkerInbox({ channel: "c", workerId: "w", limit: 0 }),
    ).resolves.toEqual([]);
    await expect(
      readWorkerInbox({ channel: "c", workerId: "w", limit: -1 }),
    ).rejects.toThrow(/non-negative integer/);
    await expect(
      readWorkerInbox({ channel: "c", workerId: "w", limit: 1.5 }),
    ).rejects.toThrow(/non-negative integer/);
  });

  it("applies limit after inbox filtering", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
      },
      fakeRuntime,
    );
    // Many non-matching events first, then matching ones at the tail.
    for (let i = 0; i < 5; i++) {
      await sendMessage({
        channel: "c",
        by: "main",
        to: "other",
        text: `skip-${i}`,
      });
    }
    await sendMessage({ channel: "c", by: "main", to: "w", text: "hit-1" });
    await sendMessage({ channel: "c", by: "main", to: "w", text: "hit-2" });

    const msgs = await readWorkerInbox({
      channel: "c",
      workerId: "w",
      limit: 2,
    });
    expect(msgs.map((m) => m.event.text)).toEqual(["hit-1", "hit-2"]);
  });

  it("supports pre-spawn targeted backlog after spawned", async () => {
    await createChannel({ channel: "c", by: "main" });
    // Pre-spawn message targeting a worker that does not exist yet.
    await sendMessage({
      channel: "c",
      by: "main",
      to: "implement",
      text: "early",
    });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "implement",
        systemPrompt: "x",
      },
      fakeRuntime,
    );

    const msgs = await readWorkerInbox({
      channel: "c",
      workerId: "implement",
      afterSeq: 0,
    });
    expect(msgs.map((m) => m.event.text)).toEqual(["early"]);
  });

  it("legacy spawned without inboxPolicy defaults to explicitOnly", async () => {
    await createChannel({ channel: "c", by: "main" });
    // Direct append simulates an old log entry without an inboxPolicy field.
    await appendEvent("c", {
      kind: "spawned",
      by: "main",
      as: "w",
      provider: "claude",
      pid: 1,
    });
    await sendMessage({ channel: "c", by: "main", text: "broadcast" });
    await sendMessage({ channel: "c", by: "main", to: "w", text: "explicit" });

    const msgs = await readWorkerInbox({ channel: "c", workerId: "w" });
    expect(msgs.map((m) => m.event.text)).toEqual(["explicit"]);
  });

  it("throws WORKER_INBOX_WORKER_NOT_FOUND for unknown worker", async () => {
    await createChannel({ channel: "c", by: "main" });
    await expect(
      readWorkerInbox({ channel: "c", workerId: "ghost" }),
    ).rejects.toMatchObject({
      code: "WORKER_INBOX_WORKER_NOT_FOUND",
      channel: "c",
      workerId: "ghost",
    });
  });

  it("throws WORKER_INBOX_WORKER_TERMINAL by default for terminal worker", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
      },
      fakeRuntime,
    );
    await appendEvent("c", {
      kind: "killed",
      by: "cli:kill",
      worker: "w",
      reason: "explicit-kill",
    });
    await expect(
      readWorkerInbox({ channel: "c", workerId: "w" }),
    ).rejects.toMatchObject({ code: "WORKER_INBOX_WORKER_TERMINAL" });
  });

  it("allows inspecting terminal worker with includeTerminal", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
      },
      fakeRuntime,
    );
    await sendMessage({ channel: "c", by: "main", to: "w", text: "hi" });
    await appendEvent("c", {
      kind: "killed",
      by: "cli:kill",
      worker: "w",
      reason: "explicit-kill",
    });
    const msgs = await readWorkerInbox({
      channel: "c",
      workerId: "w",
      includeTerminal: true,
    });
    expect(msgs.map((m) => m.event.text)).toEqual(["hi"]);
  });

  it("excludes worker's own messages", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
        inboxPolicy: "broadcastAndExplicit",
      },
      fakeRuntime,
    );
    await sendMessage({ channel: "c", by: "main", to: "w", text: "in" });
    await sendMessage({ channel: "c", by: "w", text: "self" });
    const msgs = await readWorkerInbox({ channel: "c", workerId: "w" });
    expect(msgs.map((m) => m.event.text)).toEqual(["in"]);
  });

  it("delivers multi-target to[] messages to the matching worker", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
      },
      fakeRuntime,
    );
    await sendMessage({
      channel: "c",
      by: "main",
      to: ["a", "w"],
      text: "multi",
    });
    const msgs = await readWorkerInbox({ channel: "c", workerId: "w" });
    expect(msgs.map((m) => m.event.text)).toEqual(["multi"]);
  });

  it("WorkerInboxError carries code, channel, workerId", async () => {
    await createChannel({ channel: "c", by: "main" });
    try {
      await readWorkerInbox({ channel: "c", workerId: "ghost" });
      expect.fail("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(WorkerInboxError);
      const e = err as WorkerInboxError;
      expect(e.code).toBe("WORKER_INBOX_WORKER_NOT_FOUND");
      expect(e.channel).toBe("c");
      expect(e.workerId).toBe("ghost");
    }
  });
});

describe("watchWorkerInbox", () => {
  let env: TmpEnv;
  beforeEach(() => {
    env = setupChannelTmp();
    vi.spyOn(process, "cwd").mockReturnValue(env.projectDir);
  });
  afterEach(() => {
    vi.restoreAllMocks();
    env.cleanup();
  });

  it("yields future matching messages under explicitOnly", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
      },
      fakeRuntime,
    );

    const ac = new AbortController();
    const gen = await watchWorkerInbox({
      channel: "c",
      workerId: "w",
      signal: ac.signal,
    });

    await sendMessage({ channel: "c", by: "main", to: "w", text: "live-1" });
    await sendMessage({ channel: "c", by: "main", text: "broadcast" });
    await sendMessage({ channel: "c", by: "main", to: "w", text: "live-2" });

    const msgs = await takeN(gen, 2);
    ac.abort();
    await gen.return(undefined);
    expect(msgs.map((m) => m.event.text)).toEqual(["live-1", "live-2"]);
  });

  it("yields broadcasts under broadcastAndExplicit", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
        inboxPolicy: "broadcastAndExplicit",
      },
      fakeRuntime,
    );

    const ac = new AbortController();
    const gen = await watchWorkerInbox({
      channel: "c",
      workerId: "w",
      signal: ac.signal,
    });

    await sendMessage({ channel: "c", by: "main", text: "broadcast" });
    await sendMessage({ channel: "c", by: "main", to: "w", text: "explicit" });

    const msgs = await takeN(gen, 2);
    ac.abort();
    await gen.return(undefined);
    expect(msgs.map((m) => m.event.text)).toEqual(["broadcast", "explicit"]);
  });

  it("honors sinceSeq and fromStart", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
      },
      fakeRuntime,
    );
    const m1 = await sendMessage({
      channel: "c",
      by: "main",
      to: "w",
      text: "a",
    });
    await sendMessage({ channel: "c", by: "main", to: "w", text: "b" });

    const ac = new AbortController();
    const gen = await watchWorkerInbox({
      channel: "c",
      workerId: "w",
      sinceSeq: m1.seq,
      signal: ac.signal,
    });
    const sinceMsgs = await takeN(gen, 1);
    ac.abort();
    await gen.return(undefined);
    expect(sinceMsgs.map((m) => m.event.text)).toEqual(["b"]);

    const ac2 = new AbortController();
    const gen2 = await watchWorkerInbox({
      channel: "c",
      workerId: "w",
      fromStart: true,
      signal: ac2.signal,
    });
    const fromStartMsgs = await takeN(gen2, 2);
    ac2.abort();
    await gen2.return(undefined);
    expect(fromStartMsgs.map((m) => m.event.text)).toEqual(["a", "b"]);
  });

  it("fromStart replays only the current worker generation", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
      },
      fakeRuntime,
    );
    await sendMessage({ channel: "c", by: "main", to: "w", text: "old" });
    await appendEvent("c", {
      kind: "killed",
      by: "cli:kill",
      worker: "w",
      reason: "explicit-kill",
    });
    await sendMessage({
      channel: "c",
      by: "main",
      to: "w",
      text: "between-generations",
    });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
      },
      fakeRuntime,
    );

    const ac = new AbortController();
    const gen = await watchWorkerInbox({
      channel: "c",
      workerId: "w",
      fromStart: true,
      signal: ac.signal,
    });
    await sendMessage({ channel: "c", by: "main", to: "w", text: "new" });
    const msgs = await takeN(gen, 2);
    ac.abort();
    await gen.return(undefined);
    expect(msgs.map((m) => m.event.text)).toEqual([
      "between-generations",
      "new",
    ]);
  });

  it("rejects watching a terminal worker", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
      },
      fakeRuntime,
    );
    await appendEvent("c", {
      kind: "killed",
      by: "cli:kill",
      worker: "w",
      reason: "explicit-kill",
    });
    await expect(
      watchWorkerInbox({ channel: "c", workerId: "w" }),
    ).rejects.toMatchObject({
      code: "WORKER_INBOX_WORKER_TERMINAL",
    });
  });

  it("ends when a terminal event for the watched worker arrives and does not cross respawn", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
      },
      fakeRuntime,
    );

    const ac = new AbortController();
    const gen = await watchWorkerInbox({
      channel: "c",
      workerId: "w",
      signal: ac.signal,
    });

    await sendMessage({ channel: "c", by: "main", to: "w", text: "before" });
    // Terminal event for the same worker — generator must end.
    await appendEvent("c", {
      kind: "killed",
      by: "cli:kill",
      worker: "w",
      reason: "explicit-kill",
    });
    // Respawn + post-respawn message that must NOT be yielded.
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
      },
      fakeRuntime,
    );
    await sendMessage({ channel: "c", by: "main", to: "w", text: "after" });

    const seen: WorkerInboxMessage[] = await drain(gen);
    ac.abort();
    expect(seen.map((m) => m.event.text)).toEqual(["before"]);
  });

  it("rejects unknown worker", async () => {
    await createChannel({ channel: "c", by: "main" });
    await expect(
      watchWorkerInbox({ channel: "c", workerId: "ghost" }),
    ).rejects.toMatchObject({
      code: "WORKER_INBOX_WORKER_NOT_FOUND",
    });
  });

  it("exits cleanly when aborted before any event", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
      },
      fakeRuntime,
    );
    const ac = new AbortController();
    ac.abort();
    const gen = await watchWorkerInbox({
      channel: "c",
      workerId: "w",
      signal: ac.signal,
    });
    const result = await gen.next();
    expect(result.done).toBe(true);
  });

  it("exits when aborted while waiting", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
      },
      fakeRuntime,
    );
    const ac = new AbortController();
    const gen = await watchWorkerInbox({
      channel: "c",
      workerId: "w",
      signal: ac.signal,
    });
    const pending = gen.next();
    setTimeout(() => ac.abort(), 50);
    const result = await pending;
    expect(result.done).toBe(true);
  });

  it("excludes the worker's own messages while watching", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
        inboxPolicy: "broadcastAndExplicit",
      },
      fakeRuntime,
    );
    const ac = new AbortController();
    const gen = await watchWorkerInbox({
      channel: "c",
      workerId: "w",
      signal: ac.signal,
    });

    await sendMessage({ channel: "c", by: "w", text: "self" });
    await sendMessage({ channel: "c", by: "main", to: "w", text: "in" });
    const msgs = await takeN(gen, 1);
    ac.abort();
    await gen.return(undefined);
    expect(msgs.map((m) => m.event.text)).toEqual(["in"]);
  });

  it("delivers multi-target to[] messages while watching", async () => {
    await createChannel({ channel: "c", by: "main" });
    await spawnWorker(
      {
        channel: "c",
        cwd: env.projectDir,
        by: "main",
        workerId: "w",
        systemPrompt: "x",
      },
      fakeRuntime,
    );
    const ac = new AbortController();
    const gen = await watchWorkerInbox({
      channel: "c",
      workerId: "w",
      signal: ac.signal,
    });
    await sendMessage({
      channel: "c",
      by: "main",
      to: ["a", "w"],
      text: "multi",
    });
    const msgs = await takeN(gen, 1);
    ac.abort();
    await gen.return(undefined);
    expect(msgs.map((m) => m.event.text)).toEqual(["multi"]);
  });
});
