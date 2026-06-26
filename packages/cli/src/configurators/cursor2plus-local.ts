import path from "node:path";
import { DIR_NAMES } from "../constants/paths.js";
import { ensureDir, writeFile } from "../utils/file-writer.js";
import {
  cursor2plusPatchScript,
  cursor2plusReadme,
  cursor2plusSmokeScript,
  cursor2plusConfigExample,
  subagentModelsExample,
  trellisTaskModelsJson5Example,
  trellisTaskModelsConfigPy,
} from "../templates/trellis/local/index.js";

/**
 * Materialize Cursor++ BYOK local operator bundle (strategy C).
 * Native Cursor API users can ignore. Never overwrites config.local.json.
 */
export async function writeCursor2plusLocalBundle(cwd: string): Promise<void> {
  const localRoot = path.join(cwd, DIR_NAMES.WORKFLOW, "local");
  const bundleDir = path.join(localRoot, "cursor2plus");
  ensureDir(bundleDir);

  await writeFile(path.join(bundleDir, "patch_wpelc8.py"), cursor2plusPatchScript);
  await writeFile(
    path.join(bundleDir, "trellis_task_models_config.py"),
    trellisTaskModelsConfigPy,
  );
  await writeFile(path.join(bundleDir, "smoke.py"), cursor2plusSmokeScript);
  await writeFile(path.join(bundleDir, "README.md"), cursor2plusReadme);
  await writeFile(
    path.join(bundleDir, "config.local.json.example"),
    cursor2plusConfigExample,
  );

  await writeFile(
    path.join(localRoot, "subagent-models.json.example"),
    subagentModelsExample,
  );
  await writeFile(
    path.join(localRoot, "trellis-task-models.json5.example"),
    trellisTaskModelsJson5Example,
  );
}