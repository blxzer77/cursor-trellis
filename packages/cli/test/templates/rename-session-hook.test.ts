import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const HOOK_PATH = join(
  __dirname,
  "..",
  "..",
  "src",
  "templates",
  "shared-hooks",
  "rename-session-for-task.py",
);

function runPython(expr: string): string {
  return execFileSync("python", ["-c", expr], { encoding: "utf-8" }).trim();
}

describe("rename-session-for-task.py helpers", () => {
  const hookSource = readFileSync(HOOK_PATH, "utf-8");

  it("exports parse helpers for unit testing via importlib", () => {
    expect(hookSource).toContain("def parse_rename_intent");
    expect(hookSource).toContain("def task_directory_name");
    expect(hookSource).toContain("def shell_output_succeeded");
  });

  it("parse_rename_intent accepts select and approved start-execution", () => {
    const code = `
import importlib.util
from pathlib import Path
spec = importlib.util.spec_from_file_location("rename_hook", r"${HOOK_PATH.replace(/\\/g, "\\\\")}")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
print(mod.parse_rename_intent("python ./.cstl/scripts/task.py select 07-04-foo"))
print(mod.parse_rename_intent("python task.py start-execution 07-04-foo --approved"))
print(mod.parse_rename_intent("python task.py start-execution 07-04-foo --check"))
print(mod.parse_rename_intent("python task.py create \\"Title\\" --slug foo"))
`;
    const lines = runPython(code).split(/\r?\n/);
    expect(lines[0]).toContain("select");
    expect(lines[0]).toContain("07-04-foo");
    expect(lines[1]).toContain("start-execution");
    expect(lines[2]).toBe("None");
    expect(lines[3]).toBe("None");
  });

  it("task_directory_name uses basename", () => {
    const code = `
import importlib.util
spec = importlib.util.spec_from_file_location("rename_hook", r"${HOOK_PATH.replace(/\\/g, "\\\\")}")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
print(mod.task_directory_name(".cstl/tasks/07-04-cstl-session-rename"))
`;
    expect(runPython(code)).toBe("07-04-cstl-session-rename");
  });

  it("shell_output_succeeded detects success markers", () => {
    const code = `
import importlib.util
spec = importlib.util.spec_from_file_location("rename_hook", r"${HOOK_PATH.replace(/\\/g, "\\\\")}")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
print(mod.shell_output_succeeded("select", "✓ Selected task: .cstl/tasks/07-04-foo"))
print(mod.shell_output_succeeded("select", "Error: failed"))
print(mod.shell_output_succeeded("start-execution", "✓ Execution approved for: .cstl/tasks/07-04-foo"))
`;
    const lines = runPython(code).split(/\r?\n/);
    expect(lines[0]).toBe("True");
    expect(lines[1]).toBe("False");
    expect(lines[2]).toBe("True");
  });
});
