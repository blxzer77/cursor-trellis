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
  for (const executable of ["python", "py", "python3"]) {
    if (
      spawnSync(executable, ["--version"], { encoding: "utf8" }).status === 0
    ) {
      return executable;
    }
  }
  return "python";
}

describe("retrieval_result_ranking.py V3 mirror", () => {
  it("orders semantic candidates exactly like the neutral score model", () => {
    const snippet = `
import json, sys
sys.path.insert(0, ".")
from common.retrieval_result_ranking import rank_retrieval_result_candidates
candidates = [
    {"path": "b.ts", "semanticScore": 0.8},
    {"path": "a.ts", "semanticScore": 0.8, "sourceReference": "source://a.ts:1"},
]
print(json.dumps(rank_retrieval_result_candidates(candidates, intents=["semantic"], top_k=2)))
`;
    const result = spawnSync(pythonExe(), ["-c", snippet], {
      cwd: scriptsDir,
      encoding: "utf8",
    });
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as { ranked: { path: string }[] };
    expect(parsed.ranked.map((candidate) => candidate.path)).toEqual([
      "a.ts",
      "b.ts",
    ]);
  });

  it("rank_retrieval_candidates.py CLI accepts the four V3 intents", () => {
    const payload = JSON.stringify([
      { path: "older", externalFreshness: 0.1 },
      { path: "newer", externalFreshness: 0.9 },
    ]);
    const result = spawnSync(
      pythonExe(),
      [
        path.join(scriptsDir, "rank_retrieval_candidates.py"),
        "--candidates",
        "-",
        "--intents",
        "external",
        "--top-k",
        "2",
      ],
      { cwd: scriptsDir, encoding: "utf8", input: payload },
    );
    expect(result.status).toBe(0);
    const parsed = JSON.parse(result.stdout) as { ranked?: { path: string }[] };
    expect(parsed.ranked?.[0]?.path).toBe("newer");
  });
});
