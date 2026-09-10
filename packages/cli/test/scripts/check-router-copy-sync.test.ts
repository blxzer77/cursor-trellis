import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const cliDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
let dogfoodRoot: string;

describe("check-router-copy-sync", () => {
  beforeAll(() => {
    dogfoodRoot = fs.mkdtempSync(path.join(os.tmpdir(), "pactile-router-sync-"));
    const copies = [
      [
        path.join(
          cliDir,
          "src/templates/pactile/scripts/common/codebase_retrieval_router.py",
        ),
        path.join(
          dogfoodRoot,
          ".pactile/scripts/common/codebase_retrieval_router.py",
        ),
      ],
      [
        path.join(cliDir, "src/templates/pactile/scripts/route_codebase_retrieval.py"),
        path.join(dogfoodRoot, ".pactile/scripts/route_codebase_retrieval.py"),
      ],
    ];
    for (const [source, destination] of copies) {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(source, destination);
    }
  });

  afterAll(() => {
    fs.rmSync(dogfoodRoot, { recursive: true, force: true });
  });

  it("hash-only guard passes for isolated Pactile dogfood copies", () => {
    const output = execSync("node scripts/check-router-copy-sync.js --hash-only", {
      cwd: cliDir,
      encoding: "utf-8",
      env: {
        ...process.env,
        PACTILE_SYNC_WORKSPACE_ROOT: dogfoodRoot,
      },
    });
    expect(output).toContain("All sync guard checks passed");
  });
});
