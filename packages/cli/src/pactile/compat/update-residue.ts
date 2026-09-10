import fs from "node:fs";
import path from "node:path";
import chalk from "chalk";

import { hasCursor2plusBundleResidue } from "./retired-alternate-client.js";

const LEGACY_CURSOR_SKILL_RESIDUE_DIRS = [
  "cstl-brainstorm",
  "cstl-before-dev",
  "cstl-check",
  "cstl-break-loop",
  "cstl-update-spec",
  "cstl-finish-work",
  "cstl-micro-grill",
  "cstl-meta",
  "cstl-skill-creator",
  "cstl-spec-bootstrap",
  "cstl-cursor2plus-setup",
  "smart-search-cli",
  "trellis-brainstorm",
  "trellis-before-dev",
  "trellis-check",
  "trellis-break-loop",
  "trellis-update-spec",
  "trellis-finish-work",
  "trellis-micro-grill",
  "trellis-meta",
  "trellis-skill-creator",
  "trellis-spec-bootstrap",
  "trellis-cursor2plus-setup",
] as const;

export function printRetiredAlternateClientNotice(cwd: string): void {
  if (!hasCursor2plusBundleResidue(cwd)) return;

  console.log(
    chalk.yellow(
      "\nCursor++ path retired: leftover `.cstl/local/cursor2plus/` (or `.trellis/…`) is not an install surface.",
    ),
  );
  console.log(
    chalk.gray(
      "  Do not run patch scripts. Unmodified managed residue is removed by hash-safe cleanup; review and manually delete any user-modified leftover files if unused.",
    ),
  );
}

/** Report old Cursor skill copies without treating them as current surfaces. */
export function printLegacyCursorSkillResidueNotice(cwd: string): void {
  const skillsRoot = path.join(cwd, ".cursor", "skills");
  if (!fs.existsSync(skillsRoot)) return;

  const foundResidues = LEGACY_CURSOR_SKILL_RESIDUE_DIRS.filter((directory) =>
    fs.existsSync(path.join(skillsRoot, directory)),
  );
  if (foundResidues.length === 0) return;

  const hasFinishWorkCommand = fs.existsSync(
    path.join(cwd, ".cursor", "commands", "cstl-finish-work.md"),
  );
  const hasFinishWorkSkill =
    foundResidues.includes("cstl-finish-work") ||
    foundResidues.includes("trellis-finish-work");

  console.log(chalk.cyan("  Legacy Cursor commands-only skill residue notice:"));
  console.log(
    chalk.yellow(
      `    Found ${foundResidues.length} stale skill director${foundResidues.length === 1 ? "y" : "ies"} under .cursor/skills/.`,
    ),
  );
  console.log(
    chalk.gray(
      "    Pristine copies are auto-removed by safe-file-delete; user-modified files are kept for manual review.",
    ),
  );
  if (hasFinishWorkCommand && hasFinishWorkSkill) {
    console.log(
      chalk.gray(
        "    Legacy finish-work appears as both command and skill; hash-safe cleanup resolves only a pristine duplicate.",
      ),
    );
  }
  console.log("");
}
