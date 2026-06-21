import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cliRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const templateScriptsDir = path.join(
  cliRoot,
  "src/templates/trellis/scripts",
);

function pythonExe(): string {
  const candidates = ["python", "py", "python3"];
  for (const exe of candidates) {
    const probe = spawnSync(exe, ["--version"], { encoding: "utf-8" });
    if (probe.status === 0) return exe;
  }
  return "python";
}

describe("aggregate_retrieval_telemetry.py", () => {
  it("derives semantic and codegraph rates from JSONL", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-telemetry-"));
    const jsonl = path.join(tmp, "rows.jsonl");
    const rows = [
      {
        query_id: "Q1",
        platform: "cursor",
        routes: ["exact-rg-primary", "caller-chain-ast", "platform-semantic"],
        tools_called: ["Grep", "Read"],
        semantic_in_plan: true,
        semantic_outcome: "not_run",
        semantic_skip_reason: "rg_corrob_sufficient",
        answer_score: 6,
      },
      {
        query_id: "B02",
        platform: "cursor",
        routes: ["exact-rg-primary", "caller-chain-ast", "platform-semantic"],
        tools_called: ["Grep"],
        semantic_in_plan: true,
        semantic_outcome: "not_run",
        answer_score: 0,
      },
    ];
    fs.writeFileSync(
      jsonl,
      rows.map((r) => JSON.stringify(r)).join("\n"),
      "utf-8",
    );

    const script = path.join(
      templateScriptsDir,
      "aggregate_retrieval_telemetry.py",
    );
    const exe = pythonExe();
    const args =
      exe === "py"
        ? ["-3", script, jsonl]
        : [script, jsonl];
    const result = spawnSync(exe, args, {
      cwd: templateScriptsDir,
      encoding: "utf-8",
    });

    expect(result.status, result.stderr).toBe(0);
    const payload = JSON.parse(result.stdout) as {
      metrics: {
        total_queries: number;
        semantic_plan_rate: number;
        codegraph_plan_rate: number;
        codegraph_exec_rate: number;
        avg_answer_score: number;
      };
    };
    expect(payload.metrics.total_queries).toBe(2);
    expect(payload.metrics.semantic_plan_rate).toBe(1);
    expect(payload.metrics.codegraph_plan_rate).toBe(1);
    expect(payload.metrics.codegraph_exec_rate).toBe(0);
    expect(payload.metrics.avg_answer_score).toBe(3);
  });
});