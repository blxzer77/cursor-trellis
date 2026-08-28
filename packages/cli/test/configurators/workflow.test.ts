import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createWorkflowStructure } from "../../src/configurators/workflow.js";
import { setWriteMode } from "../../src/utils/file-writer.js";

describe("createWorkflowStructure — Cursor++ never written (P23)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-c2p-"));
    setWriteMode("force");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    setWriteMode("ask");
  });

  it("does NOT write cursor2plus bundle (option removed)", async () => {
    await createWorkflowStructure(tmpDir, { projectType: "fullstack" });
    const cursor2plusDir = path.join(
      tmpDir,
      ".cstl",
      "local",
      "cursor2plus",
    );
    expect(fs.existsSync(cursor2plusDir)).toBe(false);
    expect(
      fs.existsSync(path.join(cursor2plusDir, "patch_wpelc8.py")),
    ).toBe(false);
    // cursor2plus is no longer a WorkflowOptions field
    expect(
      "cursor2plus" in
        (({ projectType: "fullstack" }) as Record<string, unknown>),
    ).toBe(false);
  });

  it("does NOT write maintainer-only scripts (probe, eval tools)", async () => {
    await createWorkflowStructure(tmpDir, { projectType: "fullstack" });
    const scriptsDir = path.join(tmpDir, ".cstl", "scripts");
    expect(
      fs.existsSync(path.join(scriptsDir, "cursor_retrieval_probe.py")),
    ).toBe(false);
    expect(
      fs.existsSync(path.join(scriptsDir, "cursor_retrieval_probe_prompt.md")),
    ).toBe(false);
    expect(
      fs.existsSync(path.join(scriptsDir, "aggregate_retrieval_telemetry.py")),
    ).toBe(false);
    expect(
      fs.existsSync(path.join(scriptsDir, "batch_plan_envelope.py")),
    ).toBe(false);
    expect(
      fs.existsSync(path.join(scriptsDir, "common", "test_retrieval_arbitration.py")),
    ).toBe(false);
    expect(fs.existsSync(path.join(scriptsDir, "task.py"))).toBe(true);
  });

  it("still creates .cstl base structure", async () => {
    await createWorkflowStructure(tmpDir, {
      projectType: "fullstack",
    });
    expect(fs.existsSync(path.join(tmpDir, ".cstl"))).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, ".cstl", "scripts")),
    ).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".cstl", "tasks"))).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, ".cstl", "workflow.md")),
    ).toBe(true);
  });
});
