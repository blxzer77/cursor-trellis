/**
 * Gemini CLI templates
 *
 * Directory structure:
 *   gemini/
 *   ├── agents/        # Sub-agent definitions
 *   └── settings.json  # Settings configuration
 */

import { createTemplateReader, type AgentTemplate } from "../template-utils.js";
export type { AgentTemplate };

const { listMdAgents, getConfig } = createTemplateReader(import.meta.url);

export const getAllAgents = (): AgentTemplate[] => listMdAgents();
export const getSettingsTemplate = (): string => getConfig("settings.json");
