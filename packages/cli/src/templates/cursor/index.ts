/**
 * Cursor templates
 *
 * Directory structure:
 *   cursor/
 *   ├── agents/        # Sub-agent definitions
 *   ├── rules/         # .cursor/rules/*.mdc (alwaysApply / glob-scoped rules)
 *   ├── hooks.json     # Hooks configuration
 *   └── worktrees.json # Cursor native worktree setup
 */

import { createTemplateReader, type AgentTemplate } from "../template-utils.js";
export type { AgentTemplate };

const { listMdAgents, listMdcRules, getConfig } = createTemplateReader(import.meta.url);

export const getAllAgents = (): AgentTemplate[] => listMdAgents();
export const getAllRules = (): AgentTemplate[] => listMdcRules();
export const getHooksConfig = (): string => getConfig("hooks.json");
export const getWorktreesConfig = (): string => getConfig("worktrees.json");
