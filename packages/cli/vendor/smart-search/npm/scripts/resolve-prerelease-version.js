const { execFileSync } = require("node:child_process");

function parseArgs(argv) {
  const args = {
    prereleaseId: "beta",
    versionsJson: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--package") {
      args.packageName = next;
      index += 1;
    } else if (arg === "--base") {
      args.baseVersion = next;
      index += 1;
    } else if (arg === "--id") {
      args.prereleaseId = next;
      index += 1;
    } else if (arg === "--versions-json") {
      args.versionsJson = next;
      index += 1;
    } else if (arg === "--help" || arg === "-h") {
      printUsage(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      printUsage(1);
    }
  }
  return args;
}

function printUsage(exitCode) {
  console.error(
    [
      "Usage: node npm/scripts/resolve-prerelease-version.js --package <name> --base <version> [--id beta]",
      "",
      "Options:",
      "  --versions-json JSON   Use an explicit version list instead of querying npm."
    ].join("\n")
  );
  process.exit(exitCode);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readPublishedVersions(packageName, versionsJson) {
  if (versionsJson) {
    return JSON.parse(versionsJson);
  }
  try {
    const output = execFileSync("npm", ["view", packageName, "versions", "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    });
    return JSON.parse(output);
  } catch (error) {
    const stderr = String(error.stderr || "");
    if (stderr.includes("E404") || stderr.includes("404 Not Found")) {
      return [];
    }
    throw error;
  }
}

function resolvePrereleaseVersion(versions, baseVersion, prereleaseId) {
  const normalizedVersions = Array.isArray(versions) ? versions.filter((version) => typeof version === "string") : [];
  const escapedBase = escapeRegExp(baseVersion);
  const escapedId = escapeRegExp(prereleaseId);
  const prereleasePattern = new RegExp(`^${escapedBase}-${escapedId}\\.(\\d+)$`);
  const legacyDevPattern = new RegExp(`^${escapedBase}-dev\\..+$`);
  const existingPrereleaseNumbers = [];
  let legacyDevCount = 0;

  for (const version of normalizedVersions) {
    const prereleaseMatch = prereleasePattern.exec(version);
    if (prereleaseMatch) {
      existingPrereleaseNumbers.push(Number(prereleaseMatch[1]));
      continue;
    }
    if (legacyDevPattern.test(version)) {
      legacyDevCount += 1;
    }
  }

  const maxExistingPrerelease = existingPrereleaseNumbers.length > 0 ? Math.max(...existingPrereleaseNumbers) : 0;
  const nextNumber = Math.max(maxExistingPrerelease, legacyDevCount) + 1;
  return `${baseVersion}-${prereleaseId}.${nextNumber}`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.packageName || !args.baseVersion) {
    printUsage(1);
  }
  const versions = readPublishedVersions(args.packageName, args.versionsJson);
  process.stdout.write(resolvePrereleaseVersion(versions, args.baseVersion, args.prereleaseId));
}

if (require.main === module) {
  main();
}

module.exports = {
  resolvePrereleaseVersion
};
