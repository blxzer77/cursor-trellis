import fs from "node:fs";
import path from "node:path";

export interface CstlMigrateAssessment {
  ok: boolean;
  reason?: string;
}

export interface AssessCstlMigrateOptions {
  /**
   * F5 escape hatch: the user explicitly forces the `.trellis/` → `.cstl/`
   * rename even when upstream Trellis signals are present. Still requires
   * `.trellis/` to exist and `.cstl/` to be absent.
   */
  forceCstlMigrate?: boolean;
}

/**
 * Decide whether `.trellis/` -> `.cstl/` rename-dir is safe for this project.
 *
 * Conservative by default (design §1 principle 3): the rename only proceeds
 * when there is POSITIVE proof the tree is cursor-trellis-owned. Without that
 * proof the rename is refused — the user should run `cstl init --cursor` to
 * add `.cstl/` alongside an upstream `.trellis/` instead.
 *
 * Fingerprints (positive proof of cursor-trellis ownership):
 *   F1 — any `.cursor/commands/cstl-*.md`
 *   F2 — `.cursor/rules/cstl-bootstrap.mdc`
 *   F3 — `.trellis/scripts/common/cli_adapter.py` contains `cstl`
 *
 * Upstream Trellis signals (suggest `.trellis/` is NOT cursor-trellis-owned):
 *   U1 — `.claude/agents/trellis-implement.md`
 *   U2 — trellis-named agents/skills under non-cursor platform dirs
 *         (codex/iflow/opencode/gemini/kilocode/kiro/qoder/.agents)
 *   U4 — `.cursor/commands/trellis-*.md` (legacy upstream Cursor adapter)
 *
 * Escape hatch:
 *   F5 — `options.forceCstlMigrate` overrides upstream-signal aborts.
 */
export function assessCstlDirectoryMigrate(
  cwd: string,
  options: AssessCstlMigrateOptions = {},
): CstlMigrateAssessment {
  const cstlDir = path.join(cwd, ".cstl");
  const trellisDir = path.join(cwd, ".trellis");

  if (fs.existsSync(cstlDir)) {
    return {
      ok: false,
      reason:
        ".cstl/ already exists — migration already applied or manual setup present. " +
        "If `.cstl/` is a stale partial write, remove it and re-run `cstl update --migrate`.",
    };
  }

  if (!fs.existsSync(trellisDir)) {
    return {
      ok: false,
      reason:
        "No .trellis/ directory to migrate — run `cstl init --cursor` to create .cstl/ from scratch.",
    };
  }

  // F5 escape hatch: explicit user override. .trellis/ exists and .cstl/ is
  // absent, which is the only structural precondition the rename needs.
  if (options.forceCstlMigrate) {
    return { ok: true };
  }

  const hasCstlFingerprint = detectCstlFingerprint(cwd);
  const hasUpstreamSignal = detectUpstreamTrellis(cwd);

  if (!hasCstlFingerprint) {
    return {
      ok: false,
      reason:
        "No cursor-trellis fingerprint found (no .cursor/commands/cstl-*.md, " +
        "no .cursor/rules/cstl-bootstrap.mdc, and .trellis/scripts/common/cli_adapter.py " +
        "is not cstl-flavored). Refusing to rename .trellis/ — it may belong to " +
        "upstream Trellis. To add cursor-trellis alongside upstream Trellis, run " +
        "`cstl init --cursor` (creates .cstl/ without touching .trellis/). " +
        "If you are certain .trellis/ is cursor-trellis-owned, pass --force-cstl-migrate.",
    };
  }

  if (hasUpstreamSignal) {
    return {
      ok: false,
      reason:
        "Mixed layout: cursor-trellis fingerprints AND upstream Trellis signals " +
        "both detected. Refusing to rename .trellis/ — it may be shared with " +
        "upstream Trellis. Use `cstl init --cursor` to add .cstl/ alongside, or " +
        "--force-cstl-migrate if you are certain .trellis/ is cursor-trellis-owned.",
    };
  }

  return { ok: true };
}

/** F1/F2/F3 — positive proof the tree is cursor-trellis-owned. */
function detectCstlFingerprint(cwd: string): boolean {
  // F1 — any .cursor/commands/cstl-*.md
  const cursorCommandsDir = path.join(cwd, ".cursor", "commands");
  if (hasFileGlob(cursorCommandsDir, (f) => f.startsWith("cstl-") && f.endsWith(".md"))) {
    return true;
  }
  // F2 — .cursor/rules/cstl-bootstrap.mdc
  if (fs.existsSync(path.join(cwd, ".cursor", "rules", "cstl-bootstrap.mdc"))) {
    return true;
  }
  // F3 — cstl-flavored .trellis/scripts/common/cli_adapter.py
  const cliAdapter = path.join(cwd, ".trellis", "scripts", "common", "cli_adapter.py");
  if (fs.existsSync(cliAdapter)) {
    try {
      const content = fs.readFileSync(cliAdapter, "utf-8");
      if (content.includes("cstl")) {
        return true;
      }
    } catch {
      // ignore read errors
    }
  }
  return false;
}

/** U1/U2/U4 — upstream Trellis signals (`.trellis/` may not be cursor-trellis-owned). */
function detectUpstreamTrellis(cwd: string): boolean {
  // U1 — upstream Claude adapter
  if (fs.existsSync(path.join(cwd, ".claude", "agents", "trellis-implement.md"))) {
    return true;
  }
  // U2 — trellis-named agents/skills under non-cursor platform dirs.
  // cursor-trellis is Cursor-only, so any trellis-* artifact outside .cursor/
  // indicates an upstream Trellis install.
  const upstreamDirs: [string, string][] = [
    [".codex", "agents"],
    [".iflow", "agents"],
    [".opencode", "agents"],
    [".gemini", "commands"],
    [".kilocode", "workflows"],
    [".kiro", "skills"],
    [".qoder", "skills"],
    [".agents", "skills"],
  ];
  for (const [dir, sub] of upstreamDirs) {
    if (hasFileGlob(path.join(cwd, dir, sub), (f) => /trellis/i.test(f))) {
      return true;
    }
  }
  // U4 — legacy upstream Cursor adapter (.cursor/commands/trellis-*.md)
  if (hasFileGlob(path.join(cwd, ".cursor", "commands"), (f) => f.startsWith("trellis-") && f.endsWith(".md"))) {
    return true;
  }
  return false;
}

function hasFileGlob(dir: string, predicate: (name: string) => boolean): boolean {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return false;
  }
  try {
    return fs.readdirSync(dir).some(predicate);
  } catch {
    return false;
  }
}
