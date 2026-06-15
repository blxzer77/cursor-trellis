/**
 * Trellis workflow templates
 *
 * These are GENERIC templates for user projects.
 * Do NOT use Trellis project's own .trellis/ directory (which may be customized).
 *
 * Directory structure:
 *   trellis/
 *   ├── scripts/
 *   │   ├── __init__.py
 *   │   ├── common/           # Shared utilities (Python)
 *   │   └── *.py              # Main scripts (Python)
 *   ├── scripts-shell-archive/ # Archived shell scripts (for reference)
 *   ├── workflow.md           # Workflow guide
 *   ├── config.yaml            # Trellis configuration
 *   └── gitignore.txt         # .gitignore content
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function readTemplate(relativePath: string): string {
  return readFileSync(join(__dirname, relativePath), "utf-8");
}

// Python scripts - package init
export const scriptsInit = readTemplate("scripts/__init__.py");

// Python scripts - common
export const commonInit = readTemplate("scripts/common/__init__.py");
export const commonPaths = readTemplate("scripts/common/paths.py");
export const commonDeveloper = readTemplate("scripts/common/developer.py");
export const commonGitContext = readTemplate("scripts/common/git_context.py");
export const commonTaskQueue = readTemplate("scripts/common/task_queue.py");
export const commonTaskUtils = readTemplate("scripts/common/task_utils.py");
export const commonActiveTask = readTemplate("scripts/common/active_task.py");
export const commonCliAdapter = readTemplate("scripts/common/cli_adapter.py");
export const commonCliEnvironment = readTemplate(
  "scripts/common/cli_environment.py",
);
export const commonConfig = readTemplate("scripts/common/config.py");
export const commonIo = readTemplate("scripts/common/io.py");
export const commonLog = readTemplate("scripts/common/log.py");
export const commonGit = readTemplate("scripts/common/git.py");
export const commonTypes = readTemplate("scripts/common/types.py");
export const commonTasks = readTemplate("scripts/common/tasks.py");
export const commonTaskContext = readTemplate("scripts/common/task_context.py");
export const commonTaskStore = readTemplate("scripts/common/task_store.py");
export const commonTaskDashboard = readTemplate(
  "scripts/common/task_dashboard.py",
);
export const commonTaskGates = readTemplate("scripts/common/task_gates.py");
export const commonTaskMap = readTemplate("scripts/common/task_map.py");
export const commonParentOrchestration = readTemplate(
  "scripts/common/parent_orchestration.py",
);
export const commonArtifactSearch = readTemplate(
  "scripts/common/artifact_search.py",
);
export const commonSessionMemory = readTemplate(
  "scripts/common/session_memory.py",
);
export const commonSmartSearchEvidence = readTemplate(
  "scripts/common/smart_search_evidence.py",
);
export const commonRetrievalEvidence = readTemplate(
  "scripts/common/retrieval_evidence.py",
);
export const commonCodebaseRetrievalRouter = readTemplate(
  "scripts/common/codebase_retrieval_router.py",
);
export const commonRetrievalAdapterMetadata = readTemplate(
  "scripts/common/retrieval_adapter_metadata.py",
);
export const commonContextPack = readTemplate("scripts/common/context_pack.py");
export const commonRetrievalPack = readTemplate("scripts/common/retrieval_pack.py");
export const commonRetrievalPackContext = readTemplate(
  "scripts/common/retrieval_pack_context.py",
);
export const commonSessionContext = readTemplate(
  "scripts/common/session_context.py",
);
export const commonPackagesContext = readTemplate(
  "scripts/common/packages_context.py",
);
export const commonWorkflowPhase = readTemplate(
  "scripts/common/workflow_phase.py",
);
export const commonTrellisConfig = readTemplate(
  "scripts/common/trellis_config.py",
);
export const commonSafeCommit = readTemplate("scripts/common/safe_commit.py");

// Python scripts - main
export const getDeveloperScript = readTemplate("scripts/get_developer.py");
export const initDeveloperScript = readTemplate("scripts/init_developer.py");
export const taskScript = readTemplate("scripts/task.py");
export const getContextScript = readTemplate("scripts/get_context.py");
export const addSessionScript = readTemplate("scripts/add_session.py");
export const searchArtifactsScript = readTemplate("scripts/search_artifacts.py");
export const searchMemoryScript = readTemplate("scripts/search_memory.py");
export const runSmartSearchScript = readTemplate("scripts/run_smart_search.py");
export const buildContextPackScript = readTemplate("scripts/build_context_pack.py");
export const buildRetrievalPackScript = readTemplate("scripts/build_retrieval_pack.py");
export const routeCodebaseRetrievalScript = readTemplate(
  "scripts/route_codebase_retrieval.py",
);

// Configuration files
export const workflowMdTemplate = readTemplate("workflow.md");
export const configYamlTemplate = readTemplate("config.yaml");
export const gitignoreTemplate = readTemplate("gitignore.txt");

const RELEASE_READINESS_TASK_TEMPLATE_FILES = [
  "prd.md",
  "design.md",
  "implement.md",
  "handoff-template.md",
] as const;

const RELEASE_EXECUTION_TASK_TEMPLATE_FILES = [
  "prd.md",
  "design.md",
  "implement.md",
  "handoff-template.md",
] as const;

function readTaskTemplate(relativePath: string): string {
  return readTemplate(join("tasks", "templates", relativePath));
}

/**
 * Optional task artifact templates (under `.trellis/tasks/templates/`).
 * Not applied by `task.py create`; copy into a new task directory when starting
 * release-readiness or release-execution work.
 */
