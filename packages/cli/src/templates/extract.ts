import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { ensureDir, writeFile } from "../utils/file-writer.js";
import { replacePythonCommandLiterals } from "../configurators/shared.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type TemplateCategory = "scripts" | "markdown" | "commands";

/**
 * Get the path to the trellis templates directory (.cstl/ scaffolding).
 */
export function getTrellisTemplatePath(): string {
  const templatePath = path.join(__dirname, "trellis");
  if (fs.existsSync(templatePath)) {
    return templatePath;
  }
  throw new Error(
    "Could not find trellis templates directory. Expected at templates/trellis/",
  );
}

/** @deprecated Use getTrellisTemplatePath() instead. */
export function getTrellisSourcePath(): string {
  return getTrellisTemplatePath();
}

/**
 * Read a file from the trellis template directory.
 */
export function readTrellisFile(relativePath: string): string {
  const trellisPath = getTrellisSourcePath();
  const filePath = path.join(trellisPath, relativePath);
  return fs.readFileSync(filePath, "utf-8");
}

/**
 * Read template content from a category directory.
 */
export function readTemplate(
  category: TemplateCategory,
  filename: string,
): string {
  const templatePath = path.join(__dirname, category, filename);
  return fs.readFileSync(templatePath, "utf-8");
}

export function readScript(relativePath: string): string {
  return readTrellisFile(`scripts/${relativePath}`);
}

export function readMarkdown(relativePath: string): string {
  return readTrellisFile(relativePath);
}

export function readCommand(filename: string): string {
  return readTemplate("commands", filename);
}

/**
 * Copy a directory from trellis templates to target, making scripts executable.
 */
export async function copyTrellisDir(
  srcRelativePath: string,
  destPath: string,
  options?: { executable?: boolean },
): Promise<void> {
  const trellisPath = getTrellisSourcePath();
  const srcPath = path.join(trellisPath, srcRelativePath);
  await copyDirRecursive(srcPath, destPath, options);
}

async function copyDirRecursive(
  src: string,
  dest: string,
  options?: { executable?: boolean },
): Promise<void> {
  ensureDir(dest);

  for (const entry of fs.readdirSync(src)) {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    const stat = fs.statSync(srcPath);

    if (stat.isDirectory()) {
      await copyDirRecursive(srcPath, destPath, options);
    } else {
      const content = fs.readFileSync(srcPath, "utf-8");
      const isExecutable =
        options?.executable && (entry.endsWith(".sh") || entry.endsWith(".py"));
      await writeFile(destPath, replacePythonCommandLiterals(content), {
        executable: isExecutable,
      });
    }
  }
}

const USER_MODULE_INDEX = "index.json";
const USER_MODULE_CONTRACT = "contract.md";

/**
 * User `.cstl/modules/` may only contain the catalog index and each module's
 * short contract. CLI source next to the templates (`catalog.ts`, any `.ts`)
 * must not be copied, hashed, or written into the user tree.
 */
export function isUserShippedModuleFile(relativePosix: string): boolean {
  const normalized = relativePosix.replace(/\\/g, "/");
  if (normalized.endsWith(".ts")) {
    return false;
  }
  if (normalized === USER_MODULE_INDEX) {
    return true;
  }
  const parts = normalized.split("/");
  return (
    parts.length === 2 &&
    parts[0].length > 0 &&
    parts[1] === USER_MODULE_CONTRACT
  );
}

function walkUserModuleFiles(
  absDir: string,
  relDir: string,
  out: Map<string, string>,
): void {
  if (!fs.existsSync(absDir)) {
    return;
  }
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const rel = relDir ? `${relDir}/${entry.name}` : entry.name;
    const abs = path.join(absDir, entry.name);
    if (entry.isDirectory()) {
      walkUserModuleFiles(abs, rel, out);
      continue;
    }
    if (!isUserShippedModuleFile(rel)) {
      continue;
    }
    out.set(rel, fs.readFileSync(abs, "utf-8"));
  }
}

/**
 * Walk `templates/trellis/modules/` and return the user-shipped subset.
 * Keys are POSIX paths relative to `modules/` (`index.json`, `<id>/contract.md`).
 * Shared by init (`createWorkflowStructure`) and update (`collectTemplateFiles`).
 */
export function collectUserModuleTemplates(): Map<string, string> {
  const modulesRoot = path.join(getTrellisTemplatePath(), "modules");
  const files = new Map<string, string>();
  walkUserModuleFiles(modulesRoot, "", files);
  return files;
}
