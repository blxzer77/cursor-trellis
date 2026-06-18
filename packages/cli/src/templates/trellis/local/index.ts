import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function readLocal(name: string): string {
  return readFileSync(join(__dirname, name), "utf-8");
}

export const cursor2plusPatchScript = readLocal("patch_wpelc8.py");
export const cursor2plusReadme = readLocal("README.md");
export const cursor2plusConfigExample = readLocal("config.local.json.example");
export const subagentModelsExample = readLocal("subagent-models.json.example");
export const trellisTaskModelsJson5Example = readLocal(
  "trellis-task-models.json5.example",
);
export const trellisTaskModelsConfigPy = readLocal("trellis_task_models_config.py");