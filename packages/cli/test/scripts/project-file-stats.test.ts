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
const trellisRoot = path.resolve(cliRoot, "../..");
const scriptsDir = path.join(trellisRoot, ".trellis/scripts");
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

function runFromScriptsDir(snippet: string): {
  status: number | null;
  stdout: string;
  stderr: string;
} {
  const exe = pythonExe();
  const args = exe === "py" ? ["-3", "-c", snippet] : ["-c", snippet];
  const result = spawnSync(exe, args, {
    cwd: scriptsDir,
    encoding: "utf-8",
    env: {
      ...process.env,
      PYTHONPATH: scriptsDir,
    },
  });
  return {
    status: result.status,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? "").trim(),
  };
}

describe("project_file_stats (dogfood scripts dir)", () => {
  it("template module is wired in getAllScripts", () => {
    const templatePath = path.join(
      templateScriptsDir,
      "common/project_file_stats.py",
    );
    expect(fs.existsSync(templatePath)).toBe(true);
    expect(fs.existsSync(path.join(scriptsDir, "common/project_file_stats.py"))).toBe(
      true,
    );
  });

  it("counts files in a tiny temp tree via walk fallback", () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-pfc-"));
    try {
      fs.writeFileSync(path.join(tmp, "a.txt"), "a");
      fs.mkdirSync(path.join(tmp, "sub"));
      fs.writeFileSync(path.join(tmp, "sub", "b.ts"), "b");
      const tmpPy = tmp.replace(/\\/g, "/");
      const { status, stdout, stderr } = runFromScriptsDir(`
from pathlib import Path
from common.project_file_stats import count_project_files
print(count_project_files(Path(r"${tmpPy}")))
`);
      expect(stderr, stderr).toBe("");
      expect(status).toBe(0);
      expect(Number(stdout)).toBe(2);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("resolve auto returns an integer for Trellis repo", () => {
    const rootPy = trellisRoot.replace(/\\/g, "/");
    const { status, stdout, stderr } = runFromScriptsDir(`
from pathlib import Path
from common.project_file_stats import resolve_project_file_count_arg
n = resolve_project_file_count_arg("auto", repo_root=Path(r"${rootPy}"))
assert isinstance(n, int) and n > 0
print(n)
`);
    expect(stderr, stderr).toBe("");
    expect(status).toBe(0);
    expect(Number(stdout)).toBeGreaterThan(100);
  });
});