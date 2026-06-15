import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const smartSearchRootFiles = [
  "LICENSE",
  "README.md",
  "README.zh-CN.md",
  "package.json",
  "pyproject.toml",
];

export const smartSearchRootDirs = ["npm", "skills", "src"];

const excludedNames = new Set([
  "__pycache__",
  ".DS_Store",
  ".git",
  ".pytest_cache",
  ".smart-search-python",
  ".tmp",
  ".venv",
  "build",
  "dist",
  "node_modules",
]);
const excludedExtensions = new Set([".pyc", ".pyo"]);

export function defaultPackageRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

export function vendorRootForPackage(packageRoot = defaultPackageRoot()) {
  return path.join(packageRoot, "vendor", "smart-search");
}

export function bundledSkillRootForPackage(packageRoot = defaultPackageRoot()) {
  return path.join(
    packageRoot,
    "src",
    "templates",
    "common",
    "bundled-skills",
    "smart-search-cli",
  );
}

export function resolveSourceRoot(sourceArg, env = process.env) {
  const raw = sourceArg || env.SMARTSEARCH_PRIVATE_PATH || "";
  return raw ? path.resolve(raw) : "";
}

export function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export function collectSmartSearchVendorFiles(root) {
  const files = [];

  for (const file of smartSearchRootFiles) {
    assertFile(path.join(root, file), `Smart Search source file missing: ${file}`);
    files.push(file);
  }

  for (const dir of smartSearchRootDirs) {
    const fullDir = path.join(root, dir);
    assertDirectory(fullDir, `Smart Search source directory missing: ${dir}`);
    walk(fullDir, dir, files);
  }

  return files.sort();
}

/** npm `files` entries for vendored Smart Search (source only, no runtime artifacts). */
export function npmPackVendorFileEntries(packageRoot = defaultPackageRoot()) {
  const vendorRoot = vendorRootForPackage(packageRoot);
  return collectSmartSearchVendorFiles(vendorRoot).map((file) =>
    path.posix.join("vendor", "smart-search", file.replace(/\\/g, "/")),
  );
}

const cliPackFilesStatic = [
  "dist",
  "bin",
  "scripts/postinstall.js",
  "README.md",
  "LICENSE",
];

/** Expected full `package.json` `files` array for @blxzer/trellis publish. */
export function expectedCliPackageFiles(packageRoot = defaultPackageRoot()) {
  return [...cliPackFilesStatic, ...npmPackVendorFileEntries(packageRoot)];
}

export function readCliPackageFiles(packageRoot = defaultPackageRoot()) {
  const packageJsonPath = path.join(packageRoot, "package.json");
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
  if (!Array.isArray(packageJson.files)) {
    throw new Error("package.json is missing a files array");
  }
  return packageJson.files.map((entry) => String(entry).replace(/\\/g, "/"));
}

export function compareCliPackageFiles(packageRoot = defaultPackageRoot()) {
  const expected = expectedCliPackageFiles(packageRoot);
  const actual = readCliPackageFiles(packageRoot);
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const errors = [];

  for (const file of expected) {
    if (!actualSet.has(file)) {
      errors.push(`missing from package.json files: ${file}`);
    }
  }
  for (const file of actual) {
    if (file === "vendor/smart-search") {
      errors.push(
        "package.json files must not include broad vendor/smart-search directory (use explicit allowlist)",
      );
      continue;
    }
    if (file.startsWith("vendor/smart-search/") && !expectedSet.has(file)) {
      errors.push(`extra vendor pack entry: ${file}`);
    }
  }
  return errors;
}

export function collectDirectoryFiles(root) {
  const files = [];
  assertDirectory(root, `Directory not found: ${root}`);
  walk(root, "", files);
  return files.sort();
}

