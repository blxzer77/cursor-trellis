import path from "node:path";
import { AI_TOOLS } from "../types/ai-tools.js";
import { ensureDir, writeFile } from "../utils/file-writer.js";
import {
  resolveBundledSkills,
  resolveCommands,
  resolveSkills,
  writeSkills,
} from "./shared.js";

/**
 * Configure Windsurf:
 * - workflows/ — start + finish-work as slash commands
 * - skills/trellis-{name}/SKILL.md — other 5 as auto-triggered skills
 */
export async function configureWindsurf(cwd: string): Promise<void> {
  const ctx = AI_TOOLS.windsurf.templateContext;

  const workflowsDir = path.join(cwd, ".windsurf", "workflows");
  ensureDir(workflowsDir);
  for (const cmd of resolveCommands(ctx)) {
    await writeFile(
      path.join(workflowsDir, `trellis-${cmd.name}.md`),
      cmd.content,
    );
  }

  await writeSkills(
    path.join(cwd, ".windsurf", "skills"),
    resolveSkills(ctx),
    resolveBundledSkills(ctx),
  );
}
