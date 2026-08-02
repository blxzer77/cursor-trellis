import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { startRpcServe } from "../../src/commands/rpc/index.js";
import { runSdkRun } from "../../src/commands/sdk/run.js";

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
