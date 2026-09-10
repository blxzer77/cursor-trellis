/**
 * Command-line compatibility spellings retained only for the 0.5.x window.
 * Keeping them here makes the legacy surface explicit and independently
 * removable without leaking old names into the canonical command registry.
 */
export const LEGACY_IMPORT_OPTION = "--import-cstl";

export const LEGACY_IMPORT_DESCRIPTION =
  "Explicitly import an existing .cstl tree as a read-only legacy source";

export const LEGACY_UPDATE_BLOCK_MESSAGE =
  "Error: legacy workflow detected. Run `pactile init --import-cstl` from a checkout without .pactile; update will not write .cstl or .trellis.";
