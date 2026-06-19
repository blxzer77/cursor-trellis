import path from "node:path";
import { AI_TOOLS } from "../types/ai-tools.js";
import { ensureDir, writeFile } from "../utils/file-writer.js";
import {
  resolvePlaceholders,
  resolveCommands,
  resolveSkills,
  resolveCommandAsSkills,
  resolveBundledSkills,
  writeSkills,
  writeAgents,
  writeSharedHooks,
} from "./shared.js";
import { getAllAgents, getAllRules, getHooksConfig, getWorktreesConfig } from "../templates/cursor/index.js";

/**
 * Configure Cursor:
 * - commands/ — continue + finish-work as slash commands (trellis- prefix, flat)
 * - skills/trellis-{name}/SKILL.md — workflow skills (incl. finish-work for auto-trigger)
 * - rules/*.mdc — always-apply / glob-scoped Cursor rules (Triage hard gate etc.)
 * - agents/{name}.md — sub-agent definitions
 * - hooks/*.py — shared hook scripts
 * - hooks.json — hook configuration (separate file, not settings.json)
 */
export async function configureCursor(cwd: string): Promise<void> {
  const config = AI_TOOLS.cursor;
  const ctx = config.templateContext;
  const configRoot = path.join(cwd, config.configDir);

  const commandsDir = path.join(configRoot, "commands");
  ensureDir(commandsDir);
  for (const cmd of resolveCommands(ctx)) {
    await writeFile(
      path.join(commandsDir, `trellis-${cmd.name}.md`),
      cmd.content,
    );
  }

  await writeSkills(
    path.join(configRoot, "skills"),
    [...resolveSkills(ctx), ...resolveCommandAsSkills(["finish-work"], ctx)],
    resolveBundledSkills(ctx),
  );

  // Cursor .cursor/rules/*.mdc — the reliable context-injection channel on
  // Cursor (sessionStart.additional_context is broken; rules are prepended
  // before every prompt on a separate path). Rule names already carry the
  // .mdc extension, so write them verbatim — do NOT append an extension.
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