import type { MigrationItem } from "../../types/migration.js";

const READ_ONLY_LEGACY_ROOTS = [".cstl", ".trellis"] as const;

function targetsReadOnlyLegacyRoot(value: string | undefined): boolean {
  if (value === undefined) return false;
  const normalized = value.replaceAll("\\", "/");
  return READ_ONLY_LEGACY_ROOTS.some(
    (root) => normalized === root || normalized.startsWith(`${root}/`),
  );
}

/**
 * Historical manifests may still describe writes inside old runtime roots.
 * Those roots are immutable import inputs in Pactile, so canonical update may
 * retain host cleanup entries while dropping every legacy-root mutation.
 */
export function filterReadOnlyLegacyMigrationItems(
  items: readonly MigrationItem[],
): MigrationItem[] {
  return items.filter(
    (item) =>
      !targetsReadOnlyLegacyRoot(item.from) &&
      !targetsReadOnlyLegacyRoot(item.to),
  );
}
