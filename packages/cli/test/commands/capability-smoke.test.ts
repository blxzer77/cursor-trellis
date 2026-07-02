import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  ensureCapabilitiesFileExists,
  runCapabilitySmokeCommand,
} from "../../src/commands/capability-smoke.js";
import {
  renderCapabilitiesJson,
  renderCapabilitiesMarkdown,
} from "../../src/utils/project-capabilities.js";

describe("capability-smoke command", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-cap-smoke-"));
    fs.mkdirSync(path.join(tmpDir, ".trellis"), { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("fails retrieval smoke when codegraph index is missing", async () => {
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "capabilities.json"),
      renderCapabilitiesJson(["codebase-retrieval"]),
      "utf-8",
    );
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "capabilities.md"),
      renderCapabilitiesMarkdown(["codebase-retrieval"]),
      "utf-8",
    );

    const result = await runCapabilitySmokeCommand({
      cwd: tmpDir,
      json: false,
      writeStatus: true,
    });
    const updated = JSON.parse(
      fs.readFileSync(path.join(tmpDir, ".trellis", "capabilities.json"), "utf-8"),
    ) as {
      capabilities: Record<string, { readiness_status?: string }>;
    };

    expect(result.ok).toBe(false);
    expect(result.results[0]?.failures.join(" ")).toContain("CodeGraph index");
    expect(
      updated.capabilities["codebase-retrieval"]?.readiness_status,
    ).toBe("failed");
  });

  it("marks retrieval ready when codegraph index exists", async () => {
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "capabilities.json"),
      renderCapabilitiesJson(["codebase-retrieval"]),
      "utf-8",
    );
    fs.writeFileSync(
      path.join(tmpDir, ".trellis", "capabilities.md"),
      renderCapabilitiesMarkdown(["codebase-retrieval"]),
      "utf-8",
    );
    fs.mkdirSync(path.join(tmpDir, ".codegraph"), { recursive: true });

    const result = await runCapabilitySmokeCommand({
      cwd: tmpDir,
      json: false,
      writeStatus: true,
    });
    const updatedMarkdown = fs.readFileSync(
      path.join(tmpDir, ".trellis", "capabilities.md"),
      "utf-8",
    );

    expect(result.ok).toBe(true);
    expect(updatedMarkdown).toContain("- codebase-retrieval [ready]:");
  });

  it("throws when capabilities file is missing", () => {
    expect(() => ensureCapabilitiesFileExists(tmpDir)).toThrow(
      /No \.trellis\/capabilities\.json found/,
    );
  });
});
