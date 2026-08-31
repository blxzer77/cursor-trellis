import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getSharedHookScripts } from "../../src/templates/shared-hooks/index.js";
import { getAllScriptsForTests } from "../../src/templates/trellis/index.js";
import { resolvePython } from "./retrieval-eval-fixtures.js";

const pythonCmd = resolvePython();
const cliRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const templatesRoot = path.join(cliRoot, "src", "templates");

const ABI_FILES = [
  "shared-hooks/inject-retrieval-plan.py",
  "shared-hooks/research-end-retrieval-pack.py",
  "trellis/scripts/build_retrieval_pack.py",
  "trellis/scripts/rank_retrieval_candidates.py",
  "trellis/scripts/score_evidence.py",
] as const;

const TASK_PATH = ".cstl/tasks/08-31-abi";
const SESSION_ID = "retrieval-abi-test";

function writeTrellisScripts(root: string): void {
  const scriptsDir = path.join(root, ".cstl", "scripts");
  for (const [rel, content] of getAllScriptsForTests()) {
    const target = path.join(scriptsDir, rel);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf-8");
  }
}

function writeHook(root: string, name: string): string {
  const hook = getSharedHookScripts().find((item) => item.name === name);
  if (!hook) {
    throw new Error(`missing shared hook ${name}`);
  }
  const dest = path.join(root, ".cursor", "hooks", name);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, hook.content, "utf-8");
  return dest;
}

function seedTask(root: string): void {
  writeTrellisScripts(root);
  fs.mkdirSync(path.join(root, TASK_PATH), { recursive: true });
  fs.writeFileSync(
    path.join(root, TASK_PATH, "task.json"),
    `${JSON.stringify({ id: "abi", name: "abi", title: "ABI", status: "in_progress" }, null, 2)}\n`,
    "utf-8",
  );
  fs.mkdirSync(path.join(root, ".cstl", ".runtime", "sessions"), { recursive: true });
  fs.writeFileSync(
    path.join(root, ".cstl", ".runtime", "sessions", `${SESSION_ID}.json`),
    `${JSON.stringify({ selected_task: TASK_PATH }, null, 2)}\n`,
    "utf-8",
  );
}

