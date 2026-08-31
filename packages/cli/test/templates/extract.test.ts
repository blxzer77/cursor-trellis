import { describe, expect, it } from "vitest";
import fs from "node:fs";
import {
  getTrellisTemplatePath,
  getTrellisSourcePath,
  readTrellisFile,
  readTemplate,
  readScript,
  readMarkdown,
  collectUserModuleTemplates,
  isUserShippedModuleFile,
} from "../../src/templates/extract.js";
import { listModuleCatalog } from "../../src/templates/trellis/modules/catalog.js";

// =============================================================================
// getXxxTemplatePath — returns existing directory paths
// =============================================================================

describe("template path functions", () => {
  it("getTrellisTemplatePath returns existing directory", () => {
    const p = getTrellisTemplatePath();
    expect(fs.existsSync(p)).toBe(true);
    expect(fs.statSync(p).isDirectory()).toBe(true);
  });
});

// =============================================================================
// Deprecated aliases return same result
// =============================================================================

describe("deprecated source path aliases", () => {
  it("getTrellisSourcePath equals getTrellisTemplatePath", () => {
    expect(getTrellisSourcePath()).toBe(getTrellisTemplatePath());
  });
});

// =============================================================================
// readTrellisFile — reads files from trellis template directory
// =============================================================================

describe("readTrellisFile", () => {
  it("reads workflow.md from trellis templates", () => {
    const content = readTrellisFile("workflow.md");
    expect(typeof content).toBe("string");
    expect(content.length).toBeGreaterThan(0);
    expect(content).toContain("#");
  });

  it("reads a script file", () => {
    const content = readTrellisFile("scripts/task.py");
    expect(typeof content).toBe("string");
    expect(content.length).toBeGreaterThan(0);
  });

  it("throws for nonexistent file", () => {
    expect(() => readTrellisFile("nonexistent.txt")).toThrow();
  });
});

// =============================================================================
// readTemplate — reads from category subdirectories
// =============================================================================

describe("readTemplate", () => {
  it("throws for nonexistent category/file", () => {
    expect(() => readTemplate("scripts", "nonexistent.txt")).toThrow();
  });
});

// =============================================================================
// readScript / readMarkdown helpers
// =============================================================================

describe("readScript", () => {
  it("reads a Python script from scripts/", () => {
    const content = readScript("task.py");
    expect(typeof content).toBe("string");
    expect(content.length).toBeGreaterThan(0);
  });
});

describe("readMarkdown", () => {
  it("reads workflow.md", () => {
    const content = readMarkdown("workflow.md");
    expect(typeof content).toBe("string");
    expect(content).toContain("#");
  });
});

describe("user-shipped module templates", () => {
  it("accepts only index.json and <id>/contract.md", () => {
    expect(isUserShippedModuleFile("index.json")).toBe(true);
    expect(isUserShippedModuleFile("intake-basic/contract.md")).toBe(true);
    expect(isUserShippedModuleFile("catalog.ts")).toBe(false);
    expect(isUserShippedModuleFile("intake-basic/catalog.ts")).toBe(false);
    expect(isUserShippedModuleFile("README.md")).toBe(false);
    expect(isUserShippedModuleFile("nested/id/contract.md")).toBe(false);
  });

  it("walks modules/ without catalog.ts or other .ts files", () => {
    const files = collectUserModuleTemplates();
    const keys = [...files.keys()].sort();

    expect(keys).toContain("index.json");
    expect(keys.some((key) => key.endsWith(".ts"))).toBe(false);
    expect(keys).not.toContain("catalog.ts");

    const catalog = listModuleCatalog();
    expect(catalog).toHaveLength(20);
    for (const entry of catalog) {
      expect(keys).toContain(entry.contract);
      expect(files.get(entry.contract)?.trim().length).toBeGreaterThan(0);
    }
    expect(keys).toHaveLength(1 + catalog.length);
  });
});
