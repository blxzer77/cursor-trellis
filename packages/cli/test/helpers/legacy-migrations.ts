/**
 * Load migration manifests archived from the @blxzer/trellis npm line.
 * Shipped @blxzer/cursor-trellis tarballs only include manifests/0.1.0.json;
 * regression tests for historical upgrade chains read manifests-legacy/ instead.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type { MigrationItem, MigrationManifest } from "../../src/types/migration.js";
import { compareVersions } from "../../src/utils/compare-versions.js";

const LEGACY_MANIFESTS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../src/migrations/manifests-legacy",
);

export function loadLegacyManifests(): Record<string, MigrationManifest> {
  const manifests: Record<string, MigrationManifest> = {};
  if (!fs.existsSync(LEGACY_MANIFESTS_DIR)) {
    return manifests;
  }
  for (const file of fs.readdirSync(LEGACY_MANIFESTS_DIR).filter((f) => f.endsWith(".json"))) {
    const manifest = JSON.parse(
      fs.readFileSync(path.join(LEGACY_MANIFESTS_DIR, file), "utf-8"),
    ) as MigrationManifest;
    if (manifest.version) {
      manifests[manifest.version] = manifest;
    }
  }
  return manifests;
}

export function getLegacyMigrationVersions(): string[] {
  return Object.keys(loadLegacyManifests()).sort(compareVersions);
}

export function getLegacyAllMigrations(): MigrationItem[] {
  const all: MigrationItem[] = [];
  for (const manifest of Object.values(loadLegacyManifests())) {
    all.push(...manifest.migrations);
  }
  return all;
}

export function getLegacyMigrationsForVersion(
  fromVersion: string,
  toVersion: string,
): MigrationItem[] {
  const manifests = loadLegacyManifests();
  const versions = Object.keys(manifests).sort(compareVersions);
  const applicable = versions.filter((v) => {
    return compareVersions(v, fromVersion) > 0 && compareVersions(v, toVersion) <= 0;
  });
  const all: MigrationItem[] = [];
  for (const version of applicable) {
    all.push(...manifests[version].migrations);
  }
  return all;
}

export function getLegacyMigrationMetadata(
  fromVersion: string,
  toVersion: string,
): {
  breaking: boolean;
  recommendMigrate: boolean;
} {
  const manifests = loadLegacyManifests();
  const versions = Object.keys(manifests).sort(compareVersions);
  const applicable = versions.filter((v) => {
    return compareVersions(v, fromVersion) > 0 && compareVersions(v, toVersion) <= 0;
  });
  let breaking = false;
  let recommendMigrate = false;
  for (const version of applicable) {
    const manifest = manifests[version];
    if (manifest.breaking) breaking = true;
    if (manifest.recommendMigrate) recommendMigrate = true;
  }
  return { breaking, recommendMigrate };
}

export const LEGACY_MANIFESTS_DIR_PATH = LEGACY_MANIFESTS_DIR;
