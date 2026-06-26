/**
 * Normalize text for mirror diff and rules validation comparisons.
 * Trims trailing whitespace per line and normalizes line endings to LF.
 */
export function normalizeText(content: string): string {
  return content
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/u, ""))
    .join("\n");
}

export function normalizedByteLength(content: string): number {
  return Buffer.byteLength(normalizeText(content), "utf-8");
}
