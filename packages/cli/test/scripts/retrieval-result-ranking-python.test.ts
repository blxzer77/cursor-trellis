import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const cliRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const scriptsDir = path.join(cliRoot, "src/templates/trellis/scripts");

function pythonExe(): string {
  for (const exe of ["python", "py", "python3"]) {
    if (spawnSync(exe, ["--version"], { encoding: "utf-8" }).status === 0) {
      return exe;
    }
  }
  return "python";
}

describe("retrieval_result_ranking.py (Python mirror of TS)", () => {
  it("B05 trap demotion orders corroborated implementation first", () => {
    const snippet = `
import json, sys
sys.path.insert(0, ".")
from common.retrieval_result_ranking import rank_retrieval_result_candidates
candidates = [
    {"path": "src/agents/plugin-registry-snapshot.ts", "baseRank": 1, "trapHint": True, "evidenceType": "trap"},
    {"path": "packages/plugin-core/src/plugin-registry.ts", "baseRank": 2, "corroborated": True, "evidenceType": "implementation"},
]
out = rank_retrieval_result_candidates(candidates, intents=["trap-package-disambiguation"], top_k=2)
print(out["topCandidates"][0]["path"])
`;
    const result = spawnSync(pythonExe(), ["-c", snippet], {
      cwd: scriptsDir,
      encoding: "utf-8",
    });
    expect(result.status).toBe(0);
    expect((result.stdout || "").trim()).toBe(
      "packages/plugin-core/src/plugin-registry.ts",
    );
  });

  it("rank_retrieval_candidates.py CLI accepts stdin JSON", () => {
    const payload = JSON.stringify([
      { path: "src/paths.ts", baseRank: 1 },
      { path: "scripts/e2e/env.ts", baseRank: 2, evidenceType: "env-script" },
    ]);
    const result = spawnSync(
      pythonExe(),
      [
        path.join(scriptsDir, "rank_retrieval_candidates.py"),
        "--candidates",
        "-",
        "--intents",
        "env-config-literal",
        "--top-k",
        "2",
      ],
      { cwd: scriptsDir, encoding: "utf-8", input: payload },
    );
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout || "{}") as {
      topCandidates?: { path: string }[];
    };
    expect(parsed.topCandidates?.[0]?.path).toBe("scripts/e2e/env.ts");
  });
});