import {
  inspectManagedBlock,
  patchManagedBlock,
  replaceManagedBlockSpan,
  PACTILE_MARKERS,
} from "../pactile/projection/managed-block.js";

export const PACTILE_BLOCK_START = PACTILE_MARKERS.start;
export const PACTILE_BLOCK_END = PACTILE_MARKERS.end;
export const LEGACY_CSTL_BLOCK_START = "<!-- CSTL:START -->";
export const LEGACY_CSTL_BLOCK_END = "<!-- CSTL:END -->";
export const FOREIGN_TRELLIS_BLOCK_START = "<!-- TRELLIS:START -->";
export const FOREIGN_TRELLIS_BLOCK_END = "<!-- TRELLIS:END -->";

const legacyCstl = {
  start: LEGACY_CSTL_BLOCK_START,
  end: LEGACY_CSTL_BLOCK_END,
};
const foreignTrellis = {
  start: FOREIGN_TRELLIS_BLOCK_START,
  end: FOREIGN_TRELLIS_BLOCK_END,
};

export interface InsertPactileManagedBlockOptions {
  /**
   * Legacy CSTL markers are not ownership proof by themselves. Set this only
   * after the lifecycle migration plan established Pactile ownership and
   * retained the preimage.
   */
  readonly migrateOwnedLegacyCstl?: boolean;
}

/** Ambiguous or duplicate markers are never ownership evidence. */
export function extractBlock(
  content: string,
  startMarker: string,
  endMarker: string,
): string | null {
  const span = inspectManagedBlock(content, {
    start: startMarker,
    end: endMarker,
  });
  return span.status === "present" ? span.text : null;
}

/**
 * Insert or replace the canonical Pactile block while preserving every byte
 * outside it. A foreign TRELLIS block is never rewritten. An owned CSTL block
 * is migrated only when the caller supplies explicit ownership evidence.
 */
export function insertPactileManagedBlock(
  existingContent: string,
  templateContent: string,
  options: InsertPactileManagedBlockOptions = {},
): string {
  const template = inspectManagedBlock(templateContent, PACTILE_MARKERS);
  const current = inspectManagedBlock(existingContent, PACTILE_MARKERS);
  const oldCstl = inspectManagedBlock(existingContent, legacyCstl);
  const upstream = inspectManagedBlock(existingContent, foreignTrellis);

  if (
    template.status === "review" ||
    current.status === "review" ||
    oldCstl.status === "review" ||
    upstream.status === "review"
  ) {
    return existingContent;
  }

  if (current.status === "present" && oldCstl.status === "present") {
    return existingContent;
  }

  const desired =
    template.status === "present" ? template.text : templateContent;

  if (current.status === "present") {
    const result = replaceManagedBlockSpan(
      existingContent,
      desired,
      PACTILE_MARKERS,
    );
    return result.status === "merged" ? result.text : existingContent;
  }

  if (oldCstl.status === "present") {
    if (!options.migrateOwnedLegacyCstl) return existingContent;
    const result = replaceManagedBlockSpan(existingContent, desired, legacyCstl);
    return result.status === "merged" ? result.text : existingContent;
  }

  const result = patchManagedBlock(
    existingContent,
    desired,
    PACTILE_MARKERS,
    existingContent.length,
  );
  return result.status === "merged" ? result.text : existingContent;
}

export function hasPactileBlock(content: string): boolean {
  return inspectManagedBlock(content, PACTILE_MARKERS).status === "present";
}

export function hasLegacyCstlBlock(content: string): boolean {
  return inspectManagedBlock(content, legacyCstl).status === "present";
}

export function hasForeignTrellisBlock(content: string): boolean {
  return inspectManagedBlock(content, foreignTrellis).status === "present";
}

export function removePactileManagedBlock(content: string): string {
  const result = patchManagedBlock(content, null, PACTILE_MARKERS);
  return result.status === "merged" ? result.text : content;
}
