import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import {
  createPublishPlan,
  readVersions,
  releasePackageDefinitions,
  validatePackedCliPackage,
  validatePackedShimPackage,
} from "../../scripts/release-preflight.js";

const TEST_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(TEST_DIR, "../../../..");

function readJson(relativePath: string): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf-8"),
  ) as Record<string, unknown>;
}

function runNode(entry: string, args: string[] = []) {
  return spawnSync(process.execPath, [entry, ...args], {
    cwd: REPO_ROOT,
    encoding: "utf-8",
    env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "0" },
  });
}

describe("Pactile package compatibility graph", () => {
  it("declares canonical packages and implementation-free legacy shims", () => {
    const core = readJson("packages/core/package.json");
    const cli = readJson("packages/cli/package.json");
    const legacyCore = readJson(
      "packages/cursor-trellis-core-shim/package.json",
    );
    const legacyCli = readJson("packages/cursor-trellis-shim/package.json");

    expect(core.name).toBe("@blxzer/pactile-core");
    expect(cli.name).toBe("@blxzer/pactile");
    expect(legacyCore.name).toBe("@blxzer/cursor-trellis-core");
    expect(legacyCli.name).toBe("@blxzer/cursor-trellis");
    expect(cli.dependencies).toMatchObject({
      "@blxzer/pactile-core": "workspace:*",
    });
    expect(legacyCore.dependencies).toEqual({
      "@blxzer/pactile-core": "workspace:*",
    });
    expect(legacyCli.dependencies).toEqual({
      "@blxzer/pactile": "workspace:*",
    });
    expect(legacyCore.files).not.toContain("src");
    expect(legacyCli.files).not.toContain("src");
  });

  it("keeps old core exports identical to the canonical module", async () => {
    const legacyEntry = pathToFileURL(
      path.join(REPO_ROOT, "packages/cursor-trellis-core-shim/index.js"),
    ).href;
    const [canonical, legacy] = await Promise.all([
      import("@blxzer/pactile-core"),
      import(legacyEntry),
    ]);
    expect(Object.keys(legacy).sort()).toEqual(Object.keys(canonical).sort());
    for (const key of Object.keys(canonical)) {
      expect(Reflect.get(legacy, key)).toBe(Reflect.get(canonical, key));
    }
  });

  it("warns once for compatibility bins and never for pactile", () => {
    const canonical = runNode(
      path.join(REPO_ROOT, "packages/cli/bin/pactile.js"),
      ["--help"],
    );
    const alias = runNode(path.join(REPO_ROOT, "packages/cli/bin/cstl.js"), [
      "--help",
    ]);
    const legacy = runNode(
      path.join(REPO_ROOT, "packages/cursor-trellis-shim/bin/cstl.js"),
      ["--help"],
    );

    expect(canonical.status).toBe(0);
    expect(canonical.stderr).not.toContain("Deprecated compatibility entry");
    for (const result of [alias, legacy]) {
      expect(result.status).toBe(canonical.status);
      expect(result.stdout).toBe(canonical.stdout);
      expect(
        result.stderr.match(/Deprecated compatibility entry/g) ?? [],
      ).toHaveLength(1);
    }

    const helper = pathToFileURL(
      path.join(REPO_ROOT, "packages/cli/bin/compat-warning.js"),
    ).href;
    const twice = runNode("--input-type=module", [
      "-e",
      `import { warnLegacyCliOnce as warn } from ${JSON.stringify(helper)}; warn(); warn();`,
    ]);
    expect(twice.status).toBe(0);
    expect(
      twice.stderr.match(/Deprecated compatibility entry/g) ?? [],
    ).toHaveLength(1);
  });

  it("plans the four packages in dependency order and validates packed semver", () => {
    const versions = readVersions();
    expect(releasePackageDefinitions(versions).map((item) => item.key)).toEqual(
      ["core", "cli", "legacyCore", "legacyCli"],
    );
    const queried: string[] = [];
    const plan = createPublishPlan({
      versions,
      exists: (name: string) => {
        queried.push(name);
        return false;
      },
    });
    expect(queried).toEqual([
      "@blxzer/pactile-core",
      "@blxzer/pactile",
      "@blxzer/cursor-trellis-core",
      "@blxzer/cursor-trellis",
    ]);
    expect(plan.legacyCli.publish).toBe(true);

    expect(() =>
      validatePackedCliPackage(
        {
          name: "@blxzer/pactile",
          dependencies: { "@blxzer/pactile-core": versions.cliVersion },
          bin: {
            pactile: "bin/pactile.js",
            cstl: "bin/cstl.js",
            "smart-search": "bin/smart-search.js",
          },
        },
        versions.cliVersion,
      ),
    ).not.toThrow();
    expect(() =>
      validatePackedShimPackage(
        {
          name: "@blxzer/cursor-trellis-core",
          dependencies: { "@blxzer/pactile-core": versions.cliVersion },
        },
        { key: "legacyCore", expectedVersion: versions.cliVersion },
      ),
    ).not.toThrow();
    expect(() =>
      validatePackedShimPackage(
        {
          name: "@blxzer/cursor-trellis",
          dependencies: { "@blxzer/pactile": "workspace:*" },
          bin: { cstl: "bin/cstl.js" },
        },
        { key: "legacyCli", expectedVersion: versions.cliVersion },
      ),
    ).toThrow(/workspace:/);
  });
});
