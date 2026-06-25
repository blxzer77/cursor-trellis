import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  scriptsInit,
  commonInit,
  commonPaths,
  commonDeveloper,
  commonGitContext,
  commonTaskQueue,
  commonTaskUtils,
  commonActiveTask,
  commonCliAdapter,
  commonArtifactSearch,
  commonSessionMemory,
  commonSmartSearchEvidence,
  commonSmartSearchResolve,
  commonRetrievalEvidence,
  commonCodebaseRetrievalRouter,
  commonProjectFileStats,
  commonRetrievalAgentInstructions,
  commonContextPack,
  commonRetrievalPack,
  commonRetrievalPackContext,
  routeCodebaseRetrievalScript,
  codegraphSessionSmokeScript,
  getDeveloperScript,
  initDeveloperScript,
  taskScript,
  getContextScript,
  addSessionScript,
  searchArtifactsScript,
  searchMemoryScript,
  runSmartSearchScript,
  buildContextPackScript,
  buildRetrievalPackScript,
  workflowMdTemplate,
  gitignoreTemplate,
  getAllScripts,
  getAllTaskTemplates,
} from "../../src/templates/trellis/index.js";

// =============================================================================
// Template Constants — module-level string exports
// =============================================================================

describe("trellis template constants", () => {
  const allTemplates = {
    scriptsInit,
    commonInit,
    commonPaths,
    commonDeveloper,
    commonGitContext,
    commonTaskQueue,
    commonTaskUtils,
    commonActiveTask,
    commonCliAdapter,
    commonArtifactSearch,
    commonSessionMemory,
    commonSmartSearchEvidence,
    getDeveloperScript,
    initDeveloperScript,
    taskScript,
    getContextScript,
    addSessionScript,
    searchArtifactsScript,
    searchMemoryScript,
    runSmartSearchScript,
    workflowMdTemplate,
    gitignoreTemplate,
  };

  function normalizeLineEndings(content: string): string {
    return content.replace(/\r\n/g, "\n");
  }

  function readMarketplaceWorkflow(
    relativePath: string,
  ): string | undefined {
    const repoRoot = fs.existsSync(path.join(process.cwd(), "marketplace"))
      ? process.cwd()
      : path.resolve(process.cwd(), "../..");
    const workflowPath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(workflowPath)) {
      return undefined;
    }
    return fs.readFileSync(workflowPath, "utf-8");
  }

  function inProgressBreadcrumb(): string {
    return workflowStateBreadcrumb("in_progress");
  }

  function workflowStateBreadcrumb(status: string): string {
    const match = new RegExp(
      `^\\[workflow-state:${status}\\]\\r?\\n([\\s\\S]*?)^\\[/workflow-state:${status}\\]`,
      "m",
    ).exec(
      workflowMdTemplate,
    );
    if (!match) {
      throw new Error(`${status} breadcrumb block must exist in workflow.md`);
    }
    return match[1];
  }

  function stepSection(step: string): string {
    const pattern = new RegExp(
      `#### ${step.replace(".", "\\.")}[^\\n]*\\n([\\s\\S]*?)(?=\\n#### |\\n### |$)`,
    );
    const match = pattern.exec(workflowMdTemplate);
    if (!match) {
      throw new Error(`workflow.md step ${step} must exist`);
    }
    return match[1];
  }

  it("all templates are non-empty strings", () => {
    for (const [name, content] of Object.entries(allTemplates)) {
      expect(content.length, `${name} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it("Python scripts contain valid Python syntax indicators", () => {
    // scriptsInit (__init__.py) only has docstrings, so use scripts with actual code
    const pyScripts = [
      commonInit,
      commonPaths,
      commonActiveTask,
      commonArtifactSearch,
      commonSessionMemory,
      commonSmartSearchEvidence,
      getDeveloperScript,
      taskScript,
      searchArtifactsScript,
      searchMemoryScript,
      runSmartSearchScript,
    ];
    for (const script of pyScripts) {
      expect(
        script.includes("import") ||
          script.includes("def ") ||
          script.includes("class ") ||
          script.includes("#"),
      ).toBe(true);
    }
  });

  it("scriptsInit is a Python docstring module", () => {
    expect(scriptsInit).toContain('"""');
  });

  it("workflowMdTemplate is markdown", () => {
    expect(workflowMdTemplate).toContain("#");
  });

  it("marketplace native workflow mirror matches the bundled workflow", () => {
    const marketplaceNative = readMarketplaceWorkflow(
      "marketplace/workflows/native/workflow.md",
    );
    if (marketplaceNative === undefined) return;

    expect(normalizeLineEndings(marketplaceNative)).toBe(
      normalizeLineEndings(workflowMdTemplate),
    );
  });

  it("marketplace TDD workflow planning breadcrumbs include behavior gates", () => {
    const tddWorkflow = readMarketplaceWorkflow(
      "marketplace/workflows/tdd/workflow.md",
    );
    if (tddWorkflow === undefined) return;
    const normalized = normalizeLineEndings(tddWorkflow);
    const planning =
      /^\[workflow-state:planning\]\n([\s\S]*?)^\[\/workflow-state:planning\]/m.exec(
        normalized,
      )?.[1];
    const planningInline =
      /^\[workflow-state:planning-inline\]\n([\s\S]*?)^\[\/workflow-state:planning-inline\]/m.exec(
        normalized,
      )?.[1];

    for (const block of [planning, planningInline]) {
      expect(block).toContain("observable behavior slices");
      expect(block).toContain("public interface under test");
      expect(block).toContain("mock boundaries");
    }
  });

  it("[issue-225] workflow.md in_progress breadcrumb has class-2 sub-agent dispatch protocol", () => {
    // Cursor-only fork: dispatch guidance targets Cursor sub-agents via
    // Selected task path injection (no multi-platform host list).
    const block = inProgressBreadcrumb();
    expect(block).toContain("Selected task:");
    expect(block.toLowerCase()).toContain("dispatch prompt");
  });

  it("workflow.md planning breadcrumbs mention parent child split guidance", () => {
    const planning = workflowStateBreadcrumb("planning");
    expect(planning).toContain("Multi-deliverable scope");
    expect(planning).toContain("parent task plus independently verifiable child tasks");
    expect(planning).toContain("not implied by tree position");
  });

  it("[issue-237] workflow.md in_progress breadcrumb self-exempts implement/check sub-agents", () => {
    const block = inProgressBreadcrumb();
    expect(block).toContain("execution_mode");
    expect(block).toContain("`worker`");
    expect(block).toContain("Sub-agent self-exemption");
    expect(block).toContain("already running as `trellis-implement`");
    expect(block).toContain("do NOT spawn another `trellis-implement`");
    expect(block).toContain("already running as `trellis-check`");
    expect(block).toContain("do NOT spawn another `trellis-check`");
    expect(block).toContain("main session only");
  });

  it("[issue-237] workflow.md Phase 2 dispatch steps require prompt recursion guards", () => {
    expect(workflowMdTemplate).toContain("execution_mode");
    expect(workflowMdTemplate).toContain("trellis-implement");
    expect(workflowMdTemplate).toContain(
      "must not spawn another `trellis-implement` / `trellis-check`",
    );
    expect(workflowMdTemplate).toContain("trellis-check");
    expect(workflowMdTemplate).toContain(
      "must not spawn another check/implement agent",
    );
  });

  it("workflow.md documents parent child task tree responsibilities", () => {
    expect(workflowMdTemplate).toContain("### Parent / Child Task Trees");
    expect(workflowMdTemplate).toContain(
      "several independently verifiable deliverables",
    );
    expect(workflowMdTemplate).toContain(
      "Parent/child structure is not a dependency system",
    );
    expect(workflowMdTemplate).toContain("--parent <parent-dir>");
    expect(workflowMdTemplate).toContain("task.py add-subtask <parent> <child>");
    expect(workflowMdTemplate).toContain(
      "start the child that owns the next independently verifiable deliverable",
    );
  });

  it("workflow.md step 1.1 includes parent child split guidance", () => {
    const step = stepSection("1.1");
    expect(step).toContain("When considering a parent/child split");
    expect(step).toContain("Parent tasks own source requirements");
    expect(step).toContain("Child tasks own actual deliverables");
    expect(step).toContain(
      "Parent/child structure is not a dependency system",
    );
    expect(step).toContain("Do not start the parent unless");
  });

  it("gitignoreTemplate contains ignore patterns", () => {
    expect(gitignoreTemplate).toContain(".developer");
    expect(gitignoreTemplate).toContain("worktrees/");
    expect(gitignoreTemplate).toContain("__pycache__");
  });

  it("workflow.md documents reusable research artifact metadata", () => {
    expect(workflowMdTemplate).toContain("Optional reusable-research frontmatter");
    expect(workflowMdTemplate).toContain("doc_type: research");
    expect(workflowMdTemplate).toContain("status: active");
    expect(workflowMdTemplate).toContain("confidence: medium");
    expect(workflowMdTemplate).toContain("related_files:");
    expect(workflowMdTemplate).toContain("Quick Answer");
    expect(workflowMdTemplate).toContain("Key Evidence");
  });

  it("workflow.md connects retrieval layers to task evidence artifacts", () => {
    expect(workflowMdTemplate).toContain("**Retrieval during research**");
    expect(workflowMdTemplate).toContain("search_artifacts.py --query");
    expect(workflowMdTemplate).toContain("durable Trellis specs");
    expect(workflowMdTemplate).toContain("codebase-retrieval");
    expect(workflowMdTemplate).toContain("candidate -> corroborated candidate");
    expect(workflowMdTemplate).toContain(
      "Record exploratory chains in `{TASK_DIR}/research/`",
    );
    expect(workflowMdTemplate).toContain(
      "unresolved adapter or artifact-search gaps belong in `verify.md`",
    );
  });
});

// =============================================================================
// getAllScripts — pure function assembling pre-loaded strings
// =============================================================================

describe("getAllScripts", () => {
  it("returns a Map", () => {
    const scripts = getAllScripts();
    expect(scripts).toBeInstanceOf(Map);
  });

  it("contains expected script entries", () => {
    const scripts = getAllScripts();
    expect(scripts.has("__init__.py")).toBe(true);
    expect(scripts.has("common/__init__.py")).toBe(true);
    expect(scripts.has("common/paths.py")).toBe(true);
    expect(scripts.has("common/active_task.py")).toBe(true);
    expect(scripts.has("common/artifact_search.py")).toBe(true);
    expect(scripts.has("common/session_memory.py")).toBe(true);
    expect(scripts.has("common/smart_search_evidence.py")).toBe(true);
    expect(scripts.has("common/smart_search_resolve.py")).toBe(true);
    expect(scripts.has("common/retrieval_evidence.py")).toBe(true);
    expect(scripts.has("common/retrieval_agent_instructions.py")).toBe(true);
    expect(scripts.has("common/context_pack.py")).toBe(true);
    expect(scripts.has("common/retrieval_pack.py")).toBe(true);
    expect(scripts.has("common/retrieval_pack_context.py")).toBe(true);
    expect(scripts.has("build_context_pack.py")).toBe(true);
    expect(scripts.has("build_retrieval_pack.py")).toBe(true);
    expect(scripts.has("task.py")).toBe(true);
    expect(scripts.has("get_developer.py")).toBe(true);
    expect(scripts.has("search_artifacts.py")).toBe(true);
    expect(scripts.has("search_memory.py")).toBe(true);
    expect(scripts.has("run_smart_search.py")).toBe(true);
    expect(scripts.has("common/execution_strategy.py")).toBe(true);
  });

  it("has at least one entry", () => {
    const scripts = getAllScripts();
    expect(scripts.size).toBeGreaterThan(0);
  });

  it("all values are non-empty strings", () => {
    const scripts = getAllScripts();
    for (const [key, value] of scripts) {
      expect(value.length, `${key} should be non-empty`).toBeGreaterThan(0);
    }
  });

  it("values match the exported constants", () => {
    const scripts = getAllScripts();
    expect(scripts.get("__init__.py")).toBe(scriptsInit);
    expect(scripts.get("common/__init__.py")).toBe(commonInit);
    expect(scripts.get("common/artifact_search.py")).toBe(commonArtifactSearch);
    expect(scripts.get("common/session_memory.py")).toBe(commonSessionMemory);
    expect(scripts.get("common/smart_search_evidence.py")).toBe(
      commonSmartSearchEvidence,
    );
    expect(scripts.get("common/smart_search_resolve.py")).toBe(
      commonSmartSearchResolve,
    );
    expect(scripts.get("common/retrieval_evidence.py")).toBe(
      commonRetrievalEvidence,
    );
    expect(scripts.get("common/codebase_retrieval_router.py")).toBe(
      commonCodebaseRetrievalRouter,
    );
    expect(scripts.get("common/project_file_stats.py")).toBe(
      commonProjectFileStats,
    );
    expect(scripts.get("common/retrieval_agent_instructions.py")).toBe(
      commonRetrievalAgentInstructions,
    );
    expect(scripts.get("common/context_pack.py")).toBe(commonContextPack);
    expect(scripts.get("common/retrieval_pack.py")).toBe(commonRetrievalPack);
    expect(scripts.get("common/retrieval_pack_context.py")).toBe(
      commonRetrievalPackContext,
    );
    expect(scripts.get("build_context_pack.py")).toBe(buildContextPackScript);
    expect(scripts.get("build_retrieval_pack.py")).toBe(buildRetrievalPackScript);
    expect(scripts.get("route_codebase_retrieval.py")).toBe(
      routeCodebaseRetrievalScript,
    );
    expect(scripts.get("codegraph_session_smoke.py")).toBe(
      codegraphSessionSmokeScript,
    );
    expect(scripts.get("task.py")).toBe(taskScript);
    expect(scripts.get("search_artifacts.py")).toBe(searchArtifactsScript);
    expect(scripts.get("search_memory.py")).toBe(searchMemoryScript);
    expect(scripts.get("run_smart_search.py")).toBe(runSmartSearchScript);
  });

  it("does not contain multi_agent entries", () => {
    const scripts = getAllScripts();
    for (const [key] of scripts) {
      expect(key, `${key} should not be a multi_agent script`).not.toContain("multi_agent");
    }
  });

  it("does not ship maintainer-only probe or test scripts", () => {
    const scripts = getAllScripts();
    expect(scripts.has("cursor_retrieval_probe.py")).toBe(false);
    expect(scripts.has("common/test_retrieval_arbitration.py")).toBe(false);
    expect(scripts.has("aggregate_retrieval_telemetry.py")).toBe(false);
    expect(scripts.has("batch_plan_envelope.py")).toBe(false);
  });
});

describe("getAllTaskTemplates", () => {
  it("returns release-readiness and release-execution template files", () => {
    const templates = getAllTaskTemplates();
    expect(templates.size).toBe(8);
    for (const rel of [
      "tasks/templates/release-readiness/prd.md",
      "tasks/templates/release-readiness/design.md",
      "tasks/templates/release-readiness/implement.md",
      "tasks/templates/release-readiness/handoff-template.md",
      "tasks/templates/release-execution/prd.md",
      "tasks/templates/release-execution/design.md",
      "tasks/templates/release-execution/implement.md",
      "tasks/templates/release-execution/handoff-template.md",
    ]) {
      expect(templates.has(rel), rel).toBe(true);
      const template = templates.get(rel);
      expect(template, rel).toBeDefined();
      expect(template?.length).toBeGreaterThan(0);
    }
  });

  it("release-execution templates require explicit publish approval", () => {
    const templates = getAllTaskTemplates();
    const executionDesign = templates.get(
      "tasks/templates/release-execution/design.md",
    );
    expect(executionDesign).toBeDefined();
    expect(executionDesign).toContain("Approval gate (mandatory)");
    expect(executionDesign).toContain("explicit user approval");
    const readinessPrd = templates.get(
      "tasks/templates/release-readiness/prd.md",
    );
    expect(readinessPrd).toBeDefined();
    expect(readinessPrd).toMatch(/without.*publishing/i);
  });
});
