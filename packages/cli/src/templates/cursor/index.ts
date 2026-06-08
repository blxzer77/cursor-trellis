/**
 * Cursor templates
 *
 * Directory structure:
 *   cursor/
 *   ├── agents/      # Sub-agent definitions
 *   └── hooks.json   # Hooks configuration
 */

import { createTemplateReader, type AgentTemplate } from "../template-utils.js";
export type { AgentTemplate };

const { listMdAgents, getConfig } = createTemplateReader(import.meta.url);

export const getAllAgents = (): AgentTemplate[] => listMdAgents();
export const getHooksConfig = (): string => getConfig("hooks.json");
