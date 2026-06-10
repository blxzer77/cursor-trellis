/**
 * AI Tool Types and Registry
 *
 * Defines supported AI coding tools and which command templates they can use.
 */

/**
 * Supported AI coding tools
 */
export type AITool =
  | "claude-code"
  | "cursor"
  | "opencode"
  | "codex"
  | "kilo"
  | "kiro"
  | "gemini"
  | "antigravity"
  | "windsurf"
  | "qoder"
  | "codebuddy"
  | "copilot"
  | "droid"
  | "pi";

/**
 * Template directory categories
 */
export type TemplateDir =
  | "common"
  | "claude"
  | "cursor"
  | "opencode"
  | "codex"
  | "kilo"
  | "kiro"
  | "gemini"
  | "antigravity"
  | "windsurf"
  | "qoder"
  | "codebuddy"
  | "copilot"
  | "droid"
  | "pi";

/**
 * CLI flag names for platform selection (e.g., --claude, --cursor, --kilo, --kiro, --gemini, --antigravity)
 * Must match keys in InitOptions (src/commands/init.ts)
 */
export type CliFlag =
  | "claude"
  | "cursor"
  | "opencode"
  | "codex"
  | "kilo"
  | "kiro"
  | "gemini"
  | "antigravity"
  | "windsurf"
  | "qoder"
  | "codebuddy"
  | "copilot"
  | "droid"
  | "pi";

/**
 * Platform support tier.
 *
 * First-class platforms are the actively targeted framework surfaces for this
 * fork. Legacy platforms remain available through explicit init flags and
 * update tracking, but new workflow/runtime semantics should not treat them as
 * equal launch targets without a dedicated compatibility pass.
 */
export type PlatformTier = "first-class" | "legacy";

/**
 * Template context for placeholder resolution.
 * Controls how common templates are rendered per platform.
 */
export interface TemplateContext {
  /** Prefix for cross-referencing other commands/skills */
  cmdRefPrefix: "/trellis:" | "/trellis-" | "$" | "/";
  /** Description of AI executor actions shown in role tables */
  executorAI:
    | "Bash scripts or Task calls"
    | "Bash scripts or tool calls"
    | "Bash scripts or file reads";
  /** Label for user-invocable actions */
  userActionLabel: "Slash commands" | "Skills" | "Workflows" | "Prompts";
  /** Platform supports spawning sub-agents with isolated context */
  agentCapable: boolean;
  /** Platform has hook system (SessionStart, PreToolUse) */
  hasHooks: boolean;
  /**
   * CLI flag value for this platform (e.g. "claude", "codex", "kiro").
   * Substituted into template commands via {{CLI_FLAG}} so rendered skill /
   * command files can pass `--platform <flag>` to scripts that need to know
   * the invoking platform, removing the need to re-detect at runtime.
   * Duplicates the top-level `AIToolConfig.cliFlag` for convenience — the
   * invariant is maintained in `AI_TOOLS` config blocks.
   */
  cliFlag: CliFlag;
}

/**
 * Configuration for an AI tool
 */
export interface AIToolConfig {
  /** Display name of the tool */
  name: string;
  /** Active support tier for this platform */
  tier: PlatformTier;
  /** Command template directory names to include */
  templateDirs: TemplateDir[];
  /** Config directory name in the project root (e.g., ".claude") */
  configDir: string;
  /**
   * Whether the platform supports the shared `.agents/skills/` layer
   * (agentskills.io open standard). When true, `.agents/skills` is added
   * to the platform's managed paths automatically.
   */
  supportsAgentSkills?: boolean;
  /** Additional managed paths beyond configDir (e.g., .github/hooks for Copilot) */
  extraManagedPaths?: string[];
  /** CLI flag name for --flag options (e.g., "claude" for --claude) */
  cliFlag: CliFlag;
  /** Whether this tool is checked by default in interactive init prompt */
  defaultChecked: boolean;
  /** Whether this tool uses Python hooks (affects Windows encoding detection) */
  hasPythonHooks: boolean;
  /** Template context for placeholder resolution in common templates */
  templateContext: TemplateContext;
}