function runPython(
  args: string[],
  options: {
    cwd: string;
    input?: string;
    env?: NodeJS.ProcessEnv;
  },
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(pythonCmd as string, args, {
    cwd: options.cwd,
    encoding: "utf-8",
    input: options.input,
    env: { ...process.env, PYTHONIOENCODING: "utf-8", ...options.env },
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe.skipIf(pythonCmd === null)("retrieval three-layer ABI freeze", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-retrieval-abi-"));
    seedTask(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("declares intent/provider/quality owners and does not import smart-search as Kernel", () => {
    for (const rel of ABI_FILES) {
      const content = fs.readFileSync(path.join(templatesRoot, rel), "utf-8");
      expect(content, rel).toContain("context-progressive");
      expect(content, rel).toContain("middleware");
      expect(content, rel).toContain("retrieval-extended");
      expect(content, rel).not.toMatch(/^\s*(?:from|import)\s+smart[_-]?search\b/m);
      expect(content, rel).not.toContain("已注入 Prompt");
    }
  });

  it("build_retrieval_pack CLI refuses missing collected-evidence as AC Evidence", () => {
    const result = runPython(
      [
        path.join(tmpDir, ".cstl", "scripts", "build_retrieval_pack.py"),
        "--json",
      ],
      { cwd: tmpDir, input: "{}" },
    );
    expect(result.status).toBe(0);
    const pack = JSON.parse(result.stdout) as {
      inputRole: string;
      outputRole: string;
      collectionStatus: string;
      closeEvidenceEligible: boolean;
      notAcEvidence: boolean;
      reason: string;
      contextPack: { selected: unknown[] };
      scoredEvidence: { total: number; items: unknown[] };
      warnings: string[];
    };
    expect(pack.inputRole).toBe("collected-evidence");
    expect(pack.outputRole).toBe("retrieval-pack");
    expect(pack.collectionStatus).toBe("missing");
    expect(pack.closeEvidenceEligible).toBe(false);
    expect(pack.notAcEvidence).toBe(true);
    expect(pack.reason.toLowerCase()).toContain("not ac evidence");
    expect(pack.contextPack.selected).toEqual([]);
    expect(pack.scoredEvidence.total).toBe(0);
    expect(pack.scoredEvidence.items).toEqual([]);
    expect(pack.warnings).toContain("missing-collected-evidence");
    expect(pack).not.toHaveProperty("evidenceEnvelope");
    expect(JSON.stringify(pack)).not.toMatch(/已注入 Prompt/);
    expect(pack.reason).not.toMatch(/AC Evidence success/i);
  });

  it("research-end hook exits 0 and writes no pack when research artifacts are missing", () => {
    const hookPath = writeHook(tmpDir, "research-end-retrieval-pack.py");
    const packPath = path.join(
      tmpDir,
      TASK_PATH,
      "research",
      "retrieval-pack-latest.json",
    );
    const result = runPython([hookPath], {
      cwd: tmpDir,
      env: { TRELLIS_CONTEXT_ID: SESSION_ID },
      input: JSON.stringify({
        cwd: tmpDir,
        cursor_version: "1.0.0",
        session_id: SESSION_ID,
      }),
    });
    expect(result.status).toBe(0);
    expect(fs.existsSync(packPath)).toBe(false);
    expect(fs.existsSync(path.join(tmpDir, TASK_PATH, "research"))).toBe(false);
    expect(result.stdout.trim()).toBe("");
  });

  it("inject-retrieval-plan writes local telemetry and does not claim Prompt injection", () => {
    const taskJson = path.join(tmpDir, TASK_PATH, "task.json");
    const existing = JSON.parse(fs.readFileSync(taskJson, "utf-8")) as {
      ondemand_modules?: { active: string[] };
    };
    existing.ondemand_modules = { active: ["retrieval-extended"] };
    fs.writeFileSync(taskJson, `${JSON.stringify(existing, null, 2)}\n`);
    const hookPath = writeHook(tmpDir, "inject-retrieval-plan.py");
    const result = runPython([hookPath], {
      cwd: tmpDir,
      env: { TRELLIS_CONTEXT_ID: SESSION_ID },
      input: JSON.stringify({
        cwd: tmpDir,
        cursor_version: "1.0.0",
        session_id: SESSION_ID,
        prompt: "where is TaskStore defined in the codebase",
      }),
    });
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("");
    expect(`${result.stdout}\n${result.stderr}`).not.toContain("已注入 Prompt");
    const logPath = path.join(
      tmpDir,
      ".cstl",
      ".runtime",
      "retrieval-plan-events.log",
    );
    expect(fs.existsSync(logPath)).toBe(true);
    const event = JSON.parse(fs.readFileSync(logPath, "utf-8").trim().split(/\r?\n/).pop() ?? "{}") as {
      action?: string;
      assurance?: string;
      promptInjected?: boolean;
      additionalContextDelivered?: boolean;
      note?: string;
    };
    expect(event.action).toBe("telemetry-only");
    expect(event.assurance).toBe("local-telemetry-only");
    expect(event.promptInjected).toBe(false);
    expect(event.additionalContextDelivered).toBe(false);
    expect(event.note ?? "").not.toContain("已注入 Prompt");
    expect(JSON.stringify(event)).not.toMatch(/"additional_context"\s*:/);
  });

  it("retrieval hooks exit 0 without pack or telemetry when retrieval-extended is unactivated", () => {
    fs.mkdirSync(path.join(tmpDir, TASK_PATH, "research"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, TASK_PATH, "research", "notes.md"),
      "# collected notes\n",
      "utf-8",
    );
    const packPath = path.join(
      tmpDir,
      TASK_PATH,
      "research",
      "retrieval-pack-latest.json",
    );
    const stopHook = writeHook(tmpDir, "research-end-retrieval-pack.py");
    const stop = runPython([stopHook], {
      cwd: tmpDir,
      env: { TRELLIS_CONTEXT_ID: SESSION_ID },
      input: JSON.stringify({
        cwd: tmpDir,
        cursor_version: "1.0.0",
        session_id: SESSION_ID,
      }),
    });
    expect(stop.status).toBe(0);
    expect(stop.stdout.trim()).toBe("");
    expect(fs.existsSync(packPath)).toBe(false);
    expect(`${stop.stdout}\n${stop.stderr}`).not.toContain("已注入 Prompt");
    expect(stop.stdout).not.toContain("wrote `");

    const planHook = writeHook(tmpDir, "inject-retrieval-plan.py");
    const plan = runPython([planHook], {
      cwd: tmpDir,
      env: { TRELLIS_CONTEXT_ID: SESSION_ID },
      input: JSON.stringify({
        cwd: tmpDir,
        cursor_version: "1.0.0",
        session_id: SESSION_ID,
        prompt: "where is TaskStore defined in the codebase",
      }),
    });
    expect(plan.status).toBe(0);
    expect(plan.stdout.trim()).toBe("");
    const logPath = path.join(
      tmpDir,
      ".cstl",
      ".runtime",
      "retrieval-plan-events.log",
    );
    expect(fs.existsSync(logPath)).toBe(false);
    expect(`${plan.stdout}\n${plan.stderr}`).not.toContain("已注入 Prompt");
  });
});
