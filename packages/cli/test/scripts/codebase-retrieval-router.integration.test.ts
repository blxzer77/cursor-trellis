import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { CODEBASE_RETRIEVAL_ROUTER_VERSION } from "../../src/utils/codebase-retrieval-router.js";
import { getAllScripts } from "../../src/templates/trellis/index.js";
import { resolvePython } from "./retrieval-eval-fixtures.js";

const pythonCmd = resolvePython();

function writeTrellisScripts(root: string): void {
  const scriptsDir = path.join(root, ".trellis", "scripts");
  for (const [rel, content] of getAllScripts()) {
    const target = path.join(scriptsDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf-8");
  }
}

function runRouter(root: string, query: string): Record<string, unknown> {
  const scriptPath = path.join(root, ".trellis", "scripts", "route_codebase_retrieval.py");
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
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-router-"));
    writeTrellisScripts(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("emits version 2 envelope with empty adapter slices", () => {
    const plan = runRouter(tmpDir, "who calls the loader and list call sites");
    expect(plan.version).toBe(CODEBASE_RETRIEVAL_ROUTER_VERSION);
    expect(plan.adapterState).toEqual([]);
    expect(plan.freshness).toEqual([]);
    const intents = plan.intents as { id: string }[];
    expect(intents.some((i) => i.id === "caller-chain")).toBe(true);
  });

  it("wires query into retrieval pack evidenceEnvelope intents", () => {
    const inputPath = path.join(tmpDir, "in.json");
    fs.writeFileSync(
      inputPath,
      JSON.stringify({
        query: "storage policy sidecar SQLite only persistence",
      }),
      "utf-8",
    );
    const build = path.join(tmpDir, ".trellis", "scripts", "build_retrieval_pack.py");
    const result = spawnSync(
      pythonCmd as string,
      [build, "--input", inputPath, "--root", tmpDir, "--json"],
      { cwd: tmpDir, encoding: "utf-8" },
    );
    expect(result.status).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      evidenceEnvelope: { intents: { id: string }[]; routes: unknown[] };
    };
    expect(payload.evidenceEnvelope.intents.some((i) => i.id === "policy-document")).toBe(
      true,
    );
    expect(payload.evidenceEnvelope.routes.length).toBeGreaterThan(0);
  });
});