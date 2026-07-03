import fs from "node:fs";

import path from "node:path";



export interface CstlMigrateAssessment {
  ok: boolean;
  reason?: string;
}



/**

 * Decide whether `.trellis/` -> `.cstl/` rename-dir is safe for this project.

 * Conservative for mixed/upstream-only repos; permissive when cstl fingerprints exist.

 */

export function assessCstlDirectoryMigrate(cwd: string): CstlMigrateAssessment {

  const cstlDir = path.join(cwd, ".cstl");

  const trellisDir = path.join(cwd, ".trellis");



  if (fs.existsSync(cstlDir)) {

    return {

      ok: false,

      reason:

        ".cstl/ already exists — migration already applied or manual setup present.",

    };

  }



  if (!fs.existsSync(trellisDir)) {

    return {

      ok: false,

      reason: "No .trellis/ directory to migrate — run `cstl init --cursor` instead.",

    };

  }



  const hasCstlCursor =

    fs.existsSync(path.join(cwd, ".cursor/commands/cstl-continue.md")) ||

    fs.existsSync(path.join(cwd, ".cursor/rules/cstl-triage.mdc"));



  const upstreamClaudeAgent = fs.existsSync(

    path.join(cwd, ".claude/agents/trellis-implement.md"),

  );

  const legacyCursorTrellisCmd = fs.existsSync(

    path.join(cwd, ".cursor/commands/trellis-continue.md"),

  );



  if ((upstreamClaudeAgent || legacyCursorTrellisCmd) && !hasCstlCursor) {

    return {

      ok: false,

      reason:

        "Upstream Trellis layout detected without cstl fingerprints — refusing to rename .trellis/. Use upstream `trellis` for that tree and `cstl init --cursor` to add a separate .cstl/.",

    };

  }



  return { ok: true };

}

