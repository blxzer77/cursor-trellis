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

function runPy(snippet: string): string {
  const result = spawnSync(pythonExe(), ["-c", snippet], {
    cwd: scriptsDir,
    encoding: "utf-8",
    env: { ...process.env, PYTHONPATH: scriptsDir },
  });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || "python failed");
  }
  return (result.stdout || "").trim();
}

describe("retrieval_plan_gate.py", () => {
  it("skips meta-only prompts", () => {
    const out = runPy(`
import sys
sys.path.insert(0, ".")
from common.retrieval_plan_gate import should_inject_retrieval_plan
for q in ("继续", "ok", "[Triage: Lite] foo"):
    print(q, should_inject_retrieval_plan(q))
`);
    expect(out).toContain("继续 False");
    expect(out).toContain("ok False");
  });

  it("allows caller-chain questions", () => {
    const out = runPy(`
import sys
sys.path.insert(0, ".")
from common.retrieval_plan_gate import should_inject_retrieval_plan
print(should_inject_retrieval_plan("谁调用 route_codebase_retrieval"))
`);
    expect(out).toBe("True");
  });
});