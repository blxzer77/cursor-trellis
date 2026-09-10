import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { InstallStateStore } from "../../../src/pactile/runtime/stores.js";
import {
  runMigrationTransaction,
  type MigrationTransactionRequest,
} from "../../../src/pactile/migration/transaction.js";

const roots: string[] = [];
const at = "2026-09-10T00:00:00Z";

function fixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "pactile-migration-"));
  roots.push(root);
  return root;
}

function fingerprint(bytes: Uint8Array): string {
  return `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
}

function request(
  root: string,
  id = "migration.test",
): MigrationTransactionRequest {
  const active = Buffer.from('{"legacy":true}\r\n');
  const transformed = Buffer.from('{"schemaVersion":1,"active":true}\n');
  const closed = Buffer.from([0x43, 0x4c, 0x4f, 0x53, 0x45, 0x44, 0x0d, 0x0a]);
  return {
    projectRoot: root,
    id,
    generationId: `generation.${id}`,
    sourceRoot: ".cstl",
    sourceRuntimeVersion: "0.4.3",
    sourceSchemaVersion: 0,
    runtimeVersion: "0.5.0",
    expectedInstallStateFingerprint: null,
    occurredAt: at,
    files: [
      {
        sourceRef: "legacy://active/task",
        targetPath: "tasks/active.json",
        classification: "active",
        sourceBytes: active,
        targetBytes: transformed,
        expectedSourceFingerprint: fingerprint(active),
      },
      {
        sourceRef: "legacy://archive/closed",
        targetPath: "archive/closed.bin",
        classification: "closed",
        sourceBytes: closed,
        targetBytes: closed,
        expectedSourceFingerprint: fingerprint(closed),
      },
    ],
  };
}

afterEach(() => {
  for (const root of roots.splice(0))
    fs.rmSync(root, { recursive: true, force: true });
});

describe("runMigrationTransaction", () => {
  it("keeps closed bytes opaque and resumes after an interrupted CAS commit", async () => {
    const root = fixture();
    const legacyClosed = path.join(root, ".cstl", "archive", "closed.bin");
    fs.mkdirSync(path.dirname(legacyClosed), { recursive: true });
    const closedBytes = Buffer.from(request(root).files[1].sourceBytes);
    fs.writeFileSync(legacyClosed, closedBytes);

    const lock = path.join(
      root,
      ".pactile",
      "runtime",
      "install-state.json.lock",
    );
    fs.mkdirSync(path.dirname(lock), { recursive: true });
    fs.writeFileSync(lock, "simulate-crash");
    const interrupted = await runMigrationTransaction(request(root));
    expect(interrupted.status).toBe("interrupted");
    expect(interrupted.journal?.state).toBe("validated");
    expect(new InstallStateStore(root).read()).toBeNull();

    fs.unlinkSync(lock);
    const completed = await runMigrationTransaction(request(root));
    expect(completed.status).toBe("completed");
    if (completed.status !== "completed") throw new Error(completed.reason);
    expect(completed.resumed).toBe(true);
    expect(completed.journal.events.map((entry) => entry.event)).toEqual([
      "planned",
      "backup-completed",
      "stage-completed",
      "validation-completed",
      "canonical-committed",
      "doctor-completed",
    ]);
    expect(new InstallStateStore(root).read()?.state.generationId).toBe(
      "generation.migration.test",
    );
    expect(
      fs.readFileSync(
        path.join(
          root,
          ".pactile/runtime/generations/g-generation.migration.test/files/archive/closed.bin",
        ),
      ),
    ).toEqual(closedBytes);
    expect(fs.readFileSync(legacyClosed)).toEqual(closedBytes);
  });

  it("leaves the generation staged when caller validation rejects it", async () => {
    const root = fixture();
    const result = await runMigrationTransaction(
      request(root, "migration.reject"),
      {
        validateStaged: () => false,
      },
    );
    expect(result).toMatchObject({
      status: "review",
      reason: "migration-validation-failed",
      journal: { state: "staged" },
    });
    expect(new InstallStateStore(root).read()).toBeNull();
  });
});
