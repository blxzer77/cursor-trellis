import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createWorkflowStructure } from "../../src/configurators/workflow.js";
import { setWriteMode } from "../../src/utils/file-writer.js";

describe("createWorkflowStructure — cursor2plus opt-in (1.1.0)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-c2p-"));
    setWriteMode("force");
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    setWriteMode("ask");
  });

  it("does NOT write cursor2plus bundle by default (opt-in off)", async () => {
    await createWorkflowStructure(tmpDir, { projectType: "fullstack" });
    const cursor2plusDir = path.join(
      tmpDir,
      ".trellis",
      "local",
      "cursor2plus",
    );
    expect(fs.existsSync(cursor2plusDir)).toBe(false);
    expect(
      fs.existsSync(path.join(cursor2plusDir, "patch_wpelc8.py")),
    ).toBe(false);
  });

  it("writes cursor2plus bundle when cursor2plus: true", async () => {
    await createWorkflowStructure(tmpDir, {
      projectType: "fullstack",
      cursor2plus: true,
    });
    const cursor2plusDir = path.join(
      tmpDir,
      ".trellis",
      "local",
      "cursor2plus",
    );
    expect(fs.existsSync(cursor2plusDir)).toBe(true);
    expect(
      fs.existsSync(path.join(cursor2plusDir, "patch_wpelc8.py")),
    ).toBe(true);
    expect(fs.existsSync(path.join(cursor2plusDir, "README.md"))).toBe(true);
    expect(
      fs.existsSync(
        path.join(
          tmpDir,
          ".trellis",
          "local",
          "trellis-task-models.json5.example",
        ),
      ),
    ).toBe(true);
  });

  it("does NOT write maintainer-only scripts (probe, eval tools)", async () => {
    await createWorkflowStructure(tmpDir, { projectType: "fullstack" });
    const scriptsDir = path.join(tmpDir, ".trellis", "scripts");
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

  it("still creates .trellis base structure regardless of cursor2plus flag", async () => {
    await createWorkflowStructure(tmpDir, {
      projectType: "fullstack",
      cursor2plus: false,
    });
    expect(fs.existsSync(path.join(tmpDir, ".trellis"))).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, ".trellis", "scripts")),
    ).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".trellis", "tasks"))).toBe(true);
    expect(
      fs.existsSync(path.join(tmpDir, ".trellis", "workflow.md")),
    ).toBe(true);
  });
});
