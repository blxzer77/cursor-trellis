import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { startRpcServe } from "../../src/commands/rpc/index.js";
import {
  buildSdkRunPrompt,
  runSdkRun,
} from "../../src/commands/sdk/run.js";
import { collectSdkStatus } from "../../src/commands/sdk/status.js";

const handles: { close(): Promise<void> }[] = [];
const tempDirs: string[] = [];

afterEach(async () => {
  while (handles.length > 0) {
    const handle = handles.pop();
    if (handle) await handle.close();
  }
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTaskDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cstl-sdk-task-"));
  tempDirs.push(dir);
  fs.writeFileSync(path.join(dir, "prd.md"), "# fixture task\n", "utf-8");
  return dir;
}

describe("buildSdkRunPrompt", () => {
  it("embeds absolute --task path and BOUND semantics", () => {
    const task = makeTaskDir();
    const prompt = buildSdkRunPrompt(task);
    expect(prompt).toContain(task);
    expect(prompt).toContain(path.join(task, "prd.md"));
    expect(prompt).toMatch(/Binding status: \*\*BOUND\*\*/);
    expect(prompt).toMatch(/Bound via CLI `--task`/);
    expect(prompt).toMatch(/Do \*\*not\*\* report unbound solely because SessionStart/);
    expect(prompt).toMatch(/Selected task: none/);
    // Must not instruct the worker that missing selected_task means unbound.
    expect(prompt).not.toMatch(/hence unbound|therefore unbound|unbound because Selected task/i);
  });

  it("keeps binding preamble when custom --prompt replaces instruction body", () => {
    const task = makeTaskDir();
    const custom = "Custom worker body: echo only READY.";
    const prompt = buildSdkRunPrompt(task, custom);
    expect(prompt).toContain(task);
    expect(prompt).toMatch(/Binding status: \*\*BOUND\*\*/);
    expect(prompt).toContain(custom);
    expect(prompt).not.toContain("summarize readiness in one short paragraph");
  });
});

describe("cstl sdk run", () => {
  it("rejects missing --task directory / prd.md", async () => {
    await expect(
      runSdkRun({
        task: path.join(os.tmpdir(), "no-such-cstl-task"),
        campaign: "sdk-test",
        mode: "mock",
        noRpc: true,
      }),
    ).rejects.toThrow(/not a directory|missing prd\.md/);
  });

  it("mock RUN prompt binding reaches agent (path in mock result length path via evidence)", async () => {
    const task = makeTaskDir();
    const result = await runSdkRun({
      task,
      campaign: "sdk-test",
      mode: "mock",
      noRpc: true,
    });
    expect(result.ok).toBe(true);
    expect(result.taskPath).toBe(path.resolve(task));
    // Mock agent reports prompt length; binding preamble makes prompt longer than DEFAULT alone.
    const bound = buildSdkRunPrompt(task);
    expect(result.agent.result).toContain(String(bound.length));
    expect(bound.length).toBeGreaterThan(200);
  });

  it("mock RUN writes dogfood and skips RPC when --no-rpc", async () => {
    const task = makeTaskDir();
    const result = await runSdkRun({
      task,
      campaign: "sdk-test",
      mode: "mock",
      noRpc: true,
    });
    expect(result.ok).toBe(true);
    expect(result.mode).toBe("mock");
    expect(result.rpc.attempted).toBe(false);
    expect(fs.existsSync(result.evidencePath)).toBe(true);
    const body = fs.readFileSync(result.evidencePath, "utf-8");
    expect(body).toMatch(/mode: `mock`/);
    expect(body).toMatch(/Does \*\*not\*\* call/);
  });

  it("mock RUN registers kind=sdk and publishes campaign topic", async () => {
    const handle = await startRpcServe({
      port: 0,
      journalDir: null,
      heartbeatTimeoutMs: 0,
    });
    handles.push(handle);

    const task = makeTaskDir();
    const result = await runSdkRun({
      task,
      campaign: "sdk-test",
      mode: "mock",
      rpcUrl: handle.info.url,
    });

    expect(result.ok).toBe(true);
    expect(result.rpc.attempted).toBe(true);
    expect(result.rpc.ok).toBe(true);
    expect(result.rpc.detail).toMatch(/registered sdk:/);
    expect(result.rpc.detail).toMatch(/campaign:sdk-test:broadcast/);
  });

  it("degrades when RPC broker is unreachable (still writes evidence)", async () => {
    const task = makeTaskDir();
    const result = await runSdkRun({
      task,
      campaign: "sdk-test",
      mode: "mock",
      rpcUrl: "http://127.0.0.1:1",
    });
    expect(result.ok).toBe(true);
    expect(result.rpc.attempted).toBe(true);
    expect(result.rpc.ok).toBe(false);
    expect(fs.existsSync(result.evidencePath)).toBe(true);
    expect(result.errors.some((e) => e.startsWith("rpc:"))).toBe(true);
  });
});

describe("cstl sdk status", () => {
  it("reports missing key without echoing secrets", async () => {
    const prev = process.env.CURSOR_API_KEY;
    delete process.env.CURSOR_API_KEY;
    try {
      const status = await collectSdkStatus(makeTaskDir());
      expect(status.keyPresent).toBe(false);
      expect(status.ok).toBe(false);
      // Mentions the env var name; must not embed a secret-looking value.
      expect(JSON.stringify(status)).toMatch(/CURSOR_API_KEY/);
      expect(JSON.stringify(status)).not.toMatch(/sk-[A-Za-z0-9]{10,}/);
    } finally {
      if (prev === undefined) {
        delete process.env.CURSOR_API_KEY;
      } else {
        process.env.CURSOR_API_KEY = prev;
      }
    }
  });

  it("reports present key when env is set", async () => {
    const prev = process.env.CURSOR_API_KEY;
    process.env.CURSOR_API_KEY = "unit-test-key-value";
    try {
      const status = await collectSdkStatus(makeTaskDir());
      expect(status.keyPresent).toBe(true);
      expect(status.ok).toBe(true);
      expect(JSON.stringify(status)).not.toContain("unit-test-key-value");
    } finally {
      if (prev === undefined) {
        delete process.env.CURSOR_API_KEY;
      } else {
        process.env.CURSOR_API_KEY = prev;
      }
    }
  });
});
