import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";
import { handleKernelRequest } from "../../src/task/kernel-cli.js";
import { emptyTaskRecord } from "../../src/task/schema.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const bridgeModule = path.resolve(here, "../../dist/task/kernel-cli.js");
const scripts = path.resolve(here, "../../../cli/src/templates/pactile/scripts");
const python = ["python", "python3", "py"].find((command) => spawnSync(command, ["--version"], { encoding: "utf8" }).status === 0);

// Integration smoke uses the package's built JSON bridge. Unit suites work on a
// source-only checkout; run `pnpm build:core` to enable this external-process seam.
it.skipIf(!python || !fs.existsSync(bridgeModule))("walks isolated PRD → execution → verify → actual Python archive → persisted notes projection", () => {
  if (!python) throw new Error("Python required");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "kernel-walkthrough-"));
  const workflow = path.join(root, ".pactile");
  const taskDir = path.join(workflow, "tasks", "walkthrough");
  try {
    fs.cpSync(scripts, path.join(workflow, "scripts"), { recursive: true });
    fs.mkdirSync(taskDir, { recursive: true });
    fs.writeFileSync(path.join(workflow, "config.yaml"), "session_auto_commit: false\n");
    fs.writeFileSync(path.join(workflow, ".developer"), "name=fixture\n");
    fs.writeFileSync(path.join(taskDir, "prd.md"), "# Synthetic lifecycle task\nAcceptance: preserve archived notes projection.\n");
    fs.writeFileSync(path.join(taskDir, "implement.md"), "# Execution contract\nNo-op implementation; fixture lifecycle verification.\n");
    const record = emptyTaskRecord({ id: "walkthrough", name: "walkthrough", title: "Synthetic walkthrough", creator: "fixture", assignee: "fixture" });
    const created = handleKernelRequest({ op: "create", taskDir, actor: "fixture", idempotencyKey: "create", record });
    expect(created.ok).toBe(true);
    const started = handleKernelRequest({ op: "start", taskDir, actor: "fixture", idempotencyKey: "start", expectedRevision: 1, record: { ...record, status: "in_progress" }, extras: { execution_approval: { approved_by: "fixture", transition: "start-execution" } } });
    expect(started).toMatchObject({ ok: true, kernel: { phase: "execute" } });
    fs.writeFileSync(path.join(taskDir, "verify.md"), "# Verification\nValidation commands: isolated kernel walkthrough passed\nFinal acceptance evidence: PRD to archived kernel projection\nDurable learning decision: no durable learning\n");
    const bridge = path.join(root, "kernel-bridge.mjs");
    fs.writeFileSync(bridge, `import { runKernelJsonCli } from ${JSON.stringify(pathToFileURL(bridgeModule).href)}; process.exitCode = await runKernelJsonCli();\n`);
    const env = { ...process.env, PACTILE_KERNEL_CLI: `node ${bridge}`, PYTHONIOENCODING: "utf-8" };
    for (const flags of [["--check"], ["--no-commit"]]) {
      const result = spawnSync(python, [path.join(workflow, "scripts/task.py"), "archive", taskDir, ...flags], { cwd: root, env, encoding: "utf8" });
      expect(result.status, result.stdout + result.stderr).toBe(0);
    }
    expect(fs.existsSync(taskDir)).toBe(false);
    const archiveRoot = path.join(workflow, "tasks/archive");
    const month = fs.readdirSync(archiveRoot)[0];
    const archived = JSON.parse(fs.readFileSync(path.join(archiveRoot, month, "walkthrough/kernel.json"), "utf8")) as { phase: string; projection: { extras: Record<string, unknown> } };
    expect(archived.phase).toBe("close");
    expect(archived.projection.extras.notes_projection).toEqual(expect.any(Object));
  } finally { fs.rmSync(root, { force: true, recursive: true }); }
}, 30_000);
