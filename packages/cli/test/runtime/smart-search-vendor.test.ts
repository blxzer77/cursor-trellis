import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "../..");
const vendorRoot = path.join(packageRoot, "vendor", "smart-search");

// npm pack --dry-run contends with other subprocess-heavy tests when fully parallel.
describe.sequential("Smart Search vendored runtime", () => {
  it("is exposed as a Trellis package bin and published package file", () => {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageRoot, "package.json"), "utf-8"),
    ) as {
      bin?: Record<string, string>;
      files?: string[];
      scripts?: Record<string, string>;
    };

    expect(packageJson.bin?.["smart-search"]).toBe("./bin/smart-search.js");
    expect(packageJson.files).not.toContain("vendor/smart-search");
    expect(packageJson.files).toContain("vendor/smart-search/pyproject.toml");
    expect(packageJson.files).toContain("vendor/smart-search/npm/scripts/postinstall.js");
    expect(packageJson.files).toContain("scripts/postinstall.js");
    expect(packageJson.scripts?.postinstall).toBe("node scripts/postinstall.js");
    expect(packageJson.scripts?.["sync:smart-search"]).toBe(
      "node scripts/sync-smart-search-vendor.js",
    );
    expect(packageJson.scripts?.["check:smart-search"]).toBe(
      "node scripts/check-smart-search-vendor.js",
    );
  });

  it("vendors the Smart Search package/runtime contract without runtime caches", () => {
    for (const requiredPath of [
      "package.json",
      "pyproject.toml",
      "LICENSE",
      "README.md",
      "README.zh-CN.md",
      "npm/bin/smart-search.js",
      "npm/scripts/postinstall.js",
      "src/smart_search/cli.py",
      "src/smart_search/providers/base.py",
      "skills/smart-search-cli/SKILL.md",
      "skills/smart-search-cli/references/cli-contract.md",
      "src/smart_search/assets/skills/smart-search-cli/SKILL.md",
    ]) {
      expect(fs.existsSync(path.join(vendorRoot, requiredPath))).toBe(true);
    }

    for (const excludedPath of [
      ".agents",
      ".claude",
      ".codex",
      ".git",
      ".pytest_cache",
      ".tmp",
      ".trellis",
      "dist",
      "node_modules",
      "package-lock.json",
      "tests",
    ]) {
      expect(fs.existsSync(path.join(vendorRoot, excludedPath))).toBe(false);
    }

    const packageJson = JSON.parse(
      fs.readFileSync(path.join(packageRoot, "package.json"), "utf-8"),
    ) as { files?: string[] };
    const packFiles = packageJson.files ?? [];
    for (const fragment of [
      ".smart-search-python",
      "/build/",
      "__pycache__",
      ".egg-info",
      ".pyc",
    ]) {
      expect(packFiles.some((entry) => entry.includes(fragment))).toBe(false);
    }
    expect(packFiles).not.toContain("vendor/smart-search");
  });

  it("uses a Trellis-owned wrapper around the vendored runtime", () => {
    const wrapper = fs.readFileSync(
      path.join(packageRoot, "bin", "smart-search.js"),
      "utf-8",
    );

    expect(wrapper).toContain('path.join(packageRoot, "vendor", "smart-search")');
    expect(wrapper).toContain('path.join(vendorRoot, ".smart-search-python")');
    expect(wrapper).toContain('path.join(vendorRoot, "npm", "scripts", "postinstall.js")');
    expect(wrapper).toContain('["-m", "smart_search.cli"');
    expect(wrapper).toContain("SMART_SEARCH_PACKAGE_ROOT: vendorRoot");
  });

  it("keeps drift checking opt-in and source-path driven", () => {
    const driftCheck = fs.readFileSync(
      path.join(packageRoot, "scripts", "check-smart-search-vendor.js"),
      "utf-8",
    );
    const syncScript = fs.readFileSync(
      path.join(packageRoot, "scripts", "sync-smart-search-vendor.js"),
      "utf-8",
    );
    const sharedUtils = fs.readFileSync(
      path.join(packageRoot, "scripts", "smart-search-vendor-utils.js"),
      "utf-8",
    );

    expect(sharedUtils).toContain("npmPackVendorFileEntries");
    expect(sharedUtils).toContain("compareCliPackageFiles");

    for (const scriptText of [driftCheck, syncScript, sharedUtils]) {
      expect(scriptText).toContain("SMARTSEARCH_PRIVATE_PATH");
      expect(scriptText).not.toContain("D:\\\\MyHarness");
      expect(scriptText).not.toContain("D:/MyHarness");
    }
    expect(syncScript).toContain("--source <smartsearch-private-root>");
    expect(syncScript).toContain('arg === "--"');
    expect(driftCheck).toContain('arg !== "--"');
  });

  it("syncs the runtime and bundled skill snapshot while preserving exclusions", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-smart-search-sync-"));
    try {
      const sourceRoot = path.join(tmpRoot, "smartsearch-private");
      const packageRootFixture = path.join(tmpRoot, "trellis-package");
      createSmartSearchSourceFixture(sourceRoot);
      writeFile(
        path.join(packageRootFixture, "vendor", "smart-search", "stale.txt"),
        "stale",
      );
      writeFile(
        path.join(
          packageRootFixture,
          "src",
          "templates",
          "common",
          "bundled-skills",
          "smart-search-cli",
          "stale.txt",
        ),
        "stale",
      );

      const { syncSmartSearchVendor, compareSmartSearchVendor } =
        await loadVendorUtils();

      const result = syncSmartSearchVendor({
        sourceRoot,
        packageRoot: packageRootFixture,
      });

      expect(result.vendorFiles).toBeGreaterThan(0);
      expect(result.bundledSkillFiles).toBeGreaterThan(0);
      expect(
        fs.readFileSync(
          path.join(packageRootFixture, "vendor", "smart-search", "README.md"),
          "utf-8",
        ),
      ).toBe("Smart Search README");
      expect(
        fs.readFileSync(
          path.join(
            packageRootFixture,
            "src",
            "templates",
            "common",
            "bundled-skills",
            "smart-search-cli",
            "SKILL.md",
          ),
          "utf-8",
        ),
      ).toContain("Source-backed web research");

      for (const excludedPath of [
        "tests/test_service.py",
        "node_modules/pkg/index.js",
        ".venv/pyvenv.cfg",
        "src/smart_search/__pycache__/cli.cpython-312.pyc",
        "src/smart_search.egg-info/PKG-INFO",
      ]) {
        expect(
          fs.existsSync(
            path.join(packageRootFixture, "vendor", "smart-search", excludedPath),
          ),
        ).toBe(false);
      }
      expect(
        fs.existsSync(path.join(packageRootFixture, "vendor", "smart-search", "stale.txt")),
      ).toBe(false);
      expect(
        fs.existsSync(
          path.join(
            packageRootFixture,
            "src",
            "templates",
            "common",
            "bundled-skills",
            "smart-search-cli",
            "stale.txt",
          ),
        ),
      ).toBe(false);
      expect(
        compareSmartSearchVendor(
          sourceRoot,
          path.join(packageRootFixture, "vendor", "smart-search"),
        ),
      ).toEqual([]);
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });

  it(
    "keeps npm pack free of Smart Search runtime and cache artifacts",
    () => {
    const raw = execSync("npm pack --dry-run --json", {
      cwd: packageRoot,
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        TRELLIS_SKIP_SMART_SEARCH_POSTINSTALL: "1",
      },
    });
    const payload = JSON.parse(raw) as Array<{ files?: Array<{ path: string }> }>;
    const paths = (payload[0]?.files ?? []).map((file) => file.path.replace(/\\/g, "/"));

    expect(paths.some((p) => p === "vendor/smart-search/pyproject.toml")).toBe(true);
    expect(paths.some((p) => p === "vendor/smart-search/npm/scripts/postinstall.js")).toBe(
      true,
    );
    expect(paths.some((p) => p.includes(".smart-search-python"))).toBe(false);
    expect(paths.some((p) => p.includes("vendor/smart-search/build"))).toBe(false);
    expect(paths.some((p) => p.includes("__pycache__"))).toBe(false);
    expect(paths.some((p) => p.endsWith(".pyc"))).toBe(false);
    expect(paths.some((p) => p.includes(".egg-info"))).toBe(false);
    },
    60_000,
  );

  it("detects post-sync Smart Search vendor drift", async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-smart-search-drift-"));
    try {
      const sourceRoot = path.join(tmpRoot, "smartsearch-private");
      const packageRootFixture = path.join(tmpRoot, "trellis-package");
      createSmartSearchSourceFixture(sourceRoot);

      const { syncSmartSearchVendor, compareSmartSearchVendor } =
        await loadVendorUtils();
      syncSmartSearchVendor({ sourceRoot, packageRoot: packageRootFixture });
      fs.writeFileSync(
        path.join(packageRootFixture, "vendor", "smart-search", "README.md"),
        "drift",
        "utf-8",
      );

      expect(
        compareSmartSearchVendor(
          sourceRoot,
          path.join(packageRootFixture, "vendor", "smart-search"),
        ),
      ).toContain("content differs: README.md");
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});

