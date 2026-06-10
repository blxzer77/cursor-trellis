const fs = require("node:fs");
const path = require("node:path");

const version = process.argv[2];
if (!version) {
  console.error("Usage: node npm/scripts/set-package-version.js <version>");
  process.exit(1);
}

const packageRoot = path.resolve(__dirname, "..", "..");
const packageJsonPath = path.join(packageRoot, "package.json");
const packageLockPath = path.join(packageRoot, "package-lock.json");
const pyprojectPath = path.join(packageRoot, "pyproject.toml");

function writeJsonVersion(filePath) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  data.version = version;
  if (data.packages && data.packages[""]) {
    data.packages[""].version = version;
  }
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
}

writeJsonVersion(packageJsonPath);
writeJsonVersion(packageLockPath);

const pyproject = fs.readFileSync(pyprojectPath, "utf8");
const versionPattern = /^version = ".*"$/m;
if (!versionPattern.test(pyproject)) {
  console.error("Could not find the project.version field in pyproject.toml.");
  process.exit(1);
}

fs.writeFileSync(pyprojectPath, pyproject.replace(versionPattern, `version = "${version}"`));
console.log(`Set package version to ${version}.`);
