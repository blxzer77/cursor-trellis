/**
 * Path constants for Trellis workflow structure
 *
 * Change these values to rename directories across the entire project.
 * All paths should be relative to the project root.
 */

// Directory names (can be renamed)
export const DIR_NAMES = {
  /** Root workflow directory */
  WORKFLOW: ".cstl",
  /** Workspace directory (under .cstl/) - developer work areas */
  WORKSPACE: "workspace",
  /** Tasks directory (under .cstl/) - unified task storage */
  TASKS: "tasks",
  /** Archive directory (under tasks/) */
  ARCHIVE: "archive",
  /** Spec/guidelines directory (under .cstl/) */
  SPEC: "spec",
  /** Scripts directory (under .cstl/) */
  SCRIPTS: "scripts",
  /** Review-pool directory (under .cstl/) */
  POOL: "pool",
} as const;

// File names
export const FILE_NAMES = {
  /** Root agent instructions file */
  AGENTS: "AGENTS.md",
  /** Developer identity file */
  DEVELOPER: ".developer",
  /** Current task pointer */
  CURRENT_TASK: ".current-task",
  /** Task metadata */
  TASK_JSON: "task.json",
  /** Requirements document */
  PRD: "prd.md",
  /** Workflow guide */
  WORKFLOW_GUIDE: "workflow.md",
  /** Journal file prefix */
  JOURNAL_PREFIX: "journal-",
} as const;

// Constructed paths (relative to project root)
export const PATHS = {
  /** .cstl/ */
  WORKFLOW: DIR_NAMES.WORKFLOW,
  /** .cstl/workspace/ */
  WORKSPACE: `${DIR_NAMES.WORKFLOW}/${DIR_NAMES.WORKSPACE}`,
  /** .cstl/tasks/ */
  TASKS: `${DIR_NAMES.WORKFLOW}/${DIR_NAMES.TASKS}`,
  /** .cstl/spec/ */
  SPEC: `${DIR_NAMES.WORKFLOW}/${DIR_NAMES.SPEC}`,
  /** .cstl/scripts/ */
  SCRIPTS: `${DIR_NAMES.WORKFLOW}/${DIR_NAMES.SCRIPTS}`,
  /** .cstl/pool/ */
  POOL: `${DIR_NAMES.WORKFLOW}/${DIR_NAMES.POOL}`,
  /** .cstl/.developer */
  DEVELOPER_FILE: `${DIR_NAMES.WORKFLOW}/${FILE_NAMES.DEVELOPER}`,
  /** .cstl/.current-task */
  CURRENT_TASK_FILE: `${DIR_NAMES.WORKFLOW}/${FILE_NAMES.CURRENT_TASK}`,
  /** .cstl/workflow.md */
  WORKFLOW_GUIDE_FILE: `${DIR_NAMES.WORKFLOW}/${FILE_NAMES.WORKFLOW_GUIDE}`,
} as const;

/**
 * Get developer's workspace directory path
 * @example getWorkspaceDir("john") => ".cstl/workspace/john"
 */
export function getWorkspaceDir(developer: string): string {
  return `${PATHS.WORKSPACE}/${developer}`;
}

/**
 * Get task directory path
 * @example getTaskDir("01-21-my-task") => ".cstl/tasks/01-21-my-task"
 */
export function getTaskDir(taskName: string): string {
  return `${PATHS.TASKS}/${taskName}`;
}

/**
 * Get archive directory path
 * @example getArchiveDir() => ".cstl/tasks/archive"
 */
export function getArchiveDir(): string {
  return `${PATHS.TASKS}/${DIR_NAMES.ARCHIVE}`;
}
