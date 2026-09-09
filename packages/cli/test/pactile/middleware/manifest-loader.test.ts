import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { loadProviderManifestsV1 } from "../../../src/utils/project-capabilities.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const validFixture = path.join(here, "fixtures", "valid");

describe("ProviderManifestLoader", () => {
  let temporaryRoot: string;

  beforeEach(() => {
    temporaryRoot = fs.mkdtempSync(
      path.join(os.tmpdir(), "pactile-provider-loader-"),
    );
  });

  afterEach(() => {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  });

  function copyValidFixture(): string {
    const projectRoot = path.join(temporaryRoot, "project");
    fs.cpSync(validFixture, projectRoot, { recursive: true });
    return projectRoot;
  }

  it("loads exact-case project manifests through the frozen M0 decoder", () => {
    const result = loadProviderManifestsV1(validFixture);

    expect(result.ok).toBe(true);
    expect(result.diagnostics).toEqual([]);
    expect(
      result.manifests.map(({ id, version }) => `${id}@${version}`),
    ).toEqual(["provider.alpha@1.0.0", "provider.beta@1.0.0"]);
  });

  it("fails the complete load on duplicate logical id/version", () => {
    const projectRoot = copyValidFixture();
    fs.copyFileSync(
      path.join(projectRoot, ".pactile", "providers", "provider-alpha.json"),
      path.join(projectRoot, ".pactile", "providers", "copy.json"),
    );

    const result = loadProviderManifestsV1(projectRoot);
    expect(result.ok).toBe(false);
    expect(result.manifests).toEqual([]);
    expect(result.diagnostics).toEqual([
      { code: "provider-manifest-duplicate", location: "providers[1]" },
    ]);
  });

  it("rejects malformed, unknown, non-file, and case-colliding entries", () => {
    const malformedRoot = copyValidFixture();
    const providerDir = path.join(malformedRoot, ".pactile", "providers");
    fs.writeFileSync(path.join(providerDir, "broken.json"), "{", "utf8");
    fs.writeFileSync(path.join(providerDir, "upper.JSON"), "{}", "utf8");
    fs.writeFileSync(path.join(providerDir, "unknown.txt"), "x", "utf8");
    fs.mkdirSync(path.join(providerDir, "nested.json"));
    const malformed = loadProviderManifestsV1(malformedRoot);
    expect(malformed.ok).toBe(false);
    expect(malformed.manifests).toEqual([]);
    expect(malformed.diagnostics.map((item) => item.code)).toEqual([
      "provider-manifest-json-invalid",
      "provider-manifest-entry-unsupported",
      "provider-manifest-entry-unsupported",
      "provider-manifest-entry-unsupported",
    ]);

    const caseRoot = path.join(temporaryRoot, "case-project");
    fs.mkdirSync(path.join(caseRoot, ".PACTILE", "providers"), {
      recursive: true,
    });
    const collision = loadProviderManifestsV1(caseRoot);
    expect(collision).toEqual({
      ok: false,
      manifests: [],
      diagnostics: [
        { code: "provider-root-case-collision", location: ".pactile" },
      ],
    });

    const directoryCaseRoot = path.join(
      temporaryRoot,
      "directory-case-project",
    );
    fs.mkdirSync(path.join(directoryCaseRoot, ".pactile", "Providers"), {
      recursive: true,
    });
    expect(loadProviderManifestsV1(directoryCaseRoot)).toEqual({
      ok: false,
      manifests: [],
      diagnostics: [
        { code: "provider-directory-case-collision", location: "providers" },
      ],
    });

    const unicodeCaseRoot = path.join(temporaryRoot, "unicode-case-project");
    fs.cpSync(validFixture, unicodeCaseRoot, { recursive: true });
    const unicodeProviderDir = path.join(
      unicodeCaseRoot,
      ".pactile",
      "providers",
    );
    const uniqueManifest = JSON.parse(
      fs.readFileSync(
        path.join(unicodeProviderDir, "provider-alpha.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    uniqueManifest.id = "provider.gamma";
    const manifestText = JSON.stringify(uniqueManifest);
    fs.writeFileSync(
      path.join(unicodeProviderDir, "\u00e9.json"),
      manifestText,
      "utf8",
    );
    fs.writeFileSync(
      path.join(unicodeProviderDir, "e\u0301.json"),
      manifestText,
      "utf8",
    );
    expect(loadProviderManifestsV1(unicodeCaseRoot)).toEqual({
      ok: false,
      manifests: [],
      diagnostics: [
        { code: "provider-manifest-case-collision", location: "providers[3]" },
      ],
    });
  });

  it("returns an empty catalog when the exact canonical directory is absent", () => {
    expect(loadProviderManifestsV1(temporaryRoot)).toEqual({
      ok: true,
      manifests: [],
      diagnostics: [],
    });
  });

  it("redacts filenames, absolute paths, parser messages, and secret canaries", () => {
    const projectRoot = copyValidFixture();
    const canary = "TOKEN=do-not-print";
    fs.writeFileSync(
      path.join(projectRoot, ".pactile", "providers", `${canary}.json`),
      JSON.stringify({ schemaVersion: 1, secret: canary }),
      "utf8",
    );

    const result = loadProviderManifestsV1(projectRoot);
    const serialized = JSON.stringify(result);
    expect(result.ok).toBe(false);
    expect(serialized).not.toContain(canary);
    expect(serialized).not.toContain(projectRoot);
    expect(serialized).not.toMatch(/secret|token/i);
    expect(result.diagnostics).toEqual([
      {
        code: "provider-manifest-contract-invalid",
        location: "providers[2]",
      },
    ]);

    fs.rmSync(
      path.join(projectRoot, ".pactile", "providers", `${canary}.json`),
    );
    const validManifest = JSON.parse(
      fs.readFileSync(
        path.join(projectRoot, ".pactile", "providers", "provider-alpha.json"),
        "utf8",
      ),
    ) as Record<string, unknown>;
    validManifest.evidenceKinds = [canary];
    fs.writeFileSync(
      path.join(projectRoot, ".pactile", "providers", "canary.json"),
      JSON.stringify(validManifest),
      "utf8",
    );
    const sensitive = loadProviderManifestsV1(projectRoot);
    expect(sensitive).toMatchObject({
      ok: false,
      manifests: [],
      diagnostics: [
        {
          code: "provider-manifest-sensitive-content",
          location: "providers[0]",
        },
      ],
    });
    expect(JSON.stringify(sensitive)).not.toContain(canary);
  });
});
