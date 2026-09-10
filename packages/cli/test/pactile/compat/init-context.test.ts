import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { inspectLegacyInitContext } from "../../../src/pactile/compat/init-context.js";
import {
  runLifecycleTransaction,
  type LifecycleRequest,
} from "../../../src/pactile/lifecycle/index.js";
import { fingerprintBytes } from "../../../src/pactile/projection/planner.js";

const roots: string[] = [];
const occurredAt = "2026-09-10T06:30:00.000Z";
const runtimeVersion = "0.5.0-beta.5";

function root(): string {
  const result = fs.mkdtempSync(path.join(os.tmpdir(), "pactile-init-context-"));
  roots.push(result);
  return result;
}

afterEach(() => {
  for (const target of roots.splice(0))
    fs.rmSync(target, { recursive: true, force: true });
});

function importRequest(projectRoot: string): LifecycleRequest {
  const sourceBytes = Buffer.from("legacy\r\n");
  fs.mkdirSync(path.join(projectRoot, ".cstl"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, ".cstl/workflow.md"), sourceBytes);
  return {
    projectRoot,
    id: "lifecycle.import.recovery",
    generationId: "generation.import.recovery",
    runtimeVersion,
    expectedInstallStateFingerprint: null,
    occurredAt,
    source: {
      kind: "legacy",
      root: ".cstl",
      runtimeVersion: "0.4.3",
      schemaVersion: 1,
      files: [
        {
          sourceRef: "legacy://cstl/workflow.md",
          path: "workflow.md",
          classification: "active",
          sourceBytes,
          bytes: Buffer.from("Pactile\n"),
          expectedSourceFingerprint: fingerprintBytes(sourceBytes),
        },
      ],
    },
    adapters: [],
  };
}

describe("legacy init recovery guard", () => {
  it("fails closed for malformed or stale import journals", async () => {
    const malformed = root();
    fs.mkdirSync(
      path.join(malformed, ".pactile/runtime/migrations"),
      { recursive: true },
    );
    fs.mkdirSync(path.join(malformed, ".cstl"));
    fs.writeFileSync(
      path.join(malformed, ".pactile/runtime/migrations/lifecycle.import.bad.json"),
      "{}",
    );
    expect(() =>
      inspectLegacyInitContext({
        cwd: malformed,
        canonicalRootAbsent: false,
        importRequested: true,
        developerFileName: ".developer",
      }),
    ).toThrow(/recoverable import journal/);

    const completed = root();
    const result = await runLifecycleTransaction(importRequest(completed));
    expect(result.status).toBe("completed");
    expect(() =>
      inspectLegacyInitContext({
        cwd: completed,
        canonicalRootAbsent: false,
        importRequested: true,
        developerFileName: ".developer",
      }),
    ).toThrow(/recoverable import journal/);

    const journals = path.join(completed, ".pactile/runtime/migrations");
    const journal = fs
      .readdirSync(journals)
      .find((name) => name.startsWith("lifecycle.import."));
    expect(journal).toBeDefined();
    fs.copyFileSync(
      path.join(journals, journal ?? "missing.json"),
      path.join(journals, "lifecycle.import.mismatched.json"),
    );
    expect(() =>
      inspectLegacyInitContext({
        cwd: completed,
        canonicalRootAbsent: false,
        importRequested: true,
        developerFileName: ".developer",
      }),
    ).toThrow(/recoverable import journal/);
  });

  it("accepts only a valid interrupted import for resume", async () => {
    const projectRoot = root();
    const result = await runLifecycleTransaction(importRequest(projectRoot), {
      // The canonical commit is durable; only the live materialization callback
      // is interrupted, which is exactly the state init may safely resume.
      validateGeneration: () => true,
    });
    expect(result.status).toBe("completed");

    // Replace the completed journal with a valid committed journal by using a
    // second transaction whose materialization seam throws after commit.
    const recoveryRoot = root();
    const recoveryRequest = importRequest(recoveryRoot);
    const interrupted = await runLifecycleTransaction({
      ...recoveryRequest,
      // The orchestrator's lifecycle request owns materialization; this test
      // uses the explicit command seam to model a post-commit interruption.
      materializeCanonical: () => {
        throw new Error("injected-materialization-interruption");
      },
    });
    expect(interrupted.status).toBe("interrupted");
    expect(() =>
      inspectLegacyInitContext({
        cwd: recoveryRoot,
        canonicalRootAbsent: false,
        importRequested: true,
        developerFileName: ".developer",
      }),
    ).not.toThrow();
  });
});
