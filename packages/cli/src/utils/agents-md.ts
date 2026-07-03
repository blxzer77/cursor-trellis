/**
 * AGENTS.md managed-block helpers.
 *
 * cursor-trellis maintains a `<!-- CSTL:START -->...<!-- CSTL:END -->` block in
 * AGENTS.md. Upstream mindfold-ai/Trellis maintains a separate
 * `<!-- TRELLIS:START -->...<!-- TRELLIS:END -->` block. The two blocks can
 * coexist in the same file so a repo can run upstream Trellis (other platforms)
 * and cursor-trellis (Cursor) side by side.
 *
 * cursor-trellis never touches the upstream TRELLIS block or user content
 * outside its own CSTL block.
 */

export const CSTL_BLOCK_START = "<!-- CSTL:START -->";
export const CSTL_BLOCK_END = "<!-- CSTL:END -->";
export const LEGACY_TRELLIS_BLOCK_START = "<!-- TRELLIS:START -->";
export const LEGACY_TRELLIS_BLOCK_END = "<!-- TRELLIS:END -->";

/** Extract the first block delimited by `startMarker`/`endMarker`, or null. */
export function extractBlock(
  content: string,
  startMarker: string,
  endMarker: string,
): string | null {
  const start = content.indexOf(startMarker);
  if (start === -1) return null;
  const end = content.indexOf(endMarker, start);
  if (end === -1) return null;
  return content.slice(start, end + endMarker.length);
}

/**
 * Insert or refresh the CSTL managed block in `existingContent` WITHOUT
 * touching an upstream TRELLIS block or user content outside the blocks.
 *
 * - If `existingContent` already has a CSTL block → replace just that block.
 * - Else if it has a legacy TRELLIS block → insert the CSTL block right after
 *   the TRELLIS block (coexistence with upstream Trellis).
 * - Else → append the CSTL block at the end.
 *
 * `templateContent` must contain a CSTL block; its block is extracted and used
 * as the inserted/refreshed CSTL block content. If `templateContent` has no
 * CSTL block, the whole `templateContent` is used as the block (fallback).
 */
export function insertCstlManagedBlock(
  existingContent: string,
  templateContent: string,
): string {
  const block =
    extractBlock(templateContent, CSTL_BLOCK_START, CSTL_BLOCK_END) ??
    templateContent;

  // Case 1: existing already has a CSTL block → replace it in place.
  const cstlStart = existingContent.indexOf(CSTL_BLOCK_START);
  if (cstlStart !== -1) {
    const cstlEnd = existingContent.indexOf(CSTL_BLOCK_END, cstlStart);
    if (cstlEnd !== -1) {
      return (
        existingContent.slice(0, cstlStart) +
        block +
        existingContent.slice(cstlEnd + CSTL_BLOCK_END.length)
      );
    }
  }

  // Case 2: existing has a legacy TRELLIS block → coexist: insert CSTL block
  // immediately after the TRELLIS block. Never modify the TRELLIS block.
  const trellisStart = existingContent.indexOf(LEGACY_TRELLIS_BLOCK_START);
  if (trellisStart !== -1) {
    const trellisEnd = existingContent.indexOf(
      LEGACY_TRELLIS_BLOCK_END,
      trellisStart,
    );
    if (trellisEnd !== -1) {
      const after = trellisEnd + LEGACY_TRELLIS_BLOCK_END.length;
      return (
        existingContent.slice(0, after) +
        "\n\n" +
        block +
        existingContent.slice(after)
      );
    }
  }

  // Case 3: no managed block → append at end, preserving any user content.
  const trimmed = existingContent.replace(/\s+$/, "");
  return `${trimmed}\n\n${block}\n`;
}

/** True if `content` contains a CSTL managed block. */
export function hasCstlBlock(content: string): boolean {
  return (
    content.includes(CSTL_BLOCK_START) &&
    content.indexOf(CSTL_BLOCK_END) >
      content.indexOf(CSTL_BLOCK_START)
  );
}

/** True if `content` contains a legacy TRELLIS managed block. */
export function hasLegacyTrellisBlock(content: string): boolean {
  return (
    content.includes(LEGACY_TRELLIS_BLOCK_START) &&
    content.indexOf(LEGACY_TRELLIS_BLOCK_END) >
      content.indexOf(LEGACY_TRELLIS_BLOCK_START)
  );
}