export function getAllTaskTemplates(): Map<string, string> {
  const templates = new Map<string, string>();
  for (const file of RELEASE_READINESS_TASK_TEMPLATE_FILES) {
    templates.set(
      `tasks/templates/release-readiness/${file}`,
      readTaskTemplate(`release-readiness/${file}`),
    );
  }
  for (const file of RELEASE_EXECUTION_TASK_TEMPLATE_FILES) {
    templates.set(
      `tasks/templates/release-execution/${file}`,
      readTaskTemplate(`release-execution/${file}`),
    );
  }
  return templates;
}

/**
 * Get all script templates as a map of relative path to content
 */
export function getAllScripts(): Map<string, string> {
  const scripts = new Map<string, string>();

  // Package init
  scripts.set("__init__.py", scriptsInit);

  // Common
  scripts.set("common/__init__.py", commonInit);
  scripts.set("common/paths.py", commonPaths);
  scripts.set("common/developer.py", commonDeveloper);
  scripts.set("common/git_context.py", commonGitContext);
  scripts.set("common/task_queue.py", commonTaskQueue);
  scripts.set("common/task_utils.py", commonTaskUtils);
  scripts.set("common/active_task.py", commonActiveTask);
  scripts.set("common/cli_adapter.py", commonCliAdapter);
  scripts.set("common/cli_environment.py", commonCliEnvironment);
  scripts.set("common/config.py", commonConfig);
  scripts.set("common/io.py", commonIo);
  scripts.set("common/log.py", commonLog);
  scripts.set("common/git.py", commonGit);
  scripts.set("common/types.py", commonTypes);
  scripts.set("common/tasks.py", commonTasks);
  scripts.set("common/task_context.py", commonTaskContext);
  scripts.set("common/task_store.py", commonTaskStore);
  scripts.set("common/task_dashboard.py", commonTaskDashboard);
  scripts.set("common/task_gates.py", commonTaskGates);
  scripts.set("common/task_map.py", commonTaskMap);
  scripts.set("common/parent_orchestration.py", commonParentOrchestration);
  scripts.set("common/artifact_search.py", commonArtifactSearch);
  scripts.set("common/session_memory.py", commonSessionMemory);
  scripts.set("common/smart_search_evidence.py", commonSmartSearchEvidence);
  scripts.set("common/retrieval_evidence.py", commonRetrievalEvidence);
  scripts.set("common/codebase_retrieval_router.py", commonCodebaseRetrievalRouter);
  scripts.set("common/retrieval_adapter_metadata.py", commonRetrievalAdapterMetadata);
  scripts.set("common/context_pack.py", commonContextPack);
  scripts.set("common/retrieval_pack.py", commonRetrievalPack);
  scripts.set("common/retrieval_pack_context.py", commonRetrievalPackContext);
  scripts.set("common/session_context.py", commonSessionContext);
  scripts.set("common/packages_context.py", commonPackagesContext);
  scripts.set("common/workflow_phase.py", commonWorkflowPhase);
  scripts.set("common/trellis_config.py", commonTrellisConfig);
  scripts.set("common/safe_commit.py", commonSafeCommit);

  // Main
  scripts.set("get_developer.py", getDeveloperScript);
  scripts.set("init_developer.py", initDeveloperScript);
  scripts.set("task.py", taskScript);
  scripts.set("get_context.py", getContextScript);
  scripts.set("add_session.py", addSessionScript);
  scripts.set("search_artifacts.py", searchArtifactsScript);
  scripts.set("search_memory.py", searchMemoryScript);
  scripts.set("run_smart_search.py", runSmartSearchScript);
  scripts.set("build_context_pack.py", buildContextPackScript);
  scripts.set("build_retrieval_pack.py", buildRetrievalPackScript);
  scripts.set("route_codebase_retrieval.py", routeCodebaseRetrievalScript);

  return scripts;
}
