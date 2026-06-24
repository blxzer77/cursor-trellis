import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getAllScripts } from "../../src/templates/trellis/index.js";

function resolvePython(): string | null {
  const candidates =
    process.platform === "win32" ? ["python", "python3"] : ["python3", "python"];
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ["--version"], { stdio: "ignore" });
      return candidate;
    } catch {
      // Try the next common Python launcher name.
    }
  }
  return null;
}

const pythonCmd = resolvePython();

interface SmartSearchManifest {
  version: number;
  source: string;
  query: string;
  intent: string;
  command: string;
  outputPath: string;
  evidenceDir: string;
  manifestPath: string;
  status: string;
  summary: string;
  citations: { title?: string; url?: string; provider?: string }[];
  gapCheck: Record<string, unknown>;
  providerAttempts: unknown[];
  degraded: boolean;
  doctor: Record<string, unknown>;
  error?: string;
}

function writeFile(root: string, rel: string, content: string): void {
  const target = path.join(root, rel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf-8");
}

function writeTrellisScripts(root: string): void {
  const scriptsDir = path.join(root, ".trellis", "scripts");
  for (const [rel, content] of getAllScripts()) {
    writeFile(scriptsDir, rel, content);
  }
}

function seedProject(root: string): void {
  writeTrellisScripts(root);
  writeFile(root, ".trellis/.developer", "name=test-dev\n");
  writeFile(root, ".trellis/tasks/06-13-smart/prd.md", "# Smart Task\n");
  writeFile(
    root,
    ".trellis/tasks/06-13-smart/task.json",
    JSON.stringify(
      {
        id: "smart",
        name: "smart",
        title: "Smart Search Task",
        description: "Exercise Smart Search evidence capture.",
        status: "in_progress",
        assignee: "test-dev",
        priority: "P1",
        createdAt: "2026-06-13",
        children: [],
        parent: null,
        package: "trellis",
      },
      null,
      2,
    ),
  );
}

function writeFakeSmartSearch(root: string): string {
  const binDir = path.join(root, "bin");
  fs.mkdirSync(binDir, { recursive: true });
  writeFile(
    binDir,
    "fake-smart-search.py",
    [
      "import json",
      "import pathlib",
      "import sys",
      "",
      "args = sys.argv[1:]",
      "command = args[0] if args else ''",
      "if command == 'doctor':",
      "    print(json.dumps({'ok': True, 'config_status': 'ok', 'minimum_profile_ok': True, 'capability_status': {'main_search': 'ok'}, 'resolved_evidence_dir': 'C:/tmp/evidence'}))",
      "    raise SystemExit(0)",
      "if command == 'research':",
      "    output = pathlib.Path(args[args.index('--output') + 1])",
      "    output.parent.mkdir(parents=True, exist_ok=True)",
      "    payload = {",
      "        'ok': True,",
      "        'mode': 'deep_research_execution',",
      "        'query_mode': 'research',",
      "        'question': args[1],",
      "        'final_answer': 'Fetched evidence supports the answer.',",
      "        'content': 'Fetched evidence supports the answer.',",
      "        'citations': [{'title': 'Example', 'url': 'https://example.com', 'provider': 'jina'}],",
      "        'gap_check': {'gaps': []},",
      "        'provider_attempts': [{'provider': 'jina', 'status': 'ok'}],",
      "        'degraded': False,",
      "        'route_policy_version': 'research-router-v1',",
      "        'evidence_dir': str(output.parent),",
      "    }",
      "    output.write_text(json.dumps(payload), encoding='utf-8')",
      "    print(json.dumps(payload))",
      "    raise SystemExit(0)",
      "print(json.dumps({'ok': False, 'error': 'unexpected command'}))",
      "raise SystemExit(2)",
      "",
    ].join("\n"),
  );

  if (process.platform === "win32") {
    const shim = path.join(binDir, "smart-search.cmd");
    writeFile(
      binDir,
      "smart-search.cmd",
      `@echo off\r\n"${pythonCmd}" "%~dp0fake-smart-search.py" %*\r\n`,
    );
    return shim;
  } else {
    const shim = path.join(binDir, "smart-search");
    fs.writeFileSync(
      shim,
      `#!/bin/sh\n"${pythonCmd}" "$(dirname "$0")/fake-smart-search.py" "$@"\n`,
      "utf-8",
    );
    fs.chmodSync(shim, 0o755);
    return shim;
  }
}

function runSmartSearch(
  root: string,
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(
    pythonCmd as string,
    [path.join(root, ".trellis", "scripts", "run_smart_search.py"), ...args],
    { cwd: root, encoding: "utf-8", env },
  );
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

describe.skipIf(pythonCmd === null)("run_smart_search.py", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-smart-search-"));
    seedProject(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("runs smart-search and writes a task-local evidence manifest", () => {
    const smartSearchCommand = writeFakeSmartSearch(tmpDir);
    const result = runSmartSearch(
      tmpDir,
      [
        "React docs",
        "--smart-search-command",
        smartSearchCommand,
        "--task",
        ".trellis/tasks/06-13-smart",
        "--run-id",
        "unit-run",
        "--json",
      ],
    );

    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");

    const manifest = JSON.parse(result.stdout) as SmartSearchManifest;
    expect(manifest).toMatchObject({
      version: 1,
      source: "smart-search",
      query: "React docs",
      intent: "deep-research",
      status: "ok",
      outputPath:
        ".trellis/tasks/06-13-smart/research/smart-search/unit-run/deep_research.json",
      evidenceDir: ".trellis/tasks/06-13-smart/research/smart-search/unit-run",
      manifestPath: ".trellis/tasks/06-13-smart/research/smart-search/unit-run/manifest.json",
      degraded: false,
      routePolicyVersion: "research-router-v1",
    });
    expect(manifest.command).toContain("research");
    expect(manifest.command).toContain('"React docs"');
    expect(manifest.command).toContain("--output");
    expect(manifest.summary).toContain("Fetched evidence supports");
    expect(manifest.citations).toEqual([
      { title: "Example", url: "https://example.com", provider: "jina" },
    ]);
    expect(manifest.gapCheck).toEqual({ gaps: [] });
    expect(manifest.providerAttempts).toEqual([
      { provider: "jina", status: "ok" },
    ]);
    expect(manifest.doctor.minimum_profile_ok).toBe(true);

    const manifestPath = path.join(
      tmpDir,
      ".trellis",
      "tasks",
      "06-13-smart",
      "research",
      "smart-search",
      "unit-run",
      "manifest.json",
    );
    expect(JSON.parse(fs.readFileSync(manifestPath, "utf-8"))).toEqual(manifest);
  });

  it("records a not_configured manifest when smart-search is unavailable", () => {
    const missingExecutable = path.join(tmpDir, "missing-smart-search");
    const result = runSmartSearch(
      tmpDir,
      [
        "React docs",
        "--smart-search-command",
        missingExecutable,
        "--task",
        ".trellis/tasks/06-13-smart",
        "--run-id",
        "missing-cli",
        "--json",
      ],
    );

    expect(result.status).toBe(4);
    const manifest = JSON.parse(result.stdout) as SmartSearchManifest;
    expect(manifest.status).toBe("not_configured");
    expect(manifest.error).toContain("could not be resolved");
    expect(manifest.outputPath).toBe(
      ".trellis/tasks/06-13-smart/research/smart-search/missing-cli/deep_research.json",
    );
    expect(manifest.citations).toEqual([]);
  });

  it("optional repo wrappers include polyrepo sibling layouts", () => {
    const repoRoot = path.join(tmpDir, "polyrepo");
    const wrapper = path.join(
      repoRoot,
      "cursor-trellis",
      "packages",
      "cli",
      "bin",
      "smart-search.js",
    );
    fs.mkdirSync(path.dirname(wrapper), { recursive: true });
    fs.writeFileSync(wrapper, "#!/usr/bin/env node\n", "utf-8");
    writeTrellisScripts(repoRoot);

    const result = spawnSync(
      pythonCmd!,
      [
        "-c",
        [
          "import json",
          "from common.smart_search_resolve import _optional_repo_wrappers",
          "from pathlib import Path",
          `root = Path(${JSON.stringify(repoRoot)})`,
          "wrappers = _optional_repo_wrappers(root)",
          "print(json.dumps(wrappers[0] if wrappers else None))",
        ].join("\n"),
      ],
      {
        cwd: path.join(repoRoot, ".trellis", "scripts"),
        encoding: "utf-8",
      },
    );

    expect(result.status).toBe(0);
    const argv = JSON.parse(result.stdout.trim()) as string[] | null;
    expect(argv).not.toBeNull();
    expect(argv!.join(" ")).toContain("cursor-trellis");
    expect(argv!.join(" ")).toContain("smart-search.js");
  });
});
