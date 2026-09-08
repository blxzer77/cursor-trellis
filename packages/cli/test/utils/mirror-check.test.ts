import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  extractCstlManagedBlock,
  formatMirrorDiffs,
  runMirrorCheck,
} from "../../src/utils/mirror-check.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliDir = path.resolve(__dirname, "../..");
const trellisRoot = path.resolve(cliDir, "../..");
const harnessRoot = path.resolve(trellisRoot, "..");
const templateCursorDir = path.join(cliDir, "src/templates/cursor");
const templateAgentsPath = path.join(cliDir, "src/templates/markdown/agents.md");

function normalize(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trimEnd();
}

function createMirroredDogfood(): string {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "trellis-mirror-"));
  fs.cpSync(templateCursorDir, path.join(tmp, ".cursor"), { recursive: true });
  fs.copyFileSync(templateAgentsPath, path.join(tmp, "AGENTS.md"));
  return tmp;
}

const p43MirrorPairs = [
  [
    path.join(harnessRoot, ".cstl/workflow.md"),
    path.join(cliDir, "src/templates/trellis/workflow.md"),
  ],
  ...["cstl-check.md", "cstl-implement.md", "cstl-research.md"].map(
    (name) => [
      path.join(harnessRoot, ".cursor/agents", name),
      path.join(templateCursorDir, "agents", name),
    ],
  ),
  [
    path.join(harnessRoot, ".cstl/framework/prd-grill-frontier.md"),
    path.join(
      cliDir,
      "src/templates/markdown/framework/prd-grill-frontier.md.txt",
    ),
  ],
  [
    path.join(harnessRoot, ".cstl/spec/guides/test-discipline-guide.md"),
    path.join(
      cliDir,
      "src/templates/markdown/spec/guides/test-discipline-guide.md.txt",
    ),
  ],
  [
    path.join(harnessRoot, ".cstl/spec/guides/e2e-walkthrough-guide.md"),
    path.join(
      cliDir,
      "src/templates/markdown/spec/guides/e2e-walkthrough-guide.md.txt",
    ),
  ],
] as const;

const harnessMirrorExists =
  p43MirrorPairs.every(([source, target]) =>
    fs.existsSync(source) && fs.existsSync(target),
  ) && fs.existsSync(path.join(harnessRoot, "AGENTS.md"));

describe("mirror-check", () => {
  const localDogfoodExists =
    fs.existsSync(path.join(trellisRoot, ".cursor", "rules")) &&
    fs.existsSync(path.join(trellisRoot, ".cursor", "agents"));
  const agentsPath = path.join(trellisRoot, "AGENTS.md");
  const isThinConnected =
    fs.existsSync(agentsPath) &&
    fs.readFileSync(agentsPath, "utf-8").includes("Thin-connect");
  const standaloneDogfoodExists = localDogfoodExists && !isThinConnected;

  it("passes when dogfood mirrors templates (positive case)", () => {
    const tmp = createMirroredDogfood();
    try {
      const result = runMirrorCheck({
        dogfoodRoot: tmp,
        templateCursorDir,
        templateAgentsPath,
      });
      expect(result.ok, formatMirrorDiffs(result.diffs)).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("fails when dogfood rule content diverges (negative case)", () => {
    const tmp = createMirroredDogfood();
    try {
      const dogfoodRule = path.join(
        tmp,
        ".cursor/rules/cstl-bootstrap.mdc",
      );
      fs.appendFileSync(dogfoodRule, "\n# drift");

      const result = runMirrorCheck({
        dogfoodRoot: tmp,
        templateCursorDir,
        templateAgentsPath,
      });
      expect(result.ok).toBe(false);
      expect(
        result.diffs.some(
          (diff) => diff.relativePath === "rules/cstl-bootstrap.mdc",
        ),
      ).toBe(true);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it("detects agent and AGENTS managed-block divergence", () => {
    const tmp = createMirroredDogfood();
    try {
      fs.appendFileSync(
        path.join(tmp, ".cursor/agents/cstl-implement.md"),
        "\n# drift",
      );
      const dogfoodAgents = path.join(tmp, "AGENTS.md");
      fs.writeFileSync(
        dogfoodAgents,
        fs
          .readFileSync(dogfoodAgents, "utf-8")
          .replace("# Cursor-Trellis", "# Drifted Cursor-Trellis"),
      );

      const result = runMirrorCheck({
        dogfoodRoot: tmp,
        templateCursorDir,
        templateAgentsPath,
      });
      expect(result.ok).toBe(false);
      expect(
        result.diffs.map((diff) => diff.relativePath),
      ).toEqual(expect.arrayContaining(["agents/cstl-implement.md", "AGENTS.md"]));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it.skipIf(!harnessMirrorExists)(
    "P43 harness sources exactly mirror product templates",
    () => {
      for (const [source, target] of p43MirrorPairs) {
        expect(normalize(fs.readFileSync(target, "utf-8")), target).toBe(
          normalize(fs.readFileSync(source, "utf-8")),
        );
      }
      expect(extractCstlManagedBlock(fs.readFileSync(templateAgentsPath, "utf-8"))).toBe(
        extractCstlManagedBlock(
          fs.readFileSync(path.join(harnessRoot, "AGENTS.md"), "utf-8"),
        ),
      );
    },
  );

  it.skipIf(!standaloneDogfoodExists)(
    "standalone repository mirror-check script exits 0",
    () => {
      execSync("node scripts/mirror-check.js", {
        cwd: cliDir,
        encoding: "utf-8",
      });
    },
  );
});
