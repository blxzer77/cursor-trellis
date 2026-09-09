/** Compatibility facade; current callers keep CSTL/TRELLIS coexistence semantics. */
import {
  inspectManagedBlock,
  patchManagedBlock,
  replaceManagedBlockSpan,
} from "../pactile/projection/managed-block.js";

export const CSTL_BLOCK_START = "<!-- CSTL:START -->";
export const CSTL_BLOCK_END = "<!-- CSTL:END -->";
export const LEGACY_TRELLIS_BLOCK_START = "<!-- TRELLIS:START -->";
export const LEGACY_TRELLIS_BLOCK_END = "<!-- TRELLIS:END -->";
const cstl = { start: CSTL_BLOCK_START, end: CSTL_BLOCK_END };
const legacy = {
  start: LEGACY_TRELLIS_BLOCK_START,
  end: LEGACY_TRELLIS_BLOCK_END,
};

/** Ambiguous/duplicate markers are not ownership evidence. */
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

export function insertCstlManagedBlock(
  existingContent: string,
  templateContent: string,
): string {
  const template = inspectManagedBlock(templateContent, cstl);
  const current = inspectManagedBlock(existingContent, cstl);
  if (template.status === "review" || current.status === "review")
    return existingContent;
  // Preserve the legacy bare-template fallback, without trimming foreign bytes.
  if (template.status === "absent") {
    if (current.status === "present") {
      const result = replaceManagedBlockSpan(
        existingContent,
        templateContent,
        cstl,
      );
      return result.status === "merged" ? result.text : existingContent;
    }
    return `${existingContent}\n\n${templateContent}\n`;
  }
  const old = inspectManagedBlock(existingContent, legacy);
  if (old.status === "review" && current.status === "absent")
    return existingContent;
  const result = patchManagedBlock(
    existingContent,
    template.text,
    cstl,
    old.status === "present" ? old.end : existingContent.length,
  );
  return result.status === "merged" ? result.text : existingContent;
}

export function hasCstlBlock(content: string): boolean {
  return inspectManagedBlock(content, cstl).status === "present";
}
export function hasLegacyTrellisBlock(content: string): boolean {
  return inspectManagedBlock(content, legacy).status === "present";
}
export function removeCstlManagedBlock(content: string): string {
  const result = patchManagedBlock(content, null, cstl);
  return result.status === "merged" ? result.text : content;
}
