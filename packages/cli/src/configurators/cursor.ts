import path from "node:path";
import { AI_TOOLS } from "../types/ai-tools.js";
import { ensureDir, writeFile } from "../utils/file-writer.js";
import {
  resolvePlaceholders,
  resolveCommands,
  writeAgents,
  writeSharedHooks,
} from "./shared.js";
import {
  getAllAgents,
  getAllRules,
  getCursorCommands,
  getHooksConfig,
  getWorktreesConfig,
} from "../templates/cursor/index.js";

/**
 * Configure Cursor (commands-only default policy):
 *
 * Trellis's default Cursor adaptation is commands-only: the `/` palette shows
 * only the user-facing slash commands, keeping the surface controlled and the
 * entrypoints unambiguous. Internal workflow skills are NOT shipped to
 * `.cursor/skills/` on Cursor (they remain available to Claude/Codex/Gemini
 * via their own configurators, and their core rules reach the Cursor agent
 * through `.cursor/rules` + `AGENTS.md` instead). This is a policy choice for
 * palette hygiene and workflow reliability, not a statement about Agent Skills.
 *
 * - commands/cstl-{continue,finish-work}.md — common command templates
 * - commands/cstl-cursor2plus-setup.md — Cursor-only command (BYOK setup)
 * - rules/*.mdc — always-apply / glob-scoped Cursor rules (Triage hard gate etc.)
 * - agents/{name}.md — sub-agent definitions
 * - hooks/*.py — shared hook scripts
 * - hooks.json — hook configuration (separate file, not settings.json)
 */
export async function configureCursor(cwd: string): Promise<void> {
  const config = AI_TOOLS.cursor;
  const ctx = config.templateContext;
  const configRoot = path.join(cwd, config.configDir);

  // .cursor/commands/ — user-facing slash commands (commands-only policy).
  // Common commands (continue, finish-work) + Cursor-only commands (cursor2plus-setup).
  const commandsDir = path.join(configRoot, "commands");
  ensureDir(commandsDir);
  for (const cmd of resolveCommands(ctx)) {
    await writeFile(
      path.join(commandsDir, `cstl-${cmd.name}.md`),
      resolvePlaceholders(cmd.content, ctx),
    );
  }
  for (const cmd of getCursorCommands()) {
    await writeFile(
      path.join(commandsDir, `cstl-${cmd.name}.md`),
      resolvePlaceholders(cmd.content, ctx),
    );
  }

  // .cursor/rules/*.mdc — the reliable context-injection channel on Cursor.
  const rulesDir = path.join(configRoot, "rules");
  ensureDir(rulesDir);
  for (const rule of getAllRules()) {
    await writeFile(path.join(rulesDir, rule.name), rule.content);
  }

  await writeAgents(path.join(configRoot, "agents"), getAllAgents());
  await writeSharedHooks(path.join(configRoot, "hooks"), "cursor");

  await writeFile(
    path.join(configRoot, "hooks.json"),
    resolvePlaceholders(getHooksConfig()),
  );

  await writeFile(
    path.join(configRoot, "worktrees.json"),
    resolvePlaceholders(getWorktreesConfig()),
  );
}
