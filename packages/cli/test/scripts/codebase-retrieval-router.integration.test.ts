import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CODEBASE_RETRIEVAL_ROUTER_VERSION } from "../../src/utils/codebase-retrieval-router.js";
import { getAllScriptsForTests } from "../../src/templates/pactile/index.js";
import { resolvePython } from "./retrieval-eval-fixtures.js";

const pythonCmd = resolvePython();

function writePactileScripts(root: string): void {
  const scriptsDir = path.join(root, ".pactile", "scripts");
  for (const [rel, content] of getAllScriptsForTests()) {
    const target = path.join(scriptsDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf-8");
  }
}

function runRouter(root: string, query: string): Record<string, unknown> {
  const scriptPath = path.join(
    root,
    ".pactile",
    "scripts",
    "route_codebase_retrieval.py",
  );
  const result = spawnSync(pythonCmd as string, [scriptPath, query, "--json"], {
    cwd: root,
    encoding: "utf-8",
  });
  expect(result.status).toBe(0);
  return JSON.parse(result.stdout) as Record<string, unknown>;
}

describe.skipIf(pythonCmd === null)("codebase_retrieval_router.py", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pactile-router-"));
    writePactileScripts(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("emits a neutral V3 plan through the installed Python launcher", () => {
    const plan = runRouter(tmpDir, "find caller dependency impact");
    expect(plan.schemaVersion).toBe(CODEBASE_RETRIEVAL_ROUTER_VERSION);
    expect(plan.intents).toEqual(["structural"]);
    expect(plan.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          intent: "structural",
          kind: "provider-request",
        }),
      ]),
    );
    expect(plan).toHaveProperty("fingerprint");
  });

  it("wires query into retrieval pack evidenceEnvelope intents", () => {
    const inputPath = path.join(tmpDir, "in.json");
    fs.writeFileSync(
      inputPath,
      JSON.stringify({
        query: "where is the storage policy file defined",
      }),
      "utf-8",
    );
    const build = path.join(
      tmpDir,
      ".pactile",
      "scripts",
      "build_retrieval_pack.py",
    );
    const result = spawnSync(
      pythonCmd as string,
      [build, "--input", inputPath, "--root", tmpDir, "--json"],
      { cwd: tmpDir, encoding: "utf-8" },
    );
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      evidenceEnvelope: { intents: string[]; routes: unknown[] };
    };
    expect(payload.evidenceEnvelope.intents).toEqual(["exact"]);
    expect(payload.evidenceEnvelope.routes.length).toBeGreaterThan(0);
  });
});