/**
 * Registry of all supported AI tools and their configurations.
 * This is the single source of truth for platform data.
 *
 * When adding a new platform, add an entry here and create:
 * 1. src/configurators/{platform}.ts — configure function
 * 2. src/templates/{platform}/ — template files
 * 3. Register in src/configurators/index.ts — PLATFORM_FUNCTIONS
 * 4. Add CLI flag in src/cli/index.ts
 * 5. Add to InitOptions in src/commands/init.ts
 */
export const AI_TOOLS: Record<AITool, AIToolConfig> = {
  "claude-code": {
    name: "Claude Code",
    tier: "first-class",
    templateDirs: ["common", "claude"],
    configDir: ".claude",
    cliFlag: "claude",
    defaultChecked: true,
    hasPythonHooks: true,
    templateContext: {
      cmdRefPrefix: "/trellis:",
      executorAI: "Bash scripts or Task calls",
      userActionLabel: "Slash commands",
      agentCapable: true,
      hasHooks: true,
      cliFlag: "claude",
    },
  },
  cursor: {
    name: "Cursor",
    tier: "first-class",
    templateDirs: ["common", "cursor"],
    configDir: ".cursor",
    cliFlag: "cursor",
    defaultChecked: true,
    hasPythonHooks: true,
    templateContext: {
      cmdRefPrefix: "/trellis-",
      executorAI: "Bash scripts or Task calls",
      userActionLabel: "Slash commands",
      agentCapable: true,
      hasHooks: true,
      cliFlag: "cursor",
    },
  },
  opencode: {
    name: "OpenCode",
    tier: "legacy",
    templateDirs: ["common", "opencode"],
    configDir: ".opencode",
    cliFlag: "opencode",
    defaultChecked: false,
    hasPythonHooks: false,
    templateContext: {
      cmdRefPrefix: "/trellis:",
      executorAI: "Bash scripts or Task calls",
      userActionLabel: "Slash commands",
      agentCapable: true,
      hasHooks: false,
      cliFlag: "opencode",
    },
  },
  codex: {
    name: "Codex (also writes .agents/skills/ — read by Cursor, Gemini CLI, GitHub Copilot, Amp, Kimi Code)",
    tier: "first-class",
    templateDirs: ["common", "codex"],
    configDir: ".codex",
    supportsAgentSkills: true,
    cliFlag: "codex",
    defaultChecked: false,
    hasPythonHooks: true,
    templateContext: {
      cmdRefPrefix: "$",
      executorAI: "Bash scripts or tool calls",
      userActionLabel: "Skills",
      agentCapable: true,
      hasHooks: false,
      cliFlag: "codex",
    },
  },
  kilo: {
    name: "Kilo CLI",
    tier: "legacy",
    templateDirs: ["common", "kilo"],
    configDir: ".kilocode",
    cliFlag: "kilo",
    defaultChecked: false,
    hasPythonHooks: false,
    templateContext: {
      cmdRefPrefix: "/trellis:",
      executorAI: "Bash scripts or file reads",
      userActionLabel: "Workflows",
      agentCapable: false,
      hasHooks: false,
      cliFlag: "kilo",
    },
  },
  kiro: {
    name: "Kiro Code",
    tier: "legacy",
    templateDirs: ["common", "kiro"],
    configDir: ".kiro/skills",
    extraManagedPaths: [".kiro/agents", ".kiro/hooks"],
    cliFlag: "kiro",
    defaultChecked: false,
    hasPythonHooks: true,
    templateContext: {
      cmdRefPrefix: "$",
      executorAI: "Bash scripts or tool calls",
      userActionLabel: "Skills",
      agentCapable: true,
      hasHooks: true,
      cliFlag: "kiro",
    },
  },
  gemini: {
    name: "Gemini CLI",
    tier: "legacy",
    templateDirs: ["common", "gemini"],
    configDir: ".gemini",
    supportsAgentSkills: true,
    cliFlag: "gemini",
    defaultChecked: false,
    hasPythonHooks: true,
    templateContext: {
      cmdRefPrefix: "/trellis:",
      executorAI: "Bash scripts or tool calls",
      userActionLabel: "Slash commands",
      agentCapable: true,
      hasHooks: true,
      cliFlag: "gemini",
    },
  },
  antigravity: {
    name: "Antigravity",
    tier: "legacy",
    templateDirs: ["common", "antigravity"],
    configDir: ".agent/workflows",
    extraManagedPaths: [".agent/skills"],
    cliFlag: "antigravity",
    defaultChecked: false,
    hasPythonHooks: false,
    templateContext: {
      cmdRefPrefix: "/",
      executorAI: "Bash scripts or file reads",
      userActionLabel: "Workflows",
      agentCapable: false,
      hasHooks: false,
      cliFlag: "antigravity",
    },
  },
  windsurf: {
    name: "Windsurf",
    tier: "legacy",
    templateDirs: ["common", "windsurf"],
    configDir: ".windsurf/workflows",
    extraManagedPaths: [".windsurf/skills"],
    cliFlag: "windsurf",
    defaultChecked: false,
    hasPythonHooks: false,
    templateContext: {
      cmdRefPrefix: "/trellis-",
      executorAI: "Bash scripts or file reads",
      userActionLabel: "Workflows",
      agentCapable: false,
      hasHooks: false,
      cliFlag: "windsurf",
    },
  },
  qoder: {
    name: "Qoder",
    tier: "legacy",
    templateDirs: ["common", "qoder"],
    configDir: ".qoder",
    cliFlag: "qoder",
    defaultChecked: false,
    hasPythonHooks: true,
    templateContext: {
      cmdRefPrefix: "$",
      executorAI: "Bash scripts or tool calls",
      userActionLabel: "Skills",
      agentCapable: true,
      hasHooks: true,
      cliFlag: "qoder",
    },
  },
  codebuddy: {
    name: "CodeBuddy",
    tier: "legacy",
    templateDirs: ["common", "codebuddy"],
    configDir: ".codebuddy",
    cliFlag: "codebuddy",
    defaultChecked: false,
    hasPythonHooks: true,
    templateContext: {
      cmdRefPrefix: "/trellis:",
      executorAI: "Bash scripts or Task calls",
      userActionLabel: "Slash commands",
      agentCapable: true,
      hasHooks: true,
      cliFlag: "codebuddy",
    },
  },
  copilot: {
    name: "GitHub Copilot",
    tier: "legacy",
    templateDirs: ["common", "copilot"],
    configDir: ".github/copilot",
    extraManagedPaths: [
      ".github/agents",
      ".github/hooks",
      ".github/prompts",
      ".github/skills",
    ],
    cliFlag: "copilot",
    defaultChecked: false,
    hasPythonHooks: true,
    templateContext: {
      cmdRefPrefix: "/",
      executorAI: "Bash scripts or tool calls",
      userActionLabel: "Prompts",
      agentCapable: true,
      hasHooks: true,
      cliFlag: "copilot",
    },
  },
  droid: {
    name: "Factory Droid",
    tier: "legacy",
    templateDirs: ["common", "droid"],
    configDir: ".factory",
    cliFlag: "droid",
    defaultChecked: false,
    hasPythonHooks: true,
    templateContext: {
      cmdRefPrefix: "/trellis-",
      executorAI: "Bash scripts or Task calls",
      userActionLabel: "Slash commands",
      agentCapable: true,
      hasHooks: true,
      cliFlag: "droid",
    },
  },
  pi: {
    name: "Pi Agent",
    tier: "legacy",
    templateDirs: ["common", "pi"],
    configDir: ".pi",
    cliFlag: "pi",
    defaultChecked: false,
    hasPythonHooks: false,
    templateContext: {
      cmdRefPrefix: "/trellis-",
      executorAI: "Bash scripts or tool calls",
      userActionLabel: "Slash commands",
      agentCapable: true,
      hasHooks: true,
      cliFlag: "pi",
    },
  },
};

/**
 * Get the configuration for a specific AI tool
 */
export function getToolConfig(tool: AITool): AIToolConfig {
  return AI_TOOLS[tool];
}

/**
 * Get all managed paths for a specific tool.
 */
export function getManagedPaths(tool: AITool): string[] {
  const config = AI_TOOLS[tool];
  const paths = [config.configDir];
  if (config.supportsAgentSkills) {
    paths.push(".agents/skills");
  }
  if (config.extraManagedPaths) {
    paths.push(...config.extraManagedPaths);
  }
  return paths;
}

/**
 * Get template directories for a specific tool
 */
export function getTemplateDirs(tool: AITool): TemplateDir[] {
  return AI_TOOLS[tool].templateDirs;
}
