/**
 * Kiro templates
 *
 * Kiro uses pure JSON agent definitions, not Markdown.
 * Hooks are embedded in agent JSON, not in a separate config file.
 *
 * Directory structure:
 *   kiro/
 *   └── agents/      # Agent definitions (JSON)
 */

import { createTemplateReader, type AgentTemplate } from "../template-utils.js";
export type { AgentTemplate };

const { listJsonAgents } = createTemplateReader(import.meta.url);

/**
 * Get all Kiro agent templates (JSON format).
 * Content contains {{PYTHON_CMD}} placeholder that must be resolved before writing.
 */
export const getAllAgents = (): AgentTemplate[] => listJsonAgents();
