import fs from "node:fs";

import os from "node:os";

import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";



import { assessCstlDirectoryMigrate } from "../../src/utils/workflow-ownership.js";



describe("assessCstlDirectoryMigrate", () => {

  const tmpDirs: string[] = [];



  afterEach(() => {

    for (const dir of tmpDirs.splice(0)) {

      if (fs.existsSync(dir)) {

        fs.rmSync(dir, { recursive: true, force: true });

      }

    }

  });



  function makeTmpDir(): string {

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cstl-migrate-"));

    tmpDirs.push(dir);

    return dir;

  }



  it("allows migrate when cstl fingerprints exist", () => {

    const tmpDir = makeTmpDir();

    fs.mkdirSync(path.join(tmpDir, ".trellis"), { recursive: true });

    fs.mkdirSync(path.join(tmpDir, ".cursor", "commands"), { recursive: true });

    fs.writeFileSync(

      path.join(tmpDir, ".cursor", "commands", "cstl-continue.md"),

      "# continue",

    );

    expect(assessCstlDirectoryMigrate(tmpDir).ok).toBe(true);

  });



  it("aborts when upstream-only trellis agent exists without cstl", () => {

    const tmpDir = makeTmpDir();

    fs.mkdirSync(path.join(tmpDir, ".trellis"), { recursive: true });

    fs.mkdirSync(path.join(tmpDir, ".claude", "agents"), { recursive: true });

    fs.writeFileSync(

      path.join(tmpDir, ".claude", "agents", "trellis-implement.md"),

      "# impl",

    );

    const result = assessCstlDirectoryMigrate(tmpDir);

    expect(result.ok).toBe(false);

    expect(result.reason).toMatch(/Upstream Trellis/);

  });



  it("aborts when .cstl already exists", () => {

    const tmpDir = makeTmpDir();

    fs.mkdirSync(path.join(tmpDir, ".trellis"), { recursive: true });

    fs.mkdirSync(path.join(tmpDir, ".cstl"), { recursive: true });

    expect(assessCstlDirectoryMigrate(tmpDir).ok).toBe(false);

  });

});

