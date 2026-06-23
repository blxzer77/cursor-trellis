import { describe, expect, it, beforeAll } from "vitest";

import { execSync } from "node:child_process";

import fs from "node:fs";

import path from "node:path";

import { fileURLToPath } from "node:url";



const cliDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const trellisRoot = path.resolve(cliDir, "../..");



describe("check-router-copy-sync", () => {

  beforeAll(() => {

    const copies = [

      [

        path.join(cliDir, "src/templates/trellis/scripts/common/codebase_retrieval_router.py"),

        path.join(trellisRoot, ".trellis/scripts/common/codebase_retrieval_router.py"),

      ],

      [

        path.join(cliDir, "src/templates/trellis/scripts/route_codebase_retrieval.py"),

        path.join(trellisRoot, ".trellis/scripts/route_codebase_retrieval.py"),

      ],

    ];

    for (const [src, dest] of copies) {

      fs.mkdirSync(path.dirname(dest), { recursive: true });

      fs.copyFileSync(src, dest);

    }

  });



  it("hash-only guard passes for Trellis dogfood copies", () => {

    const out = execSync("node scripts/check-router-copy-sync.js --hash-only", {

      cwd: cliDir,

      encoding: "utf-8",

    });

    expect(out).toContain("All sync guard checks passed");

  });

});


