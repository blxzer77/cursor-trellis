const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const packageRoot = path.resolve(__dirname, "..", "..");
const venvDir = path.join(packageRoot, ".smart-search-python");
const pythonPath =
  process.platform === "win32"
    ? path.join(venvDir, "Scripts", "python.exe")
    : path.join(venvDir, "bin", "python");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    stdio: "inherit",
    shell: options.shell || false,
    windowsHide: true
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function capture(command, args) {
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    encoding: "utf8",
    windowsHide: true
  });
  if (result.error) {
    console.error(result.error.message);
    process.exit(1);
  }
  if (result.status !== 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    process.exit(result.status || 1);
  }
  return result.stdout || "";
}

function runNpm(args) {
  if (process.env.npm_execpath) {
    run(process.execPath, [process.env.npm_execpath, ...args]);
    return;
  }
  run("npm", args, { shell: process.platform === "win32" });
}

if (!fs.existsSync(pythonPath)) {
  console.error("Missing .smart-search-python runtime. Run npm install first.");
  process.exit(1);
}

run(pythonPath, ["-m", "pip", "install", "--disable-pip-version-check", "-e", ".[dev]"]);
run(pythonPath, ["-m", "pytest"]);
run(process.execPath, ["npm/scripts/test-wrapper-repair.js"]);
run(process.execPath, ["npm/bin/smart-search.js", "--help"]);
const utf8Probe = spawnSync(process.execPath, [
  "npm/bin/smart-search.js",
  "search",
  "深度搜索一下最近的比特币行情",
  "--format",
  "json"
], {
  cwd: packageRoot,
  encoding: "utf8",
  windowsHide: true,
  env: { ...process.env, OPENAI_COMPATIBLE_API_KEY: "" }
});
let utf8Query = "";
try {
  utf8Query = JSON.parse(utf8Probe.stdout || "{}").query;
} catch (err) {
  utf8Query = "";
}
if (utf8Query !== "深度搜索一下最近的比特币行情") {
  console.error("npm wrapper must preserve non-ASCII CLI arguments and JSON output as UTF-8.");
  process.exit(1);
}
runNpm(["pack", "--dry-run"]);
