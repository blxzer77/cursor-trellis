const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..", "..");
const packageJson = JSON.parse(
  fs.readFileSync(path.join(packageRoot, "package.json"), "utf8")
);
const pyprojectPath = path.join(packageRoot, "pyproject.toml");
const pyproject = fs.readFileSync(pyprojectPath, "utf8");
const versionPattern = /^version = ".*"$/m;

if (!versionPattern.test(pyproject)) {
  console.error("Could not find the project.version field in pyproject.toml.");
  process.exit(1);
}

const updated = pyproject.replace(versionPattern, `version = "${packageJson.version}"`);
if (updated !== pyproject) {
  fs.writeFileSync(pyprojectPath, updated);
}

console.log(`Synced pyproject.toml to ${packageJson.version}.`);