export function compareSmartSearchVendor(sourceRoot, vendorRoot) {
  assertDirectory(sourceRoot, `Smart Search source root not found: ${sourceRoot}`);
  assertDirectory(vendorRoot, `Vendored Smart Search root not found: ${vendorRoot}`);

  const sourceFiles = collectSmartSearchVendorFiles(sourceRoot);
  const vendorFiles = collectSmartSearchVendorFiles(vendorRoot);
  const sourceSet = new Set(sourceFiles);
  const vendorSet = new Set(vendorFiles);
  const errors = [];

  for (const file of sourceFiles) {
    if (!vendorSet.has(file)) {
      errors.push(`missing from vendor: ${file}`);
    }
  }

  for (const file of vendorFiles) {
    if (!sourceSet.has(file)) {
      errors.push(`extra in vendor: ${file}`);
    }
  }

  for (const file of sourceFiles) {
    if (!vendorSet.has(file)) {
      continue;
    }
    const sourceHash = sha256(path.join(sourceRoot, file));
    const vendorHash = sha256(path.join(vendorRoot, file));
    if (sourceHash !== vendorHash) {
      errors.push(`content differs: ${file}`);
    }
  }

  return errors;
}

export function syncSmartSearchVendor({
  sourceRoot,
  packageRoot = defaultPackageRoot(),
  vendorRoot = vendorRootForPackage(packageRoot),
  bundledSkillRoot = bundledSkillRootForPackage(packageRoot),
}) {
  const resolvedPackageRoot = path.resolve(packageRoot);
  const resolvedSourceRoot = path.resolve(sourceRoot);
  const resolvedVendorRoot = path.resolve(vendorRoot);
  const resolvedBundledSkillRoot = path.resolve(bundledSkillRoot);
  const sourceSkillRoot = path.join(resolvedSourceRoot, "skills", "smart-search-cli");

  assertDirectory(resolvedSourceRoot, `Smart Search source root not found: ${resolvedSourceRoot}`);
  assertDirectory(sourceSkillRoot, `Smart Search skill source not found: ${sourceSkillRoot}`);
  assertManagedTarget(resolvedPackageRoot, resolvedVendorRoot, "vendor root");
  assertManagedTarget(resolvedPackageRoot, resolvedBundledSkillRoot, "bundled skill root");

  const vendorFiles = collectSmartSearchVendorFiles(resolvedSourceRoot);
  const skillFiles = collectDirectoryFiles(sourceSkillRoot);

  replaceTreeFromFileList(resolvedSourceRoot, resolvedVendorRoot, vendorFiles);
  replaceTreeFromFileList(sourceSkillRoot, resolvedBundledSkillRoot, skillFiles);

  return {
    sourceRoot: resolvedSourceRoot,
    vendorRoot: resolvedVendorRoot,
    bundledSkillRoot: resolvedBundledSkillRoot,
    vendorFiles: vendorFiles.length,
    bundledSkillFiles: skillFiles.length,
  };
}

function walk(dir, relativeDir, files) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (
      excludedNames.has(entry.name) ||
      entry.name.endsWith(".egg-info") ||
      excludedExtensions.has(path.extname(entry.name))
    ) {
      continue;
    }

    const relativePath = relativeDir
      ? path.posix.join(relativeDir, entry.name)
      : entry.name;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, relativePath, files);
    } else {
      files.push(relativePath);
    }
  }
}

function replaceTreeFromFileList(sourceRoot, targetRoot, files) {
  const parent = path.dirname(targetRoot);
  const tempRoot = path.join(
    parent,
    `.${path.basename(targetRoot)}.sync-${process.pid}-${Date.now()}`,
  );

  fs.rmSync(tempRoot, { recursive: true, force: true });
  fs.mkdirSync(tempRoot, { recursive: true });
  try {
    for (const file of files) {
      copyFilePreservingMode(path.join(sourceRoot, file), path.join(tempRoot, file));
    }
    fs.rmSync(targetRoot, { recursive: true, force: true });
    fs.renameSync(tempRoot, targetRoot);
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

function copyFilePreservingMode(sourcePath, targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
  fs.chmodSync(targetPath, fs.statSync(sourcePath).mode & 0o777);
}

function assertManagedTarget(packageRoot, targetRoot, label) {
  const relative = path.relative(packageRoot, targetRoot);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Refusing to sync ${label} outside package root: ${targetRoot}`);
  }
}

function assertDirectory(dir, message) {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new Error(message);
  }
}

function assertFile(filePath, message) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    throw new Error(message);
  }
}
