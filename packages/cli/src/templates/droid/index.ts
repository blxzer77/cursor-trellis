/**
 * Factory Droid templates
 *
 * These are GENERIC templates for user projects.
 *
 * Directory structure:
 *   droid/
 *   ├── droids/         # Multi-agent pipeline droids (agents)
 *   └── settings.json   # Settings configuration
 */

import {
  createTemplateReader,
  type AgentTemplate,
  type HookTemplate,
} from "../template-utils.js";
export type { AgentTemplate, HookTemplate };

const { listMdAgents, getSettings } = createTemplateReader(import.meta.url);

export const getAllDroids = (): AgentTemplate[] => listMdAgents("droids");
export const getSettingsTemplate = (): HookTemplate => getSettings();