function listEntries(root: string, base = root): string[] {
  const entries: string[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const fullPath = path.join(root, entry.name);
    entries.push(path.relative(base, fullPath).replaceAll("\\", "/"));
    if (entry.isDirectory()) {
      entries.push(...listEntries(fullPath, base));
    }
  }
  return entries;
}

interface SyncResult {
  sourceRoot: string;
  vendorRoot: string;
  bundledSkillRoot: string;
  vendorFiles: number;
  bundledSkillFiles: number;
}

interface SmartSearchVendorUtils {
  syncSmartSearchVendor: (options: {
    sourceRoot: string;
    packageRoot?: string;
    vendorRoot?: string;
    bundledSkillRoot?: string;
  }) => SyncResult;
  compareSmartSearchVendor: (sourceRoot: string, vendorRoot: string) => string[];
}

async function loadVendorUtils(): Promise<SmartSearchVendorUtils> {
  const moduleUrl = pathToFileURL(
    path.join(packageRoot, "scripts", "smart-search-vendor-utils.js"),
  ).href;
  return (await import(moduleUrl)) as SmartSearchVendorUtils;
}

function createSmartSearchSourceFixture(sourceRoot: string): void {
  for (const [relativePath, content] of Object.entries({
    "LICENSE": "license",
    "README.md": "Smart Search README",
    "README.zh-CN.md": "Smart Search Chinese README",
    "package.json": '{"name":"@konbakuyomu/smart-search"}',
    "pyproject.toml": '[project]\nname = "smart-search"\n',
    "npm/bin/smart-search.js": "#!/usr/bin/env node\n",
    "npm/scripts/postinstall.js": "console.log('install')\n",
    "skills/smart-search-cli/SKILL.md": "Source-backed web research",
    "skills/smart-search-cli/agents/openai.yaml": "name: smart-search-cli\n",
    "skills/smart-search-cli/examples/batch-search.md": "# Batch Search\n",
    "skills/smart-search-cli/references/cli-contract.md": "# Contract\n",
    "src/smart_search/__init__.py": "",
    "src/smart_search/cli.py": "print('cli')\n",
    "src/smart_search/service.py": "print('service')\n",
    "src/smart_search/assets/skills/smart-search-cli/SKILL.md":
      "Source-backed packaged skill",
    "tests/test_service.py": "must not copy",
    "node_modules/pkg/index.js": "must not copy",
    ".venv/pyvenv.cfg": "must not copy",
    "src/smart_search/__pycache__/cli.cpython-312.pyc": "must not copy",
    "src/smart_search.egg-info/PKG-INFO": "must not copy",
  })) {
    writeFile(path.join(sourceRoot, relativePath), content);
  }
}

function writeFile(filePath: string, content: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, "utf-8");
}
